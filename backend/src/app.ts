import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import crypto from 'crypto';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { SocketService } from './services/socket.service';
import { RealtimeService } from './services/realtime.service';
import { NotificationService } from './services/notification.service';
import { setNotificationService } from './services/notification.service.factory';
import { testConnection, syncDatabase, closeDatabase } from './config/database';
import './models'; // 确保模型关联关系在使用前初始化
import { testRedisConnection, closeRedis, isRedisConnected } from './config/redis';
import { securityConfig, validateSecurityConfig } from './config/security.config';
import { performanceConfig, validatePerformanceConfig } from './config/performance.config';
import {
  securityHeaders,
  httpsRedirect,
  requestId,
  requestLogger,
  inputValidation,
  csrfProtection,
  distributedRateLimit,
  securityAuditLogger,
} from './middleware/security.middleware';
import { performanceMiddleware, performanceMonitor } from './utils/performance-monitor';
import { createWebSocketOptimizer } from './utils/websocket-optimizer';
import { databaseOptimizer } from './utils/database-optimizer';
import { cacheManager } from './utils/cache-manager';
import routes from './routes';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// 安全配置验证
validateSecurityConfig();

// 性能配置验证
validatePerformanceConfig();

// CORS中间件必须放在所有中间件之前，确保预检请求能正确响应
app.use(cors({
  origin: config.nodeEnv === 'development' ? true : config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token', 'X-Requested-With'],
}));

// 安全中间件链（按顺序应用）
app.use(requestId);                      // 请求ID追踪
app.use(requestLogger);                  // 请求日志记录
app.use(securityHeaders);                // 安全头设置（替代基础 helmet）
app.use(httpsRedirect);                  // HTTPS 重定向
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));
app.use(express.json({ limit: securityConfig.inputValidation.maxBodySize }));
app.use(express.urlencoded({ extended: true }));
app.use(inputValidation);                // 输入验证（SQL注入/XSS检测）
app.use(securityAuditLogger);            // 安全审计日志
app.use(performanceMiddleware());        // 性能监控中间件

// 全局限流（基于Redis的分布式限流）
app.use(distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.global.windowMs,
  max: securityConfig.apiSecurity.rateLimit.global.max,
  message: '请求过于频繁，请稍后再试',
}));

// CSRF Token 端点（前端获取CSRF Token用）
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie(securityConfig.csrf.token.cookieName, csrfToken, {
    httpOnly: securityConfig.csrf.token.httpOnly,
    secure: securityConfig.csrf.token.secure,
    sameSite: securityConfig.csrf.token.sameSite,
    maxAge: securityConfig.csrf.token.ttl * 1000,
  });
  res.json({ csrfToken });
});

app.get('/health', async (_req, res) => {
  const dbConnected = await testConnection().catch(() => false);
  const redisConnected = isRedisConnected();
  const performanceSummary = performanceMonitor.getPerformanceSummary();
  const cacheStats = cacheManager.getStats();
  const cacheHitRate = cacheManager.getHitRate();
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected',
      websocket: websocketOptimizer ? 'initialized' : 'not initialized',
    },
    performance: {
      cpu: performanceSummary.avgCpu,
      memory: performanceSummary.avgMemory,
      eventLoop: performanceSummary.avgEventLoop,
      requests: performanceSummary.totalRequests,
      errorRate: performanceSummary.errorRate,
      activeAlerts: performanceSummary.activeAlerts,
    },
    cache: {
      hitRate: cacheHitRate.overall,
      localSize: cacheStats.localSize,
      totalRequests: cacheStats.totalRequests,
    },
  });
});

// 性能监控API端点
app.get('/api/performance/metrics', (req, res) => {
  const metrics = performanceMonitor.getLatestMetrics();
  res.json({ success: true, data: metrics });
});

app.get('/api/performance/summary', (req, res) => {
  const summary = performanceMonitor.getPerformanceSummary();
  res.json({ success: true, data: summary });
});

app.get('/api/performance/alerts', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const alerts = performanceMonitor.getAlerts(limit);
  res.json({ success: true, data: alerts });
});

app.get('/api/cache/stats', (req, res) => {
  const stats = cacheManager.getStats();
  const hitRate = cacheManager.getHitRate();
  res.json({ success: true, data: { ...stats, hitRate } });
});

app.get('/api/database/stats', async (req, res) => {
  const queryStats = databaseOptimizer.getQueryStatsSummary();
  const slowQueries = databaseOptimizer.getSlowQueries(10);
  const poolStatus = await databaseOptimizer.checkPoolHealth();
  res.json({ success: true, data: { queryStats, slowQueries, poolStatus } });
});

// 静态文件服务：允许前端通过 HTTP 访问上传的图片
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.use('/api', routes);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use(errorHandler);

let socketService: SocketService;
let realtimeService: RealtimeService;
let notificationService: NotificationService;
let websocketOptimizer: any;

const startServer = async () => {
  try {
    logger.info('Initializing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.warn('Database connection failed, but server will continue starting');
    } else {
      logger.info('Database connected successfully');
      await syncDatabase(false);
      logger.info('Database models synced');
    }

    logger.info('Initializing Redis connection...');
    const redisConnected = await testRedisConnection().catch(() => false);
    if (!redisConnected) {
      logger.warn('Redis connection failed, but server will continue starting');
    } else {
      logger.info('Redis connected successfully');
    }

    socketService = new SocketService(io);
    realtimeService = socketService.getRealtimeService();
    notificationService = socketService.getNotificationService();
    setNotificationService(notificationService);
    logger.info('WebSocket service initialized');
    logger.info('Realtime service initialized');
    logger.info('Notification service initialized');

    // 初始化WebSocket优化器
    websocketOptimizer = createWebSocketOptimizer(io);
    logger.info('WebSocket optimizer initialized');

    // 启动性能监控
    performanceMonitor.start();
    logger.info('Performance monitor started');

    // 启动内存管理守护
    startMemoryGuard();

    // 数据库优化：创建推荐索引
    await databaseOptimizer.createRecommendedIndexes().catch(err => 
      logger.warn('Failed to create recommended indexes:', err)
    );
    logger.info('Database optimizer initialized');

    // 缓存预热（可选）
    if (performanceConfig.cache.protection.avalanche.preloadEnabled) {
      logger.info('Cache preload enabled, will preload frequently accessed data');
      // 这里可以添加缓存预热逻辑
    }

    httpServer.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
      logger.info(`API endpoints: http://localhost:${config.port}/api`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');

  // 停止内存守护
  stopMemoryGuard();

  // 停止性能监控
  performanceMonitor.stop();
  
  // 清理WebSocket优化器
  if (websocketOptimizer) {
    websocketOptimizer.destroy();
  }

  if (socketService) {
    await socketService.shutdown();
  }

  // 清理缓存管理器
  cacheManager.destroy();

  await closeDatabase().catch(err => logger.error('Error closing database:', err));
  await closeRedis().catch(err => logger.error('Error closing Redis:', err));

  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');

  // 停止内存守护
  stopMemoryGuard();

  // 停止性能监控
  performanceMonitor.stop();
  
  // 清理WebSocket优化器
  if (websocketOptimizer) {
    websocketOptimizer.destroy();
  }

  if (socketService) {
    await socketService.shutdown();
  }

  // 清理缓存管理器
  cacheManager.destroy();

  await closeDatabase().catch(err => logger.error('Error closing database:', err));
  await closeRedis().catch(err => logger.error('Error closing Redis:', err));

  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// 内存管理守护：当内存使用率超过85%时主动触发GC
let memoryGuardTimer: NodeJS.Timeout | null = null;

function startMemoryGuard(): void {
  memoryGuardTimer = setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssUsedMB = Math.round(memUsage.rss / 1024 / 1024);
    const heapUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    // 当堆内存使用率超过85%时，尝试触发GC
    if (heapUsagePercent > 85) {
      logger.warn(`Memory guard: High heap usage ${heapUsagePercent}% (${heapUsedMB}MB/${heapTotalMB}MB), RSS: ${rssUsedMB}MB`);
      
      // 如果Node.js以 --expose-gc 启动，手动触发GC
      if (global.gc) {
        global.gc();
        const afterGC = process.memoryUsage();
        const afterHeapMB = Math.round(afterGC.heapUsed / 1024 / 1024);
        logger.info(`Memory guard: GC completed, heap reduced from ${heapUsedMB}MB to ${afterHeapMB}MB`);
      }
    }
  }, 60000); // 每分钟检查一次
  
  logger.info('Memory guard started');
}

function stopMemoryGuard(): void {
  if (memoryGuardTimer) {
    clearInterval(memoryGuardTimer);
    memoryGuardTimer = null;
  }
}

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // 对于数据库连接超时类错误，不要立即退出，让连接池自我恢复
  if (error.message && error.message.includes('ConnectionAcquireTimeout')) {
    logger.warn('Database connection pool timeout detected, allowing pool recovery...');
    return; // 不退出进程，让连接池自行恢复
  }
  // 其他严重错误仍然退出
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 对于数据库连接超时类错误，不要立即退出
  if (reason?.message && reason.message.includes('ConnectionAcquireTimeout')) {
    logger.warn('Database connection pool timeout in unhandled rejection, allowing pool recovery...');
    return;
  }
  // 其他严重错误仍然退出
  process.exit(1);
});

export { app, io, socketService, realtimeService, notificationService, websocketOptimizer };

if (require.main === module) {
  startServer();
}