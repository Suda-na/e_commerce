import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { roomManager } from '../utils/room-manager';
import { redisUtils } from '../config/redis';
import { AuctionCacheKeys } from '../dto/auction.dto';
import { bidService } from './bid.service';
import { auctionService } from './auction.service';
import { RealtimeService } from './realtime.service';
import { NotificationService } from './notification.service';
import { notificationCrudService } from './notification-crud.service';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';
import { Bid } from '../models/Bid';
import { Auction } from '../models/Auction';
import { Product } from '../models/Product';

// Socket.IO事件类型定义
interface BidData {
  auctionId: number;
  amount: number;
  userId: number;
  requestId?: string;
}

interface AuctionRoomData {
  auctionId: number;
  userId: number;
  socketId: string;
}

/**
 * WebSocket服务类
 * 封装所有WebSocket业务逻辑
 */
export class SocketService {
  private io: SocketIOServer;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private realtimeService: RealtimeService;
  private notificationService: NotificationService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.realtimeService = new RealtimeService(io);
    this.notificationService = new NotificationService(io);
    this.setupMiddleware();
    this.setupEventHandlers();
    this.startHeartbeat();
    this.startCleanupTask();
  }

  /**
   * 设置Socket.IO中间件
   */
  private setupMiddleware(): void {
    // 身份验证中间件
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          // 允许匿名连接，但限制功能
          socket.data.isAuthenticated = false;
          socket.data.userId = null;
          next();
          return;
        }

        // 验证JWT Token
        const { jwtUtils } = require('../utils/jwt');
        const payload = await jwtUtils.verifyToken(token as string);
        
        socket.data.isAuthenticated = true;
        socket.data.userId = payload.userId;
        socket.data.username = payload.username;
        socket.data.role = payload.role;
        
        next();
      } catch (error) {
        logger.warn(`Socket authentication failed: ${error}`);
        // 允许连接但标记为未认证
        socket.data.isAuthenticated = false;
        socket.data.userId = null;
        next();
      }
    });

    // 连接频率限制中间件
    this.io.use(async (socket, next) => {
      const clientIp = socket.handshake.address;
      const rateLimitKey = `ws:rate:${clientIp}`;
      
      try {
        const currentCount = await redisUtils.get(rateLimitKey);
        const count = currentCount ? parseInt(currentCount) : 0;
        
        if (count >= 10) { // 每分钟最多10次连接
          logger.warn(`WebSocket rate limit exceeded for IP: ${clientIp}`);
          next(new Error('连接过于频繁，请稍后再试'));
          return;
        }
        
        await redisUtils.set(rateLimitKey, (count + 1).toString(), 60);
        next();
      } catch (error) {
        // 限流检查失败时允许连接
        next();
      }
    });
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * 处理新连接
   */
  private handleConnection(socket: Socket): void {
    const userId = socket.data.userId;
    const isAuthenticated = socket.data.isAuthenticated;
    
    logger.info(`Client connected: ${socket.id}, userId: ${userId}, authenticated: ${isAuthenticated}`);

    // 发送连接成功事件
    socket.emit('connected', {
      socketId: socket.id,
      authenticated: isAuthenticated,
      timestamp: new Date(),
    });

    // 设置事件监听器
    this.setupSocketEvents(socket);

    // 处理断开连接
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(socket, reason);
    });

    // 处理错误
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  }

  /**
   * 设置Socket事件监听器
   */
  private setupSocketEvents(socket: Socket): void {
    // 加入竞拍房间
    socket.on('join_auction', async (data: { auctionId: number }) => {
      await this.handleJoinAuction(socket, data);
    });

    // 离开竞拍房间
    socket.on('leave_auction', async (data: { auctionId: number }) => {
      await this.handleLeaveAuction(socket, data);
    });

    // 提交出价
    socket.on('place_bid', async (data: BidData) => {
      await this.handlePlaceBid(socket, data);
    });

    // 获取在线人数
    socket.on('get_online_count', async (data: { auctionId: number }) => {
      await this.handleGetOnlineCount(socket, data);
    });

    // 获取排行榜
    socket.on('get_leaderboard', async (data: { auctionId: number }) => {
      await this.handleGetLeaderboard(socket, data);
    });

    // 心跳响应
    socket.on('pong', () => {
      socket.data.lastPong = Date.now();
    });
  }

  /**
   * 处理加入竞拍房间
   */
  private async handleJoinAuction(socket: Socket, data: { auctionId: number }): Promise<void> {
    try {
      const { auctionId } = data;
      const userId = socket.data.userId;
      const roomName = `auction:${auctionId}`;

      // 加入Socket.IO房间
      socket.join(roomName);

      // 如果用户已认证，更新在线状态
      if (userId) {
        await roomManager.joinRoom(auctionId, userId, socket.id);

        // 广播用户加入事件
        socket.to(roomName).emit('user_joined', {
          auctionId,
          userId,
          username: socket.data.username,
          timestamp: new Date(),
        });
      }

      // 无论是否认证，都发送当前在线人数给加入者
      const onlineCount = await roomManager.getOnlineCount(auctionId);
      this.io.to(roomName).emit('online_count', {
        auctionId,
        count: onlineCount,
      });

      // 发送房间信息
      socket.emit('room_joined', {
        auctionId,
        roomName,
        timestamp: new Date(),
      });

      logger.info(`User ${userId || socket.id} joined auction room: ${auctionId}`);
    } catch (error) {
      logger.error('Handle join auction failed:', error);
      socket.emit('error', { message: '加入房间失败' });
    }
  }

  /**
   * 处理离开竞拍房间
   */
  private async handleLeaveAuction(socket: Socket, data: { auctionId: number }): Promise<void> {
    try {
      const { auctionId } = data;
      const userId = socket.data.userId;
      const roomName = `auction:${auctionId}`;

      // 离开Socket.IO房间
      socket.leave(roomName);

      // 如果用户已认证，更新在线状态
      if (userId) {
        await roomManager.leaveRoom(auctionId, userId, socket.id);
        
        // 广播用户离开事件
        socket.to(roomName).emit('user_left', {
          auctionId,
          userId,
          username: socket.data.username,
          timestamp: new Date(),
        });

        // 更新在线人数
        const onlineCount = await roomManager.getOnlineCount(auctionId);
        this.io.to(roomName).emit('online_count', {
          auctionId,
          count: onlineCount,
        });
      }

      // 发送离开确认
      socket.emit('room_left', {
        auctionId,
        timestamp: new Date(),
      });

      logger.info(`User ${userId || socket.id} left auction room: ${auctionId}`);
    } catch (error) {
      logger.error('Handle leave auction failed:', error);
      socket.emit('error', { message: '离开房间失败' });
    }
  }

  /**
   * 处理出价
   */
  private async handlePlaceBid(socket: Socket, data: BidData): Promise<void> {
    try {
      // 强制类型转换：微信端可能发送 string 类型的 auctionId
      const auctionId = Number(data.auctionId);
      const amount = Number(data.amount);
      const requestId = data.requestId;
      const userId = socket.data.userId;

      if (!userId) {
        socket.emit('bid_error', { message: '请先登录' });
        return;
      }

      if (!auctionId || isNaN(auctionId) || auctionId <= 0) {
        socket.emit('bid_error', { message: '无效的竞拍ID' });
        return;
      }

      if (!amount || isNaN(amount) || amount <= 0) {
        socket.emit('bid_error', { message: '无效的出价金额' });
        return;
      }

      logger.info(`Place bid request: auctionId=${auctionId}, userId=${userId}, amount=${amount}`);

      // 生成请求ID用于幂等性
      const finalRequestId = requestId || uuidv4();

      // 调用出价服务
      const result = await bidService.placeBid(auctionId, userId, {
        amount,
        requestId: finalRequestId,
      });

      if (result.success) {
        // 广播出价成功
        const roomName = `auction:${auctionId}`;
        
        // 使用Promise.all并行执行独立操作以减少延迟
        const broadcastPromises: Promise<void>[] = [];
        
        // 获取出价数量
        const bidCount = await Bid.count({ where: { auction_id: auctionId } });

        const leaderboardData = await bidService.getLeaderboard(auctionId, 50);
        const participantCount = leaderboardData.length;

        broadcastPromises.push(
          this.notificationService.broadcastToRoom(auctionId, 'new_bid', {
            auctionId,
            userId,
            username: socket.data.username,
            amount,
            currentPrice: result.currentPrice,
            winnerId: result.winnerId,
            bidCount,
            participantCount,
            endTime: result.endTime ? new Date(result.endTime).getTime() : undefined,
            isExtended: result.isExtended || false,
            extensionSeconds: result.isExtended ? (result.delayTime || 0) : 0,
            isCompleted: result.isCompleted || false,
            bid: {
              userId,
              username: socket.data.username,
              amount,
              createdAt: new Date(),
            },
          })
        );

        broadcastPromises.push(
          this.notificationService.broadcastToRoom(auctionId, 'leaderboard_update', {
            leaderboard: leaderboardData,
          })
        );

        // 如果竞拍延时了
        if (result.isExtended) {
          broadcastPromises.push(
            this.notificationService.notifyTimeExtended(auctionId, result.endTime!, result.delayTime || 0)
          );
        }

        // 如果竞拍结束了
        if (result.isCompleted) {
          // 如果是达到封顶价导致的自动成交，先广播封顶价事件
          if (result.capPrice) {
            broadcastPromises.push(
              this.notificationService.notifyCapPriceReached(auctionId, result.winnerId!, result.capPrice)
            );
          }

          broadcastPromises.push(
            this.notificationService.notifyAuctionEnded(auctionId, {
              winnerId: result.winnerId!,
              finalPrice: result.currentPrice!,
              totalBids: 0,
              endTime: new Date(),
            })
          );
          
          // 创建数据库通知
          broadcastPromises.push(
            this.createAuctionWonDbNotification(auctionId, result.winnerId!, result.currentPrice!)
          );
          broadcastPromises.push(
            this.createAuctionEndedDbNotification(auctionId, result.winnerId!, result.currentPrice!)
          );
        }

        // 通知出价者成功（可以与其他广播并行）
        broadcastPromises.push(
          this.notificationService.notifyBidSuccess(socket.id, {
            auctionId,
            amount,
            currentPrice: result.currentPrice!,
            isLeading: result.winnerId === userId,
            requestId: finalRequestId,
            endTime: result.endTime ? new Date(result.endTime).getTime() : undefined,
            isExtended: result.isExtended || false,
            extensionSeconds: result.isExtended ? (result.delayTime || 0) : 0,
            isCompleted: result.isCompleted || false,
            capPrice: result.capPrice,
          })
        );

        // 通知被超越的用户（WebSocket + 数据库持久化）
        if (result.winnerId === userId && leaderboardData.length > 1) {
          const previousWinner = leaderboardData.find(
            (entry: any) => entry.user_id !== userId
          );
          if (previousWinner) {
            const outbidUserId = previousWinner.user_id;
            broadcastPromises.push(
              this.notificationService.notifyOutbid(auctionId, outbidUserId, result.currentPrice!, userId)
            );
            broadcastPromises.push(
              this.createOutbidDbNotification(auctionId, outbidUserId, result.currentPrice!)
            );
          }
        }

        // 并行执行所有广播操作
        await Promise.all(broadcastPromises);
      } else {
        await this.notificationService.notifyBidError(socket.id, {
          auctionId,
          message: result.message || '出价失败',
        });
      }
    } catch (error: any) {
      logger.error('Handle place bid failed:', error);
      await this.notificationService.notifyBidError(socket.id, {
        auctionId: data.auctionId,
        message: error.message || '出价失败',
      });
    }
  }

  /**
   * 创建被超越的数据库通知
   */
  private async createOutbidDbNotification(auctionId: number, outbidUserId: number, newPrice: number): Promise<void> {
    try {
      const auction = await Auction.findByPk(auctionId, {
        include: [{ model: Product, as: 'product', attributes: ['name'] }],
      });
      const productName = (auction as any)?.product?.name || '商品';

      await notificationCrudService.createNotification({
        userId: outbidUserId,
        type: 'outbid',
        title: '出价被超越',
        message: `您在「${productName}」的出价已被超越，当前最高价为 ¥${newPrice}`,
        priority: 'medium',
        metadata: { auctionId, newPrice, productName },
      });
    } catch (error) {
      logger.error('Create outbid db notification failed:', error);
    }
  }

  /**
   * 创建中标的数据库通知
   */
  private async createAuctionWonDbNotification(auctionId: number, winnerId: number, finalPrice: number): Promise<void> {
    try {
      const auction = await Auction.findByPk(auctionId, {
        include: [{ model: Product, as: 'product', attributes: ['name'] }],
      });
      const productName = (auction as any)?.product?.name || '商品';

      await notificationCrudService.createNotification({
        userId: winnerId,
        type: 'auction_won',
        title: '恭喜中标！',
        message: `您已成功拍得「${productName}」，成交价 ¥${finalPrice}，请尽快完成支付`,
        priority: 'high',
        metadata: { auctionId, finalPrice, productName },
      });
    } catch (error) {
      logger.error('Create auction won db notification failed:', error);
    }
  }

  /**
   * 创建竞拍结束的数据库通知
   */
  private async createAuctionEndedDbNotification(auctionId: number, winnerId: number, finalPrice: number): Promise<void> {
    try {
      const auction = await Auction.findByPk(auctionId, {
        include: [{ model: Product, as: 'product', attributes: ['name'] }],
      });
      const productName = (auction as any)?.product?.name || '商品';

      // 获取房间内所有用户（除了获胜者）
      const roomName = `auction:${auctionId}`;
      const sockets = await this.io.in(roomName).fetchSockets();
      const userIds = new Set<number>();
      
      for (const socket of sockets) {
        if (socket.data.userId && socket.data.userId !== winnerId) {
          userIds.add(socket.data.userId);
        }
      }

      // 为每个参与者创建竞拍结束通知
      for (const userId of userIds) {
        await notificationCrudService.createNotification({
          userId,
          type: 'auction_ended',
          title: '竞拍结束',
          message: `「${productName}」竞拍已结束，成交价 ¥${finalPrice}`,
          priority: 'medium',
          metadata: { auctionId, finalPrice, productName },
        });
      }
    } catch (error) {
      logger.error('Create auction ended db notification failed:', error);
    }
  }

  /**
   * 创建竞拍即将结束的数据库通知
   */
  async createAuctionEndingSoonDbNotification(auctionId: number, timeLeft: number): Promise<void> {
    try {
      const auction = await Auction.findByPk(auctionId, {
        include: [{ model: Product, as: 'product', attributes: ['name'] }],
      });
      const productName = (auction as any)?.product?.name || '商品';

      // Get all users in the auction room
      const roomName = `auction:${auctionId}`;
      const sockets = await this.io.in(roomName).fetchSockets();
      const userIds = new Set<number>();
      
      for (const socket of sockets) {
        if (socket.data.userId) {
          userIds.add(socket.data.userId);
        }
      }

      // Create notification for each participant
      for (const userId of userIds) {
        await notificationCrudService.createNotification({
          userId,
          type: 'auction_ending_soon',
          title: '竞拍即将结束',
          message: `「${productName}」竞拍即将结束，剩余 ${timeLeft} 秒，抓紧出价！`,
          priority: 'medium',
          metadata: { auctionId, productName, timeLeft },
        });
      }
    } catch (error) {
      logger.error('Create auction ending soon db notification failed:', error);
    }
  }

  /**
   * 处理获取在线人数
   */
  private async handleGetOnlineCount(socket: Socket, data: { auctionId: number }): Promise<void> {
    try {
      const { auctionId } = data;
      const count = await roomManager.getOnlineCount(auctionId);
      
      socket.emit('online_count', {
        auctionId,
        count,
      });
    } catch (error) {
      logger.error('Handle get online count failed:', error);
    }
  }

  /**
   * 处理获取排行榜
   */
  private async handleGetLeaderboard(socket: Socket, data: { auctionId: number }): Promise<void> {
    try {
      const { auctionId } = data;
      const leaderboard = await bidService.getLeaderboard(auctionId);
      
      socket.emit('leaderboard_update', {
        auctionId,
        leaderboard,
      });
    } catch (error) {
      logger.error('Handle get leaderboard failed:', error);
    }
  }

  /**
   * 处理断开连接
   */
  private async handleDisconnect(socket: Socket, reason: string): Promise<void> {
    const userId = socket.data.userId;
    
    logger.info(`Client disconnected: ${socket.id}, userId: ${userId}, reason: ${reason}`);

    // 清理用户在所有房间的状态
    if (userId) {
      try {
        // 获取用户所在的房间
        const userInfo = await roomManager.getUserBySocketId(socket.id);
        if (userInfo) {
          const { auctionId } = userInfo;
          await roomManager.leaveRoom(auctionId, userId, socket.id);
          
          // 广播用户离开
          const roomName = `auction:${auctionId}`;
          socket.to(roomName).emit('user_left', {
            auctionId,
            userId,
            username: socket.data.username,
            timestamp: new Date(),
          });

          // 更新在线人数
          const onlineCount = await roomManager.getOnlineCount(auctionId);
          this.io.to(roomName).emit('online_count', {
            auctionId,
            count: onlineCount,
          });
        }
      } catch (error) {
        logger.error('Handle disconnect cleanup failed:', error);
      }
    }
  }

  /**
   * 启动心跳保活机制
   */
  private startHeartbeat(): void {
    const heartbeatInterval = config.socket?.heartbeatInterval || 30000; // 30秒
    
    this.heartbeatInterval = setInterval(() => {
      this.io.emit('ping', { timestamp: Date.now() });
      
      // 检查超时的连接
      this.checkStaleConnections();
    }, heartbeatInterval);
    
    logger.info(`Heartbeat started with interval: ${heartbeatInterval}ms`);
  }

  /**
   * 检查超时的连接
   */
  private checkStaleConnections(): void {
    const timeout = config.socket?.heartbeatTimeout || 20000; // 20秒
    const now = Date.now();
    
    this.io.sockets.sockets.forEach((socket) => {
      const lastPong = socket.data.lastPong || 0;
      if (lastPong > 0 && (now - lastPong) > timeout) {
        logger.warn(`Stale connection detected: ${socket.id}`);
        socket.disconnect(true);
      }
    });
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    // 每5分钟清理一次过期映射
    this.cleanupInterval = setInterval(async () => {
      try {
        await roomManager.cleanupStaleMappings();
      } catch (error) {
        logger.error('Cleanup task failed:', error);
      }
    }, 5 * 60 * 1000);
    
    logger.info('Cleanup task started');
  }

  /**
   * 广播竞拍状态更新
   */
  async broadcastAuctionStatus(auctionId: number, status: string): Promise<void> {
    const roomName = `auction:${auctionId}`;
    this.io.to(roomName).emit('auction_status', {
      auctionId,
      status,
      timestamp: new Date(),
    });
  }

  /**
   * 广播竞拍数据更新
   */
  async broadcastAuctionUpdate(auctionId: number, data: any): Promise<void> {
    const roomName = `auction:${auctionId}`;
    this.io.to(roomName).emit('auction_update', {
      auctionId,
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * 广播竞拍结束
   */
  async broadcastAuctionEnded(auctionId: number, winnerId: number, finalPrice: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    this.io.to(roomName).emit('auction_ended', {
      auctionId,
      winnerId,
      finalPrice,
      timestamp: new Date(),
    });
  }

  /**
   * 定向通知用户被超越
   */
  async notifyOutbid(auctionId: number, userId: number, newPrice: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    // 通过房间内的Socket查找用户
    const sockets = await this.io.in(roomName).fetchSockets();
    for (const socket of sockets) {
      if (socket.data.userId === userId) {
        socket.emit('outbid', {
          auctionId,
          newPrice,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * 获取Socket.IO服务器实例
   */
  getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * 获取实时数据推送服务
   */
  getRealtimeService(): RealtimeService {
    return this.realtimeService;
  }

  /**
   * 获取事件通知服务
   */
  getNotificationService(): NotificationService {
    return this.notificationService;
  }

  /**
   * 关闭WebSocket服务
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket service...');
    
    // 关闭实时数据推送服务
    await this.realtimeService.shutdown();
    
    // 关闭事件通知服务
    await this.notificationService.shutdown();
    
    // 清除定时器
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // 关闭所有连接
    this.io.close();
    
    logger.info('WebSocket service shut down');
  }
}

export default SocketService;