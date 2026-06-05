/**
 * 表单校验工具类
 * 
 * 功能特性：
 * 1. 通用字段验证
 * 2. 竞拍出价验证
 * 3. 用户信息验证
 * 4. 表单批量验证
 * 5. 自定义规则支持
 */

// ==================== 类型定义 ====================

/** 验证结果 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
  field?: string;
}

/** 验证规则 */
export interface ValidationRule {
  required?: boolean;
  message?: string;
  pattern?: RegExp;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  validator?: (value: any) => boolean | string;
}

/** 表单验证错误 */
export interface FormErrors {
  [field: string]: string;
}

/** 竞拍出价参数 */
export interface BidValidationParams {
  amount: number;
  currentPrice: number;
  minIncrement: number;
  maxPrice?: number;
  balance?: number;
  status?: string;
}

// ==================== 验证器类 ====================

class Validator {
  private static instance: Validator | null = null;

  private constructor() {}

  /** 获取单例实例 */
  static getInstance(): Validator {
    if (!Validator.instance) {
      Validator.instance = new Validator();
    }
    return Validator.instance;
  }

  // ==================== 通用验证 ====================

  /**
   * 验证单个字段
   * @param value 字段值
   * @param rules 验证规则数组
   * @returns 验证结果
   */
  validateField(value: any, rules: ValidationRule[]): ValidationResult {
    for (const rule of rules) {
      // 必填验证
      if (rule.required && this.isEmpty(value)) {
        return {
          valid: false,
          message: rule.message || '此字段为必填项',
        };
      }

      // 如果值为空且不是必填，跳过其他验证
      if (this.isEmpty(value)) {
        continue;
      }

      // 正则验证
      if (rule.pattern && !rule.pattern.test(String(value))) {
        return {
          valid: false,
          message: rule.message || '格式不正确',
        };
      }

      // 最小值验证（数字）
      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        return {
          valid: false,
          message: rule.message || `不能小于 ${rule.min}`,
        };
      }

      // 最大值验证（数字）
      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        return {
          valid: false,
          message: rule.message || `不能大于 ${rule.max}`,
        };
      }

      // 最小长度验证（字符串/数组）
      if (rule.minLength !== undefined) {
        const len = typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : 0;
        if (len < rule.minLength) {
          return {
            valid: false,
            message: rule.message || `长度不能少于 ${rule.minLength} 个字符`,
          };
        }
      }

      // 最大长度验证（字符串/数组）
      if (rule.maxLength !== undefined) {
        const len = typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : 0;
        if (len > rule.maxLength) {
          return {
            valid: false,
            message: rule.message || `长度不能超过 ${rule.maxLength} 个字符`,
          };
        }
      }

      // 自定义验证
      if (rule.validator) {
        const result = rule.validator(value);
        if (result !== true) {
          return {
            valid: false,
            message: typeof result === 'string' ? result : (rule.message || '验证失败'),
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 验证表单
   * @param data 表单数据
   * @param rules 验证规则
   * @returns 错误信息对象，空对象表示验证通过
   */
  validateForm(data: Record<string, any>, rules: Record<string, ValidationRule[]>): FormErrors {
    const errors: FormErrors = {};

    for (const field in rules) {
      const result = this.validateField(data[field], rules[field]);
      if (!result.valid && result.message) {
        errors[field] = result.message;
      }
    }

    return errors;
  }

  /**
   * 检查表单是否有效
   * @param data 表单数据
   * @param rules 验证规则
   * @returns 是否有效
   */
  isFormValid(data: Record<string, any>, rules: Record<string, ValidationRule[]>): boolean {
    const errors = this.validateForm(data, rules);
    return Object.keys(errors).length === 0;
  }

  // ==================== 竞拍出价验证 ====================

  /**
   * 验证出价金额
   * @param params 出价参数
   * @returns 验证结果
   */
  validateBidAmount(params: BidValidationParams): ValidationResult {
    const { amount, currentPrice, minIncrement, maxPrice, balance, status } = params;

    // 检查竞拍状态
    if (status && status !== 'active') {
      return {
        valid: false,
        message: '竞拍已结束，无法出价',
      };
    }

    // 检查金额是否为有效数字
    if (isNaN(amount) || amount <= 0) {
      return {
        valid: false,
        message: '请输入有效的出价金额',
      };
    }

    // 检查是否超过最小加价幅度
    const minBid = currentPrice + minIncrement;
    if (amount < minBid) {
      return {
        valid: false,
        message: `出价不能低于 ¥${minBid.toFixed(2)}`,
      };
    }

    // 检查是否超过封顶价
    if (maxPrice && amount > maxPrice) {
      return {
        valid: false,
        message: `出价不能超过封顶价 ¥${maxPrice.toFixed(2)}`,
      };
    }

    // 检查余额是否充足
    if (balance !== undefined && amount > balance) {
      return {
        valid: false,
        message: '余额不足，请先充值',
      };
    }

    // 检查小数位数（最多2位）
    const decimalPart = amount.toString().split('.')[1];
    if (decimalPart && decimalPart.length > 2) {
      return {
        valid: false,
        message: '金额最多支持2位小数',
      };
    }

    return { valid: true };
  }

  /**
   * 计算建议出价
   * @param currentPrice 当前价格
   * @param minIncrement 最小加价幅度
   * @returns 建议出价数组
   */
  getSuggestedBids(currentPrice: number, minIncrement: number): number[] {
    const base = currentPrice + minIncrement;
    return [
      base,
      base + minIncrement,
      base + minIncrement * 2,
      base + minIncrement * 5,
    ];
  }

  // ==================== 用户信息验证 ====================

  /**
   * 验证手机号
   * @param phone 手机号
   * @returns 验证结果
   */
  validatePhone(phone: string): ValidationResult {
    if (!phone) {
      return { valid: false, message: '请输入手机号' };
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return { valid: false, message: '请输入正确的手机号' };
    }
    return { valid: true };
  }

  /**
   * 验证邮箱
   * @param email 邮箱
   * @returns 验证结果
   */
  validateEmail(email: string): ValidationResult {
    if (!email) {
      return { valid: false, message: '请输入邮箱' };
    }
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return { valid: false, message: '请输入正确的邮箱地址' };
    }
    return { valid: true };
  }

  /**
   * 验证用户名
   * @param username 用户名
   * @returns 验证结果
   */
  validateUsername(username: string): ValidationResult {
    if (!username) {
      return { valid: false, message: '请输入用户名' };
    }
    if (username.length < 2) {
      return { valid: false, message: '用户名至少2个字符' };
    }
    if (username.length > 20) {
      return { valid: false, message: '用户名不能超过20个字符' };
    }
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(username)) {
      return { valid: false, message: '用户名只能包含中文、英文、数字和下划线' };
    }
    return { valid: true };
  }

  /**
   * 验证密码
   * @param password 密码
   * @returns 验证结果
   */
  validatePassword(password: string): ValidationResult {
    if (!password) {
      return { valid: false, message: '请输入密码' };
    }
    if (password.length < 6) {
      return { valid: false, message: '密码至少6个字符' };
    }
    if (password.length > 20) {
      return { valid: false, message: '密码不能超过20个字符' };
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      return { valid: false, message: '密码必须包含字母和数字' };
    }
    return { valid: true };
  }

  /**
   * 验证验证码
   * @param code 验证码
   * @param length 验证码长度（默认6）
   * @returns 验证结果
   */
  validateVerifyCode(code: string, length?: number): ValidationResult {
    const l = length || 6;
    if (!code) {
      return { valid: false, message: '请输入验证码' };
    }
    if (!/^\d+$/.test(code)) {
      return { valid: false, message: '验证码只能包含数字' };
    }
    if (code.length !== l) {
      return { valid: false, message: `验证码为${l}位数字` };
    }
    return { valid: true };
  }

  /**
   * 验证身份证号
   * @param idCard 身份证号
   * @returns 验证结果
   */
  validateIdCard(idCard: string): ValidationResult {
    if (!idCard) {
      return { valid: false, message: '请输入身份证号' };
    }
    if (!/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard)) {
      return { valid: false, message: '请输入正确的身份证号' };
    }
    return { valid: true };
  }

  // ==================== 业务验证 ====================

  /**
   * 验证评论内容
   * @param content 评论内容
   * @returns 验证结果
   */
  validateComment(content: string): ValidationResult {
    if (!content || !content.trim()) {
      return { valid: false, message: '请输入评论内容' };
    }
    if (content.length > 200) {
      return { valid: false, message: '评论内容不能超过200个字符' };
    }
    return { valid: true };
  }

  /**
   * 验证收货地址
   * @param address 地址信息
   * @returns 验证结果
   */
  validateAddress(address: {
    name?: string;
    phone?: string;
    region?: string;
    detail?: string;
  }): FormErrors {
    const rules: Record<string, ValidationRule[]> = {
      name: [
        { required: true, message: '请输入收货人姓名' },
        { maxLength: 20, message: '姓名不能超过20个字符' },
      ],
      phone: [
        { required: true, message: '请输入手机号' },
        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
      ],
      region: [
        { required: true, message: '请选择所在地区' },
      ],
      detail: [
        { required: true, message: '请输入详细地址' },
        { maxLength: 200, message: '详细地址不能超过200个字符' },
      ],
    };

    return this.validateForm(address, rules);
  }

  // ==================== 工具方法 ====================

  /**
   * 检查值是否为空
   */
  private isEmpty(value: any): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  /**
   * 是否为中国大陆手机号
   */
  isPhone(phone: string): boolean {
    return /^1[3-9]\d{9}$/.test(phone);
  }

  /**
   * 是否为邮箱
   */
  isEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }

  /**
   * 是否为强密码
   */
  isStrongPassword(password: string): boolean {
    return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,20}$/.test(password);
  }

  /**
   * 是否为有效用户名
   */
  isUsername(username: string): boolean {
    return /^[\u4e00-\u9fa5a-zA-Z0-9_]{2,20}$/.test(username);
  }
}

// ==================== 导出 ====================

/** 导出 Validator 单例 */
export const validator = Validator.getInstance();

/** 导出 BidValidator（向后兼容） */
export const bidValidator = {
  validate: (params: BidValidationParams) => validator.validateBidAmount(params),
  getSuggestedBids: (currentPrice: number, minIncrement: number) => 
    validator.getSuggestedBids(currentPrice, minIncrement),
};

/** 默认导出 */
export default validator;
