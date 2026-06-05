import fs from 'fs';
import path from 'path';
import { securityConfig } from '../config/security.config';
import { logger } from './logger';
import { redisUtils } from '../config/redis';

/**
 * 安全审计日志工具类
 * 记录和分析安全相关事件
 */

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
  userRole?: string;
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

/**
 * 安全审计日志管理器
 */
export const securityAudit = {
  // 日志文件路径
  logFilePath: securityConfig.audit.storage.filePath,

  // 内存缓存（用于快速查询）
  logCache: new Map<string, AuditLogEntry[]>(),

  /**
   * 记录审计事件
   */
  async log(event: AuditEventType, data: Partial<AuditLogEntry>): Promise<void> {
    try {
      const entry: AuditLogEntry = {
        id: this.generateId(),
        timestamp: new Date(),
        event,
        level: this.getEventLevel(event),
        message: this.getEventMessage(event, data),
        ...data,
      };

      // 脱敏处理
      const sanitizedEntry = this.sanitizeEntry(entry);

      // 写入日志文件
      await this.writeToFile(sanitizedEntry);

      // 缓存到内存
      this.cacheEntry(sanitizedEntry);

      // 如果是关键事件，发送告警
      if (entry.level === 'critical' || entry.level === 'error') {
        await this.sendAlert(sanitizedEntry);
      }

      // 记录到应用日志
      logger.info('Security audit event', {
        auditId: entry.id,
        event: entry.event,
        level: entry.level,
        userId: entry.userId,
        ip: entry.ip,
      });
    } catch (error) {
      logger.error('Failed to write security audit log', { error, event, data });
    }
  },

  /**
   * 生成唯一ID
   */
  generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * 获取事件级别
   */
  getEventLevel(event: AuditEventType): AuditLogLevel {
    const levelMap: Record<AuditEventType, AuditLogLevel> = {
      login_success: 'info',
      login_failure: 'warn',
      logout: 'info',
      password_change: 'warn',
      password_reset: 'warn',
      account_locked: 'warn',
      account_unlocked: 'info',
      permission_denied: 'warn',
      suspicious_activity: 'error',
      data_access: 'info',
      data_modification: 'info',
      api_error: 'error',
      rate_limit_exceeded: 'warn',
      csrf_attack: 'critical',
      xss_attempt: 'critical',
      sql_injection_attempt: 'critical',
      signature_invalid: 'error',
      nonce_replay: 'error',
      ip_blocked: 'warn',
      session_expired: 'info',
      token_refreshed: 'info',
      token_blacklisted: 'info',
      file_upload: 'info',
      file_download: 'info',
      admin_action: 'warn',
      system_error: 'error',
    };

    return levelMap[event] || 'info';
  },

  /**
   * 获取事件消息
   */
  getEventMessage(event: AuditEventType, data: Partial<AuditLogEntry>): string {
    const messages: Record<AuditEventType, string> = {
      login_success: `用户登录成功: ${data.username || 'unknown'}`,
      login_failure: `用户登录失败: ${data.username || 'unknown'}`,
      logout: `用户登出: ${data.username || 'unknown'}`,
      password_change: `密码修改: ${data.username || 'unknown'}`,
      password_reset: `密码重置请求: ${data.username || 'unknown'}`,
      account_locked: `账户锁定: ${data.username || 'unknown'}`,
      account_unlocked: `账户解锁: ${data.username || 'unknown'}`,
      permission_denied: `权限拒绝: ${data.username || 'unknown'} 访问 ${data.url || 'unknown'}`,
      suspicious_activity: `可疑活动: ${data.details || 'unknown'}`,
      data_access: `数据访问: ${data.username || 'unknown'} 访问 ${data.url || 'unknown'}`,
      data_modification: `数据修改: ${data.username || 'unknown'} 修改 ${data.url || 'unknown'}`,
      api_error: `API错误: ${data.method || 'unknown'} ${data.url || 'unknown'} - ${data.details || 'unknown'}`,
      rate_limit_exceeded: `频率限制超出: ${data.ip || 'unknown'}`,
      csrf_attack: `CSRF攻击检测: ${data.ip || 'unknown'}`,
      xss_attempt: `XSS攻击尝试: ${data.ip || 'unknown'}`,
      sql_injection_attempt: `SQL注入尝试: ${data.ip || 'unknown'}`,
      signature_invalid: `签名验证失败: ${data.ip || 'unknown'}`,
      nonce_replay: `重放攻击检测: ${data.ip || 'unknown'}`,
      ip_blocked: `IP地址被阻止: ${data.ip || 'unknown'}`,
      session_expired: `会话过期: ${data.username || 'unknown'}`,
      token_refreshed: `Token刷新: ${data.username || 'unknown'}`,
      token_blacklisted: `Token加入黑名单: ${data.username || 'unknown'}`,
      file_upload: `文件上传: ${data.username || 'unknown'}`,
      file_download: `文件下载: ${data.username || 'unknown'}`,
      admin_action: `管理员操作: ${data.username || 'unknown'} - ${data.details || 'unknown'}`,
      system_error: `系统错误: ${data.details || 'unknown'}`,
    };

    return messages[event] || `安全事件: ${event}`;
  },

  /**
   * 脱敏处理审计条目
   */
  sanitizeEntry(entry: AuditLogEntry): AuditLogEntry {
    const sanitized = { ...entry };
    const { sensitiveFields, maskChar, maskLength } = securityConfig.dataSecurity.logSanitization;

    // 递归脱敏对象
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return this.maskString(obj, maskChar, maskLength);
      }
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }
      if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
            result[key] = this.maskString(String(value), maskChar, maskLength);
          } else {
            result[key] = sanitizeObject(value);
          }
        }
        return result;
      }
      return obj;
    };

    // 脱敏详细信息
    if (sanitized.details) {
      sanitized.details = sanitizeObject(sanitized.details);
    }
    if (sanitized.metadata) {
      sanitized.metadata = sanitizeObject(sanitized.metadata);
    }

    return sanitized;
  },

  /**
   * 字符串脱敏
   */
  maskString(str: string, maskChar: string = '*', maskLength: number = 4): string {
    if (!str || str.length <= maskLength) {
      return str;
    }
    const visibleLength = Math.ceil(str.length / 3);
    const maskedPart = maskChar.repeat(str.length - visibleLength);
    return str.substring(0, visibleLength) + maskedPart;
  },

  /**
   * 写入日志文件
   */
  async writeToFile(entry: AuditLogEntry): Promise<void> {
    try {
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFilePath, logLine, 'utf8');

      // 检查文件大小，进行轮转
      await this.rotateLogFile();
    } catch (error) {
      logger.error('Failed to write audit log to file', { error });
    }
  },

  /**
   * 日志文件轮转
   */
  async rotateLogFile(): Promise<void> {
    try {
      const stats = fs.statSync(this.logFilePath);
      const maxSize = securityConfig.audit.storage.maxFileSize * 1024 * 1024; // 转换为字节

      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = `${this.logFilePath}.${timestamp}`;
        fs.renameSync(this.logFilePath, rotatedPath);

        // 清理旧日志文件
        await this.cleanOldLogFiles();
      }
    } catch (error) {
      logger.error('Failed to rotate audit log file', { error });
    }
  },

  /**
   * 清理旧日志文件
   */
  async cleanOldLogFiles(): Promise<void> {
    try {
      const logDir = path.dirname(this.logFilePath);
      const baseName = path.basename(this.logFilePath);
      const files = fs.readdirSync(logDir)
        .filter(file => file.startsWith(baseName) && file !== baseName)
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          time: fs.statSync(path.join(logDir, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      // 保留最新的N个文件
      const maxFiles = securityConfig.audit.storage.maxFiles;
      if (files.length > maxFiles) {
        const filesToDelete = files.slice(maxFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          logger.info('Deleted old audit log file', { file: file.name });
        }
      }
    } catch (error) {
      logger.error('Failed to clean old audit log files', { error });
    }
  },

  /**
   * 缓存日志条目
   */
  cacheEntry(entry: AuditLogEntry): void {
    const dateKey = entry.timestamp.toISOString().split('T')[0];
    const cached = this.logCache.get(dateKey) || [];
    cached.push(entry);
    this.logCache.set(dateKey, cached);

    // 限制每天缓存大小
    if (cached.length > 1000) {
      cached.splice(0, cached.length - 1000);
    }

    // 限制总缓存条目数（最多保留3天）
    if (this.logCache.size > 3) {
      const sortedKeys = Array.from(this.logCache.keys()).sort();
      while (this.logCache.size > 3 && sortedKeys.length > 0) {
        const oldestKey = sortedKeys.shift();
        if (oldestKey) {
          this.logCache.delete(oldestKey);
        }
      }
    }
  },

  /**
   * 发送告警
   */
  async sendAlert(entry: AuditLogEntry): Promise<void> {
    // 这里可以集成告警系统，如邮件、短信、钉钉等
    logger.warn('Security alert triggered', {
      auditId: entry.id,
      event: entry.event,
      level: entry.level,
      message: entry.message,
      ip: entry.ip,
      userId: entry.userId,
    });

    // 可以在这里添加告警逻辑
    // 例如：发送邮件、调用告警API等
  },

  /**
   * 查询审计日志
   */
  async query(options: AuditQueryOptions): Promise<AuditLogEntry[]> {
    try {
      let results: AuditLogEntry[] = [];

      // 从文件读取
      if (fs.existsSync(this.logFilePath)) {
        const content = fs.readFileSync(this.logFilePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as AuditLogEntry;
            entry.timestamp = new Date(entry.timestamp);
            results.push(entry);
          } catch (parseError) {
            // 忽略解析错误的行
          }
        }
      }

      // 应用过滤器
      if (options.startTime) {
        results = results.filter(entry => entry.timestamp >= options.startTime!);
      }
      if (options.endTime) {
        results = results.filter(entry => entry.timestamp <= options.endTime!);
      }
      if (options.event) {
        const events = Array.isArray(options.event) ? options.event : [options.event];
        results = results.filter(entry => events.includes(entry.event));
      }
      if (options.level) {
        const levels = Array.isArray(options.level) ? options.level : [options.level];
        results = results.filter(entry => levels.includes(entry.level));
      }
      if (options.userId) {
        results = results.filter(entry => entry.userId === options.userId);
      }
      if (options.username) {
        results = results.filter(entry => entry.username?.includes(options.username!));
      }
      if (options.ip) {
        results = results.filter(entry => entry.ip?.includes(options.ip!));
      }

      // 排序
      const sortOrder = options.sortOrder || 'desc';
      results.sort((a, b) => {
        const timeA = a.timestamp.getTime();
        const timeB = b.timestamp.getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });

      // 分页
      const offset = options.offset || 0;
      const limit = options.limit || 100;
      results = results.slice(offset, offset + limit);

      return results;
    } catch (error) {
      logger.error('Failed to query audit logs', { error, options });
      return [];
    }
  },

  /**
   * 获取统计信息
   */
  async getStatistics(startTime?: Date, endTime?: Date): Promise<AuditStatistics> {
    try {
      const start = startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 默认7天
      const end = endTime || new Date();

      const entries = await this.query({
        startTime: start,
        endTime: end,
        limit: 10000,
      });

      const statistics: AuditStatistics = {
        totalEvents: entries.length,
        eventsByType: {} as Record<AuditEventType, number>,
        eventsByLevel: {} as Record<AuditLogLevel, number>,
        topIps: [],
        topUsers: [],
        recentCriticalEvents: [],
        timeRange: { start, end },
      };

      // 初始化计数器
      const ipCounts = new Map<string, number>();
      const userCounts = new Map<number, { username: string; count: number }>();

      for (const entry of entries) {
        // 按事件类型统计
        statistics.eventsByType[entry.event] = (statistics.eventsByType[entry.event] || 0) + 1;

        // 按级别统计
        statistics.eventsByLevel[entry.level] = (statistics.eventsByLevel[entry.level] || 0) + 1;

        // IP统计
        if (entry.ip) {
          ipCounts.set(entry.ip, (ipCounts.get(entry.ip) || 0) + 1);
        }

        // 用户统计
        if (entry.userId && entry.username) {
          const existing = userCounts.get(entry.userId);
          if (existing) {
            existing.count++;
          } else {
            userCounts.set(entry.userId, { username: entry.username, count: 1 });
          }
        }
      }

      // 获取Top 10 IP
      statistics.topIps = Array.from(ipCounts.entries())
        .map(([ip, count]) => ({ ip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // 获取Top 10用户
      statistics.topUsers = Array.from(userCounts.entries())
        .map(([userId, data]) => ({ userId, username: data.username, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // 获取最近的关键事件
      statistics.recentCriticalEvents = entries
        .filter(entry => entry.level === 'critical' || entry.level === 'error')
        .slice(0, 20);

      return statistics;
    } catch (error) {
      logger.error('Failed to get audit statistics', { error });
      throw error;
    }
  },

  /**
   * 检测异常活动
   */
  async detectAnomalies(): Promise<{
    suspiciousIps: string[];
    bruteForceAttempts: Array<{ ip: string; username: string; attempts: number }>;
    unusualPatterns: Array<{ type: string; description: string; count: number }>;
  }> {
    try {
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);
      const entries = await this.query({
        startTime: lastHour,
        limit: 10000,
      });

      const suspiciousIps: string[] = [];
      const bruteForceAttempts: Array<{ ip: string; username: string; attempts: number }> = [];
      const patterns: Map<string, number> = new Map();

      // 分析登录失败
      const loginFailures = new Map<string, { ip: string; username: string; attempts: number }>();
      for (const entry of entries) {
        if (entry.event === 'login_failure' && entry.ip && entry.username) {
          const key = `${entry.ip}:${entry.username}`;
          const existing = loginFailures.get(key);
          if (existing) {
            existing.attempts++;
          } else {
            loginFailures.set(key, { ip: entry.ip, username: entry.username, attempts: 1 });
          }
        }
      }

      // 检测暴力破解
      for (const [, data] of loginFailures) {
        if (data.attempts >= 5) {
          bruteForceAttempts.push(data);
          if (!suspiciousIps.includes(data.ip)) {
            suspiciousIps.push(data.ip);
          }
        }
      }

      // 检测异常模式
      for (const entry of entries) {
        if (entry.event === 'xss_attempt' || entry.event === 'sql_injection_attempt' || entry.event === 'csrf_attack') {
          const patternKey = entry.event;
          patterns.set(patternKey, (patterns.get(patternKey) || 0) + 1);
          
          if (entry.ip && !suspiciousIps.includes(entry.ip)) {
            suspiciousIps.push(entry.ip);
          }
        }
      }

      const unusualPatterns = Array.from(patterns.entries()).map(([type, count]) => ({
        type,
        description: this.getPatternDescription(type),
        count,
      }));

      return {
        suspiciousIps,
        bruteForceAttempts,
        unusualPatterns,
      };
    } catch (error) {
      logger.error('Failed to detect anomalies', { error });
      return {
        suspiciousIps: [],
        bruteForceAttempts: [],
        unusualPatterns: [],
      };
    }
  },

  /**
   * 获取模式描述
   */
  getPatternDescription(type: string): string {
    const descriptions: Record<string, string> = {
      xss_attempt: 'XSS攻击尝试',
      sql_injection_attempt: 'SQL注入尝试',
      csrf_attack: 'CSRF攻击',
      signature_invalid: '无效签名请求',
      nonce_replay: '重放攻击',
    };
    return descriptions[type] || '未知异常模式';
  },

  /**
   * 清理过期日志
   */
  async cleanup(): Promise<void> {
    try {
      const retentionDays = securityConfig.audit.retentionDays;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // 清理内存缓存
      for (const [dateKey, entries] of this.logCache) {
        const date = new Date(dateKey);
        if (date < cutoffDate) {
          this.logCache.delete(dateKey);
        }
      }

      logger.info('Audit log cleanup completed', {
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      });
    } catch (error) {
      logger.error('Failed to cleanup audit logs', { error });
    }
  },

  /**
   * 导出审计日志
   */
  async export(options: AuditQueryOptions & { format?: 'json' | 'csv' }): Promise<string> {
    const entries = await this.query(options);
    const format = options.format || 'json';

    if (format === 'csv') {
      const headers = ['ID', 'Timestamp', 'Event', 'Level', 'Message', 'User ID', 'Username', 'IP', 'URL', 'Details'];
      const rows = entries.map(entry => [
        entry.id,
        entry.timestamp.toISOString(),
        entry.event,
        entry.level,
        `"${entry.message.replace(/"/g, '""')}"`,
        entry.userId || '',
        entry.username || '',
        entry.ip || '',
        entry.url || '',
        entry.details ? JSON.stringify(entry.details).replace(/"/g, '""') : '',
      ]);
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    return JSON.stringify(entries, null, 2);
  },
};

// 定期清理任务
setInterval(() => {
  securityAudit.cleanup().catch(error => {
    logger.error('Scheduled audit cleanup failed', { error });
  });
}, 24 * 60 * 60 * 1000); // 每天执行一次

export default securityAudit;