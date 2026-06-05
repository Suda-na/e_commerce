import { request } from '../utils/request'

class NotificationApiService {
  async getUnreadCount(): Promise<number> {
    const res = await request.get('/notifications/unread-count')
    const data = res.data
    // 兼容多种后端响应格式
    if (typeof data === 'number') return data
    if (typeof data === 'object' && data !== null) {
      return data.unreadCount ?? data.unread ?? data.count ?? 0
    }
    return 0
  }

  async getNotifications(params?: {
    page?: number
    limit?: number
    isRead?: boolean
    type?: string
    category?: string
  }): Promise<any> {
    const res = await request.get('/notifications', params)
    return res.data
  }

  async markAsRead(id: number): Promise<any> {
    const res = await request.put(`/notifications/${id}/read`)
    return res.data
  }

  async markAllAsRead(): Promise<any> {
    const res = await request.put('/notifications/read-all')
    return res.data
  }

  async markAsReadByCategory(category: string): Promise<any> {
    const res = await request.put(`/notifications/read-category/${category}`)
    return res.data
  }

  async deleteNotification(id: number): Promise<any> {
    const res = await request.delete(`/notifications/${id}`)
    return res.data
  }

  async deleteAllRead(): Promise<any> {
    const res = await request.delete('/notifications/read')
    return res.data
  }

  async getStats(): Promise<any> {
    const res = await request.get('/notifications/stats')
    return res.data
  }

}

export const notificationApiService = new NotificationApiService()
export default notificationApiService
