/**
 * 安全配置文件
 * 整合所有安全相关的配置
 */

import { securityConfig, validateSecurityConfig } from '../security.config';
import { 
  securityConfigValidator, 
  securityConfigUtils, 
  SECURITY_CONSTANTS 
} from '../security';

/**
 * 安全配置
 */
export const security = {
  // 安全配置
  config: securityConfig,
  validate: validateSecurityConfig,
  validator: securityConfigValidator,
  utils: securityConfigUtils,
  constants: SECURITY_CONSTANTS,

  /**
   * 初始化安全配置
   */
  initialize(): void {
    try {
      validateSecurityConfig();
      console.log('安全配置初始化完成');
    } catch (error) {
      console.error('安全配置初始化失败:', error);
      throw error;
    }
  },

  /**
   * 获取安全配置
   */
  getConfig(): any {
    return securityConfig;
  },

  /**
   * 验证安全配置
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    return securityConfigValidator.validateAll();
  },

  /**
   * 获取环境特定配置
   */
  getEnvironmentConfig(): any {
    return securityConfigUtils.getEnvironmentConfig();
  },

  /**
   * 生成配置报告
   */
  generateReport(): string {
    return securityConfigUtils.generateConfigReport();
  },

  /**
   * 获取安全常量
   */
  getConstants(): any {
    return SECURITY_CONSTANTS;
  },

  /**
   * 获取JWT配置
   */
  getJwtConfig(): any {
    return securityConfig.jwt;
  },

  /**
   * 获取密码策略
   */
  getPasswordPolicy(): any {
    return securityConfig.password.policy;
  },

  /**
   * 获取账户锁定配置
   */
  getAccountLockoutConfig(): any {
    return securityConfig.account.loginAttempts;
  },

  /**
   * 获取频率限制配置
   */
  getRateLimitConfig(): any {
    return securityConfig.apiSecurity.rateLimit;
  },

  /**
   * 获取输入验证配置
   */
  getInputValidationConfig(): any {
    return securityConfig.inputValidation;
  },

  /**
   * 获取CSRF配置
   */
  getCsrfConfig(): any {
    return securityConfig.csrf;
  },

  /**
   * 获取HTTPS配置
   */
  getHttpsConfig(): any {
    return securityConfig.https;
  },

  /**
   * 获取安全头配置
   */
  getSecurityHeadersConfig(): any {
    return securityConfig.securityHeaders;
  },

  /**
   * 获取审计配置
   */
  getAuditConfig(): any {
    return securityConfig.audit;
  },

  /**
   * 获取WebSocket安全配置
   */
  getWebSocketConfig(): any {
    return securityConfig.websocket;
  },

  /**
   * 获取数据加密配置
   */
  getEncryptionConfig(): any {
    return securityConfig.dataSecurity.encryption;
  },

  /**
   * 获取日志脱敏配置
   */
  getLogSanitizationConfig(): any {
    return securityConfig.dataSecurity.logSanitization;
  },
};

// 导出安全配置相关组件
export { securityConfig, validateSecurityConfig } from '../security.config';
export { 
  securityConfigValidator, 
  securityConfigUtils, 
  SECURITY_CONSTANTS 
} from '../security';

export default security;