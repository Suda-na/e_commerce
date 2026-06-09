import { Bid } from '../models/Bid';
import { Auction } from '../models/Auction';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { 
  PlaceBidDto, 
  BidQueryDto, 
  BidResponseDto, 
  BidResultDto,
  LeaderboardEntryDto,
  BidStatsDto,
  BidHistoryDto,
  BidValidationDto,
  BidCacheKeys 
} from '../dto/bid.dto';
import { AuctionCacheKeys, AuctionStateMachine } from '../dto/auction.dto';
import { AuthenticationError, AuthorizationError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { redisUtils } from '../config/redis';
import { distributedLock } from '../utils/distributed-lock';
import { redisLua } from '../utils/redis-lua';
import { sequelize } from '../config/database';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { getNotificationService } from './notification.service.factory';
import { roundPrice2, parsePrice2 } from '../utils/price-utils';

export class BidService {
  /**
   * 处理出价（核心高并发方法）
   */
  async placeBid(auctionId: number, userId: number, data: PlaceBidDto): Promise<BidResultDto> {
    // 强制类型转换：防止上游传入 string 类型的 auctionId 或 userId
    auctionId = Number(auctionId);
    userId = Number(userId);
    const amount = roundPrice2(Number(data.amount));

    if (!auctionId || isNaN(auctionId) || auctionId <= 0) {
      throw new ValidationError('无效的竞拍ID');
    }
    if (!userId || isNaN(userId) || userId <= 0) {
      throw new ValidationError('无效的用户ID');
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new ValidationError('无效的出价金额');
    }

    const requestId = data.requestId || uuidv4();
    const bidIdempotencyKey = BidCacheKeys.bidIdempotency(auctionId, requestId);
    const bidLockKey = BidCacheKeys.bidLock(auctionId);
    const rateLimitKey = BidCacheKeys.bidRateLimit(auctionId, userId);

    try {
      // 1. 检查出价频率限制（防止恶意刷价）
      const isRateLimited = await this.checkRateLimit(rateLimitKey);
      if (isRateLimited) {
        throw new ValidationError('出价过于频繁，请稍后再试');
      }

      // 2. 检查出价幂等性（防止重复出价）
      const isNewBid = await redisLua.atomicCheckIdempotency(bidIdempotencyKey, requestId, 300);
      if (!isNewBid) {
        throw new ValidationError('重复的出价请求');
      }

      // 3. 获取分布式锁
      const lockRequestId = await distributedLock.acquireLockWithRetry(bidLockKey, 5000, 20, 50);
      if (!lockRequestId) {
        throw new ValidationError('系统繁忙，请稍后再试');
      }

      try {
        // 4. 获取竞拍信息
        const auction = await this.getAuctionInfo(auctionId);
        if (!auction) {
          throw new NotFoundError('竞拍不存在');
        }

        // 5. 验证出价金额
        const validation = await this.validateBidAmount(auctionId, amount);
        if (!validation.valid) {
          throw new ValidationError(validation.message!);
        }

        // 6. 执行原子出价操作
        const auctionKey = AuctionCacheKeys.auction(auctionId);
        const leaderboardKey = AuctionCacheKeys.auctionLeaderboard(auctionId);
        const currentTime = Date.now();

        const bidResult = await redisLua.atomicBid(
          auctionKey,
          leaderboardKey,
          userId,
          amount,
          auction.price_increment,
          auction.cap_price,
          auction.delay_time,
          currentTime
        );

        if (!bidResult.success) {
          throw new ValidationError(bidResult.message);
        }

        // 7. 同步写入数据库（确保出价记录立即持久化）
        try {
          await Bid.create({
            auction_id: auctionId,
            user_id: userId,
            amount,
          });
          logger.info(`Bid saved to database: auction ${auctionId}, user ${userId}, amount ${amount}`);
        } catch (dbError) {
          // 如果直接写入失败，降级到队列方式
          logger.warn('Direct bid save failed, falling back to queue:', dbError);
          await this.queueBidForDatabase(auctionId, userId, amount, requestId);
        }

        // 8. 同步更新数据库中的竞拍记录（确保 current_price 和 winner_id 一致）
        // 注意：必须使用原始 amount 而非 bidResult.currentPrice，因为 Redis Lua 返回的数值可能存在精度问题
        if (!bidResult.isCompleted) {
          try {
            await Auction.update({
              current_price: amount,
              winner_id: bidResult.winnerId,
              end_time: new Date(bidResult.endTime),
            }, {
              where: { id: auctionId, status: 'active' },
            });
          } catch (updateError) {
            logger.error('Sync auction record after bid failed:', updateError);
          }
        }

        // 9. 如果竞拍结束，异步处理结束逻辑
        if (bidResult.isCompleted) {
          await this.handleAuctionCompleted(auctionId, userId, amount);
        }

        // 10. 更新出价统计
        await this.updateBidStats(auctionId, amount);

        // 11. 设置出价频率限制
        await this.setRateLimit(rateLimitKey, 1000); // 1秒内不能重复出价

        logger.info(`Bid placed successfully: auction ${auctionId}, user ${userId}, amount ${amount}, requestId ${requestId}`);

        return {
          success: true,
          message: bidResult.message,
          auction: {
            id: auctionId,
            current_price: amount,
            winner_id: bidResult.winnerId,
            end_time: new Date(bidResult.endTime),
            status: bidResult.isCompleted ? 'completed' : 'active',
          },
          isExtended: bidResult.isExtended,
          isCompleted: bidResult.isCompleted,
          currentPrice: amount,
          winnerId: bidResult.winnerId,
          endTime: new Date(bidResult.endTime),
          delayTime: auction.delay_time,
          requestId,
          capPrice: bidResult.isCompleted ? auction.cap_price : undefined,
        };
      } finally {
        // 释放分布式锁
        await distributedLock.releaseLock(bidLockKey, lockRequestId);
      }
    } catch (error) {
      logger.error('Place bid failed:', error);
      throw error;
    }
  }

  /**
   * 检查出价频率限制
   */
  private async checkRateLimit(rateLimitKey: string): Promise<boolean> {
    try {
      const exists = await redisUtils.exists(rateLimitKey);
      return exists;
    } catch (error) {
      logger.error('Check rate limit failed:', error);
      return false;
    }
  }

  /**
   * 设置出价频率限制
   */
  private async setRateLimit(rateLimitKey: string, ttl: number): Promise<void> {
    try {
      await redisUtils.set(rateLimitKey, '1', ttl / 1000); // 转换为秒
    } catch (error) {
      logger.error('Set rate limit failed:', error);
    }
  }

  /**
   * 获取竞拍信息
   */
  private async getAuctionInfo(auctionId: number): Promise<any> {
    try {
      // 优先从Redis获取
      const auctionKey = AuctionCacheKeys.auction(auctionId);
      const cachedData = await redisUtils.get(auctionKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // 从数据库获取
      const auction = await Auction.findByPk(auctionId, {
        include: [
          { model: Product, as: 'product', attributes: ['price_increment', 'cap_price', 'delay_time'] },
        ],
      });

      if (!auction) {
        return null;
      }

      const auctionData = {
        id: auction.id,
        status: auction.status,
        current_price: parsePrice2(auction.current_price),
        winner_id: auction.winner_id || null,
        end_time: auction.end_time?.getTime() || 0,
        price_increment: parsePrice2(auction.product.price_increment),
        cap_price: auction.product.cap_price ? parsePrice2(auction.product.cap_price) : null,
        delay_time: auction.product.delay_time,
      };

      // 缓存到Redis
      await redisUtils.set(auctionKey, JSON.stringify(auctionData), 86400);

      return auctionData;
    } catch (error) {
      logger.error('Get auction info failed:', error);
      throw error;
    }
  }

  /**
   * 验证出价金额
   */
  async validateBidAmount(auctionId: number, amount: number): Promise<BidValidationDto> {
    try {
      const auction = await this.getAuctionInfo(auctionId);
      if (!auction) {
        return { valid: false, message: '竞拍不存在' };
      }

      if (auction.status !== 'active') {
        return { valid: false, message: '竞拍未在进行中' };
      }

      // 检查竞拍是否已结束
      if (AuctionStateMachine.isEnded(auction)) {
        return { valid: false, message: '竞拍已结束' };
      }

      const minBid = roundPrice2(auction.current_price + auction.price_increment);
      if (amount < minBid) {
        return { 
          valid: false, 
          message: `出价金额必须大于等于 ${minBid}`,
          minBid,
          priceIncrement: auction.price_increment,
        };
      }

      if (auction.cap_price && amount > auction.cap_price) {
        return { 
          valid: false, 
          message: `出价金额不能超过封顶价 ${auction.cap_price}`,
          maxBid: roundPrice2(auction.cap_price),
          capPrice: auction.cap_price,
        };
      }

      return { 
        valid: true,
        minBid,
        maxBid: auction.cap_price || undefined,
        priceIncrement: auction.price_increment,
        capPrice: auction.cap_price || undefined,
      };
    } catch (error) {
      logger.error('Validate bid amount failed:', error);
      return { valid: false, message: '验证出价金额失败' };
    }
  }

  /**
   * 将出价加入数据库写入队列（批量处理）
   */
  private async queueBidForDatabase(
    auctionId: number, 
    userId: number, 
    amount: number, 
    requestId: string
  ): Promise<void> {
    try {
      const queueKey = BidCacheKeys.bidQueue(auctionId);
      const bidData = JSON.stringify({
        auction_id: auctionId,
        user_id: userId,
        amount,
        request_id: requestId,
        created_at: new Date(),
      });

      // 使用Redis列表作为队列
      await redisUtils.lpush(queueKey, bidData);
      
      // 设置队列过期时间（24小时）
      await redisUtils.expire(queueKey, 86400);

      // 如果队列长度达到阈值，触发批量写入
      const queueLength = await redisUtils.llen(queueKey);
      if (queueLength >= 10) { // 每10条批量写入一次
        await this.flushBidQueue(auctionId);
      }
    } catch (error) {
      logger.error('Queue bid for database failed:', error);
    }
  }

  /**
   * 刷新出价队列到数据库
   */
  async flushBidQueue(auctionId: number): Promise<void> {
    const transaction = await sequelize.transaction();
    
    try {
      const queueKey = BidCacheKeys.bidQueue(auctionId);
      const queueLength = await redisUtils.llen(queueKey);
      
      if (queueLength === 0) {
        return;
      }

      // 批量获取队列中的数据
      const bids: any[] = [];
      for (let i = 0; i < Math.min(queueLength, 100); i++) {
        const bidData = await redisUtils.rpop(queueKey);
        if (bidData) {
          bids.push(JSON.parse(bidData));
        }
      }

      if (bids.length === 0) {
        return;
      }

      // 批量写入数据库
      await Bid.bulkCreate(bids, { transaction });

      await transaction.commit();

      logger.info(`Flushed ${bids.length} bids to database for auction ${auctionId}`);
    } catch (error) {
      await transaction.rollback();
      logger.error('Flush bid queue failed:', error);
    }
  }

  /**
   * 处理竞拍结束
   */
  private async handleAuctionCompleted(
    auctionId: number, 
    winnerId: number, 
    finalPrice: number
  ): Promise<void> {
    const lockKey = `auction_complete:${auctionId}`;
    const lockId = await distributedLock.acquireLockWithRetry(lockKey, 5000, 10, 200);

    if (!lockId) {
      logger.error(`Failed to acquire lock for auction completion: ${auctionId}`);
      return;
    }

    try {
      await this.flushBidQueue(auctionId);

      const transaction = await sequelize.transaction();
      
      try {
        const auction = await Auction.findByPk(auctionId, {
          include: [{ model: Product, as: 'product' }],
          lock: true,
          transaction,
        });

        if (!auction) {
          await transaction.rollback();
          return;
        }

        if (auction.status === 'completed') {
          await transaction.rollback();
          logger.info(`Auction ${auctionId} already completed, skipping`);
          return;
        }

        AuctionStateMachine.validateTransition(auction.status, 'completed');

        await auction.update({
          status: 'completed',
          winner_id: winnerId,
          current_price: finalPrice,
          end_time: new Date(),
        }, { transaction });

        await auction.product.update({
          status: 'completed',
        }, { transaction });

        await auction.product.decrement('stock', { by: 1, transaction });
        await auction.product.reload({ transaction });

        const existingOrder = await Order.findOne({
          where: { auction_id: auctionId },
          transaction,
        });

        if (!existingOrder) {
          await Order.create({
            auction_id: auctionId,
            user_id: winnerId,
            merchant_id: auction.product.merchant_id,
            amount: finalPrice,
            status: 'pending',
          }, { transaction });
        }

        await this.cleanupAuctionCache(auctionId);

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

        await transaction.commit();

        logger.info(`Auction completed: ${auctionId}, winner: ${winnerId}, price: ${finalPrice}`);
      } catch (error) {
        await transaction.rollback();
        logger.error('Handle auction completed failed:', error);
      }
    } finally {
      await distributedLock.releaseLock(lockKey, lockId);
    }
  }

  /**
   * 更新出价统计
   */
  private async updateBidStats(auctionId: number, amount: number): Promise<void> {
    try {
      const statsKey = BidCacheKeys.bidStats(auctionId);
      const statsData = await redisUtils.get(statsKey);
      
      let stats: BidStatsDto;
      if (statsData) {
        stats = JSON.parse(statsData);
      } else {
        stats = {
          totalBids: 0,
          totalAmount: 0,
          averageAmount: 0,
          highestBid: 0,
          lowestBid: Infinity,
          uniqueBidders: 0,
        };
      }

      // 更新统计
      stats.totalBids++;
      stats.totalAmount += amount;
      stats.averageAmount = stats.totalAmount / stats.totalBids;
      stats.highestBid = Math.max(stats.highestBid, amount);
      stats.lowestBid = Math.min(stats.lowestBid, amount);

      // 获取唯一出价人数
      const leaderboardKey = AuctionCacheKeys.auctionLeaderboard(auctionId);
      const uniqueBidders = await redisUtils.zcard(leaderboardKey);
      stats.uniqueBidders = uniqueBidders;

      // 保存统计
      await redisUtils.set(statsKey, JSON.stringify(stats), 86400);
    } catch (error) {
      logger.error('Update bid stats failed:', error);
    }
  }

  /**
   * 清理竞拍缓存
   */
  private async cleanupAuctionCache(auctionId: number): Promise<void> {
    try {
      const keys = [
        AuctionCacheKeys.auction(auctionId),
        AuctionCacheKeys.auctionBids(auctionId),
        AuctionCacheKeys.auctionLeaderboard(auctionId),
        AuctionCacheKeys.auctionOnlineUsers(auctionId),
        AuctionCacheKeys.auctionTimer(auctionId),
        BidCacheKeys.bidStats(auctionId),
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
   * 获取竞拍排行榜
   */
  async getLeaderboard(auctionId: number, limit: number = 10): Promise<LeaderboardEntryDto[]> {
    try {
      const leaderboardKey = AuctionCacheKeys.auctionLeaderboard(auctionId);
      const entries = await redisLua.atomicGetLeaderboard(leaderboardKey, limit);

      const userIds: number[] = [];
      const entryData: Array<{ userId: number; amount: number; rank: number }> = [];
      for (const entry of entries) {
        userIds.push(entry.userId);
        entryData.push(entry);
      }

      if (userIds.length === 0) {
        return await this.getLeaderboardFromDB(auctionId, limit);
      }

      const users = await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ['id', 'username', 'avatar'],
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      const leaderboard: LeaderboardEntryDto[] = [];
      for (const entry of entryData) {
        const user = userMap.get(entry.userId);
        if (user) {
          leaderboard.push({
            user_id: user.id,
            username: user.username,
            avatar: user.avatar,
            amount: entry.amount,
            rank: entry.rank,
          });
        }
      }

      return leaderboard;
    } catch (error) {
      logger.error('Get leaderboard failed:', error);
      return await this.getLeaderboardFromDB(auctionId, limit);
    }
  }

  private async getLeaderboardFromDB(auctionId: number, limit: number = 10): Promise<LeaderboardEntryDto[]> {
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
   * 获取出价历史
   */
  async getBidHistory(auctionId: number, userId?: number): Promise<BidHistoryDto> {
    try {
      // 获取出价记录
      const where: any = { auction_id: auctionId };
      if (userId) {
        where.user_id = userId;
      }

      const bids = await Bid.findAll({
        where,
        include: [
          { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] },
        ],
        order: [['created_at', 'DESC']],
        limit: 100,
      });

      // 获取统计
      const stats = await this.getBidStats(auctionId);

      return {
        auction_id: auctionId,
        user_id: userId || 0,
        bids: bids.map(bid => ({
          id: bid.id,
          amount: parsePrice2(bid.amount),
          created_at: bid.created_at,
        })),
        stats,
      };
    } catch (error) {
      logger.error('Get bid history failed:', error);
      throw error;
    }
  }

  /**
   * 获取出价统计
   */
  async getBidStats(auctionId: number): Promise<BidStatsDto> {
    try {
      const statsKey = BidCacheKeys.bidStats(auctionId);
      const statsData = await redisUtils.get(statsKey);
      
      if (statsData) {
        return JSON.parse(statsData);
      }

      const result = await Bid.findOne({
        where: { auction_id: auctionId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalBids'],
          [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('amount')), 0), 'totalAmount'],
          [sequelize.fn('COALESCE', sequelize.fn('AVG', sequelize.col('amount')), 0), 'averageAmount'],
          [sequelize.fn('COALESCE', sequelize.fn('MAX', sequelize.col('amount')), 0), 'highestBid'],
          [sequelize.fn('COALESCE', sequelize.fn('MIN', sequelize.col('amount')), 0), 'lowestBid'],
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('user_id'))), 'uniqueBidders'],
        ],
        raw: true,
      }) as any;

      const stats: BidStatsDto = {
        totalBids: parseInt(result.totalBids) || 0,
        totalAmount: parsePrice2(result.totalAmount),
        averageAmount: parsePrice2(result.averageAmount),
        highestBid: parsePrice2(result.highestBid),
        lowestBid: result.totalBids === '0' ? 0 : parsePrice2(result.lowestBid),
        uniqueBidders: parseInt(result.uniqueBidders) || 0,
      };

      await redisUtils.set(statsKey, JSON.stringify(stats), 86400);

      return stats;
    } catch (error) {
      logger.error('Get bid stats failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户的出价记录
   */
  async getUserBids(userId: number, query: BidQueryDto): Promise<{
    bids: BidResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      // 先查询每个竞拍的最新出价ID（同一用户对同一竞拍可能有多条出价，只取最新一条）
      const latestBidIds = await Bid.findAll({
        attributes: [
          [sequelize.fn('MAX', sequelize.col('id')), 'id'],
        ],
        where: { user_id: userId },
        group: ['auction_id'],
        raw: true,
      });

      const bidIds = latestBidIds.map((b: any) => b.id);

      if (bidIds.length === 0) {
        return { bids: [], total: 0, page, limit, totalPages: 0 };
      }

      const { count, rows: bids } = await Bid.findAndCountAll({
        where: {
          id: { [Op.in]: bidIds },
        },
        include: [
          { 
            model: Auction, 
            as: 'auction',
            include: [
              { model: Product, as: 'product', attributes: ['id', 'name', 'images', 'merchant_id'] },
            ],
          },
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      return {
        bids: bids.map(bid => this.formatBidResponse(bid)),
        total: count,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Get user bids failed:', error);
      throw error;
    }
  }

  /**
   * 格式化出价响应
   */
  private formatBidResponse(bid: any): BidResponseDto {
    const response: BidResponseDto = {
      id: bid.id,
      auction_id: bid.auction_id,
      user_id: bid.user_id,
      amount: parsePrice2(bid.amount),
      created_at: bid.created_at,
      updated_at: bid.updated_at,
    };

    if (bid.user) {
      response.user = {
        id: bid.user.id,
        username: bid.user.username,
        avatar: bid.user.avatar,
      };
    }

    if (bid.auction) {
      const auctionResponse: any = {
        id: bid.auction.id,
        product_id: bid.auction.product_id,
        status: bid.auction.status,
        current_price: parsePrice2(bid.auction.current_price),
        end_time: bid.auction.end_time,
        winner_id: bid.auction.winner_id,
      };

      if (bid.auction.product) {
        auctionResponse.product = {
          id: bid.auction.product.id,
          name: bid.auction.product.name,
          images: bid.auction.product.images || [],
          merchant_id: bid.auction.product.merchant_id,
        };
      }

      response.auction = auctionResponse;
    }

    return response;
  }

  /**
   * 获取竞拍的出价列表
   */
  async getAuctionBids(auctionId: number, query: BidQueryDto): Promise<{
    bids: BidResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      const where: any = { auction_id: auctionId };
      if (query.userId) {
        where.user_id = parseInt(query.userId);
      }

      const { count, rows: bids } = await Bid.findAndCountAll({
        where,
        include: [
          { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] },
        ],
        order: [['amount', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      return {
        bids: bids.map(bid => this.formatBidResponse(bid)),
        total: count,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Get auction bids failed:', error);
      throw error;
    }
  }

  /**
   * 手动刷新所有出价队列
   */
  async flushAllBidQueues(): Promise<void> {
    try {
      const activeAuctionsKey = AuctionCacheKeys.activeAuctions();
      const activeAuctions = await redisUtils.smembers(activeAuctionsKey);

      for (const auctionId of activeAuctions) {
        await this.flushBidQueue(parseInt(auctionId));
      }

      logger.info('All bid queues flushed');
    } catch (error) {
      logger.error('Flush all bid queues failed:', error);
    }
  }
}

export const bidService = new BidService();