/**
 * 安全工具索引
 * 整合所有安全相关的工具
 */

// 导入安全配置
import { securityConfig, validateSecurityConfig } from '../../config/security.config';

// 导入输入验证工具
import inputValidator, { commonValidationRules } from '../input-validator';

// 导入安全审计工具
import securityAudit from '../security-audit';

// 导入权限控制工具
import permissionManager, {
  requirePermission,
  requireResourceAccess,
  requireRole,
  requireOwnership,
  conditionalPermission,
  complexPermission,
} from '../permission';

// 导入加密工具
import encryptionManager from '../encryption';

// 导入JWT工具
import { jwtUtils } from '../jwt';

// 导入安全工具
import security from '../security';

/**
 * 安全工具集合
 */
export const securityUtils = {
  // 配置
  config: securityConfig,
  validateConfig: validateSecurityConfig,

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
   * 初始化安全工具
   */
  async initialize(): Promise<void> {
    try {
      await security.initialize();
      console.log('安全工具初始化完成');
    } catch (error) {
      console.error('安全工具初始化失败:', error);
      throw error;
    }
  },

  /**
   * 获取安全状态
   */
  async getStatus(): Promise<any> {
    return await security.getSecurityStatus();
  },

  /**
   * 运行安全检查
   */
  async runCheck(): Promise<any> {
    return await security.runSecurityCheck();
  },

  /**
   * 生成安全报告
   */
  async generateReport(): Promise<string> {
    return await security.generateSecurityReport();
  },

  /**
   * 记录安全事件
   */
  async logEvent(event: string, data: any): Promise<void> {
    await securityAudit.log(event as any, data);
  },

  /**
   * 查询安全日志
   */
  async queryLogs(options: any): Promise<any[]> {
    return await securityAudit.query(options);
  },

  /**
   * 获取安全统计
   */
  async getStatistics(): Promise<any> {
    return await securityAudit.getStatistics();
  },

  /**
   * 检测异常活动
   */
  async detectAnomalies(): Promise<any> {
    return await securityAudit.detectAnomalies();
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

  /**
   * 创建验证中间件
   */
  createValidationMiddleware(schema: any) {
    return inputValidator.createValidationMiddleware(schema);
  },

  /**
   * 创建权限中间件
   */
  createPermissionMiddleware(...permissions: string[]) {
    return requirePermission(...permissions as any[]);
  },

  /**
   * 创建角色中间件
   */
  createRoleMiddleware(...roles: string[]) {
    return requireRole(...roles as any[]);
  },

  /**
   * 创建资源访问中间件
   */
  createResourceAccessMiddleware(resourceType: string, action: string, getResourceId?: (req: any) => number) {
    return requireResourceAccess(resourceType as any, action as any, getResourceId);
  },

  /**
   * 创建所有权中间件
   */
  createOwnershipMiddleware(getResourceOwnerId: (req: any) => Promise<number | null>) {
    return requireOwnership(getResourceOwnerId);
  },
};

// 导出所有安全工具
export {
  // 配置
  securityConfig,
  validateSecurityConfig,

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

export default securityUtils;