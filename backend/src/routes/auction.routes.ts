import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { auctionController } from '../controllers/auction.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { csrfProtection, distributedRateLimit } from '../middleware/security.middleware';
import { auctionViewMiddleware } from '../middleware/page-view.middleware';
import { requirePermission } from '../utils/permission';
import { securityConfig } from '../config/security.config';

const router = Router();

// 验证规则
const createAuctionValidation = [
  body('product_id')
    .isInt({ min: 1 })
    .withMessage('无效的商品ID')
    .toInt(),
];

const placeBidValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('无效的竞拍ID')
    .toInt(),
  body('amount')
    .isFloat({ min: 0.01, max: 99999999.99 })
    .withMessage('出价金额必须在0.01-99999999.99之间')
    .toFloat(),
];

const queryValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'active', 'completed', 'cancelled'])
    .withMessage('无效的竞拍状态'),
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
  query('sort')
    .optional()
    .isIn(['created_at', 'start_time', 'end_time', 'current_price'])
    .withMessage('无效的排序字段'),
  query('order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('排序方向必须是ASC或DESC'),
  query('keyword')
    .optional()
    .isString()
    .withMessage('搜索关键词必须是字符串')
    .trim(),
  query('merchant_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('无效的商家ID')
    .toInt(),
];

// API限流
const apiRateLimit = distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.api.windowMs,
  max: securityConfig.apiSecurity.rateLimit.api.max,
  keyGenerator: (req) => `rate:api:auctions:${req.ip}`,
  message: 'API请求过于频繁，请稍后再试',
});

// 写操作限流
const writeRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `rate:write:auctions:${req.ip}`,
  message: '写操作过于频繁，请稍后再试',
});

// 出价限流（更严格）
const bidRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `rate:bid:${req.ip}`,
  message: '出价过于频繁，请稍后再试',
});

// 路由定义

/**
 * @route POST /api/auctions/list-product/:productId
 * @desc 上架商品（创建竞拍并立即开始）
 * @access Private (Merchant only, 需CSRF验证)
 */
router.post('/list-product/:productId',
  authenticate,
  authorize('merchant'),
  requirePermission('auction:write'),
  csrfProtection,
  writeRateLimit,
  param('productId').isInt({ min: 1 }).withMessage('无效的商品ID').toInt(),
  asyncHandler(auctionController.listProduct)
);

/**
 * @route POST /api/auctions/delist-product/:productId
 * @desc 下架商品（取消竞拍并将状态改为已取消）
 * @access Private (Merchant only, 需CSRF验证)
 */
router.post('/delist-product/:productId',
  authenticate,
  authorize('merchant'),
  requirePermission('auction:delete'),
  csrfProtection,
  writeRateLimit,
  param('productId').isInt({ min: 1 }).withMessage('无效的商品ID').toInt(),
  asyncHandler(auctionController.delistProduct)
);

/**
 * @route POST /api/auctions
 * @desc 创建竞拍
 * @access Private (Merchant only, 需CSRF验证)
 */
router.post('/',
  authenticate,
  authorize('merchant'),
  requirePermission('auction:write'),
  csrfProtection,
  writeRateLimit,
  createAuctionValidation,
  asyncHandler(auctionController.createAuction)
);

/**
 * @route GET /api/auctions
 * @desc 获取竞拍列表
 * @access Public
 */
router.get('/',
  apiRateLimit,
  queryValidation,
  asyncHandler(auctionController.getAuctions)
);

/**
 * @route GET /api/auctions/merchant
 * @desc 获取商家的竞拍列表
 * @access Private (Merchant only)
 */
router.get('/merchant',
  authenticate,
  authorize('merchant'),
  requirePermission('auction:read'),
  apiRateLimit,
  queryValidation,
  asyncHandler(auctionController.getMerchantAuctions)
);

/**
 * @route GET /api/auctions/:id
 * @desc 获取竞拍详情
 * @access Public
 */
router.get('/:id',
  apiRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的竞拍ID').toInt(),
  auctionViewMiddleware,
  asyncHandler(auctionController.getAuctionById)
);

/**
 * @route GET /api/auctions/product/:productId
 * @desc 获取商品的竞拍
 * @access Public
 */
router.get('/product/:productId',
  apiRateLimit,
  param('productId').isInt({ min: 1 }).withMessage('无效的商品ID').toInt(),
  asyncHandler(auctionController.getAuctionByProductId)
);

/**
 * @route POST /api/auctions/:id/start
 * @desc 开始竞拍
 * @access Private (Merchant only, 需CSRF验证)
 */
router.post('/:id/start',
  authenticate,
  authorize('merchant'),
  requirePermission('auction:start'),
  csrfProtection,
  writeRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的竞拍ID').toInt(),
  asyncHandler(auctionController.startAuction)
);

/**
 * @route POST /api/auctions/:id/complete
 * @desc 结束竞拍
 * @access Private (Merchant only, 需CSRF验证)
 */
router.post('/:id/complete',
  authenticate,
  authorize('merchant'),
  requirePermission('auction:end'),
  csrfProtection,
  writeRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的竞拍ID').toInt(),
  asyncHandler(auctionController.completeAuction)
);

/**
 * @route POST /api/auctions/:id/cancel
 * @desc 取消竞拍
 * @access Private (Merchant only, 需CSRF验证)
 */
router.post('/:id/cancel',
  authenticate,
  authorize('merchant'),
  requirePermission('auction:delete'),
  csrfProtection,
  writeRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的竞拍ID').toInt(),
  asyncHandler(auctionController.cancelAuction)
);

/**
 * @route POST /api/auctions/:id/join
 * @desc 加入竞拍房间
 * @access Private
 */
router.post('/:id/join',
  authenticate,
  requirePermission('auction:read'),
  writeRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的竞拍ID').toInt(),
  asyncHandler(auctionController.joinAuctionRoom)
);

/**
 * @route POST /api/auctions/:id/leave
 * @desc 离开竞拍房间
 * @access Private
 */
router.post('/:id/leave',
  authenticate,
  writeRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的竞拍ID').toInt(),
  asyncHandler(auctionController.leaveAuctionRoom)
);

/**
 * @route GET /api/auctions/:id/leaderboard
 * @desc 获取竞拍排行榜
 * @access Public
 */
router.get('/:id/leaderboard',
  apiRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的竞拍ID').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('排行榜数量必须在1-50之间').toInt(),
  asyncHandler(auctionController.getLeaderboard)
);

/**
 * @route POST /api/auctions/:id/bid
 * @desc 出价（HTTP接口）
 * @access Private
 */
router.post('/:id/bid',
  authenticate,
  requirePermission('bid:write'),
  bidRateLimit,
  placeBidValidation,
  asyncHandler(auctionController.placeBid)
);

export default router;