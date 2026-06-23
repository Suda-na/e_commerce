// auction-card.ts
import { getSocket } from '../../utils/socket'

Component({
  properties: {
    auction: {
      type: Object,
      value: {}
    },
    showCountdown: {
      type: Boolean,
      value: true
    },
    mode: {
      type: String,
      value: 'grid'
    }
  },

  data: {
    statusText: '',
    statusClass: '',
    timeLeft: '',
    priceText: '',
    hasBid: false,
    startPriceText: '',

    // 延时动画
    showDelayAnimation: false,
    delaySeconds: 0,
    delayAnimProgress: 0,

    // 平滑倒计时过渡
    countdownTransitioning: false,
    countdownDisplaySeconds: 0,
  },

  observers: {
    'auction': function(auction: any) {
      if (!auction) return

      const statusMap: Record<string, { text: string; class: string }> = {
        pending: { text: '即将开始', class: 'status-pending' },
        active: { text: '竞拍中', class: 'status-active' },
        completed: { text: '已结束', class: 'status-ended' },
        ended: { text: '已结束', class: 'status-ended' },
        cancelled: { text: '已取消', class: 'status-cancelled' }
      }

      const status = statusMap[auction.status] || statusMap.pending

      const currentPrice = Number(auction.currentPrice ?? auction.current_price) || 0
      const startPrice = Number(auction.startPrice ?? auction.start_price) || 0
      const displayPrice = currentPrice > 0 ? currentPrice : startPrice
      const priceText = `¥${displayPrice.toLocaleString()}`
      const hasBid = currentPrice > 0 && currentPrice !== startPrice

      this.setData({
        statusText: status.text,
        statusClass: status.class,
        priceText,
        hasBid,
        startPriceText: startPrice > 0 ? `¥${startPrice.toLocaleString()}` : ''
      })

      this.updateCountdown()

      if (auction.status === 'active' && auction.endTime) {
        this.startCountdownTimer()
        this.setupSocketListeners()
      } else {
        this.stopCountdownTimer()
      }
    }
  },

  lifetimes: {
    attached() {
      this.setupSocketListeners()
    },
    detached() {
      this.stopCountdownTimer()
      this.removeSocketListeners()
      this.clearDelayAnimTimers()
      if (this._countdownTransitionTimer) {
        clearInterval(this._countdownTransitionTimer)
      }
    }
  },

  methods: {
    // ==================== Socket 监听 ====================

    setupSocketListeners() {
      const { auction } = this.properties
      if (!auction || !auction.id) return

      const sm = getSocket()
      if (!sm) return

      // 先移除旧监听，防止重复
      this.removeSocketListeners()

      this._handlers = {
        time_extended: this.onTimeExtended.bind(this),
        new_bid: this.onNewBid.bind(this),
        auction_ended: this.onAuctionEnded.bind(this),
        cap_price_reached: this.onCapPriceReached.bind(this),
      }

      try {
        sm.on('time_extended', this._handlers.time_extended)
        sm.on('new_bid', this._handlers.new_bid)
        sm.on('auction_ended', this._handlers.auction_ended)
        sm.on('cap_price_reached', this._handlers.cap_price_reached)
      } catch (error) {
        console.error('[AuctionCard] Error setting up socket listeners:', error)
        this._handlers = null
      }
    },

    removeSocketListeners() {
      const sm = getSocket()
      if (!sm || !this._handlers) return

      try {
        sm.off('time_extended', this._handlers.time_extended)
        sm.off('new_bid', this._handlers.new_bid)
        sm.off('auction_ended', this._handlers.auction_ended)
        sm.off('cap_price_reached', this._handlers.cap_price_reached)
      } catch (error) {
        console.error('[AuctionCard] Error removing socket listeners:', error)
      } finally {
        this._handlers = null
      }
    },

    onTimeExtended(data: any) {
      const { auction } = this.properties
      if (!auction || String(data.auctionId) !== String(auction.id)) return

      const newEndTime = typeof data.newEndTime === 'number'
        ? data.newEndTime
        : new Date(data.newEndTime).getTime()
      if (isNaN(newEndTime)) return

      const extensionSeconds = data.extensionSeconds || 0

      // 计算旧的剩余秒数
      const now = Date.now()
      const oldEndTime = typeof auction.endTime === 'number'
        ? auction.endTime
        : new Date(auction.endTime).getTime()
      const oldTimeLeft = Math.max(0, Math.floor((oldEndTime - now) / 1000))

      // 更新 endTime（通过 triggerEvent 通知父组件更新，或直接更新属性）
      this.triggerEvent('timeExtended', { auctionId: auction.id, newEndTime, extensionSeconds })

      // 先启动平滑过渡动画
      if (extensionSeconds > 0) {
        this.animateCountdownExtension(oldTimeLeft, oldTimeLeft + extensionSeconds)
      }

      // 更新内部数据用于倒计时
      this.properties.auction = { ...auction, endTime: newEndTime }
      this.startCountdownTimer()

      // 显示延时动画
      if (extensionSeconds > 0) {
        this.playDelayAnimation(extensionSeconds)
      }
    },

    onNewBid(data: any) {
      const { auction } = this.properties
      if (!auction || String(data.auctionId) !== String(auction.id)) return

      const newPrice = Number(data.currentPrice ?? data.amount ?? 0)
      const startPrice = Number(auction.startPrice ?? auction.start_price) || 0
      const displayPrice = newPrice > 0 ? newPrice : startPrice

      // 更新价格显示
      this.setData({
        priceText: `¥${displayPrice.toLocaleString()}`,
        hasBid: newPrice > 0 && newPrice !== startPrice,
      })

      // 更新 endTime（如果出价触发了延时）
      const endTime = data.endTime
      if (endTime) {
        const endTs = typeof endTime === 'number' ? endTime : new Date(endTime).getTime()
        if (!isNaN(endTs)) {
          this.properties.auction = { ...auction, endTime: endTs, currentPrice: newPrice }
        }
      } else {
        this.properties.auction = { ...auction, currentPrice: newPrice }
      }

      // 出价达到封顶价时立即更新状态
      if (data.isCompleted) {
        this.setData({
          statusText: '已结束',
          statusClass: 'status-ended',
          timeLeft: '已结束',
        })
        this.stopCountdownTimer()
      }
    },

    // 竞拍结束事件
    onAuctionEnded(data: any) {
      const { auction } = this.properties
      if (!auction || String(data.auctionId) !== String(auction.id)) return

      const finalPrice = Number(data.finalPrice ?? data.currentPrice ?? auction.currentPrice ?? 0)
      const startPrice = Number(auction.startPrice ?? auction.start_price) || 0
      const displayPrice = finalPrice > 0 ? finalPrice : startPrice

      this.properties.auction = { ...auction, status: 'completed', currentPrice: finalPrice }
      this.setData({
        statusText: '已结束',
        statusClass: 'status-ended',
        timeLeft: '已结束',
        priceText: `¥${displayPrice.toLocaleString()}`,
        hasBid: finalPrice > 0 && finalPrice !== startPrice,
      })
      this.stopCountdownTimer()
    },

    // 封顶价达到事件
    onCapPriceReached(data: any) {
      const { auction } = this.properties
      if (!auction || String(data.auctionId) !== String(auction.id)) return

      const finalPrice = Number(data.finalPrice ?? data.currentPrice ?? auction.capPrice ?? auction.currentPrice ?? 0)
      const startPrice = Number(auction.startPrice ?? auction.start_price) || 0
      const displayPrice = finalPrice > 0 ? finalPrice : startPrice

      this.properties.auction = { ...auction, status: 'completed', currentPrice: finalPrice }
      this.setData({
        statusText: '已结束',
        statusClass: 'status-ended',
        timeLeft: '已结束',
        priceText: `¥${displayPrice.toLocaleString()}`,
        hasBid: finalPrice > 0 && finalPrice !== startPrice,
      })
      this.stopCountdownTimer()
    },

    // ==================== 倒计时 ====================

    updateCountdown() {
      const { auction } = this.properties
      if (!auction || !auction.endTime) {
        this.setData({ timeLeft: '' })
        return
      }

      // 已结束的竞拍直接显示
      if (auction.status !== 'active') {
        this.setData({ timeLeft: '' })
        return
      }

      const now = Date.now()
      const end = typeof auction.endTime === 'number'
        ? auction.endTime
        : new Date(auction.endTime).getTime()
      const diff = end - now

      if (diff <= 0) {
        // 倒计时归零，立即在本地结束竞拍，不等后端确认
        this.properties.auction = { ...auction, status: 'completed' }
        this.setData({
          timeLeft: '已结束',
          statusText: '已结束',
          statusClass: 'status-ended',
        })
        this.stopCountdownTimer()
        return
      }

      const totalSeconds = Math.floor(diff / 1000)
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60

      let timeLeft = ''
      if (hours > 0) {
        timeLeft = `${hours}时${minutes}分`
      } else if (minutes > 0) {
        timeLeft = `${minutes}分${seconds}秒`
      } else {
        timeLeft = `${seconds}秒`
      }

      // 过渡动画期间不更新显示文本
      if (!this.data.countdownTransitioning) {
        this.setData({ timeLeft })
      }
    },

    startCountdownTimer() {
      this.stopCountdownTimer()
      this._countdownTimer = setInterval(() => {
        this.updateCountdown()
      }, 1000)
    },

    stopCountdownTimer() {
      if (this._countdownTimer) {
        clearInterval(this._countdownTimer)
        this._countdownTimer = null
      }
    },

    // ==================== 延时动画 ====================

    /**
     * 播放延时动画（+Xs 徽章）
     */
    playDelayAnimation(seconds: number) {
      this.clearDelayAnimTimers()

      this.setData({
        showDelayAnimation: true,
        delaySeconds: seconds,
        delayAnimProgress: 0,
      })

      // 进度动画：延时秒数从 0 递增到目标值
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

      // 动画结束后隐藏
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
     */
    animateCountdownExtension(oldSeconds: number, newSeconds: number) {
      if (this._countdownTransitionTimer) {
        clearInterval(this._countdownTransitionTimer)
      }

      this.setData({
        countdownTransitioning: true,
        countdownDisplaySeconds: oldSeconds,
      })

      const duration = 800
      const stepInterval = 30
      const totalSteps = duration / stepInterval
      let step = 0

      this._countdownTransitionTimer = setInterval(() => {
        step++
        const linearProgress = Math.min(step / totalSteps, 1)
        const easedProgress = 1 - Math.pow(1 - linearProgress, 3)
        const displaySeconds = Math.floor(oldSeconds + (newSeconds - oldSeconds) * easedProgress)

        this.setData({ countdownDisplaySeconds: displaySeconds })

        if (step >= totalSteps) {
          if (this._countdownTransitionTimer) {
            clearInterval(this._countdownTransitionTimer)
            this._countdownTransitionTimer = null
          }
          // 过渡完成后，更新 timeLeft 为正确格式
          const finalSeconds = newSeconds
          let timeLeft = ''
          if (finalSeconds <= 0) {
            timeLeft = '已结束'
          } else if (finalSeconds < 60) {
            timeLeft = `${finalSeconds}秒`
          } else if (finalSeconds < 3600) {
            const minutes = Math.floor(finalSeconds / 60)
            const secs = finalSeconds % 60
            timeLeft = `${minutes}分${secs}秒`
          } else {
            const hours = Math.floor(finalSeconds / 3600)
            const minutes = Math.floor((finalSeconds % 3600) / 60)
            timeLeft = `${hours}时${minutes}分`
          }
          this.setData({ timeLeft })
          setTimeout(() => {
            this.setData({ countdownTransitioning: false })
          }, 100)
        }
      }, stepInterval)
    },

    clearDelayAnimTimers() {
      if (this._delayAnimTimer) {
        clearTimeout(this._delayAnimTimer)
        this._delayAnimTimer = null
      }
      if (this._delayAnimStepTimer) {
        clearInterval(this._delayAnimStepTimer)
        this._delayAnimStepTimer = null
      }
    },

    // ==================== 事件 ====================

    onTapCard() {
      const auction = this.properties.auction
      if (!auction || !auction.id) return
      this.triggerEvent('tap', { auction })
    },

    onTapBid(e: WechatMiniprogram.TouchEvent) {
      const auction = this.properties.auction
      if (!auction || !auction.id) return
      this.triggerEvent('bid', { auction })
    },

    preventBubble() {
      return
    }
  }
})
