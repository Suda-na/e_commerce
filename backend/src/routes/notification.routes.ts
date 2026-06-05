import { Router } from 'express';
import { query, param } from 'express-validator';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { distributedRateLimit } from '../middleware/security.middleware';

const router = Router();

const notificationRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => `rate:notifications:${req.ip}`,
  message: '请求过于频繁，请稍后再试',
});

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量1-50').toInt(),
  query('isRead').optional().isIn(['true', 'false']).withMessage('isRead必须是true或false'),
  query('type').optional().isIn([
    'new_order', 'order_paid', 'refund_request', 'auction_ending_soon',
    'auction_ended', 'auction_won', 'outbid', 'stock_warning', 'system_announcement',
    'auction_cancelled',
  ]).withMessage('无效的通知类型'),
  query('category').optional().isIn(['won', 'outbid', 'ended', 'system']).withMessage('无效的通知分类'),
];

const idValidation = [
  param('id').isInt({ min: 1 }).withMessage('无效的通知ID').toInt(),
];

const categoryValidation = [
  param('category').isIn(['won', 'outbid', 'ended', 'system']).withMessage('无效的通知分类'),
];

router.get(
  '/',
  authenticate,
  notificationRateLimit,
  listValidation,
  asyncHandler(notificationController.getNotifications)
);

router.get(
  '/unread-count',
  authenticate,
  notificationRateLimit,
  asyncHandler(notificationController.getUnreadCount)
);

router.get(
  '/stats',
  authenticate,
  notificationRateLimit,
  asyncHandler(notificationController.getStats)
);

router.put(
  '/read-all',
  authenticate,
  notificationRateLimit,
  asyncHandler(notificationController.markAllAsRead)
);

router.put(
  '/read-category/:category',
  authenticate,
  notificationRateLimit,
  categoryValidation,
  asyncHandler(notificationController.markAsReadByCategory)
);

router.delete(
  '/read',
  authenticate,
  notificationRateLimit,
  asyncHandler(notificationController.deleteAllRead)
);

router.put(
  '/:id/read',
  authenticate,
  notificationRateLimit,
  idValidation,
  asyncHandler(notificationController.markAsRead)
);

router.delete(
  '/:id',
  authenticate,
  notificationRateLimit,
  idValidation,
  asyncHandler(notificationController.deleteNotification)
);

/**
 * POST /api/notifications/test
 * 创建测试通知（开发调试用）
 * Body: { type: 'outbid' | 'auction_won' | 'auction_ended' | 'auction_cancelled' }
 */
router.post(
  '/test',
  authenticate,
  notificationRateLimit,
  asyncHandler(notificationController.createTestNotification)
);

export default router;
