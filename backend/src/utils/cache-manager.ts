import { redisClient, redisUtils } from '../config/redis';
import { performanceConfig } from '../config/performance.config';
import { logger } from './logger';

/**
 * 多级缓存管理器
 * 实现本地LRU缓存 + Redis缓存的分层策略
 * 支持缓存预热、防击穿、防雪崩、防穿透
 */

// 本地LRU缓存节点
interface CacheNode<T> {
  key: string;
  value: T;
  expireAt: number;
  lastAccess: number;
  accessCount: number;
}

// 缓存统计信息
interface CacheStats {
  localHits: number;
  localMisses: number;
  redisHits: number;
  redisMisses: number;
  totalRequests: number;
  avgLatency: number;
}

/**
 * 本地LRU缓存
 */
class LocalLRUCache {
  private cache: Map<string, CacheNode<any>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private readonly checkInterval: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    const config = performanceConfig.cache.local;
    this.maxSize = config.maxSize;
    this.defaultTTL = config.ttl;
    // 增加清理间隔到5分钟（减少CPU开销）
    this.checkInterval = Math.max(config.checkInterval, 300) * 1000;
    this.startCleanup();
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const node = this.cache.get(key);
    
    if (!node) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > node.expireAt) {
      this.cache.delete(key);
      return null;
    }

    // 更新访问信息
    node.lastAccess = Date.now();
    node.accessCount++;

    // 移动到最新位置（LRU）
    this.cache.delete(key);
    this.cache.set(key, node);

    return node.value as T;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // 如果达到最大容量，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const now = Date.now();
    const node: CacheNode<T> = {
      key,
      value,
      expireAt: now + (ttl || this.defaultTTL) * 1000,
      lastAccess: now,
      accessCount: 0,
    };

    this.cache.set(key, node);
  }

  /**
   * 删除缓存
   */
  del(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 启动清理定时器
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.checkInterval);
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, node] of this.cache.entries()) {
      if (now > node.expireAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Local cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * 停止清理定时器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

/**
 * 多级缓存管理器类
 */
export class CacheManager {
  private localCache: LocalLRUCache;
  private stats: CacheStats;
  private readonly keyPrefix: string;

  constructor() {
    this.localCache = new LocalLRUCache();
    this.keyPrefix = performanceConfig.cache.redis.keyPrefix;
    this.stats = {
      localHits: 0,
      localMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      totalRequests: 0,
      avgLatency: 0,
    };
  }

  /**
   * 获取缓存（多级策略）
   * @param key 缓存键
   * @param fetchFn 数据获取函数（缓存未命中时调用）
   * @param options 缓存选项
   */
  async get<T>(
    key: string,
    fetchFn?: () => Promise<T>,
    options?: {
      localTTL?: number;
      redisTTL?: number;
      strategy?: keyof typeof performanceConfig.cache.redis.strategies;
      skipLocal?: boolean;
      skipRedis?: boolean;
    }
  ): Promise<T | null> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    const fullKey = this.keyPrefix + key;
    const strategy = options?.strategy ? performanceConfig.cache.redis.strategies[options.strategy] : null;
    const localTTL = options?.localTTL || (strategy ? strategy.ttl / 2 : performanceConfig.cache.local.ttl);
    const redisTTL = options?.redisTTL || (strategy ? strategy.ttl : performanceConfig.cache.redis.defaultTTL);

    try {
      // 1. 先查本地缓存
      if (!options?.skipLocal) {
        const localValue = this.localCache.get<T>(fullKey);
        if (localValue !== null) {
          this.stats.localHits++;
          this.updateLatency(startTime);
          return localValue;
        }
        this.stats.localMisses++;
      }

      // 2. 查Redis缓存
      if (!options?.skipRedis) {
        const redisValue = await redisUtils.get(fullKey);
        if (redisValue !== null) {
          this.stats.redisHits++;
          
          // 反序列化
          const parsed = JSON.parse(redisValue) as T;
          
          // 回填本地缓存
          if (!options?.skipLocal) {
            this.localCache.set(fullKey, parsed, localTTL);
          }
          
          this.updateLatency(startTime);
          return parsed;
        }
        this.stats.redisMisses++;
      }

      // 3. 缓存未命中，使用fetchFn获取数据
      if (fetchFn) {
        return await this.fetchAndCache(key, fetchFn, { localTTL, redisTTL });
      }

      this.updateLatency(startTime);
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      
      // 缓存出错时，尝试直接获取数据
      if (fetchFn) {
        return await fetchFn();
      }
      return null;
    }
  }

  /**
   * 获取数据并缓存（带防击穿保护）
   */
  private async fetchAndCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: { localTTL: number; redisTTL: number }
  ): Promise<T> {
    const protection = performanceConfig.cache.protection.breakdown;
    const fullKey = this.keyPrefix + key;

    // 如果启用了防击穿保护，使用分布式锁
    if (protection.enabled) {
      const lockKey = `cache:lock:${key}`;
      const lockId = await this.acquireLock(lockKey, protection.lockTimeout * 1000);

      if (lockId) {
        try {
          // 双重检查：获取锁后再次检查缓存
          const cachedValue = await redisUtils.get(fullKey);
          if (cachedValue !== null) {
            const parsed = JSON.parse(cachedValue) as T;
            this.localCache.set(fullKey, parsed, options.localTTL);
            return parsed;
          }

          // 获取数据
          const data = await fetchFn();
          
          // 写入缓存
          await this.setCache(key, data, options);
          
          return data;
        } finally {
          await this.releaseLock(lockKey, lockId);
        }
      }
    }

    // 没有启用防击穿或获取锁失败，直接获取数据
    const data = await fetchFn();
    await this.setCache(key, data, options);
    return data;
  }

  /**
   * 设置缓存（多级）
   */
  async set<T>(
    key: string,
    value: T,
    options?: {
      localTTL?: number;
      redisTTL?: number;
      strategy?: keyof typeof performanceConfig.cache.redis.strategies;
      skipLocal?: boolean;
      skipRedis?: boolean;
    }
  ): Promise<void> {
    const fullKey = this.keyPrefix + key;
    const strategy = options?.strategy ? performanceConfig.cache.redis.strategies[options.strategy] : null;
    const localTTL = options?.localTTL || (strategy ? strategy.ttl / 2 : performanceConfig.cache.local.ttl);
    const redisTTL = options?.redisTTL || (strategy ? strategy.ttl : performanceConfig.cache.redis.defaultTTL);

    await this.setCache(key, value, { localTTL, redisTTL, ...options });
  }

  /**
   * 内部设置缓存方法
   */
  private async setCache<T>(
    key: string,
    value: T,
    options: { localTTL: number; redisTTL: number; skipLocal?: boolean; skipRedis?: boolean }
  ): Promise<void> {
    const fullKey = this.keyPrefix + key;

    try {
      // 防雪崩：添加TTL随机抖动
      const jitter = performanceConfig.cache.protection.avalanche.enabled
        ? Math.floor(Math.random() * performanceConfig.cache.protection.avalanche.jitterRange)
        : 0;
      const finalRedisTTL = options.redisTTL + jitter;

      // 序列化
      const serialized = JSON.stringify(value);

      // 写入Redis
      if (!options.skipRedis) {
        await redisUtils.set(fullKey, serialized, finalRedisTTL);
      }

      // 写入本地缓存
      if (!options.skipLocal) {
        this.localCache.set(fullKey, value, options.localTTL);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * 删除缓存（多级）
   */
  async del(key: string): Promise<void> {
    const fullKey = this.keyPrefix + key;

    try {
      // 删除Redis缓存
      await redisUtils.del(fullKey);
      
      // 删除本地缓存
      this.localCache.del(fullKey);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * 获取或设置缓存（简化版API）
   * 缓存未命中时自动调用 fetcher 获取数据并写入缓存
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: {
      ttl?: number;
      strategy?: keyof typeof performanceConfig.cache.redis.strategies;
      skipLocal?: boolean;
    }
  ): Promise<T> {
    const strategy = options?.strategy ? performanceConfig.cache.redis.strategies[options.strategy] : null;
    const redisTTL = options?.ttl || (strategy ? strategy.ttl : performanceConfig.cache.redis.defaultTTL);
    const localTTL = Math.floor(redisTTL / 2);

    const result = await this.get<T>(key, fetcher, {
      localTTL,
      redisTTL,
      strategy: options?.strategy,
      skipLocal: options?.skipLocal,
    });

    if (result === null) {
      return await fetcher();
    }
    return result;
  }

  /**
   * 按标签批量失效缓存
   * 使用 Redis Set 维护标签与键的映射关系
   */
  async invalidateByTag(tag: string): Promise<void> {
    try {
      const tagKey = `${this.keyPrefix}tag:${tag}`;
      const keys = await redisUtils.smembers(tagKey);

      if (keys.length > 0) {
        const fullKeys = keys.map(k => this.keyPrefix + k);
        await redisUtils.del(...fullKeys);

        for (const k of keys) {
          this.localCache.del(this.keyPrefix + k);
        }

        await redisUtils.del(tagKey);
        logger.debug(`Invalidated ${keys.length} cache entries for tag: ${tag}`);
      }
    } catch (error) {
      logger.error(`Cache invalidateByTag error for tag ${tag}:`, error);
    }
  }

  /**
   * 为缓存键注册标签（用于后续按标签批量失效）
   */
  async addKeyToTag(key: string, tag: string): Promise<void> {
    try {
      const tagKey = `${this.keyPrefix}tag:${tag}`;
      await redisUtils.sadd(tagKey, key);
      await redisUtils.expire(tagKey, 86400);
    } catch (error) {
      logger.error(`Cache addKeyToTag error for key ${key}, tag ${tag}:`, error);
    }
  }

  /**
   * 批量删除缓存（按模式）
   */
  async delPattern(pattern: string): Promise<void> {
    const fullPattern = this.keyPrefix + pattern;

    try {
      // 删除Redis缓存
      const keys = await redisUtils.keys(fullPattern);
      if (keys.length > 0) {
        await redisUtils.del(...keys);
      }

      // 注意：本地缓存不支持模式删除，需要重建
      logger.debug(`Deleted ${keys.length} cache entries matching pattern: ${pattern}`);
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  /**
   * 缓存预热
   * @param items 需要预热的数据项
   */
  async preload<T>(
    items: Array<{
      key: string;
      fetchFn: () => Promise<T>;
      strategy?: keyof typeof performanceConfig.cache.redis.strategies;
    }>
  ): Promise<void> {
    const config = performanceConfig.cache.protection.avalanche;
    if (!config.preloadEnabled) {
      return;
    }

    logger.info(`Starting cache preload for ${items.length} items`);

    // 分批处理
    const batchSize = config.preloadBatchSize;
    let loaded = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (item) => {
          try {
            const data = await item.fetchFn();
            await this.set(item.key, data, { strategy: item.strategy });
            loaded++;
          } catch (error) {
            logger.error(`Cache preload error for key ${item.key}:`, error);
          }
        })
      );

      // 避免阻塞事件循环
      if (i + batchSize < items.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    logger.info(`Cache preload completed: ${loaded}/${items.length} items loaded`);
  }

  /**
   * 防穿透：缓存空值
   */
  async cacheNull(key: string, ttl?: number): Promise<void> {
    const nullTTL = ttl || performanceConfig.cache.protection.penetration.nullCacheTTL;
    const fullKey = this.keyPrefix + key;

    // 使用特殊标记表示空值
    await redisUtils.set(fullKey, '__NULL__', nullTTL);
    this.localCache.set(fullKey, null, nullTTL);
  }

  /**
   * 检查是否为空值缓存
   */
  async isNullCached(key: string): Promise<boolean> {
    const fullKey = this.keyPrefix + key;
    const value = await redisUtils.get(fullKey);
    return value === '__NULL__';
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats & { localSize: number } {
    return {
      ...this.stats,
      localSize: this.localCache.size(),
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      localHits: 0,
      localMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      totalRequests: 0,
      avgLatency: 0,
    };
  }

  /**
   * 获取缓存命中率
   */
  getHitRate(): { local: number; redis: number; overall: number } {
    const total = this.stats.totalRequests;
    if (total === 0) {
      return { local: 0, redis: 0, overall: 0 };
    }

    const localHitRate = this.stats.localHits / total;
    const redisHitRate = this.stats.redisHits / total;
    const overallHitRate = (this.stats.localHits + this.stats.redisHits) / total;

    return {
      local: Math.round(localHitRate * 100) / 100,
      redis: Math.round(redisHitRate * 100) / 100,
      overall: Math.round(overallHitRate * 100) / 100,
    };
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.localCache.clear();
    // 注意：不建议在生产环境清空所有Redis缓存
    logger.warn('Local cache cleared');
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    this.localCache.destroy();
    logger.info('Cache manager destroyed');
  }

  // ========== 私有辅助方法 ==========

  /**
   * 获取分布式锁
   */
  private async acquireLock(lockKey: string, timeout: number): Promise<string | null> {
    const { distributedLock } = require('./distributed-lock');
    return await distributedLock.acquireLock(lockKey, timeout);
  }

  /**
   * 释放分布式锁
   */
  private async releaseLock(lockKey: string, lockId: string): Promise<void> {
    const { distributedLock } = require('./distributed-lock');
    await distributedLock.releaseLock(lockKey, lockId);
  }

  /**
   * 更新平均延迟
   */
  private updateLatency(startTime: number): void {
    const latency = Date.now() - startTime;
    this.stats.avgLatency = (this.stats.avgLatency * (this.stats.totalRequests - 1) + latency) / this.stats.totalRequests;
  }
}

// 创建全局缓存管理器实例
export const cacheManager = new CacheManager();

// 导出缓存策略快捷方法
export const cache = {
  async getAuction<T>(auctionId: number, fetchFn: () => Promise<T>): Promise<T | null> {
    return cacheManager.get(`auction:${auctionId}`, fetchFn, { strategy: 'auction' });
  },

  async getProduct<T>(productId: number, fetchFn: () => Promise<T>): Promise<T | null> {
    return cacheManager.get(`product:${productId}`, fetchFn, { strategy: 'product' });
  },

  async getProductList<T>(cacheKey: string, fetchFn: () => Promise<T>): Promise<T | null> {
    return cacheManager.get(`productList:${cacheKey}`, fetchFn, { strategy: 'productList' });
  },

  async getUser<T>(userId: number, fetchFn: () => Promise<T>): Promise<T | null> {
    return cacheManager.get(`user:${userId}`, fetchFn, { strategy: 'user' });
  },

  async getLeaderboard<T>(auctionId: number, fetchFn: () => Promise<T>): Promise<T | null> {
    return cacheManager.get(`leaderboard:${auctionId}`, fetchFn, { strategy: 'leaderboard' });
  },

  async getDashboard<T>(merchantId: number | undefined, fetchFn: () => Promise<T>): Promise<T | null> {
    const key = merchantId ? `dashboard:merchant:${merchantId}` : 'dashboard:global';
    return cacheManager.get(key, fetchFn, { strategy: 'dashboard' });
  },

  async invalidateAuction(auctionId: number): Promise<void> {
    await cacheManager.del(`auction:${auctionId}`);
    await cacheManager.delPattern(`leaderboard:${auctionId}*`);
  },

  async invalidateProduct(productId: number, merchantId?: number): Promise<void> {
    await cacheManager.del(`product:${productId}`);
    await cacheManager.invalidateByTag(`product:${productId}`);
    if (merchantId) {
      await cacheManager.invalidateByTag(`merchant:${merchantId}:products`);
    }
    await cacheManager.delPattern('productList:*');
  },

  async invalidateUser(userId: number): Promise<void> {
    await cacheManager.del(`user:${userId}`);
  },

  async invalidateDashboard(merchantId?: number): Promise<void> {
    const key = merchantId ? `dashboard:merchant:${merchantId}` : 'dashboard:global';
    await cacheManager.del(key);
  },
};

export default cacheManager;