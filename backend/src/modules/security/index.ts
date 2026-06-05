/**
 * 安全模块
 * 整合所有安全相关的功能
 */

import { securityModule } from '../../security';
import { securityMiddleware } from '../../middleware/security';
import securityUtils from '../../utils/security/index';
import { securityConfig } from '../../config/security';

/**
 * 安全模块主类
 */
export class SecurityModule {
  private static instance: SecurityModule;
  private initialized = false;

  private constructor() {}

  /**
   * 获取安全模块单例
   */
  static getInstance(): SecurityModule {
    if (!SecurityModule.instance) {
      SecurityModule.instance = new SecurityModule();
    }
    return SecurityModule.instance;
  }

  /**
   * 初始化安全模块
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('安全模块已经初始化');
      return;
    }

    try {
      await securityModule.initialize();
      this.initialized = true;
      console.log('安全模块初始化完成');
    } catch (error) {
      console.error('安全模块初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取安全状态
   */
  async getStatus(): Promise<any> {
    this.ensureInitialized();
    return await securityModule.getStatus();
  }

  /**
   * 运行安全检查
   */
  async runCheck(): Promise<any> {
    this.ensureInitialized();
    return await securityModule.runCheck();
  }

  /**
   * 生成安全报告
   */
  async generateReport(): Promise<string> {
    this.ensureInitialized();
    return await securityModule.generateReport();
  }

  /**
   * 获取安全配置
   */
  getConfig(): any {
    return securityConfig;
  }

  /**
   * 获取安全中间件
   */
  getMiddleware(): any {
    return securityMiddleware;
  }

  /**
   * 获取安全工具
   */
  getUtils(): any {
    return securityUtils;
  }

  /**
   * 创建安全中间件链
   */
  createSecurityChain(options?: any): any[] {
    return securityMiddleware.createSecurityChain(options);
  }

  /**
   * 创建认证中间件链
   */
  createAuthChain(options?: any): any[] {
    return securityMiddleware.createAuthChain(options);
  }

  /**
   * 创建速率限制中间件
   */
  createRateLimit(options?: any): any {
    return securityMiddleware.createRateLimit(options);
  }

  /**
   * 创建IP黑名单中间件
   */
  createIpBlacklist(blacklistedIps?: string[]): any {
    return securityMiddleware.createIpBlacklist(blacklistedIps);
  }

  /**
   * 创建验证中间件
   */
  createValidationMiddleware(schema: any): any {
    return securityUtils.createValidationMiddleware(schema);
  }

  /**
   * 创建权限中间件
   */
  createPermissionMiddleware(...permissions: string[]): any {
    return securityUtils.createPermissionMiddleware(...permissions);
  }

  /**
   * 创建角色中间件
   */
  createRoleMiddleware(...roles: string[]): any {
    return securityUtils.createRoleMiddleware(...roles);
  }

  /**
   * 创建资源访问中间件
   */
  createResourceAccessMiddleware(resourceType: string, action: string, getResourceId?: (req: any) => number): any {
    return securityUtils.createResourceAccessMiddleware(resourceType, action, getResourceId);
  }

  /**
   * 创建所有权中间件
   */
  createOwnershipMiddleware(getResourceOwnerId: (req: any) => Promise<number | null>): any {
    return securityUtils.createOwnershipMiddleware(getResourceOwnerId);
  }

  /**
   * 记录安全事件
   */
  async logEvent(event: string, data: any): Promise<void> {
    this.ensureInitialized();
    await securityModule.logEvent(event, data);
  }

  /**
   * 查询安全日志
   */
  async queryLogs(options: any): Promise<any[]> {
    this.ensureInitialized();
    return await securityModule.queryLogs(options);
  }

  /**
   * 获取安全统计
   */
  async getStatistics(): Promise<any> {
    this.ensureInitialized();
    return await securityModule.getStatistics();
  }

  /**
   * 检测异常活动
   */
  async detectAnomalies(): Promise<any> {
    this.ensureInitialized();
    return await securityModule.detectAnomalies();
  }

  /**
   * 加密数据
   */
  encrypt(data: string): string {
    return securityUtils.encrypt(data);
  }

  /**
   * 解密数据
   */
  decrypt(encryptedData: string): string {
    return securityUtils.decrypt(encryptedData);
  }

  /**
   * 哈希数据
   */
  hash(data: string): { hash: string; salt: string } {
    return securityUtils.hash(data);
  }

  /**
   * 验证哈希
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    return securityUtils.verifyHash(data, hash, salt);
  }

  /**
   * 数据脱敏
   */
  maskData(data: any): any {
    return securityUtils.maskData(data);
  }

  /**
   * 生成Token对
   */
  generateTokenPair(payload: any): { accessToken: string; refreshToken: string } {
    return securityUtils.generateTokenPair(payload);
  }

  /**
   * 验证Token
   */
  verifyToken(token: string): any {
    return securityUtils.verifyToken(token);
  }

  /**
   * 刷新Token
   */
  async refreshToken(userId: number, refreshToken: string): Promise<any> {
    return await securityUtils.refreshToken(userId, refreshToken);
  }

  /**
   * 检查权限
   */
  hasPermission(role: string, permission: string): boolean {
    return securityUtils.hasPermission(role, permission);
  }

  /**
   * 检查角色
   */
  hasRole(userRole: string, requiredRole: string): boolean {
    return securityUtils.hasRole(userRole, requiredRole);
  }

  /**
   * 验证输入
   */
  validateInput(data: any, rules: any): any {
    return securityUtils.validateInput(data, rules);
  }

  /**
   * 清理字符串
   */
  sanitizeString(input: string): string {
    return securityUtils.sanitizeString(input);
  }

  /**
   * 验证密码强度
   */
  validatePassword(password: string): any {
    return securityUtils.validatePassword(password);
  }

  /**
   * 生成随机字符串
   */
  generateRandomString(length?: number): string {
    return securityUtils.generateRandomString(length);
  }

  /**
   * 生成UUID
   */
  generateUUID(): string {
    return securityUtils.generateUUID();
  }

  /**
   * 生成签名
   */
  generateSignature(data: string, secret: string): string {
    return securityUtils.generateSignature(data, secret);
  }

  /**
   * 验证签名
   */
  verifySignature(data: string, signature: string, secret: string): boolean {
    return securityUtils.verifySignature(data, signature, secret);
  }

  /**
   * 确保模块已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('安全模块未初始化，请先调用 initialize() 方法');
    }
  }
}

// 导出安全模块单例
export const securityModuleInstance = SecurityModule.getInstance();

// 导出安全模块相关组件
export { securityModule } from '../../security';
export { securityMiddleware } from '../../middleware/security';
export { default as securityUtils } from '../../utils/security';
export { securityConfig } from '../../config/security';

export default securityModuleInstance;