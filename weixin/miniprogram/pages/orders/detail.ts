import { orderService } from '../../services/order.service'
import { authService } from '../../services/auth.service'

// 订单数据接口
interface Order {
  id: string
  auctionId: string
  auction?: {
    id: string
    product?: {
      id: string
      name: string
      description?: string
      images?: string[]
      startingPrice?: number
      priceIncrement?: number
    }
    currentPrice?: number
    winnerId?: string
    status?: string
  }
  userId: string
  amount: number
  status: 'pending' | 'paid' | 'shipped' | 'refunding' | 'refunded' | 'cancelled'
  createdAt: string
  updatedAt: string
}

Page({
  data: {
    // 订单ID
    orderId: '',
    // 订单详情
    order: null as Order | null,
    // 格式化后的订单数据（用于wxml显示）
    orderDisplay: null as any,
    // 加载状态
    loading: true,
    // 错误信息
    error: '',
    // 支付中
    paying: false,
    // 取消中
    cancelling: false
  },

  onLoad(options: any) {
    console.log('Order detail page loaded')
    // 检查登录状态
    const app = getApp<IAppOption>()
    if (!app.globalData.isLoggedIn) {
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
    if (options.id) {
      this.setData({ orderId: options.id })
      this.loadOrderDetail(options.id)
    } else {
      this.setData({ 
        loading: false,
        error: '订单ID不存在'
      })
    }
  },

  onShow() {
    // 页面显示时刷新数据
    if (this.data.orderId && this.data.order) {
      this.loadOrderDetail(this.data.orderId)
    }
  },

  // 加载订单详情
  async loadOrderDetail(orderId: string) {
    this.setData({ loading: true, error: '' })

    try {
      const order = await orderService.getOrderDetail(orderId)
      console.log('[OrderDetail] 原始订单数据:', order)
      
      // 格式化订单数据用于显示
      const orderDisplay = this.formatOrderForDisplay(order)
      console.log('[OrderDetail] 格式化后的数据:', orderDisplay)
      
      this.setData({
        order,
        orderDisplay,
        loading: false
      })
    } catch (error: any) {
      console.error('加载订单详情失败:', error)
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
        this.setData({
          loading: false,
          error: '加载订单详情失败，请重试'
        })
      }
    }
  },

  // 格式化订单数据用于wxml显示
  formatOrderForDisplay(order: any): any {
    if (!order) return null
    
    // 获取状态文本和颜色
    const statusTextMap: Record<string, string> = {
      pending: '待付款',
      paid: '已付款',
      shipped: '已发货',
      refunding: '退款中',
      refunded: '已退款',
      cancelled: '已取消'
    }
    const statusColorMap: Record<string, string> = {
      pending: '#FF9500',
      paid: '#34C759',
      shipped: '#1677ff',
      refunding: '#FAAD14',
      refunded: '#52C41A',
      cancelled: '#8E8E93'
    }
    const statusIconMap: Record<string, string> = {
      pending: '⏳',
      paid: '✅',
      shipped: '🚚',
      refunding: '💰',
      refunded: '💳',
      cancelled: '❌'
    }
    const statusDescMap: Record<string, string> = {
      pending: '请在24小时内完成支付',
      paid: '订单已完成支付，等待商家发货',
      shipped: '商家已发货，请注意查收',
      refunding: '退款处理中，请耐心等待',
      refunded: '退款已完成',
      cancelled: '订单已取消'
    }
    
    // 获取商品信息（兼容嵌套结构）
    const auction = order.auction || {}
    const product = auction.product || {}
    
    return {
      // 订单基本信息
      id: order.id || '',
      auctionId: order.auctionId || order.auction_id || '',
      amount: this.formatPrice(order.amount || 0),
      status: order.status || '',
      statusText: statusTextMap[order.status] || '未知状态',
      statusColor: statusColorMap[order.status] || '#8E8E93',
      statusIcon: statusIconMap[order.status] || '❓',
      statusDesc: statusDescMap[order.status] || '未知状态',
      createdAt: this.formatTime(order.createdAt || order.created_at),
      updatedAt: this.formatTime(order.updatedAt || order.updated_at),
      
      // 收货地址
      shippingAddress: order.shippingAddress || order.shipping_address || '',
      receiverName: order.receiverName || order.receiver_name || '',
      receiverPhone: order.receiverPhone || order.receiver_phone || '',
      
      // 竞拍信息
      auction: {
        id: auction.id || '',
        currentPrice: this.formatPrice(auction.currentPrice || auction.current_price || 0),
        status: auction.status || '',
        endTime: auction.endTime || auction.end_time || '',
        merchantId: auction.merchantId || auction.merchant_id || ''
      },
      
      // 商品信息
      product: {
        id: product.id || '',
        name: product.name || '未知商品',
        description: product.description || '',
        image: (product.images && product.images[0]) || '/assets/images/default-live.png',
        merchantId: product.merchantId || product.merchant_id || ''
      },
      
      // 用户信息（如果有）
      user: order.user || null
    }
  },

  // 格式化金额
  formatPrice(price: number | string): string {
    const num = typeof price === 'string' ? parseFloat(price) : price
    if (isNaN(num)) return '¥0.00'
    return `¥${num.toFixed(2)}`
  },

  // 模拟支付
  async handlePayOrder() {
    if (this.data.paying || !this.data.order) return

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
      content: `订单金额：${this.data.orderDisplay?.amount || '¥0.00'}\n收货信息：${addressDisplay}\n这是一个演示功能，将模拟完成支付流程`,
      confirmText: '确认支付',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ paying: true })
          try {
            wx.showLoading({ title: '支付中...', mask: true })
            await orderService.payOrder(this.data.orderId, shippingAddress)
            wx.hideLoading()
            wx.showToast({
              title: '支付成功',
              icon: 'success'
            })
            // 刷新订单详情
            await this.loadOrderDetail(this.data.orderId)
          } catch (error) {
            wx.hideLoading()
            console.error('支付失败:', error)
            wx.showToast({
              title: '支付失败，请重试',
              icon: 'none'
            })
          } finally {
            this.setData({ paying: false })
          }
        }
      }
    })
  },

  // 取消订单
  async handleCancelOrder() {
    if (this.data.cancelling || !this.data.order) return

    wx.showModal({
      title: '确认取消订单',
      content: '取消后将无法恢复，确定要取消这个订单吗？',
      confirmText: '确认取消',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ cancelling: true })
          try {
            wx.showLoading({ title: '取消中...', mask: true })
            await orderService.cancelOrder(this.data.orderId)
            wx.hideLoading()
            wx.showToast({
              title: '订单已取消',
              icon: 'success'
            })
            // 刷新订单详情
            await this.loadOrderDetail(this.data.orderId)
          } catch (error) {
            wx.hideLoading()
            console.error('取消失败:', error)
            wx.showToast({
              title: '取消失败，请重试',
              icon: 'none'
            })
          } finally {
            this.setData({ cancelling: false })
          }
        }
      }
    })
  },

  // 返回订单列表
  goBack() {
    wx.navigateBack()
  },

  // 跳转到直播间（对应商家的对应商品竞拍详情）
  goToLiveRoom() {
    const { orderDisplay } = this.data
    if (!orderDisplay) return
    
    const merchantId = orderDisplay.product?.merchantId || orderDisplay.auction?.merchantId
    const auctionId = orderDisplay.auction?.id || orderDisplay.auctionId
    
    // 同时传递 merchantId 和 auctionId，直播间会自动打开对应竞拍详情
    if (merchantId && auctionId) {
      wx.navigateTo({
        url: `/pages/live/live-room?merchantId=${merchantId}&auctionId=${auctionId}`
      })
      return
    }
    
    // 只有 merchantId
    if (merchantId) {
      wx.navigateTo({
        url: `/pages/live/live-room?merchantId=${merchantId}`
      })
      return
    }
    
    // 只有 auctionId
    if (auctionId) {
      wx.navigateTo({
        url: `/pages/live/live-room?auctionId=${auctionId}`
      })
    }
  },

  // 获取状态文本（保留用于其他地方调用）
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

  // 获取状态颜色（保留用于其他地方调用）
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

  // 格式化时间
  formatTime(time: string): string {
    if (!time) return ''
    const date = new Date(time)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `订单详情 - ${this.data.orderDisplay?.product?.name || '直播竞拍大师'}`,
      path: `/pages/orders/detail?id=${this.data.orderId}`
    }
  }
})