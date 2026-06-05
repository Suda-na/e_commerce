/**
 * 出价校验工具类
 * 
 * 实现完整的前端校验链路：
 * 1. 基础校验（数字有效性）
 * 2. 状态校验（竞拍是否进行中）
 * 3. 最低出价校验（当前价 + 加价幅度）
 * 4. 封顶价校验
 * 5. 智能提示生成（warning/info 不影响提交）
 * 
 * 使用示例：
 * ```ts
 * const validator = new BidValidator(auctionInfo, myLastBid)
 * const result = validator.validate(amount)
 * if (!result.valid) {
 *   wx.showToast({ title: result.error, icon: 'none' })
 *   return
 * }
 * ```
 */

// ==================== 类型定义 ====================

/** 竞拍信息 */
export interface AuctionInfo {
  id: string
  title: string
  currentPrice: number
  startPrice: number
  priceStep: number      // 加价幅度
  capPrice?: number       // 封顶价（可选）
  endTime: number
  status: string          // 'pending' | 'active' | 'ended' | 'completed'
  bidCount: number
  participantCount: number
}

/** 我的出价信息 */
export interface BidInfo {
  amount: number
  timestamp: number
  isTopBidder?: boolean
}

/** 校验结果 */
export interface ValidateResult {
  valid: boolean
  error: string | null
  warning: string | null
  info: string | null
}

// ==================== BidValidator 类 ====================

export class BidValidator {
  private auctionInfo: AuctionInfo
  private myLastBid: BidInfo | null

  constructor(
    auctionInfo: AuctionInfo,
    myLastBid: BidInfo | null = null
  ) {
    this.auctionInfo = auctionInfo
    this.myLastBid = myLastBid
  }

  /**
   * 校验出价金额
   * @param amount 出价金额
   * @returns 校验结果
   */
  validate(amount: number): ValidateResult {
    const result: ValidateResult = {
      valid: false,
      error: null,
      warning: null,
      info: null
    }

    // 1. 基础校验
    if (!Number.isFinite(amount) || amount <= 0) {
      result.error = '请输入有效的出价金额'
      return result
    }

    // 2. 状态校验
    if (this.auctionInfo.status !== 'active') {
      result.error = this.auctionInfo.status === 'completed' || this.auctionInfo.status === 'ended'
        ? '竞拍已结束'
        : '竞拍尚未开始'
      return result
    }

    // 3. 最低出价校验
    const minBid = this.auctionInfo.currentPrice + this.auctionInfo.priceStep
    if (amount < minBid) {
      result.error = `出价不能低于 ¥${minBid.toLocaleString()}`
      return result
    }

    // 4. 封顶价校验
    if (this.auctionInfo.capPrice && amount > this.auctionInfo.capPrice) {
      result.error = `出价不能超过封顶价 ¥${this.auctionInfo.capPrice.toLocaleString()}`
      return result
    }

    // 5. 通过校验
    result.valid = true

    // 6. 生成智能提示（不影响提交流程）
    this.generateSmartTips(amount, result)

    return result
  }

  /**
   * 计算最低出价金额
   */
  getMinBid(): number {
    return this.auctionInfo.currentPrice + this.auctionInfo.priceStep
  }

  /**
   * 计算建议出价列表
   */
  getSuggestedBids(): number[] {
    const base = this.getMinBid()
    const step = this.auctionInfo.priceStep
    return [
      base,
      base + step,
      base + step * 2,
      base + step * 5,
      base + step * 10
    ]
  }

  /**
   * 检查是否需要封顶价警告
   */
  isNearCapPrice(amount: number): boolean {
    if (!this.auctionInfo.capPrice) return false
    const remaining = this.auctionInfo.capPrice - amount
    return remaining >= 0 && remaining <= this.auctionInfo.priceStep * 2
  }

  /**
   * 生成智能提示
   * 优先级：高价提醒 > 最高价提示 > 默认提示
   */
  private generateSmartTips(amount: number, result: ValidateResult): void {
    const { currentPrice, priceStep, capPrice } = this.auctionInfo

    // 封顶价警告（接近封顶价时）
    if (capPrice && this.isNearCapPrice(amount)) {
      const remaining = capPrice - amount
      result.warning = `距离封顶价仅剩 ¥${remaining.toLocaleString()}，请谨慎出价`
    }
    // 高价提醒 - 出价高于当前价超过100元
    else if (amount - currentPrice > 100) {
      const diff = amount - currentPrice
      result.warning = `高于当前价 ¥${diff.toLocaleString()}`
    }

    // 最高价提示 - 我的上次出价就是当前最高价
    if (this.myLastBid?.amount === currentPrice && this.myLastBid?.isTopBidder) {
      result.info = '当前已是最高价'
    }
  }
}

// ==================== 工厂方法 ====================

/**
 * 创建 BidValidator 实例
 * @param auctionInfo 竞拍信息
 * @param myLastBid 我的上次出价
 */
export function createBidValidator(
  auctionInfo: AuctionInfo,
  myLastBid: BidInfo | null = null
): BidValidator {
  return new BidValidator(auctionInfo, myLastBid)
}

// ==================== 快捷校验方法 ====================

/**
 * 快捷出价校验（无需创建实例）
 * @param amount 出价金额
 * @param auctionInfo 竞拍信息
 * @param myLastBid 我的上次出价
 */
export function validateBid(
  amount: number,
  auctionInfo: AuctionInfo,
  myLastBid: BidInfo | null = null
): ValidateResult {
  const validator = new BidValidator(auctionInfo, myLastBid)
  return validator.validate(amount)
}

// ==================== 默认导出 ====================

export default BidValidator
