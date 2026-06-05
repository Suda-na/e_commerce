/**
 * 安全功能测试
 * 测试安全工具和中间件的功能
 */

import { security } from '../utils/security';
import { inputValidator } from '../utils/input-validator';
import { encryptionManager } from '../utils/encryption';
import { securityAudit } from '../utils/security-audit';
import { permissionManager } from '../utils/permission';

describe('安全功能测试', () => {
  // ==================== 输入验证测试 ====================
  
  describe('输入验证', () => {
    test('验证用户名', () => {
      // 有效用户名
      const validResult = inputValidator.validateUsername('john_doe');
      expect(validResult.isValid).toBe(true);
      expect(validResult.sanitizedValue).toBe('john_doe');

      // 无效用户名 - 太短
      const shortResult = inputValidator.validateUsername('ab');
      expect(shortResult.isValid).toBe(false);
      expect(shortResult.errors).toContain('用户名长度不能少于3个字符');

      // 无效用户名 - 包含特殊字符
      const specialResult = inputValidator.validateUsername('john@doe');
      expect(specialResult.isValid).toBe(false);
      expect(shortResult.errors).toContain('用户名只能包含字母、数字和下划线');
    });

    test('验证密码强度', () => {
      // 强密码
      const strongResult = inputValidator.validatePassword('StrongPass123!');
      expect(strongResult.isValid).toBe(true);

      // 弱密码 - 太短
      const shortResult = inputValidator.validatePassword('Pass1!');
      expect(shortResult.isValid).toBe(false);
      expect(shortResult.errors).toContain('密码长度不能少于8个字符');

      // 弱密码 - 缺少大写字母
      const noUpperResult = inputValidator.validatePassword('strongpass123!');
      expect(noUpperResult.isValid).toBe(false);
      expect(noUpperResult.errors).toContain('密码必须包含至少一个大写字母');

      // 弱密码 - 缺少特殊字符
      const noSpecialResult = inputValidator.validatePassword('StrongPass123');
      expect(noSpecialResult.isValid).toBe(false);
      expect(noSpecialResult.errors).toContain('密码必须包含至少一个特殊字符');
    });

    test('验证邮箱', () => {
      // 有效邮箱
      const validResult = inputValidator.validateEmail('test@example.com');
      expect(validResult.isValid).toBe(true);
      expect(validResult.sanitizedValue).toBe('test@example.com');

      // 无效邮箱
      const invalidResult = inputValidator.validateEmail('invalid-email');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('邮箱地址格式不正确');
    });

    test('验证手机号', () => {
      // 有效手机号
      const validResult = inputValidator.isValidPhone('13800138000');
      expect(validResult).toBe(true);

      // 无效手机号
      const invalidResult = inputValidator.isValidPhone('1234567890');
      expect(invalidResult).toBe(false);
    });

    test('验证对象', () => {
      const schema = {
        username: {
          required: true,
          type: 'string' as const,
          minLength: 3,
          maxLength: 30,
        },
        email: {
          required: true,
          type: 'email' as const,
        },
        age: {
          type: 'number' as const,
          min: 0,
          max: 150,
        },
      };

      // 有效对象
      const validData = {
        username: 'john_doe',
        email: 'john@example.com',
        age: 25,
      };
      const validResult = inputValidator.validateObject(validData, schema);
      expect(validResult.isValid).toBe(true);

      // 无效对象
      const invalidData = {
        username: 'ab', // 太短
        email: 'invalid-email', // 无效邮箱
        age: 200, // 超出范围
      };
      const invalidResult = inputValidator.validateObject(invalidData, schema);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  // ==================== 数据加密测试 ====================
  
  describe('数据加密', () => {
    test('加密和解密数据', () => {
      const originalText = 'Hello, World!';
      const encrypted = encryptionManager.encrypt(originalText);
      const decrypted = encryptionManager.decrypt(encrypted);

      expect(encrypted).not.toBe(originalText);
      expect(decrypted).toBe(originalText);
    });

    test('哈希和验证', () => {
      const password = 'MySecurePassword123!';
      const { hash, salt } = encryptionManager.hash(password);

      expect(hash).toBeDefined();
      expect(salt).toBeDefined();

      // 验证正确密码
      const isValid = encryptionManager.verifyHash(password, hash, salt);
      expect(isValid).toBe(true);

      // 验证错误密码
      const isInvalid = encryptionManager.verifyHash('WrongPassword', hash, salt);
      expect(isInvalid).toBe(false);
    });

    test('数据脱敏', () => {
      // 手机号脱敏
      const maskedPhone = encryptionManager.maskPhone('13800138000');
      expect(maskedPhone).toBe('138****8000');

      // 邮箱脱敏
      const maskedEmail = encryptionManager.maskEmail('john@example.com');
      expect(maskedEmail).toBe('j**n@example.com');

      // 身份证脱敏
      const maskedIdCard = encryptionManager.maskIdCard('110101199001011234');
      expect(maskedIdCard).toBe('1101**********1234');

      // 银行卡脱敏
      const maskedBankCard = encryptionManager.maskBankCard('6222021234567890123');
      expect(maskedBankCard).toBe('6222 **** **** 0123');
    });

    test('自动脱敏', () => {
      const sensitiveData = {
        username: 'john_doe',
        email: 'john@example.com',
        phone: '13800138000',
        password: 'secret123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiam9obiIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjE2MTYxNjE2fQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      };

      const maskedData = encryptionManager.autoMask(sensitiveData);

      expect(maskedData.username).toBe('john_doe'); // 用户名不脱敏
      expect(maskedData.email).toBe('j**n@example.com');
      expect(maskedData.phone).toBe('138****8000');
      expect(maskedData.password).toBe('********');
      expect(maskedData.token).toContain('...');
    });

    test('签名生成和验证', () => {
      const data = 'Hello, World!';
      const secret = 'my-secret-key';

      const signature = encryptionManager.generateSignature(data, secret);
      expect(signature).toBeDefined();

      // 验证正确签名
      const isValid = encryptionManager.verifySignature(data, signature, secret);
      expect(isValid).toBe(true);

      // 验证错误签名
      const isInvalid = encryptionManager.verifySignature(data, 'invalid-signature', secret);
      expect(isInvalid).toBe(false);
    });
  });

  // ==================== 权限控制测试 ====================
  
  describe('权限控制', () => {
    test('角色权限检查', () => {
      // 用户角色
      expect(permissionManager.hasPermission('user', 'user:read')).toBe(true);
      expect(permissionManager.hasPermission('user', 'admin:read')).toBe(false);

      // 商家角色
      expect(permissionManager.hasPermission('merchant', 'product:write')).toBe(true);
      expect(permissionManager.hasPermission('merchant', 'admin:read')).toBe(false);

      // 管理员角色
      expect(permissionManager.hasPermission('admin', 'admin:read')).toBe(true);
      expect(permissionManager.hasPermission('admin', 'system:config')).toBe(true);
    });

    test('多权限检查', () => {
      // 检查所有权限
      expect(permissionManager.hasAllPermissions('admin', ['user:read', 'product:read'])).toBe(true);
      expect(permissionManager.hasAllPermissions('user', ['user:read', 'admin:read'])).toBe(false);

      // 检查任一权限
      expect(permissionManager.hasAnyPermission('user', ['user:read', 'admin:read'])).toBe(true);
      expect(permissionManager.hasAnyPermission('user', ['admin:read', 'system:config'])).toBe(false);
    });

    test('获取角色权限', () => {
      const userPermissions = permissionManager.getRolePermissions('user');
      expect(userPermissions).toContain('user:read');
      expect(userPermissions).toContain('product:read');
      expect(userPermissions).not.toContain('admin:read');

      const adminPermissions = permissionManager.getRolePermissions('admin');
      expect(adminPermissions).toContain('admin:read');
      expect(adminPermissions).toContain('system:config');
    });
  });

  // ==================== 审计日志测试 ====================
  
  describe('审计日志', () => {
    test('记录审计事件', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      await securityAudit.log('login_success', {
        userId: 1,
        username: 'testuser',
        ip: '127.0.0.1',
        message: '测试登录成功',
      });

      // 验证日志记录（这里只是示例，实际验证可能需要检查文件或数据库）
      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });

    test('查询审计日志', async () => {
      const logs = await securityAudit.query({
        limit: 10,
      });

      expect(Array.isArray(logs)).toBe(true);
    });

    test('获取统计信息', async () => {
      const statistics = await securityAudit.getStatistics();

      expect(statistics).toHaveProperty('totalEvents');
      expect(statistics).toHaveProperty('eventsByType');
      expect(statistics).toHaveProperty('eventsByLevel');
      expect(statistics).toHaveProperty('topIps');
      expect(statistics).toHaveProperty('topUsers');
    });

    test('检测异常活动', async () => {
      const anomalies = await securityAudit.detectAnomalies();

      expect(anomalies).toHaveProperty('suspiciousIps');
      expect(anomalies).toHaveProperty('bruteForceAttempts');
      expect(anomalies).toHaveProperty('unusualPatterns');
      expect(Array.isArray(anomalies.suspiciousIps)).toBe(true);
    });
  });

  // ==================== 安全配置测试 ====================
  
  describe('安全配置', () => {
    test('安全配置验证', () => {
      // 测试配置验证函数
      expect(() => security.validateConfig()).not.toThrow();
    });

    test('安全状态检查', async () => {
      const status = await security.getSecurityStatus();

      expect(status).toHaveProperty('configValid');
      expect(status).toHaveProperty('auditEnabled');
      expect(status).toHaveProperty('encryptionEnabled');
      expect(status).toHaveProperty('httpsEnabled');
      expect(status).toHaveProperty('csrfEnabled');
      expect(status).toHaveProperty('signatureEnabled');
      expect(status).toHaveProperty('recentAlerts');
      expect(status).toHaveProperty('suspiciousIps');
    });

    test('安全检查', async () => {
      const checkResult = await security.runSecurityCheck();

      expect(checkResult).toHaveProperty('passed');
      expect(checkResult).toHaveProperty('issues');
      expect(checkResult).toHaveProperty('recommendations');
      expect(Array.isArray(checkResult.issues)).toBe(true);
      expect(Array.isArray(checkResult.recommendations)).toBe(true);
    });

    test('生成安全报告', async () => {
      const report = await security.generateSecurityReport();

      expect(typeof report).toBe('string');
      expect(report).toContain('# 安全状态报告');
      expect(report).toContain('## 系统状态');
      expect(report).toContain('## 安全检查');
    });
  });

  // ==================== JWT测试 ====================
  
  describe('JWT功能', () => {
    test('生成和验证Token', () => {
      const payload = {
        userId: 1,
        username: 'testuser',
        role: 'user' as const,
      };

      // 生成Access Token
      const accessToken = security.jwt.generateAccessToken(payload);
      expect(accessToken).toBeDefined();

      // 验证Access Token
      const decoded = security.jwt.verifyAccessToken(accessToken);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
      expect(decoded.role).toBe(payload.role);
    });

    test('生成Token对', () => {
      const payload = {
        userId: 1,
        username: 'testuser',
        role: 'user' as const,
      };

      const { accessToken, refreshToken } = security.jwt.generateTokenPair(payload);

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(accessToken).not.toBe(refreshToken);

      // 验证两个Token
      const accessPayload = security.jwt.verifyAccessToken(accessToken);
      expect(accessPayload.userId).toBe(payload.userId);
    });

    test('Token过期时间', () => {
      const expirationTime = security.jwt.getTokenExpirationTime();
      expect(expirationTime).toBeGreaterThan(0);

      const refreshExpirationTime = security.jwt.getRefreshTokenExpirationTime();
      expect(refreshExpirationTime).toBeGreaterThan(expirationTime);
    });
  });

  // ==================== 集成测试 ====================
  
  describe('安全功能集成', () => {
    test('完整的安全流程', async () => {
      // 1. 验证输入
      const userInput = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'StrongPass123!',
      };

      const validationResult = inputValidator.validateObject(userInput, {
        username: {
          required: true,
          type: 'string',
          minLength: 3,
          maxLength: 30,
        },
        email: {
          required: true,
          type: 'email',
        },
        password: {
          required: true,
          type: 'string',
          minLength: 8,
        },
      });

      expect(validationResult.isValid).toBe(true);

      // 2. 验证密码强度
      const passwordValidation = inputValidator.validatePassword(userInput.password);
      expect(passwordValidation.isValid).toBe(true);

      // 3. 加密敏感数据
      const encryptedEmail = encryptionManager.encrypt(userInput.email);
      expect(encryptedEmail).not.toBe(userInput.email);

      // 4. 生成Token
      const tokenPayload = {
        userId: 1,
        username: userInput.username,
        role: 'user' as const,
      };

      const { accessToken, refreshToken } = security.jwt.generateTokenPair(tokenPayload);
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();

      // 5. 验证Token
      const decodedToken = security.jwt.verifyAccessToken(accessToken);
      expect(decodedToken.userId).toBe(1);

      // 6. 记录审计日志
      await securityAudit.log('login_success', {
        userId: 1,
        username: userInput.username,
        ip: '127.0.0.1',
      });

      // 7. 检查权限
      const hasPermission = permissionManager.hasPermission('user', 'user:read');
      expect(hasPermission).toBe(true);

      // 8. 数据脱敏
      const maskedData = encryptionManager.autoMask({
        email: userInput.email,
        password: userInput.password,
      });

      expect(maskedData.email).toContain('@example.com');
      expect(maskedData.password).toBe('********');
    });
  });
});