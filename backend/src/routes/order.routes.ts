import { Router } from 'express';
import { query, param, body } from 'express-validator';
import { orderController } from '../controllers/order.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { csrfProtection, distributedRateLimit } from '../middleware/security.middleware';
import { requirePermission } from '../utils/permission';
import { securityConfig } from '../config/security.config';

const router = Router();

const orderQueryValidation = [
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
  query('status')
    .optional()
    .isIn(['pending', 'paid', 'shipped', 'refunding', 'refunded', 'cancelled'])
    .withMessage('无效的订单状态'),
  query('auctionId')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('竞拍ID长度必须在1-100个字符之间')
    .trim(),
];

const orderIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('无效的订单ID')
    .toInt(),
];

const shipOrderValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('无效的订单ID')
    .toInt(),
  body('tracking_number')
    .isLength({ min: 1, max: 100 })
    .withMessage('快递单号长度必须在1-100个字符之间')
    .trim(),
  body('shipping_company')
    .isLength({ min: 1, max: 100 })
    .withMessage('物流公司名称长度必须在1-100个字符之间')
    .trim(),
  body('remark')
    .optional()
    .isLength({ max: 500 })
    .withMessage('备注不能超过500个字符')
    .trim(),
];

const refundActionValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('无效的订单ID')
    .toInt(),
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('退款操作必须是approve或reject'),
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('原因不能超过500个字符')
    .trim(),
];

const updateRemarkValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('无效的订单ID')
    .toInt(),
  body('remark')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('备注不能超过1000个字符')
    .trim(),
  body('merchant_remark')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('商家备注不能超过1000个字符')
    .trim(),
];

const updateAddressValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('无效的订单ID')
    .toInt(),
  body('shipping_address')
    .isLength({ min: 1, max: 500 })
    .withMessage('收货地址长度必须在1-500个字符之间')
    .trim(),
];

// API限流
const apiRateLimit = distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.api.windowMs,
  max: securityConfig.apiSecurity.rateLimit.api.max,
  keyGenerator: (req) => `rate:api:orders:${req.ip}`,
  message: 'API请求过于频繁，请稍后再试',
});

// 写操作限流
const writeRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `rate:write:orders:${req.ip}`,
  message: '写操作过于频繁，请稍后再试',
});

// 路由定义

/**
 * @route GET /api/orders
 * @desc 获取订单列表（用户/商家）
 * @access Private (需要认证)
 */
router.get('/',
  authenticate,
  requirePermission('order:read'),
  apiRateLimit,
  orderQueryValidation,
  asyncHandler(orderController.getOrders)
);

/**
 * @route GET /api/orders/user
 * @desc 获取当前用户的订单列表
 * @access Private (需要认证)
 */
router.get('/user',
  authenticate,
  requirePermission('order:read'),
  apiRateLimit,
  orderQueryValidation,
  asyncHandler(orderController.getUserOrders)
);

/**
 * @route GET /api/orders/merchant
 * @desc 获取商家的订单列表
 * @access Private (需要认证，商家权限)
 */
router.get('/merchant',
  authenticate,
  authorize('merchant'),
  requirePermission('order:read'),
  apiRateLimit,
  orderQueryValidation,
  asyncHandler(orderController.getMerchantOrders)
);

/**
 * @route GET /api/orders/stats
 * @desc 获取订单统计
 * @access Private (需要认证)
 */
router.get('/stats',
  authenticate,
  requirePermission('order:read'),
  apiRateLimit,
  asyncHandler(orderController.getOrderStats)
);

/**
 * @route GET /api/orders/:id
 * @desc 获取订单详情
 * @access Private (需要认证)
 */
router.get('/:id',
  authenticate,
  requirePermission('order:read'),
  apiRateLimit,
  orderIdValidation,
  asyncHandler(orderController.getOrderById)
);

/**
 * @route POST /api/orders/:id/pay
 * @desc 模拟支付订单
 * @access Private (需要认证, 需CSRF验证)
 */
router.post('/:id/pay',
  authenticate,
  requirePermission('order:write'),
  csrfProtection,
  writeRateLimit,
  orderIdValidation,
  body('shipping_address')
    .optional()
    .isLength({ max: 500 })
    .withMessage('收货地址不能超过500个字符')
    .trim(),
  asyncHandler(orderController.payOrder)
);

/**
 * @route POST /api/orders/:id/cancel
 * @desc 取消订单
 * @access Private (需要认证, 需CSRF验证)
 */
router.post('/:id/cancel',
  authenticate,
  requirePermission('order:write'),
  csrfProtection,
  writeRateLimit,
  orderIdValidation,
  asyncHandler(orderController.cancelOrder)
);

router.post('/:id/ship',
  authenticate,
  authorize('merchant'),
  requirePermission('order:write'),
  csrfProtection,
  writeRateLimit,
  shipOrderValidation,
  asyncHandler(orderController.shipOrder)
);

router.post('/:id/refund',
  authenticate,
  authorize('merchant'),
  requirePermission('order:write'),
  csrfProtection,
  writeRateLimit,
  refundActionValidation,
  asyncHandler(orderController.handleRefund)
);

router.put('/:id/remark',
  authenticate,
  authorize('merchant'),
  requirePermission('order:write'),
  csrfProtection,
  writeRateLimit,
  updateRemarkValidation,
  asyncHandler(orderController.updateRemark)
);

router.put('/:id/address',
  authenticate,
  authorize('merchant'),
  requirePermission('order:write'),
  csrfProtection,
  writeRateLimit,
  updateAddressValidation,
  asyncHandler(orderController.updateAddress)
);

export default router;