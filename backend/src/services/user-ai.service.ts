import { Bid } from '../models/Bid';
import { Auction } from '../models/Auction';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { redisUtils } from '../config/redis';
import { logger } from '../utils/logger';
import { aiService } from './ai.service';
import {
  BidSuggestionRequest,
  BidSuggestionResponse,
  TrendAnalysisRequest,
  TrendAnalysisResponse,
  PricePoint,
  AuctionStatistics,
  TrendInsights,
  CompetitorAnalysis,
  OptimalTiming,
  PricePrediction,
  BidStrategy,
  RiskAssessment,
  UserAICacheKeys,
  UserAIError,
  UserAIErrorCode,
} from '../dto/user-ai.dto';
import { AuctionCacheKeys } from '../dto/auction.dto';
import { Op } from 'sequelize';

/**
 * 用户端AI服务
 * 提供出价建议和竞拍趋势分析功能
 */
export class UserAIService {
  private static instance: UserAIService;

  private constructor() {}

  static getInstance(): UserAIService {
    if (!UserAIService.instance) {
      UserAIService.instance = new UserAIService();
    }
    return UserAIService.instance;
  }

  /**
   * 获取出价建议
   */
  async getBidSuggestion(request: BidSuggestionRequest): Promise<BidSuggestionResponse> {
    const { auctionId, userId, riskLevel = 'moderate' } = request;

    try {
      // 检查缓存
      const cacheKey = UserAICacheKeys.bidSuggestion(auctionId, userId);
      const cached = await redisUtils.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // 获取竞拍信息
      const auction = await this.getAuctionWithProduct(auctionId);
      if (!auction) {
        throw new UserAIError(UserAIErrorCode.AUCTION_NOT_FOUND, '竞拍不存在');
      }

      if (auction.status !== 'active') {
        throw new UserAIError(UserAIErrorCode.AUCTION_NOT_ACTIVE, '竞拍未在进行中');
      }

      // 获取历史出价数据
      const bidHistory = await this.getBidHistory(auctionId);
      
      // 获取排行榜数据
      const leaderboard = await this.getLeaderboardData(auctionId);

      // 计算统计数据
      const stats = this.calculateStatistics(bidHistory);

      // 分析竞争对手
      const competitorAnalysis = this.analyzeCompetitors(leaderboard, bidHistory);

      // 预测最终价格
      const pricePrediction = this.predictFinalPrice(auction, bidHistory, stats);

      // 确定出价策略
      const strategy = this.determineStrategy(auction, stats, competitorAnalysis, riskLevel);

      // 计算建议出价
      const suggestedBid = this.calculateSuggestedBid(auction, stats, strategy, pricePrediction);

      // 评估风险
      const riskAssessment = this.assessRisk(auction, stats, competitorAnalysis, strategy);

      // 确定最佳出价时机
      const optimalTiming = this.determineOptimalTiming(auction, stats, competitorAnalysis);

      // 生成推理说明
      const reasoning = this.generateReasoning(auction, stats, strategy, competitorAnalysis, pricePrediction);

      // 计算置信度
      const confidence = this.calculateConfidence(stats, competitorAnalysis, pricePrediction);

      const response: BidSuggestionResponse = {
        auctionId,
        currentPrice: parseFloat(auction.current_price?.toString() || '0'),
        suggestedBid,
        minBid: parseFloat(auction.current_price?.toString() || '0') + parseFloat(auction.product.price_increment.toString()),
        maxBid: auction.product.cap_price ? parseFloat(auction.product.cap_price.toString()) : Infinity,
        confidence,
        reasoning,
        strategy,
        riskAssessment,
        competitorAnalysis,
        optimalTiming,
        pricePrediction,
      };

      // 缓存结果（30秒）
      await redisUtils.set(cacheKey, JSON.stringify(response), 30);

      return response;
    } catch (error) {
      logger.error('Get bid suggestion failed:', error);
      if (error instanceof UserAIError) {
        throw error;
      }
      throw new UserAIError(UserAIErrorCode.ANALYSIS_FAILED, '出价建议生成失败');
    }
  }

  /**
   * 获取竞拍趋势分析
   */
  async getTrendAnalysis(request: TrendAnalysisRequest): Promise<TrendAnalysisResponse> {
    const { auctionId, timeWindow = 30, includePrediction = true } = request;

    try {
      // 检查缓存
      const cacheKey = UserAICacheKeys.trendAnalysis(auctionId);
      const cached = await redisUtils.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // 获取竞拍信息
      const auction = await this.getAuctionWithProduct(auctionId);
      if (!auction) {
        throw new UserAIError(UserAIErrorCode.AUCTION_NOT_FOUND, '竞拍不存在');
      }

      // 获取价格历史
      const priceHistory = await this.getPriceHistory(auctionId, timeWindow);

      // 获取出价历史
      const bidHistory = await this.getBidHistory(auctionId);

      // 计算统计数据
      const statistics = this.calculateDetailedStatistics(bidHistory, priceHistory);

      // 分析趋势
      const trends = this.analyzeTrends(auction, priceHistory, statistics);

      // 预测价格
      const prediction = includePrediction 
        ? this.predictFinalPrice(auction, bidHistory, statistics)
        : this.getDefaultPrediction(auction);

      // 生成建议
      const recommendations = this.generateRecommendations(auction, statistics, trends, prediction);

      const response: TrendAnalysisResponse = {
        auctionId,
        currentStatus: auction.status,
        priceHistory,
        statistics,
        trends,
        prediction,
        recommendations,
      };

      // 缓存结果（15秒）
      await redisUtils.set(cacheKey, JSON.stringify(response), 15);

      return response;
    } catch (error) {
      logger.error('Get trend analysis failed:', error);
      if (error instanceof UserAIError) {
        throw error;
      }
      throw new UserAIError(UserAIErrorCode.ANALYSIS_FAILED, '趋势分析失败');
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 获取竞拍及商品信息
   */
  private async getAuctionWithProduct(auctionId: number): Promise<any> {
    const auction = await Auction.findByPk(auctionId, {
      include: [
        { model: Product, as: 'product' },
      ],
    });
    return auction;
  }

  /**
   * 获取出价历史
   */
  private async getBidHistory(auctionId: number): Promise<any[]> {
    const bids = await Bid.findAll({
      where: { auction_id: auctionId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] },
      ],
      order: [['created_at', 'ASC']],
    });
    return bids;
  }

  /**
   * 获取排行榜数据
   */
  private async getLeaderboardData(auctionId: number): Promise<any[]> {
    try {
      const leaderboardKey = AuctionCacheKeys.auctionLeaderboard(auctionId);
      const entries = await redisUtils.zrevrange(leaderboardKey, 0, 9, true);
      
      const leaderboard = [];
      for (let i = 0; i < entries.length; i += 2) {
        const userId = parseInt(entries[i]);
        const amount = parseFloat(entries[i + 1]);
        const user = await User.findByPk(userId, {
          attributes: ['id', 'username', 'avatar'],
        });
        
        if (user) {
          leaderboard.push({
            userId: user.id,
            username: user.username,
            avatar: user.avatar,
            amount,
            rank: Math.floor(i / 2) + 1,
          });
        }
      }
      
      return leaderboard;
    } catch (error) {
      logger.error('Get leaderboard data failed:', error);
      return [];
    }
  }

  /**
   * 获取价格历史
   */
  private async getPriceHistory(auctionId: number, timeWindow: number): Promise<PricePoint[]> {
    const cacheKey = UserAICacheKeys.priceHistory(auctionId);
    const cached = await redisUtils.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const startTime = new Date(Date.now() - timeWindow * 60 * 1000);
    
    const bids = await Bid.findAll({
      where: {
        auction_id: auctionId,
        created_at: { [Op.gte]: startTime },
      },
      order: [['created_at', 'ASC']],
    });

    // 按时间窗口分组（每分钟）
    const priceMap = new Map<string, { prices: number[]; bidders: Set<number> }>();
    
    bids.forEach(bid => {
      const timeKey = new Date(bid.created_at).toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
      if (!priceMap.has(timeKey)) {
        priceMap.set(timeKey, { prices: [], bidders: new Set() });
      }
      const entry = priceMap.get(timeKey)!;
      entry.prices.push(parseFloat(bid.amount.toString()));
      entry.bidders.add(bid.user_id);
    });

    const priceHistory: PricePoint[] = [];
    priceMap.forEach((data, timeKey) => {
      priceHistory.push({
        timestamp: timeKey + ':00.000Z',
        price: Math.max(...data.prices),
        bidderCount: data.bidders.size,
        volume: data.prices.length,
      });
    });

    // 缓存60秒
    await redisUtils.set(cacheKey, JSON.stringify(priceHistory), 60);

    return priceHistory;
  }

  /**
   * 计算统计数据
   */
  private calculateStatistics(bids: any[]): any {
    if (bids.length === 0) {
      return {
        totalBids: 0,
        uniqueBidders: 0,
        averageBidAmount: 0,
        highestBid: 0,
        lowestBid: 0,
        priceIncrease: { absolute: 0, percentage: 0 },
        biddingFrequency: { bidsPerMinute: 0, peakTime: '', averageInterval: 0 },
      };
    }

    const amounts = bids.map(b => parseFloat(b.amount.toString()));
    const uniqueBidders = new Set(bids.map(b => b.user_id)).size;
    const timeSpan = (new Date(bids[bids.length - 1].created_at).getTime() - new Date(bids[0].created_at).getTime()) / 60000;

    return {
      totalBids: bids.length,
      uniqueBidders,
      averageBidAmount: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      highestBid: Math.max(...amounts),
      lowestBid: Math.min(...amounts),
      priceIncrease: {
        absolute: amounts[amounts.length - 1] - amounts[0],
        percentage: ((amounts[amounts.length - 1] - amounts[0]) / amounts[0]) * 100,
      },
      biddingFrequency: {
        bidsPerMinute: timeSpan > 0 ? bids.length / timeSpan : 0,
        peakTime: this.findPeakTime(bids),
        averageInterval: timeSpan > 0 ? (timeSpan * 60) / bids.length : 0,
      },
    };
  }

  /**
   * 计算详细统计数据
   */
  private calculateDetailedStatistics(bids: any[], priceHistory: PricePoint[]): AuctionStatistics {
    const stats = this.calculateStatistics(bids);
    
    return {
      ...stats,
      biddingFrequency: {
        ...stats.biddingFrequency,
        peakTime: priceHistory.length > 0 
          ? priceHistory.reduce((max, p) => p.volume > max.volume ? p : max).timestamp
          : '',
      },
    };
  }

  /**
   * 找出高峰时间
   */
  private findPeakTime(bids: any[]): string {
    if (bids.length === 0) return '';
    
    const hourCounts = new Map<number, number>();
    bids.forEach(bid => {
      const hour = new Date(bid.created_at).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });
    
    let peakHour = 0;
    let maxCount = 0;
    hourCounts.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    });
    
    return `${peakHour}:00`;
  }

  /**
   * 分析竞争对手
   */
  private analyzeCompetitors(leaderboard: any[], bids: any[]): CompetitorAnalysis {
    const userBids = new Map<number, { count: number; totalAmount: number; lastBid: Date }>();
    
    bids.forEach(bid => {
      const existing = userBids.get(bid.user_id) || { count: 0, totalAmount: 0, lastBid: new Date(0) };
      existing.count++;
      existing.totalAmount += parseFloat(bid.amount.toString());
      existing.lastBid = new Date(bid.created_at);
      userBids.set(bid.user_id, existing);
    });

    const topBidders = leaderboard.slice(0, 5).map(entry => {
      const userData = userBids.get(entry.userId);
      return {
        userId: entry.userId,
        username: entry.username,
        bidCount: userData?.count || 0,
        averageBid: userData ? userData.totalAmount / userData.count : 0,
        lastBidTime: userData?.lastBid.toISOString() || '',
        pattern: this.classifyBidPattern(userData?.count || 0, userData?.totalAmount || 0),
      };
    });

    // 判断出价模式
    const bidCounts = Array.from(userBids.values()).map(u => u.count);
    const avgBidCount = bidCounts.reduce((a, b) => a + b, 0) / bidCounts.length;
    const variance = bidCounts.reduce((sum, count) => sum + Math.pow(count - avgBidCount, 2), 0) / bidCounts.length;
    
    let biddingPattern: 'steady' | 'aggressive' | 'erratic' = 'steady';
    if (variance > 10) {
      biddingPattern = 'erratic';
    } else if (avgBidCount > 5) {
      biddingPattern = 'aggressive';
    }

    return {
      totalCompetitors: userBids.size,
      activeCompetitors: leaderboard.length,
      averageBidAmount: bids.length > 0 
        ? bids.reduce((sum, b) => sum + parseFloat(b.amount.toString()), 0) / bids.length
        : 0,
      biddingPattern,
      topBidders,
      predictedBehavior: this.predictCompetitorBehavior(biddingPattern, topBidders),
    };
  }

  /**
   * 分类出价模式
   */
  private classifyBidPattern(count: number, totalAmount: number): string {
    if (count >= 10) return '积极竞拍者';
    if (count >= 5) return '稳定竞拍者';
    if (count >= 2) return '偶尔参与';
    return '新参与者';
  }

  /**
   * 预测竞争对手行为
   */
  private predictCompetitorBehavior(pattern: string, topBidders: any[]): string {
    if (pattern === 'aggressive') {
      return '竞争对手出价积极，预计会持续加价';
    }
    if (pattern === 'erratic') {
      return '竞争对手出价不稳定，存在突然加价的可能';
    }
    return '竞争对手出价稳定，预计会按部就班加价';
  }

  /**
   * 预测最终价格
   */
  private predictFinalPrice(auction: any, bids: any[], stats: any): PricePrediction {
    const currentPrice = parseFloat(auction.current_price?.toString() || '0');
    const startingPrice = parseFloat(auction.product.starting_price.toString());
    const capPrice = auction.product.cap_price ? parseFloat(auction.product.cap_price.toString()) : null;
    
    if (bids.length < 3) {
      return this.getDefaultPrediction(auction);
    }

    // 计算价格增长率
    const priceGrowthRate = stats.priceIncrease.percentage / (bids.length || 1);
    
    // 估算剩余时间内的出价次数
    const endTime = new Date(auction.end_time).getTime();
    const now = Date.now();
    const remainingMinutes = Math.max(0, (endTime - now) / 60000);
    const estimatedFutureBids = remainingMinutes * stats.biddingFrequency.bidsPerMinute;
    
    // 预测最终价格
    let predictedFinalPrice = currentPrice * (1 + priceGrowthRate * estimatedFutureBids / 100);
    
    // 限制在封顶价内
    if (capPrice && predictedFinalPrice > capPrice) {
      predictedFinalPrice = capPrice;
    }

    // 计算价格范围
    const variance = predictedFinalPrice * 0.15;
    
    return {
      predictedFinalPrice,
      priceRange: {
        min: Math.max(currentPrice, predictedFinalPrice - variance),
        max: capPrice ? Math.min(capPrice, predictedFinalPrice + variance) : predictedFinalPrice + variance,
      },
      confidence: this.calculatePredictionConfidence(stats, bids.length),
      trend: priceGrowthRate > 5 ? 'rising' : priceGrowthRate < -5 ? 'declining' : 'stable',
      factors: [
        `历史出价 ${bids.length} 次`,
        `价格增长率 ${priceGrowthRate.toFixed(1)}%`,
        `预计剩余 ${Math.round(remainingMinutes)} 分钟`,
      ],
    };
  }

  /**
   * 获取默认预测
   */
  private getDefaultPrediction(auction: any): PricePrediction {
    const currentPrice = parseFloat(auction.current_price?.toString() || '0');
    const startingPrice = parseFloat(auction.product.starting_price.toString());
    
    return {
      predictedFinalPrice: currentPrice * 1.2,
      priceRange: {
        min: currentPrice,
        max: currentPrice * 1.5,
      },
      confidence: 30,
      trend: 'stable',
      factors: ['数据不足，基于当前价格估算'],
    };
  }

  /**
   * 计算预测置信度
   */
  private calculatePredictionConfidence(stats: any, bidCount: number): number {
    let confidence = 50;
    
    // 数据量越多，置信度越高
    if (bidCount > 20) confidence += 20;
    else if (bidCount > 10) confidence += 15;
    else if (bidCount > 5) confidence += 10;
    
    // 竞拍者越多，置信度越高
    if (stats.uniqueBidders > 5) confidence += 15;
    else if (stats.uniqueBidders > 3) confidence += 10;
    
    // 出价频率稳定，置信度越高
    if (stats.biddingFrequency.bidsPerMinute > 0.5) confidence += 10;
    
    return Math.min(95, confidence);
  }

  /**
   * 确定出价策略
   */
  private determineStrategy(auction: any, stats: any, competitorAnalysis: any, riskLevel: string): BidStrategy {
    const currentPrice = parseFloat(auction.current_price?.toString() || '0');
    const capPrice = auction.product.cap_price ? parseFloat(auction.product.cap_price.toString()) : null;
    const remainingRatio = capPrice ? (capPrice - currentPrice) / capPrice : 1;
    
    let type: 'conservative' | 'moderate' | 'aggressive' | 'snipe';
    let description: string;
    let expectedOutcome: string;
    let winProbability: number;

    if (riskLevel === 'conservative' || remainingRatio < 0.1) {
      type = 'conservative';
      description = '保守策略：小幅加价，控制风险';
      expectedOutcome = '可能错过竞拍，但风险最低';
      winProbability = 30;
    } else if (riskLevel === 'aggressive' || competitorAnalysis.biddingPattern === 'aggressive') {
      type = 'aggressive';
      description = '积极策略：大幅加价，压制对手';
      expectedOutcome = '提高获胜概率，但成本较高';
      winProbability = 70;
    } else if (stats.biddingFrequency.bidsPerMinute > 1) {
      type = 'snipe';
      description = '狙击策略：等待最后时刻出价';
      expectedOutcome = '在对手来不及反应时获胜';
      winProbability = 60;
    } else {
      type = 'moderate';
      description = '适中策略：按加价幅度稳步出价';
      expectedOutcome = '平衡风险和收益';
      winProbability = 50;
    }

    return { type, description, expectedOutcome, winProbability };
  }

  /**
   * 计算建议出价
   */
  private calculateSuggestedBid(auction: any, stats: any, strategy: BidStrategy, prediction: PricePrediction): number {
    const currentPrice = parseFloat(auction.current_price?.toString() || '0');
    const priceIncrement = parseFloat(auction.product.price_increment.toString());
    const capPrice = auction.product.cap_price ? parseFloat(auction.product.cap_price.toString()) : null;
    
    let suggestedBid: number;

    switch (strategy.type) {
      case 'conservative':
        suggestedBid = currentPrice + priceIncrement;
        break;
      case 'moderate':
        suggestedBid = currentPrice + priceIncrement * 2;
        break;
      case 'aggressive':
        suggestedBid = currentPrice + priceIncrement * 3;
        break;
      case 'snipe':
        suggestedBid = prediction.predictedFinalPrice * 0.95;
        break;
      default:
        suggestedBid = currentPrice + priceIncrement;
    }

    // 确保不超过封顶价
    if (capPrice && suggestedBid > capPrice) {
      suggestedBid = capPrice;
    }

    // 确保不低于最低出价
    const minBid = currentPrice + priceIncrement;
    if (suggestedBid < minBid) {
      suggestedBid = minBid;
    }

    return Math.round(suggestedBid * 100) / 100;
  }

  /**
   * 评估风险
   */
  private assessRisk(auction: any, stats: any, competitorAnalysis: any, strategy: BidStrategy): RiskAssessment {
    const factors: string[] = [];
    let level: 'low' | 'medium' | 'high' = 'low';

    // 竞争对手数量
    if (competitorAnalysis.activeCompetitors > 5) {
      factors.push('竞争对手较多');
      level = 'high';
    } else if (competitorAnalysis.activeCompetitors > 2) {
      factors.push('竞争对手适中');
      level = 'medium';
    }

    // 出价频率
    if (stats.biddingFrequency.bidsPerMinute > 2) {
      factors.push('出价非常频繁');
      level = 'high';
    }

    // 价格接近封顶价
    const currentPrice = parseFloat(auction.current_price?.toString() || '0');
    const capPrice = auction.product.cap_price ? parseFloat(auction.product.cap_price.toString()) : null;
    if (capPrice && (capPrice - currentPrice) / capPrice < 0.2) {
      factors.push('价格接近封顶价');
      level = 'high';
    }

    // 策略风险
    if (strategy.type === 'aggressive') {
      factors.push('采用积极策略');
      level = 'high';
    }

    const mitigation = level === 'high' 
      ? '建议设置预算上限，避免过度出价'
      : level === 'medium'
      ? '建议按计划出价，注意竞争对手动态'
      : '风险较低，可按策略执行';

    return { level, factors, mitigation };
  }

  /**
   * 确定最佳出价时机
   */
  private determineOptimalTiming(auction: any, stats: any, competitorAnalysis: any): OptimalTiming {
    const endTime = new Date(auction.end_time).getTime();
    const now = Date.now();
    const remainingSeconds = Math.max(0, (endTime - now) / 1000);

    // 如果剩余时间少于30秒，建议立即出价
    if (remainingSeconds < 30) {
      return {
        recommendedAction: 'bid_now',
        reason: '竞拍即将结束，建议立即出价',
      };
    }

    // 如果出价频繁，建议等待
    if (stats.biddingFrequency.bidsPerMinute > 2) {
      return {
        recommendedAction: 'wait',
        waitDuration: Math.min(60, remainingSeconds - 10),
        reason: '当前出价频繁，建议等待竞争减缓',
        nextOptimalWindow: '出价频率降低时',
      };
    }

    // 如果剩余时间充足，建议狙击
    if (remainingSeconds > 120) {
      return {
        recommendedAction: 'snipe',
        waitDuration: remainingSeconds - 15,
        reason: '剩余时间充足，建议在最后时刻出价',
        nextOptimalWindow: `竞拍结束前15秒`,
      };
    }

    return {
      recommendedAction: 'bid_now',
      reason: '时机合适，建议出价',
    };
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(auction: any, priceHistory: PricePoint[], stats: AuctionStatistics): TrendInsights {
    if (priceHistory.length < 2) {
      return {
        momentum: 'steady',
        competition: 'light',
        priceVolatility: 'low',
        timeRemaining: 0,
        urgency: 'low',
        pattern: '数据不足',
        keyEvents: [],
      };
    }

    // 计算动量
    const recentPrices = priceHistory.slice(-5).map(p => p.price);
    const priceChanges = recentPrices.slice(1).map((p, i) => p - recentPrices[i]);
    const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    
    let momentum: 'accelerating' | 'steady' | 'decelerating' = 'steady';
    if (avgChange > 10) momentum = 'accelerating';
    else if (avgChange < -10) momentum = 'decelerating';

    // 计算竞争强度
    let competition: 'intense' | 'moderate' | 'light' = 'light';
    if (stats.uniqueBidders > 5) competition = 'intense';
    else if (stats.uniqueBidders > 2) competition = 'moderate';

    // 计算价格波动
    const priceVariance = priceHistory.reduce((sum, p) => {
      const diff = p.price - stats.averageBidAmount;
      return sum + diff * diff;
    }, 0) / priceHistory.length;
    
    let priceVolatility: 'high' | 'medium' | 'low' = 'low';
    if (priceVariance > 1000) priceVolatility = 'high';
    else if (priceVariance > 100) priceVolatility = 'medium';

    // 计算剩余时间
    const endTime = new Date(auction.end_time).getTime();
    const timeRemaining = Math.max(0, (endTime - Date.now()) / 1000);

    // 计算紧急程度
    let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (timeRemaining < 30) urgency = 'critical';
    else if (timeRemaining < 120) urgency = 'high';
    else if (timeRemaining < 300) urgency = 'medium';

    return {
      momentum,
      competition,
      priceVolatility,
      timeRemaining,
      urgency,
      pattern: this.identifyPattern(priceHistory),
      keyEvents: this.identifyKeyEvents(priceHistory, stats),
    };
  }

  /**
   * 识别模式
   */
  private identifyPattern(priceHistory: PricePoint[]): string {
    if (priceHistory.length < 3) return '数据不足';
    
    const prices = priceHistory.map(p => p.price);
    const isIncreasing = prices.every((p, i) => i === 0 || p >= prices[i - 1]);
    const isDecreasing = prices.every((p, i) => i === 0 || p <= prices[i - 1]);
    
    if (isIncreasing) return '持续上涨';
    if (isDecreasing) return '持续下降';
    return '波动变化';
  }

  /**
   * 识别关键事件
   */
  private identifyKeyEvents(priceHistory: PricePoint[], stats: AuctionStatistics): any[] {
    const events: any[] = [];
    
    // 找出价格大幅上涨的点
    priceHistory.forEach((point, index) => {
      if (index > 0) {
        const increase = point.price - priceHistory[index - 1].price;
        const percentage = (increase / priceHistory[index - 1].price) * 100;
        
        if (percentage > 10) {
          events.push({
            time: point.timestamp,
            event: '价格大幅上涨',
            impact: 'high',
            description: `价格上涨 ${percentage.toFixed(1)}%`,
          });
        }
      }
    });

    // 找出竞价者激增的点
    priceHistory.forEach((point, index) => {
      if (index > 0 && point.bidderCount > priceHistory[index - 1].bidderCount * 2) {
        events.push({
          time: point.timestamp,
          event: '新竞拍者加入',
          impact: 'medium',
          description: `${point.bidderCount} 位竞拍者参与`,
        });
      }
    });

    return events.slice(0, 5); // 最多返回5个关键事件
  }

  /**
   * 生成推理说明
   */
  private generateReasoning(auction: any, stats: any, strategy: BidStrategy, competitorAnalysis: any, prediction: PricePrediction): string {
    const parts: string[] = [];
    
    parts.push(`当前竞拍有 ${competitorAnalysis.activeCompetitors} 位活跃竞拍者`);
    parts.push(`已出价 ${stats.totalBids} 次`);
    parts.push(`建议采用${strategy.description}`);
    parts.push(`预计最终价格为 ¥${prediction.predictedFinalPrice.toFixed(2)}`);
    
    if (competitorAnalysis.biddingPattern === 'aggressive') {
      parts.push('竞争对手出价积极，需要谨慎应对');
    }
    
    return parts.join('。') + '。';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(stats: any, competitorAnalysis: any, prediction: PricePrediction): number {
    let confidence = 50;
    
    // 数据量
    if (stats.totalBids > 20) confidence += 20;
    else if (stats.totalBids > 10) confidence += 15;
    else if (stats.totalBids > 5) confidence += 10;
    
    // 竞争对手分析
    if (competitorAnalysis.topBidders.length > 3) confidence += 10;
    
    // 预测置信度
    confidence += prediction.confidence * 0.2;
    
    return Math.min(95, Math.round(confidence));
  }

  /**
   * 生成建议
   */
  private generateRecommendations(auction: any, stats: AuctionStatistics, trends: TrendInsights, prediction: PricePrediction): string[] {
    const recommendations: string[] = [];
    
    if (trends.urgency === 'critical') {
      recommendations.push('竞拍即将结束，如需出价请立即行动');
    }
    
    if (trends.momentum === 'accelerating') {
      recommendations.push('价格正在快速上涨，建议尽早决策');
    }
    
    if (trends.competition === 'intense') {
      recommendations.push('竞争激烈，建议设置预算上限');
    }
    
    if (prediction.trend === 'rising') {
      recommendations.push(`预计价格将继续上涨，最终可能达到 ¥${prediction.predictedFinalPrice.toFixed(2)}`);
    }
    
    if (stats.biddingFrequency.bidsPerMinute > 1) {
      recommendations.push('出价频繁，建议在出价间隙果断出手');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('当前竞拍状态稳定，可按计划参与');
    }
    
    return recommendations;
  }
}

// 导出单例
export const userAIService = UserAIService.getInstance();
