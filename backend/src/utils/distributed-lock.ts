import { redisClient } from '../config/redis';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * 分布式锁工具类
 * 使用Redis实现分布式锁，防止并发出价冲突
 */
export class DistributedLock {
  private readonly redis: typeof redisClient;
  private readonly lockPrefix = 'lock:';
  private readonly defaultTimeout = 30000; // 30秒超时
  private readonly retryDelay = 100; // 重试延迟100ms
  private readonly maxRetries = 30; // 最大重试次数

  constructor(redis: typeof redisClient) {
    this.redis = redis;
  }

  /**
   * 获取分布式锁
   * @param lockKey 锁的键
   * @param timeout 锁超时时间（毫秒）
   * @param requestId 请求ID（用于释放锁）
   * @returns 是否获取成功
   */
  async acquireLock(lockKey: string, timeout: number = this.defaultTimeout, requestId?: string): Promise<string | null> {
    const id = requestId || uuidv4();
    const key = `${this.lockPrefix}${lockKey}`;
    const ttl = Math.ceil(timeout / 1000); // 转换为秒

    try {
      // 使用SET NX EX实现原子性加锁
      const result = await this.redis.set(key, id, 'EX', ttl, 'NX');
      
      if (result === 'OK') {
        logger.debug(`Lock acquired: ${key} by ${id}`);
        return id;
      }

      logger.debug(`Lock failed: ${key} already locked`);
      return null;
    } catch (error) {
      logger.error('Acquire lock failed:', error);
      return null;
    }
  }

  /**
   * 释放分布式锁
   * @param lockKey 锁的键
   * @param requestId 请求ID（用于验证锁的持有者）
   * @returns 是否释放成功
   */
  async releaseLock(lockKey: string, requestId: string): Promise<boolean> {
    const key = `${this.lockPrefix}${lockKey}`;

    try {
      // 使用Lua脚本确保原子性：只有持有者才能释放锁
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, key, requestId);
      
      if (result === 1) {
        logger.debug(`Lock released: ${key} by ${requestId}`);
        return true;
      }

      logger.debug(`Lock release failed: ${key} not owned by ${requestId}`);
      return false;
    } catch (error) {
      logger.error('Release lock failed:', error);
      return false;
    }
  }

  /**
   * 带重试的加锁
   * @param lockKey 锁的键
   * @param timeout 锁超时时间（毫秒）
   * @param maxRetries 最大重试次数
   * @param retryDelay 重试延迟（毫秒）
   * @returns 请求ID或null
   */
  async acquireLockWithRetry(
    lockKey: string,
    timeout: number = this.defaultTimeout,
    maxRetries: number = this.maxRetries,
    retryDelay: number = this.retryDelay
  ): Promise<string | null> {
    let retries = 0;

    while (retries < maxRetries) {
      const requestId = await this.acquireLock(lockKey, timeout);
      
      if (requestId) {
        return requestId;
      }

      retries++;
      
      if (retries < maxRetries) {
        // 指数退避策略
        const delay = Math.min(retryDelay * Math.pow(2, retries - 1), 1000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.warn(`Lock acquisition failed after ${maxRetries} retries: ${lockKey}`);
    return null;
  }

  /**
   * 检查锁是否存在
   * @param lockKey 锁的键
   * @returns 是否存在
   */
  async isLocked(lockKey: string): Promise<boolean> {
    const key = `${this.lockPrefix}${lockKey}`;
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * 延长锁的过期时间
   * @param lockKey 锁的键
   * @param requestId 请求ID
   * @param ttl 新的过期时间（秒）
   * @returns 是否延长成功
   */
  async extendLock(lockKey: string, requestId: string, ttl: number): Promise<boolean> {
    const key = `${this.lockPrefix}${lockKey}`;

    try {
      // 使用Lua脚本确保原子性：只有持有者才能延长锁
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("EXPIRE", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, key, requestId, ttl);
      
      if (result === 1) {
        logger.debug(`Lock extended: ${key} by ${requestId} for ${ttl}s`);
        return true;
      }

      logger.debug(`Lock extend failed: ${key} not owned by ${requestId}`);
      return false;
    } catch (error) {
      logger.error('Extend lock failed:', error);
      return false;
    }
  }

  /**
   * 获取锁的剩余过期时间
   * @param lockKey 锁的键
   * @returns 剩余过期时间（秒），-1表示无过期时间，-2表示键不存在
   */
  async getLockTTL(lockKey: string): Promise<number> {
    const key = `${this.lockPrefix}${lockKey}`;
    return await this.redis.ttl(key);
  }
}

// 创建分布式锁实例
export const distributedLock = new DistributedLock(redisClient);

/**
 * 分布式锁装饰器
 * 用于自动加锁和释放锁
 */
export function withLock(lockKey: string, timeout?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const requestId = await distributedLock.acquireLockWithRetry(lockKey, timeout);
      
      if (!requestId) {
        throw new Error('获取分布式锁失败');
      }

      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } finally {
        await distributedLock.releaseLock(lockKey, requestId);
      }
    };

    return descriptor;
  };
}

export default distributedLock;