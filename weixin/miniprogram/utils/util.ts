/**
 * 通用工具函数库
 * 
 * 功能分类：
 * 1. 价格格式化
 * 2. 时间日期格式化
 * 3. 数字格式化
 * 4. 字符串处理
 * 5. 数组操作
 * 6. 对象操作
 * 7. 函数增强（防抖/节流）
 * 8. 平台工具
 * 9. 业务工具
 */

// ==================== 价格格式化 ====================

/**
 * 格式化价格
 * @param price 价格
 * @param prefix 前缀（默认 ¥）
 * @returns 格式化后的价格字符串
 */
export const formatPrice = (price: number | undefined | null, prefix?: string): string => {
  const p = prefix || '¥';
  if (price === undefined || price === null || isNaN(price)) {
    return `${p}0.00`;
  }
  return `${p}${price.toFixed(2)}`;
};

/**
 * 格式化价格（带千分位）
 * @param price 价格
 * @param prefix 前缀
 * @returns 格式化后的价格字符串
 */
export const formatPriceWithCommas = (price: number, prefix?: string): string => {
  const p = prefix || '¥';
  const parts = price.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${p}${parts.join('.')}`;
};

/**
 * 格式化大额价格（万/亿）
 * @param price 价格
 * @returns 格式化后的价格字符串
 */
export const formatLargePrice = (price: number): string => {
  if (price >= 100000000) {
    return `¥${(price / 100000000).toFixed(2)}亿`;
  }
  if (price >= 10000) {
    return `¥${(price / 10000).toFixed(2)}万`;
  }
  return formatPrice(price);
};

/**
 * 价格分转元
 * @param fen 分
 * @returns 元
 */
export const fenToYuan = (fen: number): number => {
  return fen / 100;
};

/**
 * 价格元转分
 * @param yuan 元
 * @returns 分
 */
export const yuanToFen = (yuan: number): number => {
  return Math.round(yuan * 100);
};

// ==================== 时间日期格式化 ====================

/**
 * 格式化时间
 * @param date 日期对象或字符串或时间戳
 * @param format 格式化模板（默认 'YYYY-MM-DD HH:mm:ss'）
 * @returns 格式化后的时间字符串
 */
export const formatTime = (date: Date | string | number, format?: string): string => {
  const f = format || 'YYYY-MM-DD HH:mm:ss';
  const d = date instanceof Date ? date : new Date(date);
  
  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = d.getMinutes();
  const second = d.getSeconds();

  const padZero = (n: number) => n.toString().padStart(2, '0');

  return f
    .replace('YYYY', year.toString())
    .replace('MM', padZero(month))
    .replace('DD', padZero(day))
    .replace('HH', padZero(hour))
    .replace('mm', padZero(minute))
    .replace('ss', padZero(second));
};

/**
 * 格式化为日期（不含时间）
 */
export const formatDate = (date: Date | string | number): string => {
  return formatTime(date, 'YYYY-MM-DD');
};

/**
 * 格式化为时间（不含日期）
 */
export const formatTimeOnly = (date: Date | string | number): string => {
  return formatTime(date, 'HH:mm:ss');
};

/**
 * 格式化为相对时间
 * @param date 日期
 * @returns 相对时间字符串
 */
export const formatRelativeTime = (date: Date | string | number): string => {
  const d = date instanceof Date ? date : new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();

  // 刚刚（1分钟内）
  if (diff < 60 * 1000) {
    return '刚刚';
  }

  // X分钟前
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}分钟前`;
  }

  // X小时前
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}小时前`;
  }

  // X天前
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}天前`;
  }

  // 超过7天显示日期
  return formatDate(d);
};

/**
 * 格式化倒计时
 * @param milliseconds 毫秒数
 * @returns 倒计时字符串
 */
export const formatCountdown = (milliseconds: number): string => {
  if (milliseconds <= 0) {
    return '00:00:00';
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const padZero = (n: number) => n.toString().padStart(2, '0');

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
};

/**
 * 格式化剩余时间（智能显示）
 * @param endTime 结束时间
 * @returns 剩余时间字符串
 */
export const formatRemainingTime = (endTime: Date | string | number): string => {
  const end = endTime instanceof Date ? endTime.getTime() : new Date(endTime).getTime();
  const now = Date.now();
  const remaining = end - now;

  if (remaining <= 0) {
    return '已结束';
  }

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

  if (days > 0) {
    return `${days}天${hours}小时`;
  }
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`;
  }
  return `${seconds}秒`;
};

// ==================== 数字格式化 ====================

/**
 * 格式化数字（千分位）
 * @param num 数字
 * @returns 格式化后的字符串
 */
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * 格化大数字（万/亿）
 * @param num 数字
 * @returns 格式化后的字符串
 */
export const formatLargeNumber = (num: number): string => {
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}亿`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return formatNumber(num);
};

/**
 * 格式化百分比
 * @param value 数值（0-1 或 0-100）
 * @param isDecimal 是否为小数（默认 false）
 * @returns 百分比字符串
 */
export const formatPercent = (value: number, isDecimal?: boolean): string => {
  const decimal = isDecimal !== undefined ? isDecimal : false;
  const percent = decimal ? value * 100 : value;
  return `${percent.toFixed(1)}%`;
};

/**
 * 生成随机数
 * @param min 最小值
 * @param max 最大值
 * @param isInteger 是否为整数（默认 true）
 * @returns 随机数
 */
export const random = (min: number, max: number, isInteger?: boolean): number => {
  const integer = isInteger !== undefined ? isInteger : true;
  const value = Math.random() * (max - min) + min;
  return integer ? Math.floor(value) : value;
};

// ==================== 字符串处理 ====================

/**
 * 截断字符串
 * @param str 原字符串
 * @param maxLength 最大长度
 * @param suffix 后缀（默认 '...'）
 * @returns 截断后的字符串
 */
export const truncate = (str: string, maxLength: number, suffix?: string): string => {
  const s = suffix || '...';
  if (!str || str.length <= maxLength) {
    return str || '';
  }
  return str.substring(0, maxLength) + s;
};

/**
 * 脱敏手机号
 * @param phone 手机号
 * @returns 脱敏后的手机号
 */
export const maskPhone = (phone: string): string => {
  if (!phone || phone.length !== 11) {
    return phone || '';
  }
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

/**
 * 脱敏邮箱
 * @param email 邮箱
 * @returns 脱敏后的邮箱
 */
export const maskEmail = (email: string): string => {
  if (!email) return '';
  const [username, domain] = email.split('@');
  if (!username || !domain) return email;
  const maskedUsername = username.length > 2 
    ? username[0] + '***' + username[username.length - 1]
    : '***';
  return `${maskedUsername}@${domain}`;
};

/**
 * 生成唯一ID
 * @returns 唯一ID字符串
 */
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

/**
 * 驼峰转下划线
 */
export const camelToSnake = (str: string): string => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

/**
 * 下划线转驼峰
 */
export const snakeToCamel = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// ==================== 数组操作 ====================

/**
 * 数组去重
 * @param arr 数组
 * @param key 对象数组的去重键名
 * @returns 去重后的数组
 */
export const unique = <T>(arr: T[], key?: keyof T): T[] => {
  if (!arr) return [];
  if (!key) {
    return [...new Set(arr)];
  }
  const seen = new Set();
  return arr.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

/**
 * 数组分组
 * @param arr 数组
 * @param key 分组键名
 * @returns 分组后的对象
 */
export const groupBy = <T>(arr: T[], key: keyof T): Record<string, T[]> => {
  if (!arr) return {};
  return arr.reduce((groups, item) => {
    const value = String(item[key]);
    groups[value] = groups[value] || [];
    groups[value].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

/**
 * 数组分页
 * @param arr 数组
 * @param page 页码（从1开始）
 * @param pageSize 每页数量
 * @returns 分页后的数组
 */
export const paginate = <T>(arr: T[], page: number, pageSize: number): T[] => {
  if (!arr) return [];
  const start = (page - 1) * pageSize;
  return arr.slice(start, start + pageSize);
};

/**
 * 数组洗牌（随机排序）
 * @param arr 数组
 * @returns 随机排序后的数组
 */
export const shuffle = <T>(arr: T[]): T[] => {
  if (!arr) return [];
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// ==================== 对象操作 ====================

/**
 * 深拷贝
 * @param obj 对象
 * @returns 拷贝后的对象
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
};

/**
 * 深合并对象
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的对象
 */
export const deepMerge = <T extends Record<string, any>>(target: T, source: Partial<T>): T => {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(target[key], source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
  }
  return result;
};

/**
 * 移除对象中的空值
 * @param obj 对象
 * @returns 移除空值后的对象
 */
export const removeEmpty = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      result[key] = obj[key];
    }
  }
  return result as Partial<T>;
};

// ==================== 函数增强 ====================

/**
 * 防抖函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export const debounce = <T extends (...args: any[]) => any>(fn: T, delay?: number): T => {
  const d = delay || 300;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, d);
  }) as T;
};

/**
 * 节流函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export const throttle = <T extends (...args: any[]) => any>(fn: T, delay?: number): T => {
  const d = delay || 300;
  let lastTime = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastTime >= d) {
      fn(...args);
      lastTime = now;
    }
  }) as T;
};

/**
 * 延迟执行
 * @param ms 延迟时间（毫秒）
 * @returns Promise
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 重试函数
 * @param fn 要执行的函数
 * @param maxAttempts 最大尝试次数
 * @param delay 重试间隔
 * @returns 执行结果
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts?: number,
  delay?: number
): Promise<T> => {
  const maxA = maxAttempts || 3;
  const d = delay || 1000;
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxA; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxA - 1) {
        await sleep(d * (i + 1)); // 递增延迟
      }
    }
  }
  
  throw lastError;
};

// ==================== 平台工具 ====================

/**
 * 获取系统信息
 */
export const getSystemInfo = (): WechatMiniprogram.SystemInfo | null => {
  try {
    return wx.getSystemInfoSync();
  } catch (e) {
    console.error('获取系统信息失败', e);
    return null;
  }
};

/**
 * 是否为 iOS
 */
export const isIOS = (): boolean => {
  const info = getSystemInfo();
  return info?.platform === 'ios';
};

/**
 * 是否为 Android
 */
export const isAndroid = (): boolean => {
  const info = getSystemInfo();
  return info?.platform === 'android';
};

/**
 * 获取状态栏高度
 */
export const getStatusBarHeight = (): number => {
  const info = getSystemInfo();
  return info?.statusBarHeight || 0;
};

/**
 * 获取胶囊按钮信息
 */
export const getMenuButtonBoundingClientRect = (): WechatMiniprogram.Rect | null => {
  try {
    return wx.getMenuButtonBoundingClientRect();
  } catch (e) {
    return null;
  }
};

/**
 * 复制到剪贴板
 * @param text 要复制的文本
 * @param showToast 是否显示提示
 */
export const copyToClipboard = (text: string, showToast?: boolean): void => {
  const show = showToast !== undefined ? showToast : true;
  wx.setClipboardData({
    data: text,
    success: () => {
      if (show) {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    },
  });
};

/**
 * 拨打电话
 * @param phone 电话号码
 */
export const makePhoneCall = (phone: string): void => {
  wx.makePhoneCall({
    phoneNumber: phone,
    fail: (err) => {
      if (err.errMsg !== 'makePhoneCall:fail cancel') {
        wx.showToast({ title: '拨号失败', icon: 'none' });
      }
    },
  });
};

// ==================== 业务工具 ====================

/**
 * 获取竞拍状态文本
 * @param status 状态码
 * @returns 状态文本
 */
export const getAuctionStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: '即将开始',
    active: '竞拍中',
    ended: '已结束',
    cancelled: '已取消',
  };
  return statusMap[status] || '未知状态';
};

/**
 * 获取竞拍状态颜色
 * @param status 状态码
 * @returns 颜色值
 */
export const getAuctionStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    pending: '#FAAD14',
    active: '#FF4D4F',
    ended: '#999999',
    cancelled: '#999999',
  };
  return colorMap[status] || '#999999';
};

/**
 * 获取订单状态文本
 * @param status 状态码
 * @returns 状态文本
 */
export const getOrderStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: '待付款',
    paid: '已付款',
    shipped: '已发货',
    delivered: '已收货',
    completed: '已完成',
    cancelled: '已取消',
    refunded: '已退款',
  };
  return statusMap[status] || '未知状态';
};

/**
 * 生成订单号
 * @returns 订单号字符串
 */
export const generateOrderNo = (): string => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}${random}`;
};

/**
 * 解析 URL 参数
 * @param url URL 字符串
 * @returns 参数对象
 */
export const parseUrlParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const queryString = url.split('?')[1];
  if (!queryString) return params;

  queryString.split('&').forEach(param => {
    const [key, value] = param.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  });

  return params;
};

/**
 * 构建 URL 参数
 * @param params 参数对象
 * @returns URL 参数字符串
 */
export const buildUrlParams = (params: Record<string, any>): string => {
  return Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
};

// ==================== 默认导出 ====================

export default {
  // 价格
  formatPrice,
  formatPriceWithCommas,
  formatLargePrice,
  fenToYuan,
  yuanToFen,

  // 时间
  formatTime,
  formatDate,
  formatTimeOnly,
  formatRelativeTime,
  formatCountdown,
  formatRemainingTime,

  // 数字
  formatNumber,
  formatLargeNumber,
  formatPercent,
  random,

  // 字符串
  truncate,
  maskPhone,
  maskEmail,
  generateId,
  camelToSnake,
  snakeToCamel,

  // 数组
  unique,
  groupBy,
  paginate,
  shuffle,

  // 对象
  deepClone,
  deepMerge,
  removeEmpty,

  // 函数
  debounce,
  throttle,
  sleep,
  retry,

  // 平台
  getSystemInfo,
  isIOS,
  isAndroid,
  getStatusBarHeight,
  getMenuButtonBoundingClientRect,
  copyToClipboard,
  makePhoneCall,

  // 业务
  getAuctionStatusText,
  getAuctionStatusColor,
  getOrderStatusText,
  generateOrderNo,
  parseUrlParams,
  buildUrlParams,
};
