/**
 * 微信小程序性能优化工具集
 * 
 * 功能：
 * 1. setData 防抖 - 合并短时间内的多次 setData 调用
 * 2. setData 节流 - 限制 setData 调用频率
 * 3. 批量更新 - 收集多个数据变更后一次性更新
 * 4. 路径更新 - 只更新指定路径的数据
 */

// ==================== 防抖 setData ====================

/**
 * 创建防抖 setData 函数
 * 用于合并短时间内的多次 setData 调用，减少渲染次数
 * 
 * @param context Page 或 Component 实例
 * @param delay 防抖延迟（毫秒），默认 16ms（约一帧）
 * @returns 防抖后的 setData 函数
 * 
 * @example
 * // 在 Page/Component 中使用
 * const debouncedSetData = createDebouncedSetData(this, 16)
 * debouncedSetData({ key1: value1 })
 * debouncedSetData({ key2: value2 }) // 只会触发一次 setData
 */
export function createDebouncedSetData(context: any, delay: number = 16) {
  let pendingData: Record<string, any> = {}
  let timer: ReturnType<typeof setTimeout> | null = null

  return function setData(data: Record<string, any>) {
    // 合并数据
    pendingData = { ...pendingData, ...data }

    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(() => {
      if (Object.keys(pendingData).length > 0) {
        context.setData(pendingData)
        pendingData = {}
      }
      timer = null
    }, delay)
  }
}

// ==================== 节流 setData ====================

/**
 * 创建节流 setData 函数
 * 用于限制 setData 调用频率，保证在指定时间内至少更新一次
 * 
 * @param context Page 或 Component 实例
 * @param interval 节流间隔（毫秒），默认 100ms
 * @returns 节流后的 setData 函数
 */
export function createThrottledSetData(context: any, interval: number = 100) {
  let pendingData: Record<string, any> = {}
  let lastTime: number = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  return function setData(data: Record<string, any>) {
    const now = Date.now()

    // 合并数据
    pendingData = { ...pendingData, ...data }

    if (now - lastTime >= interval) {
      // 已超过间隔，立即更新
      lastTime = now
      if (Object.keys(pendingData).length > 0) {
        context.setData(pendingData)
        pendingData = {}
      }
    } else if (!timer) {
      // 未超过间隔，设置定时器在间隔结束后更新
      const remaining = interval - (now - lastTime)
      timer = setTimeout(() => {
        lastTime = Date.now()
        if (Object.keys(pendingData).length > 0) {
          context.setData(pendingData)
          pendingData = {}
        }
        timer = null
      }, remaining)
    }
  }
}

// ==================== 批量更新管理器 ====================

/**
 * 批量更新管理器
 * 收集多个数据变更请求，在下一帧统一更新
 * 
 * @param context Page 或 Component 实例
 * @returns 批量更新管理器
 */
export function createBatchUpdater(context: any) {
  let pendingData: Record<string, any> = {}
  let isScheduled: boolean = false

  function flush() {
    if (Object.keys(pendingData).length > 0) {
      context.setData(pendingData)
      pendingData = {}
    }
    isScheduled = false
  }

  return {
    /**
     * 添加数据更新请求
     * @param data 要更新的数据
     */
    add(data: Record<string, any>) {
      pendingData = { ...pendingData, ...data }

      if (!isScheduled) {
        isScheduled = true
        // 使用 Promise.then 模拟微任务，在当前同步代码执行完毕后更新
        Promise.resolve().then(flush)
      }
    },

    /**
     * 强制立即刷新
     */
    flush() {
      if (isScheduled) {
        flush()
      }
    },

    /**
     * 清除待更新数据
     */
    clear() {
      pendingData = {}
      isScheduled = false
    }
  }
}

// ==================== 深度路径合并 ====================

/**
 * 深度合并路径数据
 * 用于只更新嵌套对象中的某个字段，避免 setData 传输大量数据
 * 
 * @param data 原始数据对象
 * @param path 要更新的路径，如 'a.b.c'
 * @param value 要设置的值
 * @returns 更新后的路径-值对
 * 
 * @example
 * // 代替 context.setData({ 'a.b.c': newValue })
 * const update = pathUpdate({}, 'a.b.c', newValue)
 * // 返回 { 'a.b.c': newValue }
 */
export function pathUpdate(data: Record<string, any>, path: string, value: any): Record<string, any> {
  return { [path]: value }
}

/**
 * 创建路径更新函数
 * 简化路径更新操作
 * 
 * @param context Page 或 Component 实例
 * @returns 路径更新函数
 */
export function createPathUpdater(context: any) {
  return function updatePath(path: string, value: any) {
    context.setData({ [path]: value })
  }
}

// ==================== 列表数据优化 ====================

/**
 * 优化列表 setData
 * 当列表数据较大时，只更新变化的部分
 * 
 * @param context Page 或 Component 实例
 * @param listKey 列表数据的键名
 * @param index 要更新的项索引
 * @param updates 要更新的字段
 */
export function updateListItem(
  context: any,
  listKey: string,
  index: number,
  updates: Record<string, any>
) {
  const pathPrefix = `${listKey}[${index}]`
  const data: Record<string, any> = {}

  for (const key in updates) {
    if (updates.hasOwnProperty(key)) {
      data[`${pathPrefix}.${key}`] = updates[key]
    }
  }

  context.setData(data)
}

/**
 * 批量更新列表项
 * 
 * @param context Page 或 Component 实例
 * @param listKey 列表数据的键名
 * @param updates 要更新的项数组，每项包含 index 和 data
 */
export function batchUpdateListItems(
  context: any,
  listKey: string,
  updates: Array<{ index: number; data: Record<string, any> }>
) {
  const data: Record<string, any> = {}

  for (const update of updates) {
    const pathPrefix = `${listKey}[${update.index}]`
    for (const key in update.data) {
      if (update.data.hasOwnProperty(key)) {
        data[`${pathPrefix}.${key}`] = update.data[key]
      }
    }
  }

  context.setData(data)
}

// ==================== 动画帧优化 ====================

/**
 * requestAnimationFrame 封装
 * 在小程序环境中使用 setTimeout 模拟
 */
export const rAF = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame
  : (callback: Function) => setTimeout(callback, 16)

/**
 * 在下一帧执行 setData
 * 适合动画场景
 * 
 * @param context Page 或 Component 实例
 * @param data 要更新的数据
 */
export function setDataNextFrame(context: any, data: Record<string, any>) {
  rAF(() => {
    context.setData(data)
  })
}

// ==================== 内存缓存 ====================

/**
 * 创建简单的内存缓存
 * 用于缓存计算结果，避免重复计算
 * 
 * @param maxSize 最大缓存数量，默认 100
 * @returns 缓存管理器
 */
export function createCache<T = any>(maxSize: number = 100) {
  const cache = new Map<string, { value: T; timestamp: number }>()

  return {
    /**
     * 获取缓存值
     * @param key 缓存键
     * @param ttl 缓存有效期（毫秒），0 表示永不过期
     */
    get(key: string, ttl: number = 0): T | undefined {
      const item = cache.get(key)
      if (!item) return undefined

      if (ttl > 0 && Date.now() - item.timestamp > ttl) {
        cache.delete(key)
        return undefined
      }

      return item.value
    },

    /**
     * 设置缓存值
     * @param key 缓存键
     * @param value 缓存值
     */
    set(key: string, value: T) {
      // 如果缓存已满，删除最早的条目
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value
        if (firstKey !== undefined) {
          cache.delete(firstKey)
        }
      }

      cache.set(key, { value, timestamp: Date.now() })
    },

    /**
     * 删除缓存
     * @param key 缓存键
     */
    delete(key: string) {
      cache.delete(key)
    },

    /**
     * 清空缓存
     */
    clear() {
      cache.clear()
    },

    /**
     * 获取缓存大小
     */
    get size() {
      return cache.size
    }
  }
}

// ==================== 导出默认配置 ====================

export default {
  DEBOUNCE_DELAY: 16,     // 防抖延迟（约一帧）
  THROTTLE_INTERVAL: 100, // 节流间隔
  CACHE_MAX_SIZE: 100,    // 缓存最大数量
  CACHE_TTL: 5 * 60 * 1000, // 缓存默认有效期（5分钟）
}
