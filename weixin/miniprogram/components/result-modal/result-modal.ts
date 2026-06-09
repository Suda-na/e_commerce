// result-modal.ts - 竞拍结果弹窗组件
// 支持两种状态：中标庆祝（彩带动画）和未中标遗憾

/** 结果类型 */
type ResultType = 'won' | 'lost' | 'ended'

/** 竞拍结果数据 */
interface AuctionResult {
  auctionId: string
  title: string
  image: string
  finalPrice: number
  winnerId?: string
  winnerNickname?: string
  myUserId: string
  status: string
}

Component({
  properties: {
    // 是否显示
    visible: {
      type: Boolean,
      value: false
    },
    // 竞拍结果数据
    result: {
      type: Object,
      value: {} as AuctionResult
    }
  },

  data: {
    // 结果类型
    resultType: 'lost' as ResultType,
    
    // 彩带粒子数组
    confettiParticles: [] as Array<{
      id: number
      left: number
      delay: number
      duration: number
      color: string
      size: number
      rotation: number
    }>,
    
    // 动画控制
    showCelebration: false,
    showContent: false,
    
    // 自动关闭定时器
    autoCloseTimer: null as any,
    
    // 倒计时
    countdown: 10,
    countdownTimer: null as any
  },

  observers: {
    // 监听结果数据变化
    'result': function(result: AuctionResult) {
      if (!result || !result.auctionId) return
      
      // 判断结果类型（统一转为字符串比较，避免 number vs string 类型不匹配）
      const isWon = String(result.winnerId) === String(result.myUserId)
      const resultType: ResultType = isWon ? 'won' : 'lost'
      
      this.setData({ resultType })
      
      // 如果是中标，生成彩带粒子
      if (isWon) {
        this.generateConfetti()
      }
    },
    
    // 监听显示状态
    'visible': function(visible: boolean) {
      if (visible) {
        this.onShow()
      } else {
        this.onHide()
      }
    }
  },

  lifetimes: {
    detached() {
      this.clearTimers()
    }
  },

  methods: {
    /**
     * 显示弹窗时的处理
     */
    onShow() {
      const { resultType } = this.data
      
      // 延迟显示内容（入场动画）
      setTimeout(() => {
        this.setData({ showContent: true })
      }, 100)
      
      // 如果是中标，延迟显示庆祝动画
      if (resultType === 'won') {
        setTimeout(() => {
          this.setData({ showCelebration: true })
          // 振动反馈
          wx.vibrateShort({ type: 'medium' })
        }, 300)
      }
      
      // 启动自动关闭倒计时
      this.startAutoClose()
    },
    
    /**
     * 隐藏弹窗时的处理
     */
    onHide() {
      this.clearTimers()
      this.setData({
        showCelebration: false,
        showContent: false,
        countdown: 10
      })
    },
    
    /**
     * 生成彩带粒子
     */
    generateConfetti() {
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
      ]
      
      const particles = []
      for (let i = 0; i < 50; i++) {
        particles.push({
          id: i,
          left: Math.random() * 100, // 0-100%
          delay: Math.random() * 2, // 0-2s
          duration: 2 + Math.random() * 3, // 2-5s
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 6 + Math.random() * 10, // 6-16px
          rotation: Math.random() * 360 // 0-360deg
        })
      }
      
      this.setData({ confettiParticles: particles })
    },
    
    /**
     * 启动自动关闭倒计时
     */
    startAutoClose() {
      this.clearTimers()
      
      this.setData({ countdown: 10 })
      
      // 每秒更新倒计时
      this.data.countdownTimer = setInterval(() => {
        const { countdown } = this.data
        if (countdown <= 1) {
          this.onClose()
        } else {
          this.setData({ countdown: countdown - 1 })
        }
      }, 1000)
    },
    
    /**
     * 清除所有定时器
     */
    clearTimers() {
      if (this.data.autoCloseTimer) {
        clearTimeout(this.data.autoCloseTimer)
        this.setData({ autoCloseTimer: null })
      }
      if (this.data.countdownTimer) {
        clearInterval(this.data.countdownTimer)
        this.setData({ countdownTimer: null })
      }
    },
    
    /**
     * 关闭弹窗
     */
    onClose() {
      this.clearTimers()
      this.triggerEvent('close')
    },
    
    /**
     * 阻止滚动穿透
     */
    preventTouchMove() {
      return
    },
    
    /**
     * 点击遮罩关闭
     */
    onMaskTap() {
      this.onClose()
    },
    
    /**
     * 确认支付（中标时）
     */
    onConfirmPay() {
      const { result } = this.data
      this.triggerEvent('pay', { auctionId: result.auctionId, amount: result.finalPrice })
      this.onClose()
    },
    
    /**
     * 继续围观（未中标时）
     */
    onContinueWatch() {
      this.triggerEvent('continue')
      this.onClose()
    },
    
    /**
     * 查看订单
     */
    onViewOrder() {
      const { result } = this.data
      this.triggerEvent('viewOrder', { auctionId: result.auctionId })
      this.onClose()
    }
  }
})