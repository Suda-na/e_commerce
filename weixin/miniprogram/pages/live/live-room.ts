/**
 * 直播间主页面
 * 
 * 功能：
 * 1. 全屏视频播放（HLS 或固定源）
 * 2. 主播/商家信息展示（头像、昵称）
 * 3. 实时弹幕（WebSocket 推送）
 * 4. 竞拍信息展示（当前竞拍卡片、竞拍列表入口）
 * 5. 评论发送
 * 6. 收藏、分享、静音
 * 7. 在线人数显示
 */

import { SocketManager, BidData, PriceUpdateData, SystemNoticeData } from '../../utils/socket'
import { authService } from '../../services/auth.service'
import { proxyAvatarUrl } from '../../utils/util'
import { auctionService } from '../../services/auction.service'
import { favoriteService } from '../../services/favorite.service'
import { pageViewService } from '../../services/page-view.service'
import {
  VideoSourceType,
  createVideoSourceFromUrl,
  createDefaultVideoSource,
  validateVideoSource,
} from '../../utils/video-source'
import { createDebouncedSetData, createThrottledSetData, updateListItem } from '../../utils/performance'

// ==================== 类型定义 ====================

interface MerchantInfo {
  id: string
  username: string
  avatar: string
  role: string
}

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

interface DanmakuMessage {
  id: string
  userId: string
  nickname: string
  avatar?: string
  level?: number
  content: string
  type: 'comment' | 'bid' | 'system'
  timestamp: number
}

// ==================== 页面逻辑 ====================

Page({
  data: {
    // 页面状态
    isLoading: true,
    merchantId: '',
    liveRoomId: '',

    // 视频相关
    videoSrc: '',
    videoPoster: '',
    isMuted: false,
    currentTime: 0,
    isPlaying: true,
    isFullscreen: false,
    videoDuration: 0,
    videoBuffered: 0,
    videoSourceType: 'mp4' as VideoSourceType,
    showVideoControls: false,

    // 直播状态
    liveStatus: 'preview' as 'preview' | 'live' | 'ended',

    // 商家/主播信息
    merchantInfo: {
      id: '',
      username: '商家',
      avatar: '',
    } as MerchantInfo,
    isFollowed: false,

    // 在线人数
    onlineCount: 0,
    onlineCountText: '0',
    // 观看人数模拟定时器
    _viewerSimulateTimer: null as ReturnType<typeof setInterval> | null,

    // 弹幕
    danmakuMessages: [] as DanmakuMessage[],

    // 竞拍相关
    currentAuction: null as AuctionItem | null,
    activeAuctionCount: 0,
    // 倒计时
    countdownTimeLeft: 0,
    countdownText: '',
    // 延时动画
    showDelayBadge: false,
    delayBadgeSeconds: 0,

    // 收藏商家
    isFavorited: false,

    // 评论
    showCommentInput: false,
    commentText: '',

    // 更多操作
    showMoreActions: false,
    
    // 竞拍列表
    showAuctionListSheet: false,
    
    // 出价面板
    showBidPanel: false,
    selectedAuction: null as any,
    
    // 竞拍详情弹窗
    showAuctionDetail: false,
    selectedAuctionId: '',
  },

  // Socket 实例
  socketManager: null as SocketManager | null,
  // 倒计时定时器
  _countdownTimer: null as ReturnType<typeof setInterval> | null,
  // 延时徽章定时器
  _delayBadgeTimer: null as ReturnType<typeof setTimeout> | null,

  // ==================== 生命周期 ====================

  onLoad(options: Record<string, string | undefined>) {
    // 支持 merchantId 或 roomId 参数
    const merchantId = options?.merchantId || ''
    const roomId = options?.roomId || options?.id || ''
    const auctionId = options?.auctionId || ''
    
    console.log('[LiveRoom] onLoad, merchantId:', merchantId, 'roomId:', roomId, 'auctionId:', auctionId)

    // 优先使用 merchantId
    if (merchantId) {
      this.setData({ merchantId, liveRoomId: `merchant_${merchantId}` })
      this.initSocket()
      this.loadMerchantData(merchantId).then(() => {
        // 如果有 auctionId，加载完成后自动打开对应竞拍详情
        if (auctionId) {
          this.openAuctionById(auctionId)
        }
      })
    } else if (roomId) {
      // 兼容旧的 roomId 方式
      this.setData({ liveRoomId: roomId })
      this.initSocket()
      this.loadRoomData(roomId).then(() => {
        if (auctionId) {
          this.openAuctionById(auctionId)
        }
      })
    } else if (auctionId) {
      // 只有 auctionId，先加载竞拍详情获取 merchantId
      this.initSocket()
      this.loadAuctionAndOpen(auctionId)
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  onShow() {
    console.log('[LiveRoom] onShow')
    if (this.socketManager && !this.socketManager.isConnected()) {
      const app = getApp<IAppOption>()
      const token = app.globalData.token || wx.getStorageSync('token') || ''
      this.socketManager.connect(undefined, token || undefined)
    }
    // 页面重新可见时重启倒计时
    if (this.data.currentAuction && this.data.currentAuction.endTime) {
      this.startCountdown()
    }
  },

  onHide() {
    console.log('[LiveRoom] onHide')
    this.stopCountdown()
    this.stopViewerSimulation()
  },

  onUnload() {
    console.log('[LiveRoom] onUnload')
    this.stopCountdown()
    if (this._delayBadgeTimer) {
      clearTimeout(this._delayBadgeTimer)
      this._delayBadgeTimer = null
    }
    this.leaveRoom()
    this.removeSocketListeners()
    this.stopViewerSimulation()
  },

  // ==================== 分享 ====================

  onShareAppMessage() {
    const { merchantId, merchantInfo, currentAuction } = this.data
    return {
      title: currentAuction
        ? `${merchantInfo.username}正在竞拍「${currentAuction.title}」`
        : `${merchantInfo.username}的直播间 - 直播竞拍`,
      path: `/pages/live/live-room?merchantId=${merchantId}`,
      imageUrl: currentAuction?.images?.[0] || '',
    }
  },

  // ==================== 初始化 ====================

  /** 初始化 Socket 连接 */
  initSocket() {
    this.socketManager = SocketManager.getInstance()
    // 传入最新 token，确保用户切换后使用正确的认证信息
    const app = getApp<IAppOption>()
    const token = app.globalData.token || wx.getStorageSync('token') || ''
    this.socketManager.connect(undefined, token || undefined)
    this.setupSocketListeners()
  },

  /** 注册 Socket 事件监听 */
  setupSocketListeners() {
    const sm = this.socketManager
    if (!sm) return

    sm.on('new_bid', this.onNewBid.bind(this))
    sm.on('price_update', this.onPriceUpdate.bind(this))
    sm.on('auction_update', this.onPriceUpdate.bind(this))
    sm.on('time_extended', this.onTimeExtended.bind(this))
    sm.on('online_count', this.onOnlineCount.bind(this))
    sm.on('user_joined', this.onUserJoined.bind(this))
    sm.on('user_left', this.onUserLeft.bind(this))
    sm.on('auction_start', this.onAuctionStart.bind(this))
    sm.on('auction_end', this.onAuctionEnd.bind(this))
    sm.on('auction_status', this.onAuctionStatusChange.bind(this)) // 后端竞拍状态变化事件
    sm.on('system_notice', this.onSystemNotice.bind(this))

    sm.on('connect', () => {
      console.log('[LiveRoom] Socket connected')
      this.joinRoom()
    })

    sm.on('disconnect', (reason: string) => {
      console.log('[LiveRoom] Socket disconnected:', reason)
    })
  },

  /** 移除 Socket 事件监听 */
  removeSocketListeners() {
    const sm = this.socketManager
    if (!sm) return

    sm.off('new_bid')
    sm.off('price_update')
    sm.off('auction_update')
    sm.off('time_extended')
    sm.off('online_count')
    sm.off('user_joined')
    sm.off('user_left')
    sm.off('auction_start')
    sm.off('auction_end')
    sm.off('auction_status')
    sm.off('system_notice')
    sm.off('connect')
    sm.off('disconnect')
  },

  // ==================== 数据加载 ====================

  /** 加载商家直播间数据（通过商家ID） */
  async loadMerchantData(merchantId: string) {
    try {
      this.setData({ isLoading: true })

      // 从商家列表中获取商家信息
      const merchants = await authService.getMerchants()
      const merchant = merchants.find((m: any) => String(m.id) === String(merchantId))

      if (!merchant) {
        wx.showToast({ title: '商家不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }

      // 构造商家信息
      const merchantInfo: MerchantInfo = {
        id: String(merchant.id),
        username: merchant.username || '未知商家',
        avatar: proxyAvatarUrl(merchant.avatar || ''),
        role: merchant.role || 'merchant',
      }

      // 初始化视频源（使用默认视频源）
      this.initVideoSource()

      this.setData({
        merchantInfo,
        isLoading: false,
      })

      // 加入房间
      this.joinRoom()

      // 检查是否已收藏该商家
      this.checkFavoriteStatus(merchantInfo.id)

      // 尝试加载该商家的竞拍列表（可选）
      this.loadMerchantAuctions(merchantId)

    } catch (error) {
      console.error('[LiveRoom] 加载商家数据失败:', error)
      this.setData({ isLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /** 加载商家的竞拍列表 */
  async loadMerchantAuctions(merchantId: string) {
    try {
      // 通过merchantId参数从后端直接筛选该商家的竞拍
      const result = await auctionService.getAuctionList({
        status: 'active',
        page: 1,
        limit: 10,
        merchantId: Number(merchantId),
      })
      const auctions = result?.list || []

      if (auctions.length > 0) {
        const auction = auctions[0] as any
        const product = auction.product || {}
        // 后端使用 completed 而非 ended
        const statusTextMap: Record<string, string> = {
          pending: '即将开始',
          active: '竞拍中',
          completed: '已结束',
          ended: '已结束',
          cancelled: '已取消',
        }

        const currentAuction: AuctionItem = {
          id: String(auction.id),
          title: auction.title || product.name || '未知商品',
          images: auction.images || product.images || [],
          currentPrice: Number(auction.currentPrice ?? auction.current_price ?? product.starting_price ?? 0),
          startPrice: Number(auction.startPrice ?? auction.start_price ?? product.starting_price ?? 0),
          priceStep: Number(auction.priceStep ?? auction.price_step ?? product.price_increment ?? 1),
          endTime: new Date(auction.endTime || auction.end_time).getTime(),
          status: auction.status as AuctionItem['status'],
          statusText: statusTextMap[auction.status] || auction.status,
          bidCount: Number(auction.bidCount ?? auction.bid_count ?? auction.bids_count ?? 0),
          participantCount: Number(auction.participant_count ?? auction.participantCount ?? auction.online_count ?? 0),
        }

        this.setData({
          currentAuction,
          activeAuctionCount: auction.status === 'active' ? 1 : 0,
          liveStatus: auction.status === 'active' ? 'live' : 'preview',
          // 用 API 返回的 online_count 作为初始在线人数
          onlineCount: Number(auction.online_count ?? auction.participant_count ?? 0),
          onlineCountText: this.formatCount(Number(auction.online_count ?? auction.participant_count ?? 0)),
        })

        // 启动倒计时
        if (currentAuction.endTime && auction.status === 'active') {
          this.startCountdown()
        }

        // 竞拍数据加载完成后，用正确的 auctionId 重新加入房间
        this.joinRoom()
        
        // 记录商品浏览
        pageViewService.recordView(Number(currentAuction.id), 'auction')
      }

      console.log('[LiveRoom] 加载商家竞拍成功:', auctions.length, '个')
    } catch (error) {
      console.warn('[LiveRoom] 加载商家竞拍失败（非关键错误）:', error)
    }
  },

  /** 加载直播间数据（兼容旧的roomId方式） */
  async loadRoomData(roomId: string) {
    try {
      this.setData({ isLoading: true })

      const auction = await auctionService.getAuctionDetail(roomId) as any
      const product = auction.product || auction.productInfo || {}
      
      // 获取商家信息（可能从 product.merchant 或 auction.merchantInfo）
      const merchantData = auction.merchantInfo || auction.merchant || product.merchant || {}
      const merchantInfo: MerchantInfo = {
        id: String(merchantData.id || product.merchant_id || ''),
        username: merchantData.nickname || merchantData.shopName || merchantData.username || '商家',
        avatar: proxyAvatarUrl(merchantData.avatar || ''),
        role: 'merchant',
      }

      const statusTextMap: Record<string, string> = {
        pending: '即将开始',
        active: '竞拍中',
        completed: '已结束',
        ended: '已结束',
        cancelled: '已取消',
      }

      const currentAuction: AuctionItem = {
        id: String(auction.id),
        title: auction.title || product.name || '未知商品',
        images: auction.images || product.images || [],
        currentPrice: Number(auction.currentPrice ?? auction.current_price ?? product.starting_price ?? 0),
        startPrice: Number(auction.startPrice ?? auction.start_price ?? product.starting_price ?? 0),
        priceStep: Number(auction.priceStep ?? auction.price_step ?? product.price_increment ?? 1),
        endTime: new Date(auction.endTime || auction.end_time).getTime(),
        status: auction.status as AuctionItem['status'],
        statusText: statusTextMap[auction.status] || auction.status,
        bidCount: Number(auction.bidCount ?? auction.bid_count ?? auction.bids_count ?? 0),
        participantCount: Number(auction.participant_count ?? auction.participantCount ?? auction.online_count ?? 0),
      }

      this.initVideoSource(merchantData.liveStreamUrl)

      this.setData({
        merchantId: merchantInfo.id,
        merchantInfo,
        currentAuction,
        activeAuctionCount: auction.status === 'active' ? 1 : 0,
        liveStatus: auction.status === 'active' ? 'live' : 'preview',
        videoPoster: (auction.images || product.images || [])[0] || '',
        isLoading: false,
        // 用 API 返回的 online_count 作为初始在线人数
        onlineCount: Number(auction.online_count ?? auction.participant_count ?? 0),
        onlineCountText: this.formatCount(Number(auction.online_count ?? auction.participant_count ?? 0)),
      })
      
      // 启动倒计时
      if (currentAuction.endTime && auction.status === 'active') {
        this.startCountdown()
      }
      
      // 记录商品浏览
      pageViewService.recordView(Number(currentAuction.id), 'auction')

      this.joinRoom()

    } catch (error) {
      console.error('[LiveRoom] 加载数据失败:', error)
      this.setData({ isLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /** 加入直播间房间 */
  joinRoom() {
    const { currentAuction } = this.data
    // 优先使用竞拍ID加入房间（后端基于 auctionId 管理房间）
    const roomId = currentAuction?.id || this.data.liveRoomId
    if (!roomId || !this.socketManager) return

    this.socketManager.joinRoom(roomId)
    console.log('[LiveRoom] 加入房间:', roomId)

    // 主动请求一次在线人数，确保即使 WebSocket 广播丢失也能拿到数据
    this.socketManager.emit('get_online_count', { auctionId: Number(roomId) })

    // 启动观看人数模拟（确保始终有合理的显示数字）
    this.startViewerSimulation()
  },

  /** 离开直播间房间 */
  leaveRoom() {
    const { currentAuction } = this.data
    const roomId = currentAuction?.id || this.data.liveRoomId
    if (!roomId || !this.socketManager) return

    this.socketManager.leaveRoom(roomId)
    console.log('[LiveRoom] 离开房间:', roomId)
  },

  // ==================== 观看人数模拟 ====================

  /**
   * 启动观看人数模拟
   * - 如果后端返回了真实在线人数，使用真实值并在此基础上微调波动
   * - 如果后端未返回（值为0），则使用模拟值
   * 模拟真实直播间的用户进出行为：随机增减，整体趋势自然
   */
  startViewerSimulation() {
    // 避免重复启动
    if (this._viewerSimulateTimer) return

    // 确定基础人数：优先用后端数据，否则模拟一个合理初始值
    let baseCount = this.data.onlineCount
    if (baseCount <= 0) {
      // 根据竞拍状态生成合理的初始人数
      const hasActiveAuction = this.data.currentAuction?.status === 'active'
      baseCount = hasActiveAuction
        ? this.randomInRange(50, 200)    // 有竞拍时人更多
        : this.randomInRange(15, 60)     // 无竞拍时人较少
      this.setData({
        onlineCount: baseCount,
        onlineCountText: this.formatCount(baseCount),
      })
    }

    // 记录模拟开始时间，用于趋势控制
    const startTime = Date.now()
    let currentCount = baseCount

    // 每3-8秒随机更新一次观看人数，模拟真实用户进出
    this._viewerSimulateTimer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000 // 已过秒数

      // 趋势因子：前2分钟缓慢增长（模拟直播间热度上升），之后稳定波动
      let trendFactor = 1
      if (elapsed < 120) {
        trendFactor = 1 + (elapsed / 120) * 0.3 // 最多增长30%
      }

      // 竞拍进行中时额外加成
      const auctionBonus = this.data.currentAuction?.status === 'active' ? 1.15 : 1.0

      // 随机变化量：70%概率小幅度变化（-3~+5），20%中等（-8~+12），10%较大（-15~+20）
      const rand = Math.random()
      let delta: number
      if (rand < 0.7) {
        delta = this.randomInRange(-3, 5)
      } else if (rand < 0.9) {
        delta = this.randomInRange(-8, 12)
      } else {
        delta = this.randomInRange(-15, 20)
      }

      // 应用变化，确保不低于最低阈值
      currentCount = Math.max(3, Math.round((currentCount + delta) * trendFactor * auctionBonus))

      // 偶尔触发"多人进入"效果（约15%概率）
      if (Math.random() < 0.15 && currentCount > 10) {
        currentCount += this.randomInRange(1, 4)
      }

      this.setData({
        onlineCount: currentCount,
        onlineCountText: this.formatCount(currentCount),
      })
    }, this.randomInRange(3000, 8000)) // 3~8秒随机间隔
  },

  /** 停止观看人数模拟 */
  stopViewerSimulation() {
    if (this._viewerSimulateTimer) {
      clearInterval(this._viewerSimulateTimer)
      this._viewerSimulateTimer = null
    }
  },

  /** 生成 [min, max] 范围内的随机整数 */
  randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },

  // ==================== Socket 事件处理 ====================

  /** 新出价事件 */
  onNewBid(data: BidData) {
    console.log('[LiveRoom] new_bid:', data)

    this.addDanmaku({
      id: `bid_${data.bidId}_${Date.now()}`,
      userId: data.userId,
      nickname: data.nickname,
      avatar: proxyAvatarUrl(data.avatar),
      level: data.level,
      content: `出价 ¥${data.amount}`,
      type: 'bid',
      timestamp: data.timestamp,
    })

    if (this.data.currentAuction && String(data.auctionId) === String(this.data.currentAuction.id)) {
      const updates: any = {
        'currentAuction.currentPrice': data.amount,
        'currentAuction.bidCount': this.data.currentAuction.bidCount + 1,
      }
      const endTime = (data as any).endTime
      if (endTime) {
        updates['currentAuction.endTime'] = typeof endTime === 'number' ? endTime : new Date(endTime).getTime()
      }
      // 如果是延时出价，显示延时动画
      const isExtended = (data as any).isExtended
      if (isExtended && endTime) {
        const extensionSeconds = (data as any).extensionSeconds || 0
        this.startCountdown()
        if (extensionSeconds > 0) {
          this.showDelayBadgeAnimation(extensionSeconds)
        }
      }
      this.setData(updates)
    }
  },

  /** 价格更新事件（兼容price_update和auction_update两种事件名） */
  onPriceUpdate(data: any) {
    console.log('[LiveRoom] price_update/auction_update:', data)
    if (!this.data.currentAuction) return

    const auctionId = String(data.auctionId || data.auction_id || '')
    if (auctionId !== String(this.data.currentAuction.id)) return

    const currentPrice = data.currentPrice ?? data.current_price
    const bidCount = data.bidCount ?? data.bid_count
    const participantCount = data.participantCount ?? data.participant_count
    const endTime = data.endTime ?? data.end_time

    const updates: any = {}
    if (currentPrice !== undefined) updates['currentAuction.currentPrice'] = Number(currentPrice)
    if (bidCount !== undefined) updates['currentAuction.bidCount'] = Number(bidCount)
    if (participantCount !== undefined) updates['currentAuction.participantCount'] = Number(participantCount)
    if (endTime !== undefined) {
      updates['currentAuction.endTime'] = typeof endTime === 'number' ? endTime : new Date(endTime).getTime()
      this.startCountdown()
    }

    if (Object.keys(updates).length > 0) {
      this.setData(updates)
    }
  },

  /** 在线人数事件 */
  onOnlineCount(data: { auctionId: number | string; roomId?: string; count: number }) {
    // 后端发送 { auctionId, count }，兼容 roomId 字段
    const serverRoomId = String(data.auctionId || data.roomId || '')
    const myRoomId = this.data.currentAuction?.id || this.data.liveRoomId
    if (serverRoomId === String(myRoomId)) {
      this.setData({
        onlineCount: data.count,
        onlineCountText: this.formatCount(data.count),
      })
    }
  },

  /** 竞拍延时事件 */
  onTimeExtended(data: { auctionId: string; newEndTime: number | string; extensionSeconds?: number }) {
    console.log('[LiveRoom] time_extended:', data)
    if (!this.data.currentAuction) return

    const auctionId = String(data.auctionId || '')
    if (auctionId !== String(this.data.currentAuction.id)) return

    const newEndTime = typeof data.newEndTime === 'number' ? data.newEndTime : new Date(data.newEndTime).getTime()
    const extensionSeconds = data.extensionSeconds || 0
    this.setData({
      'currentAuction.endTime': newEndTime,
    })
    // 重启倒计时（使用新的 endTime）
    this.startCountdown()
    // 显示延时徽章动画
    if (extensionSeconds > 0) {
      this.showDelayBadgeAnimation(extensionSeconds)
    }
  },

  /** 用户加入 */
  onUserJoined(data: { roomId: string; userId: string; nickname: string }) {
    if (data.roomId === this.data.liveRoomId) {
      this.addDanmaku({
        id: `sys_join_${data.userId}_${Date.now()}`,
        userId: 'system',
        nickname: '系统',
        content: `${data.nickname} 进入了直播间`,
        type: 'system',
        timestamp: Date.now(),
      })
    }
  },

  /** 用户离开 */
  onUserLeft(data: { roomId: string; userId: string }) {
    // 不展示离开弹幕
  },

  /** 竞拍开始 */
  onAuctionStart(data: { auctionId: string; status: string }) {
    this.addDanmaku({
      id: `sys_start_${data.auctionId}_${Date.now()}`,
      userId: 'system',
      nickname: '系统',
      content: '竞拍开始！',
      type: 'system',
      timestamp: Date.now(),
    })

    if (this.data.currentAuction && String(this.data.currentAuction.id) === String(data.auctionId)) {
      this.setData({
        'currentAuction.status': 'active',
        'currentAuction.statusText': '竞拍中',
        liveStatus: 'live',
        activeAuctionCount: 1,
      })
    }
  },

  /** 竞拍结束 */
  onAuctionEnd(data: { auctionId: string; status: string; winnerId?: string; finalPrice?: number }) {
    this.addDanmaku({
      id: `sys_end_${data.auctionId}_${Date.now()}`,
      userId: 'system',
      nickname: '系统',
      content: data.finalPrice
        ? `竞拍结束！成交价 ¥${data.finalPrice}`
        : '竞拍结束',
      type: 'system',
      timestamp: Date.now(),
    })

    if (this.data.currentAuction && String(this.data.currentAuction.id) === String(data.auctionId)) {
      this.setData({
        'currentAuction.status': 'ended',
        'currentAuction.statusText': '已结束',
        liveStatus: 'ended',
        activeAuctionCount: 0,
      })
    }
  },

  /** 竞拍状态变化（后端统一发出的auction_status事件） */
  onAuctionStatusChange(data: { auctionId: string; status: string; winnerId?: string; finalPrice?: number }) {
    console.log('[LiveRoom] auction_status:', data)
    if (data.status === 'active') {
      this.onAuctionStart({ auctionId: data.auctionId, status: data.status })
    } else if (data.status === 'completed' || data.status === 'ended') {
      this.onAuctionEnd({ auctionId: data.auctionId, status: data.status, winnerId: data.winnerId, finalPrice: data.finalPrice })
    } else if (data.status === 'cancelled') {
      this.addDanmaku({
        id: `sys_cancel_${data.auctionId}_${Date.now()}`,
        userId: 'system',
        nickname: '系统',
        content: '竞拍已取消',
        type: 'system',
        timestamp: Date.now(),
      })
    }
  },

  /** 系统通知 */
  onSystemNotice(data: SystemNoticeData) {
    this.addDanmaku({
      id: `sys_notice_${Date.now()}`,
      userId: 'system',
      nickname: data.title || '系统',
      content: data.message,
      type: 'system',
      timestamp: data.timestamp,
    })
  },

  // ==================== 弹幕管理 ====================

  // 弹幕消息队列（用于批量更新）
  _danmakuQueue: [] as DanmakuMessage[],
  _danmakuFlushTimer: null as ReturnType<typeof setTimeout> | null,

  /** 添加弹幕消息（批量更新优化） */
  addDanmaku(msg: DanmakuMessage) {
    // 将消息加入队列
    this._danmakuQueue.push(msg)

    // 如果没有定时器，设置一个
    if (!this._danmakuFlushTimer) {
      this._danmakuFlushTimer = setTimeout(() => {
        this._flushDanmakuQueue()
        this._danmakuFlushTimer = null
      }, 50) // 50ms 内的消息会批量更新
    }
  },

  /** 刷新弹幕队列 */
  _flushDanmakuQueue() {
    if (this._danmakuQueue.length === 0) return

    // 合并队列中的消息
    const newMessages = [...this.data.danmakuMessages, ...this._danmakuQueue]
    // 限制最多保留 100 条
    if (newMessages.length > 100) {
      newMessages.splice(0, newMessages.length - 100)
    }

    // 清空队列
    this._danmakuQueue = []

    // 一次性更新
    this.setData({ danmakuMessages: newMessages })
  },

  // ==================== 交互事件 ====================

  /** 返回上一页 */
  onTapBack() {
    wx.navigateBack({ delta: 1 })
  },

  /** 点击商家信息 */
  onTapMerchant() {
    console.log('[LiveRoom] 点击商家信息')
  },

  /** 点击视频区域 - 显示/隐藏控制层 */
  onTapVideoArea() {
    const { showVideoControls } = this.data
    this.setData({ showVideoControls: !showVideoControls })
    
    if (!showVideoControls) {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer)
      }
      this._hideTimer = setTimeout(() => {
        this.setData({ showVideoControls: false })
        this._hideTimer = undefined
      }, 3000)
    }
  },

  /** 关注/取消关注 */
  onTapFollow() {
    this.setData({ isFollowed: !this.data.isFollowed })
    wx.showToast({
      title: this.data.isFollowed ? '已关注' : '已取消关注',
      icon: 'none',
    })
  },

  /** 点击更多操作 */
  onTapMore() {
    this.setData({ showMoreActions: true })
  },

  /** 关闭更多操作 */
  onCloseMoreActions() {
    this.setData({ showMoreActions: false })
  },

  /** 举报 */
  onActionReport() {
    this.setData({ showMoreActions: false })
    wx.showToast({ title: '举报功能开发中', icon: 'none' })
  },

  /** 屏蔽商家 */
  onActionBlacklist() {
    this.setData({ showMoreActions: false })
    wx.showToast({ title: '已屏蔽', icon: 'none' })
  },

  /** 复制链接 */
  onActionCopyLink() {
    this.setData({ showMoreActions: false })
    wx.setClipboardData({
      data: `https://auction-app.com/live/${this.data.merchantId}`,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    })
  },

  /** 点击当前竞拍卡片 */
  onTapAuctionCard() {
    const { currentAuction } = this.data
    if (!currentAuction) return

    this.setData({
      showAuctionDetail: true,
      selectedAuctionId: currentAuction.id
    })
  },

  /** 点击竞拍列表入口 */
  onTapAuctionList() {
    this.setData({ showAuctionListSheet: true })
  },
  
  /** 关闭竞拍列表 */
  onCloseAuctionListSheet() {
    this.setData({ showAuctionListSheet: false })
  },
  
  /** 点击竞拍卡片（从列表中） */
  onTapAuctionCardFromSheet(e: WechatMiniprogram.CustomEvent) {
    const { auction } = e.detail || {}
    if (!auction || !auction.id) {
      console.warn('[LiveRoom] onTapAuctionCardFromSheet: auction is undefined', e.detail)
      return
    }
    this.setData({ 
      showAuctionListSheet: false,
      showAuctionDetail: true,
      selectedAuctionId: auction.id
    })
  },
  
  /** 从列表中出价 */
  onTapBidFromSheet(e: WechatMiniprogram.CustomEvent) {
    const { auction } = e.detail || {}
    if (!auction || !auction.id) {
      console.warn('[LiveRoom] onTapBidFromSheet: auction is undefined', e.detail)
      return
    }
    this.setData({ showAuctionListSheet: false })
    
    this.triggerBidPanel(auction)
  },
  
  /** 触发出价面板 */
  triggerBidPanel(auction: any) {
    this.setData({
      showBidPanel: true,
      selectedAuction: auction
    })
  },
  
  /** 关闭出价面板 */
  onCloseBidPanel() {
    this.setData({
      showBidPanel: false,
      selectedAuction: null
    })
  },
  
  /** 关闭竞拍详情弹窗 */
  onCloseAuctionDetail() {
    this.setData({
      showAuctionDetail: false,
      selectedAuctionId: ''
    })
  },
  
  /** 从详情弹窗中出价 */
  onBidFromDetail(e: WechatMiniprogram.CustomEvent) {
    const { auction } = e.detail || {}
    if (!auction || !auction.id) {
      console.warn('[LiveRoom] onBidFromDetail: auction is undefined', e.detail)
      return
    }
    this.setData({ 
      showAuctionDetail: false,
      selectedAuctionId: ''
    })
    this.triggerBidPanel(auction)
  },
  
  /** 出价成功 */
  onBidSuccess(e: WechatMiniprogram.CustomEvent) {
    const { auctionId, amount, endTime, isExtended } = e.detail
    console.log('[LiveRoom] 出价成功:', auctionId, amount, 'isExtended:', isExtended)

    if (this.data.currentAuction && String(this.data.currentAuction.id) === String(auctionId)) {
      const updates: any = {
        'currentAuction.currentPrice': amount,
        'currentAuction.bidCount': this.data.currentAuction.bidCount + 1
      }
      if (endTime) {
        updates['currentAuction.endTime'] = typeof endTime === 'number' ? endTime : new Date(endTime).getTime()
      }
      this.setData(updates)
      // 出价成功后重启倒计时（endTime可能已变化）
      if (endTime || isExtended) {
        this.startCountdown()
      }
      // 出价触发延时，显示延时动画
      if (isExtended && endTime) {
        const extensionSeconds = e.detail.extensionSeconds || 0
        if (extensionSeconds > 0) {
          this.showDelayBadgeAnimation(extensionSeconds)
        }
      }
    }
  },

  /** 中标后 - 确认并支付：跳转订单详情页 */
  onBidPanelPay(e: WechatMiniprogram.CustomEvent) {
    const { auctionId, amount } = e.detail || {}
    console.log('[LiveRoom] 确认并支付:', auctionId, amount)

    // 关闭出价面板
    this.setData({ showBidPanel: false, selectedAuction: null })

    // 跳转到订单详情页（通过 auctionId 查找对应订单）
    wx.navigateTo({
      url: `/pages/orders/detail?auctionId=${auctionId}&action=pay`
    })
  },

  /** 中标后 - 查看订单：跳转订单详情页 */
  onBidPanelViewOrder(e: WechatMiniprogram.CustomEvent) {
    const { auctionId } = e.detail || {}
    console.log('[LiveRoom] 查看订单:', auctionId)

    // 关闭出价面板
    this.setData({ showBidPanel: false, selectedAuction: null })

    // 跳转到订单详情页
    wx.navigateTo({
      url: `/pages/orders/detail?auctionId=${auctionId}`
    })
  },

  /** 未中标 - 继续围观：关闭结果弹窗即可 */
  onBidPanelContinue() {
    console.log('[LiveRoom] 继续围观')
    // 结果弹窗内部会自行关闭，这里只需记录日志
  },

  /** 关闭竞拍结果弹窗 */
  onBidPanelResultClose() {
    console.log('[LiveRoom] 结果弹窗关闭')
  },

  /** 倒计时结束 */
  onCountdownFinish() {
    console.log('[LiveRoom] 竞拍倒计时结束')
    // 倒计时归零，立即在本地结束竞拍，不等后端确认
    const { currentAuction } = this.data
    this.setData({
      liveStatus: 'ended',
      countdownText: '已结束',
      countdownTimeLeft: 0,
      'currentAuction.status': 'ended',
      'currentAuction.statusText': '已结束',
      activeAuctionCount: 0,
    })
  },

  // ==================== 倒计时管理 ====================

  /** 启动倒计时 */
  startCountdown() {
    this.stopCountdown()
    this.updateCountdown()
    this._countdownTimer = setInterval(() => {
      this.updateCountdown()
    }, 1000)
  },

  /** 更新倒计时 */
  updateCountdown() {
    const { currentAuction } = this.data
    if (!currentAuction || !currentAuction.endTime) return

    const now = Date.now()
    let endTime: number
    if (typeof currentAuction.endTime === 'number') {
      endTime = currentAuction.endTime
    } else {
      endTime = new Date(currentAuction.endTime).getTime()
    }
    if (isNaN(endTime)) return

    const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000))

    let countdownText = ''
    if (timeLeft <= 0) {
      countdownText = '已结束'
      this.stopCountdown()
      // 立即触发结束
      this.onCountdownFinish()
    } else if (timeLeft < 60) {
      countdownText = `${timeLeft}秒`
    } else if (timeLeft < 3600) {
      const minutes = Math.floor(timeLeft / 60)
      const seconds = timeLeft % 60
      countdownText = `${minutes}分${seconds}秒`
    } else {
      const hours = Math.floor(timeLeft / 3600)
      const minutes = Math.floor((timeLeft % 3600) / 60)
      countdownText = `${hours}时${minutes}分`
    }

    this.setData({ countdownTimeLeft: timeLeft, countdownText })
  },

  /** 停止倒计时 */
  stopCountdown() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
  },

  /** 显示延时徽章动画 */
  showDelayBadgeAnimation(seconds: number) {
    if (this._delayBadgeTimer) {
      clearTimeout(this._delayBadgeTimer)
    }
    this.setData({
      showDelayBadge: true,
      delayBadgeSeconds: seconds,
    })
    // 振动反馈
    wx.vibrateShort({ type: 'medium' })
    // 3秒后隐藏徽章
    this._delayBadgeTimer = setTimeout(() => {
      this.setData({ showDelayBadge: false })
    }, 3000)
  },

  /** 检查收藏状态 */
  async checkFavoriteStatus(merchantId: string) {
    try {
      const app = getApp<IAppOption>()
      if (!app.globalData.isLoggedIn) return
      const isFavorited = await favoriteService.checkFavorite(merchantId)
      this.setData({ isFavorited })
    } catch (err) {
      console.log('[LiveRoom] 检查收藏状态失败:', err)
    }
  },

  /** 收藏/取消收藏商家 */
  async onTapFavorite() {
    const app = getApp<IAppOption>()
    if (!app.globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const { merchantId, isFavorited } = this.data
    if (!merchantId) return

    try {
      const result = await favoriteService.toggleFavorite(merchantId)
      const newState = result?.data?.isFavorite ?? !isFavorited
      this.setData({ isFavorited: newState })
      wx.showToast({
        title: newState ? '已收藏' : '已取消收藏',
        icon: 'none',
      })
    } catch (err) {
      console.error('[LiveRoom] 收藏操作失败:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  /** 切换静音 */
  onTapMute() {
    this.setData({ isMuted: !this.data.isMuted })
    this.updateVideoContext()
  },

  /** 切换播放/暂停 */
  onTapPlayPause() {
    const { isPlaying } = this.data
    this.setData({ isPlaying: !isPlaying })
    this.updateVideoContext()
  },

  /** 切换全屏 */
  onTapFullscreen() {
    const { isFullscreen } = this.data
    this.setData({ isFullscreen: !isFullscreen })
    
    const videoContext = wx.createVideoContext('liveVideo', this)
    if (isFullscreen) {
      videoContext.exitFullScreen()
    } else {
      videoContext.requestFullScreen({ direction: 0 })
    }
  },

  /** 点击礼物按钮 */
  onTapGift() {
    wx.showToast({ title: '礼物功能开发中', icon: 'none' })
  },

  /** 更新视频上下文状态 */
  updateVideoContext() {
    const videoContext = wx.createVideoContext('liveVideo', this)
    const { isPlaying, isMuted } = this.data
    
    if (isPlaying) {
      videoContext.play()
    } else {
      videoContext.pause()
    }
    
    // @ts-ignore
    if (isMuted) {
      this.setData({ isMuted: true })
    } else {
      this.setData({ isMuted: false })
    }
  },

  // ==================== 评论 ====================

  /** 打开评论输入 */
  onTapCommentInput() {
    this.setData({ showCommentInput: true })
  },

  /** 关闭评论输入 */
  onCloseCommentInput() {
    this.setData({ showCommentInput: false, commentText: '' })
  },

  /** 评论输入 */
  onCommentInput(e: WechatMiniprogram.Input) {
    this.setData({ commentText: e.detail.value })
  },

  /** 发送评论 */
  onSendComment() {
    const { commentText, liveRoomId } = this.data
    if (!commentText.trim()) return

    this.socketManager?.emit('send_comment', {
      roomId: liveRoomId,
      content: commentText.trim(),
    })

    this.addDanmaku({
      id: `comment_self_${Date.now()}`,
      userId: 'self',
      nickname: '我',
      avatar: '/assets/icons/user.png',
      level: 1,
      content: commentText.trim(),
      type: 'comment',
      timestamp: Date.now(),
    })

    this.setData({ commentText: '', showCommentInput: false })
  },

  // ==================== 视频事件 ====================

  /** 视频播放错误 */
  onVideoError(e: any) {
    console.error('[LiveRoom] 视频播放错误:', e.detail)
    this.tryFallbackVideoSource()
  },

  /** 视频播放进度更新 */
  onVideoTimeUpdate(e: any) {
    this.setData({ currentTime: e.detail.currentTime || 0 })
  },

  /** 视频开始播放 */
  onVideoPlay() {
    console.log('[LiveRoom] 视频开始播放')
    this.setData({ isPlaying: true })
  },

  /** 视频暂停 */
  onVideoPause() {
    console.log('[LiveRoom] 视频暂停')
    this.setData({ isPlaying: false })
  },

  /** 视频播放结束 */
  onVideoEnded() {
    console.log('[LiveRoom] 视频播放结束')
    if (this.data.videoSourceType === VideoSourceType.MP4) {
      console.log('[LiveRoom] MP4 视频自动循环')
    }
  },

  /** 视频全屏状态变化 */
  onVideoFullscreenChange(e: any) {
    const isFullscreen = e.detail.fullScreen
    console.log('[LiveRoom] 视频全屏状态变化:', isFullscreen)
    this.setData({ isFullscreen })
  },

  /** 视频缓冲进度更新 */
  onVideoProgress(e: any) {
    const { buffered, duration } = e.detail
    this.setData({
      videoBuffered: buffered || 0,
      videoDuration: duration || 0,
    })
  },

  // 当前失败的视频源索引（用于按顺序尝试下一个）
  _failedSourceIndex: -1,

  /** 尝试切换到备用视频源（按顺序尝试，避免重复选到失败源） */
  tryFallbackVideoSource() {
    const { videoSrc } = this.data

    console.log('[LiveRoom] 当前视频源加载失败:', videoSrc)

    // 所有可用的备用视频源（按优先级排列）
    const fallbackSources = [
      'https://vjs.zencdn.net/v/oceans.mp4',
      'https://media.w3.org/2010/05/sintel/trailer.mp4',
      'https://www.w3schools.com/html/mov_bbb.mp4',
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    ]

    // 找到当前源在列表中的位置，从下一个开始尝试
    const currentIndex = fallbackSources.indexOf(videoSrc)
    this._failedSourceIndex = Math.max(this._failedSourceIndex, currentIndex)

    // 按顺序尝试下一个源
    const nextIndex = this._failedSourceIndex + 1
    if (nextIndex < fallbackSources.length) {
      const nextSrc = fallbackSources[nextIndex]
      console.log('[LiveRoom] 切换到备用视频源[' + nextIndex + ']:', nextSrc)
      this._failedSourceIndex = nextIndex
      this.setData({
        videoSrc: nextSrc,
        videoSourceType: 'mp4' as VideoSourceType,
      })
    } else {
      // 所有源都尝试过了，从头开始
      console.log('[LiveRoom] 所有视频源都已尝试过，重新从第一个开始')
      this._failedSourceIndex = 0
      this.setData({
        videoSrc: fallbackSources[0],
        videoSourceType: 'mp4' as VideoSourceType,
      })
    }
  },

  /** 初始化视频源 */
  initVideoSource(liveStreamUrl?: string) {
    if (liveStreamUrl && validateVideoSource(liveStreamUrl)) {
      const sourceConfig = createVideoSourceFromUrl(liveStreamUrl)
      this.setData({
        videoSrc: sourceConfig.src,
        videoPoster: sourceConfig.poster,
        videoSourceType: sourceConfig.type,
        isMuted: sourceConfig.muted ?? false,
      })
    } else {
      const defaultSource = createDefaultVideoSource(VideoSourceType.MP4)
      this.setData({
        videoSrc: defaultSource.src,
        videoPoster: defaultSource.poster,
        videoSourceType: defaultSource.type,
        isMuted: defaultSource.muted ?? false,
      })
    }
  },

  // ==================== 竞拍详情跳转 ====================

  /** 根据 auctionId 打开竞拍详情（从已加载的竞拍列表中查找） */
  async openAuctionById(auctionId: string) {
    console.log('[LiveRoom] 尝试打开竞拍详情, auctionId:', auctionId)
    
    // 先尝试通过API获取竞拍详情
    try {
      const auction = await auctionService.getAuctionDetail(auctionId) as any
      if (auction) {
        this.setData({
          showAuctionDetail: true,
          selectedAuctionId: String(auctionId)
        })
        return
      }
    } catch (err) {
      console.warn('[LiveRoom] 加载竞拍详情失败:', err)
    }
    
    // 降级：直接设置 auctionId 打开详情弹窗
    this.setData({
      showAuctionDetail: true,
      selectedAuctionId: String(auctionId)
    })
  },

  /** 只有 auctionId 时，先加载竞拍获取 merchantId，再打开直播间 */
  async loadAuctionAndOpen(auctionId: string) {
    try {
      this.setData({ isLoading: true })
      const auction = await auctionService.getAuctionDetail(auctionId) as any
      const product = auction.product || auction.productInfo || {}
      const merchantData = auction.merchantInfo || auction.merchant || product.merchant || {}
      const merchantId = String(merchantData.id || product.merchant_id || '')
      
      if (merchantId) {
        this.setData({ merchantId, liveRoomId: `merchant_${merchantId}` })
        this.joinRoom()
        await this.loadMerchantData(merchantId)
        this.openAuctionById(auctionId)
      } else {
        // 没有merchantId，直接加载竞拍数据
        this.setData({ liveRoomId: `auction_${auctionId}` })
        this.joinRoom()
        await this.loadRoomData(auctionId)
        this.openAuctionById(auctionId)
      }
    } catch (error) {
      console.error('[LiveRoom] 加载竞拍失败:', error)
      this.setData({ isLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // ==================== 工具方法 ====================

  /** 格式化数量（万） */
  formatCount(count: number): string {
    if (count >= 10000) {
      return (count / 10000).toFixed(1) + 'w'
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k'
    }
    return String(count)
  },
})