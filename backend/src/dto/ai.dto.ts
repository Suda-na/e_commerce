/**
 * AI服务相关的DTO定义
 */

// AI请求DTO
export interface AIRequestDto {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  requestId?: string;
}

// AI响应DTO
export interface AIResponseDto {
  success: boolean;
  data?: {
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    finishReason: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  requestId: string;
  timestamp: Date;
}

// AI缓存键生成
export class AICacheKeys {
  // 生成请求缓存键
  static requestCache(prompt: string, systemPrompt?: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5')
      .update(`${prompt}:${systemPrompt || ''}`)
      .digest('hex');
    return `ai:cache:${hash}`;
  }

  // 限流键
  static rateLimit(userId: string): string {
    return `ai:rate:${userId}`;
  }

  // 请求统计键
  static stats(): string {
    return 'ai:stats';
  }
}

// AI错误类型
export enum AIErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  RATE_LIMITED = 'RATE_LIMITED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONTENT_FILTERED = 'CONTENT_FILTERED',
  UNKNOWN = 'UNKNOWN',
}

// AI错误响应
export interface AIError {
  code: AIErrorCode;
  message: string;
  retryable: boolean;
  details?: any;
}

// AI使用统计
export interface AIUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  averageResponseTime: number;
  cacheHitRate: number;
  lastUpdated: Date;
}

// 火山方舟API请求格式
export interface VolcanoArkRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// 火山方舟API响应格式
export interface VolcanoArkResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 安全检查结果
export interface SecurityCheckResult {
  safe: boolean;
  reasons?: string[];
  filteredContent?: string;
}

// 内容过滤配置
export interface ContentFilterConfig {
  maxInputLength: number;
  blockedPatterns: RegExp[];
  sensitiveWords: string[];
  requireAuth: boolean;
}
