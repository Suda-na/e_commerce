import crypto from 'crypto';
import { config } from '../config';
import { logger } from './logger';
import {
  AIRequestDto,
  AIResponseDto,
  AIError,
  AIErrorCode,
  SecurityCheckResult,
  ContentFilterConfig,
  AICacheKeys,
} from '../dto/ai.dto';

/**
 * AI工具类
 * 提供AI请求/响应处理、安全检查、缓存等功能
 */
export class AIUtils {
  private static instance: AIUtils;
  private contentFilterConfig: ContentFilterConfig;

  private constructor() {
    this.contentFilterConfig = {
      maxInputLength: 10000, // 最大输入长度
      blockedPatterns: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // 脚本标签
        /javascript:/gi, // JavaScript协议
        /on\w+\s*=/gi, // 事件处理器
        /data:text\/html/gi, // 数据URI
      ],
      sensitiveWords: [
        // 敏感词列表（示例）
        'hack', 'exploit', 'vulnerability', 'attack',
      ],
      requireAuth: true,
    };
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AIUtils {
    if (!AIUtils.instance) {
      AIUtils.instance = new AIUtils();
    }
    return AIUtils.instance;
  }

  /**
   * 生成请求ID
   */
  generateRequestId(): string {
    return `ai_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(prompt: string, systemPrompt?: string): string {
    return AICacheKeys.requestCache(prompt, systemPrompt);
  }

  /**
   * 验证请求参数
   */
  validateRequest(request: AIRequestDto): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查prompt是否存在
    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('prompt不能为空');
    }

    // 检查prompt长度
    if (request.prompt && request.prompt.length > this.contentFilterConfig.maxInputLength) {
      errors.push(`prompt长度不能超过${this.contentFilterConfig.maxInputLength}个字符`);
    }

    // 检查temperature范围
    if (request.temperature !== undefined) {
      if (request.temperature < 0 || request.temperature > 2) {
        errors.push('temperature必须在0-2之间');
      }
    }

    // 检查maxTokens范围
    if (request.maxTokens !== undefined) {
      if (request.maxTokens < 1 || request.maxTokens > 4096) {
        errors.push('maxTokens必须在1-4096之间');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 安全检查
   */
  performSecurityCheck(content: string): SecurityCheckResult {
    const reasons: string[] = [];

    // 检查长度
    if (content.length > this.contentFilterConfig.maxInputLength) {
      reasons.push('内容超过最大长度限制');
    }

    // 检查恶意模式
    for (const pattern of this.contentFilterConfig.blockedPatterns) {
      if (pattern.test(content)) {
        reasons.push('内容包含潜在恶意代码');
        break;
      }
    }

    // 检查敏感词
    const lowerContent = content.toLowerCase();
    for (const word of this.contentFilterConfig.sensitiveWords) {
      if (lowerContent.includes(word.toLowerCase())) {
        reasons.push(`内容包含敏感词: ${word}`);
      }
    }

    // 检查注入攻击模式
    const injectionPatterns = [
      /ignore\s+previous\s+instructions/i,
      /forget\s+everything/i,
      /you\s+are\s+now/i,
      /system\s+prompt/i,
      /act\s+as/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(content)) {
        reasons.push('内容可能包含提示注入攻击');
        break;
      }
    }

    return {
      safe: reasons.length === 0,
      reasons: reasons.length > 0 ? reasons : undefined,
    };
  }

  /**
   * 过滤输出内容
   */
  filterOutputContent(content: string): string {
    let filtered = content;

    // 移除潜在有害内容
    filtered = filtered.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    filtered = filtered.replace(/javascript:/gi, '');
    filtered = filtered.replace(/on\w+\s*=/gi, '');

    // 移除多余空白
    filtered = filtered.trim();

    return filtered;
  }

  /**
   * 构建AI响应
   */
  buildSuccessResponse(
    content: string,
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
    requestId: string,
    finishReason: string = 'stop'
  ): AIResponseDto {
    return {
      success: true,
      data: {
        content: this.filterOutputContent(content),
        usage,
        finishReason,
      },
      requestId,
      timestamp: new Date(),
    };
  }

  /**
   * 构建错误响应
   */
  buildErrorResponse(error: AIError, requestId: string): AIResponseDto {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      requestId,
      timestamp: new Date(),
    };
  }

  /**
   * 判断错误是否可重试
   */
  isRetryableError(error: AIError): boolean {
    return error.retryable;
  }

  /**
   * 计算重试延迟（指数退避）
   */
  calculateRetryDelay(retryCount: number): number {
    const baseDelay = config.ai.retry.retryDelay;
    return Math.min(baseDelay * Math.pow(2, retryCount), 30000); // 最大30秒
  }

  /**
   * 生成请求哈希（用于缓存）
   */
  generateRequestHash(request: AIRequestDto): string {
    const data = JSON.stringify({
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
    
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 格式化使用统计
   */
  formatUsageStats(stats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokens: number;
    averageResponseTime: number;
    cacheHitRate: number;
  }): {
    successRate: string;
    averageResponseTime: string;
    cacheHitRate: string;
    tokensPerRequest: string;
  } {
    const successRate = stats.totalRequests > 0
      ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2) + '%'
      : '0%';

    const averageResponseTime = stats.averageResponseTime.toFixed(2) + 'ms';

    const cacheHitRate = (stats.cacheHitRate * 100).toFixed(2) + '%';

    const tokensPerRequest = stats.successfulRequests > 0
      ? Math.round(stats.totalTokens / stats.successfulRequests).toString()
      : '0';

    return {
      successRate,
      averageResponseTime,
      cacheHitRate,
      tokensPerRequest,
    };
  }

  /**
   * 清理和标准化输入
   */
  sanitizeInput(input: string): string {
    // 移除前后空白
    let sanitized = input.trim();
    
    // 标准化换行符
    sanitized = sanitized.replace(/\r\n/g, '\n');
    sanitized = sanitized.replace(/\r/g, '\n');
    
    // 移除多余空白行
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
    
    // 移除控制字符（保留换行和制表符）
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
  }

  /**
   * 检查内容是否包含敏感信息
   */
  containsSensitiveInfo(content: string): boolean {
    const sensitivePatterns = [
      /\b\d{16,19}\b/, // 银行卡号
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN格式
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // 邮箱
      /\b\d{11}\b/, // 手机号
      /password|密码|pwd/i, // 密码相关
    ];

    return sensitivePatterns.some(pattern => pattern.test(content));
  }
}

// 导出单例
export const aiUtils = AIUtils.getInstance();
