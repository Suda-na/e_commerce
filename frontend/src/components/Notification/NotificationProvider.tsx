import React, { useEffect, useCallback, useRef } from 'react';
import { App } from 'antd';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import {
  addNotification,
  fetchUnreadCount,
  fetchNotifications,
} from '../../store/slices/notificationSlice';
import { socketService } from '../../services/socket.service';

const TYPE_URGENCY: Record<string, 'urgent' | 'normal' | 'low'> = {
  new_order: 'urgent',
  order_paid: 'urgent',
  refund_request: 'urgent',
  auction_ending_soon: 'normal',
  auction_ended: 'normal',
  auction_won: 'normal',
  outbid: 'normal',
  stock_warning: 'normal',
  system_announcement: 'low',
};

const TYPE_ICON: Record<string, string> = {
  new_order: '🛒',
  order_paid: '💰',
  refund_request: '↩️',
  auction_ending_soon: '⏰',
  auction_ended: '🏁',
  auction_won: '🏆',
  outbid: '⚠️',
  stock_warning: '📦',
  system_announcement: '📢',
};

let audioContext: AudioContext | null = null;

function playNotificationSound(urgency: 'urgent' | 'normal' | 'low') {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContext;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (urgency === 'urgent') {
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.15;
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        osc2.type = 'sine';
        gain2.gain.value = 0.15;
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.2);
      }, 200);
    } else if (urgency === 'normal') {
      oscillator.frequency.value = 660;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.12);
    }
  } catch {
  }
}

async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showBrowserNotification(title: string, body: string, link?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const browserNotif = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: `auction-${Date.now()}`,
  });

  browserNotif.onclick = () => {
    window.focus();
    if (link) {
      // 兼容旧格式 /merchant/orders/123 → /merchant/orders?orderId=123
      const oldOrderLinkMatch = link.match(/^\/merchant\/orders\/(\d+)$/);
      const targetLink = oldOrderLinkMatch
        ? `/merchant/orders?orderId=${oldOrderLinkMatch[1]}`
        : link;
      window.location.href = targetLink;
    }
    browserNotif.close();
  };

  setTimeout(() => browserNotif.close(), 5000);
}

const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token } = useAppSelector((state) => state.auth);
  const { message } = App.useApp();
  const socketConnected = useRef(false);
  const permissionRequested = useRef(false);
  const handleNewNotificationRef = useRef<((data: any) => void) | null>(null);

  handleNewNotificationRef.current = useCallback((data: any) => {
    const notification = {
      id: data.id,
      userId: data.user_id || 0,
      type: data.type,
      title: data.title,
      message: data.message,
      priority: data.priority || 'medium',
      link: data.link || null,
      isRead: false,
      metadata: data.metadata || null,
      createdAt: data.created_at || new Date().toISOString(),
      updatedAt: data.updated_at || new Date().toISOString(),
    };

    dispatch(addNotification(notification));

    const urgency = TYPE_URGENCY[data.type] || 'normal';

    if (urgency === 'urgent') {
      playNotificationSound('urgent');
      showBrowserNotification(notification.title, notification.message, notification.link || undefined);
    } else if (urgency === 'normal') {
      playNotificationSound('normal');
    }

    if (urgency === 'urgent' || urgency === 'normal') {
      const icon = TYPE_ICON[data.type] || '🔔';
      message.info({
        content: `${icon} ${notification.title}: ${notification.message}`,
        duration: 4,
      });
    }
  }, [dispatch, message]);

  useEffect(() => {
    if (!isAuthenticated || !token || socketConnected.current) return;

    socketConnected.current = true;

    try {
      socketService.connect(token);

      socketService.on('new_notification', (data: any) => {
        handleNewNotificationRef.current?.(data);
      });

      socketService.on('stock_warning', (data: any) => {
        handleNewNotificationRef.current?.({
          id: `stock-${data.productId}-${Date.now()}`,
          type: 'stock_warning',
          title: '库存预警',
          message: data.message || `商品「${data.productName}」库存不足`,
          priority: 'medium',
          link: `/merchant/products/${data.productId}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      socketService.on('auction_ending_soon', (data: any) => {
        handleNewNotificationRef.current?.({
          id: `ending-${data.auctionId}-${Date.now()}`,
          type: 'auction_ending_soon',
          title: '竞拍即将结束',
          message: `竞拍 #${data.auctionId} 即将结束，剩余 ${data.timeLeft} 秒`,
          priority: 'medium',
          link: `/merchant/auctions/${data.auctionId}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
    } catch {
      // Socket connection failed silently - don't block the UI
    }

    if (!permissionRequested.current) {
      requestBrowserNotificationPermission();
      permissionRequested.current = true;
    }

    dispatch(fetchUnreadCount());
    dispatch(fetchNotifications({ page: 1, limit: 20 }));

    return () => {
      socketService.off('new_notification', handleNewNotificationRef.current || (() => {}));
      socketService.off('stock_warning');
      socketService.off('auction_ending_soon');
      socketConnected.current = false;
    };
  }, [isAuthenticated, token, dispatch]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      dispatch(fetchUnreadCount());
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, dispatch]);

  return <>{children}</>;
};

export default NotificationProvider;
