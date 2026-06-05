import { Router } from 'express';
import { body, param } from 'express-validator';
import { categoryController } from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { csrfProtection, distributedRateLimit } from '../middleware/security.middleware';
import { securityConfig } from '../config/security.config';

const router = Router();

const createCategoryValidation = [
  body('name')
    .isLength({ min: 1, max: 50 })
    .withMessage('分类名称长度必须在1-50个字符之间')
    .trim()
    .escape(),
  body('icon')
    .optional()
    .isLength({ max: 255 })
    .withMessage('图标标识不能超过255个字符')
    .trim(),
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('排序值必须为非负整数')
    .toInt(),
];

const updateCategoryValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('无效的分类ID')
    .toInt(),
  body('name')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('分类名称长度必须在1-50个字符之间')
    .trim()
    .escape(),
  body('icon')
    .optional()
    .isLength({ max: 255 })
    .withMessage('图标标识不能超过255个字符')
    .trim(),
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('排序值必须为非负整数')
    .toInt(),
];

const apiRateLimit = distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.api.windowMs,
  max: securityConfig.apiSecurity.rateLimit.api.max,
  keyGenerator: (req) => `rate:api:categories:${req.ip}`,
  message: 'API请求过于频繁，请稍后再试',
});

const writeRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `rate:write:categories:${req.ip}`,
  message: '写操作过于频繁，请稍后再试',
});

router.post('/',
  authenticate,
  authorize('merchant'),
  csrfProtection,
  writeRateLimit,
  createCategoryValidation,
  asyncHandler(categoryController.createCategory)
);

router.get('/',
  authenticate,
  authorize('merchant'),
  apiRateLimit,
  asyncHandler(categoryController.getCategories)
);

router.get('/:id',
  authenticate,
  authorize('merchant'),
  apiRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的分类ID').toInt(),
  asyncHandler(categoryController.getCategoryById)
);

router.put('/:id',
  authenticate,
  authorize('merchant'),
  csrfProtection,
  writeRateLimit,
  updateCategoryValidation,
  asyncHandler(categoryController.updateCategory)
);

router.delete('/:id',
  authenticate,
  authorize('merchant'),
  csrfProtection,
  writeRateLimit,
  param('id').isInt({ min: 1 }).withMessage('无效的分类ID').toInt(),
  asyncHandler(categoryController.deleteCategory)
);

export default router;
