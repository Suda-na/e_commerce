/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo,
    isLoggedIn: boolean,
    token: string,
    baseUrl: string,
    socketUrl: string,
    systemInfo?: WechatMiniprogram.SystemInfo,
    unreadCount: number,
    _unreadPollingTimer: any,
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
  updateUnreadCount(count: number, source?: string): void,
  incrementUnreadCount(increment?: number, source?: string): void,
  decrementUnreadCount(decrement?: number, source?: string): void,
  getUnreadCount(): number,
  syncTabBarBadge(count: number): void,
  startUnreadCountPolling(): void,
  stopUnreadCountPolling(): void,
  fetchUnreadCountFromServer(): void,
}