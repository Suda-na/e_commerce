/**
 * Request 工具使用示例
 * 
 * 本文件展示如何在 Page/Component 中使用 request 工具类
 * 参考后可删除此文件
 */

import { request, get, post, cancelAllRequests } from './request';

// ==================== 示例1：在 Page 中使用 ====================

Page({
  data: {
    auctionList: [] as any[],
    loading: false,
  },

  async onLoad() {
    // 方式1：使用 request 实例方法（推荐）
    await this.loadAuctions();
    
    // 方式2：使用独立函数
    // const res = await get('/auctions', { status: 'active' });
  },

  /** 加载竞拍列表 */
  async loadAuctions() {
    try {
      this.setData({ loading: true });
      
      // GET 请求示例
      const res = await request.get('/auctions', {
        status: 'active',
        page: 1,
        limit: 20,
      }, {
        showLoading: true,      // 显示 loading 遮罩
        loadingText: '加载中...', // loading 文字
        showError: true,         // 显示错误 Toast
        isAuth: true,            // 需要认证
        retryCount: 1,           // 失败重试 1 次
      });

      this.setData({
        auctionList: res.data.list || [],
        loading: false,
      });
    } catch (error: any) {
      console.error('加载失败:', error.message);
      // 错误已在 request.ts 中统一处理，这里可以做额外处理
      this.setData({ loading: false });
    }
  },

  /** 提交出价 */
  async submitBid(auctionId: string, amount: number) {
    try {
      // POST 请求示例
      const res = await request.post('/bids', {
        auctionId,
        amount,
      }, {
        showLoading: true,
        loadingText: '提交中...',
      });

      wx.showToast({
        title: '出价成功',
        icon: 'success',
      });

      return res.data;
    } catch (error: any) {
      console.error('出价失败:', error.message);
      throw error;
    }
  },

  /** 更新用户信息 */
  async updateProfile(nickname: string, avatar: string) {
    try {
      // PUT 请求示例
      const res = await request.put('/auth/user-info', {
        nickname,
        avatar,
      }, {
        showLoading: true,
      });

      wx.showToast({ title: '更新成功', icon: 'success' });
      return res.data;
    } catch (error: any) {
      console.error('更新失败:', error.message);
      throw error;
    }
  },

  /** 删除收藏 */
  async removeFavorite(id: string) {
    try {
      // DELETE 请求示例
      await request.delete(`/favorites/${id}`, undefined, {
        showLoading: true,
        loadingText: '删除中...',
      });

      wx.showToast({ title: '已取消收藏', icon: 'success' });
    } catch (error: any) {
      console.error('删除失败:', error.message);
    }
  },

  /** 上传头像 */
  async uploadAvatar(filePath: string) {
    try {
      const res = await request.upload('/upload/avatar', filePath, 'avatar', {
        userId: 'xxx',
      }, true);

      wx.showToast({ title: '上传成功', icon: 'success' });
      return res.data;
    } catch (error: any) {
      console.error('上传失败:', error.message);
      throw error;
    }
  },

  /** 下载文件 */
  async downloadInvoice(url: string) {
    try {
      const tempFilePath = await request.download(url, true);
      
      // 打开文件
      wx.openDocument({
        filePath: tempFilePath,
        showMenu: true,
        success: () => {
          console.log('打开文件成功');
        },
      });
    } catch (error: any) {
      console.error('下载失败:', error.message);
    }
  },

  onUnload() {
    // 页面卸载时取消所有未完成的请求
    cancelAllRequests();
  },
});

// ==================== 示例2：在 Service 中使用 ====================

/*
import { request } from '../utils/request';

class AuctionService {
  async getList(params: any) {
    const res = await request.get('/auctions', params);
    return res.data;
  }

  async getDetail(id: string) {
    const res = await request.get(`/auctions/${id}`);
    return res.data;
  }

  async create(data: any) {
    const res = await request.post('/auctions', data, {
      showLoading: true,
    });
    return res.data;
  }
}

export const auctionService = new AuctionService();
*/

// ==================== 示例3：Token 管理 ====================

/*
import { getToken, setToken, removeToken } from '../utils/request';

// 登录后保存 Token
async function login(username: string, password: string) {
  const res = await request.post('/auth/login', { username, password }, {
    isAuth: false,  // 登录接口不需要 Token
  });
  
  // 保存 Token
  setToken(res.data.token);
  
  return res.data;
}

// 退出登录
function logout() {
  removeToken();
  wx.redirectTo({ url: '/pages/login/login' });
}

// 检查是否已登录
function isLoggedIn(): boolean {
  return !!getToken();
}
*/

// ==================== 示例4：错误处理 ====================

/*
async function handleErrors() {
  try {
    const res = await request.get('/protected-resource');
    // 成功处理
  } catch (error: any) {
    // 错误已经在 request.ts 中统一处理了 Toast 提示
    // 这里可以根据具体错误类型做额外处理
    
    if (error.message.includes('未授权')) {
      // 401 错误，已自动跳转登录页
      return;
    }
    
    if (error.message.includes('网络异常')) {
      // 网络错误，可以显示离线状态
      this.setData({ isOffline: true });
      return;
    }
    
    // 其他错误
    console.error('请求失败:', error.message);
  }
}
*/
