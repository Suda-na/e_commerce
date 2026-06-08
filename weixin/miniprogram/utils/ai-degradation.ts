/**
 * AI服务降级工具
 * 
 * 功能：
 * 1. 监控AI服务可用性
 * 2. AI服务不可用时自动降级
 * 3. 提供降级后的替代方案
 * 4. 定期健康检查
 */

// AI服务状态
export type AIServiceStatus = 'available' | 'unavailable' | 'degraded' | 'checking'

// AI功能模块
export type AIModule = 'recommendations' | 'price_prediction' | 'auction_analysis' | 'chat' | 'image_recognition' | 'speech_recognition' | 'hot_searches' | 'search_suggestions'

// AI功能状态
interface AIModuleStatus {
  status: AIServiceStatus
  lastCheck: number
  errorCount: number
  lastError?: string
}

// 健康检查配置
interface HealthCheckConfig {
  interval: number // 检查间隔（毫秒）
  timeout: number // 超时时间（毫秒）
  maxErrorCount: number // 最大错误次数
  recoveryThreshold: number // 恢复阈值（连续成功次数）
}

// 默认配置
const DEFAULT_CONFIG: HealthCheckConfig = {
  interval: 60000, // 1分钟
  timeout: 10000, // 10秒
  maxErrorCount: 3,
  recoveryThreshold: 2,
}

class AIDegradationManager {
  private moduleStatus: Map<AIModule, AIModuleStatus> = new Map()
  private config: HealthCheckConfig
  private healthCheckTimer: number | null = null
  private listeners: Map<string, (status: AIServiceStatus, module: AIModule) => void> = new Map()
  private consecutiveSuccesses: Map<AIModule, number> = new Map()

  constructor(config?: Partial<HealthCheckConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initModuleStatus()
  }

  /**
   * 初始化模块状态
   */
  private initModuleStatus(): void {
    const modules: AIModule[] = [
      'recommendations',
      'price_prediction',
      'auction_analysis',
      'chat',
      'image_recognition',
      'speech_recognition',
      'hot_searches',
      'search_suggestions',
    ]

    modules.forEach(module => {
      this.moduleStatus.set(module, {
        status: 'available',
        lastCheck: Date.now(),
        errorCount: 0,
      })
      this.consecutiveSuccesses.set(module, 0)
    })
  }

  /**
   * 启动健康检查
   */
  startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return
    }

    console.log('[AIDegradation] 启动AI服务健康检查')

    this.healthCheckTimer = setInterval(() => {
      this.checkAllModules()
    }, this.config.interval) as unknown as number

    // 立即执行一次检查
    this.checkAllModules()
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
      console.log('[AIDegradation] 停止AI服务健康检查')
    }
  }

  /**
   * 检查所有模块
   */
  private async checkAllModules(): Promise<void> {
    try {
      // 安全获取app实例
      let baseUrl = 'https://www.sudaworld.xyz/api' // 默认值
      try {
        const app = getApp<IAppOption>()
        if (app && app.globalData) {
          baseUrl = app.globalData.baseUrl || baseUrl
        }
      } catch (e) {
        console.warn('[AIDegradation] 获取app实例失败，使用默认baseUrl:', e)
      }

      // 发送健康检查请求
      const response = await new Promise<boolean>((resolve) => {
        wx.request({
          url: `${baseUrl}/ai/health`,
          method: 'GET',
          timeout: this.config.timeout,
          success: (res) => {
            resolve(res.statusCode === 200)
          },
          fail: () => {
            resolve(false)
          },
        })
      })

      if (response) {
        // AI服务可用
        this.updateAllModulesStatus('available')
      } else {
        // AI服务不可用
        this.updateAllModulesStatus('unavailable')
      }
    } catch (error) {
      console.error('[AIDegradation] 健康检查失败:', error)
      this.updateAllModulesStatus('unavailable')
    }
  }

  /**
   * 更新所有模块状态
   */
  private updateAllModulesStatus(status: AIServiceStatus): void {
    this.moduleStatus.forEach((moduleStatus, module) => {
      const oldStatus = moduleStatus.status
      moduleStatus.status = status
      moduleStatus.lastCheck = Date.now()

      if (status === 'available') {
        // 检查是否可以恢复
        const successes = (this.consecutiveSuccesses.get(module) || 0) + 1
        this.consecutiveSuccesses.set(module, successes)

        if (successes >= this.config.recoveryThreshold && oldStatus !== 'available') {
          console.log(`[AIDegradation] 模块 ${module} 恢复可用`)
          this.notifyListeners(module, 'available')
        }
      } else if (status === 'unavailable') {
        moduleStatus.errorCount++
        this.consecutiveSuccesses.set(module, 0)

        if (moduleStatus.errorCount >= this.config.maxErrorCount && oldStatus !== 'unavailable') {
          console.log(`[AIDegradation] 模块 ${module} 不可用`)
          this.notifyListeners(module, 'unavailable')
        }
      }
    })
  }

  /**
   * 报告模块错误
   */
  reportError(module: AIModule, error: Error | string): void {
    const moduleStatus = this.moduleStatus.get(module)
    if (!moduleStatus) return

    moduleStatus.errorCount++
    moduleStatus.lastError = error instanceof Error ? error.message : String(error)
    moduleStatus.lastCheck = Date.now()
    this.consecutiveSuccesses.set(module, 0)

    console.warn(`[AIDegradation] 模块 ${module} 错误:`, moduleStatus.lastError)

    if (moduleStatus.errorCount >= this.config.maxErrorCount) {
      moduleStatus.status = 'unavailable'
      this.notifyListeners(module, 'unavailable')
    }
  }

  /**
   * 报告模块成功
   */
  reportSuccess(module: AIModule): void {
    const moduleStatus = this.moduleStatus.get(module)
    if (!moduleStatus) return

    moduleStatus.errorCount = Math.max(0, moduleStatus.errorCount - 1)
    moduleStatus.lastCheck = Date.now()

    const successes = (this.consecutiveSuccesses.get(module) || 0) + 1
    this.consecutiveSuccesses.set(module, successes)

    if (successes >= this.config.recoveryThreshold && moduleStatus.status !== 'available') {
      moduleStatus.status = 'available'
      console.log(`[AIDegradation] 模块 ${module} 恢复可用`)
      this.notifyListeners(module, 'available')
    }
  }

  /**
   * 获取模块状态
   */
  getModuleStatus(module: AIModule): AIServiceStatus {
    return this.moduleStatus.get(module)?.status || 'available'
  }

  /**
   * 检查模块是否可用
   */
  isModuleAvailable(module: AIModule): boolean {
    const status = this.getModuleStatus(module)
    return status === 'available' || status === 'degraded'
  }

  /**
   * 获取所有模块状态
   */
  getAllModuleStatus(): Record<AIModule, AIServiceStatus> {
    const result: any = {}
    this.moduleStatus.forEach((status, module) => {
      result[module] = status.status
    })
    return result
  }

  /**
   * 注册状态监听器
   */
  onStatusChange(id: string, listener: (status: AIServiceStatus, module: AIModule) => void): void {
    this.listeners.set(id, listener)
  }

  /**
   * 移除状态监听器
   */
  removeStatusListener(id: string): void {
    this.listeners.delete(id)
  }

  /**
   * 通知监听器
   */
  private notifyListeners(module: AIModule, status: AIServiceStatus): void {
    this.listeners.forEach(listener => {
      try {
        listener(status, module)
      } catch (error) {
        console.error('[AIDegradation] 监听器回调失败:', error)
      }
    })
  }

  /**
   * 手动设置模块状态
   */
  setModuleStatus(module: AIModule, status: AIServiceStatus): void {
    const moduleStatus = this.moduleStatus.get(module)
    if (moduleStatus) {
      moduleStatus.status = status
      moduleStatus.lastCheck = Date.now()
      this.notifyListeners(module, status)
    }
  }

  /**
   * 重置模块状态
   */
  resetModuleStatus(module: AIModule): void {
    const moduleStatus = this.moduleStatus.get(module)
    if (moduleStatus) {
      moduleStatus.status = 'available'
      moduleStatus.errorCount = 0
      moduleStatus.lastError = undefined
      moduleStatus.lastCheck = Date.now()
      this.consecutiveSuccesses.set(module, 0)
    }
  }

  /**
   * 重置所有模块状态
   */
  resetAllModuleStatus(): void {
    this.moduleStatus.forEach((_, module) => {
      this.resetModuleStatus(module)
    })
  }
}

// 创建全局实例
export const aiDegradationManager = new AIDegradationManager()

/**
 * 降级包装器 - 包装AI服务调用，自动降级
 */
export function withDegradation<T>(
  module: AIModule,
  aiFn: () => Promise<T>,
  fallback: T | (() => T | Promise<T>)
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    // 检查模块是否可用
    if (!aiDegradationManager.isModuleAvailable(module)) {
      console.log(`[AIDegradation] 模块 ${module} 不可用，使用降级方案`)
      const fallbackValue = typeof fallback === 'function' ? await (fallback as Function)() : fallback
      resolve(fallbackValue)
      return
    }

    try {
      const result = await aiFn()
      aiDegradationManager.reportSuccess(module)
      resolve(result)
    } catch (error) {
      aiDegradationManager.reportError(module, error as Error)
      console.log(`[AIDegradation] 模块 ${module} 调用失败，使用降级方案`)
      const fallbackValue = typeof fallback === 'function' ? await (fallback as Function)() : fallback
      resolve(fallbackValue)
    }
  })
}

/**
 * 获取降级提示信息
 */
export function getDegradationMessage(module: AIModule): string {
  const messages: Record<AIModule, string> = {
    recommendations: '智能推荐暂不可用，为您展示热门商品',
    price_prediction: '价格预测暂不可用',
    auction_analysis: '竞拍分析暂不可用',
    chat: '智能客服暂不可用，请联系人工客服',
    image_recognition: '图像识别暂不可用',
    speech_recognition: '语音识别暂不可用',
    hot_searches: '热门搜索暂不可用',
    search_suggestions: '搜索建议暂不可用',
  }
  return messages[module] || 'AI功能暂不可用'
}

export default aiDegradationManager
