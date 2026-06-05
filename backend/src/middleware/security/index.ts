/**
 * 安全中间件索引
 * 整合所有安全相关的中间件
 */

// 导入安全配置
import { securityConfig } from '../../config/security.config';

// 导入安全中间件
import {
  securityHeaders,
  httpsRedirect,
  requestId,
  requestLogger,
  inputValidation,
  csrfProtection,
  signatureVerification,
  connectionLimit,
  ipBlacklist,
  userAgentValidation,
  distributedRateLimit,
  securityAuditLogger,
  comprehensiveSecurity,
} from '../security.middleware';

// 导入认证中间件
import { authenticate, authorize, optionalAuth, ownerOnly } from '../auth';

// 导入速率限制中间件
import { rateLimiter, strictRateLimiter, loginRateLimiter, apiRateLimiter } from '../rateLimiter';

// 导入错误处理中间件
import { errorHandler, asyncHandler, notFoundHandler } from '../errorHandler';

/**
 * 安全中间件集合
 */
export const securityMiddleware = {
  // 安全头中间件
  securityHeaders,

  // HTTPS重定向中间件
  httpsRedirect,

  // 请求ID中间件
  requestId,

  // 请求日志中间件
  requestLogger,

  // 输入验证中间件
  inputValidation,

  // CSRF防护中间件
  csrfProtection,

  // 签名验证中间件
  signatureVerification,

  // 连接限制中间件
  connectionLimit,

  // IP黑名单中间件
  ipBlacklist,

  // 用户代理验证中间件
  userAgentValidation,

  // 分布式速率限制中间件
  distributedRateLimit,

  // 安全审计日志中间件
  securityAuditLogger,

  // 综合安全中间件
  comprehensiveSecurity,

  // 认证中间件
  authenticate,
  authorize,
  optionalAuth,
  ownerOnly,

  // 速率限制中间件
  rateLimiter,
  strictRateLimiter,
  loginRateLimiter,
  apiRateLimiter,

  // 错误处理中间件
  errorHandler,
  asyncHandler,
  notFoundHandler,

  /**
   * 创建安全中间件链
   */
  createSecurityChain(options: {
    enableSecurityHeaders?: boolean;
    enableHttpsRedirect?: boolean;
    enableRequestId?: boolean;
    enableRequestLogger?: boolean;
    enableInputValidation?: boolean;
    enableCsrfProtection?: boolean;
    enableSignatureVerification?: boolean;
    enableConnectionLimit?: boolean;
    enableIpBlacklist?: boolean;
    enableUserAgentValidation?: boolean;
    enableRateLimit?: boolean;
    enableSecurityAudit?: boolean;
    rateLimitOptions?: {
      windowMs?: number;
      max?: number;
    };
  } = {}) {
    const middlewares: any[] = [];
    const {
      enableSecurityHeaders = true,
      enableHttpsRedirect = true,
      enableRequestId = true,
      enableRequestLogger = true,
      enableInputValidation = true,
      enableCsrfProtection = true,
      enableSignatureVerification = true,
      enableConnectionLimit = true,
      enableIpBlacklist = true,
      enableUserAgentValidation = true,
      enableRateLimit = true,
      enableSecurityAudit = true,
      rateLimitOptions,
    } = options;

    // 按顺序添加中间件
    if (enableRequestId) middlewares.push(requestId);
    if (enableRequestLogger) middlewares.push(requestLogger);
    if (enableSecurityHeaders) middlewares.push(securityHeaders);
    if (enableHttpsRedirect) middlewares.push(httpsRedirect);
    if (enableUserAgentValidation) middlewares.push(userAgentValidation);
    if (enableSecurityAudit) middlewares.push(securityAuditLogger);
    if (enableInputValidation) middlewares.push(inputValidation);
    if (enableCsrfProtection) middlewares.push(csrfProtection);
    if (enableSignatureVerification) middlewares.push(signatureVerification);
    if (enableConnectionLimit) middlewares.push(connectionLimit);
    if (enableRateLimit) {
      if (rateLimitOptions) {
        middlewares.push(distributedRateLimit({
          windowMs: rateLimitOptions.windowMs || securityConfig.apiSecurity.rateLimit.global.windowMs,
          max: rateLimitOptions.max || securityConfig.apiSecurity.rateLimit.global.max,
        }));
      } else {
        middlewares.push(rateLimiter);
      }
    }

    return middlewares;
  },

  /**
   * 创建认证中间件链
   */
  createAuthChain(options: {
    requireAuth?: boolean;
    roles?: string[];
    permissions?: string[];
    resourceType?: string;
    action?: string;
  } = {}) {
    const middlewares: any[] = [];
    const {
      requireAuth = true,
      roles,
      permissions,
      resourceType,
      action,
    } = options;

    if (requireAuth) {
      middlewares.push(authenticate);
    }

    if (roles && roles.length > 0) {
      middlewares.push(authorize(...roles as any[]));
    }

    return middlewares;
  },

  /**
   * 创建速率限制中间件
   */
  createRateLimit(options: {
    windowMs?: number;
    max?: number;
    keyGenerator?: (req: any) => string;
    message?: string;
  } = {}) {
    return distributedRateLimit({
      windowMs: options.windowMs || securityConfig.apiSecurity.rateLimit.global.windowMs,
      max: options.max || securityConfig.apiSecurity.rateLimit.global.max,
      keyGenerator: options.keyGenerator,
      message: options.message,
    });
  },

  /**
   * 创建IP黑名单中间件
   */
  createIpBlacklist(blacklistedIps: string[] = []) {
    return ipBlacklist(blacklistedIps);
  },

  /**
   * 创建资源访问中间件
   */
  createResourceAccess(options: {
    resourceType: string;
    action: string;
    getResourceId?: (req: any) => number;
  }) {
    return [
      authenticate,
      // 这里可以添加更复杂的资源访问控制逻辑
    ];
  },
};

// 导出所有安全中间件
export {
  // 安全头中间件
  securityHeaders,
  httpsRedirect,
  requestId,
  requestLogger,
  inputValidation,
  csrfProtection,
  signatureVerification,
  connectionLimit,
  ipBlacklist,
  userAgentValidation,
  distributedRateLimit,
  securityAuditLogger,
  comprehensiveSecurity,

  // 认证中间件
  authenticate,
  authorize,
  optionalAuth,
  ownerOnly,

  // 速率限制中间件
  rateLimiter,
  strictRateLimiter,
  loginRateLimiter,
  apiRateLimiter,

  // 错误处理中间件
  errorHandler,
  asyncHandler,
  notFoundHandler,
};

export default securityMiddleware;