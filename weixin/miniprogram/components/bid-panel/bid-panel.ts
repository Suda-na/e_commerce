// bid-panel.ts - 出价面板组件
import { bidService } from '../../services/bid.service'
import { getSocket, SocketManager } from '../../utils/socket'
import { BidValidator, AuctionInfo as BidAuctionInfo, BidInfo, ValidateResult } from '../../utils/bid-validator'
import { aiService } from '../../services/ai.service'

/** 竞拍信息接口 */
interface AuctionInfo {
  id: string
  title: string
  images: string[]
  currentPrice: number
  startPrice: number
  priceStep: number
  capPrice?: number
  endTime: number | string
  status: string
  bidCount: number
  participantCount: number
  tags?: string[]
  myLastBid?: number
}

/** 智能提示类型 */
type TipType = 'default' | 'outbid' | 'ending-soon' | 'highest' | 'high-bid' | 'cap-warning'

/** 出价状态 */
type BidStatus = 'idle' | 'submitting' | 'success' | 'error' | 'ended'

Component({
  properties: {
    // 是否显示
    visible: {
      type: Boolean,
      value: false
    },
    // 竞拍信息
    auction: {
      type: Object,
      value: {}
    }
  },

  data: {
    // 出价金额
    bidAmount: 0,
    bidAmountText: '',
    
    // 快捷加价选项
    quickAddOptions: [] as number[],
    
    // 出价状态
    bidStatus: 'idle' as BidStatus,
    
    // 错误信息
    errorMessage: '',
    
    // 智能提示
    tipType: 'default' as TipType,
    tipIcon: '💡',
    tipText: '建议加价 ¥50',
    
    // 倒计时
    timeLeftText: '',
    timeLeft: 0,
    
    // 长按相关
    longPressTimer: null as any,
    longPressInterval: 100, // 100ms间隔
    
    // 轮播图
    currentSwiperIndex: 0,
    
    // 我的出价
    myBidAmount: 0,
    
    // 是否已被超越
    isOutbid: false,
    
    // 是否是最高出价者
    isTopBidder: false,
    
    // 动画相关
    shakeAnimation: false,
    celebrateAnimation: false,
    
    // 延时动画
    showDelayAnimation: false,
    delaySeconds: 0,
    delayAnimProgress: 0,
    
    // 平滑倒计时过渡
    countdownTransitioning: false,
    countdownOldSeconds: 0,
    countdownNewSeconds: 0,
    countdownTransitionProgress: 0,
    countdownDisplaySeconds: 0, // 过渡动画中显示的秒数
    
    // 竞拍结果弹窗
    showResultModal: false,
    auctionResult: {
      auctionId: '',
      title: '',
      image: '',
      finalPrice: 0,
      winnerId: '',
      winnerNickname: '',
      myUserId: '',
      status: ''
    },

    // AI 出价顾问
    showAiAdvisor: false,
    aiAdvisorTab: 'suggestion' as 'suggestion' | 'trend',
    riskLevel: 'moderate' as 'conservative' | 'moderate' | 'aggressive',
    bidSuggestion: null as any,
    bidSuggestionLoading: false,
    trendAnalysis: null as any,
    trendLoading: false,
  },

  observers: {
    // 监听竞拍信息变化
    'auction': function(auction: AuctionInfo) {
      if (!auction || !auction.id) return
      
      const currentPrice = Number(auction.currentPrice) || 0
      const startPrice = Number(auction.startPrice) || 0
      const priceStep = Number(auction.priceStep) || 1
      const capPrice = auction.capPrice != null ? Number(auction.capPrice) : undefined
      const bidCount = Number(auction.bidCount) || 0
      const participantCount = Number(auction.participantCount) || 0
      const myLastBid = auction.myLastBid || 0
      
      const minBid = currentPrice + priceStep
      
      const quickAddOptions = [
        priceStep,
        priceStep * 2,
        priceStep * 5,
        priceStep * 10
      ]
      
      this.setData({
        bidAmount: minBid,
        bidAmountText: minBid.toString(),
        quickAddOptions,
        myBidAmount: myLastBid,
        errorMessage: '',
        bidStatus: 'idle',
        isOutbid: false,
        isTopBidder: false,
        currentSwiperIndex: 0,
        'auction.currentPrice': currentPrice,
        'auction.startPrice': startPrice,
        'auction.priceStep': priceStep,
        'auction.capPrice': capPrice,
        'auction.bidCount': bidCount,
        'auction.participantCount': participantCount
      })
      
      this.updateSmartTip()
      this.startCountdown()
      this.setupSocketListeners()
    },
    
    // 监听可见性变化
    'visible': function(visible: boolean) {
      if (visible) {
        this.startCountdown()
        this.setupSocketListeners()
      } else {
        this.stopCountdown()
        this.removeSocketListeners()
      }
    }
  },

  lifetimes: {
    detached() {
      this.stopCountdown()
      this.removeSocketListeners()
      this.stopLongPress()
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
    // ==================== 图片轮播 ====================
    
    // 轮播图切换
    onSwiperChange(e: WechatMiniprogram.SwiperChange) {
      this.setData({
        currentSwiperIndex: e.detail.current
      })
    },
    
    // ==================== 价格控制 ====================
    
    // 输入出价金额
    onBidInput(e: WechatMiniprogram.Input) {
      const value = e.detail.value
      const amount = parseFloat(value) || 0
      
      this.setData({
        bidAmount: amount,
        bidAmountText: value,
        errorMessage: ''
      })
      
      const result = this.validateAmount(amount)
      // BidValidator 的智能提示已在 validateAmount 中应用
      // 仅在未通过校验时使用传统 updateSmartTip 作为补充
      if (!result.valid) {
        this.updateSmartTip()
      }
    },
    
    /**
     * 创建 BidValidator 实例
     * 将组件的 AuctionInfo 映射为 BidValidator 需要的格式
     */
    createValidator(): BidValidator {
      const { auction, myBidAmount, isTopBidder } = this.data
      
      const auctionInfo: BidAuctionInfo = {
        id: auction.id,
        title: auction.title || '',
        currentPrice: auction.currentPrice,
        startPrice: auction.startPrice || 0,
        priceStep: auction.priceStep,
        capPrice: auction.capPrice,
        endTime: auction.endTime,
        status: auction.status,
        bidCount: auction.bidCount || 0,
        participantCount: auction.participantCount || 0
      }
      
      const myLastBid: BidInfo | null = myBidAmount > 0 ? {
        amount: myBidAmount,
        timestamp: Date.now(),
        isTopBidder
      } : null
      
      return new BidValidator(auctionInfo, myLastBid)
    },

    /**
     * 验证金额（使用 BidValidator）
     * @returns 校验结果对象
     */
    validateAmount(amount: number): ValidateResult {
      const validator = this.createValidator()
      const result = validator.validate(amount)
      
      if (!result.valid && result.error) {
        // 校验失败，显示错误信息
        const tipState = this.getTipStateFromError(result.error)
        this.setData({ 
          errorMessage: result.error,
          ...tipState
        })
      } else {
        // 校验通过，应用智能提示
        this.setData({ errorMessage: '' })
        this.applySmartTips(result)
      }
      
      return result
    },

    /**
     * 根据错误信息确定提示状态
     */
    getTipStateFromError(error: string): object {
      if (error.includes('封顶价')) {
        return {
          tipType: 'cap-warning',
          tipIcon: '🚫',
          tipText: '已达封顶价，禁止继续出价'
        }
      }
      if (error.includes('结束')) {
        return {
          tipType: 'default',
          tipIcon: '⏰',
          tipText: '竞拍已结束'
        }
      }
      return {
        tipType: 'default',
        tipIcon: '💡',
        tipText: `建议加价 ¥${this.data.auction.priceStep.toLocaleString()}`
      }
    },

    /**
     * 应用 BidValidator 的智能提示
     */
    applySmartTips(result: ValidateResult) {
      if (result.warning) {
        const { auction } = this.data
        const isNearCap = auction.capPrice && result.warning.includes('封顶价')
        
        this.setData({
          tipType: isNearCap ? 'cap-warning' : 'high-bid',
          tipIcon: isNearCap ? '🚫' : '📈',
          tipText: result.warning
        })
      }
      
      if (result.info) {
        this.setData({
          tipType: 'highest',
          tipIcon: '👑',
          tipText: result.info
        })
      }
    },
    
    // 增加金额
    onTapIncrease() {
      const { bidAmount, auction } = this.data
      const newAmount = bidAmount + auction.priceStep
      
      this.setData({
        bidAmount: newAmount,
        bidAmountText: newAmount.toString(),
        errorMessage: ''
      })
      
      const result = this.validateAmount(newAmount)
      if (!result.valid) {
        this.updateSmartTip()
      }
    },
    
    // 减少金额
    onTapDecrease() {
      const { bidAmount, auction } = this.data
      const minBid = auction.currentPrice + auction.priceStep
      const newAmount = Math.max(minBid, bidAmount - auction.priceStep)
      
      this.setData({
        bidAmount: newAmount,
        bidAmountText: newAmount.toString(),
        errorMessage: ''
      })
      
      const result = this.validateAmount(newAmount)
      if (!result.valid) {
        this.updateSmartTip()
      }
    },
    
    // 长按开始 - 增加
    onIncreaseLongPress() {
      this.startLongPress('increase')
    },
    
    // 长按开始 - 减少
    onDecreaseLongPress() {
      this.startLongPress('decrease')
    },
    
    // 长按结束
    onLongPressEnd() {
      this.stopLongPress()
    },
    
    // 启动长按
    startLongPress(type: 'increase' | 'decrease') {
      this.stopLongPress()
      
      // 首次立即执行
      if (type === 'increase') {
        this.onTapIncrease()
      } else {
        this.onTapDecrease()
      }
      
      // 设置定时器
      const timer = setInterval(() => {
        if (type === 'increase') {
          this.onTapIncrease()
        } else {
          this.onTapDecrease()
        }
        
        // 振动反馈
        wx.vibrateShort({ type: 'light' })
      }, this.data.longPressInterval)
      
      this.setData({ longPressTimer: timer })
    },
    
    // 停止长按
    stopLongPress() {
      if (this.data.longPressTimer) {
        clearInterval(this.data.longPressTimer)
        this.setData({ longPressTimer: null })
      }
    },
    
    // 快捷加价
    onTapQuickAdd(e: WechatMiniprogram.TouchEvent) {
      const { amount } = e.currentTarget.dataset
      const { auction } = this.data
      const newAmount = auction.currentPrice + amount
      
      this.setData({
        bidAmount: newAmount,
        bidAmountText: newAmount.toString(),
        errorMessage: ''
      })
      
      const result = this.validateAmount(newAmount)
      if (!result.valid) {
        this.updateSmartTip()
      }
      
      // 振动反馈
      wx.vibrateShort({ type: 'light' })
    },
    
    // ==================== 智能提示 ====================
    
    // 更新智能提示
    updateSmartTip() {
      const { bidAmount, auction, isTopBidder, timeLeft, isOutbid } = this.data
      
      let tipType: TipType = 'default'
      let tipIcon = '💡'
      let tipText = '一次加多高'
      
      // ① 被超越警告 - 收到outbid事件
      if (isOutbid) {
        tipType = 'outbid'
        tipIcon = '⚠️'
        tipText = '您已被超越，有人出价更高'
      }
      // ② 即将结束 - 距结束<2分钟
      else if (timeLeft < 120 && timeLeft > 0) {
        tipType = 'ending-soon'
        tipIcon = '⏰'
        const minutes = Math.ceil(timeLeft / 60)
        tipText = `竞拍即将结束（${minutes}分钟），最后机会！`
      }
      // ③ 最高价警告 - 自己已是当前最高价
      else if (isTopBidder) {
        tipType = 'highest'
        tipIcon = '👑'
        tipText = '当前已是最高价，暂列第一'
      }
      // ④ 高价提醒 - 出价 > 当前价+100元
      else if (bidAmount - auction.currentPrice > 100) {
        tipType = 'high-bid'
        tipIcon = '📈'
        const diff = bidAmount - auction.currentPrice
        tipText = `高于当前价 ¥${diff.toLocaleString()}，出价领先`
      }
      // ⑤ 默认提示
      else {
        tipType = 'default'
        tipIcon = '💡'
        tipText = `建议加价 ¥${auction.priceStep.toLocaleString()}`
      }
      
      this.setData({ tipType, tipIcon, tipText })
    },
    
    // ==================== 倒计时 ====================
    
    // 启动倒计时
    startCountdown() {
      this.stopCountdown()
      this.updateCountdown()
      
      // 每秒更新
      this._countdownTimer = setInterval(() => {
        this.updateCountdown()
      }, 1000)
    },
    
    // 更新倒计时
    updateCountdown() {
      const { auction } = this.data
      if (!auction || !auction.endTime) return
      
      const now = Date.now()
      let endTime: number
      if (typeof auction.endTime === 'number') {
        endTime = auction.endTime
      } else {
        endTime = new Date(auction.endTime).getTime()
      }
      if (isNaN(endTime)) return
      
      const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000))
      
      let timeLeftText = ''
      if (timeLeft <= 0) {
        timeLeftText = '已结束'
      } else if (timeLeft < 60) {
        timeLeftText = `${timeLeft}秒`
      } else if (timeLeft < 3600) {
        const minutes = Math.floor(timeLeft / 60)
        const seconds = timeLeft % 60
        timeLeftText = `${minutes}分${seconds}秒`
      } else {
        const hours = Math.floor(timeLeft / 3600)
        const minutes = Math.floor((timeLeft % 3600) / 60)
        timeLeftText = `${hours}时${minutes}分`
      }
      
      // 在过渡动画期间，仍然更新 timeLeft 用于智能提示计算，
      // 但不更新 timeLeftText 以避免覆盖过渡动画的显示
      if (this.data.countdownTransitioning) {
        this.setData({ timeLeft })
      } else {
        this.setData({ timeLeft, timeLeftText })
      }
      this.updateSmartTip()
    },
    
    // 停止倒计时
    stopCountdown() {
      if (this._countdownTimer) {
        clearInterval(this._countdownTimer)
        this._countdownTimer = null
      }
    },
    
    // ==================== WebSocket事件 ====================
    
    // 设置Socket监听
    setupSocketListeners() {
      const { auction } = this.data
      if (!auction || !auction.id) return
      
      const sm = getSocket()
      if (!sm) {
        console.warn('[BidPanel] SocketManager not available for setup')
        return
      }
      
      // 先移除旧监听，防止重复
      this.removeSocketListeners()
      
      // 创建并保存绑定的handler引用，确保 on/off 使用同一引用
      this._handlers = {
        new_bid: this.onNewBid.bind(this),
        outbid: this.onOutbid.bind(this),
        auction_ended: this.onAuctionEnded.bind(this),
        time_extended: this.onTimeExtended.bind(this),
        price_update: this.onPriceUpdate.bind(this),
        cap_price_reached: this.onCapPriceReached.bind(this),
      }
      
      try {
        sm.on('new_bid', this._handlers.new_bid)
        sm.on('outbid', this._handlers.outbid)
        sm.on('auction_ended', this._handlers.auction_ended)
        sm.on('time_extended', this._handlers.time_extended)
        sm.on('price_update', this._handlers.price_update)
        sm.on('cap_price_reached', this._handlers.cap_price_reached)
        console.log('[BidPanel] Socket listeners setup successfully for auction:', auction.id)
      } catch (error) {
        console.error('[BidPanel] Error setting up socket listeners:', error)
        this._handlers = null
      }
    },
    
    // 移除Socket监听
    removeSocketListeners() {
      const sm = getSocket()
      if (!sm) {
        console.warn('[BidPanel] SocketManager not available')
        this._handlers = null
        return
      }
      
      if (!this._handlers) return
      
      try {
        sm.off('new_bid', this._handlers.new_bid)
        sm.off('outbid', this._handlers.outbid)
        sm.off('auction_ended', this._handlers.auction_ended)
        sm.off('time_extended', this._handlers.time_extended)
        sm.off('price_update', this._handlers.price_update)
        sm.off('cap_price_reached', this._handlers.cap_price_reached)
      } catch (error) {
        console.error('[BidPanel] Error removing socket listeners:', error)
      } finally {
        this._handlers = null
      }
    },
    
    // 新出价事件
    onNewBid(data: any) {
      const { auction } = this.data
      if (String(data.auctionId) !== String(auction.id)) return

      const updates: any = {
        'auction.currentPrice': data.amount,
        'auction.bidCount': (auction.bidCount || 0) + 1
      }

      if (data.endTime) {
        updates['auction.endTime'] = typeof data.endTime === 'number'
          ? data.endTime
          : new Date(data.endTime).getTime()
      }

      this.setData(updates)

      // 重新计算出价金额
      const minBid = data.amount + auction.priceStep
      if (this.data.bidAmount < minBid) {
        this.setData({
          bidAmount: minBid,
          bidAmountText: minBid.toString()
        })
      }

      // 检查是否是最高出价者
      const currentUserId = wx.getStorageSync('userId')
      if (data.userId === currentUserId) {
        this.setData({ isTopBidder: true, isOutbid: false })
      }

      // 检查是否达到封顶价导致竞拍结束
      if (data.isCompleted) {
        this.setData({
          bidStatus: 'ended',
          'auction.status': 'ended',
          tipType: 'cap-warning',
          tipIcon: '🚫',
          tipText: '已达封顶价，竞拍自动成交'
        })
        this.stopCountdown()
        // 显示竞拍结果弹窗（延时等待 auction_ended 事件补充完整信息）
        return
      }

      this.updateSmartTip()
    },
    
    // 被超越事件
    onOutbid(data: any) {
      const { auction } = this.data
      if (String(data.auctionId) !== String(auction.id)) return
      
      this.setData({
        isOutbid: true,
        isTopBidder: false,
        'auction.currentPrice': data.currentPrice
      })
      
      // 振动提醒
      wx.vibrateShort({ type: 'heavy' })
      
      // 重新计算出价金额
      const minBid = data.currentPrice + auction.priceStep
      if (this.data.bidAmount < minBid) {
        this.setData({
          bidAmount: minBid,
          bidAmountText: minBid.toString()
        })
      }
      
      this.updateSmartTip()
    },
    
    // 竞拍结束事件
    onAuctionEnded(data: any) {
      const { auction } = this.data
      if (String(data.auctionId) !== String(auction.id)) return
      
      this.setData({
        bidStatus: 'ended',
        'auction.status': 'ended'
      })
      
      // 停止倒计时
      this.stopCountdown()
      
      // 显示竞拍结果弹窗
      setTimeout(() => {
        this.showAuctionResult({
          finalPrice: data.finalPrice || auction.currentPrice,
          winnerId: data.winnerId || '',
          winnerNickname: data.winnerNickname || '',
          status: 'ended'
        })
      }, 500)
    },
    
    // 延时通知
    onTimeExtended(data: any) {
      const { auction } = this.data
      if (String(data.auctionId) !== String(auction.id)) return
      
      const newEndTime = typeof data.newEndTime === 'number' ? data.newEndTime : new Date(data.newEndTime).getTime()
      const extensionSeconds = data.extensionSeconds || 0

      // 保存旧的剩余秒数用于平滑过渡
      const oldTimeLeft = this.data.timeLeft

      this.setData({
        'auction.endTime': newEndTime
      })

      // 先启动平滑倒计时过渡动画，再重启倒计时（避免 updateCountdown 立即覆盖过渡值）
      if (extensionSeconds > 0) {
        this.animateCountdownExtension(oldTimeLeft, oldTimeLeft + extensionSeconds)
      }

      // 重启倒计时（使用新的结束时间）
      this.startCountdown()

      // 显示延时动画
      if (extensionSeconds > 0) {
        this.playDelayAnimation(extensionSeconds)
      }
    },
    
    // 价格更新
    onPriceUpdate(data: any) {
      const { auction } = this.data
      if (String(data.auctionId) !== String(auction.id)) return

      const updates: any = {
        'auction.currentPrice': data.currentPrice,
        'auction.bidCount': data.bidCount,
        'auction.participantCount': data.participantCount
      }

      if (data.endTime) {
        updates['auction.endTime'] = typeof data.endTime === 'number'
          ? data.endTime
          : new Date(data.endTime).getTime()
      }

      this.setData(updates)

      // 重新计算出价金额
      const minBid = data.currentPrice + auction.priceStep
      if (this.data.bidAmount < minBid) {
        this.setData({
          bidAmount: minBid,
          bidAmountText: minBid.toString()
        })
      }

      this.updateSmartTip()
    },
    
    // 达到封顶价
    onCapPriceReached(data: any) {
      const { auction } = this.data
      if (String(data.auctionId) !== String(auction.id)) return
      
      this.setData({
        bidStatus: 'ended',
        'auction.status': 'ended',
        errorMessage: '已达到封顶价，竞拍自动成交',
        tipType: 'cap-warning',
        tipIcon: '🚫',
        tipText: '已达封顶价，禁止继续出价'
      })

      // 停止倒计时
      this.stopCountdown()

      // 振动提醒
      wx.vibrateShort({ type: 'heavy' })
    },
    
    // ==================== 提交出价 ====================
    
    /**
     * 提交出价（WebSocket 优先，HTTP 降级）
     * 
     * 完整流程：
     * 1. 前端 BidValidator 校验
     * 2. 设置提交状态
     * 3. 通过 WebSocket 发送出价
     * 4. 等待服务器响应
     * 5. 处理结果（成功/失败/被超越）
     */
    async onSubmitBid() {
      const { bidAmount, auction, bidStatus } = this.data
      
      // 防止重复提交
      if (bidStatus === 'submitting' || bidStatus === 'ended') return
      
      // 1. 前端校验（使用 BidValidator）
      const validationResult = this.validateAmount(bidAmount)
      if (!validationResult.valid) {
        // 校验失败，错误信息已在 validateAmount 中设置
        wx.vibrateShort({ type: 'heavy' })
        return
      }
      
      // 2. 开始提交
      this.setData({ bidStatus: 'submitting', errorMessage: '' })
      
      try {
        // 3. 优先通过 WebSocket 出价
        let result
        
        const sm = getSocket()
        if (sm && sm.isConnected()) {
          // WebSocket 出价（推荐方案）
          console.log('[BidPanel] 使用 WebSocket 出价')
          result = await bidService.placeBidViaSocket(auction.id, bidAmount)
        } else {
          // HTTP 降级方案
          console.log('[BidPanel] WebSocket 未连接，使用 HTTP 降级出价')
          const httpResult = await bidService.placeBid({
            auctionId: auction.id,
            amount: bidAmount
          })
          result = {
            success: true,
            bidId: httpResult.bidId,
            newPrice: httpResult.currentPrice,
            endTime: httpResult.endTime ? new Date(httpResult.endTime).getTime() : undefined,
            isExtended: httpResult.isExtended,
            extensionSeconds: (httpResult as any).delayTime || 0,
            message: httpResult.message
          }
        }
        
        // 4. 处理结果
        if (result.success) {
          // 出价成功
          const successUpdates: any = {
            bidStatus: result.isCompleted ? 'ended' : 'success',
            myBidAmount: bidAmount,
            isTopBidder: true,
            isOutbid: false
          }

          if (result.endTime) {
            const newEndTime = typeof result.endTime === 'number'
              ? result.endTime
              : new Date(result.endTime).getTime()
            successUpdates['auction.endTime'] = newEndTime
          }

          if (result.newPrice) {
            successUpdates['auction.currentPrice'] = result.newPrice
          }

          // 达到封顶价，竞拍自动成交
          if (result.isCompleted) {
            successUpdates['auction.status'] = 'ended'
            successUpdates.tipType = 'cap-warning'
            successUpdates.tipIcon = '🚫'
            successUpdates.tipText = '已达封顶价，恭喜中标！'
          }

          this.setData(successUpdates)

          // 达到封顶价时停止倒计时，等待 auction_ended 事件显示结果弹窗
          if (result.isCompleted) {
            this.stopCountdown()
            wx.vibrateShort({ type: 'heavy' })
            return
          }

          if (result.isExtended && result.endTime) {
            // 保存旧的剩余秒数用于平滑过渡
            const oldTimeLeft = this.data.timeLeft
            const extensionSeconds = result.extensionSeconds || 0

            // 先启动平滑过渡动画，再重启倒计时（避免 updateCountdown 立即覆盖过渡值）
            if (extensionSeconds > 0) {
              this.animateCountdownExtension(oldTimeLeft, oldTimeLeft + extensionSeconds)
            }

            this.startCountdown()

            // 出价触发延时，播放延时动画
            if (extensionSeconds > 0) {
              this.playDelayAnimation(extensionSeconds)
            }
          }
          
          // 振动反馈
          wx.vibrateShort({ type: 'medium' })
          
          // 触发成功事件
          this.triggerEvent('success', {
            auctionId: auction.id,
            amount: bidAmount,
            bidId: result.bidId,
            newPrice: result.newPrice,
            endTime: result.endTime,
            isExtended: result.isExtended
          })
          
          // 2秒后恢复idle状态
          setTimeout(() => {
            this.setData({ bidStatus: 'idle' })
          }, 2000)
        } else {
          // 出价失败（被超越、竞拍结束等）
          throw new Error(result.error || '出价失败')
        }
        
      } catch (error: any) {
        console.error('[BidPanel] 出价失败:', error)
        
        let errorMsg = '出价失败，请重试'
        if (error.message) {
          errorMsg = error.message
        }
        
        // 出价失败
        this.setData({
          bidStatus: 'error',
          errorMessage: errorMsg,
          shakeAnimation: true
        })
        
        // 振动反馈
        wx.vibrateShort({ type: 'heavy' })
        
        // 2秒后恢复idle状态并清除动画
        setTimeout(() => {
          this.setData({ bidStatus: 'idle', shakeAnimation: false })
        }, 2000)
      }
    },
    
    // ==================== 延时动画 ====================
    
    /**
     * 播放延时动画
     * @param seconds 延时的秒数
     */
    playDelayAnimation(seconds: number) {
      // 先清除之前的动画
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

      // 振动反馈
      wx.vibrateShort({ type: 'medium' })

      // 进度动画：延时秒数从 0 递增到目标值
      const duration = Math.min(seconds * 100, 1500) // 动画总时长，最多1.5秒
      const stepInterval = 50 // 每50ms更新一次
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
      }, duration + 1200) // 额外停留1.2秒
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
        countdownOldSeconds: oldSeconds,
        countdownNewSeconds: newSeconds,
        countdownTransitionProgress: 0,
        countdownDisplaySeconds: oldSeconds,
      })

      // 动画参数
      const duration = 800 // 过渡动画总时长800ms
      const stepInterval = 30 // 每30ms更新一次
      const totalSteps = duration / stepInterval
      let step = 0

      this._countdownTransitionTimer = setInterval(() => {
        step++
        // 使用 easeOutCubic 缓动函数，让过渡更自然
        const linearProgress = Math.min(step / totalSteps, 1)
        const easedProgress = 1 - Math.pow(1 - linearProgress, 3)

        // 计算当前显示的秒数
        const displaySeconds = Math.floor(oldSeconds + (newSeconds - oldSeconds) * easedProgress)

        this.setData({
          countdownTransitionProgress: easedProgress,
          countdownDisplaySeconds: displaySeconds,
        })

        if (step >= totalSteps) {
          if (this._countdownTransitionTimer) {
            clearInterval(this._countdownTransitionTimer)
            this._countdownTransitionTimer = null
          }
          // 过渡完成后，立即更新 timeLeftText 为正确格式，再清除过渡状态
          const finalSeconds = newSeconds
          let timeLeftText = ''
          if (finalSeconds <= 0) {
            timeLeftText = '已结束'
          } else if (finalSeconds < 60) {
            timeLeftText = `${finalSeconds}秒`
          } else if (finalSeconds < 3600) {
            const minutes = Math.floor(finalSeconds / 60)
            const secs = finalSeconds % 60
            timeLeftText = `${minutes}分${secs}秒`
          } else {
            const hours = Math.floor(finalSeconds / 3600)
            const minutes = Math.floor((finalSeconds % 3600) / 60)
            timeLeftText = `${hours}时${minutes}分`
          }
          this.setData({ timeLeftText })
          // 延迟清除过渡状态，让 timeLeftText 先渲染
          setTimeout(() => {
            this.setData({ countdownTransitioning: false })
          }, 100)
        }
      }, stepInterval)
    },
    
    // ==================== 辅助方法 ====================
    
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
        bidAmount: 0,
        bidAmountText: '',
        errorMessage: '',
        bidStatus: 'idle',
        tipType: 'default',
        tipIcon: '💡',
        tipText: '建议加价 ¥50',
        shakeAnimation: false,
        celebrateAnimation: false,
        showDelayAnimation: false,
        delaySeconds: 0,
        delayAnimProgress: 0,
        countdownTransitioning: false,
        countdownOldSeconds: 0,
        countdownNewSeconds: 0,
        countdownTransitionProgress: 0,
      })
      
      this.stopCountdown()
      this.removeSocketListeners()
      this.triggerEvent('close')
    },
    
    // 阻止滚动穿透
    preventTouchMove() {
      return
    },
    
    // ==================== 竞拍结果弹窗 ====================
    
    /**
     * 显示竞拍结果弹窗
     * @param result 竞拍结果数据
     */
    showAuctionResult(result: any) {
      const { auction } = this.data
      const myUserId = wx.getStorageSync('userId') || ''
      
      // 构建结果数据
      const auctionResult = {
        auctionId: auction.id,
        title: auction.title || '商品',
        image: auction.images?.[0] || '',
        finalPrice: result.finalPrice || auction.currentPrice,
        winnerId: result.winnerId || '',
        winnerNickname: result.winnerNickname || '',
        myUserId: myUserId,
        status: result.status || 'ended'
      }
      
      this.setData({
        showResultModal: true,
        auctionResult: auctionResult
      })
      
      // 如果是中标，振动反馈
      if (result.winnerId === myUserId) {
        wx.vibrateShort({ type: 'medium' })
      }
    },
    
    /**
     * 关闭结果弹窗
     */
    onResultModalClose() {
      this.setData({ showResultModal: false })
      this.triggerEvent('resultClose')
    },
    
    /**
     * 结果弹窗 - 确认支付
     */
    onResultPay(e: WechatMiniprogram.CustomEvent) {
      const { auctionId, amount } = e.detail
      this.triggerEvent('pay', { auctionId, amount })
    },
    
    /**
     * 结果弹窗 - 继续围观
     */
    onResultContinue() {
      this.triggerEvent('continue')
    },
    
    /**
     * 结果弹窗 - 查看订单
     */
    onResultViewOrder(e: WechatMiniprogram.CustomEvent) {
      const { auctionId } = e.detail
      this.triggerEvent('viewOrder', { auctionId })
    },

    // ==================== AI 出价顾问 ====================

    /** 切换 AI 出价顾问显示 */
    onToggleAiAdvisor() {
      this.setData({ showAiAdvisor: !this.data.showAiAdvisor })
    },

    /** 切换顾问 Tab */
    onAiTabChange(e: WechatMiniprogram.TouchEvent) {
      const { tab } = e.currentTarget.dataset
      this.setData({ aiAdvisorTab: tab })
    },

    /** 切换风险偏好 */
    onRiskLevelChange(e: WechatMiniprogram.TouchEvent) {
      const { level } = e.currentTarget.dataset
      this.setData({ riskLevel: level })
    },

    /** 获取 AI 出价建议 */
    async onFetchBidSuggestion() {
      const { auction } = this.data
      if (!auction || !auction.id) return

      this.setData({ bidSuggestionLoading: true })
      try {
        const result = await aiService.getBidSuggestion(auction.id, this.data.riskLevel)
        this.setData({ bidSuggestion: result })
      } catch (error) {
        console.error('[BidPanel] AI出价建议失败:', error)
        wx.showToast({ title: '获取建议失败', icon: 'none' })
      } finally {
        this.setData({ bidSuggestionLoading: false })
      }
    },

    /** 获取 AI 趋势分析 */
    async onFetchTrendAnalysis() {
      const { auction } = this.data
      if (!auction || !auction.id) return

      this.setData({ trendLoading: true })
      try {
        const result = await aiService.getTrendAnalysis(auction.id)
        this.setData({ trendAnalysis: result })
      } catch (error) {
        console.error('[BidPanel] AI趋势分析失败:', error)
        wx.showToast({ title: '趋势分析失败', icon: 'none' })
      } finally {
        this.setData({ trendLoading: false })
      }
    },

    /** 使用 AI 建议出价 */
    onUseAiSuggestion() {
      const { bidSuggestion, auction } = this.data
      if (!bidSuggestion || !auction) return

      const suggestedBid = bidSuggestion.suggestedBid
      if (suggestedBid && suggestedBid > auction.currentPrice) {
        this.setData({
          bidAmount: suggestedBid,
          bidAmountText: suggestedBid.toString(),
          errorMessage: ''
        })
        const result = this.validateAmount(suggestedBid)
        if (!result.valid) {
          this.updateSmartTip()
        }
        wx.showToast({ title: '已填入建议出价', icon: 'none' })
      }
    },
  }
})