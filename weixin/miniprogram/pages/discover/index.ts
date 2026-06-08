/**
 * 发现页面 - 商家列表
 * 
 * 功能：
 * 1. 显示所有商家列表
 * 2. 点击商家跳转到对应直播间
 * 3. 支持下拉刷新
 */

import { authService } from '../../services/auth.service'
import { checkNetwork } from '../../utils/network'
import { proxyAvatarUrl } from '../../utils/util'

interface MerchantInfo {
  id: string
  username: string
  avatar: string
  role: string
  createdAt: string
  productCount: number
  activeAuctionCount: number
}

Page({
  data: {
    // 商家列表
    merchants: [] as MerchantInfo[],
    
    // 页面状态
    isLoading: true,
    isEmpty: false,
    
    // 搜索
    searchKeyword: '',
    filteredMerchants: [] as MerchantInfo[],
  },

  // 防抖定时器
  _searchTimer: null as any,

  onLoad() {
    console.log('[Discover] onLoad')
    this.loadMerchants()
  },

  onShow() {
    console.log('[Discover] onShow')
    // 非首次进入页面时强制刷新商家列表（确保实时性）
    if (this.data.merchants.length > 0) {
      this.loadMerchants(true)
    }
  },

  /** 下拉刷新 */
  onPullDownRefresh() {
    this.loadMerchants(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  /** 加载商家列表 */
  async loadMerchants(forceRefresh: boolean = false) {
    try {
      this.setData({ isLoading: true })
      
      // 检查网络状态
      const isOnline = checkNetwork(true)
      if (!isOnline) {
        this.setData({ 
          isLoading: false,
          isEmpty: true,
        })
        return
      }
      
      const merchants = await authService.getMerchants(forceRefresh)
      
      // 格式化商家数据
      const formattedMerchants: MerchantInfo[] = (merchants || []).map((m: any) => ({
        id: String(m.id),
        username: m.username || '未知商家',
        avatar: proxyAvatarUrl(m.avatar || ''),
        role: m.role || 'merchant',
        createdAt: m.created_at || m.createdAt || '',
        productCount: m.product_count || m.productCount || 0,
        activeAuctionCount: m.active_auction_count || m.activeAuctionCount || 0,
      }))
      
      this.setData({
        merchants: formattedMerchants,
        filteredMerchants: formattedMerchants,
        isEmpty: formattedMerchants.length === 0,
        isLoading: false,
      })
      
      console.log('[Discover] 加载商家列表成功:', formattedMerchants.length, '个商家')
    } catch (error) {
      console.error('[Discover] 加载商家列表失败:', error)
      this.setData({ 
        isLoading: false,
        isEmpty: true,
      })
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
  },

  /** 搜索输入（防抖300ms） */
  onSearchInput(e: WechatMiniprogram.Input) {
    const keyword = e.detail.value.trim()
    this.setData({ searchKeyword: keyword })
    
    // 防抖300ms
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => this.filterMerchants(keyword), 300)
  },

  /** 清除搜索 */
  onClearSearch() {
    this.setData({ searchKeyword: '' })
    this.filterMerchants('')
  },

  /** 筛选商家 */
  filterMerchants(keyword: string) {
    const { merchants } = this.data
    if (!keyword) {
      this.setData({ filteredMerchants: merchants })
      return
    }
    
    const filtered = merchants.filter(m => 
      m.username.toLowerCase().includes(keyword.toLowerCase())
    )
    this.setData({ filteredMerchants: filtered })
  },

  /** 点击商家卡片 - 跳转直播间 */
  onTapMerchant(e: WechatMiniprogram.TouchEvent) {
    const merchantId = e.currentTarget.dataset.id
    const merchantName = e.currentTarget.dataset.name
    
    if (!merchantId) {
      wx.showToast({ title: '商家信息异常', icon: 'none' })
      return
    }
    
    console.log('[Discover] 跳转商家直播间:', merchantId, merchantName)
    
    wx.navigateTo({
      url: `/pages/live/live-room?merchantId=${merchantId}`,
    })
  },

  /** 商家头像加载失败处理 */
  onMerchantAvatarError(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index
    const key = `filteredMerchants[${index}].avatar`
    this.setData({
      [key]: '/assets/icons/default-avatar.png'
    })
  },

  /** 分享 */
  onShareAppMessage() {
    return {
      title: '发现更多优质商家 - 直播竞拍',
      path: '/pages/discover/index',
    }
  },
})