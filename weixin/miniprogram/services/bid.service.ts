// bid.service.ts
// 出价服务 - 支持 HTTP 和 WebSocket 双通道出价

import { request } from '../utils/request'
import { getSocket } from '../utils/socket'

// ==================== 类型定义 ====================

interface BidParams {
  auctionId: string
  amount: number
  requestId?: string  // 幂等键，防止重复提交
}

interface BidResult {
  success: boolean
  bidId: string
  currentPrice: number
  endTime?: number
  isExtended?: boolean
  message: string
}

/** WebSocket 出价结果 */
export interface WsBidResult {
  success: boolean
  bidId?: string
  newPrice?: number
  endTime?: number
  isExtended?: boolean
  extensionSeconds?: number
  isCompleted?: boolean  // 达到封顶价，竞拍自动成交
  capPrice?: number       // 封顶价
  message?: string
  error?: string
}

/** 服务端校验结果 */
export interface ServerValidateResult {
  valid: boolean
  message?: string
}

// ==================== BidService 类 ====================

class BidService {
  // ==================== HTTP 出价 ====================

  /**
   * 通过 HTTP 提交出价（备选方案）
   * 推荐使用 WebSocket 出价，HTTP 作为降级方案
   */
  async placeBid(params: BidParams): Promise<BidResult> {
    const res = await request.post<BidResult>(`/bids/${params.auctionId}`, { 
      amount: params.amount,
      requestId: params.requestId 
    })
    return res.data
  }

  // ==================== WebSocket 出价（推荐） ====================

  /**
   * 通过 WebSocket 提交出价（推荐方案）
   * 
   * 流程：
   * 1. 前端 BidValidator 校验通过
   * 2. 通过 WebSocket 发送 place_bid 事件
   * 3. 等待服务器响应（bid_success / bid_error / outbid）
   * 
   * @param auctionId 竞拍ID
   * @param amount 出价金额
   * @param requestId 幂等键（防重复提交）
   * @returns Promise<WsBidResult>
   */
  placeBidViaSocket(auctionId: string, amount: number, requestId?: string): Promise<WsBidResult> {
    return new Promise((resolve, reject) => {
      const sm = getSocket()
      if (!sm) {
        reject(new Error('WebSocket 未连接'))
        return
      }

      // 生成幂等键
      const reqId = requestId || this.generateRequestId()

      // 设置超时（10秒）
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('出价超时，请重试'))
      }, 10000)

      // 事件处理函数
      const onSuccess = (data: any) => {
        if (data.requestId !== reqId) return
        cleanup()
        resolve({
          success: true,
          bidId: data.bidId,
          newPrice: data.newPrice || data.amount,
          endTime: data.endTime,
          isExtended: data.isExtended,
          extensionSeconds: data.extensionSeconds,
          isCompleted: data.isCompleted,
          capPrice: data.capPrice,
          message: data.message || '出价成功'
        })
      }

      const onError = (data: any) => {
        if (data.requestId !== reqId) return
        cleanup()
        resolve({
          success: false,
          error: data.message || data.error || '出价失败'
        })
      }

      const onOutbid = (data: any) => {
        if (String(data.auctionId) !== String(auctionId)) return
        cleanup()
        resolve({
          success: false,
          error: '出价已被超越',
          newPrice: data.currentPrice
        })
      }

      // 清理事件监听
      const cleanup = () => {
        clearTimeout(timeout)
        sm.off('bid_success', onSuccess)
        sm.off('bid_error', onError)
        sm.off('outbid', onOutbid)
      }

      // 注册事件监听
      sm.on('bid_success', onSuccess)
      sm.on('bid_error', onError)
      sm.on('outbid', onOutbid)

      // 发送出价请求
      sm.emit('place_bid', {
        auctionId,
        amount,
        requestId: reqId
      })
    })
  }

  // ==================== 服务端校验 ====================

  /**
   * 服务端出价金额校验（二次校验）
   * 在前端校验通过后、提交出价前调用
   */
  async validateBidAmount(auctionId: string, amount: number): Promise<ServerValidateResult> {
    try {
      const res = await request.get<ServerValidateResult>(`/bids/${auctionId}/validate/${amount}`)
      return res.data
    } catch (error: any) {
      return {
        valid: false,
        message: error.message || '服务端校验失败'
      }
    }
  }

  // ==================== 查询方法 ====================

  /** 
   * 获取我的出价历史
   * @returns { bids: any[], total: number, page: number, limit: number, totalPages: number }
   */
  async getMyBidHistory(page?: number, limit?: number): Promise<any> {
    const p = page || 1
    const l = limit || 20
    const res = await request.get<any>('/bids/users', { page: p, limit: l })
    return res.data
  }

  /** 获取某个竞拍的出价记录 */
  async getAuctionBids(auctionId: string, page?: number, limit?: number): Promise<any[]> {
    const p = page || 1
    const l = limit || 20
    const res = await request.get<any[]>(`/bids/${auctionId}`, { page: p, limit: l })
    return res.data
  }

  /** 获取竞拍排行榜 */
  async getLeaderboard(auctionId: string, limit?: number): Promise<any[]> {
    const l = limit || 20
    const res = await request.get<any[]>(`/bids/${auctionId}/leaderboard`, { limit: l })
    return res.data
  }

  /** 获取出价历史 */
  async getBidHistory(auctionId: string, page?: number, limit?: number): Promise<any[]> {
    const p = page || 1
    const l = limit || 20
    const res = await request.get<any[]>(`/bids/${auctionId}/history`, { page: p, limit: l })
    return res.data
  }

  // ==================== 工具方法 ====================

  /**
   * 生成请求幂等键
   * 格式：auctionId_timestamp_random
   */
  private generateRequestId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `${timestamp}_${random}`
  }
}

// ==================== 导出 ====================

export const bidService = new BidService()
export default bidService