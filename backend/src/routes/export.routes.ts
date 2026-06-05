import { Router } from 'express';
import { query } from 'express-validator';
import { exportController } from '../controllers/export.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { distributedRateLimit } from '../middleware/security.middleware';
import { securityConfig } from '../config/security.config';

const router = Router();

const exportRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `rate:export:${req.ip}`,
  message: '导出请求过于频繁，请稍后再试',
});

const exportValidation = [
  query('type')
    .isIn(['products', 'orders', 'buyers', 'bids'])
    .withMessage('导出类型必须是 products, orders, buyers, bids 之一'),
  query('format')
    .optional()
    .isIn(['csv', 'excel'])
    .withMessage('导出格式必须是 csv 或 excel'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('开始日期格式无效')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('结束日期格式无效')
    .toDate(),
  query('status')
    .optional()
    .isLength({ max: 20 })
    .withMessage('状态参数过长')
    .trim(),
  query('search')
    .optional()
    .isLength({ max: 100 })
    .withMessage('搜索关键词过长')
    .trim(),
  query('categoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('分类ID无效')
    .toInt(),
];

router.get(
  '/',
  authenticate,
  authorize('merchant'),
  exportRateLimit,
  exportValidation,
  asyncHandler(exportController.exportData)
);

export default router;
