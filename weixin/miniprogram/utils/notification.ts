/**
 * 消息通知工具类
 * 管理通知类型定义、格式化、图标颜色映射等
 */

export enum NotificationType {
  OUTBID = 'outbid',
  AUCTION_END = 'auction_end',
  AUCTION_WON = 'auction_won',
  SYSTEM_NOTICE = 'system_notice',
}

export enum NotificationCategory {
  ALL = 'all',
  UNREAD = 'unread',
  WON = 'won',
  OUTBID = 'outbid',
  ENDED = 'ended',
  SYSTEM = 'system',
}

export const NOTIFICATION_PRIORITY: Record<NotificationType, number> = {
  [NotificationType.AUCTION_WON]: 5,
  [NotificationType.OUTBID]: 4,
  [NotificationType.AUCTION_END]: 3,
  [NotificationType.SYSTEM_NOTICE]: 1,
}

export interface NotificationItem {
  id: number
  type: NotificationType
  backendType: string
  title: string
  message: string
  time: number
  timeText: string
  read: boolean
  priority: string
  link: string
  auctionId: string | number
  auctionTitle: string
  amount: number
}

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  [NotificationType.OUTBID]: '⚠️',
  [NotificationType.AUCTION_END]: '🏁',
  [NotificationType.AUCTION_WON]: '🏆',
  [NotificationType.SYSTEM_NOTICE]: '📢',
}

export const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  [NotificationType.OUTBID]: '#FF6B6B',
  [NotificationType.AUCTION_END]: '#4D96FF',
  [NotificationType.AUCTION_WON]: '#FFD700',
  [NotificationType.SYSTEM_NOTICE]: '#9B59B6',
}

export const NOTIFICATION_TYPE_NAMES: Record<NotificationType, string> = {
  [NotificationType.OUTBID]: '出价被超越',
  [NotificationType.AUCTION_END]: '竞拍结束',
  [NotificationType.AUCTION_WON]: '中标通知',
  [NotificationType.SYSTEM_NOTICE]: '系统通知',
}

export const BACKEND_TYPE_MAP: Record<string, NotificationType> = {
  outbid: NotificationType.OUTBID,
  auction_ending_soon: NotificationType.AUCTION_END,
  auction_ended: NotificationType.AUCTION_END,
  auction_won: NotificationType.AUCTION_WON,
  new_order: NotificationType.SYSTEM_NOTICE,
  order_paid: NotificationType.SYSTEM_NOTICE,
  refund_request: NotificationType.SYSTEM_NOTICE,
  stock_warning: NotificationType.SYSTEM_NOTICE,
  system_announcement: NotificationType.SYSTEM_NOTICE,
  auction_cancelled: NotificationType.SYSTEM_NOTICE,
}

export const CATEGORY_BACKEND_MAP: Record<string, string> = {
  [NotificationCategory.WON]: 'won',
  [NotificationCategory.OUTBID]: 'outbid',
  [NotificationCategory.ENDED]: 'ended',
  [NotificationCategory.SYSTEM]: 'system',
}

export const TYPE_TO_CATEGORY: Record<NotificationType, string> = {
  [NotificationType.AUCTION_WON]: 'won',
  [NotificationType.OUTBID]: 'outbid',
  [NotificationType.AUCTION_END]: 'ended',
  [NotificationType.SYSTEM_NOTICE]: 'system',
}

export function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatNotificationItem(item: any): NotificationItem {
  const localType = BACKEND_TYPE_MAP[item.type] || NotificationType.SYSTEM_NOTICE

  const timeValue = item.created_at || item.createdAt || item.time
  let timeText = ''
  if (timeValue) {
    const ts = new Date(timeValue).getTime()
    timeText = formatTime(ts)
  }

  const metadata = item.metadata || {}

  return {
    id: item.id,
    type: localType,
    backendType: item.type,
    title: item.title || '',
    message: item.message || '',
    time: timeValue ? new Date(timeValue).getTime() : Date.now(),
    timeText,
    read: item.is_read !== undefined ? item.is_read : (item.read || false),
    priority: item.priority || 'medium',
    link: item.link || '',
    auctionId: metadata.auctionId || item.auction_id || '',
    auctionTitle: metadata.productName || metadata.auctionTitle || '',
    amount: metadata.newPrice || metadata.finalPrice || metadata.amount || 0,
  }
}
