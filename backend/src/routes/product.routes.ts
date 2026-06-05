import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { productController } from '../controllers/product.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { csrfProtection, distributedRateLimit } from '../middleware/security.middleware';
import { productViewMiddleware } from '../middleware/page-view.middleware';
import { requirePermission, requireOwnership } from '../utils/permission';
import { securityConfig } from '../config/security.config';

const router = Router();

// 验证规则
const createProductValidation = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('商品名称长度必须在2-100个字符之间')
    .trim()
    .escape(),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('商品描述不能超过2000个字符')
    .trim()
    .escape(),
  body('images')
    .optional()
    .isArray()
    .withMessage('商品图片必须是数组')
    .custom((value) => {
      if (value && value.length > 10) {
        throw new Error('商品图片不能超过10张');
      }
      return true;
    }),
  body('images.*')
    .optional()
    .isURL({ require_tld: false, protocols: ['http', 'https'] })
    .withMessage('商品图片必须是有效的URL'),
  body('starting_price')
    .isFloat({ min: 0.01, max: 99999999.99 })
    .withMessage('起拍价必须在0.01-99999999.99之间')
    .toFloat(),
  body('price_increment')
    .isFloat({ min: 0.01, max: 999999.99 })
    .withMessage('加价幅度必须在0.01-999999.99之间')
    .toFloat(),
  body('duration')
    .isInt({ min: 1, max: 1440 })
    .withMessage('竞拍时长必须在1-1440分钟之间')
    .toInt(),
  body('cap_price')
    .optional()
    .isFloat({ min: 0.01, max: 99999999.99 })
    .withMessage('封顶价必须在0.01-99999999.99之间')
    .toFloat(),
  body('delay_time')
    .optional()
    .isInt({ min: 10, max: 30 })
    .withMessage('延时时长必须在10-30秒之间')
    .toInt(),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('分类ID必须是正整数')
    .toInt(),
  body('tags')
    .optional()
    .isArray()
    .withMessage('标签必须是数组'),
  body('tags.*')
    .optional()
    .isLength({ min: 1, max: 20 })
    .withMessage('每个标签长度必须在1-20个字符之间')
    .trim(),
  body('stock')
    .optional()
    .isInt({ min: 0, max: 9999999 })
    .withMessage('库存数量必须在0-9999999之间')
    .toInt(),
  body('stock_warning')
    .optional()
    .isInt({ min: 0, max: 9999999 })
    .withMessage('库存预警阈值必须在0-9999999之间')
    .toInt(),
  body('sku')
    .optional()
    .isLength({ max: 50 })
    .withMessage('SKU编码不能超过50个字符')
    .trim()
    .escape(),
  body('weight')
    .optional()
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('重量必须在0-999999.99之间')
    .toFloat(),
  body('shipping_template_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('运费模板ID必须是正整数')
    .toInt(),
  body('specifications')
    .optional()
    .isObject()
    .withMessage('规格参数必须是对象'),
];

const updateProductValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('无效的商品ID')
    .toInt(),
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('商品名称长度必须在2-100个字符之间')
    .trim()
    .escape(),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('商品描述不能超过2000个字符')
    .trim()
    .escape(),
  body('images')
    .optional()
    .isArray()
    .withMessage('商品图片必须是数组')
    .custom((value) => {
      if (value && value.length > 10) {
        throw new Error('商品图片不能超过10张');
      }
      return true;
    }),
  body('images.*')
    .optional()
    .isURL({ require_tld: false, protocols: ['http', 'https'] })
    .withMessage('商品图片必须是有效的URL'),
  body('starting_price')
    .optional()
    .isFloat({ min: 0.01, max: 99999999.99 })
    .withMessage('起拍价必须在0.01-99999999.99之间')
    .toFloat(),
  body('price_increment')
    .optional()
    .isFloat({ min: 0.01, max: 999999.99 })
    .withMessage('加价幅度必须在0.01-999999.99之间')
    .toFloat(),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('竞拍时长必须在1-1440分钟之间')
    .toInt(),
  body('cap_price')
    .optional()
    .isFloat({ min: 0.01, max: 99999999.99 })
    .withMessage('封顶价必须在0.01-99999999.99之间')
    .toFloat(),
  body('delay_time')
    .optional()
    .isInt({ min: 10, max: 30 })
    .withMessage('延时时长必须在10-30秒之间')
    .toInt(),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('分类ID必须是正整数')
    .toInt(),
  body('tags')
    .optional()
    .isArray()
    .withMessage('标签必须是数组'),
  body('tags.*')
    .optional()
    .isLength({ min: 1, max: 20 })
    .withMessage('每个标签长度必须在1-20个字符之间')
    .trim(),
  body('stock')
    .optional()
    .isInt({ min: 0, max: 9999999 })
    .withMessage('库存数量必须在0-9999999之间')
    .toInt(),
  body('stock_warning')
    .optional()
    .isInt({ min: 0, max: 9999999 })
    .withMessage('库存预警阈值必须在0-9999999之间')
    .toInt(),
  body('sku')
    .optional()
    .isLength({ max: 50 })
    .withMessage('SKU编码不能超过50个字符')
    .trim()
    .escape(),
  body('weight')
    .optional()
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('重量必须在0-999999.99之间')
    .toFloat(),
  body('shipping_template_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('运费模板ID必须是正整数')
    .toInt(),
  body('specifications')
    .optional()
    .isObject()
    .withMessage('规格参数必须是对象'),
];

const updateStatusValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('无效的商品ID')
    .toInt(),
  body('status')
    .isIn(['pending', 'active', 'completed', 'cancelled'])
    .withMessage('无效的商品状态'),
];

const queryValidation = [
  query('search')
    .optional()
    .isLength({ max: 100 })
    .withMessage('搜索关键词不能超过100个字符')
    .trim()
    .escape(),
  query('status')
    .optional()
    .isIn(['pending', 'active', 'completed', 'cancelled'])
    .withMessage('无效的商品状态'),
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
    .isIn(['created_at', 'starting_price', 'name'])
    .withMessage('无效的排序字段'),
  query('order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('排序方向必须是ASC或DESC'),
  query('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('分类ID必须是正整数')
    .toInt(),
  query('tag')
    .optional()
    .isLength({ max: 50 })
    .withMessage('标签不能超过50个字符')
    .trim()
    .escape(),
];

// API限流（每分钟最多60次）
const apiRateLimit = distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.api.windowMs,
  max: securityConfig.apiSecurity.rateLimit.api.max,
  keyGenerator: (req) => `rate:api:products:${req.ip}`,
  message: 'API请求过于频繁，请稍后再试',
});

// 写操作限流（每分钟最多20次）
const writeRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `rate:write:products:${req.ip}`,
  message: '写操作过于频繁，请稍后再试',
});

// 路由定义

/**
 * @route POST /api/products
 * @desc 创建商品
 * @access Private (Merchant only, 需CSRF验证)
 */
router.post('/',
  authenticate,
  authorize('merchant'),
  requirePermission('product:write'),
  csrfProtection,
  writeRateLimit,
  createProductValidation,
  asyncHandler(productController.createProduct)
);

/**
 * @route GET /api/products
 * @desc 获取商品列表
 * @access Public
 */
router.get('/',
  apiRateLimit,
  queryValidation,
  asyncHandler(productController.getProducts)
);

/**
 * @route GET /api/products/merchant
 * @desc 获取商家的商品列表
 * @access Private (Merchant only)
 */
router.get('/merchant',
  authenticate,
  authorize('merchant'),
  requirePermission('product:read'),
  apiRateLimit,
  queryValidation,
  asyncHandler(productController.getMerchantProducts)
);

/**
 * @route GET /api/products/:id
 * @desc 获取商品详情
 * @access Public
 */
router.get('/:id',
  apiRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的商品ID').toInt(),
  productViewMiddleware,
  asyncHandler(productController.getProductById)
);

/**
 * @route PUT /api/products/:id
 * @desc 更新商品
 * @access Private (Merchant only, 需CSRF验证)
 */
router.put('/:id',
  authenticate,
  authorize('merchant'),
  requirePermission('product:write'),
  csrfProtection,
  writeRateLimit,
  updateProductValidation,
  asyncHandler(productController.updateProduct)
);

/**
 * @route DELETE /api/products/:id
 * @desc 删除商品
 * @access Private (Merchant only, 需CSRF验证)
 */
router.delete('/:id',
  authenticate,
  authorize('merchant'),
  requirePermission('product:delete'),
  csrfProtection,
  writeRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的商品ID').toInt(),
  asyncHandler(productController.deleteProduct)
);

/**
 * @route PATCH /api/products/:id/status
 * @desc 更新商品状态
 * @access Private (Merchant only, 需CSRF验证)
 */
router.patch('/:id/status',
  authenticate,
  authorize('merchant'),
  requirePermission('product:write'),
  csrfProtection,
  writeRateLimit,
  updateStatusValidation,
  asyncHandler(productController.updateProductStatus)
);

export default router;