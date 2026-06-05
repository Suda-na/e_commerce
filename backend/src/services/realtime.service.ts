import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';
import { roomManager } from '../utils/room-manager';
import { redisUtils } from '../config/redis';
import { AuctionCacheKeys } from '../dto/auction.dto';
import { bidService } from './bid.service';
import { auctionService } from './auction.service';

/**
 * 实时数据推送服务
 * 负责向客户端推送实时数据
 */
export class RealtimeService {
  private io: SocketIOServer;
  private pushInterval: NodeJS.Timeout | null = null;
  private messageQueue: Array<{ auctionId: number; event: string; data: any }> = [];
  private queueFlushInterval: NodeJS.Timeout | null = null;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.startPeriodicPush();
    this.startMessageQueueFlush();
  }

  /**
   * 启动定期数据推送
   */
  private startPeriodicPush(): void {
    // 每5秒推送一次竞拍数据更新（优化为更频繁）
    this.pushInterval = setInterval(async () => {
      await this.pushAuctionUpdates();
    }, 5000);
    
    logger.info('Realtime data push service started');
  }

  /**
   * 启动消息队列刷新
   */
  private startMessageQueueFlush(): void {
    // 每100ms刷新一次消息队列（确保≤50ms延迟）
    this.queueFlushInterval = setInterval(async () => {
      await this.flushMessageQueue();
    }, 100);
    
    logger.info('Message queue flush service started');
  }

  /**
   * 推送竞拍数据更新
   */
  private async pushAuctionUpdates(): Promise<void> {
    try {
      // 如果没有任何WebSocket连接，跳过推送以节省资源
      const totalConnections = this.io.engine.clientsCount;
      if (totalConnections === 0) {
        return;
      }

      // 获取所有活跃竞拍
      const activeAuctionsKey = AuctionCacheKeys.activeAuctions();
      const activeAuctions = await redisUtils.smembers(activeAuctionsKey);
      
      if (activeAuctions.length === 0) {
        return;
      }
      
      // 使用Promise.all并行处理所有竞拍更新
      const updatePromises = activeAuctions.map(async (auctionIdStr) => {
        const auctionId = parseInt(auctionIdStr);

        // 获取竞拍数据
        const auctionKey = AuctionCacheKeys.auction(auctionId);
        const auctionData = await redisUtils.get(auctionKey);

        if (auctionData) {
          const auction = JSON.parse(auctionData);

          // 检查竞拍是否过期
          const timeLeft = this.calculateTimeLeft(auction.end_time);

          if (timeLeft <= 0 && auction.status === 'active') {
            try {
              await bidService.flushBidQueue(auctionId);

              await auctionService.completeAuction(auctionId);

              // 广播竞拍结束事件
              await this.broadcastAuctionEnded(
                auctionId,
                auction.winner_id || 0,
                auction.current_price || 0
              );

              logger.info(`Auction ${auctionId} auto-completed by scheduler`);
            } catch (error) {
              logger.error(`Auto-complete auction ${auctionId} failed:`, error);
            }
          } else {
            // 推送竞拍更新
            await this.broadcastAuctionUpdate(auctionId, {
              currentPrice: auction.current_price,
              timeLeft: timeLeft,
              status: auction.status,
            });
          }
        }
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      logger.error('Push auction updates failed:', error);
    }
  }

  /**
   * 刷新消息队列
   */
  private async flushMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) {
      return;
    }
    
    try {
      // 按竞拍ID分组消息
      const groupedMessages = new Map<number, Array<{ event: string; data: any }>>();
      
      for (const message of this.messageQueue) {
        const { auctionId, event, data } = message;
        if (!groupedMessages.has(auctionId)) {
          groupedMessages.set(auctionId, []);
        }
        groupedMessages.get(auctionId)!.push({ event, data });
      }
      
      // 清空队列
      this.messageQueue = [];
      
      // 并行发送所有消息
      const sendPromises: Promise<void>[] = [];
      
      for (const [auctionId, messages] of groupedMessages) {
        const roomName = `auction:${auctionId}`;
        
        for (const { event, data } of messages) {
          sendPromises.push(
            new Promise<void>((resolve) => {
              this.io.to(roomName).emit(event, {
                auctionId,
                ...data,
                timestamp: new Date(),
              });
              resolve();
            })
          );
        }
      }
      
      await Promise.all(sendPromises);
    } catch (error) {
      logger.error('Flush message queue failed:', error);
    }
  }

  /**
   * 将消息添加到队列
   */
  private addToQueue(auctionId: number, event: string, data: any): void {
    this.messageQueue.push({ auctionId, event, data });
    
    // 如果队列过大，立即刷新
    if (this.messageQueue.length > 100) {
      this.flushMessageQueue().catch(error => {
        logger.error('Immediate queue flush failed:', error);
      });
    }
  }

  /**
   * 计算剩余时间
   */
  private calculateTimeLeft(endTime: number): number {
    const now = Date.now();
    const timeLeft = Math.max(0, endTime - now);
    return Math.ceil(timeLeft / 1000); // 返回秒数
  }

  /**
   * 广播竞拍更新
   */
  async broadcastAuctionUpdate(auctionId: number, data: any): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    // 检查房间是否有用户
    const onlineCount = await roomManager.getOnlineCount(auctionId);
    if (onlineCount === 0) {
      return;
    }
    
    this.io.to(roomName).emit('auction_update', {
      auctionId,
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * 广播竞拍状态变更
   */
  async broadcastAuctionStatusChange(auctionId: number, status: string, data?: any): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    this.io.to(roomName).emit('auction_status', {
      auctionId,
      status,
      ...data,
      timestamp: new Date(),
    });
    
    logger.info(`Auction ${auctionId} status changed to: ${status}`);
  }

  /**
   * 广播新出价
   */
  async broadcastNewBid(auctionId: number, bidData: {
    userId: number;
    username: string;
    amount: number;
    currentPrice: number;
    winnerId: number;
  }): Promise<void> {
    // 使用消息队列优化高频率事件
    this.addToQueue(auctionId, 'new_bid', bidData);
  }

  /**
   * 广播排行榜更新
   */
  async broadcastLeaderboardUpdate(auctionId: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    // 获取最新排行榜
    const leaderboard = await bidService.getLeaderboard(auctionId);
    
    this.io.to(roomName).emit('leaderboard_update', {
      auctionId,
      leaderboard,
      timestamp: new Date(),
    });
  }

  /**
   * 广播竞拍延时
   */
  async broadcastTimeExtended(auctionId: number, newEndTime: Date, extensionSeconds: number = 0): Promise<void> {
    const roomName = `auction:${auctionId}`;
    const newEndTimeMs = newEndTime instanceof Date ? newEndTime.getTime() : newEndTime;
    
    this.io.to(roomName).emit('time_extended', {
      auctionId,
      newEndTime: newEndTimeMs,
      extensionSeconds,
      message: `竞拍时间已延长 ${extensionSeconds} 秒`,
      timestamp: new Date(),
    });
    
    logger.info(`Auction ${auctionId} time extended by ${extensionSeconds}s to: ${newEndTime}`);
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
    
    logger.info(`Auction ${auctionId} ended. Winner: ${winnerId}, Price: ${finalPrice}`);
  }

  /**
   * 通知用户被超越
   */
  async notifyOutbid(auctionId: number, userId: number, newPrice: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    // 查找用户的Socket连接
    const sockets = await this.io.in(roomName).fetchSockets();
    
    for (const socket of sockets) {
      if (socket.data.userId === userId) {
        socket.emit('outbid', {
          auctionId,
          newPrice,
          timestamp: new Date(),
        });
        
        logger.info(`User ${userId} outbid in auction ${auctionId}. New price: ${newPrice}`);
      }
    }
  }

  /**
   * 广播用户加入
   */
  async broadcastUserJoined(auctionId: number, userId: number, username: string): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    this.io.to(roomName).emit('user_joined', {
      auctionId,
      userId,
      username,
      timestamp: new Date(),
    });
  }

  /**
   * 广播用户离开
   */
  async broadcastUserLeft(auctionId: number, userId: number, username: string): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    this.io.to(roomName).emit('user_left', {
      auctionId,
      userId,
      username,
      timestamp: new Date(),
    });
  }

  /**
   * 广播在线人数更新
   */
  async broadcastOnlineCount(auctionId: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    const count = await roomManager.getOnlineCount(auctionId);
    
    this.io.to(roomName).emit('online_count', {
      auctionId,
      count,
      timestamp: new Date(),
    });
  }

  /**
   * 定向发送出价成功通知
   */
  async notifyBidSuccess(socketId: string, data: {
    auctionId: number;
    amount: number;
    currentPrice: number;
    requestId: string;
  }): Promise<void> {
    this.io.to(socketId).emit('bid_success', {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * 定向发送出价失败通知
   */
  async notifyBidError(socketId: string, data: {
    auctionId: number;
    message: string;
  }): Promise<void> {
    this.io.to(socketId).emit('bid_error', {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * 获取竞拍实时数据
   */
  async getAuctionRealtimeData(auctionId: number): Promise<any> {
    try {
      const auctionKey = AuctionCacheKeys.auction(auctionId);
      const auctionData = await redisUtils.get(auctionKey);
      
      if (!auctionData) {
        return null;
      }
      
      const auction = JSON.parse(auctionData);
      const onlineCount = await roomManager.getOnlineCount(auctionId);
      const leaderboard = await bidService.getLeaderboard(auctionId, 10);
      
      return {
        auctionId,
        currentPrice: auction.current_price,
        timeLeft: this.calculateTimeLeft(auction.end_time),
        status: auction.status,
        onlineCount,
        leaderboard,
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Get auction realtime data failed:', error);
      return null;
    }
  }

  /**
   * 批量获取多个竞拍的实时数据
   */
  async getMultipleAuctionRealtimeData(auctionIds: number[]): Promise<Map<number, any>> {
    const result = new Map<number, any>();
    
    for (const auctionId of auctionIds) {
      const data = await this.getAuctionRealtimeData(auctionId);
      if (data) {
        result.set(auctionId, data);
      }
    }
    
    return result;
  }

  /**
   * 停止定期推送
   */
  stopPeriodicPush(): void {
    if (this.pushInterval) {
      clearInterval(this.pushInterval);
      this.pushInterval = null;
      logger.info('Realtime data push service stopped');
    }
    if (this.queueFlushInterval) {
      clearInterval(this.queueFlushInterval);
      this.queueFlushInterval = null;
      logger.info('Message queue flush service stopped');
    }
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    this.stopPeriodicPush();
    // 清空消息队列
    this.messageQueue = [];
    logger.info('Realtime service shut down');
  }
}

export default RealtimeService;