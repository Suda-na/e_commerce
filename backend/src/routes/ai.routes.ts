import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * AI路由
 * 所有AI相关的路由都以 /api/ai 开头
 */

// 应用全局限流中间件
router.use(rateLimiter);

/**
 * @route POST /api/ai/chat
 * @desc 处理AI聊天请求
 * @access Private (需要认证)
 */
router.post('/chat', authenticate, aiController.chat);

/**
 * @route GET /api/ai/status
 * @desc 获取AI服务状态
 * @access Private (需要认证)
 */
router.get('/status', authenticate, aiController.getStatus);

/**
 * @route GET /api/ai/stats
 * @desc 获取AI使用统计
 * @access Private (需要认证)
 */
router.get('/stats', authenticate, aiController.getStats);

/**
 * @route GET /api/ai/health
 * @desc AI服务健康检查
 * @access Public
 */
router.get('/health', aiController.healthCheck);

/**
 * @route POST /api/ai/cache/clear
 * @desc 清除AI缓存
 * @access Private (需要认证，仅管理员)
 */
router.post('/cache/clear', authenticate, aiController.clearCache);

/**
 * @route POST /api/ai/stats/reset
 * @desc 重置使用统计
 * @access Private (需要认证，仅管理员)
 */
router.post('/stats/reset', authenticate, aiController.resetStats);

export default router;
