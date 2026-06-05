/**
 * 微信小程序缓存策略工具
 * 
 * 功能：
 * 1. 内存缓存 - 快速访问，页面刷新后丢失
 * 2. Storage 持久化缓存 - 跨页面、跨会话保留
 * 3. 带过期时间的缓存
 * 4. 缓存命名空间隔离
 * 5. LRU 淘汰策略
 */

// ==================== 类型定义 ====================

interface CacheItem<T = any> {
  value: T
  timestamp: number
  expireTime?: number // 过期时间戳，undefined 表示永不过期
}

interface CacheOptions {
  /** 缓存命名空间，用于隔离不同模块的缓存 */
  namespace?: string
  /** 最大缓存数量 */
  maxSize?: number
  /** 默认过期时间（毫秒），0 表示永不过期 */
  defaultTTL?: number
  /** 是否持久化到 Storage */
  persistent?: boolean
}

// ==================== 默认配置 ====================

const DEFAULT_OPTIONS: CacheOptions = {
  namespace: 'default',
  maxSize: 100,
  defaultTTL: 0,
  persistent: false
}

// ==================== 缓存管理器 ====================

class CacheManager {
  private memoryCache: Map<string, CacheItem> = new Map()
  private options: CacheOptions

  constructor(options: CacheOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * 获取缓存键的完整名称（带命名空间）
   */
  private getFullKey(key: string): string {
    return `cache_${this.options.namespace}_${key}`
  }

  /**
   * 获取缓存值
   * @param key 缓存键
   * @returns 缓存值，如果不存在或已过期则返回 undefined
   */
  get<T = any>(key: string): T | undefined {
    const fullKey = this.getFullKey(key)

    // 先从内存缓存获取
    let item = this.memoryCache.get(fullKey)

    // 如果内存缓存没有，尝试从 Storage 获取
    if (!item && this.options.persistent) {
      try {
        const storageData = wx.getStorageSync(fullKey)
        if (storageData) {
          item = storageData as CacheItem
          // 恢复到内存缓存
          this.memoryCache.set(fullKey, item)
        }
      } catch (e) {
        console.warn('[Cache] 读取 Storage 失败:', e)
      }
    }

    if (!item) return undefined

    // 检查是否过期
    if (item.expireTime && Date.now() > item.expireTime) {
      this.delete(key)
      return undefined
    }

    return item.value as T
  }

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（毫秒），不传则使用默认值
   */
  set<T = any>(key: string, value: T, ttl?: number): void {
    const fullKey = this.getFullKey(key)
    const effectiveTTL = ttl !== undefined ? ttl : this.options.defaultTTL

    const item: CacheItem<T> = {
      value,
      timestamp: Date.now(),
      expireTime: effectiveTTL > 0 ? Date.now() + effectiveTTL : undefined
    }

    // 检查是否需要淘汰
    if (this.memoryCache.size >= (this.options.maxSize || 100)) {
      this.evict()
    }

    // 更新内存缓存
    this.memoryCache.set(fullKey, item)

    // 如果需要持久化，写入 Storage
    if (this.options.persistent) {
      try {
        wx.setStorageSync(fullKey, item)
      } catch (e) {
        console.warn('[Cache] 写入 Storage 失败:', e)
      }
    }
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  delete(key: string): void {
    const fullKey = this.getFullKey(key)
    this.memoryCache.delete(fullKey)

    if (this.options.persistent) {
      try {
        wx.removeStorageSync(fullKey)
      } catch (e) {
        console.warn('[Cache] 删除 Storage 失败:', e)
      }
    }
  }

  /**
   * 检查缓存是否存在且未过期
   * @param key 缓存键
   */
  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  /**
   * 清空当前命名空间的所有缓存
   */
  clear(): void {
    const prefix = `cache_${this.options.namespace}_`

    // 清空内存缓存
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key)
      }
    }

    // 清空 Storage 缓存
    if (this.options.persistent) {
      try {
        const res = wx.getStorageInfoSync()
        for (const key of res.keys) {
          if (key.startsWith(prefix)) {
            wx.removeStorageSync(key)
          }
        }
      } catch (e) {
        console.warn('[Cache] 清空 Storage 失败:', e)
      }
    }
  }

  /**
   * LRU 淘汰策略 - 删除最久未使用的缓存
   */
  private evict(): void {
    let oldestKey: string | undefined
    let oldestTime = Infinity

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey)
      if (this.options.persistent) {
        try {
          wx.removeStorageSync(oldestKey)
        } catch (e) {
          // ignore
        }
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; maxSize: number; namespace: string } {
    return {
      size: this.memoryCache.size,
      maxSize: this.options.maxSize || 100,
      namespace: this.options.namespace || 'default'
    }
  }
}

// ==================== 预定义缓存实例 ====================

/** 用户信息缓存（持久化，5分钟过期） */
export const userCache = new CacheManager({
  namespace: 'user',
  maxSize: 20,
  defaultTTL: 5 * 60 * 1000,
  persistent: true
})

/** 商家列表缓存（持久化，10分钟过期） */
export const merchantCache = new CacheManager({
  namespace: 'merchant',
  maxSize: 50,
  defaultTTL: 10 * 60 * 1000,
  persistent: true
})

/** 竞拍数据缓存（内存，2分钟过期） */
export const auctionCache = new CacheManager({
  namespace: 'auction',
  maxSize: 100,
  defaultTTL: 2 * 60 * 1000,
  persistent: false
})

/** 订单数据缓存（持久化，3分钟过期） */
export const orderCache = new CacheManager({
  namespace: 'order',
  maxSize: 50,
  defaultTTL: 3 * 60 * 1000,
  persistent: true
})

/** 搜索结果缓存（内存，1分钟过期） */
export const searchCache = new CacheManager({
  namespace: 'search',
  maxSize: 30,
  defaultTTL: 60 * 1000,
  persistent: false
})

// ==================== 缓存装饰器/工具函数 ====================

/**
 * 带缓存的异步函数包装器
 * 如果缓存中有数据则直接返回，否则执行函数并缓存结果
 * 
 * @param cache 缓存管理器实例
 * @param key 缓存键
 * @param fn 异步函数
 * @param ttl 过期时间（毫秒）
 * @returns 函数执行结果
 * 
 * @example
 * const merchants = await cached(merchantCache, 'all', () => authService.getMerchants(), 5 * 60 * 1000)
 */
export async function cached<T>(
  cache: CacheManager,
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 尝试从缓存获取
  const cachedValue = cache.get<T>(key)
  if (cachedValue !== undefined) {
    return cachedValue
  }

  // 执行函数
  const result = await fn()

  // 缓存结果
  cache.set(key, result, ttl)

  return result
}

/**
 * 清除所有缓存
 */
export function clearAllCaches(): void {
  userCache.clear()
  merchantCache.clear()
  auctionCache.clear()
  orderCache.clear()
  searchCache.clear()
}

/**
 * 获取所有缓存统计信息
 */
export function getAllCacheStats(): Record<string, { size: number; maxSize: number }> {
  return {
    user: userCache.getStats(),
    merchant: merchantCache.getStats(),
    auction: auctionCache.getStats(),
    order: orderCache.getStats(),
    search: searchCache.getStats()
  }
}

// ==================== 导出 ====================

export { CacheManager }
export type { CacheItem, CacheOptions }

export default {
  userCache,
  merchantCache,
  auctionCache,
  orderCache,
  searchCache,
  cached,
  clearAllCaches,
  getAllCacheStats
}
