/**
 * 用户端AI功能DTO定义
 * 包含出价建议和竞拍趋势分析的数据结构
 */

// ==================== 出价建议相关 ====================

/**
 * 出价建议请求
 */
export interface BidSuggestionRequest {
  auctionId: number;
  userId?: number;
  currentBudget?: number;
  riskLevel?: 'conservative' | 'moderate' | 'aggressive';
}

/**
 * 出价建议响应
 */
export interface BidSuggestionResponse {
  auctionId: number;
  currentPrice: number;
  suggestedBid: number;
  minBid: number;
  maxBid: number;
  confidence: number; // 0-100 置信度
  reasoning: string;
  strategy: BidStrategy;
  riskAssessment: RiskAssessment;
  competitorAnalysis: CompetitorAnalysis;
  optimalTiming: OptimalTiming;
  pricePrediction: PricePrediction;
}

/**
 * 出价策略
 */
export interface BidStrategy {
  type: 'conservative' | 'moderate' | 'aggressive' | 'snipe';
  description: string;
  expectedOutcome: string;
  winProbability: number; // 0-100
}

/**
 * 风险评估
 */
export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  factors: string[];
  mitigation: string;
}

/**
 * 竞争对手分析
 */
export interface CompetitorAnalysis {
  totalCompetitors: number;
  activeCompetitors: number;
  averageBidAmount: number;
  biddingPattern: 'steady' | 'aggressive' | 'erratic';
  topBidders: TopBidder[];
  predictedBehavior: string;
}

/**
 * 顶级出价者
 */
export interface TopBidder {
  userId: number;
  username: string;
  bidCount: number;
  averageBid: number;
  lastBidTime: string;
  pattern: string;
}

/**
 * 最佳出价时机
 */
export interface OptimalTiming {
  recommendedAction: 'bid_now' | 'wait' | 'snipe';
  waitDuration?: number; // 秒
  reason: string;
  nextOptimalWindow?: string;
}

/**
 * 价格预测
 */
export interface PricePrediction {
  predictedFinalPrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  confidence: number; // 0-100
  trend: 'rising' | 'stable' | 'declining';
  factors: string[];
}

// ==================== 趋势分析相关 ====================

/**
 * 趋势分析请求
 */
export interface TrendAnalysisRequest {
  auctionId: number;
  timeWindow?: number; // 分钟
  includePrediction?: boolean;
}

/**
 * 趋势分析响应
 */
export interface TrendAnalysisResponse {
  auctionId: number;
  currentStatus: string;
  priceHistory: PricePoint[];
  statistics: AuctionStatistics;
  trends: TrendInsights;
  prediction: PricePrediction;
  recommendations: string[];
}

/**
 * 价格点
 */
export interface PricePoint {
  timestamp: string;
  price: number;
  bidderCount: number;
  volume: number;
}

/**
 * 竞拍统计
 */
export interface AuctionStatistics {
  totalBids: number;
  uniqueBidders: number;
  averageBidAmount: number;
  highestBid: number;
  lowestBid: number;
  priceIncrease: {
    absolute: number;
    percentage: number;
  };
  biddingFrequency: {
    bidsPerMinute: number;
    peakTime: string;
    averageInterval: number; // 秒
  };
}

/**
 * 趋势洞察
 */
export interface TrendInsights {
  momentum: 'accelerating' | 'steady' | 'decelerating';
  competition: 'intense' | 'moderate' | 'light';
  priceVolatility: 'high' | 'medium' | 'low';
  timeRemaining: number; // 秒
  urgency: 'critical' | 'high' | 'medium' | 'low';
  pattern: string;
  keyEvents: KeyEvent[];
}

/**
 * 关键事件
 */
export interface KeyEvent {
  time: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

// ==================== 智能提醒相关 ====================

/**
 * 智能提醒请求
 */
export interface SmartAlertRequest {
  auctionId: number;
  userId: number;
  alertType: 'price_threshold' | 'optimal_timing' | 'competition_change' | 'auction_ending';
  threshold?: number;
}

/**
 * 智能提醒响应
 */
export interface SmartAlertResponse {
  alertId: string;
  auctionId: number;
  type: string;
  triggered: boolean;
  message: string;
  data: any;
  timestamp: string;
}

// ==================== 缓存键 ====================

export class UserAICacheKeys {
  static bidSuggestion(auctionId: number, userId?: number): string {
    return userId 
      ? `user:ai:bid:suggestion:${auctionId}:${userId}`
      : `user:ai:bid:suggestion:${auctionId}`;
  }

  static trendAnalysis(auctionId: number): string {
    return `user:ai:trend:${auctionId}`;
  }

  static priceHistory(auctionId: number): string {
    return `user:ai:price:history:${auctionId}`;
  }

  static competitorAnalysis(auctionId: number): string {
    return `user:ai:competitor:${auctionId}`;
  }

  static userBehavior(userId: number): string {
    return `user:ai:behavior:${userId}`;
  }

  static smartAlert(alertId: string): string {
    return `user:ai:alert:${alertId}`;
  }
}

// ==================== 错误码 ====================

export enum UserAIErrorCode {
  AUCTION_NOT_FOUND = 'AUCTION_NOT_FOUND',
  AUCTION_NOT_ACTIVE = 'AUCTION_NOT_ACTIVE',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  PREDICTION_FAILED = 'PREDICTION_FAILED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * 用户端AI错误
 */
export class UserAIError extends Error {
  code: UserAIErrorCode;
  details?: any;

  constructor(code: UserAIErrorCode, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'UserAIError';
  }
}
