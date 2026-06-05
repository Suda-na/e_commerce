/**
 * 安全配置文件
 * 整合所有安全相关的配置
 */

import { securityConfig, validateSecurityConfig } from './security.config';

// 重新导出安全配置
export { securityConfig, validateSecurityConfig };

// 安全配置常量
export const SECURITY_CONSTANTS = {
  // JWT相关
  JWT: {
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    ALGORITHM: 'HS256',
    ISSUER: 'auction-system',
    AUDIENCE: 'auction-users',
  },

  // 密码策略
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    SALT_ROUNDS: 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
  },

  // 账户锁定
  ACCOUNT_LOCKOUT: {
    MAX_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60, // 15分钟
    PROGRESSIVE_LOCKOUT: true,
    LOCKOUT_MULTIPLIER: 2,
  },

  // 频率限制
  RATE_LIMIT: {
    GLOBAL_WINDOW_MS: 15 * 60 * 1000, // 15分钟
    GLOBAL_MAX: 100,
    LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15分钟
    LOGIN_MAX: 5,
    REGISTER_WINDOW_MS: 60 * 60 * 1000, // 1小时
    REGISTER_MAX: 3,
    API_WINDOW_MS: 60 * 1000, // 1分钟
    API_MAX: 60,
  },

  // 输入验证
  INPUT_VALIDATION: {
    MAX_BODY_SIZE: '10mb',
    MAX_URL_LENGTH: 2048,
    MAX_QUERY_LENGTH: 1024,
    XSS_ENABLED: true,
    SQL_INJECTION_ENABLED: true,
  },

  // CSRF防护
  CSRF: {
    ENABLED: true,
    TOKEN_LENGTH: 64,
    TOKEN_TTL: 3600, // 1小时
    HEADER_NAME: 'X-CSRF-Token',
    COOKIE_NAME: 'csrf-token',
    HTTP_ONLY: true,
    SECURE: process.env.NODE_ENV === 'production',
    SAME_SITE: 'strict',
  },

  // 安全头
  SECURITY_HEADERS: {
    FRAME_OPTIONS: 'DENY',
    CONTENT_TYPE_OPTIONS: 'nosniff',
    XSS_PROTECTION: '1; mode=block',
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
    HSTS_MAX_AGE: 31536000, // 1年
    HSTS_INCLUDE_SUBDOMAINS: true,
    HSTS_PRELOAD: true,
  },

  // 审计日志
  AUDIT: {
    ENABLED: true,
    RETENTION_DAYS: 90,
    MAX_FILE_SIZE: 50, // MB
    MAX_FILES: 10,
  },

  // WebSocket安全
  WEBSOCKET: {
    MAX_CONNECTIONS_PER_IP: 5,
    MAX_TOTAL_CONNECTIONS: 1000,
    CONNECTION_TIMEOUT: 10000, // 10秒
    MAX_MESSAGES_PER_MINUTE: 60,
    MAX_MESSAGE_SIZE: 1024 * 10, // 10KB
  },

  // 数据加密
  DATA_ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    IV_LENGTH: 16,
    AUTH_TAG_LENGTH: 16,
  },

  // 日志脱敏
  LOG_SANITIZATION: {
    SENSITIVE_FIELDS: [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
      'session',
      'credit_card',
      'ssn',
      'phone',
      'email',
      'address',
      'id_card',
      'passport',
    ],
    MASK_CHAR: '*',
    MASK_LENGTH: 4,
  },
};

// 安全配置验证器
export const securityConfigValidator = {
  /**
   * 验证JWT配置
   */
  validateJwtConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { jwt } = securityConfig;

    if (!jwt.accessToken.secret || jwt.accessToken.secret === 'default_jwt_secret') {
      errors.push('JWT_ACCESS_TOKEN_SECRET未设置或使用默认值');
    }

    if (!jwt.refreshToken.secret || jwt.refreshToken.secret === 'default_refresh_secret') {
      errors.push('JWT_REFRESH_TOKEN_SECRET未设置或使用默认值');
    }

    if (jwt.accessToken.secret === jwt.refreshToken.secret) {
      errors.push('JWT_ACCESS_TOKEN_SECRET和JWT_REFRESH_TOKEN_SECRET不能相同');
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * 验证加密配置
   */
  validateEncryptionConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { dataSecurity } = securityConfig;

    if (dataSecurity.encryption.enabled && !dataSecurity.encryption.key) {
      errors.push('数据加密已启用但未配置加密密钥');
    }

    if (dataSecurity.encryption.key && dataSecurity.encryption.key.length !== 64) {
      errors.push('加密密钥长度必须为64字符（32字节十六进制）');
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * 验证HTTPS配置
   */
  validateHttpsConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { https } = securityConfig;

    if (https.forceHttps && process.env.NODE_ENV === 'production') {
      if (!https.ssl.key || !https.ssl.cert) {
        errors.push('生产环境启用HTTPS但未配置SSL证书');
      }
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * 验证所有安全配置
   */
  validateAll(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const jwtValidation = this.validateJwtConfig();
    if (!jwtValidation.valid) {
      errors.push(...jwtValidation.errors);
    }

    const encryptionValidation = this.validateEncryptionConfig();
    if (!encryptionValidation.valid) {
      errors.push(...encryptionValidation.errors);
    }

    const httpsValidation = this.validateHttpsConfig();
    if (!httpsValidation.valid) {
      errors.push(...httpsValidation.errors);
    }

    return { valid: errors.length === 0, errors };
  },
};

// 安全配置工具函数
export const securityConfigUtils = {
  /**
   * 获取环境特定的安全配置
   */
  getEnvironmentConfig(): any {
    const env = process.env.NODE_ENV || 'development';

    const baseConfig = { ...securityConfig };

    switch (env) {
      case 'production':
        return {
          ...baseConfig,
          https: {
            ...baseConfig.https,
            forceHttps: true,
          },
          csrf: {
            ...baseConfig.csrf,
            enabled: true,
            token: {
              ...baseConfig.csrf.token,
              secure: true,
            },
          },
          audit: {
            ...baseConfig.audit,
            enabled: true,
          },
        };

      case 'test':
        return {
          ...baseConfig,
          https: {
            ...baseConfig.https,
            forceHttps: false,
          },
          csrf: {
            ...baseConfig.csrf,
            enabled: false,
          },
          audit: {
            ...baseConfig.audit,
            enabled: false,
          },
        };

      case 'development':
      default:
        return {
          ...baseConfig,
          https: {
            ...baseConfig.https,
            forceHttps: false,
          },
          csrf: {
            ...baseConfig.csrf,
            enabled: false,
          },
          audit: {
            ...baseConfig.audit,
            enabled: true,
          },
        };
    }
  },

  /**
   * 生成安全配置报告
   */
  generateConfigReport(): string {
    const config = securityConfig;
    const validation = securityConfigValidator.validateAll();

    const report = `
# 安全配置报告

## 配置验证状态
- 验证结果: ${validation.valid ? '✓ 通过' : '✗ 失败'}
- 错误数量: ${validation.errors.length}

## JWT配置
- Access Token密钥: ${config.jwt.accessToken.secret ? '✓ 已设置' : '✗ 未设置'}
- Refresh Token密钥: ${config.jwt.refreshToken.secret ? '✓ 已设置' : '✗ 未设置'}
- Access Token过期时间: ${config.jwt.accessToken.expiresIn}
- Refresh Token过期时间: ${config.jwt.refreshToken.expiresIn}

## 密码策略
- 最小长度: ${config.password.policy.minLength}
- 最大长度: ${config.password.policy.maxLength}
- 要求大写字母: ${config.password.policy.requireUppercase ? '✓' : '✗'}
- 要求小写字母: ${config.password.policy.requireLowercase ? '✓' : '✗'}
- 要求数字: ${config.password.policy.requireNumbers ? '✓' : '✗'}
- 要求特殊字符: ${config.password.policy.requireSpecialChars ? '✓' : '✗'}

## 账户安全
- 最大登录尝试次数: ${config.account.loginAttempts.maxAttempts}
- 锁定时间: ${config.account.loginAttempts.lockoutDuration}秒
- 最大并发会话数: ${config.account.session.maxConcurrentSessions}

## 输入验证
- XSS防护: ${config.inputValidation.xss.enabled ? '✓ 启用' : '✗ 禁用'}
- SQL注入防护: ${config.inputValidation.sqlInjection.enabled ? '✓ 启用' : '✗ 禁用'}
- 最大请求体大小: ${config.inputValidation.maxBodySize}

## CSRF防护
- 状态: ${config.csrf.enabled ? '✓ 启用' : '✗ 禁用'}
- Token长度: ${config.csrf.token.length}
- Token有效期: ${config.csrf.token.ttl}秒

## API安全
- 签名验证: ${config.apiSecurity.signature.enabled ? '✓ 启用' : '✗ 禁用'}
- 重放攻击防护: ${config.apiSecurity.replayAttack.enabled ? '✓ 启用' : '✗ 禁用'}

## 数据安全
- 数据加密: ${config.dataSecurity.encryption.enabled ? '✓ 启用' : '✗ 禁用'}
- 日志脱敏: ${config.dataSecurity.logSanitization.enabled ? '✓ 启用' : '✗ 禁用'}

## HTTPS配置
- 强制HTTPS: ${config.https.forceHttps ? '✓ 启用' : '✗ 禁用'}
- HSTS: ${config.https.hsts.enabled ? '✓ 启用' : '✗ 禁用'}

## 审计日志
- 状态: ${config.audit.enabled ? '✓ 启用' : '✗ 禁用'}
- 保留天数: ${config.audit.retentionDays}
- 最大文件大小: ${config.audit.storage.maxFileSize}MB

## WebSocket安全
- 每IP最大连接数: ${config.websocket.connectionLimit.maxConnectionsPerIp}
- 全局最大连接数: ${config.websocket.connectionLimit.maxTotalConnections}
- 每分钟最大消息数: ${config.websocket.messageLimit.maxMessagesPerMinute}

## 错误列表
${validation.errors.map(error => `- ${error}`).join('\n') || '无'}

---
报告生成时间: ${new Date().toISOString()}
`;

    return report;
  },
};

export default securityConfig;