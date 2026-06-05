import crypto from 'crypto';
import { securityConfig } from '../config/security.config';
import { logger } from './logger';

/**
 * 加密工具类
 * 提供数据加密、解密、脱敏等功能
 */

// 加密算法配置
const ALGORITHM = securityConfig.dataSecurity.encryption.algorithm;
const KEY = securityConfig.dataSecurity.encryption.key;
const IV_LENGTH = securityConfig.dataSecurity.encryption.ivLength;
const AUTH_TAG_LENGTH = securityConfig.dataSecurity.encryption.authTagLength;

/**
 * 加密管理器
 */
export const encryptionManager = {
  /**
   * 生成加密密钥
   */
  generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  },

  /**
   * 生成初始化向量
   */
  generateIV(): Buffer {
    return crypto.randomBytes(IV_LENGTH);
  },

  /**
   * 加密数据
   */
  encrypt(text: string): string {
    try {
      if (!KEY) {
        throw new Error('Encryption key is not configured');
      }

      const iv = this.generateIV();
      const key = Buffer.from(KEY, 'hex');
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // 返回格式: iv:authTag:encrypted
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw error;
    }
  },

  /**
   * 解密数据
   */
  decrypt(encryptedText: string): string {
    try {
      if (!KEY) {
        throw new Error('Encryption key is not configured');
      }

      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      const key = Buffer.from(KEY, 'hex');

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw error;
    }
  },

  /**
   * 哈希数据（单向加密）
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    try {
      const saltValue = salt || crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(data, saltValue, 10000, 64, 'sha512').toString('hex');
      return { hash, salt: saltValue };
    } catch (error) {
      logger.error('Hashing failed:', error);
      throw error;
    }
  },

  /**
   * 验证哈希
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    try {
      const { hash: computedHash } = this.hash(data, salt);
      return computedHash === hash;
    } catch (error) {
      logger.error('Hash verification failed:', error);
      return false;
    }
  },

  /**
   * 生成随机字符串
   */
  generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
  },

  /**
   * 生成随机数字
   */
  generateRandomNumber(length: number = 6): string {
    const digits = '0123456789';
    let result = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += digits[randomBytes[i] % 10];
    }
    return result;
  },

  /**
   * 生成UUID
   */
  generateUUID(): string {
    return crypto.randomUUID();
  },

  /**
   * 数据脱敏
   */
  maskData(data: any, rules?: Record<string, (value: any) => any>): any {
    if (typeof data === 'string') {
      return this.maskString(data);
    }
    if (Array.isArray(data)) {
      return data.map(item => this.maskData(item, rules));
    }
    if (typeof data === 'object' && data !== null) {
      const masked: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (rules && rules[key]) {
          masked[key] = rules[key](value);
        } else {
          masked[key] = this.maskData(value, rules);
        }
      }
      return masked;
    }
    return data;
  },

  /**
   * 字符串脱敏
   */
  maskString(str: string, visibleStart: number = 3, visibleEnd: number = 4): string {
    if (!str || str.length <= visibleStart + visibleEnd) {
      return str;
    }
    const start = str.substring(0, visibleStart);
    const end = str.substring(str.length - visibleEnd);
    const masked = '*'.repeat(str.length - visibleStart - visibleEnd);
    return `${start}${masked}${end}`;
  },

  /**
   * 手机号脱敏
   */
  maskPhone(phone: string): string {
    if (!phone || phone.length < 7) {
      return phone;
    }
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  },

  /**
   * 邮箱脱敏
   */
  maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return email;
    }
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? `${username[0]}${'*'.repeat(username.length - 2)}${username[username.length - 1]}`
      : '*'.repeat(username.length);
    return `${maskedUsername}@${domain}`;
  },

  /**
   * 身份证号脱敏
   */
  maskIdCard(idCard: string): string {
    if (!idCard || idCard.length < 8) {
      return idCard;
    }
    return idCard.replace(/(\d{4})\d{10}(\d{4})/, '$1**********$2');
  },

  /**
   * 银行卡号脱敏
   */
  maskBankCard(cardNumber: string): string {
    if (!cardNumber || cardNumber.length < 8) {
      return cardNumber;
    }
    return cardNumber.replace(/(\d{4})\d*(\d{4})/, '$1 **** **** $2');
  },

  /**
   * 密码脱敏
   */
  maskPassword(password: string): string {
    return '********';
  },

  /**
   * Token脱敏
   */
  maskToken(token: string): string {
    if (!token || token.length < 10) {
      return '********';
    }
    return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
  },

  /**
   * IP地址脱敏
   */
  maskIP(ip: string): string {
    if (!ip) {
      return ip;
    }
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
    return ip;
  },

  /**
   * 敏感字段脱敏规则
   */
  sensitiveFieldRules: {
    password: (value: any) => '********',
    token: (value: any) => typeof value === 'string' ? encryptionManager.maskToken(value) : value,
    secret: (value: any) => '********',
    key: (value: any) => '********',
    authorization: (value: any) => typeof value === 'string' ? encryptionManager.maskToken(value) : value,
    cookie: (value: any) => '********',
    session: (value: any) => '********',
    credit_card: (value: any) => typeof value === 'string' ? encryptionManager.maskBankCard(value) : value,
    ssn: (value: any) => typeof value === 'string' ? encryptionManager.maskIdCard(value) : value,
    phone: (value: any) => typeof value === 'string' ? encryptionManager.maskPhone(value) : value,
    email: (value: any) => typeof value === 'string' ? encryptionManager.maskEmail(value) : value,
    address: (value: any) => typeof value === 'string' ? encryptionManager.maskString(value, 2, 2) : value,
    id_card: (value: any) => typeof value === 'string' ? encryptionManager.maskIdCard(value) : value,
    passport: (value: any) => typeof value === 'string' ? encryptionManager.maskString(value, 2, 4) : value,
    ip: (value: any) => typeof value === 'string' ? encryptionManager.maskIP(value) : value,
  },

  /**
   * 自动脱敏对象
   */
  autoMask(obj: any): any {
    return this.maskData(obj, this.sensitiveFieldRules);
  },

  /**
   * 日志脱敏
   */
  sanitizeForLog(data: any): any {
    return this.autoMask(data);
  },

  /**
   * 数据库字段加密
   */
  encryptField(value: string): string {
    return this.encrypt(value);
  },

  /**
   * 数据库字段解密
   */
  decryptField(encryptedValue: string): string {
    return this.decrypt(encryptedValue);
  },

  /**
   * 批量加密对象字段
   */
  encryptObjectFields(obj: Record<string, any>, fields: string[]): Record<string, any> {
    const encrypted = { ...obj };
    for (const field of fields) {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }
    return encrypted;
  },

  /**
   * 批量解密对象字段
   */
  decryptObjectFields(obj: Record<string, any>, fields: string[]): Record<string, any> {
    const decrypted = { ...obj };
    for (const field of fields) {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        try {
          decrypted[field] = this.decrypt(decrypted[field]);
        } catch (error) {
          logger.error(`Failed to decrypt field ${field}:`, error);
        }
      }
    }
    return decrypted;
  },

  /**
   * 生成签名
   */
  generateSignature(data: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  },

  /**
   * 验证签名
   */
  verifySignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  },

  /**
   * 生成API密钥对
   */
  generateApiKeyPair(): { publicKey: string; privateKey: string } {
    const privateKey = this.generateRandomString(64);
    const publicKey = this.generateRandomString(32);
    return { publicKey, privateKey };
  },
};

export default encryptionManager;