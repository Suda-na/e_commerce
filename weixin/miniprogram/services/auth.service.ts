// auth.service.ts
// 认证服务

import { request } from '../utils/request'
import { merchantCache, cached } from '../utils/cache'

interface LoginParams {
  code: string
  userInfo?: any
}

interface LoginResult {
  token: string
  userInfo: any
}

interface RegisterParams {
  username: string
  password: string
  role?: 'user' | 'merchant'
  phone?: string
  email?: string
}

class AuthService {
  // 微信登录
  async wxLogin(params: LoginParams): Promise<LoginResult> {
    const res = await request.post<LoginResult>('/auth/wx-login', params)
    return res.data
  }

  // 手机号登录
  async phoneLogin(phone: string, code: string): Promise<LoginResult> {
    const res = await request.post<LoginResult>('/auth/phone-login', { phone, code })
    return res.data
  }

  // 账号密码登录
  async passwordLogin(username: string, password: string): Promise<LoginResult> {
    const res = await request.post<any>('/auth/login', { username, password })
    console.log('登录API响应:', res)
    console.log('res.data:', res.data)
    console.log('res.data.data:', res.data?.data)
    
    // 后端返回 { success: true, data: { user: {...}, accessToken: '...', refreshToken: '...' } }
    const data = res.data?.data || res.data
    console.log('提取的数据:', { hasToken: !!data?.accessToken, hasUser: !!data?.user })
    console.log('accessToken:', data?.accessToken ? '***已隐藏***' : '无')
    console.log('user:', data?.user)
    
    return {
      token: data?.accessToken || data?.token || '',
      userInfo: data?.user || data?.userInfo || null
    }
  }

  // 注册
  async register(params: RegisterParams): Promise<any> {
    const res = await request.post('/auth/register', params)
    return res.data
  }

  // 发送验证码
  async sendVerifyCode(phone: string): Promise<any> {
    const res = await request.post('/auth/send-code', { phone })
    return res.data
  }

  // 获取用户信息（当前登录用户）
  async getUserInfo(): Promise<any> {
    const res = await request.get('/auth/profile')
    return res.data
  }

  // 更新用户信息
  async updateUserInfo(userInfo: any): Promise<any> {
    const res = await request.put('/auth/profile', userInfo)
    return res.data
  }

  // 修改密码
  async changePassword(oldPassword: string, newPassword: string): Promise<any> {
    const res = await request.post('/auth/change-password', { oldPassword, newPassword })
    return res.data
  }

  // 绑定手机号
  async bindPhone(phone: string, code: string): Promise<any> {
    const res = await request.post('/auth/bind-phone', { phone, code })
    return res.data
  }

  // 获取所有商家列表（带缓存，支持强制刷新）
  async getMerchants(forceRefresh: boolean = false): Promise<any[]> {
    if (forceRefresh) {
      // 跳过缓存，直接请求API
      merchantCache.delete('all')
    }
    return cached(merchantCache, 'all', async () => {
      const res = await request.get<any>('/auth/merchants')
      // 后端返回 { success: true, data: merchants }
      return res.data?.data || res.data || []
    }, 10 * 60 * 1000) // 缓存10分钟
  }

  // 退出登录
  async logout(): Promise<any> {
    const res = await request.post('/auth/logout')
    return res.data
  }

  // 获取用户竞拍统计数据
  async getUserStats(): Promise<any> {
    console.log('[AuthService] 调用 getUserStats API...')
    const res = await request.get('/auth/stats')
    console.log('[AuthService] getUserStats 原始响应:', JSON.stringify(res))
    // 后端返回 { success: true, data: { auctionCount, bidCount, winCount, favoriteCount } }
    // request.get 返回 ApiResponse<T>，其中 T 是 { auctionCount, bidCount, winCount, favoriteCount }
    // 所以 res.data 就是统计数据对象
    return res.data
  }
}

export const authService = new AuthService()