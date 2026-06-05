/**
 * 安全配置文件
 * 包含所有安全相关的配置项
 */

export const securityConfig = {
  // JWT安全配置
  jwt: {
    // Access Token配置
    accessToken: {
      secret: process.env.JWT_SECRET || 'default_jwt_secret',
      expiresIn: process.env.JWT_EXPIRES_IN || '15m', // 15分钟，更安全
      algorithm: 'HS256' as const,
      issuer: 'auction-system',
      audience: 'auction-users',
    },
    // Refresh Token配置
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', // 7天
      algorithm: 'HS256' as const,
    },
    // Token黑名单配置
    blacklist: {
      prefix: 'token:blacklist:',
      // 黑名单过期时间（秒），与Token最长有效期一致
      ttl: 7 * 24 * 60 * 60, // 7天
    },
  },

  // 密码安全配置
  password: {
    // bcrypt加密轮数
    saltRounds: 12,
    // 密码策略
    policy: {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      // 密码历史记录，防止重复使用
      historyCount: 5,
      // 密码过期时间（天），0表示不过期
      expirationDays: 90,
    },
  },

  // 账户安全配置
  account: {
    // 登录失败锁定
    loginAttempts: {
      maxAttempts: 5,
      lockoutDuration: 15 * 60, // 15分钟（秒）
      // 渐进式锁定时间
      progressiveLockout: true,
      lockoutMultiplier: 2, // 每次锁定时间翻倍
    },
    // 会话管理
    session: {
      maxConcurrentSessions: 3, // 最大并发会话数
      // 会话固定攻击防护
      regenerateSessionOnLogin: true,
      // 会话超时（分钟）
      idleTimeout: 30,
      absoluteTimeout: 480, // 8小时
    },
    // 账户锁定
    lockout: {
      enabled: true,
      // 锁定后通知方式
      notifyAdmin: true,
      // 自动解锁时间（分钟）
      autoUnlockMinutes: 30,
    },
  },

  // 输入验证配置
  inputValidation: {
    // 最大请求体大小
    maxBodySize: '10mb',
    // 最大URL长度
    maxUrlLength: 2048,
    // 最大查询参数长度
    maxQueryLength: 1024,
    // XSS防护
    xss: {
      enabled: true,
      // 允许的HTML标签（白名单）
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      // 允许的HTML属性
      allowedAttributes: {
        'a': ['href', 'title', 'target'],
      },
      // 允许的URL协议
      allowedSchemes: ['http', 'https', 'mailto'],
    },
    // SQL注入防护
    sqlInjection: {
      enabled: true,
      // 危险关键词
      dangerousKeywords: [
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
        'UNION', 'EXEC', 'EXECUTE', 'DECLARE', 'CAST', 'CONVERT',
        'TRUNCATE', 'REPLACE', 'RENAME', 'GRANT', 'REVOKE',
      ],
    },
  },

  // CSRF防护配置
  // JWT Bearer Token认证通过Authorization header发送，浏览器不会自动携带，
  // 因此天然免疫CSRF攻击，无需启用CSRF保护。
  csrf: {
    enabled: false,
    // CSRF Token配置
    token: {
      // Token长度
      length: 64,
      // Token有效期（秒）
      ttl: 3600, // 1小时
      // Token名称
      headerName: 'X-CSRF-Token',
      // Cookie名称
      cookieName: 'csrf-token',
      // 是否使用httpOnly
      httpOnly: true,
      // 是否使用secure（生产环境）
      secure: process.env.NODE_ENV === 'production',
      // SameSite配置
      sameSite: 'strict' as const,
    },
    // 忽略的路径
    ignorePaths: [
      '/api/auth/login',
      '/api/auth/register',
      '/health',
    ],
  },

  // 接口安全配置
  apiSecurity: {
    // 请求频率限制
    rateLimit: {
      // 全局限制
      global: {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 10000, // 每个IP最多10000次请求
      },
      // 登录接口限制
      login: {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 10, // 每个IP最多5次登录尝试
      },
      // 注册接口限制
      register: {
        windowMs: 20 * 60 * 1000, // 20分钟
        max: 5, // 每个IP最多5次注册
      },
      // 密码重置限制
      passwordReset: {
        windowMs: 60 * 60 * 1000, // 1小时
        max: 3, // 每个IP最多3次密码重置
      },
      // API接口限制
      api: {
        windowMs: 60 * 1000, // 1分钟
        max: 60, // 每个IP每分钟最多60次请求
      },
    },
    // 接口签名验证
    signature: {
      enabled: process.env.API_SIGNATURE_ENABLED === 'true',
      // 签名算法
      algorithm: 'sha256',
      // 签名密钥
      secret: process.env.API_SIGNATURE_SECRET || '',
      // 签名有效期（秒）
      ttl: 300, // 5分钟
      // 时间戳容差（秒）
      timestampTolerance: 30,
      // 需要签名的路径
      requiredPaths: [
        '/api/orders',
        '/api/bids',
        '/api/products',
      ],
    },
    // 重放攻击防护
    replayAttack: {
      enabled: true,
      // 随机数存储前缀
      noncePrefix: 'api:nonce:',
      // 随机数有效期（秒）
      nonceTtl: 300, // 5分钟
    },
  },

  // 数据安全配置
  dataSecurity: {
    // 敏感字段加密
    encryption: {
      enabled: true,
      // 加密算法
      algorithm: 'aes-256-gcm',
      // 加密密钥
      key: process.env.DATA_ENCRYPTION_KEY || '',
      // 初始化向量长度
      ivLength: 16,
      // 认证标签长度
      authTagLength: 16,
    },
    // 日志脱敏
    logSanitization: {
      enabled: true,
      // 需要脱敏的字段
      sensitiveFields: [
        'password', 'token', 'secret', 'key', 'authorization',
        'cookie', 'session', 'credit_card', 'ssn', 'phone',
        'email', 'address', 'id_card', 'passport',
      ],
      // 脱敏替换字符
      maskChar: '*',
      // 脱敏显示长度
      maskLength: 4,
    },
    // 数据库字段加密
    databaseEncryption: {
      enabled: false, // 暂时禁用，需要时启用
      // 需要加密的表和字段
      tables: {
        users: ['password', 'email', 'phone'],
        orders: ['amount', 'payment_info'],
      },
    },
  },

  // HTTPS配置
  https: {
    // 是否强制HTTPS
    forceHttps: process.env.NODE_ENV === 'production',
    // HSTS配置
    hsts: {
      enabled: true,
      maxAge: 31536000, // 1年
      includeSubDomains: true,
      preload: true,
    },
    // 证书配置
    ssl: {
      key: process.env.SSL_KEY_PATH || '',
      cert: process.env.SSL_CERT_PATH || '',
      ca: process.env.SSL_CA_PATH || '',
    },
  },

  // 安全头配置
  securityHeaders: {
    // Content Security Policy
    csp: {
      enabled: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:", "http://localhost:3000", "http://127.0.0.1:3000"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // X-Frame-Options
    frameOptions: 'DENY',
    // X-Content-Type-Options
    contentTypeOptions: 'nosniff',
    // X-XSS-Protection
    xssProtection: '1; mode=block',
    // Referrer-Policy
    referrerPolicy: 'strict-origin-when-cross-origin',
    // Permissions-Policy
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
    },
  },

  // 安全审计配置
  audit: {
    enabled: true,
    // 审计日志存储
    storage: {
      // 存储类型：file, database, redis
      type: 'file',
      // 文件路径
      filePath: 'logs/security-audit.log',
      // 最大文件大小（MB）
      maxFileSize: 50,
      // 最大文件数量
      maxFiles: 10,
    },
    // 需要审计的事件
    events: [
      'login_success',
      'login_failure',
      'logout',
      'password_change',
      'password_reset',
      'account_locked',
      'account_unlocked',
      'permission_denied',
      'suspicious_activity',
      'data_access',
      'data_modification',
      'api_error',
      'rate_limit_exceeded',
      'csrf_attack',
      'xss_attempt',
      'sql_injection_attempt',
    ],
    // 审计日志保留天数
    retentionDays: 90,
  },

  // WebSocket安全配置
  websocket: {
    // 连接限制
    connectionLimit: {
      // 每个IP最大连接数
      maxConnectionsPerIp: 5,
      // 全局最大连接数
      maxTotalConnections: 1000,
      // 连接超时（毫秒）
      connectionTimeout: 10000,
    },
    // 消息限制
    messageLimit: {
      // 每分钟最大消息数
      maxMessagesPerMinute: 60,
      // 最大消息大小（字节）
      maxMessageSize: 1024 * 10, // 10KB
    },
    // 认证
    authentication: {
      // 是否需要认证
      required: true,
      // Token验证
      tokenValidation: true,
      // 连接时验证
      validateOnConnect: true,
      // 定期验证
      validateInterval: 30000, // 30秒
    },
  },
};

/**
 * 验证安全配置
 */
export const validateSecurityConfig = (): void => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DATA_ENCRYPTION_KEY',
    'API_SIGNATURE_SECRET',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`Warning: Security environment variable ${envVar} is not set`);
    }
  }

  // 生产环境强制检查
  if (process.env.NODE_ENV === 'production') {
    if (securityConfig.jwt.accessToken.secret === 'default_jwt_secret') {
      throw new Error('JWT_SECRET must be set in production environment');
    }
    if (securityConfig.jwt.refreshToken.secret === 'default_refresh_secret') {
      throw new Error('JWT_REFRESH_SECRET must be set in production environment');
    }
    if (!securityConfig.dataSecurity.encryption.key) {
      throw new Error('DATA_ENCRYPTION_KEY must be set in production environment');
    }
  }
};

export default securityConfig;