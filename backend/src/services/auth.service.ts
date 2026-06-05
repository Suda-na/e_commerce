import bcrypt from 'bcryptjs';
import { User, Product, Auction } from '../models';
import { 
  IUserCreate, 
  IUserLogin, 
  IUserResponse, 
  IJwtPayload
} from '../types';
import { AuthenticationError, ValidationError, ConflictError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { jwtUtils } from '../utils/jwt';
import { securityConfig } from '../config/security.config';
import { Op } from 'sequelize';

// 构建用户响应对象（不包含密码）
function buildUserResponse(user: any): IUserResponse {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    avatar: user.avatar,
    email: user.email,
    phone: user.phone,
    status: user.status,
    login_count: user.login_count,
    receiver_name: user.receiver_name,
    receiver_phone: user.receiver_phone,
    province: user.province,
    city: user.city,
    district: user.district,
    detail_address: user.detail_address,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export const authService = {
  /**
   * 用户注册
   */
  async register(userData: IUserCreate): Promise<{ user: IUserResponse; accessToken: string; refreshToken: string }> {
    try {
      // 检查用户名是否已存在
      const existingUser = await User.findOne({
        where: { username: userData.username },
      });

      if (existingUser) {
        throw new ConflictError('用户名已存在');
      }

      // 加密密码
      const salt = await bcrypt.genSalt(securityConfig.password.saltRounds);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // 生成默认头像
      const role = userData.role || 'user';
      const seed = Math.floor(Math.random() * 10) + 1;
      const defaultAvatar = role === 'merchant'
        ? `https://api.dicebear.com/7.x/avataaars/svg?seed=merchant${seed}`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=user${seed}`;

      // 创建用户
      const user = await User.create({
        ...userData,
        password: hashedPassword,
        avatar: defaultAvatar,
      });

      // 生成Token对（Access Token + Refresh Token）
      const { accessToken, refreshToken } = jwtUtils.generateTokenPair({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      // 返回用户信息（不包含密码）
      return { user: buildUserResponse(user), accessToken, refreshToken };
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  },

  /**
   * 用户登录
   */
  async login(loginData: IUserLogin): Promise<{ user: IUserResponse; accessToken: string; refreshToken: string }> {
    try {
      // 检查账户是否被锁定
      const isLocked = await jwtUtils.isAccountLocked(loginData.username);
      if (isLocked) {
        throw new AuthenticationError('账户已被锁定，请15分钟后再试');
      }

      // 查找用户
      const user = await User.findOne({
        where: { username: loginData.username },
      });

      if (!user) {
        // 记录登录失败次数
        await jwtUtils.recordLoginAttempt(loginData.username);
        throw new AuthenticationError('用户名或密码错误');
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(loginData.password, user.password);
      if (!isPasswordValid) {
        // 记录登录失败次数
        const attempts = await jwtUtils.recordLoginAttempt(loginData.username);
        const remainingAttempts = 5 - attempts;
        
        if (remainingAttempts <= 0) {
          throw new AuthenticationError('登录失败次数过多，账户已被锁定15分钟');
        } else if (remainingAttempts <= 2) {
          throw new AuthenticationError(`用户名或密码错误，还剩${remainingAttempts}次尝试机会`);
        } else {
          throw new AuthenticationError('用户名或密码错误');
        }
      }

      // 登录成功，清除登录失败次数
      await jwtUtils.clearLoginAttempts(loginData.username);

      // 递增登录次数
      await user.increment('login_count');
      await user.reload();

      // 生成Token对（Access Token + Refresh Token）
      const { accessToken, refreshToken } = jwtUtils.generateTokenPair({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      // 返回用户信息（不包含密码）
      return { user: buildUserResponse(user), accessToken, refreshToken };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  },

  /**
   * 获取用户信息
   */
  async getProfile(userId: number): Promise<IUserResponse> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new AuthenticationError('用户不存在');
      }

      return buildUserResponse(user);
    } catch (error) {
      logger.error('Get profile failed:', error);
      throw error;
    }
  },

  /**
   * 更新用户信息
   */
  async updateProfile(userId: number, updateData: { username?: string; avatar?: string | null; email?: string | null; phone?: string | null; receiver_name?: string | null; receiver_phone?: string | null; province?: string | null; city?: string | null; district?: string | null; detail_address?: string | null }): Promise<IUserResponse> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new AuthenticationError('用户不存在');
      }

      // 检查用户名是否已存在（如果要更新用户名）
      if (updateData.username && updateData.username !== user.username) {
        const existingUser = await User.findOne({
          where: { username: updateData.username },
        });

        if (existingUser) {
          throw new ConflictError('用户名已存在');
        }
      }

      // 更新用户信息
      await user.update(updateData);

      return buildUserResponse(user);
    } catch (error) {
      logger.error('Update profile failed:', error);
      throw error;
    }
  },

  /**
   * 刷新Token
   */
  async refreshToken(userId: number, refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new AuthenticationError('用户不存在');
      }

      // 使用JWT工具刷新Token对
      const newTokenPair = await jwtUtils.refreshTokenPair(userId, refreshToken);
      if (!newTokenPair) {
        throw new AuthenticationError('Refresh Token无效或已过期');
      }

      return newTokenPair;
    } catch (error) {
      logger.error('Refresh token failed:', error);
      throw error;
    }
  },

  /**
   * 退出登录（实现Token黑名单机制）
   */
  async logout(userId: number, accessToken: string): Promise<void> {
    try {
      // 将Access Token添加到Redis黑名单
      await jwtUtils.blacklistToken(accessToken);
      
      // 撤销Refresh Token
      await jwtUtils.revokeRefreshToken(userId);
      
      logger.info(`User ${userId} logged out, tokens invalidated`);
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  },

  /**
   * 验证JWT Token
   */
  verifyToken(token: string): IJwtPayload {
    return jwtUtils.verifyToken(token);
  },

  /**
   * 从Token中提取用户信息
   */
  async getUserFromToken(token: string): Promise<IUserResponse | null> {
    try {
      const payload = jwtUtils.verifyToken(token);
      const user = await User.findByPk(payload.userId);
      
      if (!user) {
        return null;
      }

      return buildUserResponse(user);
    } catch (error) {
      return null;
    }
  },

  /**
   * 获取所有商家用户（带商品和竞拍统计）
   */
  async getMerchants(): Promise<any[]> {
    try {
      const merchants = await User.findAll({
        where: { role: 'merchant' },
        attributes: ['id', 'username', 'avatar', 'role', 'created_at'],
        order: [['created_at', 'DESC']],
        include: [
          {
            model: Product,
            as: 'products',
            attributes: ['id'],
            required: false,
          },
        ],
      });

      // 获取每个商家的活跃竞拍数量
      const merchantIds = merchants.map(m => m.id);
      
      // 查询所有活跃竞拍及其关联的商品
      const activeAuctions = await Auction.findAll({
        where: { status: 'active' },
        include: [{
          model: Product,
          as: 'product',
          attributes: ['merchant_id'],
          where: { merchant_id: { [Op.in]: merchantIds } },
        }],
        attributes: ['id'],
      });

      // 统计每个商家的活跃竞拍数
      const activeAuctionCountMap: Record<number, number> = {};
      activeAuctions.forEach((auction: any) => {
        const merchantId = auction.product?.merchant_id;
        if (merchantId) {
          activeAuctionCountMap[merchantId] = (activeAuctionCountMap[merchantId] || 0) + 1;
        }
      });

      return merchants.map(merchant => {
        const plainMerchant = merchant.get({ plain: true });
        return {
          ...buildUserResponse(merchant),
          product_count: (plainMerchant as any).products?.length || 0,
          active_auction_count: activeAuctionCountMap[merchant.id] || 0,
        };
      });
    } catch (error) {
      logger.error('Get merchants failed:', error);
      throw error;
    }
  },
};

export default authService;