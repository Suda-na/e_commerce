// auction.service.ts
// 竞拍服务

import { request } from '../utils/request'

interface AuctionListParams {
  page?: number
  limit?: number
  status?: string
  keyword?: string
  category?: string
  merchantId?: number | string
}

interface AuctionDetail {
  id: string
  title: string
  description: string
  images: string[]
  startPrice: number
  currentPrice: number
  priceStep: number
  startTime: string
  endTime: string
  status: string
  participantCount: number
  bidCount: number
  merchantInfo: any
  productInfo: any
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

class AuctionService {
  // 获取竞拍列表
  async getAuctionList(params: AuctionListParams): Promise<{ list: AuctionDetail[], total: number }> {
    // 转换参数名：merchantId -> merchant_id（后端使用snake_case）
    const queryParams: Record<string, any> = {}
    if (params.page) queryParams.page = params.page
    if (params.limit) queryParams.limit = params.limit
    if (params.status) queryParams.status = params.status
    if (params.keyword) queryParams.keyword = params.keyword
    if (params.category) queryParams.category = params.category
    if (params.merchantId) queryParams.merchant_id = params.merchantId

    const res = await request.get('/auctions', queryParams)
    // 后端返回格式: { success: true, data: [...auctions], meta: { total, page, limit, totalPages } }
    const auctionList = Array.isArray(res.data) ? res.data : (res.data?.list || [])
    const total = res.meta?.total ?? res.data?.total ?? auctionList.length
    return { list: auctionList, total }
  }

  // 获取竞拍详情
  async getAuctionDetail(id: string): Promise<AuctionDetail> {
    const res = await request.get(`/auctions/${id}`)
    return res.data
  }

  // 获取竞拍排行榜
  async getLeaderboard(auctionId: string): Promise<any[]> {
    const res = await request.get(`/auctions/${auctionId}/leaderboard`)
    return Array.isArray(res.data) ? res.data : (res.data?.list || [])
  }

  // 获取竞拍出价记录
  async getBidHistory(auctionId: string, page?: number, limit?: number): Promise<any[]> {
    const p = page || 1
    const l = limit || 20
    const res = await request.get(`/auctions/${auctionId}/bids`, { page: p, limit: l })
    return Array.isArray(res.data) ? res.data : (res.data?.list || [])
  }

  // 获取推荐竞拍 (使用status=active筛选)
  async getRecommendedAuctions(limit?: number): Promise<AuctionDetail[]> {
    const l = limit || 10
    const res = await request.get('/auctions', { status: 'active', limit: l, sort: 'created_at', order: 'DESC' })
    return Array.isArray(res.data) ? res.data : (res.data?.list || [])
  }

  // 获取热门竞拍 (使用status=active按出价数排序)
  async getHotAuctions(limit?: number): Promise<AuctionDetail[]> {
    const l = limit || 10
    const res = await request.get('/auctions', { status: 'active', limit: l, sort: 'current_price', order: 'DESC' })
    return Array.isArray(res.data) ? res.data : (res.data?.list || [])
  }

  // 搜索竞拍 (使用keyword参数)
  async searchAuctions(keyword: string, page?: number, limit?: number): Promise<{ list: AuctionDetail[], total: number }> {
    const p = page || 1
    const l = limit || 20
    const res = await request.get('/auctions', { keyword, page: p, limit: l })
    const auctionList = Array.isArray(res.data) ? res.data : (res.data?.list || [])
    const total = res.meta?.total ?? res.data?.total ?? auctionList.length
    return { list: auctionList, total }
  }
}

export const auctionService = new AuctionService()