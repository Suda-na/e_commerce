import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

// Redis连接配置
const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  retryDelayOnFailover: config.redis.retryDelayOnFailover,
  maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
  lazyConnect: true,
  showFriendlyErrorStack: config.nodeEnv === 'development',
  // 连接重试策略
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
    return delay;
  },
  // 连接超时设置
  connectTimeout: 10000,
  commandTimeout: 5000,
  // 保持连接活跃
  keepAlive: 10000,
  // 自动重连
  autoResubscribe: true,
  autoResendUnfulfilledCommands: true,
};

// 创建Redis客户端
export const redisClient = new Redis(redisConfig);

// Redis连接事件
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (error) => {
  logger.error('Redis client error:', error);
});

redisClient.on('close', () => {
  logger.info('Redis client connection closed');
});

redisClient.on('reconnecting', (delay: number) => {
  logger.info(`Redis client reconnecting in ${delay}ms`);
});

redisClient.on('end', () => {
  logger.info('Redis client connection ended');
});

// 测试Redis连接
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    await redisClient.connect();
    const pong = await redisClient.ping();
    logger.info(`Redis connection test: ${pong}`);
    return true;
  } catch (error) {
    logger.error('Redis connection test failed:', error);
    return false;
  }
};

// 获取Redis连接状态
export const getRedisConnectionStatus = (): string => {
  return redisClient.status;
};

// 检查Redis是否已连接
export const isRedisConnected = (): boolean => {
  return redisClient.status === 'ready';
};

// Redis健康检查
export const redisHealthCheck = async (): Promise<{
  status: string;
  connected: boolean;
  latency: number;
  memory: any;
}> => {
  const start = Date.now();
  try {
    const pong = await redisClient.ping();
    const latency = Date.now() - start;
    
    // 获取Redis信息
    const info = await redisClient.info('memory');
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const memory = memoryMatch ? memoryMatch[1] : 'unknown';
    
    return {
      status: pong === 'PONG' ? 'healthy' : 'unhealthy',
      connected: isRedisConnected(),
      latency,
      memory,
    };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return {
      status: 'unhealthy',
      connected: false,
      latency: Date.now() - start,
      memory: 'unknown',
    };
  }
};

// 关闭Redis连接
export const closeRedis = async (): Promise<void> => {
  try {
    await redisClient.quit();
    logger.info('Redis connection closed.');
  } catch (error) {
    logger.error('Failed to close Redis connection:', error);
    throw error;
  }
};

// Redis工具函数
export const redisUtils = {
  // 设置键值对
  async set(key: string, value: string, expireSeconds?: number): Promise<void> {
    if (expireSeconds) {
      await redisClient.set(key, value, 'EX', expireSeconds);
    } else {
      await redisClient.set(key, value);
    }
  },

  // 获取值
  async get(key: string): Promise<string | null> {
    return await redisClient.get(key);
  },

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await redisClient.del(keys);
  },

  async keys(pattern: string): Promise<string[]> {
    return await redisClient.keys(pattern);
  },

  // 检查键是否存在
  async exists(key: string): Promise<boolean> {
    const result = await redisClient.exists(key);
    return result === 1;
  },

  // 设置过期时间
  async expire(key: string, seconds: number): Promise<void> {
    await redisClient.expire(key, seconds);
  },

  // 获取剩余过期时间
  async ttl(key: string): Promise<number> {
    return await redisClient.ttl(key);
  },

  // 哈希操作
  async hset(key: string, field: string, value: string): Promise<void> {
    await redisClient.hset(key, field, value);
  },

  async hget(key: string, field: string): Promise<string | null> {
    return await redisClient.hget(key, field);
  },

  async hgetall(key: string): Promise<Record<string, string>> {
    return await redisClient.hgetall(key);
  },

  async hdel(key: string, field: string): Promise<void> {
    await redisClient.hdel(key, field);
  },

  // 集合操作
  async sadd(key: string, member: string): Promise<void> {
    await redisClient.sadd(key, member);
  },

  async srem(key: string, member: string): Promise<void> {
    await redisClient.srem(key, member);
  },

  async smembers(key: string): Promise<string[]> {
    return await redisClient.smembers(key);
  },

  async sismember(key: string, member: string): Promise<boolean> {
    const result = await redisClient.sismember(key, member);
    return result === 1;
  },

  async scard(key: string): Promise<number> {
    return await redisClient.scard(key);
  },

  // 有序集合操作
  async zadd(key: string, score: number, member: string): Promise<void> {
    await redisClient.zadd(key, score, member);
  },

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await redisClient.zrange(key, start, stop);
  },

  async zrevrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
    if (withScores) {
      return await redisClient.zrevrange(key, start, stop, 'WITHSCORES');
    }
    return await redisClient.zrevrange(key, start, stop);
  },

  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    return await redisClient.zrangebyscore(key, min, max);
  },

  async zrem(key: string, member: string): Promise<void> {
    await redisClient.zrem(key, member);
  },

  async zscore(key: string, member: string): Promise<string | null> {
    return await redisClient.zscore(key, member);
  },

  async zcard(key: string): Promise<number> {
    return await redisClient.zcard(key);
  },

  // 列表操作
  async lpush(key: string, value: string): Promise<number> {
    return await redisClient.lpush(key, value);
  },

  async rpop(key: string): Promise<string | null> {
    return await redisClient.rpop(key);
  },

  async llen(key: string): Promise<number> {
    return await redisClient.llen(key);
  },

  // 发布订阅
  async publish(channel: string, message: string): Promise<void> {
    await redisClient.publish(channel, message);
  },

  // 管道操作
  pipeline() {
    return redisClient.pipeline();
  },

  // 事务
  multi() {
    return redisClient.multi();
  },
};

export default redisClient;