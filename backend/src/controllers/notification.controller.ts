import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { notificationCrudService } from '../services/notification-crud.service';
import { AuthenticationError, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { successResponse, noDataResponse } from '../utils/response';

export const notificationController = {
  async getNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const result = await notificationCrudService.getNotifications(req.user.userId, {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
        type: req.query.type as any,
        category: req.query.category as string,
      });

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const unreadCount = await notificationCrudService.getUnreadCount(req.user.userId);

      res.json({ success: true, data: { unreadCount } });
    } catch (error) {
      next(error);
    }
  },

  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const stats = await notificationCrudService.getStats(req.user.userId);

      successResponse(res, stats);
    } catch (error) {
      next(error);
    }
  },

  async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const notificationId = parseInt(req.params.id);
      if (isNaN(notificationId)) throw new ValidationError('无效的通知ID');

      const notification = await notificationCrudService.markAsRead(notificationId, req.user.userId);
      if (!notification) throw new ValidationError('通知不存在');

      successResponse(res, notification, '已标记为已读');
    } catch (error) {
      next(error);
    }
  },

  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const count = await notificationCrudService.markAllAsRead(req.user.userId);

      successResponse(res, { affectedCount: count }, `已将 ${count} 条通知标记为已读`);
    } catch (error) {
      next(error);
    }
  },

  async markAsReadByCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const category = req.params.category as string;
      const validCategories = ['won', 'outbid', 'ended', 'system'];
      if (!validCategories.includes(category)) throw new ValidationError('无效的通知分类');

      const count = await notificationCrudService.markAsReadByCategory(req.user.userId, category);

      successResponse(res, { affectedCount: count }, `已将 ${count} 条通知标记为已读`);
    } catch (error) {
      next(error);
    }
  },

  async deleteNotification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const notificationId = parseInt(req.params.id);
      if (isNaN(notificationId)) throw new ValidationError('无效的通知ID');

      const deleted = await notificationCrudService.deleteNotification(notificationId, req.user.userId);
      if (!deleted) throw new ValidationError('通知不存在');

      noDataResponse(res, '通知已删除');
    } catch (error) {
      next(error);
    }
  },

  async deleteAllRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const count = await notificationCrudService.deleteAllRead(req.user.userId);

      successResponse(res, { deletedCount: count }, `已删除 ${count} 条已读通知`);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 创建测试通知（开发调试用）
   * POST /api/notifications/test
   */
  async createTestNotification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const { type } = req.body;
      const validTypes = ['outbid', 'auction_won', 'auction_ended', 'auction_cancelled'];
      const notificationType = validTypes.includes(type) ? type : 'outbid';

      const testNotifications: Record<string, { title: string; message: string; metadata: Record<string, any> }> = {
        outbid: {
          title: '出价被超越',
          message: '您在「测试商品 - 精美手表」的出价已被超越，当前最高价 ¥258.00',
          metadata: { auctionId: 1001, productName: '测试商品 - 精美手表', newPrice: 258 },
        },
        auction_won: {
          title: '恭喜中标！',
          message: '您已成功拍得「测试商品 - 精美手表」，成交价 ¥258.00，请尽快完成支付',
          metadata: { auctionId: 1001, productName: '测试商品 - 精美手表', finalPrice: 258 },
        },
        auction_ended: {
          title: '竞拍结束',
          message: '「测试商品 - 精美手表」竞拍已结束，成交价 ¥258.00',
          metadata: { auctionId: 1001, productName: '测试商品 - 精美手表', finalPrice: 258 },
        },
        auction_cancelled: {
          title: '竞拍已取消',
          message: '「测试商品 - 精美手表」的竞拍已被商家取消，原因：商品信息有误',
          metadata: { auctionId: 1001, productName: '测试商品 - 精美手表', reason: '商品信息有误' },
        },
      };

      const testData = testNotifications[notificationType];
      await notificationCrudService.createNotification({
        userId: req.user.userId,
        type: notificationType as any,
        title: testData.title,
        message: testData.message,
        metadata: testData.metadata,
      });

      logger.info(`Test notification created: type=${notificationType}, userId=${req.user.userId}`);
      successResponse(res, null, `测试通知已创建: ${notificationType}`);
    } catch (error) {
      next(error);
    }
  },
};

export default notificationController;
