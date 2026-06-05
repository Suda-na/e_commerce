import { orderService } from '../../services/order.service'
import { authService } from '../../services/auth.service'
import { checkNetwork } from '../../utils/network'

// 订单状态类型
type OrderStatus = 'all' | 'pending' | 'paid' | 'shipped' | 'refunding' | 'refunded' | 'cancelled'

// 订单数据接口
interface Order {
  id: string
  auctionId: string
  auction?: {
    id: string
    product?: {
      id: string
      name: string
      images?: string[]
    }
    currentPrice?: number
  }
  userId: string
  amount: number
  status: 'pending' | 'paid' | 'shipped' | 'refunding' | 'refunded' | 'cancelled'
  createdAt: string
  updatedAt: string
}

// 分页参数
interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

Page({
  data: {
    // 订单列表
    orders: [] as Order[],
    // 当前筛选状态
    currentStatus: 'all' as OrderStatus,
    // 状态筛选选项
    statusTabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待付款' },
      { key: 'paid', label: '已付款' },
      { key: 'shipped', label: '已发货' },
      { key: 'refunding', label: '退款中' },
      { key: 'refunded', label: '已退款' },
      { key: 'cancelled', label: '已取消' }
    ],
    // 分页信息
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    } as Pagination,
    // 加载状态
    loading: false,
    loadingMore: false,
    noMore: false,
    // 空状态
    isEmpty: false
  },

  onLoad() {
    console.log('Orders list page loaded')
    // 检查登录状态
    const app = getApp<IAppOption>()
    console.log('订单页面onLoad，登录状态:', app.globalData.isLoggedIn, 'token:', app.globalData.token ? '***已隐藏***' : '无')
    
    if (!app.globalData.isLoggedIn) {
      console.log('未登录，跳转登录页')
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      })
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/login/login'
        })
      }, 1500)
      return
    }
    this.loadOrders(true)
  },

  onShow() {
    // 页面显示时检查登录状态并刷新数据
    const app = getApp<IAppOption>()
    console.log('订单页面onShow，登录状态:', app.globalData.isLoggedIn, 'token:', app.globalData.token ? '***已隐藏***' : '无')
    if (!app.globalData.isLoggedIn) {
      // 未登录，跳转登录页
      wx.navigateTo({
        url: '/pages/login/login'
      })
      return
    }
    // 已登录，加载数据
    this.loadOrders(true)
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadOrders(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.loadingMore || this.data.noMore) return
    this.loadOrders(false)
  },

  // 加载订单列表
  async loadOrders(refresh: boolean = false) {
    if (this.data.loading) return

    const page = refresh ? 1 : this.data.pagination.page + 1
    this.setData({ loading: true, loadingMore: !refresh })

    try {
      // 检查网络状态
      const isOnline = await checkNetwork(true)
      if (!isOnline) {
        this.setData({ loading: false, loadingMore: false })
        return
      }

      // 调试：检查token
      const app = getApp<IAppOption>()
      const token = app.globalData.token || wx.getStorageSync('token')
      console.log('准备请求订单列表，token:', token ? '***已隐藏***' : '无')

      const params: any = {
        page,
        limit: this.data.pagination.limit
      }

      // 添加状态筛选
      if (this.data.currentStatus !== 'all') {
        params.status = this.data.currentStatus
      }

      const result = await orderService.getOrderList(params)
      
      // 处理订单数据，格式化金额用于显示
      const rawOrders = result.list || []
      const orders = rawOrders.map((order: any) => ({
        ...order,
        amountDisplay: this.formatAmount(order.amount)
      }))
      const total = result.total || 0
      const totalPages = Math.ceil(total / this.data.pagination.limit)

      if (refresh) {
        this.setData({
          orders,
          pagination: {
            page: 1,
            limit: this.data.pagination.limit,
            total,
            totalPages
          },
          isEmpty: orders.length === 0,
          noMore: page >= totalPages
        })
      } else {
        this.setData({
          orders: [...this.data.orders, ...orders],
          pagination: {
            ...this.data.pagination,
            page,
            total,
            totalPages
          },
          noMore: page >= totalPages
        })
      }
    } catch (error: any) {
      console.error('加载订单列表失败:', error)
      // 检查是否是401未授权错误
      if (error.message && error.message.includes('未授权')) {
        wx.showToast({
          title: '登录已过期，请重新登录',
          icon: 'none',
          duration: 2000
        })
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/login/login'
          })
        }, 1500)
      } else {
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        })
      }
    } finally {
      this.setData({ loading: false, loadingMore: false })
    }
  },

  // 切换状态筛选
  onStatusChange(e: WechatMiniprogram.TouchEvent) {
    const status = e.currentTarget.dataset.status as OrderStatus
    if (status === this.data.currentStatus) return

    this.setData({ 
      currentStatus: status,
      orders: [],
      isEmpty: false,
      noMore: false
    })
    this.loadOrders(true)
  },

  // 跳转到订单详情
  goToOrderDetail(e: WechatMiniprogram.TouchEvent) {
    const orderId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/orders/detail?id=${orderId}`
    })
  },

  // 格式化金额
  formatAmount(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '¥0.00'
    return `¥${num.toFixed(2)}`
  },

  // 模拟支付
  async handlePayOrder(e: WechatMiniprogram.TouchEvent) {
    const orderId = e.currentTarget.dataset.id
    const order = this.data.orders.find(o => o.id === orderId)
    if (!order) return

    // 先获取用户收货地址
    let shippingAddress = ''
    let receiverName = ''
    let receiverPhone = ''
    try {
      const profileRes = await authService.getUserInfo()
      const profile = profileRes?.data || profileRes
      const user = profile?.user || profile
      if (user) {
        const addressParts = [
          user.province,
          user.city,
          user.district,
          user.detail_address
        ].filter(Boolean)
        shippingAddress = addressParts.join(' ')
        receiverName = user.receiver_name || ''
        receiverPhone = user.receiver_phone || ''
      }
    } catch (e) {
      console.warn('获取用户地址失败:', e)
    }

    if (!shippingAddress) {
      wx.showModal({
        title: '请先设置收货地址',
        content: '支付前需要设置收货地址，是否前往设置？',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/profile/address-form'
            })
          }
        }
      })
      return
    }

    const addressDisplay = [receiverName, receiverPhone, shippingAddress].filter(Boolean).join(' ')
    wx.showModal({
      title: '确认模拟支付',
      content: `订单金额：${order.amountDisplay || '¥0.00'}\n收货信息：${addressDisplay}\n这是一个演示功能，将模拟完成支付流程`,
      confirmText: '确认支付',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '支付中...', mask: true })
            await orderService.payOrder(orderId, shippingAddress)
            wx.hideLoading()
            wx.showToast({
              title: '支付成功',
              icon: 'success'
            })
            // 刷新列表
            this.loadOrders(true)
          } catch (error) {
            wx.hideLoading()
            console.error('支付失败:', error)
            wx.showToast({
              title: '支付失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 取消订单
  async handleCancelOrder(e: WechatMiniprogram.TouchEvent) {
    const orderId = e.currentTarget.dataset.id
    const order = this.data.orders.find(o => o.id === orderId)
    if (!order) return

    wx.showModal({
      title: '确认取消订单',
      content: '取消后将无法恢复，确定要取消这个订单吗？',
      confirmText: '确认取消',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '取消中...', mask: true })
            await orderService.cancelOrder(orderId)
            wx.hideLoading()
            wx.showToast({
              title: '订单已取消',
              icon: 'success'
            })
            // 刷新列表
            this.loadOrders(true)
          } catch (error) {
            wx.hideLoading()
            console.error('取消失败:', error)
            wx.showToast({
              title: '取消失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 获取状态文本
  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      pending: '待付款',
      paid: '已付款',
      shipped: '已发货',
      refunding: '退款中',
      refunded: '已退款',
      cancelled: '已取消'
    }
    return statusMap[status] || '未知状态'
  },

  // 获取状态颜色
  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      pending: '#FF9500',
      paid: '#34C759',
      shipped: '#1677ff',
      refunding: '#FAAD14',
      refunded: '#52C41A',
      cancelled: '#8E8E93'
    }
    return colorMap[status] || '#8E8E93'
  },

  // 格式化金额
  formatPrice(price: number): string {
    return `¥${price.toFixed(2)}`
  },

  // 格式化时间
  formatTime(time: string): string {
    if (!time) return ''
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // 小于1分钟
    if (diff < 60000) {
      return '刚刚'
    }
    // 小于1小时
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`
    }
    // 小于24小时
    if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`
    }
    // 大于24小时
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
  },

  // 跳转到发现页面
  goToDiscover() {
    wx.switchTab({
      url: '/pages/discover/index'
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '我的订单 - 直播竞拍大师',
      path: '/pages/orders/list'
    }
  }
})