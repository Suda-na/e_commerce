import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { securityConfig } from '../config/security.config';
import { IJwtPayload } from '../types';
import { AuthenticationError } from '../middleware/errorHandler';
import { redisUtils } from '../config/redis';
import { logger } from './logger';
import { securityAudit } from './security-audit';

// Token黑名单前缀
const TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';

// Refresh Token前缀
const REFRESH_TOKEN_PREFIX = 'refresh:token:';

// 登录失败次数前缀
const LOGIN_ATTEMPTS_PREFIX = 'login:attempts:';

// 最大登录失败次数
const MAX_LOGIN_ATTEMPTS = 5;

// 登录失败锁定时间（秒）
const LOGIN_LOCKOUT_DURATION = 900; // 15分钟

export const jwtUtils = {
  /**
   * 生成Access Token
   */
  generateAccessToken(payload: IJwtPayload): string {
    const { secret, expiresIn, algorithm, issuer, audience } = securityConfig.jwt.accessToken;
    return jwt.sign(payload as object, secret, {
      expiresIn: expiresIn as any,
      algorithm,
      issuer,
      audience,
    });
  },

  /**
   * 生成Refresh Token
   */
  generateRefreshToken(payload: IJwtPayload): string {
    const { secret, expiresIn, algorithm } = securityConfig.jwt.refreshToken;
    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' } as object,
      secret,
      {
        expiresIn: expiresIn as any,
        algorithm,
      }
    );

    // 存储Refresh Token到Redis
    this.storeRefreshToken(payload.userId, refreshToken);

    return refreshToken;
  },

  /**
   * 生成Token对（Access Token + Refresh Token）
   */
  generateTokenPair(payload: IJwtPayload): { accessToken: string; refreshToken: string } {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return { accessToken, refreshToken };
  },

  /**
   * 存储Refresh Token
   */
  async storeRefreshToken(userId: number, refreshToken: string): Promise<void> {
    try {
      const key = `${REFRESH_TOKEN_PREFIX}${userId}`;
      const expiresIn = this.getRefreshTokenExpirationTime();
      await redisUtils.set(key, refreshToken, expiresIn);
      logger.info(`Refresh token stored for user ${userId}`);
    } catch (error) {
      logger.error('Failed to store refresh token:', error);
    }
  },

  /**
   * 验证Refresh Token
   */
  async verifyRefreshToken(userId: number, refreshToken: string): Promise<boolean> {
    try {
      const key = `${REFRESH_TOKEN_PREFIX}${userId}`;
      const storedToken = await redisUtils.get(key);
      
      if (!storedToken || storedToken !== refreshToken) {
        return false;
      }

      // 验证Token有效性
      const { secret, algorithm } = securityConfig.jwt.refreshToken;
      jwt.verify(refreshToken, secret, { algorithms: [algorithm] });

      return true;
    } catch (error) {
      logger.error('Failed to verify refresh token:', error);
      return false;
    }
  },

  /**
   * 撤销Refresh Token
   */
  async revokeRefreshToken(userId: number): Promise<void> {
    try {
      const key = `${REFRESH_TOKEN_PREFIX}${userId}`;
      await redisUtils.del(key);
      logger.info(`Refresh token revoked for user ${userId}`);
    } catch (error) {
      logger.error('Failed to revoke refresh token:', error);
    }
  },

  /**
   * 生成JWT Token（向后兼容）
   */
  generateToken(payload: IJwtPayload): string {
    return this.generateAccessToken(payload);
  },

  /**
   * 验证Access Token
   */
  verifyAccessToken(token: string): IJwtPayload {
    try {
      const { secret, algorithm, issuer, audience } = securityConfig.jwt.accessToken;
      return jwt.verify(token, secret, {
        algorithms: [algorithm],
        issuer,
        audience,
      }) as IJwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token已过期');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('无效的Token');
      }
      throw new AuthenticationError('Token验证失败');
    }
  },

  /**
   * 验证JWT Token（向后兼容）
   */
  verifyToken(token: string): IJwtPayload {
    return this.verifyAccessToken(token);
  },

  /**
   * 解码JWT Token（不验证签名）
   */
  decodeToken(token: string): IJwtPayload | null {
    try {
      return jwt.decode(token) as IJwtPayload;
    } catch (error) {
      return null;
    }
  },

  /**
   * 将Token添加到黑名单
   */
  async blacklistToken(token: string): Promise<void> {
    try {
      const payload = this.decodeToken(token);
      if (!payload || !payload.exp) {
        return;
      }

      // 计算Token剩余有效期
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = payload.exp - now;

      if (expiresIn > 0) {
        // 将Token添加到Redis黑名单，设置过期时间与Token剩余有效期相同
        const blacklistKey = `${TOKEN_BLACKLIST_PREFIX}${token}`;
        await redisUtils.set(blacklistKey, 'blacklisted', expiresIn);
        logger.info(`Token blacklisted, expires in ${expiresIn} seconds`);
      }
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
      throw error;
    }
  },

  /**
   * 检查Token是否在黑名单中
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const blacklistKey = `${TOKEN_BLACKLIST_PREFIX}${token}`;
      const result = await redisUtils.get(blacklistKey);
      return result !== null;
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      // 如果Redis不可用，默认允许通过
      return false;
    }
  },

  /**
   * 记录登录失败次数
   */
  async recordLoginAttempt(username: string): Promise<number> {
    try {
      const attemptsKey = `${LOGIN_ATTEMPTS_PREFIX}${username}`;
      const attempts = await redisUtils.get(attemptsKey);
      const currentAttempts = attempts ? parseInt(attempts, 10) + 1 : 1;

      // 设置登录失败次数，15分钟后自动清除
      await redisUtils.set(attemptsKey, currentAttempts.toString(), LOGIN_LOCKOUT_DURATION);
      
      logger.info(`Login attempt recorded for ${username}: ${currentAttempts}/${MAX_LOGIN_ATTEMPTS}`);
      return currentAttempts;
    } catch (error) {
      logger.error('Failed to record login attempt:', error);
      // 如果Redis不可用，返回0（不限制）
      return 0;
    }
  },

  /**
   * 获取登录失败次数
   */
  async getLoginAttempts(username: string): Promise<number> {
    try {
      const attemptsKey = `${LOGIN_ATTEMPTS_PREFIX}${username}`;
      const attempts = await redisUtils.get(attemptsKey);
      return attempts ? parseInt(attempts, 10) : 0;
    } catch (error) {
      logger.error('Failed to get login attempts:', error);
      return 0;
    }
  },

  /**
   * 检查账户是否被锁定
   */
  async isAccountLocked(username: string): Promise<boolean> {
    try {
      const attempts = await this.getLoginAttempts(username);
      return attempts >= MAX_LOGIN_ATTEMPTS;
    } catch (error) {
      logger.error('Failed to check account lock status:', error);
      return false;
    }
  },

  /**
   * 清除登录失败次数
   */
  async clearLoginAttempts(username: string): Promise<void> {
    try {
      const attemptsKey = `${LOGIN_ATTEMPTS_PREFIX}${username}`;
      await redisUtils.del(attemptsKey);
      logger.info(`Login attempts cleared for ${username}`);
    } catch (error) {
      logger.error('Failed to clear login attempts:', error);
    }
  },

  /**
   * 获取Access Token过期时间（秒）
   */
  getTokenExpirationTime(): number {
    const expiresIn = securityConfig.jwt.accessToken.expiresIn;
    return this.parseExpirationTime(expiresIn);
  },

  /**
   * 获取Refresh Token过期时间（秒）
   */
  getRefreshTokenExpirationTime(): number {
    const expiresIn = securityConfig.jwt.refreshToken.expiresIn;
    return this.parseExpirationTime(expiresIn);
  },

  /**
   * 解析过期时间字符串
   */
  parseExpirationTime(expiresIn: string | number): number {
    if (typeof expiresIn === 'string') {
      // 解析时间字符串，如 '7d', '24h', '60m'
      const match = expiresIn.match(/^(\d+)([dhms])$/);
      if (!match) {
        return 7 * 24 * 60 * 60; // 默认7天
      }
      
      const value = parseInt(match[1], 10);
      const unit = match[2];
      
      switch (unit) {
        case 'd': return value * 24 * 60 * 60;
        case 'h': return value * 60 * 60;
        case 'm': return value * 60;
        case 's': return value;
        default: return 7 * 24 * 60 * 60;
      }
    }
    
    return expiresIn as number;
  },

  /**
   * 刷新Token对
   */
  async refreshTokenPair(userId: number, refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      // 验证Refresh Token
      const isValid = await this.verifyRefreshToken(userId, refreshToken);
      if (!isValid) {
        logger.warn(`Invalid refresh token for user ${userId}`);
        await securityAudit.log('token_refreshed', {
          userId,
          message: 'Refresh token验证失败',
          level: 'warn',
        });
        return null;
      }

      // 获取用户信息（这里需要从数据库获取，但为了简化，我们从Token中提取）
      const payload = jwt.decode(refreshToken) as IJwtPayload;
      if (!payload || payload.userId !== userId) {
        return null;
      }

      // 生成新的Token对
      const newTokenPair = this.generateTokenPair({
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
      });

      // 记录审计日志
      await securityAudit.log('token_refreshed', {
        userId,
        username: payload.username,
        message: 'Token刷新成功',
      });

      return newTokenPair;
    } catch (error) {
      logger.error('Failed to refresh token pair:', error);
      return null;
    }
  },
};

export default jwtUtils;