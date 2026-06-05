/**
 * 网络状态监控工具
 * 
 * 功能：
 * 1. 监听网络状态变化
 * 2. 检测网络连接类型
 * 3. 提供网络状态查询接口
 * 4. 网络恢复时自动重试失败的请求
 */

// ==================== 类型定义 ====================

interface NetworkStatus {
  /** 是否连接 */
  isConnected: boolean
  /** 网络类型 */
  networkType: string
  /** 是否为 WiFi */
  isWifi: boolean
  /** 是否为移动网络 */
  isMobile: boolean
  /** 是否为低速网络（2G/3G） */
  isSlowNetwork: boolean
}

type NetworkChangeCallback = (status: NetworkStatus) => void

// ==================== 网络监控类 ====================

class NetworkMonitor {
  private isConnected: boolean = true
  private networkType: string = 'unknown'
  private listeners: Set<NetworkChangeCallback> = new Set()
  private isInitialized: boolean = false

  /**
   * 初始化网络监控
   */
  init(): void {
    if (this.isInitialized) return

    // 获取初始网络状态
    this.getNetworkStatus().then(status => {
      this.isConnected = status.isConnected
      this.networkType = status.networkType
    })

    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      const wasConnected = this.isConnected
      this.isConnected = res.isConnected
      this.networkType = res.networkType

      console.log('[NetworkMonitor] 网络状态变化:', {
        isConnected: res.isConnected,
        networkType: res.networkType
      })

      // 通知所有监听器
      const status = this.getCurrentStatus()
      this.listeners.forEach(callback => {
        try {
          callback(status)
        } catch (e) {
          console.error('[NetworkMonitor] 监听器回调错误:', e)
        }
      })

      // 网络恢复时的处理
      if (!wasConnected && res.isConnected) {
        this.onNetworkRestore()
      }

      // 网络断开时的处理
      if (wasConnected && !res.isConnected) {
        this.onNetworkLost()
      }
    })

    this.isInitialized = true
    console.log('[NetworkMonitor] 网络监控已初始化')
  }

  /**
   * 获取当前网络状态
   */
  async getNetworkStatus(): Promise<NetworkStatus> {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          const networkType = res.networkType
          resolve({
            isConnected: networkType !== 'none',
            networkType: networkType,
            isWifi: networkType === 'wifi',
            isMobile: ['2g', '3g', '4g', '5g'].includes(networkType),
            isSlowNetwork: ['2g', '3g', 'none'].includes(networkType)
          })
        },
        fail: () => {
          resolve({
            isConnected: false,
            networkType: 'unknown',
            isWifi: false,
            isMobile: false,
            isSlowNetwork: true
          })
        }
      })
    })
  }

  /**
   * 获取当前网络状态（同步）
   */
  getCurrentStatus(): NetworkStatus {
    return {
      isConnected: this.isConnected,
      networkType: this.networkType,
      isWifi: this.networkType === 'wifi',
      isMobile: ['2g', '3g', '4g', '5g'].includes(this.networkType),
      isSlowNetwork: ['2g', '3g', 'none'].includes(this.networkType)
    }
  }

  /**
   * 检查是否已连接
   */
  isOnline(): boolean {
    return this.isConnected
  }

  /**
   * 添加网络状态变化监听器
   */
  onNetworkChange(callback: NetworkChangeCallback): () => void {
    this.listeners.add(callback)
    
    // 返回取消监听的函数
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * 网络恢复时的处理
   */
  private onNetworkRestore(): void {
    console.log('[NetworkMonitor] 网络已恢复')
    
    // 显示提示
    wx.showToast({
      title: '网络已恢复',
      icon: 'success',
      duration: 1500
    })

    // 可以在这里触发失败请求的重试
    // this.retryFailedRequests()
  }

  /**
   * 网络断开时的处理
   */
  private onNetworkLost(): void {
    console.log('[NetworkMonitor] 网络已断开')
    
    // 显示提示
    wx.showToast({
      title: '网络连接已断开',
      icon: 'none',
      duration: 2000
    })
  }

  /**
   * 等待网络恢复
   * @param timeout 超时时间（毫秒），默认 30 秒
   * @returns 是否恢复
   */
  waitForNetworkRestore(timeout: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected) {
        resolve(true)
        return
      }

      let resolved = false
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true
          unsubscribe()
          resolve(false)
        }
      }, timeout)

      const unsubscribe = this.onNetworkChange((status) => {
        if (status.isConnected && !resolved) {
          resolved = true
          clearTimeout(timeoutId)
          unsubscribe()
          resolve(true)
        }
      })
    })
  }
}

// ==================== 单例实例 ====================

export const networkMonitor = new NetworkMonitor()

// ==================== 工具函数 ====================

/**
 * 检查网络连接状态
 * 如果未连接则显示提示
 * @param showToast 是否显示提示
 * @returns 是否已连接
 */
export function checkNetwork(showToast: boolean = true): boolean {
  const isOnline = networkMonitor.isOnline()
  
  if (!isOnline && showToast) {
    wx.showToast({
      title: '网络连接已断开，请检查网络',
      icon: 'none',
      duration: 2000
    })
  }
  
  return isOnline
}

/**
 * 带网络检查的异步函数包装器
 * 如果网络断开，会等待网络恢复后重试
 * 
 * @param fn 要执行的异步函数
 * @param options 选项
 * @returns 函数执行结果
 */
export async function withNetworkCheck<T>(
  fn: () => Promise<T>,
  options: {
    /** 是否等待网络恢复 */
    waitForRestore?: boolean
    /** 等待超时时间（毫秒） */
    timeout?: number
    /** 是否显示网络断开提示 */
    showOfflineToast?: boolean
  } = {}
): Promise<T> {
  const {
    waitForRestore = true,
    timeout = 30000,
    showOfflineToast = true
  } = options

  // 检查网络
  if (!checkNetwork(showOfflineToast)) {
    if (waitForRestore) {
      // 等待网络恢复
      const restored = await networkMonitor.waitForNetworkRestore(timeout)
      if (!restored) {
        throw new Error('网络恢复超时')
      }
    } else {
      throw new Error('网络连接已断开')
    }
  }

  // 执行函数
  return fn()
}

/**
 * 获取网络类型描述
 */
export function getNetworkTypeDesc(networkType: string): string {
  const descMap: Record<string, string> = {
    'wifi': 'WiFi',
    '2g': '2G',
    '3g': '3G',
    '4g': '4G',
    '5g': '5G',
    'unknown': '未知',
    'none': '无网络'
  }
  return descMap[networkType] || networkType
}

/**
 * 判断是否为低速网络
 * 低速网络下应该减少数据加载量
 */
export function isSlowNetwork(): boolean {
  const status = networkMonitor.getCurrentStatus()
  return status.isSlowNetwork
}

/**
 * 根据网络类型获取分页大小
 * 低速网络加载更少的数据
 */
export function getPageSizeByNetwork(defaultSize: number = 20): number {
  if (isSlowNetwork()) {
    return Math.max(10, Math.floor(defaultSize / 2))
  }
  return defaultSize
}

// ==================== 导出 ====================

export default {
  networkMonitor,
  checkNetwork,
  withNetworkCheck,
  getNetworkTypeDesc,
  isSlowNetwork,
  getPageSizeByNetwork
}
