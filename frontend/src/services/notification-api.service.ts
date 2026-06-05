import api from './api';

export type NotificationType =
  | 'new_order'
  | 'order_paid'
  | 'refund_request'
  | 'auction_ending_soon'
  | 'auction_ended'
  | 'auction_won'
  | 'outbid'
  | 'stock_warning'
  | 'system_announcement';

export type NotificationPriority = 'high' | 'medium' | 'low';

export interface NotificationItem {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  link: string | null;
  isRead: boolean;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

class NotificationApiService {
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    isRead?: boolean;
    type?: NotificationType;
  }): Promise<NotificationListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.isRead !== undefined) searchParams.append('isRead', String(params.isRead));
    if (params?.type) searchParams.append('type', params.type);

    const response = await api.get(`/notifications?${searchParams.toString()}`);
    const data = response.data.data;
    return {
      notifications: (data.notifications || []).map((n: any) => this.toCamelCase(n)),
      total: data.total,
      page: data.page,
      limit: data.limit,
      totalPages: data.totalPages,
    };
  }

  async getUnreadCount(): Promise<number> {
    const response = await api.get('/notifications/unread-count');
    return response.data.data.unreadCount;
  }

  async getStats(): Promise<NotificationStats> {
    const response = await api.get('/notifications/stats');
    return response.data.data;
  }

  async markAsRead(id: number): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  }

  async markAllAsRead(): Promise<number> {
    const response = await api.put('/notifications/read-all');
    return response.data.data.affectedCount;
  }

  async deleteNotification(id: number): Promise<void> {
    await api.delete(`/notifications/${id}`);
  }

  async deleteAllRead(): Promise<number> {
    const response = await api.delete('/notifications/read');
    return response.data.data.deletedCount;
  }

  private toCamelCase(n: any): NotificationItem {
    return {
      id: n.id,
      userId: n.user_id,
      type: n.type,
      title: n.title,
      message: n.message,
      priority: n.priority,
      link: n.link,
      isRead: n.is_read,
      metadata: n.metadata,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    };
  }
}

export const notificationApiService = new NotificationApiService();
