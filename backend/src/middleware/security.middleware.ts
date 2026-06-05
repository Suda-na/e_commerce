import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { securityConfig } from '../config/security.config';
import { logger } from '../utils/logger';
import { redisUtils } from '../config/redis';
import { AppError, ValidationError } from './errorHandler';

/**
 * 安全中间件集合
 */

// 扩展Request接口以包含安全相关信息
declare global {
  namespace Express {
    interface Request {
      security?: {
        requestId: string;
        timestamp: number;
        nonce?: string;
        signature?: string;
        clientIp: string;
        userAgent: string;
      };
    }
  }
}

/**
 * 安全头中间件
 * 设置各种安全相关的HTTP头
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  const { securityHeaders: headersConfig } = securityConfig;

  // Content Security Policy
  if (headersConfig.csp.enabled) {
    const directives = Object.entries(headersConfig.csp.directives)
      .map(([key, values]) => {
        const directiveName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${directiveName} ${values.join(' ')}`;
      })
      .join('; ');
    res.setHeader('Content-Security-Policy', directives);
  }

  // X-Frame-Options
  res.setHeader('X-Frame-Options', headersConfig.frameOptions);

  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', headersConfig.contentTypeOptions);

  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', headersConfig.xssProtection);

  // Referrer-Policy
  res.setHeader('Referrer-Policy', headersConfig.referrerPolicy);

  // Permissions-Policy
  const permissions = Object.entries(headersConfig.permissionsPolicy)
    .map(([key, values]) => `${key}=(${values.join(' ')})`)
    .join(', ');
  res.setHeader('Permissions-Policy', permissions);

  // HSTS (仅在HTTPS环境下)
  if (securityConfig.https.hsts.enabled && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
    const hstsValue = `max-age=${securityConfig.https.hsts.maxAge}${securityConfig.https.hsts.includeSubDomains ? '; includeSubDomains' : ''}${securityConfig.https.hsts.preload ? '; preload' : ''}`;
    res.setHeader('Strict-Transport-Security', hstsValue);
  }

  // 移除X-Powered-By头
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * HTTPS重定向中间件
 */
export const httpsRedirect = (req: Request, res: Response, next: NextFunction): void => {
  if (securityConfig.https.forceHttps && !req.secure && req.headers['x-forwarded-proto'] !== 'https') {
    const httpsUrl = `https://${req.hostname}${req.url}`;
    return res.redirect(301, httpsUrl);
  }
  next();
};

/**
 * 请求ID中间件
 * 为每个请求生成唯一ID，用于追踪和日志
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.security = {
    requestId,
    timestamp: Date.now(),
    clientIp: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
  };
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * 请求日志中间件
 * 记录请求和响应信息
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // 记录请求开始
  logger.info('Request started', {
    requestId: req.security?.requestId,
    method: req.method,
    url: req.url,
    ip: req.security?.clientIp,
    userAgent: req.security?.userAgent,
    timestamp: new Date().toISOString(),
  });

  // 监听响应结束事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      requestId: req.security?.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.security?.clientIp,
      userAgent: req.security?.userAgent,
    };

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

/**
 * 输入验证中间件
 * 验证请求参数，防止注入攻击
 */
export const inputValidation = (req: Request, res: Response, next: NextFunction): void => {
  const { inputValidation: validationConfig } = securityConfig;

  try {
    // 验证URL长度
    if (req.url.length > validationConfig.maxUrlLength) {
      throw new ValidationError('URL长度超过限制');
    }

    // 验证查询参数
    const queryString = JSON.stringify(req.query);
    if (queryString.length > validationConfig.maxQueryLength) {
      throw new ValidationError('查询参数长度超过限制');
    }

    // 验证请求体
    if (req.body) {
      const bodyString = JSON.stringify(req.body);
      if (bodyString.length > 10 * 1024 * 1024) { // 10MB
        throw new ValidationError('请求体大小超过限制');
      }
    }

    // SQL注入检测 - 仅对查询参数和路径参数进行检测，不对请求体进行关键词检测
    // 因为请求体可能包含合法的用户数据（如地址、描述等）
    if (validationConfig.sqlInjection.enabled) {
      // 只检查查询参数和路径参数
      const queryParams = JSON.stringify(req.query);
      const pathParams = JSON.stringify(req.params);
      const checkData = `${queryParams} ${pathParams}`.toUpperCase();

      // 检查SQL注入模式，而不是简单的关键词
      const sqlInjectionPatterns = [
        /'\s*(OR|AND)\s*'?\d/i,           // ' OR '1'='1 或 ' AND 1=1
        /'\s*(OR|AND)\s*'?\w/i,           // ' OR 'x'='x
        /;\s*(DROP|DELETE|INSERT|UPDATE)\s/i,  // ; DROP TABLE
        /UNION\s+(ALL\s+)?SELECT/i,       // UNION SELECT 或 UNION ALL SELECT
        /--\s*$/,                          // 行注释
        /\/\*[\s\S]*?\*\//,               // 块注释
        /'\s*;\s*--/,                      // '; --
        /EXEC(\s|\()+/i,                  // EXEC 或 EXEC(
        /xp_cmdshell/i,                    // xp_cmdshell
        /sp_executesql/i,                  // sp_executesql
      ];

      for (const pattern of sqlInjectionPatterns) {
        if (pattern.test(checkData)) {
          logger.warn('Potential SQL injection attempt detected', {
            requestId: req.security?.requestId,
            ip: req.security?.clientIp,
            pattern: pattern.toString(),
            url: req.url,
          });
          throw new ValidationError('请求包含非法字符');
        }
      }
    }

    // XSS检测
    if (validationConfig.xss.enabled) {
      const requestData = JSON.stringify({
        query: req.query,
        params: req.params,
        body: req.body,
      });

      // 检测常见的XSS攻击模式
      const xssPatterns = [
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
      ];

      for (const pattern of xssPatterns) {
        if (pattern.test(requestData)) {
          logger.warn('Potential XSS attempt detected', {
            requestId: req.security?.requestId,
            ip: req.security?.clientIp,
            url: req.url,
          });
          throw new ValidationError('请求包含非法字符');
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * CSRF防护中间件
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  const { csrf: csrfConfig } = securityConfig;

  // 如果CSRF防护未启用，直接跳过
  if (!csrfConfig.enabled) {
    return next();
  }

  // 跳过不需要CSRF保护的路径
  if (csrfConfig.ignorePaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // 跳过GET、HEAD、OPTIONS请求
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // 检查CSRF Token
  const token = req.headers[csrfConfig.token.headerName.toLowerCase()] as string ||
                req.body?._csrf ||
                req.query._csrf as string;

  if (!token) {
    logger.warn('CSRF token missing', {
      requestId: req.security?.requestId,
      ip: req.security?.clientIp,
      url: req.url,
    });
    throw new AppError('CSRF token缺失', 403, 'CSRF_TOKEN_MISSING');
  }

  // 验证CSRF Token（这里简化处理，实际应该验证Token的有效性）
  // 在实际应用中，应该使用加密的Token或存储在Session中的Token
  const cookieToken = req.cookies?.[csrfConfig.token.cookieName];
  if (!cookieToken || token !== cookieToken) {
    logger.warn('CSRF token validation failed', {
      requestId: req.security?.requestId,
      ip: req.security?.clientIp,
      url: req.url,
    });
    throw new AppError('CSRF token无效', 403, 'CSRF_TOKEN_INVALID');
  }

  next();
};

/**
 * 请求签名验证中间件
 * 验证API请求签名，防止篡改
 */
export const signatureVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { signature: signatureConfig } = securityConfig.apiSecurity;

  // 如果未启用签名验证，跳过
  if (!signatureConfig.enabled) {
    return next();
  }

  // 检查是否需要签名验证的路径
  const requiresSignature = signatureConfig.requiredPaths.some(path => req.path.startsWith(path));
  if (!requiresSignature) {
    return next();
  }

  try {
    const timestamp = req.headers['x-timestamp'] as string;
    const nonce = req.headers['x-nonce'] as string;
    const signature = req.headers['x-signature'] as string;

    if (!timestamp || !nonce || !signature) {
      throw new AppError('请求签名信息不完整', 400, 'SIGNATURE_INCOMPLETE');
    }

    // 验证时间戳
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - requestTime) > signatureConfig.timestampTolerance) {
      throw new AppError('请求已过期', 400, 'REQUEST_EXPIRED');
    }

    // 验证重放攻击（检查nonce是否已使用）
    if (securityConfig.apiSecurity.replayAttack.enabled) {
      const nonceKey = `${securityConfig.apiSecurity.replayAttack.noncePrefix}${nonce}`;
      const nonceExists = await redisUtils.get(nonceKey);
      if (nonceExists) {
        logger.warn('Replay attack attempt detected', {
          requestId: req.security?.requestId,
          ip: req.security?.clientIp,
          nonce,
        });
        throw new AppError('请求nonce已使用', 400, 'NONCE_ALREADY_USED');
      }

      // 存储nonce，防止重放
      await redisUtils.set(nonceKey, '1', securityConfig.apiSecurity.replayAttack.nonceTtl);
    }

    // 构建签名字符串
    const method = req.method.toUpperCase();
    const path = req.url;
    const body = req.body ? JSON.stringify(req.body) : '';
    const signString = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}`;

    // 计算签名
    const expectedSignature = crypto
      .createHmac(signatureConfig.algorithm, signatureConfig.secret)
      .update(signString)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Signature verification failed', {
        requestId: req.security?.requestId,
        ip: req.security?.clientIp,
        url: req.url,
      });
      throw new AppError('请求签名验证失败', 400, 'SIGNATURE_INVALID');
    }

    // 存储签名信息
    req.security = {
      ...req.security!,
      timestamp: requestTime,
      nonce,
      signature,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 连接限制中间件
 */
export const connectionLimit = (() => {
  const connections = new Map<string, number>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.security?.clientIp || 'unknown';
    const currentConnections = connections.get(clientIp) || 0;

    if (currentConnections >= securityConfig.websocket.connectionLimit.maxConnectionsPerIp) {
      logger.warn('Connection limit exceeded', {
        requestId: req.security?.requestId,
        ip: clientIp,
        connections: currentConnections,
      });
      throw new AppError('连接数超过限制', 429, 'CONNECTION_LIMIT_EXCEEDED');
    }

    connections.set(clientIp, currentConnections + 1);

    // 响应结束时减少连接数
    res.on('finish', () => {
      const count = connections.get(clientIp) || 1;
      if (count <= 1) {
        connections.delete(clientIp);
      } else {
        connections.set(clientIp, count - 1);
      }
    });

    next();
  };
})();

/**
 * IP黑名单中间件
 */
export const ipBlacklist = (blacklistedIps: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.security?.clientIp || 'unknown';

    if (blacklistedIps.includes(clientIp)) {
      logger.warn('Blocked blacklisted IP', {
        requestId: req.security?.requestId,
        ip: clientIp,
      });
      throw new AppError('访问被拒绝', 403, 'IP_BLACKLISTED');
    }

    next();
  };
};

/**
 * 用户代理验证中间件
 */
export const userAgentValidation = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.get('User-Agent');

  if (!userAgent) {
    logger.warn('Missing User-Agent header', {
      requestId: req.security?.requestId,
      ip: req.security?.clientIp,
    });
    // 不阻止请求，但记录日志
  }

  // 检测可疑的User-Agent
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
    /go-http/i,
  ];

  if (userAgent && suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    logger.info('Suspicious User-Agent detected', {
      requestId: req.security?.requestId,
      ip: req.security?.clientIp,
      userAgent,
    });
    // 可以选择阻止或限制这些请求
  }

  next();
};

/**
 * 请求速率限制中间件（基于Redis的分布式限制）
 */
export const distributedRateLimit = (options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}) => {
  const { windowMs, max, keyGenerator, message } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyGenerator ? keyGenerator(req) : `rate_limit:${req.security?.clientIp}`;
    const windowKey = `${key}:${Math.floor(Date.now() / windowMs)}`;

    try {
      const current = await redisUtils.get(windowKey);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= max) {
        // 获取剩余锁定时间
        const remainingSeconds = Math.ceil(await redisUtils.ttl(windowKey));
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        const remainingSecs = remainingSeconds % 60;
        const timeStr = remainingMinutes > 0
          ? `${remainingMinutes}分${remainingSecs}秒`
          : `${remainingSecs}秒`;

        logger.warn('Rate limit exceeded', {
          requestId: req.security?.requestId,
          ip: req.security?.clientIp,
          count,
          max,
          remainingSeconds,
        });
        throw new AppError(`${message || '请求过于频繁'}，请在${timeStr}后重试`, 429, 'RATE_LIMIT_EXCEEDED');
      }

      // 增加计数
      await redisUtils.set(windowKey, (count + 1).toString(), Math.ceil(windowMs / 1000));

      // 设置响应头
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - count - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + windowMs) / 1000));

      next();
    } catch (error: any) {
      logger.error('Rate limit middleware error', { 
        message: error.message, 
        name: error.name,
        key: windowKey,
        path: req.path,
      });
      // If Redis fails, allow the request to proceed (fail open)
      if (error.message && (error.message.includes('Redis') || error.message.includes('ECONNREFUSED') || error.message.includes('Connection'))) {
        logger.warn('Redis error in rate limiter, allowing request to proceed');
        next();
      } else {
        next(error);
      }
    }
  };
};

/**
 * 安全审计日志中间件
 */
export const securityAuditLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // 记录安全相关请求
  const securityEvents = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/auth/change-password',
    '/api/auth/reset-password',
  ];

  const isSecurityRequest = securityEvents.some(event => req.path.startsWith(event));

  if (isSecurityRequest) {
    logger.info('Security event request', {
      requestId: req.security?.requestId,
      event: 'security_request',
      method: req.method,
      url: req.url,
      ip: req.security?.clientIp,
      userAgent: req.security?.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  // 监听响应结束事件
  res.on('finish', () => {
    if (isSecurityRequest) {
      const duration = Date.now() - startTime;
      logger.info('Security event response', {
        requestId: req.security?.requestId,
        event: 'security_response',
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.security?.clientIp,
      });
    }
  });

  next();
};

/**
 * 综合安全中间件
 * 将所有安全中间件组合在一起
 */
export const comprehensiveSecurity = [
  requestId,
  requestLogger,
  securityHeaders,
  httpsRedirect,
  userAgentValidation,
  securityAuditLogger,
  inputValidation,
];

export default {
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
};