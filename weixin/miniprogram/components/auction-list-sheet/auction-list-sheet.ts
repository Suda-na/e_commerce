// auction-list-sheet.ts
import { auctionService } from '../../services/auction.service'

interface AuctionItem {
  id: string
  title: string
  images: string[]
  currentPrice: number
  startPrice: number
  priceStep: number
  endTime: number
  status: 'pending' | 'active' | 'completed' | 'ended' | 'cancelled'
  statusText: string
  bidCount: number
  participantCount: number
}

interface Category {
  id: string
  name: string
  count: number
}

Component({
  properties: {
    // 是否显示
    visible: {
      type: Boolean,
      value: false
    },
    // 直播间ID
    liveRoomId: {
      type: String,
      value: ''
    },
    // 商家ID（用于筛选当前商家的竞拍）
    merchantId: {
      type: String,
      value: ''
    }
  },

  data: {
    // 分类列表（后端使用 completed 而非 ended）
    categories: [
      { id: 'all', name: '全部', count: 0 },
      { id: 'active', name: '进行中', count: 0 },
      { id: 'pending', name: '即将开始', count: 0 },
      { id: 'completed', name: '已结束', count: 0 }
    ] as Category[],
    
    // 当前选中分类
    activeCategory: 'all',
    
    // 竞拍列表
    auctionList: [] as AuctionItem[],
    
    // 加载状态
    isLoading: false,
    isLoadingMore: false,
    
    // 分页
    page: 1,
    pageSize: 20,
    hasMore: true,
    
    // 搜索
    searchKeyword: '',
    
    // 统计
    totalCount: 0
  },

  observers: {
    'visible': function(visible: boolean) {
      if (visible) {
        this.setData({ auctionList: [], page: 1, hasMore: true })
        this.loadAuctionList()
      }
    },
    // merchantId 变化时重新加载
    'merchantId': function(merchantId: string) {
      if (merchantId && this.data.visible) {
        this.setData({ auctionList: [], page: 1, hasMore: true })
        this.loadAuctionList()
      }
    }
  },

  methods: {
    // 加载竞拍列表
    async loadAuctionList(isRefresh = true) {
      if (this.data.isLoading) return
      
      this.setData({ isLoading: true })
      
      try {
        const { activeCategory, searchKeyword, page, pageSize, merchantId } = this.data
        
        // 构建查询参数
        const params: any = {
          page: isRefresh ? 1 : page,
          limit: pageSize,
          keyword: searchKeyword
        }
        
        // 添加状态筛选
        if (activeCategory !== 'all') {
          params.status = activeCategory
        }
        
        // 添加商家筛选（关键修复：只加载当前商家的竞拍）
        if (merchantId) {
          params.merchantId = merchantId
        }
        
        // 调用API获取竞拍列表
        const result = await auctionService.getAuctionList(params)
        
        // 处理数据 - 添加空值检查，统一字段名（后端 snake_case -> 前端 camelCase）
        const list = result?.list || []
        const newList = list.map((item: any) => {
          const product = item.product || {}
          return {
            ...item,
            id: String(item.id),
            title: item.title || product.name || '未知商品',
            images: item.images || product.images || [],
            // 确保数值类型正确（后端 DECIMAL 可能返回字符串）
            currentPrice: Number(item.currentPrice ?? item.current_price ?? product.starting_price ?? 0),
            startPrice: Number(item.startPrice ?? item.start_price ?? product.starting_price ?? 0),
            priceStep: Number(item.priceStep ?? item.price_step ?? product.price_increment ?? 1),
            endTime: new Date(item.endTime || item.end_time).getTime(),
            status: item.status,
            statusText: this.getStatusText(item.status),
            bidCount: Number(item.bidCount ?? item.bid_count ?? item.bids_count ?? 0),
            participantCount: Number(item.participant_count ?? item.participantCount ?? item.online_count ?? 0),
          }
        })
        
        // 更新分类计数
        this.updateCategoryCounts(result?.total || 0)
        
        if (isRefresh) {
          this.setData({
            auctionList: newList,
            page: 2,
            hasMore: newList.length >= pageSize,
            totalCount: result?.total || 0
          })
        } else {
          this.setData({
            auctionList: [...this.data.auctionList, ...newList],
            page: page + 1,
            hasMore: newList.length >= pageSize
          })
        }
      } catch (error) {
        console.error('[AuctionListSheet] 加载竞拍列表失败:', error)
        wx.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.setData({ isLoading: false })
      }
    },
    
    // 加载更多
    async loadMore() {
      if (this.data.isLoadingMore || !this.data.hasMore) return
      
      this.setData({ isLoadingMore: true })
      await this.loadAuctionList(false)
      this.setData({ isLoadingMore: false })
    },
    
    // 更新分类计数
    updateCategoryCounts(total: number) {
      const categories = [...this.data.categories]
      categories[0].count = total
      // 各分类的精确计数需要单独API查询，此处只更新总数
      this.setData({ categories })
    },
    
    // 获取状态文本（后端使用 completed 而非 ended）
    getStatusText(status: string): string {
      const statusMap: Record<string, string> = {
        pending: '即将开始',
        active: '竞拍中',
        completed: '已结束',
        ended: '已结束',
        cancelled: '已取消'
      }
      return statusMap[status] || status
    },
    
    // 切换分类
    onTapCategory(e: WechatMiniprogram.TouchEvent) {
      const { id } = e.currentTarget.dataset
      if (id === this.data.activeCategory) return
      
      this.setData({ 
        activeCategory: id,
        auctionList: [],
        page: 1,
        hasMore: true
      })
      this.loadAuctionList()
    },
    
    // 搜索输入
    onSearchInput(e: WechatMiniprogram.Input) {
      this.setData({ searchKeyword: e.detail.value })
    },
    
    // 搜索确认
    onSearchConfirm() {
      this.setData({ 
        auctionList: [],
        page: 1,
        hasMore: true
      })
      this.loadAuctionList()
    },
    
    // 清除搜索
    onClearSearch() {
      this.setData({ 
        searchKeyword: '',
        auctionList: [],
        page: 1,
        hasMore: true
      })
      this.loadAuctionList()
    },
    
    // 下拉刷新
    onRefresh() {
      this.loadAuctionList()
    },
    
    // 点击卡片
    onTapCard(e: WechatMiniprogram.CustomEvent) {
      const { auction } = e.detail || {}
      if (!auction || !auction.id) {
        console.warn('[AuctionListSheet] onTapCard: auction is undefined', e.detail)
        return
      }
      this.triggerEvent('cardtap', { auction })
    },
    
    // 点击出价按钮
    onTapBid(e: WechatMiniprogram.CustomEvent) {
      const { auction } = e.detail || {}
      if (!auction || !auction.id) {
        console.warn('[AuctionListSheet] onTapBid: auction is undefined', e.detail)
        return
      }
      this.triggerEvent('bid', { auction })
    },
    
    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
    },
    
    // 阻止滚动穿透
    preventTouchMove() {
      return
    }
  }
})