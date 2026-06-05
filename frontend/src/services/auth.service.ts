import api from './api';
import { LoginRequest, RegisterRequest, AuthResponse, User, ApiResponse } from '../types';

class AuthService {
  // 后端snake_case → 前端camelCase
  private toCamelCase(user: any): User {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      avatar: user.avatar,
      email: user.email,
      phone: user.phone,
      status: user.status,
      loginCount: user.login_count,
      receiverName: user.receiver_name,
      receiverPhone: user.receiver_phone,
      province: user.province,
      city: user.city,
      district: user.district,
      detailAddress: user.detail_address,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<ApiResponse<any>>('/auth/login', data);
    const result = response.data.data!;
    const authResponse: AuthResponse = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: this.toCamelCase(result.user),
    };
    localStorage.setItem('token', authResponse.accessToken);
    localStorage.setItem('refreshToken', authResponse.refreshToken);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
    return authResponse;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<ApiResponse<any>>('/auth/register', data);
    const result = response.data.data!;
    const authResponse: AuthResponse = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: this.toCamelCase(result.user),
    };
    localStorage.setItem('token', authResponse.accessToken);
    localStorage.setItem('refreshToken', authResponse.refreshToken);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
    return authResponse;
  }

  async getProfile(): Promise<User> {
    const response = await api.get<ApiResponse<any>>('/auth/profile');
    return this.toCamelCase(response.data.data!);
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await api.put<ApiResponse<any>>('/auth/profile', data);
    return this.toCamelCase(response.data.data!);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  getStoredUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr || userStr === 'undefined') {
      return null;
    }
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  getStoredToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    const token = this.getStoredToken();
    if (!token) return false;
    
    // 检查 token 格式和过期时间
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // 转换为毫秒
      if (Date.now() >= exp) {
        // Token 已过期，清除存储
        this.logout();
        return false;
      }
      return true;
    } catch {
      // Token 格式无效
      this.logout();
      return false;
    }
  }
}

export const authService = new AuthService();
