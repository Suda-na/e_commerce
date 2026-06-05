// bid-dialog.ts
import { bidService } from '../../services/bid.service'

interface AuctionInfo {
  id: string
  title: string
  images: string[]
  currentPrice: number
  startPrice: number
  priceStep: number
  endTime: number
  status: string
  bidCount: number
  participantCount: number
}

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
    
    // 快捷加价
    quickAddOptions: [] as number[],
    
    // 加载状态
    isSubmitting: false,
    
    // 错误信息
    errorMessage: '',
    
    // 提示信息
    hintMessage: ''
  },

  observers: {
    'auction': function(auction: AuctionInfo) {
      if (!auction || !auction.id) return
      
      const { currentPrice, priceStep } = auction
      const minBid = currentPrice + priceStep
      
      // 计算快捷加价选项
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
        errorMessage: '',
        hintMessage: `最低出价 ¥${minBid.toLocaleString()}`
      })
    }
  },

  methods: {
    // 输入出价金额
    onBidInput(e: WechatMiniprogram.Input) {
      const value = e.detail.value
      const amount = parseFloat(value) || 0
      
      this.setData({
        bidAmount: amount,
        bidAmountText: value,
        errorMessage: ''
      })
      
      this.validateAmount(amount)
    },
    
    // 验证金额
    validateAmount(amount: number) {
      const { auction } = this.data
      const minBid = auction.currentPrice + auction.priceStep
      
      if (amount < minBid) {
        this.setData({ 
          errorMessage: `出价不能低于 ¥${minBid.toLocaleString()}`,
          hintMessage: ''
        })
        return false
      }
      
      this.setData({ 
        errorMessage: '',
        hintMessage: `最低出价 ¥${minBid.toLocaleString()}`
      })
      return true
    },
    
    // 快捷加价
    onTapQuickAdd(e: WechatMiniprogram.TouchEvent) {
      const { amount } = e.currentTarget.dataset
      const { auction } = this.data
      const newAmount = auction.currentPrice + amount
      
      this.setData({
        bidAmount: newAmount,
        bidAmountText: newAmount.toString(),
        errorMessage: '',
        hintMessage: ''
      })
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
      
      this.validateAmount(newAmount)
    },
    
    // 提交出价
    async onSubmitBid() {
      const { bidAmount, auction, isSubmitting } = this.data
      
      if (isSubmitting) return
      if (!this.validateAmount(bidAmount)) return
      
      this.setData({ isSubmitting: true })
      
      try {
        // 调用出价API
        const result = await bidService.placeBid({
          auctionId: auction.id,
          amount: bidAmount
        })
        
        // 出价成功
        wx.showToast({ title: '出价成功', icon: 'success' })
        
        this.triggerEvent('success', {
          auctionId: auction.id,
          amount: bidAmount,
          result
        })
        
        this.onClose()
      } catch (error: any) {
        console.error('[BidDialog] 出价失败:', error)
        
        let errorMsg = '出价失败，请重试'
        if (error.message) {
          errorMsg = error.message
        }
        
        this.setData({ errorMessage: errorMsg })
        wx.showToast({ title: errorMsg, icon: 'none' })
      } finally {
        this.setData({ isSubmitting: false })
      }
    },
    
    // 关闭弹窗
    onClose() {
      this.setData({
        bidAmount: 0,
        bidAmountText: '',
        errorMessage: '',
        isSubmitting: false
      })
      this.triggerEvent('close')
    },
    
    // 阻止滚动穿透
    preventTouchMove() {
      return
    }
  }
})