/**
 * 安全工具统一入口
 * 整合所有安全相关的工具和中间件
 */

// 导入安全配置
import { securityConfig, validateSecurityConfig } from '../config/security.config';

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
} from '../middleware/security.middleware';

// 导入输入验证工具
import inputValidator, { commonValidationRules } from './input-validator';

// 导入安全审计工具
import securityAudit from './security-audit';

// 导入权限控制工具
import permissionManager, {
  requirePermission,
  requireResourceAccess,
  requireRole,
  requireOwnership,
  conditionalPermission,
  complexPermission,
} from './permission';

// 导入加密工具
import encryptionManager from './encryption';

// 导入JWT工具
import { jwtUtils } from './jwt';

/**
 * 安全工具集
 */
export const security = {
  // 配置
  config: securityConfig,
  validateConfig: validateSecurityConfig,

  // 中间件
  middleware: {
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
  },

  // 输入验证
  validation: {
    ...inputValidator,
    rules: commonValidationRules,
  },

  // 审计日志
  audit: securityAudit,

  // 权限控制
  permission: {
    manager: permissionManager,
    requirePermission,
    requireResourceAccess,
    requireRole,
    requireOwnership,
    conditionalPermission,
    complexPermission,
  },

  // 加密工具
  encryption: encryptionManager,

  // JWT工具
  jwt: jwtUtils,

  /**
   * 初始化安全系统
   */
  async initialize(): Promise<void> {
    try {
      // 验证安全配置
      validateSecurityConfig();

      // 清理过期审计日志
      await securityAudit.cleanup();

      console.log('Security system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize security system:', error);
      throw error;
    }
  },

  /**
   * 获取安全状态报告
   */
  async getSecurityStatus(): Promise<{
    configValid: boolean;
    auditEnabled: boolean;
    encryptionEnabled: boolean;
    httpsEnabled: boolean;
    csrfEnabled: boolean;
    signatureEnabled: boolean;
    recentAlerts: number;
    suspiciousIps: string[];
  }> {
    try {
      const statistics = await securityAudit.getStatistics();
      const anomalies = await securityAudit.detectAnomalies();

      return {
        configValid: true,
        auditEnabled: securityConfig.audit.enabled,
        encryptionEnabled: securityConfig.dataSecurity.encryption.enabled,
        httpsEnabled: securityConfig.https.forceHttps,
        csrfEnabled: securityConfig.csrf.enabled,
        signatureEnabled: securityConfig.apiSecurity.signature.enabled,
        recentAlerts: statistics.eventsByLevel?.critical || 0,
        suspiciousIps: anomalies.suspiciousIps,
      };
    } catch (error) {
      console.error('Failed to get security status:', error);
      return {
        configValid: false,
        auditEnabled: false,
        encryptionEnabled: false,
        httpsEnabled: false,
        csrfEnabled: false,
        signatureEnabled: false,
        recentAlerts: 0,
        suspiciousIps: [],
      };
    }
  },

  /**
   * 运行安全检查
   */
  async runSecurityCheck(): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 检查JWT密钥
    if (securityConfig.jwt.accessToken.secret === 'default_jwt_secret') {
      issues.push('JWT密钥使用默认值');
      recommendations.push('设置强随机JWT密钥');
    }

    // 检查加密密钥
    if (!securityConfig.dataSecurity.encryption.key) {
      issues.push('数据加密密钥未配置');
      recommendations.push('配置数据加密密钥');
    }

    // 检查HTTPS
    if (!securityConfig.https.forceHttps && process.env.NODE_ENV === 'production') {
      issues.push('生产环境未启用HTTPS');
      recommendations.push('启用HTTPS强制重定向');
    }

    // 检查CSRF
    if (!securityConfig.csrf.enabled) {
      recommendations.push('启用CSRF防护');
    }

    // 检查签名验证
    if (!securityConfig.apiSecurity.signature.enabled) {
      recommendations.push('启用API签名验证');
    }

    // 检查审计日志
    if (!securityConfig.audit.enabled) {
      recommendations.push('启用安全审计日志');
    }

    return {
      passed: issues.length === 0,
      issues,
      recommendations,
    };
  },

  /**
   * 生成安全报告
   */
  async generateSecurityReport(): Promise<string> {
    const status = await this.getSecurityStatus();
    const check = await this.runSecurityCheck();
    const statistics = await securityAudit.getStatistics();

    const report = `
# 安全状态报告

## 系统状态
- 配置有效性: ${status.configValid ? '✓' : '✗'}
- 审计日志: ${status.auditEnabled ? '✓' : '✗'}
- 数据加密: ${status.encryptionEnabled ? '✓' : '✗'}
- HTTPS: ${status.httpsEnabled ? '✓' : '✗'}
- CSRF防护: ${status.csrfEnabled ? '✓' : '✗'}
- 签名验证: ${status.signatureEnabled ? '✓' : '✗'}

## 安全检查
- 通过: ${check.passed ? '✓' : '✗'}
- 问题数: ${check.issues.length}
- 建议数: ${check.recommendations.length}

## 最近统计
- 总事件数: ${statistics.totalEvents}
- 关键事件: ${statistics.eventsByLevel?.critical || 0}
- 错误事件: ${statistics.eventsByLevel?.error || 0}
- 可疑IP数: ${status.suspiciousIps.length}

## 问题列表
${check.issues.map(issue => `- ${issue}`).join('\n') || '无'}

## 建议列表
${check.recommendations.map(rec => `- ${rec}`).join('\n') || '无'}

## 可疑IP列表
${status.suspiciousIps.map(ip => `- ${ip}`).join('\n') || '无'}

---
报告生成时间: ${new Date().toISOString()}
`;

    return report;
  },
};

// 导出所有安全相关工具
export {
  // 配置
  securityConfig,
  validateSecurityConfig,

  // 中间件
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

  // 输入验证
  inputValidator,
  commonValidationRules,

  // 审计日志
  securityAudit,

  // 权限控制
  permissionManager,
  requirePermission,
  requireResourceAccess,
  requireRole,
  requireOwnership,
  conditionalPermission,
  complexPermission,

  // 加密工具
  encryptionManager,

  // JWT工具
  jwtUtils,
};

export default security;