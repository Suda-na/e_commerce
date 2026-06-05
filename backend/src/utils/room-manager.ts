import { redisUtils } from '../config/redis';
import { logger } from './logger';
import { AuctionCacheKeys } from '../dto/auction.dto';

/**
 * 房间管理工具类
 * 基于Redis的房间级在线用户管理
 */
export class RoomManager {
  private static instance: RoomManager;

  private constructor() {}

  static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  /**
   * 用户加入房间
   * @param auctionId 竞拍ID
   * @param userId 用户ID
   * @param socketId Socket连接ID
   */
  async joinRoom(auctionId: number, userId: number, socketId: string): Promise<void> {
    try {
      const roomKey = AuctionCacheKeys.auctionOnlineUsers(auctionId);
      const userSocketKey = `user:socket:${userId}`;

      // 将用户添加到房间在线用户集合
      await redisUtils.sadd(roomKey, userId.toString());
      
      // 存储用户ID到SocketID的映射
      await redisUtils.hset(`auction:${auctionId}:user_sockets`, userId.toString(), socketId);
      
      // 存储SocketID到用户信息的映射
      await redisUtils.hset('socket:user', socketId, JSON.stringify({
        userId,
        auctionId,
        joinedAt: Date.now(),
      }));

      // 设置映射过期时间（24小时）
      await redisUtils.expire(`auction:${auctionId}:user_sockets`, 86400);
      await redisUtils.expire('socket:user', 86400);

      logger.debug(`User ${userId} joined room for auction ${auctionId}`);
    } catch (error) {
      logger.error('Join room failed:', error);
      throw error;
    }
  }

  /**
   * 用户离开房间
   * @param auctionId 竞拍ID
   * @param userId 用户ID
   * @param socketId Socket连接ID
   */
  async leaveRoom(auctionId: number, userId: number, socketId: string): Promise<void> {
    try {
      const roomKey = AuctionCacheKeys.auctionOnlineUsers(auctionId);

      // 从房间在线用户集合中移除
      await redisUtils.srem(roomKey, userId.toString());
      
      // 移除用户Socket映射
      await redisUtils.hdel(`auction:${auctionId}:user_sockets`, userId.toString());
      
      // 移除Socket用户映射
      await redisUtils.hdel('socket:user', socketId);

      logger.debug(`User ${userId} left room for auction ${auctionId}`);
    } catch (error) {
      logger.error('Leave room failed:', error);
      throw error;
    }
  }

  /**
   * 根据SocketID获取用户信息
   * @param socketId Socket连接ID
   */
  async getUserBySocketId(socketId: string): Promise<{ userId: number; auctionId: number } | null> {
    try {
      const userInfo = await redisUtils.hget('socket:user', socketId);
      if (userInfo) {
        return JSON.parse(userInfo);
      }
      return null;
    } catch (error) {
      logger.error('Get user by socket ID failed:', error);
      return null;
    }
  }

  /**
   * 获取房间在线用户数
   * @param auctionId 竞拍ID
   */
  async getOnlineCount(auctionId: number): Promise<number> {
    try {
      const roomKey = AuctionCacheKeys.auctionOnlineUsers(auctionId);
      return await redisUtils.scard(roomKey);
    } catch (error) {
      logger.error('Get online count failed:', error);
      return 0;
    }
  }

  /**
   * 获取房间在线用户列表
   * @param auctionId 竞拍ID
   */
  async getOnlineUsers(auctionId: number): Promise<string[]> {
    try {
      const roomKey = AuctionCacheKeys.auctionOnlineUsers(auctionId);
      return await redisUtils.smembers(roomKey);
    } catch (error) {
      logger.error('Get online users failed:', error);
      return [];
    }
  }

  /**
   * 检查用户是否在房间中
   * @param auctionId 竞拍ID
   * @param userId 用户ID
   */
  async isUserInRoom(auctionId: number, userId: number): Promise<boolean> {
    try {
      const roomKey = AuctionCacheKeys.auctionOnlineUsers(auctionId);
      return await redisUtils.sismember(roomKey, userId.toString());
    } catch (error) {
      logger.error('Check user in room failed:', error);
      return false;
    }
  }

  /**
   * 清理房间所有在线用户
   * @param auctionId 竞拍ID
   */
  async clearRoom(auctionId: number): Promise<void> {
    try {
      const roomKey = AuctionCacheKeys.auctionOnlineUsers(auctionId);
      const socketKey = `auction:${auctionId}:user_sockets`;
      
      // 获取所有在线用户
      const users = await redisUtils.smembers(roomKey);
      
      // 清除Socket映射
      for (const userId of users) {
        const socketId = await redisUtils.hget(socketKey, userId);
        if (socketId) {
          await redisUtils.hdel('socket:user', socketId);
        }
      }
      
      // 删除房间相关键
      await redisUtils.del(roomKey);
      await redisUtils.del(socketKey);

      logger.info(`Room cleared for auction ${auctionId}`);
    } catch (error) {
      logger.error('Clear room failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户当前所在的房间列表
   * @param userId 用户ID
   */
  async getUserRooms(userId: number): Promise<number[]> {
    try {
      // 这里需要扫描所有房间检查用户是否在其中
      // 为了性能，可以维护一个用户->房间的映射
      // 暂时返回空数组，实际可以通过额外的Redis键实现
      return [];
    } catch (error) {
      logger.error('Get user rooms failed:', error);
      return [];
    }
  }

  /**
   * 批量获取多个房间的在线人数
   * @param auctionIds 竞拍ID数组
   */
  async getMultipleOnlineCounts(auctionIds: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    
    try {
      for (const auctionId of auctionIds) {
        const count = await this.getOnlineCount(auctionId);
        result.set(auctionId, count);
      }
    } catch (error) {
      logger.error('Get multiple online counts failed:', error);
    }
    
    return result;
  }

  /**
   * 清理过期的Socket映射
   * 建议定期调用此方法清理无效映射
   */
  async cleanupStaleMappings(): Promise<number> {
    try {
      const socketUserMap = await redisUtils.hgetall('socket:user');
      let cleanedCount = 0;
      
      for (const [socketId, userInfoStr] of Object.entries(socketUserMap)) {
        try {
          const userInfo = JSON.parse(userInfoStr);
          const auctionId = userInfo.auctionId;
          
          // 检查用户是否还在房间中
          const isInRoom = await this.isUserInRoom(auctionId, userInfo.userId);
          if (!isInRoom) {
            await redisUtils.hdel('socket:user', socketId);
            cleanedCount++;
          }
        } catch (parseError) {
          // 无效的JSON，直接删除
          await redisUtils.hdel('socket:user', socketId);
          cleanedCount++;
        }
      }
      
      logger.info(`Cleaned up ${cleanedCount} stale socket mappings`);
      return cleanedCount;
    } catch (error) {
      logger.error('Cleanup stale mappings failed:', error);
      return 0;
    }
  }
}

export const roomManager = RoomManager.getInstance();