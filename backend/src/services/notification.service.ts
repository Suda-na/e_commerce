import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';
import { roomManager } from '../utils/room-manager';
import { redisUtils } from '../config/redis';
import { AuctionCacheKeys } from '../dto/auction.dto';

/**
 * 事件通知服务
 * 负责处理各种事件的通知逻辑
 */
export class NotificationService {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * 通知竞拍开始
   */
  async notifyAuctionStarted(auctionId: number, auctionData: any): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    this.io.to(roomName).emit('auction_status', {
      auctionId,
      status: 'active',
      startTime: auctionData.start_time,
      endTime: auctionData.end_time,
      currentPrice: auctionData.current_price,
      timestamp: new Date(),
    });
    
    logger.info(`Auction ${auctionId} started notification sent`);
  }

  /**
   * 通知竞拍即将结束（最后1分钟）
   */
  async notifyAuctionEndingSoon(auctionId: number, timeLeft: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    this.io.to(roomName).emit('auction_ending_soon', {
      auctionId,
      timeLeft,
      timestamp: new Date(),
    });
    
    logger.info(`Auction ${auctionId} ending soon notification sent. Time left: ${timeLeft}s`);
  }

  /**
   * 通知竞拍结束
   */
  async notifyAuctionEnded(auctionId: number, result: {
    winnerId: number;
    finalPrice: number;
    totalBids: number;
    endTime: Date;
  }): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    // 通知房间内所有用户
    this.io.to(roomName).emit('auction_ended', {
      auctionId,
      ...result,
      timestamp: new Date(),
    });
    
    // 定向通知获胜者
    await this.notifyWinner(auctionId, result.winnerId, result.finalPrice);
    
    // 通知其他参与者
    await this.notifyOtherParticipants(auctionId, result.winnerId);
    
    logger.info(`Auction ${auctionId} ended notification sent. Winner: ${result.winnerId}`);
  }

  /**
   * 通知获胜者
   */
  private async notifyWinner(auctionId: number, winnerId: number, finalPrice: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    // 查找获胜者的Socket连接
    const sockets = await this.io.in(roomName).fetchSockets();
    
    for (const socket of sockets) {
      if (socket.data.userId === winnerId) {
        socket.emit('auction_won', {
          auctionId,
          finalPrice,
          message: '恭喜您竞拍成功！',
          timestamp: new Date(),
        });
        
        logger.info(`Winner ${winnerId} notified for auction ${auctionId}`);
      }
    }
  }

  /**
   * 通知其他参与者
   */
  private async notifyOtherParticipants(auctionId: number, winnerId: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    // 查找房间内的其他参与者
    const sockets = await this.io.in(roomName).fetchSockets();
    
    for (const socket of sockets) {
      if (socket.data.userId && socket.data.userId !== winnerId) {
        socket.emit('auction_lost', {
          auctionId,
          winnerId,
          message: '竞拍已结束，感谢您的参与',
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * 通知出价被超越
   */
  async notifyOutbid(auctionId: number, outbidUserId: number, newPrice: number, newWinnerId: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    // 查找被超越用户的Socket连接
    const sockets = await this.io.in(roomName).fetchSockets();
    
    for (const socket of sockets) {
      if (socket.data.userId === outbidUserId) {
        socket.emit('outbid', {
          auctionId,
          newPrice,
          newWinnerId,
          message: `您的出价已被超越，当前最高价为 ${newPrice}`,
          timestamp: new Date(),
        });
        
        logger.info(`User ${outbidUserId} outbid in auction ${auctionId}. New price: ${newPrice}`);
      }
    }
  }

  /**
   * 通知出价成功
   */
  async notifyBidSuccess(socketId: string, data: {
    auctionId: number;
    amount: number;
    currentPrice: number;
    isLeading: boolean;
    requestId: string;
    endTime?: number;
    isExtended?: boolean;
    extensionSeconds?: number;
    isCompleted?: boolean;
    capPrice?: number;
  }): Promise<void> {
    this.io.to(socketId).emit('bid_success', {
      ...data,
      message: data.isCompleted
        ? '出价成功，已达到封顶价自动成交！'
        : data.isLeading
          ? '您当前是最高出价者'
          : '出价成功',
      timestamp: new Date(),
    });
  }

  /**
   * 通知出价失败
   */
  async notifyBidError(socketId: string, data: {
    auctionId: number;
    message: string;
    errorCode?: string;
  }): Promise<void> {
    this.io.to(socketId).emit('bid_error', {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * 通知竞拍延时
   */
  async notifyTimeExtended(auctionId: number, newEndTime: Date, extensionSeconds: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    const newEndTimeMs = newEndTime instanceof Date ? newEndTime.getTime() : newEndTime;
    
    this.io.to(roomName).emit('time_extended', {
      auctionId,
      newEndTime: newEndTimeMs,
      extensionSeconds,
      message: `竞拍时间已延长 ${extensionSeconds} 秒`,
      timestamp: new Date(),
    });
    
    logger.info(`Auction ${auctionId} time extended by ${extensionSeconds}s. New end time: ${newEndTime}`);
  }

  /**
   * 通知达到封顶价
   */
  async notifyCapPriceReached(auctionId: number, winnerId: number, capPrice: number): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    this.io.to(roomName).emit('cap_price_reached', {
      auctionId,
      winnerId,
      capPrice,
      message: '已达到封顶价，竞拍即将结束',
      timestamp: new Date(),
    });
    
    logger.info(`Auction ${auctionId} reached cap price: ${capPrice}`);
  }

  /**
   * 通知竞拍取消
   */
  async notifyAuctionCancelled(auctionId: number, reason: string): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    this.io.to(roomName).emit('auction_cancelled', {
      auctionId,
      reason,
      message: `竞拍已取消: ${reason}`,
      timestamp: new Date(),
    });
    
    logger.info(`Auction ${auctionId} cancelled. Reason: ${reason}`);
  }

  /**
   * 通知系统维护
   */
  async notifySystemMaintenance(message: string, estimatedDuration?: number): Promise<void> {
    this.io.emit('system_notice', {
      type: 'maintenance',
      message,
      estimatedDuration,
      timestamp: new Date(),
    });
    
    logger.info(`System maintenance notification sent: ${message}`);
  }

  /**
   * 通知系统公告
   */
  async notifySystemAnnouncement(message: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    this.io.emit('system_notice', {
      type: 'announcement',
      message,
      priority,
      timestamp: new Date(),
    });
    
    logger.info(`System announcement sent: ${message}`);
  }

  /**
   * 发送房间内广播
   */
  async broadcastToRoom(auctionId: number, event: string, data: any): Promise<void> {
    const roomName = `auction:${auctionId}`;
    
    this.io.to(roomName).emit(event, {
      auctionId,
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * 发送全局广播
   */
  async broadcastToAll(event: string, data: any): Promise<void> {
    this.io.emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * 定向发送通知
   */
  async sendToUser(userId: number, event: string, data: any): Promise<void> {
    // 查找用户的所有Socket连接
    const sockets = await this.io.fetchSockets();
    
    for (const socket of sockets) {
      if (socket.data.userId === userId) {
        socket.emit(event, {
          ...data,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * 获取房间内用户列表
   */
  async getRoomUsers(auctionId: number): Promise<Array<{ userId: number; username: string; socketId: string }>> {
    const roomName = `auction:${auctionId}`;
    const sockets = await this.io.in(roomName).fetchSockets();
    
    return sockets
      .filter(socket => socket.data.userId)
      .map(socket => ({
        userId: socket.data.userId,
        username: socket.data.username,
        socketId: socket.id,
      }));
  }

  /**
   * 检查用户是否在房间内
   */
  async isUserInRoom(auctionId: number, userId: number): Promise<boolean> {
    const roomName = `auction:${auctionId}`;
    const sockets = await this.io.in(roomName).fetchSockets();
    
    return sockets.some(socket => socket.data.userId === userId);
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    logger.info('Notification service shut down');
  }
}

export default NotificationService;