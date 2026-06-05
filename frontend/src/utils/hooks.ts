import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { RootState, AppDispatch } from '../store';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useThrottleCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const lastRunRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRunRef.current >= delay) {
      lastRunRef.current = now;
      callbackRef.current(...args);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lastRunRef.current = Date.now();
        callbackRef.current(...args);
      }, delay - (now - lastRunRef.current));
    }
  }, [delay]);
}

// Format currency
export const formatPrice = (price?: number): string => {
  if (price == null) return '¥0.00';
  return `¥${price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format date
export const formatDate = (date?: string): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format countdown
export const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return '已结束';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Status color map
export const statusColors: Record<string, string> = {
  pending: 'default',
  active: 'processing',
  completed: 'success',
  cancelled: 'error',
  paid: 'success',
  shipped: 'blue',
  refunding: 'warning',
  refunded: 'volcano',
};

// Status label map (订单专用 - pending 表示待付款)
export const statusLabels: Record<string, string> = {
  pending: '待付款',
  active: '进行中',
  completed: '已结束',
  cancelled: '已取消',
  paid: '已付款',
  shipped: '已发货',
  refunding: '退款中',
  refunded: '已退款',
};

// 竞拍专用状态标签 - pending 表示待开始
export const auctionStatusLabels: Record<string, string> = {
  pending: '待开始',
  active: '进行中',
  completed: '已结束',
  cancelled: '已取消',
};

// 商品专用状态标签 - pending 表示待审核
export const productStatusLabels: Record<string, string> = {
  pending: '待审核',
  active: '在售',
  completed: '已结束',
  cancelled: '已下架',
};
