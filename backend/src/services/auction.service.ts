import { Auction } from '../models/Auction';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { Bid } from '../models/Bid';
import { Order } from '../models/Order';
import { 
  CreateAuctionDto, 
  UpdateAuctionStatusDto, 
  AuctionQueryDto, 
  AuctionResponseDto,
  AuctionStateMachine,
  AuctionCacheKeys 
} from '../dto/auction.dto';
import { AuthenticationError, AuthorizationError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { redisUtils } from '../config/redis';
import { distributedLock } from '../utils/distributed-lock';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import { getNotificationService } from '../services/notification.service.factory';
import { notificationCrudService } from '../services/notification-crud.service';
import { roundPrice2, parsePrice2 } from '../utils/price-utils';

export class AuctionService {
  /**
   * 创建竞拍
   */
  async createAuction(merchantId: number, data: CreateAuctionDto): Promise<AuctionResponseDto> {
    try {
      // 验证商品是否存在且属于当前商家
      const product = await Product.findByPk(data.product_id);
      if (!product) {
        throw new NotFoundError('商品不存在');
      }

      if (product.merchant_id !== merchantId) {
        throw new AuthorizationError('只能为自己的商品创建竞拍');
      }

      // 检查商品是否已有活跃竞拍（已取消的竞拍不阻止创建新竞拍）
      const existingAuction = await Auction.findOne({
        where: { 
          product_id: data.product_id,
          status: { [Op.ne]: 'cancelled' }
        }
      });

      if (existingAuction) {
        throw new ValidationError('该商品已有竞拍');
      }

      // 创建竞拍
      const auction = await Auction.create({
        product_id: data.product_id,
        status: 'pending',
      });

      logger.info(`Auction created: ${auction.id} for product ${data.product_id}`);

      return this.formatAuctionResponse(auction, product);
    } catch (error) {
      logger.error('Create auction failed:', error);
      throw error;
    }
  }

  /**
   * 开始竞拍
   */
  async startAuction(auctionId: number, merchantId: number): Promise<AuctionResponseDto> {
    const transaction = await sequelize.transaction();
    
    try {
      const auction = await Auction.findByPk(auctionId, {
        include: [{ model: Product, as: 'product' }],
        lock: true,
        transaction,
      });

      if (!auction) {
        throw new NotFoundError('竞拍不存在');
      }

      if (auction.product.merchant_id !== merchantId) {
        throw new AuthorizationError('只能操作自己商品的竞拍');
      }

      AuctionStateMachine.validateTransition(auction.status, 'active');

      if (auction.product.stock <= 0) {
        throw new ValidationError('商品库存不足，无法开始竞拍');
      }

      // 设置开始和结束时间
      const now = new Date();
      const duration = auction.product.duration * 60 * 1000; // 转换为毫秒
      const endTime = new Date(now.getTime() + duration);

      // 更新竞拍状态
      await auction.update({
        start_time: now,
        end_time: endTime,
        current_price: auction.product.starting_price,
        status: 'active',
      }, { transaction });

      // 更新商品状态（跳过验证，仅更新status字段，避免触发价格校验钩子）
      await auction.product.update({
        status: 'active',
      }, { transaction, validate: false });

      // 初始化Redis缓存
      await this.initializeAuctionCache(auction);

      await transaction.commit();

      logger.info(`Auction started: ${auctionId}`);

      return this.formatAuctionResponse(auction, auction.product);
    } catch (error) {
      await transaction.rollback();
      logger.error('Start auction failed:', error);
      throw error;
    }
  }

  /**
   * 初始化竞拍Redis缓存
   */
  private async initializeAuctionCache(auction: any): Promise<void> {
    try {
      const auctionKey = AuctionCacheKeys.auction(auction.id);
      const bidsKey = AuctionCacheKeys.auctionBids(auction.id);
      const leaderboardKey = AuctionCacheKeys.auctionLeaderboard(auction.id);
      const onlineUsersKey = AuctionCacheKeys.auctionOnlineUsers(auction.id);
      const activeAuctionsKey = AuctionCacheKeys.activeAuctions();

      // 存储竞拍基本信息
      await redisUtils.set(auctionKey, JSON.stringify({
        id: auction.id,
        product_id: auction.product_id,
        start_time: auction.start_time ? new Date(auction.start_time).getTime() : 0,
        end_time: auction.end_time ? new Date(auction.end_time).getTime() : 0,
        current_price: parsePrice2(auction.current_price),
        winner_id: auction.winner_id || null,
        status: auction.status,
        cap_price: auction.product.cap_price ? parsePrice2(auction.product.cap_price) : null,
        delay_time: auction.product.delay_time,
        price_increment: parsePrice2(auction.product.price_increment),
      }), 86400); // 24小时过期

      // 添加到活跃竞拍集合
      await redisUtils.sadd(activeAuctionsKey, auction.id.toString());

      // 设置竞拍结束定时器（通过Redis键过期触发）
      const timeLeft = AuctionStateMachine.getTimeLeft(auction);
      if (timeLeft > 0) {
        await redisUtils.set(AuctionCacheKeys.auctionTimer(auction.id), 'active', timeLeft);
      }

      logger.info(`Auction cache initialized: ${auction.id}`);
    } catch (error) {
      logger.error('Initialize auction cache failed:', error);
      // 缓存初始化失败不影响主流程
    }
  }

  /**
   * 处理出价
   */
  async placeBid(auctionId: number, userId: number, amount: number): Promise<{
    success: boolean;
    message: string;
    auction: AuctionResponseDto;
    isExtended?: boolean;
    isCompleted?: boolean;
  }> {
    // 确保价格精度：对传入的 amount 进行标准化处理
    amount = roundPrice2(amount);

    const lockKey = `auction_bid:${auctionId}`;
    const lockId = await distributedLock.acquireLockWithRetry(lockKey, 5000, 50, 100);

    if (!lockId) {
      throw new ValidationError('当前出价人数较多，请稍后重试');
    }

    const transaction = await sequelize.transaction();
    
    try {
      const auction = await Auction.findByPk(auctionId, {
        include: [{ model: Product, as: 'product' }],
        lock: true,
        transaction,
      });

      if (!auction) {
        throw new NotFoundError('竞拍不存在');
      }

      const product = auction.product;

      if (auction.status !== 'active') {
        throw new ValidationError('竞拍未在进行中');
      }

      if (AuctionStateMachine.isEnded(auction)) {
        throw new ValidationError('竞拍已结束');
      }

      const currentPrice = parsePrice2(auction.current_price);
      const priceIncrement = parsePrice2(product.price_increment);
      const capPrice = product.cap_price ? parsePrice2(product.cap_price) : undefined;

      const minBid = roundPrice2(currentPrice + priceIncrement);
      if (amount < minBid) {
        throw new ValidationError(`出价金额必须大于等于 ${minBid}`);
      }

      if (capPrice && amount > capPrice) {
        throw new ValidationError(`出价金额不能超过封顶价 ${capPrice}`);
      }

      const reachedCap = AuctionStateMachine.hasReachedCapPrice(amount, capPrice);

      const bidTime = new Date();
      const auctionDataForExtend = {
        end_time: auction.end_time,
        delay_time: product.delay_time,
      };
      const shouldExtend = AuctionStateMachine.shouldExtend(auctionDataForExtend, bidTime, product.delay_time);
      let newEndTime = auction.end_time;

      if (shouldExtend) {
        newEndTime = AuctionStateMachine.calculateNewEndTime(auctionDataForExtend, bidTime, product.delay_time);
      }

      await auction.update({
        current_price: amount,
        winner_id: userId,
        end_time: newEndTime,
        ...(reachedCap && { status: 'completed' }),
      }, { transaction });

      await Bid.create({
        auction_id: auctionId,
        user_id: userId,
        amount,
      }, { transaction });

      await this.updateAuctionCache(auctionId, {
        current_price: amount,
        winner_id: userId,
        end_time: newEndTime ? new Date(newEndTime).getTime() : 0,
        ...(reachedCap && { status: 'completed' }),
      });

      await this.updateLeaderboard(auctionId, userId, amount);

      if (auction.winner_id && auction.winner_id !== userId) {
        try {
          await notificationCrudService.notifyOutbid(
            auction.winner_id,
            auctionId,
            product.name,
            amount
          );
        } catch (notifyErr) {
          logger.error('Failed to notify outbid user:', notifyErr);
        }
      }

      if (reachedCap) {
        await this.completeAuction(auctionId, transaction);
      }

      await transaction.commit();

      const updatedAuction = await Auction.findByPk(auctionId, {
        include: [
          { model: Product, as: 'product' },
          { model: User, as: 'winner', attributes: ['id', 'username', 'avatar'] },
        ],
      });

      if (!updatedAuction) {
        throw new NotFoundError('竞拍不存在');
      }

      logger.info(`Bid placed: auction ${auctionId}, user ${userId}, amount ${amount}`);

      const auctionResponse = this.formatAuctionResponse(updatedAuction, updatedAuction.product);
      const { bidsCount, participantCount } = await this.getBidStats(auctionId);
      auctionResponse.bids_count = bidsCount;
      auctionResponse.participant_count = participantCount;
      auctionResponse.online_count = await this.getOnlineCount(auctionId);

      return {
        success: true,
        message: reachedCap ? '出价成功，已达到封顶价自动成交' : '出价成功',
        auction: auctionResponse,
        isExtended: shouldExtend,
        isCompleted: reachedCap,
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Place bid failed:', error);
      throw error;
    } finally {
      await distributedLock.releaseLock(lockKey, lockId);
    }
  }

  /**
   * 从Redis获取竞拍信息
   */
  private async getAuctionFromCache(auctionId: number): Promise<any> {
    try {
      const auctionKey = AuctionCacheKeys.auction(auctionId);
      const data = await redisUtils.get(auctionKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Get auction from cache failed:', error);
      return null;
    }
  }

  /**
   * 更新Redis中的竞拍信息
   */
  private async updateAuctionCache(auctionId: number, updates: any): Promise<void> {
    try {
      const auctionKey = AuctionCacheKeys.auction(auctionId);
      const existingData = await this.getAuctionFromCache(auctionId);
      
      if (existingData) {
        const updatedData = { ...existingData, ...updates };
        await redisUtils.set(auctionKey, JSON.stringify(updatedData), 86400);
      }
    } catch (error) {
      logger.error('Update auction cache failed:', error);
    }
  }

  /**
   * 更新排行榜
   */
  private async updateLeaderboard(auctionId: number, userId: number, amount: number): Promise<void> {
    try {
      const leaderboardKey = AuctionCacheKeys.auctionLeaderboard(auctionId);
      await redisUtils.zadd(leaderboardKey, amount, userId.toString());
    } catch (error) {
      logger.error('Update leaderboard failed:', error);
    }
  }

  /**
   * 结束竞拍
   */
  async completeAuction(auctionId: number, transaction?: any): Promise<AuctionResponseDto> {
    const shouldManageTransaction = !transaction;
    const tx = transaction || await sequelize.transaction();

    try {
      const auction = await Auction.findByPk(auctionId, {
        include: [
          { model: Product, as: 'product' },
          { model: User, as: 'winner', attributes: ['id', 'username', 'avatar'] },
        ],
        ...(shouldManageTransaction ? { lock: true, transaction: tx } : { transaction: tx }),
      });

      if (!auction) {
        throw new NotFoundError('竞拍不存在');
      }

      AuctionStateMachine.validateTransition(auction.status, 'completed');

      if (!AuctionStateMachine.validateProductAuctionConsistency(auction.status, auction.product.status)) {
        logger.warn(`Product-Auction status inconsistency: auction=${auction.status}, product=${auction.product.status}, correcting product status`);
        await auction.product.update({
          status: AuctionStateMachine.getExpectedProductStatus(auction.status),
        }, { transaction: tx, validate: false });
      }

      const latestCacheData = await this.getAuctionFromCache(auctionId);
      const latestPrice = latestCacheData?.current_price
        ? parsePrice2(latestCacheData.current_price)
        : parsePrice2(auction.current_price);
      const latestWinnerId = latestCacheData?.winner_id
        ? Number(latestCacheData.winner_id)
        : auction.winner_id;

      await auction.update({
        status: 'completed',
        ...(latestPrice > parsePrice2(auction.current_price) && {
          current_price: latestPrice,
          winner_id: latestWinnerId,
        }),
      }, { transaction: tx });

      await auction.product.decrement('stock', { by: 1, transaction: tx });
      await auction.product.reload({ transaction: tx });

      await auction.product.update({
        status: 'completed',
      }, { transaction: tx, validate: false });

      if (auction.winner_id) {
        const existingOrder = await Order.findOne({
          where: { auction_id: auctionId },
          transaction: tx,
        });

        if (!existingOrder) {
          await this.createOrder(auction, tx);
        } else {
          logger.info(`Order already exists for auction ${auctionId}, skipping order creation`);
        }
      } else {
        logger.warn(`Auction ${auctionId} completed without winner, no order created`);
      }

      let savedBidsCount = 0;
      let savedParticipantCount = 0;
      try {
        const savedStats = await this.getBidStats(auctionId);
        savedBidsCount = savedStats.bidsCount;
        savedParticipantCount = savedStats.participantCount;
      } catch (e) {
        logger.error('Failed to save bid stats before cleanup:', e);
      }

      await this.cleanupAuctionCache(auctionId);

      if (auction.winner_id) {
        try {
          await notificationCrudService.notifyAuctionWon(
            auction.winner_id,
            auctionId,
            auction.product.name,
            parsePrice2(auction.current_price)
          );
        } catch (notifyErr) {
          logger.error('Failed to notify auction won:', notifyErr);
        }
      }

      try {
        const allBidders = await Bid.findAll({
          where: { auction_id: auctionId },
          attributes: [[sequelize.fn('DISTINCT', sequelize.col('user_id')), 'user_id']],
          raw: true,
        });
        const bidderIds = allBidders.map((b: any) => b.user_id).filter((id: number) => id !== auction.winner_id);
        for (const bidderId of bidderIds) {
          try {
            await notificationCrudService.notifyAuctionEnded(
              bidderId,
              auctionId,
              auction.product.name,
              parsePrice2(auction.current_price)
            );
          } catch (notifyErr) {
            logger.error(`Failed to notify auction ended for user ${bidderId}:`, notifyErr);
          }
        }
      } catch (notifyErr) {
        logger.error('Failed to notify auction ended participants:', notifyErr);
      }

      if (auction.product.stock <= auction.product.stock_warning && auction.product.stock > 0) {
        try {
          const notificationService = getNotificationService();
          if (notificationService) {
            await notificationService.sendToUser(auction.product.merchant_id, 'stock_warning', {
              productId: auction.product.id,
              productName: auction.product.name,
              stock: auction.product.stock,
              stockWarning: auction.product.stock_warning,
              message: `商品「${auction.product.name}」库存不足，当前库存: ${auction.product.stock}`,
            });
          }
          const { notificationCrudService } = require('./notification-crud.service');
          await notificationCrudService.notifyStockWarning(
            auction.product.merchant_id,
            auction.product.id,
            auction.product.name,
            auction.product.stock,
            auction.product.stock_warning
          );
        } catch (notifyError) {
          logger.error('Low stock notification failed:', notifyError);
        }
      }

      if (auction.product.stock <= 0) {
        try {
          const notificationService = getNotificationService();
          if (notificationService) {
            await notificationService.sendToUser(auction.product.merchant_id, 'stock_out', {
              productId: auction.product.id,
              productName: auction.product.name,
              message: `商品「${auction.product.name}」已售罄`,
            });
          }
        } catch (notifyError) {
          logger.error('Stock out notification failed:', notifyError);
        }
      }

      if (shouldManageTransaction) {
        await (tx as any).commit();
      }

      await auction.reload({
        include: [
          { model: Product, as: 'product' },
          { model: User, as: 'winner', attributes: ['id', 'username', 'avatar'] },
        ],
      });

      const { bidsCount, participantCount } = await this.getBidStats(auctionId);
      const onlineCount = await this.getOnlineCount(auctionId);

      logger.info(`Auction completed: ${auctionId}, winner: ${auction.winner_id}`);

      const response = this.formatAuctionResponse(auction, auction.product);
      response.bids_count = bidsCount > 0 ? bidsCount : savedBidsCount;
      response.participant_count = participantCount > 0 ? participantCount : savedParticipantCount;
      response.online_count = onlineCount;
      return response;
    } catch (error) {
      if (shouldManageTransaction) {
        await (tx as any).rollback();
      }
      logger.error('Complete auction failed:', error);
      throw error;
    }
  }

  /**
   * 创建订单
   */
  private async createOrder(auction: any, transaction?: any): Promise<void> {
    try {
      await Order.create({
        auction_id: auction.id,
        user_id: auction.winner_id,
        merchant_id: auction.product.merchant_id,
        amount: auction.current_price,
        status: 'pending',
      }, { ...(transaction && { transaction }) });

      logger.info(`Order created for auction ${auction.id}, winner ${auction.winner_id}, merchant ${auction.product.merchant_id}`);
    } catch (error) {
      logger.error('Create order failed:', error);
      throw error;
    }
  }

  /**
   * 取消竞拍
   */
  async cancelAuction(auctionId: number, merchantId: number): Promise<AuctionResponseDto> {
    const transaction = await sequelize.transaction();
    
    try {
      const auction = await Auction.findByPk(auctionId, {
        include: [{ model: Product, as: 'product' }],
        lock: true,
        transaction,
      });

      if (!auction) {
        throw new NotFoundError('竞拍不存在');
      }

      if (auction.product.merchant_id !== merchantId) {
        throw new AuthorizationError('只能操作自己商品的竞拍');
      }

      AuctionStateMachine.validateTransition(auction.status, 'cancelled');

      if (auction.status === 'active') {
        const existingOrder = await Order.findOne({
          where: { auction_id: auctionId },
          transaction,
        });

        if (existingOrder) {
          await existingOrder.update({ status: 'cancelled' }, { transaction });
          logger.info(`Order cancelled for auction ${auctionId}`);
        }
      }

      await auction.update({
        status: 'cancelled',
        winner_id: undefined,
      }, { transaction });

      await auction.product.update({
        status: 'cancelled',
      }, { transaction, validate: false });

      await this.cleanupAuctionCache(auctionId);

      await transaction.commit();

      logger.info(`Auction cancelled: ${auctionId}`);

      // 通知所有参与者竞拍已被取消
      try {
        const allBidders = await Bid.findAll({
          where: { auction_id: auctionId },
          attributes: [[sequelize.fn('DISTINCT', sequelize.col('user_id')), 'user_id']],
          raw: true,
        });
        const productName = auction.product.name || '商品';
        const reason = '商家取消了该竞拍';

        // 为每个参与者创建数据库通知
        for (const bidder of allBidders) {
          try {
            await notificationCrudService.notifyAuctionCancelled(
              bidder.user_id,
              auctionId,
              productName,
              reason
            );
          } catch (notifyErr) {
            logger.error(`Failed to notify bidder ${bidder.user_id} about auction cancel:`, notifyErr);
          }
        }

        // 通过 WebSocket 广播竞拍取消事件
        const notificationService = getNotificationService();
        if (notificationService) {
          await notificationService.notifyAuctionCancelled(auctionId, reason);
        }
      } catch (notifyErr) {
        logger.error('Failed to notify auction cancelled:', notifyErr);
      }

      return this.formatAuctionResponse(auction, auction.product);
    } catch (error) {
      await transaction.rollback();
      logger.error('Cancel auction failed:', error);
      throw error;
    }
  }

  /**
   * 清理竞拍Redis缓存
   */
  private async cleanupAuctionCache(auctionId: number): Promise<void> {
    try {
      const keys = [
        AuctionCacheKeys.auction(auctionId),
        AuctionCacheKeys.auctionBids(auctionId),
        AuctionCacheKeys.auctionLeaderboard(auctionId),
        AuctionCacheKeys.auctionOnlineUsers(auctionId),
        AuctionCacheKeys.auctionTimer(auctionId),
        `bid:stats:${auctionId}`,
      ];

      for (const key of keys) {
        await redisUtils.del(key);
      }

      // 从活跃竞拍集合中移除
      await redisUtils.srem(AuctionCacheKeys.activeAuctions(), auctionId.toString());

      logger.info(`Auction cache cleaned: ${auctionId}`);
    } catch (error) {
      logger.error('Cleanup auction cache failed:', error);
    }
  }

  /**
   * 获取竞拍详情
   */
  async getAuctionById(auctionId: number): Promise<AuctionResponseDto> {
    try {
      const auction = await Auction.findByPk(auctionId, {
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'images', 'starting_price', 'price_increment', 'duration', 'cap_price', 'delay_time', 'merchant_id', 'stock', 'stock_warning', 'description', 'specifications', 'sku', 'weight', 'shipping_template_id'] },
          { model: User, as: 'winner', attributes: ['id', 'username', 'avatar'] },
        ],
      });

      if (!auction) {
        throw new NotFoundError('竞拍不存在');
      }

      if (auction.status === 'active' && AuctionStateMachine.isEnded(auction)) {
        try {
          await this.completeAuction(auctionId);

          const updatedAuction = await Auction.findByPk(auctionId, {
            include: [
              { model: Product, as: 'product', attributes: ['id', 'name', 'images', 'starting_price', 'price_increment', 'duration', 'cap_price', 'delay_time', 'merchant_id', 'stock', 'stock_warning', 'description', 'specifications', 'sku', 'weight', 'shipping_template_id'] },
              { model: User, as: 'winner', attributes: ['id', 'username', 'avatar'] },
            ],
          });

          if (updatedAuction) {
            const onlineCount = await this.getOnlineCount(auctionId);
            const { bidsCount, participantCount } = await this.getBidStats(auctionId);
            const response = this.formatAuctionResponse(updatedAuction, updatedAuction.product);
            response.online_count = onlineCount;
            response.bids_count = bidsCount;
            response.participant_count = participantCount;
            return response;
          }
        } catch (error) {
          logger.error(`Auto-complete auction ${auctionId} in getAuctionById failed:`, error);
        }
      }

      const onlineCount = await this.getOnlineCount(auctionId);
      const { bidsCount, participantCount } = await this.getBidStats(auctionId);

      const response = this.formatAuctionResponse(auction, auction.product);
      response.online_count = onlineCount;
      response.bids_count = bidsCount;
      response.participant_count = participantCount;

      return response;
    } catch (error) {
      logger.error('Get auction failed:', error);
      throw error;
    }
  }

  /**
   * 获取在线人数
   */
  private async getOnlineCount(auctionId: number): Promise<number> {
    try {
      const onlineUsersKey = AuctionCacheKeys.auctionOnlineUsers(auctionId);
      return await redisUtils.scard(onlineUsersKey);
    } catch (error) {
      logger.error('Get online count failed:', error);
      return 0;
    }
  }

  private async getBidStats(auctionId: number): Promise<{ bidsCount: number; participantCount: number }> {
    try {
      const leaderboardKey = AuctionCacheKeys.auctionLeaderboard(auctionId);
      const participantCount = await redisUtils.zcard(leaderboardKey);

      const statsKey = `bid:stats:${auctionId}`;
      const statsData = await redisUtils.get(statsKey);
      if (statsData) {
        const stats = JSON.parse(statsData);
        const pc = stats.uniqueBidders || participantCount;
        if (pc > 0) {
          return {
            bidsCount: stats.totalBids || 0,
            participantCount: pc,
          };
        }
      }

      if (participantCount > 0) {
        let bidsCount = 0;
        try {
          bidsCount = await Bid.count({ where: { auction_id: auctionId } });
        } catch (e) {
          // ignore
        }
        return {
          bidsCount,
          participantCount,
        };
      }

      return await this.getBidStatsFromDB(auctionId);
    } catch (error) {
      logger.error('Get bid stats from Redis failed:', error);
      return await this.getBidStatsFromDB(auctionId);
    }
  }

  private async getBidStatsFromDB(auctionId: number): Promise<{ bidsCount: number; participantCount: number }> {
    try {
      const bidsCount = await Bid.count({ where: { auction_id: auctionId } });
      const participantRows = await Bid.findAll({
        where: { auction_id: auctionId },
        attributes: [[sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('user_id'))), 'count']],
        raw: true,
      });
      const participantCount = Number((participantRows[0] as any)?.count) || 0;
      return { bidsCount, participantCount };
    } catch (e) {
      return { bidsCount: 0, participantCount: 0 };
    }
  }

  /**
   * 获取竞拍列表
   */
  async getAuctions(query: AuctionQueryDto): Promise<{
    auctions: AuctionResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      // 构建查询条件
      const where: any = {};

      if (query.status) {
        where.status = query.status;
      }

      // 构建商品查询条件（用于搜索和商家筛选）
      const productWhere: any = {};
      if (query.keyword && query.keyword.trim()) {
        productWhere.name = { [Op.like]: `%${query.keyword.trim()}%` };
      }
      if (query.merchant_id) {
        productWhere.merchant_id = query.merchant_id;
      }

      // 排序
      const order: any[] = [];
      if (query.sort) {
        order.push([query.sort, query.order || 'DESC']);
      } else {
        order.push(['created_at', 'DESC']);
      }

      // 查询竞拍
      const { count, rows: auctions } = await Auction.findAndCountAll({
        where,
        include: [
          { 
            model: Product, 
            as: 'product',
            attributes: ['id', 'name', 'images', 'starting_price', 'price_increment', 'duration', 'cap_price', 'delay_time', 'merchant_id', 'stock', 'stock_warning'],
            where: Object.keys(productWhere).length > 0 ? productWhere : undefined,
            include: [
              { model: User, as: 'merchant', attributes: ['id', 'username', 'avatar'] },
            ],
          },
          { model: User, as: 'winner', attributes: ['id', 'username', 'avatar'] },
        ],
        order,
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      const auctionResponses = await Promise.all(
        auctions.map(async (auction) => {
          const response = this.formatAuctionResponse(auction, auction.product);
          const { bidsCount, participantCount } = await this.getBidStats(auction.id);
          response.bids_count = bidsCount;
          response.participant_count = participantCount;
          response.online_count = await this.getOnlineCount(auction.id);
          return response;
        })
      );

      return {
        auctions: auctionResponses,
        total: count,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Get auctions failed:', error);
      throw error;
    }
  }

  /**
   * 获取商家的竞拍列表
   */
  async getMerchantAuctions(merchantId: number, query: AuctionQueryDto): Promise<{
    auctions: AuctionResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      const where: any = {};

      if (query.status) {
        where.status = query.status;
      }

      const order: any[] = [];
      if (query.sort) {
        order.push([query.sort, query.order || 'DESC']);
      } else {
        order.push(['created_at', 'DESC']);
      }

      const { count, rows: auctions } = await Auction.findAndCountAll({
        where,
        include: [
          { 
            model: Product, 
            as: 'product',
            attributes: ['id', 'name', 'images', 'starting_price', 'price_increment', 'duration', 'cap_price', 'delay_time', 'merchant_id', 'stock', 'stock_warning'],
            where: { merchant_id: merchantId },
          },
          { model: User, as: 'winner', attributes: ['id', 'username', 'avatar'] },
        ],
        order,
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      const auctionResponses = await Promise.all(
        auctions.map(async (auction) => {
          const response = this.formatAuctionResponse(auction, auction.product);
          const { bidsCount, participantCount } = await this.getBidStats(auction.id);
          response.bids_count = bidsCount;
          response.participant_count = participantCount;
          response.online_count = await this.getOnlineCount(auction.id);
          return response;
        })
      );

      return {
        auctions: auctionResponses,
        total: count,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Get merchant auctions failed:', error);
      throw error;
    }
  }

  /**
   * 获取商品的竞拍
   */
  async getAuctionByProductId(productId: number): Promise<AuctionResponseDto | null> {
    try {
      const auction = await Auction.findOne({
        where: { product_id: productId },
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'images', 'starting_price', 'price_increment', 'duration', 'cap_price', 'delay_time', 'merchant_id', 'stock', 'stock_warning', 'description', 'specifications'] },
          { model: User, as: 'winner', attributes: ['id', 'username', 'avatar'] },
        ],
        order: [['created_at', 'DESC']],
      });

      if (!auction) {
        return null;
      }

      return this.formatAuctionResponse(auction, auction.product);
    } catch (error) {
      logger.error('Get auction by product failed:', error);
      throw error;
    }
  }

  /**
   * 用户加入竞拍房间
   */
  async joinAuctionRoom(auctionId: number, userId: number): Promise<void> {
    try {
      const onlineUsersKey = AuctionCacheKeys.auctionOnlineUsers(auctionId);
      await redisUtils.sadd(onlineUsersKey, userId.toString());
      logger.info(`User ${userId} joined auction room ${auctionId}`);
    } catch (error) {
      logger.error('Join auction room failed:', error);
    }
  }

  /**
   * 用户离开竞拍房间
   */
  async leaveAuctionRoom(auctionId: number, userId: number): Promise<void> {
    try {
      const onlineUsersKey = AuctionCacheKeys.auctionOnlineUsers(auctionId);
      await redisUtils.srem(onlineUsersKey, userId.toString());
      logger.info(`User ${userId} left auction room ${auctionId}`);
    } catch (error) {
      logger.error('Leave auction room failed:', error);
    }
  }

  /**
   * 获取竞拍排行榜
   */
  async getLeaderboard(auctionId: number, limit: number = 10): Promise<Array<{
    user_id: number;
    username: string;
    avatar?: string | null;
    amount: number;
    rank: number;
  }>> {
    try {
      const leaderboardKey = AuctionCacheKeys.auctionLeaderboard(auctionId);
      const entries = await redisUtils.zrevrange(leaderboardKey, 0, limit - 1, true);

      const userIds: number[] = [];
      const entryData: Array<{ userId: number; amount: number }> = [];
      for (let i = 0; i < entries.length; i += 2) {
        const userId = parseInt(entries[i]);
        const amount = parsePrice2(entries[i + 1]);
        userIds.push(userId);
        entryData.push({ userId, amount });
      }

      if (userIds.length === 0) {
        return await this.getLeaderboardFromDB(auctionId, limit);
      }

      const users = await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ['id', 'username', 'avatar'],
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      const leaderboard = [];
      for (let i = 0; i < entryData.length; i++) {
        const { userId, amount } = entryData[i];
        const user = userMap.get(userId);
        if (user) {
          leaderboard.push({
            user_id: user.id,
            username: user.username,
            avatar: user.avatar,
            amount,
            rank: i + 1,
          });
        }
      }

      return leaderboard;
    } catch (error) {
      logger.error('Get leaderboard failed:', error);
      return await this.getLeaderboardFromDB(auctionId, limit);
    }
  }

  private async getLeaderboardFromDB(auctionId: number, limit: number = 10): Promise<Array<{
    user_id: number;
    username: string;
    avatar?: string | null;
    amount: number;
    rank: number;
  }>> {
    try {
      const bidResults = await Bid.findAll({
        where: { auction_id: auctionId },
        attributes: [
          'user_id',
          [sequelize.fn('MAX', sequelize.col('amount')), 'max_amount'],
        ],
        group: ['user_id'],
        order: [[sequelize.literal('max_amount'), 'DESC']],
        limit,
        raw: true,
      });

      if (bidResults.length === 0) return [];

      const userIds = bidResults.map((b: any) => b.user_id);
      const users = await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ['id', 'username', 'avatar'],
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      return bidResults.map((b: any, i: number) => {
        const user = userMap.get(b.user_id);
        return {
          user_id: b.user_id,
          username: user?.username || `用户#${b.user_id}`,
          avatar: user?.avatar || null,
          amount: parsePrice2(b.max_amount),
          rank: i + 1,
        };
      });
    } catch (error) {
      logger.error('Get leaderboard from DB failed:', error);
      return [];
    }
  }

  /**
   * 上架商品（创建竞拍并立即开始）
   * 如果已有准备中的竞拍，直接将其改为进行中
   */
  async listProduct(merchantId: number, productId: number): Promise<AuctionResponseDto> {
    try {
      // 检查是否已有准备中的竞拍
      const existingPendingAuction = await Auction.findOne({
        where: {
          product_id: productId,
          status: 'pending',
        },
      });

      if (existingPendingAuction) {
        // 已有准备中的竞拍，直接将其改为进行中
        logger.info(`Found pending auction ${existingPendingAuction.id} for product ${productId}, starting it directly`);
        return await this.startAuction(existingPendingAuction.id, merchantId);
      }

      // 没有准备中的竞拍，创建新竞拍并立即开始
      const auction = await this.createAuction(merchantId, { product_id: productId });
      return await this.startAuction(auction.id, merchantId);
    } catch (error) {
      logger.error('List product failed:', error);
      throw error;
    }
  }

  /**
   * 下架商品（取消竞拍并将状态改为已取消）
   */
  async delistProduct(merchantId: number, productId: number): Promise<AuctionResponseDto> {
    const transaction = await sequelize.transaction();

    try {
      // 查找该商品的活跃竞拍
      const auction = await Auction.findOne({
        where: {
          product_id: productId,
          status: { [Op.ne]: 'cancelled' },
        },
        include: [{ model: Product, as: 'product' }],
        lock: true,
        transaction,
      });

      if (!auction) {
        throw new NotFoundError('该商品没有进行中的竞拍');
      }

      if (auction.product.merchant_id !== merchantId) {
        throw new AuthorizationError('只能操作自己商品的竞拍');
      }

      AuctionStateMachine.validateTransition(auction.status, 'cancelled');

      // 如果竞拍是活跃状态，取消关联订单
      if (auction.status === 'active') {
        const existingOrder = await Order.findOne({
          where: { auction_id: auction.id },
          transaction,
        });

        if (existingOrder) {
          await existingOrder.update({ status: 'cancelled' }, { transaction });
          logger.info(`Order cancelled for auction ${auction.id}`);
        }
      }

      // 更新竞拍状态为已取消
      await auction.update({
        status: 'cancelled',
        winner_id: undefined,
      }, { transaction });

      // 更新商品状态为已取消（跳过验证，仅更新status字段）
      await auction.product.update({
        status: 'cancelled',
      }, { transaction, validate: false });

      // 清理缓存
      await this.cleanupAuctionCache(auction.id);

      await transaction.commit();

      logger.info(`Product delisted: product ${productId}, auction ${auction.id}`);

      return this.formatAuctionResponse(auction, auction.product);
    } catch (error) {
      await transaction.rollback();
      logger.error('Delist product failed:', error);
      throw error;
    }
  }

  /**
   * 格式化竞拍响应
   */
  private formatAuctionResponse(auction: any, product?: any): AuctionResponseDto {
    const response: AuctionResponseDto = {
      id: auction.id,
      product_id: auction.product_id,
      start_time: auction.start_time,
      end_time: auction.end_time,
      current_price: auction.current_price != null ? parsePrice2(auction.current_price) : undefined,
      winner_id: auction.winner_id,
      status: auction.status,
      created_at: auction.created_at,
      updated_at: auction.updated_at,
      time_left: AuctionStateMachine.getTimeLeft(auction),
    };

    // 添加商品信息
    if (product) {
      const productData: any = {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images || [],
        starting_price: parsePrice2(product.starting_price),
        price_increment: parsePrice2(product.price_increment),
        duration: product.duration,
        cap_price: product.cap_price ? parsePrice2(product.cap_price) : undefined,
        delay_time: product.delay_time,
        merchant_id: product.merchant_id,
        stock: product.stock ?? 1,
        stock_warning: product.stock_warning ?? 5,
        sku: product.sku,
        weight: product.weight ? parseFloat(product.weight) : undefined,
        specifications: product.specifications || {},
      };

      // 添加商家信息（如果已关联查询）
      if (product.merchant) {
        productData.merchant = {
          id: product.merchant.id,
          username: product.merchant.username,
          avatar: product.merchant.avatar,
        };
      }

      response.product = productData;
    }

    // 添加获胜者信息
    if (auction.winner) {
      response.winner = {
        id: auction.winner.id,
        username: auction.winner.username,
        avatar: auction.winner.avatar,
      };
    }

    return response;
  }
}

export const auctionService = new AuctionService();