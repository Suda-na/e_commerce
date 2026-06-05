import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { RateLimitError } from './errorHandler';

// 通用速率限制器
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    throw new RateLimitError('Too many requests, please try again later');
  },
  skip: (req) => {
    // 开发环境跳过速率限制
    if (config.nodeEnv === 'development') {
      return true;
    }
    // 健康检查跳过速率限制
    if (req.path === '/health') {
      return true;
    }
    return false;
  },
});

// 严格速率限制器（用于敏感操作）
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 每个IP最多5次请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 登录速率限制器
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 每个IP最多10次登录尝试
  message: {
    success: false,
    error: {
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API速率限制器
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 60, // 每个IP每分钟最多60次请求
  message: {
    success: false,
    error: {
      code: 'API_RATE_LIMIT_EXCEEDED',
      message: 'API rate limit exceeded',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// WebSocket速率限制器
export const wsRateLimiter = (socket: any, next: any) => {
  const clientIp = socket.handshake.address;
  const key = `ws_rate_limit:${clientIp}`;
  
  // 这里可以集成Redis进行分布式速率限制
  // 简单实现：使用内存存储
  const now = Date.now();
  const windowMs = 60 * 1000; // 1分钟
  const maxConnections = 10; // 每个IP每分钟最多10次连接
  
  if (!wsRateLimiter.connections) {
    wsRateLimiter.connections = new Map();
  }
  
  const clientData = wsRateLimiter.connections.get(clientIp) || { count: 0, resetTime: now + windowMs };
  
  if (now > clientData.resetTime) {
    clientData.count = 0;
    clientData.resetTime = now + windowMs;
  }
  
  if (clientData.count >= maxConnections) {
    return next(new Error('WebSocket connection rate limit exceeded'));
  }
  
  clientData.count++;
  wsRateLimiter.connections.set(clientIp, clientData);
  
  next();
};

// 静态属性
wsRateLimiter.connections = new Map<string, { count: number; resetTime: number }>();

export default rateLimiter;