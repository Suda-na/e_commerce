import api from './api';
import {
  BidSuggestionResponse,
  TrendAnalysisResponse,
  SmartAlertsResponse,
  RiskLevel,
  ApiResponse,
} from '../types';

class UserAIService {
  async getBidSuggestion(
    auctionId: number,
    riskLevel?: RiskLevel,
    currentBudget?: number,
  ): Promise<BidSuggestionResponse> {
    const params: Record<string, string | number> = {};
    if (riskLevel) params.riskLevel = riskLevel;
    if (currentBudget) params.currentBudget = currentBudget;

    const response = await api.get<ApiResponse<BidSuggestionResponse>>(
      `/ai/user/bid-suggestion/${auctionId}`,
      { params },
    );
    return response.data.data!;
  }

  async getTrendAnalysis(
    auctionId: number,
    timeWindow?: number,
    includePrediction?: boolean,
  ): Promise<TrendAnalysisResponse> {
    const response = await api.post<ApiResponse<TrendAnalysisResponse>>(
      '/ai/user/analyze-trend',
      {
        auctionId,
        timeWindow,
        includePrediction: includePrediction !== false,
      },
    );
    return response.data.data!;
  }

  async getSmartAlerts(auctionId: number): Promise<SmartAlertsResponse> {
    const response = await api.get<ApiResponse<SmartAlertsResponse>>(
      `/ai/user/alerts/${auctionId}`,
    );
    return response.data.data!;
  }
}

export const userAIService = new UserAIService();
