import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { jwtUtils } from '../utils/jwt';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { AuthRequest, UserRole } from '../types';
import { logger } from '../utils/logger';

/**
 * 认证中间件
 * 验证JWT Token并提取用户信息
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 从请求头获取Token
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AuthenticationError('未提供认证Token');
    }

    // 检查Token格式
    if (!authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Token格式无效');
    }

    const token = authHeader.substring(7); // 移除 'Bearer ' 前缀

    if (!token) {
      throw new AuthenticationError('Token为空');
    }

    // 检查Token是否在黑名单中
    const isBlacklisted = await jwtUtils.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new AuthenticationError('Token已失效，请重新登录');
    }

    // 验证Token并获取用户信息
    const payload = authService.verifyToken(token);
    
    // 将用户信息添加到请求对象
    req.user = payload;
    
    logger.debug(`Authenticated user: ${payload.username} (${payload.role})`);
    
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      next(error);
    } else {
      logger.error('Authentication error:', error);
      next(new AuthenticationError('认证失败'));
    }
  }
};

/**
 * 角色授权中间件
 * 检查用户是否具有指定角色
 */
export const authorize = (...roles: UserRole[]) => {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      if (!roles.includes(req.user.role)) {
        throw new AuthorizationError(`需要以下角色之一: ${roles.join(', ')}`);
      }

      logger.debug(`Authorized user: ${req.user.username} with role: ${req.user.role}`);
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 可选认证中间件
 * 如果提供了Token则验证，否则继续
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        try {
          // 检查Token是否在黑名单中
          const isBlacklisted = await jwtUtils.isTokenBlacklisted(token);
          if (!isBlacklisted) {
            const payload = authService.verifyToken(token);
            req.user = payload;
          } else {
            logger.debug('Optional auth: Token blacklisted, continuing without auth');
          }
        } catch (error) {
          // Token无效，但不阻止请求
          logger.debug('Optional auth: Invalid token, continuing without auth');
        }
      }
    }
    
    next();
  } catch (error) {
    // 继续执行，不阻止请求
    next();
  }
};

/**
 * 资源所有者中间件
 * 检查用户是否为资源所有者
 */
export const ownerOnly = (
  getResourceOwnerId: (req: AuthRequest) => Promise<number | null>
) => {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 管理员可以访问任何资源
      if (req.user.role === 'merchant') {
        next();
        return;
      }

      const ownerId = await getResourceOwnerId(req);
      
      if (ownerId === null) {
        throw new AuthorizationError('资源不存在');
      }

      if (ownerId !== req.user.userId) {
        throw new AuthorizationError('只能访问自己的资源');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default { authenticate, authorize, optionalAuth, ownerOnly };