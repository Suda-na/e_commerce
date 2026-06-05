// 出价历史页面逻辑
const app = getApp<IAppOption>()
import { bidService } from '../../services/bid.service'

Page({
  data: {
    // 全部出价数据（未筛选）
    allBidList: [] as any[],
    // 当前显示的列表（筛选后）
    bidList: [] as any[],

    // 分页参数
    page: 1,
    limit: 20,
    total: 0,
    hasMore: true,

    // 状态管理
    loading: false,
    refreshing: false,
    loadingMore: false,

    // 筛选条件
    statusFilter: 'all', // all, active, won, lost

    // 统计数据
    stats: {
      totalBids: 0,
      wonBids: 0,
      totalAmount: 0,
    },
  },

  onLoad() {
    this.loadBidHistory()
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.refreshData()
  },

  // 刷新数据
  async refreshData() {
    this.setData({
      page: 1,
      hasMore: true,
      allBidList: [],
      bidList: [],
    })
    await this.loadBidHistory()
  },

  // 加载出价历史
  async loadBidHistory() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const { page, limit } = this.data

      console.log('[BidHistory] 开始加载出价历史, page:', page, 'limit:', limit)
      const res = await bidService.getMyBidHistory(page, limit)
      console.log('[BidHistory] API响应:', JSON.stringify(res))

      let list: any[] = []
      let total = 0

      // 兼容多种后端响应格式
      // 后端返回格式: { bids: [...], total, page, limit, totalPages }
      const data = res?.data ?? res
      console.log('[BidHistory] 提取的数据:', JSON.stringify(data))

      if (data) {
        if (Array.isArray(data)) {
          list = data
          total = data.length
        } else if (typeof data === 'object') {
          list = data.bids || data.list || data.items || data.records || data.rows || []
          total = data.total || data.count || data.totalCount || list.length
        }

        console.log('[BidHistory] 解析后的列表:', { listLen: list.length, total, firstItem: list[0] })

        if (list.length > 0) {
          list = this.formatBidList(list)
          // 按竞拍分组，每个竞拍只保留最新一条出价
          list = this.deduplicateByAuction(list)
        }
      }

      // 合并全量数据
      const newAllBidList = page === 1 ? list : [...this.data.allBidList, ...list]

      // 根据当前筛选条件过滤
      const filteredList = this.filterByStatus(newAllBidList, this.data.statusFilter)

      // 计算统计（基于全量数据）
      this.calculateStats(newAllBidList)

      this.setData({
        allBidList: newAllBidList,
        bidList: filteredList,
        total,
        hasMore: list.length >= limit,
        page: page + 1,
      })
    } catch (err) {
      console.error('[BidHistory] 加载出价历史失败:', err)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false, refreshing: false, loadingMore: false })
    }
  },

  // 根据状态筛选
  filterByStatus(list: any[], status: string): any[] {
    if (status === 'all') return list
    return list.filter((item: any) => item.status === status)
  },

  // 按竞拍去重，同一竞拍只保留最新出价（后端按created_at DESC排序，第一条即最新）
  deduplicateByAuction(list: any[]): any[] {
    const seen = new Map<number, any>()
    for (const item of list) {
      if (!seen.has(item.auctionId)) {
        seen.set(item.auctionId, item)
      }
    }
    return Array.from(seen.values())
  },

  // 格式化出价列表
  formatBidList(list: any[]): any[] {
    return list.map((item: any) => {
      const timeStr = this.formatTime(item.created_at || item.createdAt || item.bidTime || item.time)

      // 兼容多种嵌套结构
      const auction = item.auction || item.Auction || {}
      const product = auction.product || auction.Product || {}

      // 判断竞拍状态和用户中标情况
      let status = 'active'
      const auctionStatus = auction.status || item.auctionStatus || 'active'
      const winnerId = auction.winner_id || auction.winnerId
      const userId = item.user_id || item.userId

      if (auctionStatus === 'completed' || auctionStatus === 'ended') {
        if (winnerId && userId && String(winnerId) === String(userId)) {
          status = 'won'
        } else {
          status = 'lost'
        }
      } else if (auctionStatus === 'cancelled') {
        status = 'cancelled'
      } else {
        status = 'active'
      }

      // 如果 item 自带 status 字段（后端已计算好），优先使用
      if (item.status === 'won' || item.bidStatus === 'won') {
        status = 'won'
      } else if (item.status === 'lost' || item.bidStatus === 'lost') {
        status = 'lost'
      }

      let statusText = ''
      let statusClass = ''
      switch (status) {
        case 'active':
          statusText = '竞拍中'
          statusClass = 'status-active'
          break
        case 'won':
          statusText = '已获胜'
          statusClass = 'status-won'
          break
        case 'lost':
          statusText = '未获胜'
          statusClass = 'status-lost'
          break
        case 'cancelled':
          statusText = '已取消'
          statusClass = 'status-cancelled'
          break
        default:
          statusText = '竞拍中'
          statusClass = 'status-active'
      }

      // 提取商品名称
      const auctionTitle = product.name || product.title || auction.title || auction.name || item.auctionTitle || item.productName || '未知商品'

      // 提取商品图片
      let auctionImage = ''
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        auctionImage = product.images[0]
      } else {
        auctionImage = auction.image || auction.cover || auction.thumbnail || item.auctionImage || item.productImage || ''
      }

      // 提取当前价格
      const currentPrice = parseFloat(auction.current_price || auction.currentPrice || item.currentPrice || item.amount || 0)

      // 提取merchantId用于跳转
      const merchantId = product.merchant_id || product.merchantId || auction.merchant_id || auction.merchantId || ''

      return {
        id: item.id || item._id || item.bidId || `${item.auction_id}_${item.amount}_${Date.now()}`,
        auctionId: auction.id || item.auction_id || item.auctionId,
        auctionTitle,
        auctionImage,
        amount: parseFloat(item.amount || item.bidAmount || item.price || 0),
        currentPrice,
        time: timeStr,
        status,
        statusText,
        statusClass,
        isLeading: status === 'won',
        auctionStatus,
        merchantId,
      }
    })
  },

  // 计算统计数据
  calculateStats(list: any[]) {
    const totalBids = list.length
    const wonBids = list.filter((item: any) => item.status === 'won').length
    const totalAmount = list.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)

    this.setData({
      stats: {
        totalBids,
        wonBids,
        totalAmount,
      },
    })
  },

  // 格式化时间
  formatTime(timeStr: string): string {
    if (!timeStr) return ''

    const date = new Date(timeStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // 1分钟内
    if (diff < 60 * 1000) {
      return '刚刚'
    }

    // 1小时内
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000))
      return `${minutes}分钟前`
    }

    // 24小时内
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000))
      return `${hours}小时前`
    }

    // 7天内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000))
      return `${days}天前`
    }

    // 超过7天显示具体日期
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')

    return `${month}-${day} ${hours}:${minutes}`
  },

  // 切换状态筛选（本地过滤，不重新请求）
  onStatusFilterChange(e: WechatMiniprogram.TouchEvent) {
    const status = e.currentTarget.dataset.status
    if (status === this.data.statusFilter) return

    const filteredList = this.filterByStatus(this.data.allBidList, status)

    this.setData({
      statusFilter: status,
      bidList: filteredList,
    })
  },

  // 点击出价项 - 跳转到直播间查看竞拍详情（参考订单详情的跳转逻辑）
  onBidItemTap(e: WechatMiniprogram.TouchEvent) {
    const { auctionId, merchantId } = e.currentTarget.dataset
    if (!auctionId) return

    // 参考订单详情的goToLiveRoom逻辑：同时传递merchantId和auctionId
    if (merchantId && auctionId) {
      wx.navigateTo({
        url: `/pages/live/live-room?merchantId=${merchantId}&auctionId=${auctionId}`,
      })
      return
    }

    // 只有auctionId
    if (auctionId) {
      wx.navigateTo({
        url: `/pages/live/live-room?auctionId=${auctionId}`,
      })
    }
  },

  // 返回
  onBack() {
    wx.navigateBack()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.setData({ loadingMore: true })
      this.loadBidHistory()
    }
  },

})
