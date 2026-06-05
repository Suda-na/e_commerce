/**
 * 安全相关类型定义
 */

// 用户角色
export type UserRole = 'user' | 'merchant' | 'admin';

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

// 审计事件类型
export type AuditEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_change'
  | 'password_reset'
  | 'account_locked'
  | 'account_unlocked'
  | 'permission_denied'
  | 'suspicious_activity'
  | 'data_access'
  | 'data_modification'
  | 'api_error'
  | 'rate_limit_exceeded'
  | 'csrf_attack'
  | 'xss_attempt'
  | 'sql_injection_attempt'
  | 'signature_invalid'
  | 'nonce_replay'
  | 'ip_blocked'
  | 'session_expired'
  | 'token_refreshed'
  | 'token_blacklisted'
  | 'file_upload'
  | 'file_download'
  | 'admin_action'
  | 'system_error';

// 审计日志级别
export type AuditLogLevel = 'info' | 'warn' | 'error' | 'critical';

// 审计日志条目接口
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  event: AuditEventType;
  level: AuditLogLevel;
  message: string;
  userId?: number;
  username?: string;
  userRole?: UserRole;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  details?: any;
  metadata?: any;
  tags?: string[];
}

// 审计日志查询选项
export interface AuditQueryOptions {
  startTime?: Date;
  endTime?: Date;
  event?: AuditEventType | AuditEventType[];
  level?: AuditLogLevel | AuditLogLevel[];
  userId?: number;
  username?: string;
  ip?: string;
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}

// 审计统计信息
export interface AuditStatistics {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsByLevel: Record<AuditLogLevel, number>;
  topIps: Array<{ ip: string; count: number }>;
  topUsers: Array<{ userId: number; username: string; count: number }>;
  recentCriticalEvents: AuditLogEntry[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

// 验证规则接口
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'phone' | 'url' | 'date' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
  sanitize?: boolean;
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
}

// 验证结果接口
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

// 安全配置接口
export interface SecurityConfig {
  jwt: {
    accessToken: {
      secret: string;
      expiresIn: string;
      algorithm: string;
      issuer: string;
      audience: string;
    };
    refreshToken: {
      secret: string;
      expiresIn: string;
      algorithm: string;
    };
    blacklist: {
      prefix: string;
      ttl: number;
    };
  };
  password: {
    saltRounds: number;
    policy: {
      minLength: number;
      maxLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      historyCount: number;
      expirationDays: number;
    };
  };
  account: {
    loginAttempts: {
      maxAttempts: number;
      lockoutDuration: number;
      progressiveLockout: boolean;
      lockoutMultiplier: number;
    };
    session: {
      maxConcurrentSessions: number;
      regenerateSessionOnLogin: boolean;
      idleTimeout: number;
      absoluteTimeout: number;
    };
    lockout: {
      enabled: boolean;
      notifyAdmin: boolean;
      autoUnlockMinutes: number;
    };
  };
  inputValidation: {
    maxBodySize: string;
    maxUrlLength: number;
    maxQueryLength: number;
    xss: {
      enabled: boolean;
      allowedTags: string[];
      allowedAttributes: Record<string, string[]>;
      allowedSchemes: string[];
    };
    sqlInjection: {
      enabled: boolean;
      dangerousKeywords: string[];
    };
  };
  csrf: {
    enabled: boolean;
    token: {
      length: number;
      ttl: number;
      headerName: string;
      cookieName: string;
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'strict' | 'lax' | 'none';
    };
    ignorePaths: string[];
  };
  apiSecurity: {
    rateLimit: {
      global: {
        windowMs: number;
        max: number;
      };
      login: {
        windowMs: number;
        max: number;
      };
      register: {
        windowMs: number;
        max: number;
      };
      passwordReset: {
        windowMs: number;
        max: number;
      };
      api: {
        windowMs: number;
        max: number;
      };
    };
    signature: {
      enabled: boolean;
      algorithm: string;
      secret: string;
      ttl: number;
      timestampTolerance: number;
      requiredPaths: string[];
    };
    replayAttack: {
      enabled: boolean;
      noncePrefix: string;
      nonceTtl: number;
    };
  };
  dataSecurity: {
    encryption: {
      enabled: boolean;
      algorithm: string;
      key: string;
      ivLength: number;
      authTagLength: number;
    };
    logSanitization: {
      enabled: boolean;
      sensitiveFields: string[];
      maskChar: string;
      maskLength: number;
    };
    databaseEncryption: {
      enabled: boolean;
      tables: Record<string, string[]>;
    };
  };
  https: {
    forceHttps: boolean;
    hsts: {
      enabled: boolean;
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    ssl: {
      key: string;
      cert: string;
      ca: string;
    };
  };
  securityHeaders: {
    csp: {
      enabled: boolean;
      directives: Record<string, string[]>;
    };
    frameOptions: string;
    contentTypeOptions: string;
    xssProtection: string;
    referrerPolicy: string;
    permissionsPolicy: Record<string, string[]>;
  };
  audit: {
    enabled: boolean;
    storage: {
      type: string;
      filePath: string;
      maxFileSize: number;
      maxFiles: number;
    };
    events: AuditEventType[];
    retentionDays: number;
  };
  websocket: {
    connectionLimit: {
      maxConnectionsPerIp: number;
      maxTotalConnections: number;
      connectionTimeout: number;
    };
    messageLimit: {
      maxMessagesPerMinute: number;
      maxMessageSize: number;
    };
    authentication: {
      required: boolean;
      tokenValidation: boolean;
      validateOnConnect: boolean;
      validateInterval: number;
    };
  };
}

// JWT载荷接口
export interface IJwtPayload {
  userId: number;
  username: string;
  role: UserRole;
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

// 安全状态接口
export interface SecurityStatus {
  configValid: boolean;
  auditEnabled: boolean;
  encryptionEnabled: boolean;
  httpsEnabled: boolean;
  csrfEnabled: boolean;
  signatureEnabled: boolean;
  recentAlerts: number;
  suspiciousIps: string[];
}

// 安全检查结果接口
export interface SecurityCheckResult {
  passed: boolean;
  issues: string[];
  recommendations: string[];
}

// 异常检测结果接口
export interface AnomalyDetectionResult {
  suspiciousIps: string[];
  bruteForceAttempts: Array<{ ip: string; username: string; attempts: number }>;
  unusualPatterns: Array<{ type: string; description: string; count: number }>;
}

// 扩展Express Request接口
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