/**
 * 配置文件索引
 * 整合所有配置相关的文件
 */

// 导入基础配置
import { config, validateConfig } from './env.config';

// 导入安全配置
import { securityConfig, validateSecurityConfig } from './security.config';
import { 
  securityConfigValidator, 
  securityConfigUtils, 
  SECURITY_CONSTANTS 
} from './security';

// 导入性能配置
import { performanceConfig, validatePerformanceConfig } from './performance.config';

/**
 * 配置管理器
 */
export const configManager = {
  // 基础配置
  base: config,
  validateBase: validateConfig,

  // 安全配置
  security: securityConfig,
  validateSecurity: validateSecurityConfig,
  securityValidator: securityConfigValidator,
  securityUtils: securityConfigUtils,
  securityConstants: SECURITY_CONSTANTS,

  // 性能配置
  performance: performanceConfig,
  validatePerformance: validatePerformanceConfig,

  /**
   * 初始化所有配置
   */
  initialize(): void {
    try {
      // 验证基础配置
      validateConfig();

      // 验证安全配置
      validateSecurityConfig();

      // 验证性能配置
      validatePerformanceConfig();

      console.log('所有配置初始化完成');
    } catch (error) {
      console.error('配置初始化失败:', error);
      throw error;
    }
  },

  /**
   * 获取完整配置
   */
  getFullConfig(): any {
    return {
      base: config,
      security: securityConfig,
      performance: performanceConfig,
    };
  },

  /**
   * 获取环境特定配置
   */
  getEnvironmentConfig(): any {
    return securityConfigUtils.getEnvironmentConfig();
  },

  /**
   * 验证所有配置
   */
  validateAll(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证基础配置
    try {
      validateConfig();
    } catch (error) {
      errors.push(`基础配置验证失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 验证安全配置
    try {
      validateSecurityConfig();
    } catch (error) {
      errors.push(`安全配置验证失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 验证安全配置详细信息
    const securityValidation = securityConfigValidator.validateAll();
    if (!securityValidation.valid) {
      errors.push(...securityValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * 生成配置报告
   */
  generateReport(): string {
    const validation = this.validateAll();
    const config = this.getFullConfig();

    const report = `
# 配置报告

## 配置验证状态
- 验证结果: ${validation.valid ? '✓ 通过' : '✗ 失败'}
- 错误数量: ${validation.errors.length}

## 基础配置
- 环境: ${config.base.nodeEnv}
- 端口: ${config.base.port}
- 数据库: ${config.base.database.host}:${config.base.database.port}
- Redis: ${config.base.redis.host}:${config.base.redis.port}

## 安全配置
- JWT密钥: ${config.security.jwt.accessToken.secret ? '✓ 已设置' : '✗ 未设置'}
- 数据加密: ${config.security.dataSecurity.encryption.enabled ? '✓ 启用' : '✗ 禁用'}
- CSRF防护: ${config.security.csrf.enabled ? '✓ 启用' : '✗ 禁用'}
- HTTPS: ${config.security.https.forceHttps ? '✓ 强制' : '✗ 可选'}
- 审计日志: ${config.security.audit.enabled ? '✓ 启用' : '✗ 禁用'}

## 错误列表
${validation.errors.map(error => `- ${error}`).join('\n') || '无'}

---
报告生成时间: ${new Date().toISOString()}
`;

    return report;
  },
};

// 导出配置相关组件
export { config, validateConfig } from './env.config';
export { securityConfig, validateSecurityConfig } from './security.config';
export { 
  securityConfigValidator, 
  securityConfigUtils, 
  SECURITY_CONSTANTS 
} from './security';

export default configManager;