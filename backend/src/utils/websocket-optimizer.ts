import { Server as SocketIOServer, Socket } from 'socket.io';
import { performanceConfig } from '../config/performance.config';
import { logger } from './logger';
import zlib from 'zlib';

/**
 * WebSocket优化器
 * 实现消息压缩、房间广播优化、连接管理等功能
 */

// 消息类型定义
interface WebSocketMessage {
  event: string;
  data: any;
  timestamp: number;
  compressed?: boolean;
}

// 广播任务
interface BroadcastTask {
  roomName: string;
  event: string;
  data: any;
  priority: number;
  timestamp: number;
}

// 房间统计信息
interface RoomStats {
  userCount: number;
  messageCount: number;
  lastActivity: number;
  broadcastLatency: number;
}

/**
 * WebSocket优化器类
 */
export class WebSocketOptimizer {
  private io: SocketIOServer;
  private messageQueue: BroadcastTask[] = [];
  private roomStats: Map<string, RoomStats> = new Map();
  private processingTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private compressionEnabled: boolean;
  private compressionThreshold: number;
  private static readonly MAX_MESSAGE_QUEUE_SIZE = 500;
  private static readonly MAX_ROOM_STATS_SIZE = 200;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.compressionEnabled = performanceConfig.websocket.compression.enabled;
    this.compressionThreshold = performanceConfig.websocket.compression.threshold;
    
    this.startMessageProcessor();
    this.startMetricsCollector();
    this.startAutoCleanup();
  }

  // ========== 消息压缩 ==========

  /**
   * 压缩消息数据
   */
  async compressMessage(data: any): Promise<{ compressed: boolean; data: Buffer | string }> {
    if (!this.compressionEnabled) {
      return { compressed: false, data: JSON.stringify(data) };
    }

    const serialized = JSON.stringify(data);
    
    // 如果数据小于阈值，不压缩
    if (serialized.length < this.compressionThreshold) {
      return { compressed: false, data: serialized };
    }

    try {
      const compressed = await this.gzipCompress(Buffer.from(serialized));
      
      // 检查压缩效果
      if (compressed.length < serialized.length * 0.8) {
        return { compressed: true, data: compressed };
      }
      
      return { compressed: false, data: serialized };
    } catch (error) {
      logger.error('Message compression failed:', error);
      return { compressed: false, data: serialized };
    }
  }

  /**
   * 解压消息数据
   */
  async decompressMessage(data: Buffer | string, compressed: boolean): Promise<any> {
    if (!compressed) {
      return typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
    }

    try {
      const decompressed = await this.gzipDecompress(data as Buffer);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      logger.error('Message decompression failed:', error);
      throw error;
    }
  }

  /**
   * Gzip压缩
   */
  private gzipCompress(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(data, { level: performanceConfig.websocket.compression.level }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  /**
   * Gzip解压
   */
  private gzipDecompress(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  // ========== 房间广播优化 ==========

  /**
   * 优化广播到房间
   * 支持消息队列、批量发送、优先级
   */
  async broadcastToRoom(
    roomName: string,
    event: string,
    data: any,
    options?: {
      priority?: number;
      compress?: boolean;
      excludeSocket?: string;
    }
  ): Promise<void> {
    const priority = options?.priority || 0;
    
    // 添加到消息队列（限制队列大小防止内存溢出）
    if (this.messageQueue.length >= WebSocketOptimizer.MAX_MESSAGE_QUEUE_SIZE) {
      // 丢弃最旧的低优先级消息
      this.messageQueue.pop();
    }
    
    this.messageQueue.push({
      roomName,
      event,
      data,
      priority,
      timestamp: Date.now(),
    });

    // 按优先级排序
    this.messageQueue.sort((a, b) => b.priority - a.priority);

    // 更新房间统计
    this.updateRoomStats(roomName, 'message');

    // 如果队列过大，立即处理
    if (this.messageQueue.length > performanceConfig.websocket.roomIsolation.broadcastBatchSize * 2) {
      await this.processMessageQueue();
    }
  }

  /**
   * 立即广播到房间（不经过队列）
   */
  async broadcastToRoomImmediate(
    roomName: string,
    event: string,
    data: any,
    options?: { compress?: boolean; excludeSocket?: string }
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // 压缩消息
      const { compressed, data: processedData } = await this.compressMessage(data);

      // 构造消息
      const message: WebSocketMessage = {
        event,
        data: compressed ? processedData : data,
        timestamp: Date.now(),
        compressed,
      };

      // 广播
      if (options?.excludeSocket) {
        this.io.to(roomName).except(options.excludeSocket).emit(event, message);
      } else {
        this.io.to(roomName).emit(event, message);
      }

      // 更新统计
      const latency = Date.now() - startTime;
      this.updateRoomStats(roomName, 'broadcast', latency);
    } catch (error) {
      logger.error(`Broadcast to room ${roomName} failed:`, error);
      throw error;
    }
  }

  /**
   * 批量广播到多个房间
   */
  async broadcastToRooms(
    broadcasts: Array<{
      roomName: string;
      event: string;
      data: any;
    }>
  ): Promise<void> {
    const batchSize = performanceConfig.websocket.roomIsolation.broadcastBatchSize;
    
    // 分批处理
    for (let i = 0; i < broadcasts.length; i += batchSize) {
      const batch = broadcasts.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(({ roomName, event, data }) =>
          this.broadcastToRoomImmediate(roomName, event, data)
        )
      );

      // 避免阻塞
      if (i + batchSize < broadcasts.length) {
        await new Promise(resolve => setTimeout(resolve, 
          performanceConfig.websocket.roomIsolation.broadcastInterval
        ));
      }
    }
  }

  /**
   * 处理消息队列
   */
  private async processMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) return;

    const batchSize = performanceConfig.websocket.roomIsolation.broadcastBatchSize;
    const batch = this.messageQueue.splice(0, batchSize);

    // 按房间分组
    const roomGroups = new Map<string, BroadcastTask[]>();
    for (const task of batch) {
      const group = roomGroups.get(task.roomName) || [];
      group.push(task);
      roomGroups.set(task.roomName, group);
    }

    // 批量发送
    const promises: Promise<void>[] = [];
    for (const [roomName, tasks] of roomGroups.entries()) {
      for (const task of tasks) {
        promises.push(
          this.broadcastToRoomImmediate(roomName, task.event, task.data)
        );
      }
    }

    await Promise.all(promises);
  }

  /**
   * 启动消息处理器
   */
  private startMessageProcessor(): void {
    const interval = performanceConfig.websocket.messageQueue.processInterval;
    
    this.processingTimer = setInterval(async () => {
      try {
        await this.processMessageQueue();
      } catch (error) {
        logger.error('Message queue processing failed:', error);
      }
    }, interval);

    logger.info(`WebSocket message processor started with interval: ${interval}ms`);
  }

  // ========== 连接管理 ==========

  /**
   * 检查房间是否已满
   */
  isRoomFull(roomName: string): boolean {
    const maxUsers = performanceConfig.websocket.roomIsolation.maxUsersPerRoom;
    const stats = this.roomStats.get(roomName);
    
    if (!stats) return false;
    return stats.userCount >= maxUsers;
  }

  /**
   * 获取房间用户数
   */
  async getRoomUserCount(roomName: string): Promise<number> {
    const sockets = await this.io.in(roomName).fetchSockets();
    return sockets.length;
  }

  /**
   * 获取房间统计信息
   */
  getRoomStats(roomName: string): RoomStats | undefined {
    return this.roomStats.get(roomName);
  }

  /**
   * 更新房间统计
   */
  private updateRoomStats(
    roomName: string,
    type: 'message' | 'broadcast' | 'join' | 'leave',
    latency?: number
  ): void {
    const stats = this.roomStats.get(roomName) || {
      userCount: 0,
      messageCount: 0,
      lastActivity: Date.now(),
      broadcastLatency: 0,
    };

    switch (type) {
      case 'message':
        stats.messageCount++;
        stats.lastActivity = Date.now();
        break;
      case 'broadcast':
        if (latency !== undefined) {
          stats.broadcastLatency = (stats.broadcastLatency + latency) / 2;
        }
        break;
      case 'join':
        stats.userCount++;
        stats.lastActivity = Date.now();
        break;
      case 'leave':
        stats.userCount = Math.max(0, stats.userCount - 1);
        stats.lastActivity = Date.now();
        break;
    }

    this.roomStats.set(roomName, stats);
  }

  /**
   * 记录用户加入房间
   */
  recordUserJoin(roomName: string): void {
    this.updateRoomStats(roomName, 'join');
  }

  /**
   * 记录用户离开房间
   */
  recordUserLeave(roomName: string): void {
    this.updateRoomStats(roomName, 'leave');
  }

  // ========== 性能监控 ==========

  /**
   * 启动指标收集器
   */
  private startMetricsCollector(): void {
    if (!performanceConfig.websocket.monitoring.enabled) return;

    const interval = performanceConfig.websocket.monitoring.metricsInterval;
    
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, interval);

    logger.info(`WebSocket metrics collector started with interval: ${interval}ms`);
  }

  /**
   * 收集性能指标（避免序列化大型Map以减少内存压力）
   */
  private collectMetrics(): void {
    // 只记录摘要信息，避免序列化整个roomStats Map
    let totalMessages = 0;
    let totalUsers = 0;
    for (const stats of this.roomStats.values()) {
      totalMessages += stats.messageCount;
      totalUsers += stats.userCount;
    }

    const metrics = {
      timestamp: Date.now(),
      connections: this.io.engine.clientsCount,
      rooms: this.roomStats.size,
      queueSize: this.messageQueue.length,
      totalMessages,
      totalUsers,
    };

    logger.debug('WebSocket metrics:', metrics);
  }

  /**
   * 获取全局统计信息
   */
  getGlobalStats(): {
    connections: number;
    rooms: number;
    queueSize: number;
    totalMessages: number;
    avgBroadcastLatency: number;
  } {
    let totalMessages = 0;
    let totalLatency = 0;
    let roomCount = 0;

    for (const stats of this.roomStats.values()) {
      totalMessages += stats.messageCount;
      totalLatency += stats.broadcastLatency;
      roomCount++;
    }

    return {
      connections: this.io.engine.clientsCount,
      rooms: roomCount,
      queueSize: this.messageQueue.length,
      totalMessages,
      avgBroadcastLatency: roomCount > 0 ? totalLatency / roomCount : 0,
    };
  }

  // ========== 消息优化 ==========

  /**
   * 创建优化的消息格式
   */
  createOptimizedMessage(event: string, data: any): WebSocketMessage {
    return {
      event,
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * 批量发送消息给单个Socket
   */
  async sendBatchToSocket(
    socket: Socket,
    messages: Array<{ event: string; data: any }>
  ): Promise<void> {
    // 将多条消息合并为一条
    const batchMessage = {
      type: 'batch',
      messages: messages.map(msg => ({
        event: msg.event,
        data: msg.data,
        timestamp: Date.now(),
      })),
      count: messages.length,
    };

    socket.emit('batch_messages', batchMessage);
  }

  /**
   * 增量更新（只发送变化的部分）
   */
  createDeltaUpdate(previous: any, current: any): any {
    if (typeof previous !== 'object' || typeof current !== 'object') {
      return current;
    }

    const delta: any = {};
    let hasChanges = false;

    for (const key of Object.keys(current)) {
      if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
        delta[key] = current[key];
        hasChanges = true;
      }
    }

    return hasChanges ? delta : null;
  }

  // ========== 清理和销毁 ==========

  /**
   * 清理不活跃的房间统计
   */
  cleanupInactiveRooms(maxInactiveTime: number = 1800000): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [roomName, stats] of this.roomStats.entries()) {
      if (now - stats.lastActivity > maxInactiveTime && stats.userCount === 0) {
        this.roomStats.delete(roomName);
        cleaned++;
      }
    }

    // 强制限制roomStats大小（防止极端情况）
    if (this.roomStats.size > WebSocketOptimizer.MAX_ROOM_STATS_SIZE) {
      const entries = Array.from(this.roomStats.entries())
        .sort((a, b) => a[1].lastActivity - b[1].lastActivity);
      const toRemove = entries.slice(0, entries.length - WebSocketOptimizer.MAX_ROOM_STATS_SIZE);
      for (const [key] of toRemove) {
        this.roomStats.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} inactive room stats`);
    }
  }

  /**
   * 启动自动清理定时器
   */
  private startAutoCleanup(): void {
    // 每5分钟清理一次不活跃房间
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveRooms();
    }, 5 * 60 * 1000);
    
    logger.info('WebSocket optimizer auto-cleanup started');
  }

  /**
   * 销毁优化器
   */
  destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.messageQueue = [];
    this.roomStats.clear();

    logger.info('WebSocket optimizer destroyed');
  }
}

// 创建优化器实例的工厂函数
export function createWebSocketOptimizer(io: SocketIOServer): WebSocketOptimizer {
  return new WebSocketOptimizer(io);
}

export default WebSocketOptimizer;