// ai.service.ts
// AI 服务（带降级支持）

import { request } from '../utils/request'
import { withDegradation, getDegradationMessage } from '../utils/ai-degradation'

class AIService {
  // 获取智能推荐（带降级）
  async getRecommendations(userId: string, limit?: number): Promise<any[]> {
    const l = limit || 10
    return withDegradation(
      'recommendations',
      async () => {
        const res = await request.get<any[]>('/ai/recommendations', { userId, limit: l })
        return res.data
      },
      [] // 降级返回空数组
    )
  }

  // 获取价格预测（带降级）
  async getPricePrediction(auctionId: string): Promise<any> {
    return withDegradation(
      'price_prediction',
      async () => {
        const res = await request.get<any>(`/ai/price-prediction/${auctionId}`)
        return res.data
      },
      null // 降级返回null
    )
  }

  // 获取竞拍分析（带降级）
  async getAuctionAnalysis(auctionId: string): Promise<any> {
    return withDegradation(
      'auction_analysis',
      async () => {
        const res = await request.get<any>(`/ai/auction-analysis/${auctionId}`)
        return res.data
      },
      null // 降级返回null
    )
  }

  // 智能客服（带降级）
  async chat(message: string, sessionId?: string): Promise<any> {
    return withDegradation(
      'chat',
      async () => {
        const res = await request.post<any>('/ai/chat', { message, sessionId })
        return res.data
      },
      { reply: getDegradationMessage('chat'), sessionId, isDegraded: true }
    )
  }

  // 图像识别（带降级）
  async imageRecognition(imageUrl: string): Promise<any> {
    return withDegradation(
      'image_recognition',
      async () => {
        const res = await request.post<any>('/ai/image-recognition', { imageUrl })
        return res.data
      },
      null // 降级返回null
    )
  }

  // 语音识别（带降级）
  async speechRecognition(audioUrl: string): Promise<any> {
    return withDegradation(
      'speech_recognition',
      async () => {
        const res = await request.post<any>('/ai/speech-recognition', { audioUrl })
        return res.data
      },
      null // 降级返回null
    )
  }

  // 获取热门搜索（带降级）
  async getHotSearches(limit?: number): Promise<string[]> {
    const l = limit || 10
    return withDegradation(
      'hot_searches',
      async () => {
        const res = await request.get<string[]>('/ai/hot-searches', { limit: l })
        return res.data
      },
      [] // 降级返回空数组
    )
  }

  // 获取搜索建议（带降级）
  async getSearchSuggestions(keyword: string): Promise<string[]> {
    return withDegradation(
      'search_suggestions',
      async () => {
        const res = await request.get<string[]>('/ai/search-suggestions', { keyword })
        return res.data
      },
      [] // 降级返回空数组
    )
  }

  // AI 出价建议（带降级）
  async getBidSuggestion(auctionId: string, riskLevel?: string, currentBudget?: number): Promise<any> {
    return withDegradation(
      'bid_suggestion',
      async () => {
        const params: Record<string, any> = {}
        if (riskLevel) params.riskLevel = riskLevel
        if (currentBudget) params.currentBudget = currentBudget
        const res = await request.get<any>(`/ai/user/bid-suggestion/${auctionId}`, params)
        return res.data
      },
      null // 降级返回null
    )
  }

  // AI 趋势分析（带降级）
  async getTrendAnalysis(auctionId: string, timeWindow?: number): Promise<any> {
    return withDegradation(
      'trend_analysis',
      async () => {
        const res = await request.post<any>('/ai/user/analyze-trend', {
          auctionId,
          timeWindow,
          includePrediction: true
        })
        return res.data
      },
      null // 降级返回null
    )
  }
}

export const aiService = new AIService()