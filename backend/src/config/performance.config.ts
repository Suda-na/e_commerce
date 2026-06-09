/**
 * 性能优化配置
 * 包含缓存、数据库、WebSocket、监控等配置
 */

export const performanceConfig = {
  // 缓存配置
  cache: {
    // 本地LRU缓存
    local: {
      maxSize: 1000, // 最大缓存条目数
      ttl: 300, // 默认TTL（秒）
      checkInterval: 60, // 清理检查间隔（秒）
    },
    // Redis缓存
    redis: {
      defaultTTL: 3600, // 默认TTL（秒）
      keyPrefix: 'cache:', // 缓存键前缀
      // 缓存策略
      strategies: {
        auction: {
          ttl: 1800,
          staleWhileRevalidate: true,
        },
        product: {
          ttl: 300,
          staleWhileRevalidate: true,
        },
        productList: {
          ttl: 60,
          staleWhileRevalidate: true,
        },
        user: {
          ttl: 900,
          staleWhileRevalidate: false,
        },
        leaderboard: {
          ttl: 30,
          staleWhileRevalidate: true,
        },
        onlineUsers: {
          ttl: 60,
          staleWhileRevalidate: false,
        },
        dashboard: {
          ttl: 30,
          staleWhileRevalidate: true,
        },
        aiResult: {
          ttl: 86400,
          staleWhileRevalidate: false,
        },
      },
    },
    // 缓存保护策略
    protection: {
      // 缓存击穿保护
      breakdown: {
        enabled: true,
        lockTimeout: 5, // 分布式锁超时（秒）
        retryInterval: 100, // 重试间隔（毫秒）
        maxRetries: 3, // 最大重试次数
      },
      // 缓存雪崩保护
      avalanche: {
        enabled: true,
        jitterRange: 300, // TTL随机抖动范围（秒）
        preloadEnabled: true, // 启用缓存预热
        preloadBatchSize: 100, // 预热批次大小
      },
      // 缓存穿透保护
      penetration: {
        enabled: true,
        nullCacheTTL: 300, // 空值缓存TTL（秒）
        bloomFilterEnabled: false, // 布尔过滤器（可选）
      },
    },
  },

  // 分布式锁配置
  distributedLock: {
    defaultTimeout: 10000, // 默认锁超时（毫秒）
    retryDelay: 100, // 重试延迟（毫秒）
    maxRetries: 3, // 最大重试次数
    watchdog: {
      enabled: true, // 启用看门狗自动续期
      interval: 3000, // 看门狗检查间隔（毫秒）
    },
    // 竞拍出价专用锁配置
    bidLock: {
      timeout: 5000, // 出价锁超时（毫秒）
      retryDelay: 50, // 出价重试延迟（毫秒）
      maxRetries: 5, // 出价最大重试次数
    },
  },

  // 数据库优化配置
  database: {
    // 连接池配置
    pool: {
      max: 50, // 最大连接数（从20提升到50）
      min: 10, // 最小连接数（从5提升到10）
      acquire: 60000, // 获取连接超时（毫秒）（从30s提升到60s）
      idle: 30000, // 空闲连接超时（毫秒）（从10s提升到30s）
      evict: 5000, // 连接回收检查间隔（毫秒）（从1s提升到5s）
      handleDisconnects: true,
    },
    // 读写分离配置
    readWriteSplitting: {
      enabled: false, // 需要配置从库后启用
      readReplicas: [
        // { host: 'localhost', port: 3307 }
      ],
      loadBalancing: 'round-robin', // 负载均衡策略: round-robin, random, least-connections
    },
    // 索引优化建议
    indexHints: {
      auctions: ['status', 'start_time', 'end_time', 'product_id'],
      bids: ['auction_id', 'user_id', 'created_at', 'amount'],
      products: ['status', 'merchant_id', 'name'],
      orders: ['user_id', 'status', 'created_at', 'auction_id'],
    },
    // 查询优化
    queryOptimization: {
      enableQueryCache: true,
      queryCacheTTL: 60, // 查询缓存TTL（秒）
      slowQueryThreshold: 1000, // 慢查询阈值（毫秒）
      logSlowQueries: true,
    },
  },

  // WebSocket优化配置
  websocket: {
    // 消息压缩
    compression: {
      enabled: true,
      threshold: 1024, // 压缩阈值（字节）
      level: 6, // 压缩级别（1-9）
    },
    // 房间级路由隔离
    roomIsolation: {
      enabled: true,
      maxUsersPerRoom: 1000, // 每房间最大用户数
      broadcastBatchSize: 50, // 广播批次大小
      broadcastInterval: 100, // 广播间隔（毫秒）
    },
    // 连接管理
    connection: {
      maxConnections: 10000, // 最大连接数
      heartbeatInterval: 30000, // 心跳间隔（毫秒）
      heartbeatTimeout: 20000, // 心跳超时（毫秒）
      disconnectTimeout: 60000, // 断开超时（毫秒）
    },
    // 消息队列
    messageQueue: {
      enabled: true,
      maxSize: 1000, // 队列最大长度
      processInterval: 50, // 处理间隔（毫秒）
      priorityEnabled: true, // 启用消息优先级
    },
    // 性能监控
    monitoring: {
      enabled: true,
      metricsInterval: 60000, // 指标收集间隔（毫秒）
      trackMessageLatency: true,
      trackBroadcastPerformance: true,
    },
  },

  // 性能监控配置
  monitoring: {
    // 应用性能监控
    apm: {
      enabled: true,
      sampleRate: 0.1, // 采样率（10%）
      slowThreshold: 500, // 慢操作阈值（毫秒）
      trackDatabase: true,
      trackCache: true,
      trackWebSocket: true,
    },
    // 系统资源监控
    system: {
      enabled: true,
      interval: 30000, // 收集间隔（毫秒）
      cpuThreshold: 80, // CPU告警阈值（%）
      memoryThreshold: 85, // 内存告警阈值（%）
      eventLoopThreshold: 100, // 事件循环延迟告警阈值（毫秒）
    },
    // 业务指标监控
    business: {
      enabled: true,
      interval: 60000, // 收集间隔（毫秒）
      trackBidLatency: true,
      trackAuctionLoad: true,
      trackUserActivity: true,
    },
    // 告警配置
    alerts: {
      enabled: true,
      channels: ['log', 'redis'], // 告警渠道
      thresholds: {
        errorRate: 0.05, // 错误率阈值（5%）
        responseTime: 2000, // 响应时间阈值（毫秒）
        memoryUsage: 0.9, // 内存使用率阈值（90%）
        connectionCount: 8000, // 连接数阈值
      },
    },
  },

  // 后端服务优化
  backend: {
    // 异步处理配置
    asyncProcessing: {
      enabled: true,
      workerThreads: 4, // 工作线程数
      queueSize: 1000, // 队列大小
      batchSize: 50, // 批处理大小
      processInterval: 100, // 处理间隔（毫秒）
    },
    // 水平扩展配置
    scaling: {
      cluster: {
        enabled: false, // 需要时启用
        workers: 'auto', // 工作进程数（auto = CPU核心数）
      },
      stickySession: {
        enabled: true, // WebSocket需要粘性会话
        cookieName: 'io',
      },
    },
    // 内存管理
    memory: {
      maxOldGenerationSize: '2g', // 老生代最大内存
      youngGenerationSize: '256m', // 新生代内存
      gcInterval: 60000, // GC检查间隔（毫秒）
      heapSnapshotOnCrash: true, // 崩溃时生成堆快照
    },
  },
};

/**
 * 验证性能配置
 */
export function validatePerformanceConfig(): void {
  const errors: string[] = [];

  // 验证缓存配置
  if (performanceConfig.cache.local.maxSize <= 0) {
    errors.push('本地缓存最大大小必须大于0');
  }

  // 验证分布式锁配置
  if (performanceConfig.distributedLock.defaultTimeout <= 0) {
    errors.push('分布式锁默认超时必须大于0');
  }

  // 验证数据库连接池配置
  if (performanceConfig.database.pool.max <= 0) {
    errors.push('数据库连接池最大连接数必须大于0');
  }

  if (performanceConfig.database.pool.min > performanceConfig.database.pool.max) {
    errors.push('数据库连接池最小连接数不能大于最大连接数');
  }

  // 验证WebSocket配置
  if (performanceConfig.websocket.roomIsolation.maxUsersPerRoom <= 0) {
    errors.push('每房间最大用户数必须大于0');
  }

  if (performanceConfig.websocket.connection.maxConnections <= 0) {
    errors.push('WebSocket最大连接数必须大于0');
  }

  // 验证监控配置
  if (performanceConfig.monitoring.apm.sampleRate < 0 || performanceConfig.monitoring.apm.sampleRate > 1) {
    errors.push('APM采样率必须在0-1之间');
  }

  if (errors.length > 0) {
    throw new Error(`性能配置验证失败:\n${errors.join('\n')}`);
  }
}

export default performanceConfig;