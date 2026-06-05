import React, { useCallback, useMemo } from 'react';
import { Badge, Dropdown, List, Space, Typography, Button, Empty, Tag, Tabs } from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  ClearOutlined,
  DeleteOutlined,
  ShoppingOutlined,
  DollarOutlined,
  RollbackOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  WarningOutlined,
  NotificationOutlined,
  StockOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllReadNotifications,
} from '../../store/slices/notificationSlice';
import { NotificationItem } from '../../services/notification-api.service';

const { Text } = Typography;

const TYPE_CONFIG: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  new_order: { color: 'red', text: '新订单', icon: <ShoppingOutlined /> },
  order_paid: { color: 'green', text: '已付款', icon: <DollarOutlined /> },
  refund_request: { color: 'orange', text: '退款', icon: <RollbackOutlined /> },
  auction_ending_soon: { color: 'gold', text: '即将结束', icon: <ThunderboltOutlined /> },
  auction_ended: { color: 'default', text: '竞拍结束', icon: <ThunderboltOutlined /> },
  auction_won: { color: 'success', text: '竞拍成功', icon: <TrophyOutlined /> },
  outbid: { color: 'warning', text: '被超越', icon: <WarningOutlined /> },
  stock_warning: { color: 'orange', text: '库存预警', icon: <StockOutlined /> },
  system_announcement: { color: 'blue', text: '系统', icon: <NotificationOutlined /> },
};

interface NotificationBellProps {
  onNavigate?: (link: string) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { notifications, unreadCount } = useAppSelector((state) => state.notifications);

  const handleMarkAsRead = useCallback(async (id: number) => {
    dispatch(markNotificationAsRead(id));
  }, [dispatch]);

  const handleMarkAllAsRead = useCallback(async () => {
    dispatch(markAllNotificationsAsRead());
  }, [dispatch]);

  const handleDelete = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(deleteNotification(id));
  }, [dispatch]);

  const handleDeleteAllRead = useCallback(async () => {
    dispatch(deleteAllReadNotifications());
  }, [dispatch]);

  const handleItemClick = useCallback((item: NotificationItem) => {
    if (!item.isRead) {
      handleMarkAsRead(item.id);
    }
    if (item.link) {
      // 兼容旧格式 /merchant/orders/123 → /merchant/orders?orderId=123
      const oldOrderLinkMatch = item.link.match(/^\/merchant\/orders\/(\d+)$/);
      const targetLink = oldOrderLinkMatch
        ? `/merchant/orders?orderId=${oldOrderLinkMatch[1]}`
        : item.link;
      navigate(targetLink);
      onNavigate?.(targetLink);
    }
  }, [handleMarkAsRead, navigate, onNavigate]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      dispatch(fetchNotifications({ page: 1, limit: 20 }));
    }
  }, [dispatch]);

  const unreadNotifications = useMemo(
    () => notifications.filter(n => !n.isRead),
    [notifications]
  );

  const readNotifications = useMemo(
    () => notifications.filter(n => n.isRead),
    [notifications]
  );

  const renderNotificationItem = (item: NotificationItem) => {
    const config = TYPE_CONFIG[item.type] || { color: 'default', text: '通知', icon: <BellOutlined /> };

    return (
      <List.Item
        style={{
          padding: '10px 16px',
          cursor: 'pointer',
          background: item.isRead ? 'transparent' : 'rgba(212, 160, 23, 0.04)',
          borderBottom: '1px solid #f5f5f5',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = item.isRead ? '#fafafa' : 'rgba(212, 160, 23, 0.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = item.isRead ? 'transparent' : 'rgba(212, 160, 23, 0.04)'; }}
        onClick={() => handleItemClick(item)}
        actions={[
          <Button
            key="delete"
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => handleDelete(item.id, e)}
            style={{ color: '#999' }}
          />,
        ]}
      >
        <List.Item.Meta
          avatar={
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: item.isRead ? '#f5f5f5' : `rgba(${item.priority === 'high' ? '255,77,79' : item.priority === 'medium' ? '212,160,23' : '24,144,255'},0.1)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: item.isRead ? '#999' : (item.priority === 'high' ? '#ff4d4f' : item.priority === 'medium' ? '#d4a017' : '#1890ff'),
            }}>
              {config.icon}
            </div>
          }
          title={
            <Space size={4}>
              {!item.isRead && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4a017', flexShrink: 0 }} />
              )}
              <Tag color={config.color} style={{ marginRight: 0, fontSize: 11, lineHeight: '18px' }}>
                {config.text}
              </Tag>
              <Text strong={!item.isRead} style={{ fontSize: 13 }}>{item.title}</Text>
            </Space>
          }
          description={
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>{item.message}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {new Date(item.createdAt).toLocaleString('zh-CN')}
              </Text>
            </div>
          }
        />
      </List.Item>
    );
  };

  const tabItems = [
    {
      key: 'unread',
      label: `未读 (${unreadNotifications.length})`,
      children: unreadNotifications.length === 0 ? (
        <Empty description="暂无未读通知" style={{ padding: '24px 0' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={unreadNotifications}
          renderItem={renderNotificationItem}
          style={{ maxHeight: 360, overflow: 'auto' }}
        />
      ),
    },
    {
      key: 'read',
      label: '已读',
      children: readNotifications.length === 0 ? (
        <Empty description="暂无已读通知" style={{ padding: '24px 0' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={readNotifications.slice(0, 10)}
          renderItem={renderNotificationItem}
          style={{ maxHeight: 360, overflow: 'auto' }}
        />
      ),
    },
  ];

  const dropdownContent = (
    <div style={{ width: 380, background: '#fff', borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.12)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 15 }}>消息通知</Text>
        <Space size={4}>
          {unreadCount > 0 && (
            <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAllAsRead}>
              全部已读
            </Button>
          )}
          <Button type="link" size="small" icon={<ClearOutlined />} onClick={handleDeleteAllRead}>
            清空已读
          </Button>
        </Space>
      </div>
      <Tabs
        items={tabItems}
        size="small"
        style={{ marginBottom: 0 }}
        tabBarStyle={{ padding: '0 16px', marginBottom: 0 }}
      />
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
      onOpenChange={handleOpenChange}
      arrow
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer', color: '#555' }} />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBell;
