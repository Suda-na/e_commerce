/**
 * 安全模块入口文件
 * 整合所有安全相关的模块和功能
 */

// 导入安全模块
import { securityModuleInstance, SecurityModule } from './modules/security';

// 导入安全配置
import { securityConfig, validateSecurityConfig } from './config/security.config';

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
} from './middleware/security.middleware';

// 导入输入验证工具
import inputValidator, { commonValidationRules } from './utils/input-validator';

// 导入安全审计工具
import securityAudit from './utils/security-audit';

// 导入权限控制工具
import permissionManager, {
  requirePermission,
  requireResourceAccess,
  requireRole,
  requireOwnership,
  conditionalPermission,
  complexPermission,
} from './utils/permission';

// 导入加密工具
import encryptionManager from './utils/encryption';

// 导入JWT工具
import { jwtUtils } from './utils/jwt';

// 导入安全工具
import security from './utils/security';

/**
 * 安全模块主入口
 */
export const securityMain = {
  // 安全模块实例
  module: securityModuleInstance,

  // 安全配置
  config: securityConfig,
  validateConfig: validateSecurityConfig,

  // 安全中间件
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

  // 安全工具
  security,

  /**
   * 初始化安全系统
   */
  async initialize(): Promise<void> {
    try {
      await securityModuleInstance.initialize();
      console.log('安全系统初始化完成');
    } catch (error) {
      console.error('安全系统初始化失败:', error);
      throw error;
    }
  },

  /**
   * 获取安全状态
   */
  async getStatus(): Promise<any> {
    return await securityModuleInstance.getStatus();
  },

  /**
   * 运行安全检查
   */
  async runCheck(): Promise<any> {
    return await securityModuleInstance.runCheck();
  },

  /**
   * 生成安全报告
   */
  async generateReport(): Promise<string> {
    return await securityModuleInstance.generateReport();
  },

  /**
   * 获取安全配置
   */
  getConfig(): any {
    return securityConfig;
  },

  /**
   * 获取安全中间件
   */
  getMiddleware(): any {
    return securityMain.middleware;
  },

  /**
   * 获取安全工具
   */
  getUtils(): any {
    return securityMain.security;
  },

  /**
   * 创建安全中间件链
   */
  createSecurityChain(options?: any): any[] {
    return securityModuleInstance.createSecurityChain(options);
  },

  /**
   * 创建认证中间件链
   */
  createAuthChain(options?: any): any[] {
    return securityModuleInstance.createAuthChain(options);
  },

  /**
   * 创建速率限制中间件
   */
  createRateLimit(options?: any): any {
    return securityModuleInstance.createRateLimit(options);
  },

  /**
   * 创建IP黑名单中间件
   */
  createIpBlacklist(blacklistedIps?: string[]): any {
    return securityModuleInstance.createIpBlacklist(blacklistedIps);
  },

  /**
   * 创建验证中间件
   */
  createValidationMiddleware(schema: any): any {
    return securityModuleInstance.createValidationMiddleware(schema);
  },

  /**
   * 创建权限中间件
   */
  createPermissionMiddleware(...permissions: string[]): any {
    return securityModuleInstance.createPermissionMiddleware(...permissions);
  },

  /**
   * 创建角色中间件
   */
  createRoleMiddleware(...roles: string[]): any {
    return securityModuleInstance.createRoleMiddleware(...roles);
  },

  /**
   * 创建资源访问中间件
   */
  createResourceAccessMiddleware(resourceType: string, action: string, getResourceId?: (req: any) => number): any {
    return securityModuleInstance.createResourceAccessMiddleware(resourceType, action, getResourceId);
  },

  /**
   * 创建所有权中间件
   */
  createOwnershipMiddleware(getResourceOwnerId: (req: any) => Promise<number | null>): any {
    return securityModuleInstance.createOwnershipMiddleware(getResourceOwnerId);
  },

  /**
   * 记录安全事件
   */
  async logEvent(event: string, data: any): Promise<void> {
    await securityModuleInstance.logEvent(event, data);
  },

  /**
   * 查询安全日志
   */
  async queryLogs(options: any): Promise<any[]> {
    return await securityModuleInstance.queryLogs(options);
  },

  /**
   * 获取安全统计
   */
  async getStatistics(): Promise<any> {
    return await securityModuleInstance.getStatistics();
  },

  /**
   * 检测异常活动
   */
  async detectAnomalies(): Promise<any> {
    return await securityModuleInstance.detectAnomalies();
  },

  /**
   * 加密数据
   */
  encrypt(data: string): string {
    return encryptionManager.encrypt(data);
  },

  /**
   * 解密数据
   */
  decrypt(encryptedData: string): string {
    return encryptionManager.decrypt(encryptedData);
  },

  /**
   * 哈希数据
   */
  hash(data: string): { hash: string; salt: string } {
    return encryptionManager.hash(data);
  },

  /**
   * 验证哈希
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    return encryptionManager.verifyHash(data, hash, salt);
  },

  /**
   * 数据脱敏
   */
  maskData(data: any): any {
    return encryptionManager.autoMask(data);
  },

  /**
   * 生成Token对
   */
  generateTokenPair(payload: any): { accessToken: string; refreshToken: string } {
    return jwtUtils.generateTokenPair(payload);
  },

  /**
   * 验证Token
   */
  verifyToken(token: string): any {
    return jwtUtils.verifyAccessToken(token);
  },

  /**
   * 刷新Token
   */
  async refreshToken(userId: number, refreshToken: string): Promise<any> {
    return await jwtUtils.refreshTokenPair(userId, refreshToken);
  },

  /**
   * 检查权限
   */
  hasPermission(role: string, permission: string): boolean {
    return permissionManager.hasPermission(role as any, permission as any);
  },

  /**
   * 检查角色
   */
  hasRole(userRole: string, requiredRole: string): boolean {
    return userRole === requiredRole;
  },

  /**
   * 验证输入
   */
  validateInput(data: any, rules: any): any {
    return inputValidator.validateObject(data, rules);
  },

  /**
   * 清理字符串
   */
  sanitizeString(input: string): string {
    return inputValidator.sanitizeString(input);
  },

  /**
   * 验证密码强度
   */
  validatePassword(password: string): any {
    return inputValidator.validatePassword(password);
  },

  /**
   * 生成随机字符串
   */
  generateRandomString(length?: number): string {
    return encryptionManager.generateRandomString(length);
  },

  /**
   * 生成UUID
   */
  generateUUID(): string {
    return encryptionManager.generateUUID();
  },

  /**
   * 生成签名
   */
  generateSignature(data: string, secret: string): string {
    return encryptionManager.generateSignature(data, secret);
  },

  /**
   * 验证签名
   */
  verifySignature(data: string, signature: string, secret: string): boolean {
    return encryptionManager.verifySignature(data, signature, secret);
  },
};

// 导出所有安全相关模块
export {
  // 安全模块
  securityModuleInstance,
  SecurityModule,

  // 安全配置
  securityConfig,
  validateSecurityConfig,

  // 安全中间件
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

  // 安全工具
  security,
};

export default securityMain;