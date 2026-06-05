import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { shippingTemplateController } from '../controllers/shipping-template.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { csrfProtection, distributedRateLimit } from '../middleware/security.middleware';
import { requirePermission } from '../utils/permission';
import { securityConfig } from '../config/security.config';

const router = Router();

const createTemplateValidation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('模板名称长度必须在1-100个字符之间')
    .trim()
    .escape(),
  body('rules')
    .isArray({ min: 1 })
    .withMessage('运费模板至少需要一条配送规则'),
  body('rules.*.regions')
    .isArray({ min: 1 })
    .withMessage('每条规则至少需要一个配送区域'),
  body('rules.*.regions.*')
    .isLength({ min: 1, max: 50 })
    .withMessage('区域名称长度必须在1-50个字符之间')
    .trim(),
  body('rules.*.first_item_fee')
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('首件费用必须在0-999999.99之间')
    .toFloat(),
  body('rules.*.additional_item_fee')
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('续件费用必须在0-999999.99之间')
    .toFloat(),
  body('rules.*.free_threshold')
    .optional()
    .isFloat({ min: 0, max: 99999999.99 })
    .withMessage('免运费门槛必须在0-99999999.99之间')
    .toFloat(),
];

const updateTemplateValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('无效的模板ID')
    .toInt(),
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('模板名称长度必须在1-100个字符之间')
    .trim()
    .escape(),
  body('rules')
    .optional()
    .isArray({ min: 1 })
    .withMessage('运费模板至少需要一条配送规则'),
  body('rules.*.regions')
    .optional()
    .isArray({ min: 1 })
    .withMessage('每条规则至少需要一个配送区域'),
  body('rules.*.regions.*')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('区域名称长度必须在1-50个字符之间')
    .trim(),
  body('rules.*.first_item_fee')
    .optional()
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('首件费用必须在0-999999.99之间')
    .toFloat(),
  body('rules.*.additional_item_fee')
    .optional()
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('续件费用必须在0-999999.99之间')
    .toFloat(),
  body('rules.*.free_threshold')
    .optional()
    .isFloat({ min: 0, max: 99999999.99 })
    .withMessage('免运费门槛必须在0-99999999.99之间')
    .toFloat(),
];

const queryValidation = [
  query('search')
    .optional()
    .isLength({ max: 100 })
    .withMessage('搜索关键词不能超过100个字符')
    .trim()
    .escape(),
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

const calculateFeeValidation = [
  body('template_id')
    .isInt({ min: 1 })
    .withMessage('无效的运费模板ID')
    .toInt(),
  body('region')
    .isLength({ min: 1, max: 50 })
    .withMessage('地区名称长度必须在1-50个字符之间')
    .trim()
    .escape(),
  body('quantity')
    .isInt({ min: 1, max: 99999 })
    .withMessage('商品数量必须在1-99999之间')
    .toInt(),
  body('total_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('商品总金额必须大于等于0')
    .toFloat(),
  body('weight')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('商品重量必须大于等于0')
    .toFloat(),
];

const apiRateLimit = distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.api.windowMs,
  max: securityConfig.apiSecurity.rateLimit.api.max,
  keyGenerator: (req) => `rate:api:shipping:${req.ip}`,
  message: 'API请求过于频繁，请稍后再试',
});

const writeRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `rate:write:shipping:${req.ip}`,
  message: '写操作过于频繁，请稍后再试',
});

router.post('/',
  authenticate,
  authorize('merchant'),
  requirePermission('product:write'),
  csrfProtection,
  writeRateLimit,
  createTemplateValidation,
  asyncHandler(shippingTemplateController.createTemplate)
);

router.get('/',
  authenticate,
  authorize('merchant'),
  requirePermission('product:read'),
  apiRateLimit,
  queryValidation,
  asyncHandler(shippingTemplateController.getTemplates)
);

router.get('/:id',
  authenticate,
  authorize('merchant'),
  requirePermission('product:read'),
  apiRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的模板ID').toInt(),
  asyncHandler(shippingTemplateController.getTemplateById)
);

router.put('/:id',
  authenticate,
  authorize('merchant'),
  requirePermission('product:write'),
  csrfProtection,
  writeRateLimit,
  updateTemplateValidation,
  asyncHandler(shippingTemplateController.updateTemplate)
);

router.delete('/:id',
  authenticate,
  authorize('merchant'),
  requirePermission('product:delete'),
  csrfProtection,
  writeRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的模板ID').toInt(),
  asyncHandler(shippingTemplateController.deleteTemplate)
);

router.post('/calculate',
  apiRateLimit,
  calculateFeeValidation,
  asyncHandler(shippingTemplateController.calculateShippingFee)
);

export default router;
