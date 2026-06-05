const app = getApp<IAppOption>()
import { authService } from '../../services/auth.service'
import { favoriteService } from '../../services/favorite.service'
import { notificationApiService } from '../../services/notification-api.service'
import { storage, STORAGE_KEYS } from '../../utils/storage'
import { getSocket } from '../../utils/socket'
import { eventBus, EVENTS } from '../../utils/event-bus'

Page({
  data: {
    isLoggedIn: false,
    userInfo: {
      avatarUrl: '',
      nickname: '',
      id: '',
      phone: '',
    },
    stats: {
      auctionCount: 0,
      bidCount: 0,
      winCount: 0,
      favoriteCount: 0,
    },
    unreadCount: 0,
    showLogoutModal: false,
    loading: true,
  },

  /** Socket 事件处理函数引用（用于卸载） */
  _onOutbid: null as any,
  _onNewNotification: null as any,
  _onAuctionWon: null as any,
  _onAuctionEnded: null as any,
  _onAuctionCancelled: null as any,
  _onUnreadCountChange: null as any,

  onLoad() {
    console.log('Profile index page loaded')
    // 页面加载时立即从全局状态同步未读数（防止闪烁）
    const globalUnreadCount = app.getUnreadCount()
    if (globalUnreadCount > 0) {
      this.setData({ unreadCount: globalUnreadCount })
    }
  },

  onShow() {
    this.checkLoginState()

    // 先设置监听器，确保不遗漏任何事件（必须在异步操作之前）
    this.setupUnreadCountListener()

    if (this.data.isLoggedIn) {
      // 每次显示都从全局状态同步未读数（无论是否为0，保证一致性）
      const globalUnreadCount = app.getUnreadCount()
      this.setData({ unreadCount: globalUnreadCount })

      this.loadUserInfo()
      this.loadStats()
      this.loadUnreadCount()
      this.setupSocketListeners()
    }
  },

  onHide() {
    this.removeSocketListeners()
    this.removeUnreadCountListener()
  },

  onUnload() {
    this.removeSocketListeners()
  },

  checkLoginState() {
    const isLoggedIn = app.globalData.isLoggedIn || false
    const userInfo = app.globalData.userInfo || {}
    
    this.setData({
      isLoggedIn,
      userInfo: {
        avatarUrl: userInfo.avatarUrl || userInfo.avatar || '',
        nickname: userInfo.nickname || userInfo.username || '',
        id: userInfo.id || userInfo._id || '',
        phone: userInfo.phone || '',
      },
      loading: false,
    })
  },

  /**
   * 设置 WebSocket 监听器
   * 监听 outbid（出价被超越）和 new_notification（新通知）事件
   * 实时更新未读消息数
   */
  setupSocketListeners() {
    try {
      const socket = getSocket()
      if (!socket || !socket.isConnected()) {
        // Socket 未连接，尝试连接
        const token = app.globalData.token || wx.getStorageSync('token')
        if (token) {
          socket.connect(undefined, token)
        }
        return
      }

      // 监听出价被超越事件 - 更新未读计数
      this._onOutbid = (data: any) => {
        console.log('[Profile] 收到出价被超越事件:', data)
        this.setData({
          unreadCount: this.data.unreadCount + 1
        })
        // 同步到全局状态
        app.incrementUnreadCount(1, 'socket-outbid')
        // 触发 EventBus 通知其他页面
        eventBus.emit(EVENTS.NEW_NOTIFICATION, { type: 'outbid', data })
      }

      // 监听新通知事件（后端推送的通知）- 更新未读计数
      this._onNewNotification = (data: any) => {
        console.log('[Profile] 收到新通知事件:', data)
        this.setData({
          unreadCount: this.data.unreadCount + 1
        })
        // 同步到全局状态
        app.incrementUnreadCount(1, 'socket-new-notification')
      }

      // 监听中标事件 - 更新未读计数 + 视觉反馈
      this._onAuctionWon = (data: any) => {
        console.log('[Profile] 收到中标通知事件:', data)
        this.setData({ unreadCount: this.data.unreadCount + 1 })
        app.incrementUnreadCount(1, 'socket-auction-won')
        eventBus.emit(EVENTS.NEW_NOTIFICATION, { type: 'auction_won', data })
        wx.showToast({ title: '恭喜中标！', icon: 'success', duration: 2000 })
      }

      // 监听竞拍结束事件 - 更新未读计数 + 视觉反馈
      this._onAuctionEnded = (data: any) => {
        console.log('[Profile] 收到竞拍结束通知事件:', data)
        this.setData({ unreadCount: this.data.unreadCount + 1 })
        app.incrementUnreadCount(1, 'socket-auction-ended')
        eventBus.emit(EVENTS.NEW_NOTIFICATION, { type: 'auction_ended', data })
        wx.showToast({ title: '竞拍已结束', icon: 'none', duration: 2000 })
      }

      // 监听竞拍取消事件 - 更新未读计数 + 视觉反馈
      this._onAuctionCancelled = (data: any) => {
        console.log('[Profile] 收到竞拍取消通知事件:', data)
        this.setData({ unreadCount: this.data.unreadCount + 1 })
        app.incrementUnreadCount(1, 'socket-auction-cancelled')
        eventBus.emit(EVENTS.NEW_NOTIFICATION, { type: 'auction_cancelled', data })
        wx.showToast({ title: '竞拍已取消', icon: 'none', duration: 2000 })
      }

      socket.on('outbid', this._onOutbid)
      socket.on('new_notification', this._onNewNotification)
      socket.on('auction_won', this._onAuctionWon)
      socket.on('auction_ended', this._onAuctionEnded)
      socket.on('auction_cancelled', this._onAuctionCancelled)

      console.log('[Profile] WebSocket 监听器已设置')
    } catch (e) {
      console.error('[Profile] 设置 WebSocket 监听器失败:', e)
    }
  },

  /**
   * 移除 WebSocket 监听器
   */
  removeSocketListeners() {
    try {
      const socket = getSocket()
      if (socket) {
        if (this._onOutbid) {
          socket.off('outbid', this._onOutbid)
          this._onOutbid = null
        }
        if (this._onNewNotification) {
          socket.off('new_notification', this._onNewNotification)
          this._onNewNotification = null
        }
        if (this._onAuctionWon) {
          socket.off('auction_won', this._onAuctionWon)
          this._onAuctionWon = null
        }
        if (this._onAuctionEnded) {
          socket.off('auction_ended', this._onAuctionEnded)
          this._onAuctionEnded = null
        }
        if (this._onAuctionCancelled) {
          socket.off('auction_cancelled', this._onAuctionCancelled)
          this._onAuctionCancelled = null
        }
      }
    } catch (e) {
      console.error('[Profile] 移除 WebSocket 监听器失败:', e)
    }
  },

  /**
   * 设置未读消息数监听器
   * 监听全局未读消息数变化事件
   */
  setupUnreadCountListener() {
    this._onUnreadCountChange = (data: any) => {
      console.log('[Profile] 收到未读消息数变化事件:', data)
      if (data && typeof data.count === 'number') {
        this.setData({
          unreadCount: data.count
        })
      }
    }

    eventBus.on(EVENTS.UNREAD_COUNT_CHANGE, this._onUnreadCountChange)
  },

  /**
   * 移除未读消息数监听器
   */
  removeUnreadCountListener() {
    if (this._onUnreadCountChange) {
      eventBus.off(EVENTS.UNREAD_COUNT_CHANGE, this._onUnreadCountChange)
      this._onUnreadCountChange = null
    }
  },

  async loadUserInfo() {
    try {
      const res = await authService.getUserInfo()
      // authService.getUserInfo() 返回 res.data，即 { success: true, data: user }
      // 需要提取 data.data 获取实际用户信息
      const data = res?.data || res || null
      if (data) {
        const userInfo = {
          avatarUrl: data.avatarUrl || data.avatar || '',
          nickname: data.nickname || data.username || '',
          id: data.id || data._id || '',
          phone: data.phone || '',
        }
        this.setData({ userInfo })
        app.setUserInfo(data)
      }
    } catch (err) {
      console.log('获取用户信息失败，使用本地缓存', err)
    }
  },

  async loadStats() {
    try {
      console.log('[Profile] 开始获取统计数据...')
      const res = await authService.getUserStats()
      console.log('[Profile] getUserStats 原始响应:', JSON.stringify(res))
      
      // 兼容多种后端响应格式
      const data = res?.data || res
      console.log('[Profile] 提取的数据:', JSON.stringify(data))
      
      if (data && typeof data === 'object') {
        const stats = {
          auctionCount: data.auctionCount ?? data.auction_count ?? data.participatedAuctions ?? 0,
          bidCount: data.bidCount ?? data.bid_count ?? data.totalBids ?? 0,
          winCount: data.winCount ?? data.win_count ?? data.wonAuctions ?? 0,
          favoriteCount: data.favoriteCount ?? data.favorite_count ?? data.favorites ?? 0,
        }
        console.log('[Profile] 最终统计数据:', JSON.stringify(stats))
        this.setData({ stats })
      } else {
        console.warn('[Profile] 统计数据格式异常:', data)
      }
    } catch (err) {
      console.error('[Profile] 获取统计数据失败:', err)
    }
  },

  async loadUnreadCount() {
    try {
      const count = await notificationApiService.getUnreadCount()
      this.setData({ unreadCount: count })
      // 同步到全局状态
      app.updateUnreadCount(count, 'profile-page')
    } catch (err) {
      console.log('API获取未读消息数失败，回退到全局状态:', err)
      // API 失败时使用全局状态的值作为兜底
      const fallbackCount = app.getUnreadCount()
      this.setData({ unreadCount: fallbackCount })
    }
  },

  onLoginTap() {
    wx.navigateTo({
      url: '/pages/login/login',
    })
  },

  onEditProfile() {
    if (!this.requireLogin()) return
    wx.navigateTo({
      url: '/pages/profile/edit-profile',
    })
  },

  onChangePassword() {
    if (!this.requireLogin()) return
    wx.navigateTo({
      url: '/pages/profile/change-password',
    })
  },

  onAddressForm() {
    if (!this.requireLogin()) return
    wx.navigateTo({
      url: '/pages/profile/address-form',
    })
  },

  onBidHistory() {
    if (!this.requireLogin()) return
    wx.navigateTo({
      url: '/pages/profile/bid-history',
    })
  },

  onMyOrders() {
    if (!this.requireLogin()) return
    wx.switchTab({
      url: '/pages/orders/list',
    })
  },

  onMyFavorites() {
    if (!this.requireLogin()) return
    wx.navigateTo({
      url: '/pages/profile/favorites',
    })
  },

  onNotificationSetting() {
    if (!this.requireLogin()) return
    wx.navigateTo({
      url: '/pages/profile/notification',
    })
  },

  onHelpFeedback() {
    wx.navigateTo({
      url: '/pages/profile/help-feedback',
    })
  },

  onAboutUs() {
    wx.navigateTo({
      url: '/pages/profile/about-us',
    })
  },

  onLogout() {
    this.setData({ showLogoutModal: true })
  },

  async confirmLogout() {
    this.setData({ showLogoutModal: false })
    
    wx.showLoading({ title: '退出中...' })
    
    try {
      await authService.logout()
    } catch (err) {
      console.log('退出接口调用失败，继续本地退出', err)
    }
    
    wx.hideLoading()
    app.logout()
  },

  cancelLogout() {
    this.setData({ showLogoutModal: false })
  },

  requireLogin(): boolean {
    if (!this.data.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '此功能需要登录，是否前往登录？',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login',
            })
          }
        },
      })
      return false
    }
    return true
  },

  onPullDownRefresh() {
    if (this.data.isLoggedIn) {
      Promise.all([
        this.loadUserInfo(),
        this.loadStats(),
        this.loadUnreadCount(),
      ]).finally(() => {
        wx.stopPullDownRefresh()
      })
    } else {
      wx.stopPullDownRefresh()
    }
  },
})
