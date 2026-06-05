import api from './api';
import {
  AnalyticsDashboard,
  AIDailyReport,
  AuctionFunnel,
  PricingSuggestion,
  ApiResponse,
} from '../types';

class AnalyticsService {
  async getDashboard(): Promise<AnalyticsDashboard> {
    const response = await api.get<ApiResponse<AnalyticsDashboard>>('/analytics/dashboard');
    return response.data.data!;
  }

  async getAIDailyReport(): Promise<AIDailyReport> {
    const response = await api.get<ApiResponse<AIDailyReport>>('/analytics/ai-daily-report');
    return response.data.data!;
  }

  async getAuctionFunnel(): Promise<AuctionFunnel> {
    const response = await api.get<ApiResponse<AuctionFunnel>>('/analytics/funnel');
    return response.data.data!;
  }

  async getPricingSuggestions(): Promise<PricingSuggestion[]> {
    const response = await api.get<ApiResponse<PricingSuggestion[]>>('/analytics/pricing-suggestions');
    return response.data.data!;
  }
}

export const analyticsService = new AnalyticsService();
