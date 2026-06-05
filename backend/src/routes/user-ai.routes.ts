import { Router } from 'express';
import { userAIController } from '../controllers/user-ai.controller';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * 用户端AI路由
 * 提供出价建议和竞拍趋势分析功能
 * 所有路由都以 /api/ai/user 开头
 */

// 应用全局限流中间件
router.use(rateLimiter);

/**
 * @route GET /api/ai/user/bid-suggestion/:auctionId
 * @desc 获取出价建议
 * @access Private (需要认证)
 * @query {string} [riskLevel] - 风险偏好：conservative/moderate/aggressive
 * @query {number} [currentBudget] - 当前预算限制
 */
router.get('/bid-suggestion/:auctionId', authenticate, userAIController.getBidSuggestion);

/**
 * @route POST /api/ai/user/analyze-trend
 * @desc 分析竞拍趋势
 * @access Private (需要认证)
 * @body {number} auctionId - 竞拍ID
 * @body {number} [timeWindow] - 分析时间窗口（秒）
 * @body {boolean} [includePrediction] - 是否包含价格预测
 */
router.post('/analyze-trend', authenticate, userAIController.analyzeTrend);

/**
 * @route GET /api/ai/user/alerts/:auctionId
 * @desc 获取实时出价提醒
 * @access Private (需要认证)
 */
router.get('/alerts/:auctionId', authenticate, userAIController.getSmartAlerts);

export default router;