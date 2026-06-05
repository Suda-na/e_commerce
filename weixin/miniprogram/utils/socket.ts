/**
 * WebSocket 连接管理器
 * 
 * 功能特性：
 * 1. 单例模式 - 全局唯一连接实例
 * 2. 连接管理 - connect/close
 * 3. 房间管理 - joinRoom/leaveRoom
 * 4. 事件监听 - on/off/once
 * 5. 消息发送 - emit（支持断线缓存）
 * 6. 心跳保活 - 30s 间隔，45s 超时
 * 7. 断线重连 - 指数退避（1s/2s/4s/8s/16s），最多5次
 * 8. 消息队列 - 断线期间缓存消息，重连后补发
 * 9. 前后台切换 - onShow 恢复连接，onHide 保持或断开
 */

// ==================== 类型定义 ====================

/** Socket 连接状态 */
export enum SocketState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
}

/** Socket 事件类型 */
export interface SocketEvents {
  // 连接事件
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'connect_error': (error: Error) => void;
  'reconnecting': (attempt: number) => void;
  'reconnect_failed': () => void;

  // 房间事件
  'room_joined': (roomId: string) => void;
  'room_left': (roomId: string) => void;
  'user_joined': (data: { roomId: string; userId: string; nickname: string }) => void;
  'user_left': (data: { roomId: string; userId: string }) => void;
  'online_count': (data: { roomId: string; count: number }) => void;

  // 竞拍事件
  'new_bid': (data: BidData) => void;
  'price_update': (data: PriceUpdateData) => void;
  'auction_start': (data: AuctionStatusData) => void;
  'auction_end': (data: AuctionStatusData) => void;
  'auction_ending_soon': (data: { auctionId: string; remainingTime: number }) => void;
  'time_extended': (data: { auctionId: string; newEndTime: number }) => void;
  'outbid': (data: OutbidData) => void;
  'bid_success': (data: BidSuccessData) => void;
  'bid_error': (data: { message: string }) => void;
  'leaderboard_update': (data: LeaderboardData) => void;

  // 系统事件
  'system_notice': (data: SystemNoticeData) => void;
  'heartbeat_ack': () => void;

  // 自定义事件（通配）
  [key: string]: (...args: any[]) => void;
}

/** 出价数据 */
export interface BidData {
  auctionId: string;
  bidId: string;
  userId: string;
  nickname: string;
  avatar?: string;
  level?: number;
  amount: number;
  timestamp: number;
  endTime?: number;
  isExtended?: boolean;
}

/** 价格更新数据 */
export interface PriceUpdateData {
  auctionId: string;
  currentPrice: number;
  bidCount: number;
  participantCount: number;
  endTime?: number;
}

/** 竞拍状态数据 */
export interface AuctionStatusData {
  auctionId: string;
  status: 'pending' | 'active' | 'completed' | 'ended' | 'cancelled';
  winnerId?: string;
  winnerNickname?: string;
  finalPrice?: number;
}

/** 出价被超越数据 */
export interface OutbidData {
  auctionId: string;
  yourBid: number;
  currentPrice: number;
  bidderNickname: string;
}

/** 出价成功数据 */
export interface BidSuccessData {
  auctionId: string;
  bidId: string;
  amount: number;
  isLeading: boolean;
  endTime?: number;
  isExtended?: boolean;
}

/** 排行榜数据 */
export interface LeaderboardData {
  auctionId: string;
  rankings: Array<{
    userId: string;
    nickname: string;
    avatar?: string;
    amount: number;
    rank: number;
  }>;
}

/** 系统通知数据 */
export interface SystemNoticeData {
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: number;
}

/** 待发送消息 */
interface PendingMessage {
  event: string;
  data: any;
  timestamp: number;
}

/** 事件回调函数 */
type EventCallback<T = any> = (data: T) => void;

// ==================== 配置常量 ====================

/** 心跳间隔（30秒） */
const HEARTBEAT_INTERVAL = 30000;

/** 心跳超时（45秒） */
const HEARTBEAT_TIMEOUT = 45000;

/** 最大重连次数 */
const MAX_RECONNECT_ATTEMPTS = 5;

/** 重连基础延迟（1秒） */
const RECONNECT_BASE_DELAY = 1000;

/** 消息队列最大长度 */
const MAX_QUEUE_SIZE = 100;

/** 日志前缀 */
const LOG_PREFIX = '[Socket]';

// ==================== SocketManager 类 ====================

export class SocketManager {
  private static instance: SocketManager | null = null;

  /** Socket 任务实例 */
  private socketTask: WechatMiniprogram.SocketTask | null = null;

  /** 连接状态 */
  private state: SocketState = SocketState.DISCONNECTED;

  /** WebSocket URL */
  private url: string = '';

  /** 认证 Token */
  private token: string = '';

  /** 事件监听器 */
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /** 当前加入的房间 */
  private currentRooms: Set<string> = new Set();

  /** 心跳定时器 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /** 心跳超时检测器 */
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  /** 重连计数器 */
  private reconnectAttempts: number = 0;

  /** 重连定时器 */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** 待发送消息队列 */
  private messageQueue: PendingMessage[] = [];

  /** 是否主动关闭 */
  private isManualClose: boolean = false;

  /** 上次连接时间 */
  private lastConnectTime: number = 0;

  /** 最小重连间隔（防止频繁重连） */
  private minReconnectInterval: number = 2000;

  private constructor() {
    // 监听小程序生命周期
    this.setupLifecycleListeners();
  }

  /** 获取单例实例 */
  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  // ==================== 生命周期监听 ====================

  /** 设置小程序生命周期监听 */
  private setupLifecycleListeners(): void {
    // 小程序从后台进入前台
    wx.onAppShow(() => {
      this.log('App show - 检查连接状态');
      if (this.state === SocketState.DISCONNECTED && !this.isManualClose) {
        this.reconnect();
      }
    });

    // 小程序从前台进入后台
    wx.onAppHide(() => {
      this.log('App hide - 保持连接（后台保活）');
      // 注意：微信小程序后台会保持 WebSocket 连接一段时间
      // 如果需要断开，可以在这里调用 this.close()
    });
  }

  // ==================== 连接管理 ====================

  /**
   * 建立 WebSocket 连接
   * @param url WebSocket 地址（可选，默认使用配置）
   * @param token 认证 Token（可选）
   */
  connect(url?: string, token?: string): void {
    // 防止重复连接
    if (this.state === SocketState.CONNECTING) {
      this.warn('正在连接中，请勿重复调用');
      return;
    }

    // 如果已连接，检查 token 是否变化，变化则断开重连
    if (this.state === SocketState.CONNECTED) {
      const latestToken = token || this.getToken();
      if (latestToken && latestToken !== this.token) {
        this.log('Token 已变化，断开旧连接并重连');
        this.close();
        // 继续下面的连接逻辑
      } else {
        this.warn('已经连接，无需重复连接');
        return;
      }
    }

    // 防止频繁重连
    const now = Date.now();
    if (now - this.lastConnectTime < this.minReconnectInterval) {
      this.warn('连接过于频繁，请稍后再试');
      return;
    }

    // 设置参数 - 每次都获取最新 token，防止用户切换后仍使用旧 token
    this.url = url || this.getUrl();
    this.token = token || this.getToken();
    this.isManualClose = false;
    this.lastConnectTime = now;

    // 构建带 Token 的 URL
    const wsUrl = this.buildUrl(this.url, this.token);

    this.log(`连接: ${wsUrl}`);
    this.setState(SocketState.CONNECTING);

    try {
      this.socketTask = wx.connectSocket({
        url: wsUrl,
        success: () => {
          this.log('连接请求已发送');
        },
        fail: (err) => {
          this.error('连接失败', err);
          this.setState(SocketState.DISCONNECTED);
          this.emitEvent('connect_error', new Error('连接失败'));
          this.scheduleReconnect();
        },
      });

      this.setupSocketListeners();
    } catch (error) {
      this.error('连接异常', error);
      this.setState(SocketState.DISCONNECTED);
      this.emitEvent('connect_error', error as Error);
    }
  }

  /** 断开连接 */
  close(): void {
    this.log('主动断开连接');
    this.isManualClose = true;
    this.cleanup();

    if (this.socketTask) {
      try {
        this.socketTask.close({
          success: () => {
            this.log('连接已关闭');
          },
          fail: (err) => {
            this.warn('关闭连接失败', err);
          },
        });
      } catch (e) {
        // 忽略
      }
      this.socketTask = null;
    }

    this.setState(SocketState.DISCONNECTED);
  }

  /** 重新连接 */
  reconnect(): void {
    if (this.state === SocketState.RECONNECTING) {
      this.warn('正在重连中');
      return;
    }

    this.log('开始重连...');
    this.setState(SocketState.RECONNECTING);
    this.reconnectAttempts = 0;
    this.attemptReconnect();
  }

  // ==================== 房间管理 ====================

  /**
   * 加入竞拍房间
   * @param auctionId 竞拍 ID
   */
  joinRoom(auctionId: string): void {
    if (!this.isConnected()) {
      this.warn('未连接，房间加入请求已缓存');
      this.queueMessage('join_auction', { auctionId: Number(auctionId) });
      return;
    }

    this.log(`加入房间: ${auctionId}`);
    this.currentRooms.add(auctionId);
    this.emit('join_auction', { auctionId: Number(auctionId) });
  }

  /**
   * 离开竞拍房间
   * @param auctionId 竞拍 ID
   */
  leaveRoom(auctionId: string): void {
    this.currentRooms.delete(auctionId);

    if (!this.isConnected()) {
      return;
    }

    this.log(`离开房间: ${auctionId}`);
    this.emit('leave_auction', { auctionId: Number(auctionId) });
  }

  /** 离开所有房间 */
  leaveAllRooms(): void {
    this.currentRooms.forEach((roomId) => {
      this.leaveRoom(roomId);
    });
    this.currentRooms.clear();
  }

  /** 获取当前房间列表 */
  getCurrentRooms(): string[] {
    return Array.from(this.currentRooms);
  }

  // ==================== 事件系统 ====================

  /**
   * 注册事件监听
   * @param event 事件名称
   * @param callback 回调函数
   */
  on<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * 注册一次性事件监听
   * @param event 事件名称
   * @param callback 回调函数
   */
  once<T = any>(event: string, callback: EventCallback<T>): void {
    const wrapper: EventCallback<T> = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  /**
   * 移除事件监听
   * @param event 事件名称
   * @param callback 回调函数（不传则移除该事件所有监听）
   */
  off(event: string, callback?: EventCallback): void {
    if (!callback) {
      this.listeners.delete(event);
      return;
    }

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /** 移除所有事件监听 */
  offAll(): void {
    this.listeners.clear();
  }

  // ==================== 消息发送 ====================

  /**
   * 发送消息
   * @param event 事件名称
   * @param data 数据
   * @param queueIfOffline 断线时是否缓存（默认 true）
   */
  emit(event: string, data?: any, queueIfOffline?: boolean): void {
    const queue = queueIfOffline !== undefined ? queueIfOffline : true;
    if (!this.isConnected()) {
      if (queue) {
        this.queueMessage(event, data);
      } else {
        this.warn(`未连接，消息 ${event} 已丢弃`);
      }
      return;
    }

    if (!this.socketTask) {
      this.error('Socket 任务不存在');
      return;
    }

    // Socket.IO协议格式: 42["event", data]
    const message = `42${JSON.stringify([event, data])}`;

    this.socketTask.send({
      data: message,
      success: () => {
        this.log(`发送: ${event}`, data);
      },
      fail: (err) => {
        this.error(`发送失败: ${event}`, err);
        if (queueIfOffline) {
          this.queueMessage(event, data);
        }
      },
    });
  }

  /**
   * 发送原始WebSocket消息（用于协议握手）
   * @param data 原始数据
   */
  private sendRaw(data: string): void {
    if (!this.socketTask) {
      this.error('Socket任务不存在，无法发送原始消息');
      return;
    }

    this.socketTask.send({
      data: data,
      success: () => {
        this.log(`发送原始消息: ${data}`);
      },
      fail: (err) => {
        this.error(`发送原始消息失败: ${data}`, err);
      },
    });
  }

  // ==================== 状态查询 ====================

  /** 是否已连接 */
  isConnected(): boolean {
    return this.state === SocketState.CONNECTED;
  }

  /** 获取连接状态 */
  getState(): SocketState {
    return this.state;
  }

  /** 获取重连次数 */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /** 获取队列中的消息数 */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  // ==================== 内部方法 ====================

  /** 设置 Socket 监听器 */
  private setupSocketListeners(): void {
    if (!this.socketTask) return;

    // 连接成功
    this.socketTask.onOpen(() => {
      this.log('WebSocket连接已建立，等待Socket.IO握手...');
      // Socket.IO协议：发送Engine.IO OPEN包
      // 不要立即设置为CONNECTED，等待服务器握手响应
    });

    // 收到消息
    this.socketTask.onMessage((res) => {
      try {
        const data = res.data as string;
        this.log(`收到原始消息: ${data.substring(0, 100)}`);
        
        // 处理Socket.IO协议消息
        // Engine.IO协议: 0=open, 1=close, 2=ping, 3=pong, 4=message
        // Socket.IO协议(在message中): 0=CONNECT, 1=DISCONNECT, 2=EVENT, 4=ERROR
        
        if (data.startsWith('0')) {
          // Engine.IO OPEN - 服务器确认连接（可能带有JSON配置数据）
          this.log('Engine.IO OPEN收到，发送Socket.IO CONNECT');
          // 发送Socket.IO CONNECT到默认命名空间
          this.sendRaw('40');
          return;
        }
        
        if (data === '2') {
          // Engine.IO PING - 心跳检测
          this.log('收到PING，发送PONG');
          this.sendRaw('3'); // 发送Engine.IO PONG
          this.resetHeartbeatTimeout();
          return;
        }
        
        if (data === '3') {
          // Engine.IO PONG - 心跳响应
          this.resetHeartbeatTimeout();
          return;
        }
        
        if (data.startsWith('40')) {
          // Socket.IO CONNECT确认
          this.log('Socket.IO连接已建立');
          this.setState(SocketState.CONNECTED);
          this.reconnectAttempts = 0;
          this.lastConnectTime = Date.now();
          
          // 启动心跳
          this.startHeartbeat();
          
          // 重新加入房间
          this.rejoinRooms();
          
          // 发送缓存消息
          this.flushMessageQueue();
          
          // 触发连接事件
          this.emitEvent('connect');
          return;
        }
        
        if (data.startsWith('41')) {
          // Socket.IO DISCONNECT
          this.log('Socket.IO断开连接');
          this.setState(SocketState.DISCONNECTED);
          this.emitEvent('disconnect', '服务器断开连接');
          return;
        }
        
        if (data.startsWith('42')) {
          // Socket.IO EVENT - 业务事件
          try {
            const jsonStr = data.substring(2); // 去掉"42"前缀
            const [event, eventData] = JSON.parse(jsonStr);
            
            // 服务端心跳检测：收到ping事件后立即回复pong
            if (event === 'ping') {
              this.log('收到服务端ping，回复pong');
              this.sendPong();
              this.resetHeartbeatTimeout();
              return;
            }
            
            // 心跳响应特殊处理
            if (event === 'heartbeat_ack' || event === 'pong') {
              this.resetHeartbeatTimeout();
              this.emitEvent('heartbeat_ack');
              return;
            }
            
            this.log(`收到事件: ${event}`, eventData);
            this.emitEvent(event, eventData);
          } catch (parseError) {
            this.error('解析事件数据失败', parseError);
          }
          return;
        }
        
        if (data.startsWith('44')) {
          // Socket.IO ERROR
          try {
            const jsonStr = data.substring(2);
            const errorData = JSON.parse(jsonStr);
            this.error('Socket.IO错误', errorData);
            this.emitEvent('connect_error', new Error(errorData.message || '连接错误'));
          } catch (parseError) {
            this.error('解析错误数据失败', parseError);
          }
          return;
        }
        
        // 其他消息尝试JSON解析（兼容旧格式）
        try {
          const message = JSON.parse(data);
          const { event, data: eventData } = message;
          this.log(`收到: ${event}`, eventData);
          this.emitEvent(event, eventData);
        } catch (jsonError) {
          this.log('非JSON消息，忽略:', data.substring(0, 50));
        }
      } catch (e) {
        this.error('处理消息失败', e);
      }
    });

    // 连接关闭
    this.socketTask.onClose((res) => {
      this.log(`连接关闭: code=${res.code}, reason=${res.reason}`);
      this.setState(SocketState.DISCONNECTED);
      this.stopHeartbeat();

      this.emitEvent('disconnect', res.reason || '连接已关闭');

      // 非主动关闭，尝试重连
      if (!this.isManualClose) {
        this.scheduleReconnect();
      }
    });

    // 连接错误
    this.socketTask.onError((err) => {
      this.error('连接错误', err);
      this.emitEvent('connect_error', new Error(err.errMsg || '连接错误'));
    });
  }

  /** 设置连接状态 */
  private setState(state: SocketState): void {
    if (this.state !== state) {
      this.log(`状态变更: ${this.state} -> ${state}`);
      this.state = state;
    }
  }

  /** 触发事件 */
  private emitEvent(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(...args);
        } catch (e) {
          this.error(`事件回调异常: ${event}`, e);
        }
      });
    }
  }

  // ==================== 心跳管理 ====================

  /** 启动心跳 */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.log('启动心跳');
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendPong();
        this.startHeartbeatTimeout();
      }
    }, HEARTBEAT_INTERVAL);
  }

  /** 发送pong心跳响应（匹配服务端期望的事件名） */
  private sendPong(): void {
    if (!this.isConnected() || !this.socketTask) return;

    const message = `42${JSON.stringify(['pong', { timestamp: Date.now() }])}`;
    this.socketTask.send({
      data: message,
      success: () => {
        this.log('发送pong心跳');
      },
      fail: (err) => {
        this.error('发送pong失败', err);
      },
    });
  }

  /** 停止心跳 */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.stopHeartbeatTimeout();
  }

  /** 启动心跳超时检测 */
  private startHeartbeatTimeout(): void {
    this.stopHeartbeatTimeout();

    this.heartbeatTimeoutTimer = setTimeout(() => {
      this.warn('心跳超时，判定连接断开');
      this.handleDisconnect('心跳超时');
    }, HEARTBEAT_TIMEOUT);
  }

  /** 停止心跳超时检测 */
  private stopHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /** 重置心跳超时（收到服务器响应时调用） */
  private resetHeartbeatTimeout(): void {
    this.stopHeartbeatTimeout();
  }

  // ==================== 重连管理 ====================

  /** 安排重连 */
  private scheduleReconnect(): void {
    if (this.isManualClose) {
      this.log('主动关闭，不重连');
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.warn(`已达到最大重连次数(${MAX_RECONNECT_ATTEMPTS})，停止重连`);
      this.emitEvent('reconnect_failed');
      return;
    }

    // 指数退避延迟
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      30000 // 最大延迟 30 秒
    );

    this.reconnectAttempts++;
    this.log(`将在 ${delay}ms 后进行第 ${this.reconnectAttempts} 次重连`);

    this.emitEvent('reconnecting', this.reconnectAttempts);

    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  /** 尝试重连 */
  private attemptReconnect(): void {
    if (this.isManualClose) {
      return;
    }

    this.log(`第 ${this.reconnectAttempts} 次重连尝试...`);
    // 重连时刷新 token，防止用户切换后仍使用旧 token
    const latestToken = this.getToken();
    this.connect(this.url, latestToken || undefined);
  }

  /** 处理断开连接 */
  private handleDisconnect(reason: string): void {
    this.log(`连接断开: ${reason}`);
    this.setState(SocketState.DISCONNECTED);
    this.stopHeartbeat();

    // 关闭现有连接
    if (this.socketTask) {
      try {
        this.socketTask.close();
      } catch (e) {
        // 忽略
      }
      this.socketTask = null;
    }

    this.emitEvent('disconnect', reason);

    // 尝试重连
    if (!this.isManualClose) {
      this.scheduleReconnect();
    }
  }

  // ==================== 消息队列 ====================

  /** 缓存消息 */
  private queueMessage(event: string, data: any): void {
    // 限制队列大小
    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      this.warn(`消息队列已满(${MAX_QUEUE_SIZE})，丢弃最早的消息`);
      this.messageQueue.shift();
    }

    this.messageQueue.push({
      event,
      data,
      timestamp: Date.now(),
    });

    this.log(`消息已缓存: ${event}，队列长度: ${this.messageQueue.length}`);
  }

  /** 发送缓存消息 */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    this.log(`发送 ${this.messageQueue.length} 条缓存消息`);

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    queue.forEach((msg) => {
      // 超过 5 分钟的消息丢弃
      if (Date.now() - msg.timestamp > 5 * 60 * 1000) {
        this.warn(`丢弃过期消息: ${msg.event}`);
        return;
      }
      this.emit(msg.event, msg.data, false);
    });
  }

  /** 重新加入房间 */
  private rejoinRooms(): void {
    if (this.currentRooms.size === 0) {
      return;
    }

    this.log(`重新加入 ${this.currentRooms.size} 个房间`);

    this.currentRooms.forEach((roomId) => {
      this.emit('join_auction', { auctionId: Number(roomId) }, false);
    });
  }

  // ==================== 工具方法 ====================

  /** 获取 WebSocket URL */
  private getUrl(): string {
    try {
      const app = getApp<IAppOption>();
      return app.globalData.socketUrl || 'ws://localhost:3001';
    } catch (e) {
      return 'ws://localhost:3001';
    }
  }

  /** 获取 Token */
  private getToken(): string {
    try {
      const app = getApp<IAppOption>();
      return app.globalData.token || wx.getStorageSync('token') || '';
    } catch (e) {
      return wx.getStorageSync('token') || '';
    }
  }

  /** 构建带参数的 URL */
  private buildUrl(url: string, token: string): string {
    // Socket.IO WebSocket端点格式
    let wsUrl = url;
    
    // 如果是Socket.IO服务器，使用engine.io的WebSocket端点
    if (!wsUrl.includes('/socket.io')) {
      // 确保URL以/socket.io结尾
      const baseUrl = wsUrl.replace(/\/$/, '');
      wsUrl = `${baseUrl}/socket.io/?EIO=4&transport=websocket`;
    }
    
    if (!token) return wsUrl;
    const separator = wsUrl.includes('?') ? '&' : '?';
    return `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
  }

  /** 清理资源 */
  private cleanup(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.reconnectAttempts = 0;
    this.messageQueue = [];
  }

  // ==================== 日志方法 ====================

  private log(message: string, ...args: any[]): void {
    console.log(`${LOG_PREFIX} ${message}`, ...args);
  }

  private warn(message: string, ...args: any[]): void {
    console.warn(`${LOG_PREFIX} ${message}`, ...args);
  }

  private error(message: string, ...args: any[]): void {
    console.error(`${LOG_PREFIX} ${message}`, ...args);
  }
}

// ==================== 导出 ====================

/** 获取 SocketManager 单例 */
export const getSocket = (): SocketManager => SocketManager.getInstance();

/** 默认导出 */
export default SocketManager;
