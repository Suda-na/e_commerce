import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { aiService } from '../services/ai.service';
import { AIRequestDto } from '../dto/ai.dto';
import { AuthRequest } from '../types';

/**
 * AI控制器
 * 处理AI相关的HTTP请求
 */
export const aiController = {
  /**
   * 处理AI聊天请求
   * POST /api/ai/chat
   */
  async chat(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { prompt, systemPrompt, temperature, maxTokens } = req.body;
      const userId = req.user?.userId;

      // 构建请求
      const request: AIRequestDto = {
        prompt,
        systemPrompt,
        temperature,
        maxTokens,
      };

      // 调用AI服务
      const response = await aiService.processRequest(request, userId?.toString());

      if (response.success) {
        res.status(200).json({
          success: true,
          data: response.data,
          requestId: response.requestId,
        });
      } else {
        const statusCode = this.getStatusCode(response.error?.code || 'UNKNOWN');
        res.status(statusCode).json({
          success: false,
          error: response.error,
          requestId: response.requestId,
        });
      }
    } catch (error) {
      logger.error('AI chat request failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
        },
      });
    }
  },

  /**
   * 获取AI服务状态
   * GET /api/ai/status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await aiService.getApiStatus();
      
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Get AI status failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取AI状态失败',
        },
      });
    }
  },

  /**
   * 获取AI使用统计
   * GET /api/ai/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = aiService.getFormattedStats();
      
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get AI stats failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取AI统计失败',
        },
      });
    }
  },

  /**
   * 健康检查
   * GET /api/ai/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = await aiService.healthCheck();
      
      const statusCode = health.status === 'healthy' ? 200 : 
                         health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        success: health.status !== 'unhealthy',
        data: health,
      });
    } catch (error) {
      logger.error('AI health check failed:', error);
      res.status(503).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: '健康检查失败',
        },
      });
    }
  },

  /**
   * 清除AI缓存
   * POST /api/ai/cache/clear
   */
  async clearCache(req: Request, res: Response): Promise<void> {
    try {
      await aiService.clearCache();
      
      res.status(200).json({
        success: true,
        message: '缓存已清除',
      });
    } catch (error) {
      logger.error('Clear AI cache failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '清除缓存失败',
        },
      });
    }
  },

  /**
   * 重置使用统计
   * POST /api/ai/stats/reset
   */
  async resetStats(req: Request, res: Response): Promise<void> {
    try {
      aiService.resetStats();
      
      res.status(200).json({
        success: true,
        message: '统计已重置',
      });
    } catch (error) {
      logger.error('Reset AI stats failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '重置统计失败',
        },
      });
    }
  },

  /**
   * 根据错误代码获取HTTP状态码
   */
  getStatusCode(errorCode: string): number {
    switch (errorCode) {
      case 'INVALID_REQUEST':
        return 400;
      case 'AUTHENTICATION_FAILED':
        return 401;
      case 'RATE_LIMITED':
        return 429;
      case 'CONTENT_FILTERED':
        return 400;
      case 'MODEL_NOT_FOUND':
        return 404;
      case 'QUOTA_EXCEEDED':
        return 429;
      case 'TIMEOUT':
        return 408;
      case 'SERVER_ERROR':
        return 502;
      default:
        return 500;
    }
  },
};
