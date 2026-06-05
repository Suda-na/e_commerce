/**
 * 环境配置文件
 * 从环境变量读取基础配置
 */

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'auction_db',
    dialect: 'mysql' as const,
    logging: process.env.NODE_ENV === 'development',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      min: parseInt(process.env.DB_POOL_MIN || '5', 10),
      acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
      idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
    },
  },

  // Redis配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : 'http://localhost:3000',
  },

  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    file: process.env.LOG_FILE || 'logs/combined.log',
  },

  // AI服务配置
  ai: {
    apiKey: process.env.ARK_API_KEY || '',
    apiUrl: process.env.ARK_API_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    model: process.env.ARK_MODEL || 'doubao-1-5-pro-32k-250115',
    endpointId: process.env.ARK_ENDPOINT_ID || '',
    rateLimit: {
      windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000', 10),
      maxRequests: parseInt(process.env.AI_RATE_LIMIT_MAX || '10', 10),
    },
    retry: {
      maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.AI_RETRY_DELAY || '1000', 10),
    },
    cache: {
      enabled: process.env.AI_CACHE_ENABLED === 'true',
      ttl: parseInt(process.env.AI_CACHE_TTL || '300000', 10),
    },
  },

  // Socket配置
  socket: {
    heartbeatInterval: parseInt(process.env.SOCKET_HEARTBEAT_INTERVAL || '30000', 10),
    heartbeatTimeout: parseInt(process.env.SOCKET_HEARTBEAT_TIMEOUT || '20000', 10),
  },

  // 竞拍配置
  auction: {
    defaultDuration: parseInt(process.env.AUCTION_DEFAULT_DURATION || '300', 10),
    defaultDelay: parseInt(process.env.AUCTION_DEFAULT_DELAY || '10', 10),
    maxDelay: parseInt(process.env.AUCTION_MAX_DELAY || '30', 10),
  },

  // 速率限制配置
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
};

/**
 * 验证基础配置
 */
export const validateConfig = (): void => {
  const errors: string[] = [];

  if (!config.database.host) {
    errors.push('数据库主机地址未配置');
  }
  if (!config.database.database) {
    errors.push('数据库名称未配置');
  }
  if (!config.jwt.secret || config.jwt.secret === 'default_jwt_secret') {
    if (config.nodeEnv === 'production') {
      errors.push('生产环境必须配置JWT_SECRET');
    }
  }

  if (errors.length > 0) {
    throw new Error(`基础配置验证失败:\n${errors.join('\n')}`);
  }
};

export default config;
