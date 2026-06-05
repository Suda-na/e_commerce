import { Request, Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import { AuthorizationError, AuthenticationError } from '../middleware/errorHandler';
import { logger } from './logger';
import { securityAudit } from './security-audit';

/**
 * 权限控制工具类
 * 实现细粒度的权限控制
 */

// 权限类型
export type Permission = 
  | 'user:read'
  | 'user:write'
  | 'user:delete'
  | 'product:read'
  | 'product:write'
  | 'product:delete'
  | 'auction:read'
  | 'auction:write'
  | 'auction:delete'
  | 'auction:start'
  | 'auction:end'
  | 'bid:read'
  | 'bid:write'
  | 'order:read'
  | 'order:write'
  | 'order:delete'
  | 'admin:read'
  | 'admin:write'
  | 'admin:delete'
  | 'system:config'
  | 'system:monitor';

// 资源类型
export type ResourceType = 'user' | 'product' | 'auction' | 'bid' | 'order' | 'system';

// 操作类型
export type ActionType = 'read' | 'write' | 'delete' | 'create' | 'update' | 'manage';

// 角色权限映射
const rolePermissions: Record<UserRole, Permission[]> = {
  user: [
    'user:read',
    'user:write',
    'product:read',
    'auction:read',
    'bid:read',
    'bid:write',
    'order:read',
    'order:write',
  ],
  merchant: [
    'user:read',
    'user:write',
    'product:read',
    'product:write',
    'product:delete',
    'auction:read',
    'auction:write',
    'auction:delete',
    'auction:start',
    'auction:end',
    'bid:read',
    'order:read',
    'order:write',
  ],
  admin: [
    'user:read',
    'user:write',
    'user:delete',
    'product:read',
    'product:write',
    'product:delete',
    'auction:read',
    'auction:write',
    'auction:delete',
    'auction:start',
    'auction:end',
    'bid:read',
    'bid:write',
    'order:read',
    'order:write',
    'order:delete',
    'admin:read',
    'admin:write',
    'admin:delete',
    'system:config',
    'system:monitor',
  ],
};

/**
 * 权限管理器
 */
export const permissionManager = {
  /**
   * 检查用户是否拥有指定权限
   */
  hasPermission(userRole: UserRole, permission: Permission): boolean {
    const permissions = rolePermissions[userRole] || [];
    return permissions.includes(permission);
  },

  /**
   * 检查用户是否拥有所有指定权限
   */
  hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(userRole, permission));
  },

  /**
   * 检查用户是否拥有任一指定权限
   */
  hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(userRole, permission));
  },

  /**
   * 获取角色的所有权限
   */
  getRolePermissions(role: UserRole): Permission[] {
    return rolePermissions[role] || [];
  },

  /**
   * 检查资源访问权限
   */
  async checkResourceAccess(
    userId: number,
    userRole: UserRole,
    resourceType: ResourceType,
    resourceId: number,
    action: ActionType
  ): Promise<boolean> {
    // 管理员拥有所有权限
    if (userRole === 'admin') {
      return true;
    }

    // 检查基本权限
    const permission = `${resourceType}:${action}` as Permission;
    if (!this.hasPermission(userRole, permission)) {
      return false;
    }

    // 检查资源所有权（对于非管理员用户）
    switch (resourceType) {
      case 'user':
        // 用户只能修改自己的信息
        return action === 'read' || userId === resourceId;
      
      case 'product':
        // 商家只能管理自己的商品
        return await this.checkProductOwnership(userId, resourceId);
      
      case 'auction':
        // 商家只能管理自己的竞拍
        return await this.checkAuctionOwnership(userId, resourceId);
      
      case 'order':
        // 用户只能查看自己的订单
        return await this.checkOrderOwnership(userId, resourceId);
      
      case 'bid':
        // 用户只能查看自己的出价
        return await this.checkBidOwnership(userId, resourceId);
      
      default:
        return false;
    }
  },

  /**
   * 检查商品所有权
   */
  async checkProductOwnership(userId: number, productId: number): Promise<boolean> {
    // 这里应该查询数据库检查商品所有权
    // 简化实现，实际应该查询数据库
    return true;
  },

  /**
   * 检查竞拍所有权
   */
  async checkAuctionOwnership(userId: number, auctionId: number): Promise<boolean> {
    // 这里应该查询数据库检查竞拍所有权
    return true;
  },

  /**
   * 检查订单所有权
   */
  async checkOrderOwnership(userId: number, orderId: number): Promise<boolean> {
    // 这里应该查询数据库检查订单所有权
    return true;
  },

  /**
   * 检查出价所有权
   */
  async checkBidOwnership(userId: number, bidId: number): Promise<boolean> {
    // 这里应该查询数据库检查出价所有权
    return true;
  },
};

/**
 * 权限检查中间件工厂
 */
export const requirePermission = (...permissions: Permission[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const hasPermission = permissionManager.hasAllPermissions(req.user.role, permissions);
      
      if (!hasPermission) {
        // 记录权限拒绝事件
        await securityAudit.log('permission_denied', {
          userId: req.user.userId,
          username: req.user.username,
          userRole: req.user.role,
          ip: req.ip,
          url: req.url,
          method: req.method,
          details: {
            requiredPermissions: permissions,
            userPermissions: permissionManager.getRolePermissions(req.user.role),
          },
        });

        throw new AuthorizationError(`需要以下权限: ${permissions.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 资源访问权限检查中间件工厂
 */
export const requireResourceAccess = (
  resourceType: ResourceType,
  action: ActionType,
  getResourceId?: (req: AuthRequest) => number
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const resourceId = getResourceId ? getResourceId(req) : parseInt(req.params.id, 10);
      
      if (isNaN(resourceId)) {
        throw new AuthorizationError('无效的资源ID');
      }

      const hasAccess = await permissionManager.checkResourceAccess(
        req.user.userId,
        req.user.role,
        resourceType,
        resourceId,
        action
      );

      if (!hasAccess) {
        // 记录权限拒绝事件
        await securityAudit.log('permission_denied', {
          userId: req.user.userId,
          username: req.user.username,
          userRole: req.user.role,
          ip: req.ip,
          url: req.url,
          method: req.method,
          details: {
            resourceType,
            resourceId,
            action,
          },
        });

        throw new AuthorizationError('没有访问此资源的权限');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 角色检查中间件工厂
 */
export const requireRole = (...roles: UserRole[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      if (!roles.includes(req.user.role)) {
        // 记录权限拒绝事件
        await securityAudit.log('permission_denied', {
          userId: req.user.userId,
          username: req.user.username,
          userRole: req.user.role,
          ip: req.ip,
          url: req.url,
          method: req.method,
          details: {
            requiredRoles: roles,
            userRole: req.user.role,
          },
        });

        throw new AuthorizationError(`需要以下角色之一: ${roles.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 资源所有者检查中间件工厂
 */
export const requireOwnership = (
  getResourceOwnerId: (req: AuthRequest) => Promise<number | null>
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 管理员可以访问任何资源
      if (req.user.role === 'admin') {
        next();
        return;
      }

      const ownerId = await getResourceOwnerId(req);
      
      if (ownerId === null) {
        throw new AuthorizationError('资源不存在');
      }

      if (ownerId !== req.user.userId) {
        // 记录权限拒绝事件
        await securityAudit.log('permission_denied', {
          userId: req.user.userId,
          username: req.user.username,
          userRole: req.user.role,
          ip: req.ip,
          url: req.url,
          method: req.method,
          details: {
            resourceOwnerId: ownerId,
            userId: req.user.userId,
          },
        });

        throw new AuthorizationError('只能访问自己的资源');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 条件权限检查中间件
 */
export const conditionalPermission = (
  condition: (req: AuthRequest) => boolean,
  permission: Permission
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 如果条件不满足，跳过权限检查
      if (!condition(req)) {
        next();
        return;
      }

      // 检查权限
      if (!permissionManager.hasPermission(req.user.role, permission)) {
        await securityAudit.log('permission_denied', {
          userId: req.user.userId,
          username: req.user.username,
          userRole: req.user.role,
          ip: req.ip,
          url: req.url,
          method: req.method,
          details: {
            requiredPermission: permission,
            condition: 'conditional',
          },
        });

        throw new AuthorizationError(`需要权限: ${permission}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 多条件权限检查中间件
 */
export const complexPermission = (rules: Array<{
  condition: (req: AuthRequest) => boolean;
  permissions: Permission[];
  operator: 'and' | 'or';
}>) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 检查所有规则
      for (const rule of rules) {
        if (!rule.condition(req)) {
          continue;
        }

        let hasPermission: boolean;
        if (rule.operator === 'and') {
          hasPermission = permissionManager.hasAllPermissions(req.user.role, rule.permissions);
        } else {
          hasPermission = permissionManager.hasAnyPermission(req.user.role, rule.permissions);
        }

        if (!hasPermission) {
          await securityAudit.log('permission_denied', {
            userId: req.user.userId,
            username: req.user.username,
            userRole: req.user.role,
            ip: req.ip,
            url: req.url,
            method: req.method,
            details: {
              requiredPermissions: rule.permissions,
              operator: rule.operator,
            },
          });

          throw new AuthorizationError(`需要权限: ${rule.permissions.join(', ')}`);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default permissionManager;