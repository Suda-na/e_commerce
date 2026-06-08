// app.ts
import { networkMonitor } from './utils/network'
import { aiDegradationManager } from './utils/ai-degradation'
import { eventBus, EVENTS } from './utils/event-bus'

// 错误日志存储键
const ERROR_LOG_KEY = 'error_logs'
const MAX_ERROR_LOGS = 50

App<IAppOption>({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    token: '',
    baseUrl: 'https://www.sudaworld.xyz/api', // API地址
    socketUrl: 'wss://www.sudaworld.xyz', // WebSocket地址
    systemInfo: null,
    unreadCount: 0, // 全局未读消息数
    _unreadPollingTimer: null as any, // 未读消息轮询定时器
  },
  
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 获取系统信息
    this.getSystemInfo()
    
    // 检查登录状态
    this.checkLoginStatus()
    
    // 立即同步一次 TabBar 角标（基于本地缓存或全局状态）
    if (this.globalData.isLoggedIn) {
      this.syncTabBarBadge(this.globalData.unreadCount)
    }
    
    // 初始化错误监控
    this.initErrorMonitoring()
    
    // 初始化网络监控
    this.initNetworkMonitor()
    
    // 初始化AI服务健康检查
    this.initAIHealthCheck()
    
    // 初始化未读消息轮询
    this.startUnreadCountPolling()
  },

  // ==================== 全局错误捕获 ====================

  /**
   * JavaScript 运行时错误捕获
   * 当小程序中的 JS 代码发生未捕获的错误时触发
   */
  onError(error: string) {
    console.error('[App.onError] 全局错误:', error)
    this.reportError({
      type: 'js_error',
      message: error,
      timestamp: Date.now()
    })
  },

  /**
   * 未处理的 Promise rejection 捕获
   * 当 Promise 被 reject 且没有对应的 catch 处理时触发
   */
  onUnhandledRejection(res: { reason: any; promise: Promise<any> }) {
    console.error('[App.onUnhandledRejection] 未处理的 Promise 错误:', res.reason)
    
    const message = res.reason instanceof Error 
      ? res.reason.message 
      : String(res.reason)
    
    this.reportError({
      type: 'unhandled_rejection',
      message: message,
      stack: res.reason instanceof Error ? res.reason.stack : undefined,
      timestamp: Date.now()
    })
  },

  /**
   * 初始化错误监控
   */
  initErrorMonitoring() {
    // 清理过期的错误日志
    this.cleanupErrorLogs()
    console.log('[ErrorMonitor] 错误监控已初始化')
  },

  /**
   * 初始化网络监控
   */
  initNetworkMonitor() {
    networkMonitor.init()
    console.log('[NetworkMonitor] 网络监控已初始化')
  },

  /**
   * 初始化AI服务健康检查
   */
  initAIHealthCheck() {
    aiDegradationManager.startHealthCheck()
    console.log('[AIDegradation] AI服务健康检查已启动')
  },

  /**
   * 上报错误（本地存储 + 可选远程上报）
   */
  reportError(errorInfo: {
    type: string
    message: string
    stack?: string
    page?: string
    timestamp: number
  }) {
    try {
      // 获取当前页面路径
      const pages = getCurrentPages()
      const currentPage = pages.length > 0 ? pages[pages.length - 1] : null
      errorInfo.page = currentPage ? currentPage.route : 'unknown'

      // 保存到本地存储
      const errorLogs: any[] = wx.getStorageSync(ERROR_LOG_KEY) || []
      errorLogs.unshift({
        ...errorInfo,
        id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })
      
      // 限制日志数量
      if (errorLogs.length > MAX_ERROR_LOGS) {
        errorLogs.splice(MAX_ERROR_LOGS)
      }
      
      wx.setStorageSync(ERROR_LOG_KEY, errorLogs)

      // 开发环境下在控制台显示详细信息
      if (this.globalData.baseUrl.includes('localhost') || this.globalData.baseUrl.includes('127.0.0.1')) {
        console.group('[ErrorReport] 错误详情')
        console.log('类型:', errorInfo.type)
        console.log('消息:', errorInfo.message)
        console.log('页面:', errorInfo.page)
        console.log('时间:', new Date(errorInfo.timestamp).toLocaleString())
        if (errorInfo.stack) {
          console.log('堆栈:', errorInfo.stack)
        }
        console.groupEnd()
      }

      // TODO: 生产环境下可以远程上报到监控系统
      // this.uploadErrorToServer(errorInfo)
    } catch (e) {
      // 错误上报本身不能抛出异常
      console.error('[ErrorReport] 保存错误日志失败:', e)
    }
  },

  /**
   * 清理过期的错误日志（保留最近7天）
   */
  cleanupErrorLogs() {
    try {
      const errorLogs: any[] = wx.getStorageSync(ERROR_LOG_KEY) || []
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      
      const validLogs = errorLogs.filter(log => log.timestamp > sevenDaysAgo)
      
      if (validLogs.length !== errorLogs.length) {
        wx.setStorageSync(ERROR_LOG_KEY, validLogs)
        console.log(`[ErrorMonitor] 清理了 ${errorLogs.length - validLogs.length} 条过期错误日志`)
      }
    } catch (e) {
      console.error('[ErrorMonitor] 清理错误日志失败:', e)
    }
  },

  /**
   * 获取错误日志（用于调试）
   */
  getErrorLogs(): any[] {
    try {
      return wx.getStorageSync(ERROR_LOG_KEY) || []
    } catch (e) {
      return []
    }
  },

  /**
   * 清空错误日志
   */
  clearErrorLogs() {
    try {
      wx.removeStorageSync(ERROR_LOG_KEY)
    } catch (e) {
      // ignore
    }
  },

  // 获取系统信息
  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.globalData.systemInfo = systemInfo
    } catch (e) {
      console.error('获取系统信息失败', e)
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    const unreadCount = wx.getStorageSync('unreadCount') || 0
    
    console.log('检查登录状态，token:', token ? '***已隐藏***' : '无', 'userInfo:', userInfo)
    
    if (token) {
      this.globalData.token = token
      this.globalData.isLoggedIn = true
      this.globalData.unreadCount = unreadCount
      
      if (userInfo) {
        this.globalData.userInfo = userInfo
      }
      
      // 验证token是否有效
      this.validateToken(token)
    }
  },

  // 验证token有效性
  async validateToken(token: string) {
    try {
      // 调用 /api/auth/profile 验证Token是否有效
      const res = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${this.globalData.baseUrl}/auth/profile`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000,
          success: (resp) => resolve(resp),
          fail: (err) => reject(err),
        })
      })

      if (res.statusCode === 200) {
        const responseData = res.data as any
        const userInfo = responseData?.data || responseData
        // Token有效，更新用户信息
        this.globalData.userInfo = userInfo
        this.globalData.isLoggedIn = true
        wx.setStorageSync('userInfo', userInfo)
        console.log('[App] Token验证成功，用户:', userInfo?.username)
      } else if (res.statusCode === 401) {
        // Token无效/过期，清除登录状态
        console.warn('[App] Token已过期，清除登录状态')
        this.globalData.token = ''
        this.globalData.isLoggedIn = false
        this.globalData.userInfo = null
        wx.removeStorageSync('token')
        wx.removeStorageSync('userInfo')
      }
    } catch (error) {
      // 网络错误等情况，保留本地登录状态（离线可用）
      console.warn('[App] Token验证请求失败，保留本地登录状态:', error)
    }
  },

  // 登录
  login(callback?: (success: boolean) => void) {
    wx.login({
      success: (res) => {
        if (res.code) {
          // 发送 res.code 到后台换取 openId, sessionKey, unionId
          // TODO: 调用后端登录API
          console.log('登录code:', res.code)
          if (callback) callback(true)
        } else {
          console.log('登录失败！' + res.errMsg)
          if (callback) callback(false)
        }
      },
      fail: () => {
        if (callback) callback(false)
      }
    })
  },

  // 退出登录
  logout() {
    this.globalData.userInfo = null
    this.globalData.isLoggedIn = false
    this.globalData.token = ''
    this.globalData.unreadCount = 0 // 重置未读消息数
    
    // 停止未读消息轮询
    this.stopUnreadCountPolling()
    
    // 清除 TabBar 角标
    this.syncTabBarBadge(0)
    
    wx.removeStorageSync('token')
    wx.removeStorageSync('userInfo')
    
    // 触发登录状态变化事件
    eventBus.emit(EVENTS.LOGIN_STATE_CHANGE, { isLoggedIn: false })
    
    // 跳转到登录页
    wx.redirectTo({
      url: '/pages/login/login'
    })
  },

  // 设置用户信息
  setUserInfo(userInfo: any) {
    this.globalData.userInfo = userInfo
    wx.setStorageSync('userInfo', userInfo)
  },

  // 设置token
  setToken(token: string) {
    this.globalData.token = token
    this.globalData.isLoggedIn = true
    wx.setStorageSync('token', token)
  },

  /**
   * 同步 TabBar 红点/角标状态
   * "我的" TabBar 索引为 2
   */
  syncTabBarBadge(count: number) {
    try {
      if (count > 0) {
        wx.setTabBarBadge({
          index: 2,
          text: count > 99 ? '99+' : String(count),
        })
      } else {
        wx.removeTabBarBadge({ index: 2 })
      }
    } catch (e) {
      console.error('[App] 同步 TabBar 角标失败:', e)
    }
  },

  /**
   * 更新全局未读消息数
   * @param count 新的未读数量
   * @param source 来源标识（用于调试）
   */
  updateUnreadCount(count: number, source: string = 'unknown') {
    const oldCount = this.globalData.unreadCount
    this.globalData.unreadCount = count
    console.log(`[App] 未读消息数更新: ${oldCount} -> ${count} (来源: ${source})`)
    
    // 保存到本地存储，确保下次启动时可用
    try {
      wx.setStorageSync('unreadCount', count)
    } catch (e) {
      console.warn('[App] 保存未读消息数到本地存储失败:', e)
    }
    
    // 同步 TabBar 红点/角标
    this.syncTabBarBadge(count)

    // 触发事件，通知所有监听者
    eventBus.emit(EVENTS.UNREAD_COUNT_CHANGE, {
      count,
      oldCount,
      source,
      timestamp: Date.now(),
    })
  },

  /**
   * 增加未读消息数
   * @param increment 增加的数量（默认为1）
   * @param source 来源标识
   */
  incrementUnreadCount(increment: number = 1, source: string = 'unknown') {
    const newCount = this.globalData.unreadCount + increment
    this.updateUnreadCount(newCount, source)

    // 触发新通知事件（用于通知页面实时刷新）
    if (source.startsWith('socket-')) {
      eventBus.emit(EVENTS.NEW_NOTIFICATION, {
        increment,
        source,
        timestamp: Date.now(),
      })
    }
  },

  /**
   * 减少未读消息数
   * @param decrement 减少的数量（默认为1）
   * @param source 来源标识
   */
  decrementUnreadCount(decrement: number = 1, source: string = 'unknown') {
    const newCount = Math.max(0, this.globalData.unreadCount - decrement)
    this.updateUnreadCount(newCount, source)

    // 触发通知已读状态变化事件
    eventBus.emit(EVENTS.NOTIFICATION_READ_CHANGE, {
      decrement,
      newCount,
      source,
      timestamp: Date.now(),
    })
  },

  /**
   * 启动未读消息轮询（每30秒）
   * 作为 WebSocket 断线时的兜底机制
   */
  startUnreadCountPolling() {
    this.stopUnreadCountPolling()
    
    // 首次立即获取一次
    this.fetchUnreadCountFromServer()
    
    this.globalData._unreadPollingTimer = setInterval(() => {
      this.fetchUnreadCountFromServer()
    }, 30000)
    
    console.log('[App] 未读消息轮询已启动（30s间隔）')
  },

  /**
   * 停止未读消息轮询
   */
  stopUnreadCountPolling() {
    if (this.globalData._unreadPollingTimer) {
      clearInterval(this.globalData._unreadPollingTimer)
      this.globalData._unreadPollingTimer = null
      console.log('[App] 未读消息轮询已停止')
    }
  },

  /**
   * 从服务器获取未读消息数
   */
  async fetchUnreadCountFromServer() {
    if (!this.globalData.isLoggedIn || !this.globalData.token) return
    
    try {
      const res = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${this.globalData.baseUrl}/notifications/unread-count`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${this.globalData.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
          success: (resp) => resolve(resp),
          fail: (err) => reject(err),
        })
      })
      
      if (res.statusCode === 200) {
        const data = res.data as any
        const count = data?.data?.unreadCount || 0
        // 仅当与当前值不同时才更新，避免不必要的广播
        if (count !== this.globalData.unreadCount) {
          this.updateUnreadCount(count, 'polling')
        } else {
          // 即使计数相同，也确保 TabBar 角标状态正确（防止首次进入时角标丢失）
          this.syncTabBarBadge(count)
        }
      }
    } catch (e) {
      // 轮询失败静默处理，不影响用户体验
      console.warn('[App] 轮询未读消息数失败:', e)
    }
  },

  /**
   * 获取当前未读消息数
   */
  getUnreadCount(): number {
    return this.globalData.unreadCount
  }
})