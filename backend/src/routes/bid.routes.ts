import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { bidController } from '../controllers/bid.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { csrfProtection, distributedRateLimit } from '../middleware/security.middleware';
import { requirePermission } from '../utils/permission';
import { securityConfig } from '../config/security.config';

const router = Router();

// 验证规则
const placeBidValidation = [
  param('auctionId')
    .isInt({ min: 1 })
    .withMessage('无效的竞拍ID')
    .toInt(),
  body('amount')
    .isFloat({ min: 0.01, max: 99999999.99 })
    .withMessage('出价金额必须在0.01-99999999.99之间')
    .toFloat(),
  body('requestId')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('请求ID长度必须在1-100个字符之间')
    .trim(),
];

const validateAmountValidation = [
  param('auctionId')
    .isInt({ min: 1 })
    .withMessage('无效的竞拍ID')
    .toInt(),
  param('amount')
    .isFloat({ min: 0.01, max: 99999999.99 })
    .withMessage('出价金额必须在0.01-99999999.99之间')
    .toFloat(),
];

const auctionIdValidation = [
  param('auctionId')
    .isInt({ min: 1 })
    .withMessage('无效的竞拍ID')
    .toInt(),
];

const bidQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('页码必须是大于0的整数')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('每页数量必须在1-50之间')
    .toInt(),
];

const auctionBidQueryValidation = [
  ...auctionIdValidation,
  ...bidQueryValidation,
  query('userId')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('用户ID长度必须在1-100个字符之间')
    .trim(),
];

// 出价限流（核心高并发接口，更严格）
const bidRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `rate:bid:${req.ip}`,
  message: '出价过于频繁，请稍后再试',
});

// API限流
const apiRateLimit = distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.api.windowMs,
  max: securityConfig.apiSecurity.rateLimit.api.max,
  keyGenerator: (req) => `rate:api:bids:${req.ip}`,
  message: 'API请求过于频繁，请稍后再试',
});

// 管理操作限流
const adminRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => `rate:admin:bids:${req.ip}`,
  message: '管理操作过于频繁，请稍后再试',
});

// 路由定义（注意：静态路由必须在动态路由之前，防止Express将静态路径匹配为参数）

/**
 * @route POST /api/bids/flush-queues
 * @desc 手动刷新所有出价队列（管理员功能）
 * @access Private (需要认证+管理员权限)
 */
router.post('/flush-queues',
  authenticate,
  requirePermission('admin:write'),
  csrfProtection,
  adminRateLimit,
  asyncHandler(bidController.flushAllBidQueues)
);

/**
 * @route GET /api/bids/users
 * @desc 获取当前用户的出价记录
 * @access Private (需要认证)
 * 注意：此静态路由必须在 /:auctionId 动态路由之前，否则 "users" 会被匹配为 auctionId 参数
 */
router.get('/users',
  authenticate,
  requirePermission('bid:read'),
  apiRateLimit,
  bidQueryValidation,
  asyncHandler(bidController.getUserBids)
);

/**
 * @route POST /api/bids/:auctionId
 * @desc 出价（核心高并发接口）
 * @access Private (需要认证)
 */
router.post('/:auctionId',
  authenticate,
  requirePermission('bid:write'),
  bidRateLimit,
  placeBidValidation,
  asyncHandler(bidController.placeBid)
);

/**
 * @route GET /api/bids/:auctionId/validate/:amount
 * @desc 验证出价金额
 * @access Public
 */
router.get('/:auctionId/validate/:amount',
  apiRateLimit,
  validateAmountValidation,
  asyncHandler(bidController.validateBidAmount)
);

/**
 * @route GET /api/bids/:auctionId/leaderboard
 * @desc 获取竞拍排行榜
 * @access Public
 */
router.get('/:auctionId/leaderboard',
  apiRateLimit,
  auctionIdValidation,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('排行榜数量必须在1-100之间')
    .toInt(),
  asyncHandler(bidController.getLeaderboard)
);

/**
 * @route GET /api/bids/:auctionId/history
 * @desc 获取出价历史
 * @access Public (可选认证，认证后可获取用户特定历史)
 */
router.get('/:auctionId/history',
  apiRateLimit,
  optionalAuth,
  auctionIdValidation,
  asyncHandler(bidController.getBidHistory)
);

/**
 * @route GET /api/bids/:auctionId/stats
 * @desc 获取出价统计
 * @access Public
 */
router.get('/:auctionId/stats',
  apiRateLimit,
  auctionIdValidation,
  asyncHandler(bidController.getBidStats)
);

/**
 * @route GET /api/bids/:auctionId
 * @desc 获取竞拍的出价列表
 * @access Public
 */
router.get('/:auctionId',
  apiRateLimit,
  auctionBidQueryValidation,
  asyncHandler(bidController.getAuctionBids)
);

export default router;