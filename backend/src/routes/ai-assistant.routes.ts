import { Router } from 'express';
import { aiAssistantController } from '../controllers/ai-assistant.controller';
import { authenticate, authorize } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * AI辅助路由
 * 所有AI辅助相关的路由都以 /api/ai 开头
 */

// 应用全局限流中间件
router.use(rateLimiter);

/**
 * @route POST /api/ai/generate-description
 * @desc 生成商品描述
 * @access Private (需要认证，仅商家)
 */
router.post('/generate-description', authenticate, authorize('merchant'), aiAssistantController.generateDescription);

/**
 * @route GET /api/ai/broadcast-suggestion/:auctionId
 * @desc 获取直播话术建议
 * @access Private (需要认证，仅商家)
 */
router.get('/broadcast-suggestion/:auctionId', authenticate, authorize('merchant'), aiAssistantController.getBroadcastSuggestion);

/**
 * @route GET /api/ai/templates
 * @desc 获取所有话术模板
 * @access Private (需要认证)
 */
router.get('/templates', authenticate, aiAssistantController.getAllTemplates);

/**
 * @route GET /api/ai/templates/:id
 * @desc 获取话术模板详情
 * @access Private (需要认证)
 */
router.get('/templates/:id', authenticate, aiAssistantController.getTemplate);

/**
 * @route POST /api/ai/templates
 * @desc 创建话术模板
 * @access Private (需要认证，仅商家)
 */
router.post('/templates', authenticate, authorize('merchant'), aiAssistantController.createTemplate);

/**
 * @route PUT /api/ai/templates/:id
 * @desc 更新话术模板
 * @access Private (需要认证，仅商家)
 */
router.put('/templates/:id', authenticate, authorize('merchant'), aiAssistantController.updateTemplate);

/**
 * @route DELETE /api/ai/templates/:id
 * @desc 删除话术模板
 * @access Private (需要认证，仅商家)
 */
router.delete('/templates/:id', authenticate, authorize('merchant'), aiAssistantController.deleteTemplate);

/**
 * @route GET /api/ai/description-styles
 * @desc 获取描述风格列表
 * @access Public
 */
router.get('/description-styles', aiAssistantController.getDescriptionStyles);

/**
 * @route GET /api/ai/broadcast-styles
 * @desc 获取直播话术风格列表
 * @access Public
 */
router.get('/broadcast-styles', aiAssistantController.getBroadcastStyles);

/**
 * @route GET /api/ai/config
 * @desc 获取AI辅助配置
 * @access Private (需要认证)
 */
router.get('/config', authenticate, aiAssistantController.getConfig);

/**
 * @route PUT /api/ai/config
 * @desc 更新AI辅助配置
 * @access Private (需要认证，仅商家)
 */
router.put('/config', authenticate, authorize('merchant'), aiAssistantController.updateConfig);

/**
 * @route POST /api/ai/assistant/suggest-pricing
 * @desc AI定价建议
 * @access Private (需要认证，仅商家)
 */
router.post('/suggest-pricing', authenticate, authorize('merchant'), aiAssistantController.suggestPricing);

router.post('/generate-live-script', authenticate, authorize('merchant'), aiAssistantController.generateLiveScript);

export default router;
