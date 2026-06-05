// auction-detail-sheet.ts
import { auctionService } from '../../services/auction.service'
import { authService } from '../../services/auth.service'
import { getSocket } from '../../utils/socket'

interface AuctionDetail {
  id: string
  title: string
  description: string
  images: string[]
  currentPrice: number
  startPrice: number
  priceStep: number
  startTime: string
  endTime: string
  status: 'pending' | 'active' | 'completed' | 'ended' | 'cancelled'
  statusText: string
  bidCount: number
  participantCount: number
  merchantInfo: any
  productInfo: any
  // 扩展字段
  capPrice?: number
  delayTime?: number
  stock?: number
  timeLeft?: number
  winnerInfo?: any
  // 原始API字段（snake_case）
  current_price?: number | string
  start_price?: number | string
  price_step?: number | string
  start_time?: string
  end_time?: string
  bid_count?: number
  bids_count?: number
  participant_count?: number
  online_count?: number
  cap_price?: number | string
  delay_time?: number | string
  time_left?: number
  winner?: any
  product?: any
  merchant?: any
}

Component({
  properties: {
    // 是否显示
    visible: {
      type: Boolean,
      value: false
    },
    // 竞拍ID
    auctionId: {
      type: String,
      value: ''
    }
  },

  data: {
    auction: null as AuctionDetail | null,
    
    isLoading: false,
    
    currentImageIndex: 0,
    
    countdownText: '',
    countdownTimer: null as any,
    
    leaderboard: [] as any[],
    
    bidHistory: [] as any[],
    
    displayCurrentPrice: '',
    displayStartPrice: '',
    displayCapPrice: '',
    displayStartTime: '',
    displayEndTime: '',

    // 延时动画
    showDelayAnimation: false,
    delaySeconds: 0,
    delayAnimProgress: 0,
    
    // 平滑倒计时过渡
    countdownTransitioning: false,
    countdownDisplaySeconds: 0,
  },

  observers: {
    'visible': function(visible: boolean) {
      if (visible && this.data.auctionId) {
        this.loadAuctionDetail()
        this.setupSocketListeners()
      } else if (!visible) {
        this.clearCountdown()
        this.removeSocketListeners()
      }
    },
    'auctionId': function(auctionId: string) {
      if (auctionId && this.data.visible) {
        this.loadAuctionDetail()
        this.setupSocketListeners()
      }
    }
  },

  lifetimes: {
    detached() {
      this.clearCountdown()
      this.removeSocketListeners()
      if (this._delayAnimTimer) {
        clearTimeout(this._delayAnimTimer)
      }
      if (this._delayAnimStepTimer) {
        clearInterval(this._delayAnimStepTimer)
      }
      if (this._countdownTransitionTimer) {
        clearInterval(this._countdownTransitionTimer)
      }
    }
  },

  methods: {
    // 加载竞拍详情
    async loadAuctionDetail() {
      const { auctionId } = this.data
      if (!auctionId) return
      
      this.setData({ isLoading: true })
      
      try {
        const auction = await auctionService.getAuctionDetail(auctionId) as any
        
        const statusTextMap: Record<string, string> = {
          pending: '即将开始',
          active: '竞拍中',
          completed: '已结束',
          ended: '已结束',
          cancelled: '已取消'
        }
        
        const product = auction.product || auction.productInfo || {}
        
        const currentPrice = Number(auction.current_price ?? auction.currentPrice ?? product.starting_price ?? 0)
        const startPrice = Number(product.starting_price ?? auction.start_price ?? auction.startPrice ?? 0)
        const priceStep = Number(product.price_increment ?? auction.price_step ?? auction.priceStep ?? 1)
        const capPrice = product.cap_price != null ? Number(product.cap_price) : (auction.cap_price != null ? Number(auction.cap_price) : undefined)
        const delayTime = product.delay_time != null ? Number(product.delay_time) : (auction.delay_time != null ? Number(auction.delay_time) : 10)
        const bidCount = Number(auction.bids_count ?? auction.bid_count ?? auction.bidCount ?? 0)
        const participantCount = Number(auction.participant_count ?? auction.online_count ?? auction.participantCount ?? 0)
        const startTime = auction.start_time || auction.startTime || ''
        const endTime = auction.end_time || auction.endTime || ''
        const winnerInfo = auction.winner || auction.winnerInfo || null
        const images = product.images || auction.images || []
        const description = product.description || auction.description || ''
        
        const formattedAuction: AuctionDetail = {
          id: String(auction.id),
          title: product.name || auction.title || '未知商品',
          description,
          images,
          currentPrice,
          startPrice,
          priceStep,
          startTime,
          endTime,
          status: auction.status as AuctionDetail['status'],
          statusText: statusTextMap[auction.status] || auction.status,
          bidCount,
          participantCount,
          merchantInfo: auction.merchantInfo || auction.merchant || product.merchant || null,
          productInfo: product,
          capPrice,
          delayTime,
          stock: product.stock ?? auction.stock ?? 1,
          timeLeft: auction.time_left ?? auction.timeLeft ?? undefined,
          winnerInfo
        }
        
        this.setData({ 
          auction: formattedAuction,
          isLoading: false,
          currentImageIndex: 0,
          displayCurrentPrice: currentPrice.toFixed(2),
          displayStartPrice: startPrice.toFixed(2),
          displayCapPrice: capPrice != null ? capPrice.toFixed(2) : '',
          displayStartTime: this.formatTime(startTime),
          displayEndTime: this.formatTime(endTime)
        })
        
        this.startCountdown(formattedAuction.endTime)
        this.loadLeaderboard(auctionId)
        this.loadMerchantInfo(product)
        
      } catch (error) {
        console.error('[AuctionDetailSheet] 加载竞拍详情失败:', error)
        this.setData({ isLoading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    },
    
    setupSocketListeners() {
      const sm = getSocket()
      if (!sm) return

      this.removeSocketListeners()

      this._socketHandlers = {
        time_extended: this.onTimeExtended.bind(this),
        new_bid: this.onSocketNewBid.bind(this),
      }

      try {
        sm.on('time_extended', this._socketHandlers.time_extended)
        sm.on('new_bid', this._socketHandlers.new_bid)
      } catch (error) {
        console.error('[AuctionDetailSheet] Error setting up socket listeners:', error)
        this._socketHandlers = null
      }
    },

    removeSocketListeners() {
      const sm = getSocket()
      if (!sm || !this._socketHandlers) return

      try {
        sm.off('time_extended', this._socketHandlers.time_extended)
        sm.off('new_bid', this._socketHandlers.new_bid)
      } catch (error) {
        console.error('[AuctionDetailSheet] Error removing socket listeners:', error)
      } finally {
        this._socketHandlers = null
      }
    },

    onTimeExtended(data: any) {
      const { auction } = this.data
      if (!auction || String(data.auctionId) !== String(auction.id)) return

      const newEndTime = typeof data.newEndTime === 'number'
        ? data.newEndTime
        : new Date(data.newEndTime).getTime()

      if (isNaN(newEndTime)) return

      const extensionSeconds = data.extensionSeconds || 0

      // 计算旧的剩余秒数用于平滑过渡
      const oldEndTimeMs = typeof auction.endTime === 'number' ? auction.endTime : new Date(auction.endTime).getTime()
      const oldTimeLeft = Math.max(0, Math.floor((oldEndTimeMs - Date.now()) / 1000))

      this.setData({
        'auction.endTime': newEndTime,
        displayEndTime: this.formatTime(new Date(newEndTime).toISOString()),
      })

      this.startCountdown(newEndTime)

      // 启动平滑倒计时过渡动画
      if (extensionSeconds > 0) {
        this.animateCountdownExtension(oldTimeLeft, oldTimeLeft + extensionSeconds)
        this.playDelayAnimation(extensionSeconds)
      }
    },

    onSocketNewBid(data: any) {
      const { auction } = this.data
      if (!auction || String(data.auctionId) !== String(auction.id)) return

      const updates: any = {
        'auction.currentPrice': Number(data.currentPrice ?? data.amount ?? 0),
        'auction.bidCount': (auction.bidCount || 0) + 1,
      }

      if (data.participantCount !== undefined) {
        updates['auction.participantCount'] = Number(data.participantCount)
      }

      const endTime = data.endTime
      if (endTime) {
        const endTs = typeof endTime === 'number' ? endTime : new Date(endTime).getTime()
        if (!isNaN(endTs)) {
          updates['auction.endTime'] = endTs
          this.startCountdown(endTs)
        }
      }

      this.setData(updates)
      this.loadLeaderboard(auction.id)
    },

    // 加载商家信息
    async loadMerchantInfo(product: any) {
      const merchantId = product?.merchant_id || product?.merchantId
      if (!merchantId) return
      
      try {
        const merchants = await authService.getMerchants()
        const merchant = merchants.find((m: any) => String(m.id) === String(merchantId))
        if (merchant) {
          this.setData({
            'auction.merchantInfo': {
              id: String(merchant.id),
              username: merchant.username || '未知商家',
              avatar: merchant.avatar || '',
            }
          })
        }
      } catch (error) {
        console.warn('[AuctionDetailSheet] 加载商家信息失败（非关键错误）:', error)
      }
    },
    
    // 加载排行榜
    async loadLeaderboard(auctionId: string) {
      try {
        const leaderboard = await auctionService.getLeaderboard(auctionId)
        const formatted = (leaderboard || []).slice(0, 5).map((item: any) => ({
          ...item,
          displayName: item.nickname || item.username || '匿名用户',
          displayAmount: Number(item.amount || item.price || 0).toFixed(2)
        }))
        this.setData({ leaderboard: formatted })
      } catch (error) {
        console.warn('[AuctionDetailSheet] 加载排行榜失败:', error)
      }
    },
    
    // 启动倒计时
    startCountdown(endTime: string | number) {
      this.clearCountdown()

      const endTimeMs = typeof endTime === 'number' ? endTime : new Date(endTime).getTime()
      if (isNaN(endTimeMs)) return

      const updateCountdown = () => {
        const now = Date.now()
        const diff = endTimeMs - now
        
        if (diff <= 0) {
          this.setData({ countdownText: '已结束' })
          this.clearCountdown()
          return
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        
        let countdownText = ''
        if (days > 0) {
          countdownText = `${days}天${hours}时${minutes}分`
        } else if (hours > 0) {
          countdownText = `${hours}时${minutes}分${seconds}秒`
        } else if (minutes > 0) {
          countdownText = `${minutes}分${seconds}秒`
        } else {
          countdownText = `${seconds}秒`
        }
        
        // 过渡动画期间不更新显示文本，避免覆盖过渡动画的显示值
        if (!this.data.countdownTransitioning) {
          this.setData({ countdownText })
        }
      }
      
      updateCountdown()
      this.data.countdownTimer = setInterval(updateCountdown, 1000)
    },
    
    // 播放延时动画
    playDelayAnimation(seconds: number) {
      if (this._delayAnimTimer) {
        clearTimeout(this._delayAnimTimer)
      }
      if (this._delayAnimStepTimer) {
        clearInterval(this._delayAnimStepTimer)
      }

      this.setData({
        showDelayAnimation: true,
        delaySeconds: seconds,
        delayAnimProgress: 0,
      })

      wx.vibrateShort({ type: 'medium' })

      const duration = Math.min(seconds * 100, 1500)
      const stepInterval = 50
      const totalSteps = duration / stepInterval
      const increment = seconds / totalSteps
      let current = 0

      this._delayAnimStepTimer = setInterval(() => {
        current += increment
        if (current >= seconds) {
          current = seconds
          if (this._delayAnimStepTimer) {
            clearInterval(this._delayAnimStepTimer)
            this._delayAnimStepTimer = null
          }
        }
        this.setData({ delayAnimProgress: Math.floor(current) })
      }, stepInterval)

      this._delayAnimTimer = setTimeout(() => {
        if (this._delayAnimStepTimer) {
          clearInterval(this._delayAnimStepTimer)
          this._delayAnimStepTimer = null
        }
        this.setData({ showDelayAnimation: false, delayAnimProgress: seconds })
      }, duration + 1200)
    },

    /**
     * 平滑倒计时过渡动画
     * 当延时增加时，倒计时从旧值平滑过渡到新值
     * @param oldSeconds 延时前的剩余秒数
     * @param newSeconds 延时后的剩余秒数
     */
    animateCountdownExtension(oldSeconds: number, newSeconds: number) {
      if (this._countdownTransitionTimer) {
        clearInterval(this._countdownTransitionTimer)
      }

      this.setData({
        countdownTransitioning: true,
        countdownDisplaySeconds: oldSeconds,
      })

      // 动画参数
      const duration = 800
      const stepInterval = 30
      const totalSteps = duration / stepInterval
      let step = 0

      this._countdownTransitionTimer = setInterval(() => {
        step++
        // 使用 easeOutCubic 缓动函数
        const linearProgress = Math.min(step / totalSteps, 1)
        const easedProgress = 1 - Math.pow(1 - linearProgress, 3)

        const displaySeconds = Math.floor(oldSeconds + (newSeconds - oldSeconds) * easedProgress)

        this.setData({
          countdownDisplaySeconds: displaySeconds,
        })

        if (step >= totalSteps) {
          if (this._countdownTransitionTimer) {
            clearInterval(this._countdownTransitionTimer)
            this._countdownTransitionTimer = null
          }
          setTimeout(() => {
            this.setData({ countdownTransitioning: false })
          }, 300)
        }
      }, stepInterval)
    },

    // 清除倒计时
    clearCountdown() {
      if (this.data.countdownTimer) {
        clearInterval(this.data.countdownTimer)
        this.data.countdownTimer = null
      }
    },
    
    // 图片切换
    onImageChange(e: WechatMiniprogram.SwiperChange) {
      this.setData({ currentImageIndex: e.detail.current })
    },
    
    // 预览图片
    onPreviewImage(e: WechatMiniprogram.TouchEvent) {
      const { src } = e.currentTarget.dataset
      const { images } = this.data.auction || {}
      wx.previewImage({
        current: src,
        urls: images || [src]
      })
    },
    
    // 点击出价
    onTapBid() {
      const { auction } = this.data
      if (!auction) return
      
      if (auction.status !== 'active') {
        wx.showToast({ title: '当前竞拍未开始或已结束', icon: 'none' })
        return
      }
      
      this.triggerEvent('bid', { auction })
    },
    
    // 关闭弹窗
    onClose() {
      if (this._delayAnimTimer) {
        clearTimeout(this._delayAnimTimer)
      }
      if (this._delayAnimStepTimer) {
        clearInterval(this._delayAnimStepTimer)
      }
      if (this._countdownTransitionTimer) {
        clearInterval(this._countdownTransitionTimer)
      }
      this.setData({
        showDelayAnimation: false,
        delaySeconds: 0,
        delayAnimProgress: 0,
        countdownTransitioning: false,
        countdownDisplaySeconds: 0,
      })
      this.triggerEvent('close')
    },
    
    // 阻止滚动穿透
    preventTouchMove() {
      return
    },
    
    // 格式化价格
    formatPrice(price: number): string {
      return price.toFixed(2)
    },
    
    // 格式化时间
    formatTime(timeStr: string): string {
      if (!timeStr) return ''
      const date = new Date(timeStr)
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${month}-${day} ${hours}:${minutes}`
    }
  }
})