import { Notification, NotificationType, NotificationPriority, INotification } from '../models/Notification';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';
import { getNotificationService } from './notification.service.factory';

export interface CreateNotificationData {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  link?: string;
  metadata?: Record<string, any>;
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: NotificationType;
  category?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  todayCount: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}

const TYPE_PRIORITY_MAP: Record<NotificationType, NotificationPriority> = {
  new_order: 'high',
  order_paid: 'high',
  refund_request: 'high',
  auction_ending_soon: 'medium',
  auction_ended: 'medium',
  auction_won: 'high',
  outbid: 'medium',
  stock_warning: 'medium',
  system_announcement: 'low',
  auction_cancelled: 'high',
};

const TYPE_LINK_MAP: Record<NotificationType, (metadata?: Record<string, any>) => string> = {
  new_order: (m) => `/merchant/orders?orderId=${m?.orderId || ''}`,
  order_paid: (m) => `/merchant/orders?orderId=${m?.orderId || ''}`,
  refund_request: (m) => `/merchant/orders?orderId=${m?.orderId || ''}`,
  auction_ending_soon: (m) => `/pages/discover/detail?id=${m?.auctionId || ''}`,
  auction_ended: (m) => `/pages/discover/detail?id=${m?.auctionId || ''}`,
  auction_won: (m) => `/pages/discover/detail?id=${m?.auctionId || ''}`,
  outbid: (m) => `/pages/discover/detail?id=${m?.auctionId || ''}`,
  stock_warning: (m) => `/merchant/products/${m?.productId || ''}`,
  system_announcement: () => '',
  auction_cancelled: (m) => `/pages/discover/detail?id=${m?.auctionId || ''}`,
};

const CATEGORY_TYPE_MAP: Record<string, NotificationType[]> = {
  won: ['auction_won'],
  outbid: ['outbid'],
  ended: ['auction_ended', 'auction_ending_soon'],
  system: ['system_announcement', 'new_order', 'order_paid', 'refund_request', 'stock_warning', 'auction_cancelled'],
};

export class NotificationCrudService {
  async createNotification(data: CreateNotificationData): Promise<INotification> {
    const priority = data.priority || TYPE_PRIORITY_MAP[data.type];
    const link = data.link || TYPE_LINK_MAP[data.type](data.metadata);

    const notification = await Notification.create({
      user_id: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      priority,
      link,
      metadata: data.metadata || null,
      is_read: false,
    });

    const wsService = getNotificationService();
    if (wsService) {
      wsService.sendToUser(data.userId, 'new_notification', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        link: notification.link,
        is_read: notification.is_read,
        created_at: notification.created_at,
      }).catch((err: any) => {
        logger.warn('Failed to push notification via WebSocket:', err.message);
      });
    }

    logger.info(`Notification created: type=${data.type}, userId=${data.userId}`);
    return notification;
  }

  async createNotificationForUsers(userIds: number[], data: Omit<CreateNotificationData, 'userId'>): Promise<void> {
    const promises = userIds.map(userId =>
      this.createNotification({ ...data, userId })
    );
    await Promise.all(promises);
  }

  async createNotificationForMerchants(merchantIds: number[], data: Omit<CreateNotificationData, 'userId'>): Promise<void> {
    const promises = merchantIds.map(merchantId =>
      this.createNotification({ ...data, userId: merchantId })
    );
    await Promise.all(promises);
  }

  async getNotifications(userId: number, query: NotificationQuery): Promise<{
    notifications: INotification[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const where: any = { user_id: userId };
    if (query.isRead !== undefined) {
      where.is_read = query.isRead;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.category && CATEGORY_TYPE_MAP[query.category]) {
      where.type = { [Op.in]: CATEGORY_TYPE_MAP[query.category] };
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return {
      notifications: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getUnreadCount(userId: number): Promise<number> {
    return Notification.count({
      where: { user_id: userId, is_read: false },
    });
  }

  async getStats(userId: number): Promise<NotificationStats> {
    const total = await Notification.count({ where: { user_id: userId } });
    const unread = await Notification.count({ where: { user_id: userId, is_read: false } });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Notification.count({
      where: {
        user_id: userId,
        created_at: { [Op.gte]: today },
      },
    });

    const typeCounts = await Notification.findAll({
      where: { user_id: userId, is_read: false },
      attributes: ['type', [Notification.sequelize!.fn('COUNT', '*'), 'count']],
      group: ['type'],
      raw: true,
    });

    const byType: Record<string, number> = {};
    for (const row of typeCounts as any[]) {
      byType[row.type] = parseInt(row.count);
    }

    const byCategory: Record<string, number> = {};
    for (const [category, types] of Object.entries(CATEGORY_TYPE_MAP)) {
      byCategory[category] = types.reduce((sum, t) => sum + (byType[t] || 0), 0);
    }

    return { total, unread, todayCount, byType, byCategory };
  }

  async markAsRead(notificationId: number, userId: number): Promise<INotification | null> {
    const notification = await Notification.findOne({
      where: { id: notificationId, user_id: userId },
    });
    if (!notification) return null;

    await notification.update({ is_read: true });
    return notification;
  }

  async markAllAsRead(userId: number): Promise<number> {
    const [affectedCount] = await Notification.update(
      { is_read: true },
      { where: { user_id: userId, is_read: false } }
    );
    return affectedCount;
  }

  async markAsReadByCategory(userId: number, category: string): Promise<number> {
    const types = CATEGORY_TYPE_MAP[category];
    if (!types) return 0;

    const [affectedCount] = await Notification.update(
      { is_read: true },
      { where: { user_id: userId, is_read: false, type: { [Op.in]: types } } }
    );
    return affectedCount;
  }

  async deleteNotification(notificationId: number, userId: number): Promise<boolean> {
    const deleted = await Notification.destroy({
      where: { id: notificationId, user_id: userId },
    });
    return deleted > 0;
  }

  async deleteAllRead(userId: number): Promise<number> {
    const deleted = await Notification.destroy({
      where: { user_id: userId, is_read: true },
    });
    return deleted;
  }

  async notifyAuctionWon(userId: number, auctionId: number, productName: string, finalPrice: number): Promise<void> {
    await this.createNotification({
      userId,
      type: 'auction_won',
      title: '恭喜中标！',
      message: `您已成功拍得「${productName}」，成交价 ¥${finalPrice.toFixed(2)}，请尽快完成支付`,
      priority: 'high',
      metadata: { auctionId, productName, finalPrice },
    });
  }

  async notifyOutbid(userId: number, auctionId: number, productName: string, newPrice: number): Promise<void> {
    await this.createNotification({
      userId,
      type: 'outbid',
      title: '出价被超越',
      message: `您在「${productName}」的出价已被超越，当前最高价 ¥${newPrice.toFixed(2)}`,
      priority: 'medium',
      metadata: { auctionId, productName, newPrice },
    });
  }

  async notifyAuctionEnded(userId: number, auctionId: number, productName: string, finalPrice: number): Promise<void> {
    await this.createNotification({
      userId,
      type: 'auction_ended',
      title: '竞拍结束',
      message: `「${productName}」竞拍已结束，成交价 ¥${finalPrice.toFixed(2)}`,
      priority: 'medium',
      metadata: { auctionId, productName, finalPrice },
    });
  }

  async notifyAuctionEndingSoon(userId: number, auctionId: number, productName: string, timeLeft: number): Promise<void> {
    await this.createNotification({
      userId,
      type: 'auction_ending_soon',
      title: '竞拍即将结束',
      message: `「${productName}」竞拍即将结束，剩余 ${timeLeft} 秒`,
      priority: 'medium',
      metadata: { auctionId, productName, timeLeft },
    });
  }

  async notifyNewOrder(merchantId: number, orderId: number, productName: string, buyerName: string, amount: number): Promise<void> {
    await this.createNotification({
      userId: merchantId,
      type: 'new_order',
      title: '新订单',
      message: `${buyerName} 购买了「${productName}」，金额 ¥${amount.toFixed(2)}`,
      metadata: { orderId, productName, buyerName, amount },
    });
  }

  async notifyOrderPaid(merchantId: number, orderId: number, productName: string, amount: number): Promise<void> {
    await this.createNotification({
      userId: merchantId,
      type: 'order_paid',
      title: '买家已付款',
      message: `「${productName}」订单已付款 ¥${amount.toFixed(2)}，请尽快发货`,
      metadata: { orderId, productName, amount },
    });
  }

  async notifyRefundRequest(merchantId: number, orderId: number, productName: string, reason: string): Promise<void> {
    await this.createNotification({
      userId: merchantId,
      type: 'refund_request',
      title: '退款申请',
      message: `「${productName}」买家申请退款：${reason}`,
      metadata: { orderId, productName, reason },
    });
  }

  async notifyStockWarning(merchantId: number, productId: number, productName: string, stock: number, warningLevel: number): Promise<void> {
    await this.createNotification({
      userId: merchantId,
      type: 'stock_warning',
      title: '库存预警',
      message: `「${productName}」库存仅剩 ${stock} 件（预警值: ${warningLevel}）`,
      priority: 'medium',
      metadata: { productId, productName, stock, warningLevel },
    });
  }

  async notifySystemAnnouncement(userIds: number[], title: string, message: string): Promise<void> {
    await this.createNotificationForUsers(userIds, {
      type: 'system_announcement',
      title,
      message,
      priority: 'low',
    });
  }

  async notifyAuctionCancelled(userId: number, auctionId: number, productName: string, reason: string): Promise<void> {
    await this.createNotification({
      userId,
      type: 'auction_cancelled',
      title: '竞拍已取消',
      message: `「${productName}」的竞拍已被商家取消，原因：${reason}`,
      priority: 'high',
      metadata: { auctionId, productName, reason },
    });
  }
}

export const notificationCrudService = new NotificationCrudService();
