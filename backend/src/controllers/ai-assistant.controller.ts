import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { aiAssistantService } from '../services/ai-assistant.service';
import {
  GenerateDescriptionRequest,
  BroadcastSuggestionRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  AIAssistantError,
  AIAssistantErrorCode,
  SuggestPricingRequest,
  LiveScriptRequest,
} from '../dto/ai-assistant.dto';

/**
 * AI辅助控制器
 * 处理商品描述生成和直播话术建议相关的HTTP请求
 */
export const aiAssistantController = {
  /**
   * 生成商品描述
   * POST /api/ai/generate-description
   */
  async generateDescription(req: Request, res: Response): Promise<void> {
    try {
      const { productName, productType, features, style, language, maxLength } = req.body;

      // 构建请求
      const request: GenerateDescriptionRequest = {
        productName,
        productType,
        features,
        style,
        language,
        maxLength,
      };

      // 调用服务
      const response = await aiAssistantService.generateDescription(request);

      if (response.success) {
        res.status(200).json({
          success: true,
          data: response.data,
        });
      } else {
        const statusCode = getStatusCode(response.error?.code || 'UNKNOWN');
        res.status(statusCode).json({
          success: false,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error('Generate description failed:', error);
      
      if (error instanceof AIAssistantError) {
        res.status(getStatusCode(error.code)).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

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
   * 获取直播话术建议
   * GET /api/ai/broadcast-suggestion/:auctionId
   */
  async getBroadcastSuggestion(req: Request, res: Response): Promise<void> {
    try {
      const auctionId = parseInt(req.params.auctionId);
      const { auctionStatus, currentPrice, startingPrice, capPrice, timeLeft, participantCount, productName, productFeatures, style } = req.query;

      // 构建请求
      const request: BroadcastSuggestionRequest = {
        auctionId,
        auctionStatus: auctionStatus as any,
        currentPrice: currentPrice ? parseFloat(currentPrice as string) : undefined,
        startingPrice: startingPrice ? parseFloat(startingPrice as string) : undefined,
        capPrice: capPrice ? parseFloat(capPrice as string) : undefined,
        timeLeft: timeLeft ? parseInt(timeLeft as string) : undefined,
        participantCount: participantCount ? parseInt(participantCount as string) : undefined,
        productName: productName as string,
        productFeatures: productFeatures ? (productFeatures as string).split(',') : undefined,
        style: style as any,
      };

      // 调用服务
      const response = await aiAssistantService.getBroadcastSuggestion(request);

      if (response.success) {
        res.status(200).json({
          success: true,
          data: response.data,
        });
      } else {
        const statusCode = getStatusCode(response.error?.code || 'UNKNOWN');
        res.status(statusCode).json({
          success: false,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error('Get broadcast suggestion failed:', error);
      
      if (error instanceof AIAssistantError) {
        res.status(getStatusCode(error.code)).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

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
   * 获取所有话术模板
   * GET /api/ai/templates
   */
  async getAllTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await aiAssistantService.getAllTemplates();

      res.status(200).json({
        success: true,
        data: templates,
      });
    } catch (error) {
      logger.error('Get all templates failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取话术模板失败',
        },
      });
    }
  },

  /**
   * 获取话术模板详情
   * GET /api/ai/templates/:id
   */
  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = req.params.id;
      const template = await aiAssistantService.getTemplate(templateId);

      if (!template) {
        res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: '话术模板不存在',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Get template failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取话术模板失败',
        },
      });
    }
  },

  /**
   * 创建话术模板
   * POST /api/ai/templates
   */
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { name, category, content, variables, description } = req.body;

      // 构建请求
      const request: CreateTemplateRequest = {
        name,
        category,
        content,
        variables,
        description,
      };

      // 调用服务
      const template = await aiAssistantService.createTemplate(request);

      res.status(201).json({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Create template failed:', error);
      
      if (error instanceof AIAssistantError) {
        res.status(getStatusCode(error.code)).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '创建话术模板失败',
        },
      });
    }
  },

  /**
   * 更新话术模板
   * PUT /api/ai/templates/:id
   */
  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = req.params.id;
      const { name, category, content, variables, description, isActive } = req.body;

      // 构建请求
      const request: UpdateTemplateRequest = {
        name,
        category,
        content,
        variables,
        description,
        isActive,
      };

      // 调用服务
      const template = await aiAssistantService.updateTemplate(templateId, request);

      res.status(200).json({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Update template failed:', error);
      
      if (error instanceof AIAssistantError) {
        res.status(getStatusCode(error.code)).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '更新话术模板失败',
        },
      });
    }
  },

  /**
   * 删除话术模板
   * DELETE /api/ai/templates/:id
   */
  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = req.params.id;

      // 调用服务
      await aiAssistantService.deleteTemplate(templateId);

      res.status(200).json({
        success: true,
        message: '话术模板已删除',
      });
    } catch (error) {
      logger.error('Delete template failed:', error);
      
      if (error instanceof AIAssistantError) {
        res.status(getStatusCode(error.code)).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '删除话术模板失败',
        },
      });
    }
  },

  /**
   * 获取描述风格列表
   * GET /api/ai/description-styles
   */
  async getDescriptionStyles(req: Request, res: Response): Promise<void> {
    try {
      const styles = aiAssistantService.getDescriptionStyles();

      res.status(200).json({
        success: true,
        data: styles,
      });
    } catch (error) {
      logger.error('Get description styles failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取描述风格失败',
        },
      });
    }
  },

  /**
   * 获取直播话术风格列表
   * GET /api/ai/broadcast-styles
   */
  async getBroadcastStyles(req: Request, res: Response): Promise<void> {
    try {
      const styles = aiAssistantService.getBroadcastStyles();

      res.status(200).json({
        success: true,
        data: styles,
      });
    } catch (error) {
      logger.error('Get broadcast styles failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取直播话术风格失败',
        },
      });
    }
  },

  /**
   * 获取AI辅助配置
   * GET /api/ai/config
   */
  async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = aiAssistantService.getConfig();

      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error('Get config failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取配置失败',
        },
      });
    }
  },

  /**
   * 更新AI辅助配置
   * PUT /api/ai/config
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const newConfig = req.body;

      // 调用服务
      aiAssistantService.updateConfig(newConfig);

      res.status(200).json({
        success: true,
        message: '配置已更新',
      });
    } catch (error) {
      logger.error('Update config failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '更新配置失败',
        },
      });
    }
  },

  /**
   * AI定价建议
   * POST /api/ai/assistant/suggest-pricing
   */
  async suggestPricing(req: Request, res: Response): Promise<void> {
    try {
      const { productName, productType, images, targetAudience } = req.body;

      const request: SuggestPricingRequest = {
        productName,
        productType,
        images,
        targetAudience,
      };

      const response = await aiAssistantService.suggestPricing(request);

      if (response.success) {
        res.status(200).json({
          success: true,
          data: response.data,
        });
      } else {
        const statusCode = getStatusCode(response.error?.code || 'UNKNOWN');
        res.status(statusCode).json({
          success: false,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error('Suggest pricing failed:', error);

      if (error instanceof AIAssistantError) {
        res.status(getStatusCode(error.code)).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
        },
      });
    }
  },

  async generateLiveScript(req: Request, res: Response): Promise<void> {
    try {
      const { productName, productFeatures, auctionInfo, style } = req.body;

      const request: LiveScriptRequest = {
        productName,
        productFeatures,
        auctionInfo,
        style,
      };

      const response = await aiAssistantService.generateLiveScript(request);

      if (response.success) {
        res.status(200).json({
          success: true,
          data: response.data,
        });
      } else {
        const statusCode = getStatusCode(response.error?.code || 'UNKNOWN');
        res.status(statusCode).json({
          success: false,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error('Generate live script failed:', error);

      if (error instanceof AIAssistantError) {
        res.status(getStatusCode(error.code)).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
        },
      });
    }
  },
};

/**
 * 根据错误代码获取HTTP状态码
 */
function getStatusCode(errorCode: string): number {
  switch (errorCode) {
    case 'INVALID_REQUEST':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'TEMPLATE_NOT_FOUND':
      return 404;
    case 'TEMPLATE_ALREADY_EXISTS':
      return 409;
    case 'RATE_LIMITED':
      return 429;
    case 'GENERATION_FAILED':
    case 'AI_SERVICE_ERROR':
    case 'CACHE_ERROR':
      return 500;
    default:
      return 500;
  }
}
