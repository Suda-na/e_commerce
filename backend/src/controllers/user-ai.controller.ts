import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { userAIService } from '../services/user-ai.service';
import { UserAIError, UserAIErrorCode } from '../dto/user-ai.dto';
import { AuthRequest } from '../types';

/**
 * 用户端AI控制器
 * 处理出价建议和竞拍趋势分析的HTTP请求
 */
export const userAIController = {
  /**
   * 获取出价建议
   * GET /api/ai/bid-suggestion/:auctionId
   */
  async getBidSuggestion(req: AuthRequest, res: Response): Promise<void> {
    try {
      const auctionId = parseInt(req.params.auctionId);
      const userId = req.user?.userId;
      const { riskLevel, currentBudget } = req.query;

      if (isNaN(auctionId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '无效的竞拍ID',
          },
        });
        return;
      }

      const suggestion = await userAIService.getBidSuggestion({
        auctionId,
        userId,
        riskLevel: riskLevel as 'conservative' | 'moderate' | 'aggressive',
        currentBudget: currentBudget ? parseFloat(currentBudget as string) : undefined,
      });

      res.status(200).json({
        success: true,
        data: suggestion,
      });
    } catch (error) {
      logger.error('Get bid suggestion failed:', error);
      
      if (error instanceof UserAIError) {
        const statusCode = this.getStatusCode(error.code);
        res.status(statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取出价建议失败',
        },
      });
    }
  },

  /**
   * 分析竞拍趋势
   * POST /api/ai/analyze-trend
   */
  async analyzeTrend(req: Request, res: Response): Promise<void> {
    try {
      const { auctionId, timeWindow, includePrediction } = req.body;

      if (!auctionId || isNaN(parseInt(auctionId))) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '无效的竞拍ID',
          },
        });
        return;
      }

      const analysis = await userAIService.getTrendAnalysis({
        auctionId: parseInt(auctionId),
        timeWindow: timeWindow ? parseInt(timeWindow) : undefined,
        includePrediction: includePrediction !== false,
      });

      res.status(200).json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      logger.error('Analyze trend failed:', error);
      
      if (error instanceof UserAIError) {
        const statusCode = this.getStatusCode(error.code);
        res.status(statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '趋势分析失败',
        },
      });
    }
  },

  /**
   * 获取实时出价提醒
   * GET /api/ai/alerts/:auctionId
   */
  async getSmartAlerts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const auctionId = parseInt(req.params.auctionId);
      const userId = req.user?.userId;

      if (isNaN(auctionId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '无效的竞拍ID',
          },
        });
        return;
      }

      // 获取出价建议作为提醒依据
      const suggestion = await userAIService.getBidSuggestion({
        auctionId,
        userId,
      });

      // 生成智能提醒
      const alerts = this.generateSmartAlerts(suggestion);

      res.status(200).json({
        success: true,
        data: {
          auctionId,
          alerts,
          suggestion: {
            suggestedBid: suggestion.suggestedBid,
            confidence: suggestion.confidence,
            optimalTiming: suggestion.optimalTiming,
          },
        },
      });
    } catch (error) {
      logger.error('Get smart alerts failed:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取智能提醒失败',
        },
      });
    }
  },

  /**
   * 生成智能提醒
   */
  generateSmartAlerts(suggestion: any): any[] {
    const alerts: any[] = [];

    // 最佳出价时机提醒
    if (suggestion.optimalTiming.recommendedAction === 'bid_now') {
      alerts.push({
        type: 'optimal_timing',
        priority: 'high',
        message: suggestion.optimalTiming.reason,
        action: '立即出价',
        suggestedAmount: suggestion.suggestedBid,
      });
    }

    // 竞争对手变化提醒
    if (suggestion.competitorAnalysis.biddingPattern === 'aggressive') {
      alerts.push({
        type: 'competition_change',
        priority: 'medium',
        message: '竞争对手出价积极，建议调整策略',
        action: '查看分析',
        details: suggestion.competitorAnalysis.predictedBehavior,
      });
    }

    // 价格预测提醒
    if (suggestion.pricePrediction.trend === 'rising') {
      alerts.push({
        type: 'price_alert',
        priority: 'medium',
        message: `预计最终价格将达到 ¥${suggestion.pricePrediction.predictedFinalPrice.toFixed(2)}`,
        action: '设置预算',
        predictedPrice: suggestion.pricePrediction.predictedFinalPrice,
      });
    }

    // 风险提醒
    if (suggestion.riskAssessment.level === 'high') {
      alerts.push({
        type: 'risk_alert',
        priority: 'high',
        message: suggestion.riskAssessment.mitigation,
        action: '查看详情',
        riskFactors: suggestion.riskAssessment.factors,
      });
    }

    return alerts;
  },

  /**
   * 根据错误代码获取HTTP状态码
   */
  getStatusCode(errorCode: UserAIErrorCode): number {
    switch (errorCode) {
      case UserAIErrorCode.AUCTION_NOT_FOUND:
        return 404;
      case UserAIErrorCode.AUCTION_NOT_ACTIVE:
        return 400;
      case UserAIErrorCode.INSUFFICIENT_DATA:
        return 400;
      case UserAIErrorCode.INVALID_REQUEST:
        return 400;
      case UserAIErrorCode.RATE_LIMITED:
        return 429;
      default:
        return 500;
    }
  },
};
