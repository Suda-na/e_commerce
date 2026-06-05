import {
  NotificationType,
  NotificationCategory,
  NOTIFICATION_ICONS,
  NOTIFICATION_COLORS,
  NOTIFICATION_TYPE_NAMES,
  CATEGORY_BACKEND_MAP,
  TYPE_TO_CATEGORY,
  formatNotificationItem,
} from '../../utils/notification'
import { notificationApiService } from '../../services/notification-api.service'
import { eventBus, EVENTS } from '../../utils/event-bus'
import { getSocket } from '../../utils/socket'

const app = getApp<IAppOption>()

Page({
  data: {
    notifications: [] as any[],
    currentFilter: 'all' as string,
    filterOptions: [
      { value: NotificationCategory.ALL, label: '全部' },
      { value: NotificationCategory.WON, label: '中标' },
      { value: NotificationCategory.OUTBID, label: '被超越' },
      { value: NotificationCategory.ENDED, label: '结束' },
      { value: NotificationCategory.SYSTEM, label: '系统' },
    ],
    stats: {
      total: 0,
      unread: 0,
      today: 0,
      byCategory: {} as Record<string, number>,
    },
    loading: true,
    refreshing: false,
    editMode: false,
    selectedIds: [] as number[],
    isEmpty: false,
    icons: NOTIFICATION_ICONS,
    colors: NOTIFICATION_COLORS,
    typeNames: NOTIFICATION_TYPE_NAMES,
    page: 1,
    limit: 20,
    hasMore: true,
    loadingMore: false,
  },

  /** EventBus 和 Socket 事件处理函数引用（用于卸载） */
  _onNewNotification: null as any,
  _onNotificationReadChange: null as any,
  _onUnreadCountChange: null as any,
  _onSocketNewNotification: null as any,
  _onSocketOutbid: null as any,
  _onSocketAuctionWon: null as any,
  _onSocketAuctionEnded: null as any,
  _onSocketAuctionCancelled: null as any,

  onLoad() {
    // 初始加载在 onShow 中处理
  },

  onShow() {
    this.loadNotifications()
    this.loadStats()
    this.setupEventBusListeners()
    this.setupSocketListeners()
  },

  onHide() {
    this.removeEventBusListeners()
    this.removeSocketListeners()
  },

  onUnload() {
    this.removeEventBusListeners()
    this.removeSocketListeners()
  },

  /**
   * 设置 EventBus 监听器
   * 监听新通知和已读状态变化，实现实时更新
   */
  setupEventBusListeners() {
    // 监听新通知事件（来自 WebSocket 推送）
    this._onNewNotification = () => {
      console.log('[Notification] 收到新通知事件，刷新列表')
      this.loadNotifications()
      this.loadStats()
    }
    eventBus.on(EVENTS.NEW_NOTIFICATION, this._onNewNotification)

    // 监听已读状态变化（来自其他页面的标记已读操作）
    this._onNotificationReadChange = (data: any) => {
      console.log('[Notification] 收到已读状态变化事件:', data)
      this.loadStats()
    }
    eventBus.on(EVENTS.NOTIFICATION_READ_CHANGE, this._onNotificationReadChange)

    // 监听全局未读数变化（来自轮询等来源）
    this._onUnreadCountChange = (data: any) => {
      if (data && typeof data.count === 'number') {
        this.setData({ 'stats.unread': data.count })
      }
    }
    eventBus.on(EVENTS.UNREAD_COUNT_CHANGE, this._onUnreadCountChange)
  },

  /**
   * 移除 EventBus 监听器
   */
  removeEventBusListeners() {
    if (this._onNewNotification) {
      eventBus.off(EVENTS.NEW_NOTIFICATION, this._onNewNotification)
      this._onNewNotification = null
    }
    if (this._onNotificationReadChange) {
      eventBus.off(EVENTS.NOTIFICATION_READ_CHANGE, this._onNotificationReadChange)
      this._onNotificationReadChange = null
    }
    if (this._onUnreadCountChange) {
      eventBus.off(EVENTS.UNREAD_COUNT_CHANGE, this._onUnreadCountChange)
      this._onUnreadCountChange = null
    }
  },

  /**
   * 设置 WebSocket 监听器
   * 当用户停留在通知页面时，实时接收新通知
   */
  setupSocketListeners() {
    try {
      const socket = getSocket()
      if (!socket || !socket.isConnected()) return

      this._onSocketNewNotification = (data: any) => {
        console.log('[Notification] WebSocket 收到新通知:', data)
        this.loadNotifications()
        this.loadStats()
      }
      this._onSocketOutbid = (data: any) => {
        console.log('[Notification] WebSocket 收到出价被超越:', data)
        this.loadNotifications()
        this.loadStats()
      }
      this._onSocketAuctionWon = (data: any) => {
        console.log('[Notification] WebSocket 收到中标通知:', data)
        this.loadNotifications()
        this.loadStats()
      }
      this._onSocketAuctionEnded = (data: any) => {
        console.log('[Notification] WebSocket 收到竞拍结束通知:', data)
        this.loadNotifications()
        this.loadStats()
      }
      this._onSocketAuctionCancelled = (data: any) => {
        console.log('[Notification] WebSocket 收到竞拍取消通知:', data)
        this.loadNotifications()
        this.loadStats()
      }

      socket.on('new_notification', this._onSocketNewNotification)
      socket.on('outbid', this._onSocketOutbid)
      socket.on('auction_won', this._onSocketAuctionWon)
      socket.on('auction_ended', this._onSocketAuctionEnded)
      socket.on('auction_cancelled', this._onSocketAuctionCancelled)
    } catch (e) {
      console.error('[Notification] 设置 WebSocket 监听器失败:', e)
    }
  },

  /**
   * 移除 WebSocket 监听器
   */
  removeSocketListeners() {
    try {
      const socket = getSocket()
      if (!socket) return

      if (this._onSocketNewNotification) {
        socket.off('new_notification', this._onSocketNewNotification)
        this._onSocketNewNotification = null
      }
      if (this._onSocketOutbid) {
        socket.off('outbid', this._onSocketOutbid)
        this._onSocketOutbid = null
      }
      if (this._onSocketAuctionWon) {
        socket.off('auction_won', this._onSocketAuctionWon)
        this._onSocketAuctionWon = null
      }
      if (this._onSocketAuctionEnded) {
        socket.off('auction_ended', this._onSocketAuctionEnded)
        this._onSocketAuctionEnded = null
      }
      if (this._onSocketAuctionCancelled) {
        socket.off('auction_cancelled', this._onSocketAuctionCancelled)
        this._onSocketAuctionCancelled = null
      }
    } catch (e) {
      console.error('[Notification] 移除 WebSocket 监听器失败:', e)
    }
  },

  async loadNotifications(append: boolean = false) {
    if (this.data.loadingMore) return

    if (!append) {
      this.setData({ loading: true, page: 1 })
    } else {
      this.setData({ loadingMore: true })
    }

    try {
      const { page, limit, currentFilter } = this.data
      const params: any = { page, limit }

      if (currentFilter !== NotificationCategory.ALL) {
        const backendCategory = CATEGORY_BACKEND_MAP[currentFilter]
        if (backendCategory) {
          params.category = backendCategory
        }
      }

      console.log('[Notification] 开始加载通知列表, 参数:', JSON.stringify(params))
      const result = await notificationApiService.getNotifications(params)
      console.log('[Notification] API 响应原始数据:', JSON.stringify(result))

      // 兼容多种响应格式：
      // 1. { notifications: [...], total: N } - 直接格式
      // 2. { data: { notifications: [...], total: N } } - 嵌套格式
      // 3. [...] - 数组格式
      let data: any = null
      if (result && typeof result === 'object') {
        if (result.data && typeof result.data === 'object') {
          // 嵌套格式：result.data 可能包含 notifications
          data = result.data
        } else if (result.notifications || result.list || result.items || Array.isArray(result)) {
          // 直接格式
          data = result
        }
      }
      console.log('[Notification] 提取的数据:', JSON.stringify(data))

      const rawList = data?.notifications || data?.list || data?.items || (Array.isArray(data) ? data : [])
      console.log('[Notification] 原始通知列表长度:', rawList.length)

      const notifications = rawList.map((item: any) => {
        const formatted = formatNotificationItem(item)
        console.log('[Notification] 格式化通知:', item.type, '->', formatted.type, formatted.title)
        return formatted
      })
      const totalCount = data?.total || notifications.length

      console.log('[Notification] 最终通知列表长度:', notifications.length, '总数:', totalCount)

      this.setData({
        notifications: append ? [...this.data.notifications, ...notifications] : notifications,
        isEmpty: (append ? this.data.notifications.length + notifications.length : notifications.length) === 0,
        hasMore: notifications.length >= limit,
        loading: false,
        loadingMore: false,
      })
    } catch (e) {
      console.error('[Notification] 加载通知失败:', e)
      this.setData({ loading: false, loadingMore: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadStats() {
    try {
      console.log('[Notification] 开始加载通知统计...')
      const result = await notificationApiService.getStats()
      console.log('[Notification] 统计API响应:', JSON.stringify(result))

      // 兼容多种响应格式
      let data: any = null
      if (result && typeof result === 'object') {
        if (result.data && typeof result.data === 'object') {
          data = result.data
        } else if (result.total !== undefined || result.unread !== undefined) {
          data = result
        }
      }
      console.log('[Notification] 提取的统计数据:', JSON.stringify(data))

      if (data) {
        const total = data.total || 0
        const unread = data.unread || data.unreadCount || 0
        const todayCount = data.todayCount || data.today || 0
        const byCategory = data.byCategory || {}

        console.log('[Notification] 最终统计数据:', { total, unread, todayCount, byCategory })

        this.setData({
          stats: {
            total,
            unread,
            today: todayCount,
            byCategory,
          },
        })

        // 同步未读消息数到全局状态
        app.updateUnreadCount(unread, 'notification-page')
      }
    } catch (e) {
      console.error('[Notification] 加载通知统计失败:', e)
    }
  },

  onFilterChange(e: any) {
    const { value } = e.currentTarget.dataset
    this.setData({ currentFilter: value })
    this.loadNotifications()
  },

  async onNotificationTap(e: any) {
    const { id } = e.currentTarget.dataset
    const notification = this.data.notifications.find((n: any) => n.id === id)
    if (!notification) return

    if (!notification.read) {
      try {
        await notificationApiService.markAsRead(id)
        const idx = this.data.notifications.findIndex((n: any) => n.id === id)
        if (idx > -1) {
          const category = TYPE_TO_CATEGORY[notification.type as NotificationType] || ''
          const byCategory = { ...this.data.stats.byCategory }
          if (category && byCategory[category] > 0) {
            byCategory[category]--
          }
          this.setData({
            [`notifications[${idx}].read`]: true,
            'stats.unread': Math.max(0, this.data.stats.unread - 1),
            'stats.byCategory': byCategory,
          })

          // 同步减少全局未读消息数
          app.decrementUnreadCount(1, 'notification-mark-read')
        }
      } catch (err) {
        console.error('标记已读失败', err)
      }
    }
  },

  onNotificationLongPress(e: any) {
    const { id } = e.currentTarget.dataset
    const notification = this.data.notifications.find((n: any) => n.id === id)
    if (!notification) return

    const itemList = notification.read
      ? ['删除该通知']
      : ['标记为已读', '删除该通知']

    wx.showActionSheet({
      itemList,
      success: async (res) => {
        try {
          if (!notification.read && res.tapIndex === 0) {
            await notificationApiService.markAsRead(id)
            // 标记为已读，减少全局未读数
            app.decrementUnreadCount(1, 'notification-long-press-mark-read')
          } else {
            const deleteIndex = notification.read ? 0 : 1
            if (res.tapIndex === deleteIndex) {
              await notificationApiService.deleteNotification(id)
              // 删除未读通知，减少全局未读数
              if (!notification.read) {
                app.decrementUnreadCount(1, 'notification-long-press-delete-unread')
              }
            }
          }
          this.loadNotifications()
          this.loadStats()
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      },
    })
  },

  toggleEditMode() {
    this.setData({
      editMode: !this.data.editMode,
      selectedIds: [],
    })
  },

  onSelectNotification(e: any) {
    const { id } = e.currentTarget.dataset
    const { selectedIds } = this.data
    const index = selectedIds.indexOf(id)

    if (index === -1) {
      selectedIds.push(id)
    } else {
      selectedIds.splice(index, 1)
    }

    this.setData({ selectedIds: [...selectedIds] })
  },

  onSelectAll() {
    const { notifications, selectedIds } = this.data

    if (selectedIds.length === notifications.length) {
      this.setData({ selectedIds: [] })
    } else {
      this.setData({
        selectedIds: notifications.map((n: any) => n.id),
      })
    }
  },

  async onDeleteSelected() {
    const { selectedIds } = this.data

    if (selectedIds.length === 0) {
      wx.showToast({ title: '请选择要删除的通知', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedIds.length} 条通知吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            // 计算要删除的未读通知数量
            const unreadCountToDelete = this.data.notifications.filter(
              (n: any) => selectedIds.includes(n.id) && !n.read
            ).length

            for (const id of selectedIds) {
              await notificationApiService.deleteNotification(id)
            }
            this.setData({ selectedIds: [] })
            this.loadNotifications()
            this.loadStats()
            
            // 减少全局未读数
            if (unreadCountToDelete > 0) {
              app.decrementUnreadCount(unreadCountToDelete, 'notification-delete-selected')
            }
            
            wx.showToast({ title: '删除成功', icon: 'success' })
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      },
    })
  },

  onMarkAllRead() {
    wx.showModal({
      title: '确认操作',
      content: '确定要将所有通知标记为已读吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await notificationApiService.markAllAsRead()
            this.loadNotifications()
            this.loadStats()
            // 全部标记为已读，将全局未读数设置为0
            app.updateUnreadCount(0, 'notification-mark-all-read')
            wx.showToast({ title: '操作成功', icon: 'success' })
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      },
    })
  },

  onClearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有已读通知吗？',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            await notificationApiService.deleteAllRead()
            this.loadNotifications()
            this.loadStats()
            wx.showToast({ title: '清空成功', icon: 'success' })
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      },
    })
  },

  onLoadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return
    this.setData({ page: this.data.page + 1 })
    this.loadNotifications(true)
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    Promise.all([
      this.loadNotifications(),
      this.loadStats(),
    ]).finally(() => {
      wx.stopPullDownRefresh()
      this.setData({ refreshing: false })
    })
  },

})
