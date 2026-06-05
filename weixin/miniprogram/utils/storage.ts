/**
 * 本地存储封装工具类
 * 
 * 功能特性：
 * 1. 类型安全的存取操作
 * 2. 支持过期时间
 * 3. 常量键名管理
 * 4. 批量操作
 * 5. 异步版本支持
 * 6. 存储空间管理
 */

// ==================== 存储键名常量 ====================

/** 存储键名常量 */
export const STORAGE_KEYS = {
  // 认证相关
  TOKEN: 'auth_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER_INFO: 'user_info',
  LOGIN_STATUS: 'login_status',

  // 用户偏好
  THEME: 'app_theme',
  LANGUAGE: 'app_language',
  FONT_SIZE: 'app_font_size',

  // 业务数据
  AUCTION_HISTORY: 'auction_history',
  BID_HISTORY: 'bid_history',
  SEARCH_HISTORY: 'search_history',
  BROWSE_HISTORY: 'browse_history',
  FAVORITES: 'favorites',
  SESSION_ID: 'page_view_session_id',

  // 缓存数据
  HOME_CACHE: 'home_cache',
  CATEGORY_CACHE: 'category_cache',

  // 临时数据
  DRAFT_BID: 'draft_bid',
  DRAFT_COMMENT: 'draft_comment',

  // 配置数据
  APP_CONFIG: 'app_config',
  LAST_UPDATE_CHECK: 'last_update_check',
} as const;

/** 存储键名类型 */
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

// ==================== 类型定义 ====================

/** 存储数据包装 */
interface StorageWrapper<T> {
  value: T;
  timestamp: number;
  expire: number; // 0 表示永不过期
}

/** 存储信息 */
export interface StorageInfo {
  keys: string[];
  currentSize: number; // KB
  limitSize: number;   // KB
}

/** 过期时间预设 */
export const EXPIRE_TIME = {
  /** 5分钟 */
  FIVE_MINUTES: 5 * 60 * 1000,
  /** 30分钟 */
  THIRTY_MINUTES: 30 * 60 * 1000,
  /** 1小时 */
  ONE_HOUR: 60 * 60 * 1000,
  /** 1天 */
  ONE_DAY: 24 * 60 * 60 * 1000,
  /** 7天 */
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  /** 30天 */
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
  /** 永不过期 */
  NEVER: 0,
} as const;

// ==================== Storage 类 ====================

class Storage {
  private static instance: Storage | null = null;

  /** 日志前缀 */
  private readonly LOG_PREFIX = '[Storage]';

  private constructor() {}

  /** 获取单例实例 */
  static getInstance(): Storage {
    if (!Storage.instance) {
      Storage.instance = new Storage();
    }
    return Storage.instance;
  }

  // ==================== 同步方法 ====================

  /**
   * 设置存储
   * @param key 存储键名
   * @param value 存储值
   * @param expire 过期时间（毫秒），0 表示永不过期
   */
  set<T>(key: string, value: T, expire: number = EXPIRE_TIME.NEVER): void {
    try {
      const wrapper: StorageWrapper<T> = {
        value,
        timestamp: Date.now(),
        expire: expire > 0 ? Date.now() + expire : 0,
      };
      wx.setStorageSync(key, JSON.stringify(wrapper));
      this.log(`SET: ${key}`);
    } catch (e) {
      this.error(`SET 失败: ${key}`, e);
    }
  }

  /**
   * 获取存储
   * @param key 存储键名
   * @param defaultValue 默认值
   * @returns 存储值或默认值
   */
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const json = wx.getStorageSync(key);
      if (!json) return defaultValue ?? null;

      const wrapper: StorageWrapper<T> = JSON.parse(json);

      // 检查是否过期
      if (wrapper.expire && wrapper.expire < Date.now()) {
        this.log(`EXPIRED: ${key}`);
        this.remove(key);
        return defaultValue ?? null;
      }

      return wrapper.value;
    } catch (e) {
      this.error(`GET 失败: ${key}`, e);
      return defaultValue ?? null;
    }
  }

  /**
   * 删除存储
   * @param key 存储键名
   */
  remove(key: string): void {
    try {
      wx.removeStorageSync(key);
      this.log(`REMOVE: ${key}`);
    } catch (e) {
      this.error(`REMOVE 失败: ${key}`, e);
    }
  }

  /**
   * 清空所有存储
   * @param excludeKeys 排除的键名
   */
  clear(excludeKeys?: string[]): void {
    try {
      if (excludeKeys && excludeKeys.length > 0) {
        // 保存需要排除的数据
        const backup: Record<string, any> = {};
        excludeKeys.forEach(key => {
          const value = this.get(key);
          if (value !== null) {
            backup[key] = value;
          }
        });

        // 清空存储
        wx.clearStorageSync();

        // 恢复排除的数据
        Object.entries(backup).forEach(([key, value]) => {
          this.set(key, value);
        });
      } else {
        wx.clearStorageSync();
      }
      this.log('CLEAR: 已清空存储');
    } catch (e) {
      this.error('CLEAR 失败', e);
    }
  }

  /**
   * 检查键是否存在
   * @param key 存储键名
   * @returns 是否存在
   */
  has(key: string): boolean {
    try {
      const value = wx.getStorageSync(key);
      return !!value;
    } catch (e) {
      return false;
    }
  }

  /**
   * 获取存储信息
   * @returns 存储信息
   */
  getInfo(): StorageInfo | null {
    try {
      const info = wx.getStorageInfoSync();
      return {
        keys: info.keys,
        currentSize: info.currentSize,
        limitSize: info.limitSize,
      };
    } catch (e) {
      this.error('获取存储信息失败', e);
      return null;
    }
  }

  /**
   * 获取剩余存储空间（KB）
   * @returns 剩余空间
   */
  getRemainingSize(): number {
    const info = this.getInfo();
    if (!info) return 0;
    return info.limitSize - info.currentSize;
  }

  // ==================== 批量操作 ====================

  /**
   * 批量设置
   * @param items 键值对数组
   * @param expire 过期时间
   */
  setBatch<T>(items: Array<{ key: string; value: T }>, expire?: number): void {
    items.forEach(item => {
      this.set(item.key, item.value, expire);
    });
  }

  /**
   * 批量获取
   * @param keys 键名数组
   * @returns 键值对
   */
  getBatch<T>(keys: string[]): Record<string, T | null> {
    const result: Record<string, T | null> = {};
    keys.forEach(key => {
      result[key] = this.get<T>(key);
    });
    return result;
  }

  /**
   * 批量删除
   * @param keys 键名数组
   */
  removeBatch(keys: string[]): void {
    keys.forEach(key => {
      this.remove(key);
    });
  }

  // ==================== 异步方法 ====================

  /**
   * 异步设置存储
   */
  setAsync<T>(key: string, value: T, expire?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const wrapper: StorageWrapper<T> = {
        value,
        timestamp: Date.now(),
        expire: expire && expire > 0 ? Date.now() + expire : 0,
      };

      wx.setStorage({
        key,
        data: JSON.stringify(wrapper),
        success: () => {
          this.log(`SET_ASYNC: ${key}`);
          resolve();
        },
        fail: (err) => {
          this.error(`SET_ASYNC 失败: ${key}`, err);
          reject(err);
        },
      });
    });
  }

  /**
   * 异步获取存储
   */
  getAsync<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      wx.getStorage({
        key,
        success: (res) => {
          try {
            const wrapper: StorageWrapper<T> = JSON.parse(res.data);

            // 检查是否过期
            if (wrapper.expire && wrapper.expire < Date.now()) {
              this.remove(key);
              resolve(null);
              return;
            }

            resolve(wrapper.value);
          } catch (e) {
            resolve(null);
          }
        },
        fail: (err) => {
          // key 不存在时返回 null
          if (err.errMsg && err.errMsg.includes('data not found')) {
            resolve(null);
          } else {
            this.error(`GET_ASYNC 失败: ${key}`, err);
            reject(err);
          }
        },
      });
    });
  }

  /**
   * 异步删除存储
   */
  removeAsync(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.removeStorage({
        key,
        success: () => {
          this.log(`REMOVE_ASYNC: ${key}`);
          resolve();
        },
        fail: (err) => {
          this.error(`REMOVE_ASYNC 失败: ${key}`, err);
          reject(err);
        },
      });
    });
  }

  // ==================== 便捷方法 ====================

  /**
   * 获取或设置（如果不存在则设置默认值）
   * @param key 存储键名
   * @param defaultValue 默认值
   * @param expire 过期时间
   * @returns 存储值
   */
  getOrSet<T>(key: string, defaultValue: T, expire?: number): T {
    let value = this.get<T>(key);
    if (value === null) {
      this.set(key, defaultValue, expire);
      value = defaultValue;
    }
    return value;
  }

  /**
   * 追加到数组
   * @param key 存储键名
   * @param item 追加的项
   * @param maxLength 最大长度（超出则删除最早的数据）
   */
  appendToArray<T>(key: string, item: T, maxLength?: number): void {
    const arr = this.get<T[]>(key) || [];
    arr.unshift(item); // 添加到开头

    if (maxLength && arr.length > maxLength) {
      arr.length = maxLength; // 截断
    }

    this.set(key, arr);
  }

  /**
   * 从数组中移除
   * @param key 存储键名
   * @param predicate 过滤函数
   */
  removeFromArray<T>(key: string, predicate: (item: T) => boolean): void {
    const arr = this.get<T[]>(key) || [];
    const filtered = arr.filter(item => !predicate(item));
    this.set(key, filtered);
  }

  /**
   * 更新对象
   * @param key 存储键名
   * @param partial 部分更新数据
   */
  updateObject<T extends Record<string, any>>(key: string, partial: Partial<T>): void {
    const obj = this.get<T>(key) || {} as T;
    const updated = { ...obj, ...partial };
    this.set(key, updated);
  }

  // ==================== 搜索历史专用 ====================

  /** 获取搜索历史 */
  getSearchHistory(): string[] {
    return this.get<string[]>(STORAGE_KEYS.SEARCH_HISTORY) || [];
  }

  /** 添加搜索历史 */
  addSearchHistory(keyword: string, maxLength?: number): void {
    const l = maxLength || 20;
    this.appendToArray(STORAGE_KEYS.SEARCH_HISTORY, keyword, l);
  }

  /** 删除搜索历史 */
  removeSearchHistory(keyword: string): void {
    this.removeFromArray(STORAGE_KEYS.SEARCH_HISTORY, item => item === keyword);
  }

  /** 清空搜索历史 */
  clearSearchHistory(): void {
    this.set(STORAGE_KEYS.SEARCH_HISTORY, []);
  }

  // ==================== 日志方法 ====================

  private log(message: string): void {
    if (__wxConfig.envVersion === 'develop') {
      console.log(`${this.LOG_PREFIX} ${message}`);
    }
  }

  private error(message: string, error?: any): void {
    console.error(`${this.LOG_PREFIX} ${message}`, error);
  }
}

// ==================== 导出 ====================

/** 导出 Storage 单例 */
export const storage = Storage.getInstance();

/**
 * 获取或创建会话ID
 * 用于数据采集，区分不同用户会话
 */
export function getSessionId(): string {
  let sessionId = storage.get<string>(STORAGE_KEYS.SESSION_ID);
  
  if (!sessionId) {
    sessionId = generateUUID();
    storage.set(STORAGE_KEYS.SESSION_ID, sessionId, EXPIRE_TIME.ONE_MONTH);
  }
  
  return sessionId;
}

/**
 * 生成UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 默认导出 */
export default storage;
