/**
 * Socket 工具使用示例
 * 
 * 本文件展示如何在 Page/Component 中使用 SocketManager
 * 参考后可删除此文件
 */

import { getSocket, SocketState } from './socket';
import type { BidData, PriceUpdateData, AuctionStatusData } from './socket';

// ==================== 示例1：在直播间页面使用 ====================

Page({
  data: {
    auctionId: '',
    currentPrice: 0,
    bidCount: 0,
    participantCount: 0,
    bids: [] as BidData[],
    connectionState: 'disconnected',
  },

  onLoad(options: any) {
    const { auctionId } = options;
    this.setData({ auctionId });

    // 初始化 Socket 连接
    this.initSocket();
  },

  /** 初始化 Socket 连接 */
  initSocket() {
    const socket = getSocket();

    // 注册事件监听
    socket.on('connect', () => {
      console.log('Socket 已连接');
      this.setData({ connectionState: SocketState.CONNECTED });

      // 连接成功后加入房间
      socket.joinRoom(this.data.auctionId);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket 断开:', reason);
      this.setData({ connectionState: SocketState.DISCONNECTED });
    });

    socket.on('reconnecting', (attempt) => {
      console.log(`正在重连，第 ${attempt} 次尝试`);
      this.setData({ connectionState: SocketState.RECONNECTING });
    });

    // 监听价格更新
    socket.on('price_update', (data: PriceUpdateData) => {
      if (data.auctionId === this.data.auctionId) {
        this.setData({
          currentPrice: data.currentPrice,
          bidCount: data.bidCount,
          participantCount: data.participantCount,
        });
      }
    });

    // 监听新出价
    socket.on('new_bid', (data: BidData) => {
      if (data.auctionId === this.data.auctionId) {
        const bids = [data, ...this.data.bids].slice(0, 50); // 只保留最近50条
        this.setData({ bids });
      }
    });

    // 监听出价成功
    socket.on('bid_success', (data) => {
      if (data.auctionId === this.data.auctionId) {
        wx.showToast({
          title: data.isLeading ? '您已领先！' : '出价成功',
          icon: 'success',
        });
      }
    });

    // 监听出价被超越
    socket.on('outbid', (data) => {
      if (data.auctionId === this.data.auctionId) {
        wx.showModal({
          title: '出价被超越',
          content: `当前价格 ¥${data.currentPrice}，您的出价 ¥${data.yourBid}`,
          showCancel: false,
        });
      }
    });

    // 监听竞拍结束
    socket.on('auction_end', (data: AuctionStatusData) => {
      if (data.auctionId === this.data.auctionId) {
        wx.showModal({
          title: '竞拍已结束',
          content: data.winnerId ? `获胜者: ${data.winnerNickname}` : '竞拍已结束',
          showCancel: false,
        });
      }
    });

    // 建立连接
    socket.connect();
  },

  /** 提交出价 */
  submitBid(amount: number) {
    const socket = getSocket();
    socket.emit('place_bid', {
      auctionId: this.data.auctionId,
      amount,
    });
  },

  /** 发送评论 */
  sendComment(content: string) {
    const socket = getSocket();
    socket.emit('send_comment', {
      roomId: this.data.auctionId,
      content,
    });
  },

  onUnload() {
    // 离开房间
    const socket = getSocket();
    socket.leaveRoom(this.data.auctionId);

    // 移除事件监听（避免内存泄漏）
    socket.off('connect');
    socket.off('disconnect');
    socket.off('reconnecting');
    socket.off('price_update');
    socket.off('new_bid');
    socket.off('bid_success');
    socket.off('outbid');
    socket.off('auction_end');
  },
});

// ==================== 示例2：在首页监控连接状态 ====================

/*
import { getSocket, SocketState } from '../utils/socket';

Page({
  data: {
    socketState: 'disconnected',
    unreadCount: 0,
  },

  onLoad() {
    const socket = getSocket();

    // 监听连接状态变化
    socket.on('connect', () => {
      this.setData({ socketState: 'connected' });
    });

    socket.on('disconnect', () => {
      this.setData({ socketState: 'disconnected' });
    });

    // 监听系统通知
    socket.on('system_notice', (data) => {
      this.setData({
        unreadCount: this.data.unreadCount + 1,
      });
      wx.showToast({
        title: data.title,
        icon: 'none',
      });
    });

    // 如果未连接，建立连接
    if (!socket.isConnected()) {
      socket.connect();
    }
  },

  onUnload() {
    // 注意：不要在页面卸载时关闭 Socket
    // Socket 应该在整个小程序生命周期内保持连接
  },
});
*/

// ==================== 示例3：连接状态显示组件 ====================

/*
Component({
  data: {
    stateText: '未连接',
    stateClass: 'disconnected',
  },

  lifetimes: {
    attached() {
      const socket = getSocket();

      this.updateState(socket.getState());

      socket.on('connect', () => this.updateState(SocketState.CONNECTED));
      socket.on('disconnect', () => this.updateState(SocketState.DISCONNECTED));
      socket.on('reconnecting', () => this.updateState(SocketState.RECONNECTING));
    },

    detached() {
      const socket = getSocket();
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnecting');
    },
  },

  methods: {
    updateState(state: SocketState) {
      const stateMap = {
        [SocketState.DISCONNECTED]: { text: '未连接', class: 'disconnected' },
        [SocketState.CONNECTING]: { text: '连接中...', class: 'connecting' },
        [SocketState.CONNECTED]: { text: '已连接', class: 'connected' },
        [SocketState.RECONNECTING]: { text: '重连中...', class: 'reconnecting' },
      };

      const info = stateMap[state] || stateMap[SocketState.DISCONNECTED];
      this.setData({
        stateText: info.text,
        stateClass: info.class,
      });
    },
  },
});
*/

// ==================== 示例4：一次性事件监听 ====================

/*
import { getSocket } from '../utils/socket';

// 等待连接成功
function waitForConnect(): Promise<void> {
  return new Promise((resolve) => {
    const socket = getSocket();
    
    if (socket.isConnected()) {
      resolve();
      return;
    }

    socket.once('connect', () => {
      resolve();
    });
  });
}

// 使用
async function someFunction() {
  await waitForConnect();
  // 现在可以安全地发送消息了
  const socket = getSocket();
  socket.emit('some_event', { data: 'test' });
}
*/
