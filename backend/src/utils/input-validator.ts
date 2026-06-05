import validator from 'validator';
import { securityConfig } from '../config/security.config';
import { ValidationError } from '../middleware/errorHandler';

function sanitizeXss(input: string, options: { whiteList: Record<string, string[]>; stripIgnoreTag: boolean; stripIgnoreTagBody: string[] }): string {
  return input.replace(/<[^>]*>/g, (tag) => {
    const tagName = tag.match(/<\s*\/?\s*(\w+)/)?.[1]?.toLowerCase();
    if (tagName && options.whiteList[tagName]) {
      return tag;
    }
    if (options.stripIgnoreTagBody.includes(tagName || '')) {
      return '';
    }
    return options.stripIgnoreTag ? '' : tag;
  });
}

/**
 * 输入验证工具类
 * 提供各种输入验证和清理功能
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

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

/**
 * 通用输入验证器
 */
export const inputValidator = {
  /**
   * 验证单个字段
   */
  validateField(value: any, rules: ValidationRule, fieldName: string): ValidationResult {
    const errors: string[] = [];
    let sanitizedValue = value;

    // 检查必填字段
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${fieldName}是必填字段`);
      return { isValid: false, errors };
    }

    // 如果值为空且不是必填，直接返回有效
    if (value === undefined || value === null || value === '') {
      return { isValid: true, errors: [], sanitizedValue: value };
    }

    // 类型验证
    if (rules.type) {
      switch (rules.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`${fieldName}必须是字符串`);
          }
          break;
        case 'number':
          if (typeof value !== 'number' && isNaN(Number(value))) {
            errors.push(`${fieldName}必须是数字`);
          } else {
            sanitizedValue = Number(value);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            errors.push(`${fieldName}必须是布尔值`);
          } else {
            sanitizedValue = value === true || value === 'true';
          }
          break;
        case 'email':
          if (!validator.isEmail(String(value))) {
            errors.push(`${fieldName}必须是有效的邮箱地址`);
          }
          break;
        case 'phone':
          if (!this.isValidPhone(String(value))) {
            errors.push(`${fieldName}必须是有效的手机号码`);
          }
          break;
        case 'url':
          if (!validator.isURL(String(value))) {
            errors.push(`${fieldName}必须是有效的URL`);
          }
          break;
        case 'date':
          if (!validator.isISO8601(String(value))) {
            errors.push(`${fieldName}必须是有效的日期格式`);
          }
          break;
        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`${fieldName}必须是数组`);
          }
          break;
        case 'object':
          if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push(`${fieldName}必须是对象`);
          }
          break;
      }
    }

    // 字符串长度验证
    if (typeof sanitizedValue === 'string') {
      if (rules.minLength !== undefined && sanitizedValue.length < rules.minLength) {
        errors.push(`${fieldName}长度不能少于${rules.minLength}个字符`);
      }
      if (rules.maxLength !== undefined && sanitizedValue.length > rules.maxLength) {
        errors.push(`${fieldName}长度不能超过${rules.maxLength}个字符`);
      }
    }

    // 数字范围验证
    if (typeof sanitizedValue === 'number') {
      if (rules.min !== undefined && sanitizedValue < rules.min) {
        errors.push(`${fieldName}不能小于${rules.min}`);
      }
      if (rules.max !== undefined && sanitizedValue > rules.max) {
        errors.push(`${fieldName}不能大于${rules.max}`);
      }
    }

    // 正则表达式验证
    if (rules.pattern && typeof sanitizedValue === 'string') {
      if (!rules.pattern.test(sanitizedValue)) {
        errors.push(`${fieldName}格式不正确`);
      }
    }

    // 自定义验证
    if (rules.custom) {
      const customResult = rules.custom(sanitizedValue);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `${fieldName}验证失败`);
      }
    }

    // 清理和转换
    if (rules.sanitize && typeof sanitizedValue === 'string') {
      sanitizedValue = this.sanitizeString(sanitizedValue);
    }
    if (rules.trim && typeof sanitizedValue === 'string') {
      sanitizedValue = sanitizedValue.trim();
    }
    if (rules.lowercase && typeof sanitizedValue === 'string') {
      sanitizedValue = sanitizedValue.toLowerCase();
    }
    if (rules.uppercase && typeof sanitizedValue === 'string') {
      sanitizedValue = sanitizedValue.toUpperCase();
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue,
    };
  },

  /**
   * 验证整个对象
   */
  validateObject(data: any, schema: Record<string, ValidationRule>): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any = {};

    for (const [field, rules] of Object.entries(schema)) {
      const result = this.validateField(data[field], rules, field);
      if (!result.isValid) {
        errors.push(...result.errors);
      }
      sanitizedData[field] = result.sanitizedValue;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitizedData,
    };
  },

  /**
   * 清理字符串，防止XSS攻击
   */
  sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return input;
    }

    // 使用xss库清理
    const sanitized = sanitizeXss(input, {
      whiteList: securityConfig.inputValidation.xss.allowedTags.reduce((acc: Record<string, string[]>, tag: string) => {
        acc[tag] = securityConfig.inputValidation.xss.allowedAttributes[tag as keyof typeof securityConfig.inputValidation.xss.allowedAttributes] || [];
        return acc;
      }, {} as Record<string, string[]>),
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style'],
    });

    return sanitized;
  },

  /**
   * 验证手机号码
   */
  isValidPhone(phone: string): boolean {
    // 中国手机号码验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  },

  /**
   * 验证密码强度
   */
  validatePassword(password: string): ValidationResult {
    const errors: string[] = [];
    const { policy } = securityConfig.password;

    if (password.length < policy.minLength) {
      errors.push(`密码长度不能少于${policy.minLength}个字符`);
    }
    if (password.length > policy.maxLength) {
      errors.push(`密码长度不能超过${policy.maxLength}个字符`);
    }
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('密码必须包含至少一个大写字母');
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('密码必须包含至少一个小写字母');
    }
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('密码必须包含至少一个数字');
    }
    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('密码必须包含至少一个特殊字符');
    }

    // 检查常见弱密码
    const weakPasswords = [
      'password', '123456', '12345678', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
    ];
    if (weakPasswords.includes(password.toLowerCase())) {
      errors.push('密码过于简单，请使用更复杂的密码');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: password,
    };
  },

  /**
   * 验证用户名
   */
  validateUsername(username: string): ValidationResult {
    const errors: string[] = [];

    if (username.length < 3) {
      errors.push('用户名长度不能少于3个字符');
    }
    if (username.length > 30) {
      errors.push('用户名长度不能超过30个字符');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push('用户名只能包含字母、数字和下划线');
    }
    if (/^[0-9]/.test(username)) {
      errors.push('用户名不能以数字开头');
    }

    // 检查保留用户名
    const reservedUsernames = [
      'admin', 'root', 'system', 'user', 'test', 'guest',
      'moderator', 'support', 'help', 'info', 'contact',
    ];
    if (reservedUsernames.includes(username.toLowerCase())) {
      errors.push('该用户名是保留用户名，请选择其他用户名');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: username.toLowerCase(),
    };
  },

  /**
   * 验证邮箱
   */
  validateEmail(email: string): ValidationResult {
    const errors: string[] = [];

    if (!validator.isEmail(email)) {
      errors.push('邮箱地址格式不正确');
    }
    if (email.length > 254) {
      errors.push('邮箱地址长度不能超过254个字符');
    }

    // 检查一次性邮箱域名
    const disposableDomains = [
      'tempmail.com', 'throwaway.email', 'guerrillamail.com',
      'mailinator.com', 'yopmail.com', 'sharklasers.com',
    ];
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && disposableDomains.includes(domain)) {
      errors.push('请使用有效的邮箱地址');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: email.toLowerCase(),
    };
  },

  /**
   * 验证URL
   */
  validateUrl(url: string): ValidationResult {
    const errors: string[] = [];

    if (!validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true })) {
      errors.push('URL格式不正确');
    }

    // 检查危险协议
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
    if (dangerousProtocols.some(protocol => url.toLowerCase().startsWith(protocol))) {
      errors.push('不允许的URL协议');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: url,
    };
  },

  /**
   * 验证数字
   */
  validateNumber(value: any, options: {
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
  } = {}): ValidationResult {
    const errors: string[] = [];
    const num = Number(value);

    if (isNaN(num)) {
      errors.push('必须是有效的数字');
    } else {
      if (options.integer && !Number.isInteger(num)) {
        errors.push('必须是整数');
      }
      if (options.positive && num <= 0) {
        errors.push('必须是正数');
      }
      if (options.min !== undefined && num < options.min) {
        errors.push(`不能小于${options.min}`);
      }
      if (options.max !== undefined && num > options.max) {
        errors.push(`不能大于${options.max}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: num,
    };
  },

  /**
   * 验证数组
   */
  validateArray(value: any, options: {
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: any) => ValidationResult;
  } = {}): ValidationResult {
    const errors: string[] = [];

    if (!Array.isArray(value)) {
      errors.push('必须是数组');
    } else {
      if (options.minLength !== undefined && value.length < options.minLength) {
        errors.push(`数组长度不能少于${options.minLength}`);
      }
      if (options.maxLength !== undefined && value.length > options.maxLength) {
        errors.push(`数组长度不能超过${options.maxLength}`);
      }
      if (options.itemValidator) {
        value.forEach((item, index) => {
          const result = options.itemValidator!(item);
          if (!result.isValid) {
            errors.push(`数组第${index + 1}项: ${result.errors.join(', ')}`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: value,
    };
  },

  /**
   * 验证日期
   */
  validateDate(value: any, options: {
    minDate?: Date;
    maxDate?: Date;
    futureOnly?: boolean;
    pastOnly?: boolean;
  } = {}): ValidationResult {
    const errors: string[] = [];
    const date = new Date(value);

    if (isNaN(date.getTime())) {
      errors.push('必须是有效的日期');
    } else {
      const now = new Date();
      if (options.futureOnly && date <= now) {
        errors.push('必须是未来的日期');
      }
      if (options.pastOnly && date >= now) {
        errors.push('必须是过去的日期');
      }
      if (options.minDate && date < options.minDate) {
        errors.push(`日期不能早于${options.minDate.toLocaleDateString()}`);
      }
      if (options.maxDate && date > options.maxDate) {
        errors.push(`日期不能晚于${options.maxDate.toLocaleDateString()}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: date,
    };
  },

  /**
   * 验证文件
   */
  validateFile(file: { originalname: string; mimetype: string; size: number }, options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}): ValidationResult {
    const errors: string[] = [];
    const maxSize = options.maxSize || 5 * 1024 * 1024;
    const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/gif'];

    if (file.size > maxSize) {
      errors.push(`文件大小不能超过${Math.round(maxSize / 1024 / 1024)}MB`);
    }

    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`不支持的文件类型: ${file.mimetype}`);
    }

    if (options.allowedExtensions) {
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      if (ext && !options.allowedExtensions.includes(ext)) {
        errors.push(`不支持的文件扩展名: .${ext}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: file,
    };
  },

  /**
   * 批量验证
   */
  validateBatch(data: any[], validator: (item: any) => ValidationResult): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any[] = [];

    data.forEach((item, index) => {
      const result = validator(item);
      if (!result.isValid) {
        errors.push(`第${index + 1}项: ${result.errors.join(', ')}`);
      }
      sanitizedData.push(result.sanitizedValue);
    });

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitizedData,
    };
  },

  /**
   * 创建验证中间件
   */
  createValidationMiddleware(schema: Record<string, ValidationRule>) {
    return (req: any, res: any, next: any) => {
      const result = this.validateObject(req.body, schema);
      if (!result.isValid) {
        throw new ValidationError(result.errors.join('; '));
      }
      req.body = result.sanitizedValue;
      next();
    };
  },

  /**
   * 清理整个请求体
   */
  sanitizeRequestBody(body: any): any {
    if (typeof body === 'string') {
      return this.sanitizeString(body);
    }
    if (Array.isArray(body)) {
      return body.map(item => this.sanitizeRequestBody(item));
    }
    if (typeof body === 'object' && body !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(body)) {
        sanitized[key] = this.sanitizeRequestBody(value);
      }
      return sanitized;
    }
    return body;
  },
};

// 常用验证规则预设
export const commonValidationRules = {
  // 用户名规则
  username: {
    required: true,
    type: 'string' as const,
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_]+$/,
    sanitize: true,
    trim: true,
    lowercase: true,
  },

  // 密码规则
  password: {
    required: true,
    type: 'string' as const,
    minLength: 8,
    maxLength: 128,
  },

  // 邮箱规则
  email: {
    required: true,
    type: 'email' as const,
    maxLength: 254,
    sanitize: true,
    trim: true,
    lowercase: true,
  },

  // 手机号规则
  phone: {
    required: true,
    type: 'phone' as const,
    sanitize: true,
    trim: true,
  },

  // ID规则
  id: {
    required: true,
    type: 'number' as const,
    min: 1,
    integer: true,
  },

  // 分页参数
  pagination: {
    page: {
      type: 'number' as const,
      min: 1,
      integer: true,
    },
    limit: {
      type: 'number' as const,
      min: 1,
      max: 100,
      integer: true,
    },
  },

  // 排序参数
  sort: {
    field: {
      type: 'string' as const,
      maxLength: 50,
      sanitize: true,
      trim: true,
    },
    order: {
      type: 'string' as const,
      pattern: /^(asc|desc)$/i,
      sanitize: true,
      trim: true,
      lowercase: true,
    },
  },
};

export default inputValidator;