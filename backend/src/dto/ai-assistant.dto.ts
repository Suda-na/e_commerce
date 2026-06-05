/**
 * AI辅助模块DTO定义
 * 包含商品描述生成和直播话术建议相关的类型定义
 */

// 商品描述生成请求
export interface GenerateDescriptionRequest {
  productName: string;
  productType: string;
  features: string[];
  style?: 'professional' | 'lively' | 'luxury';
  language?: 'zh' | 'en';
  maxLength?: number;
}

// 商品描述生成响应
export interface GenerateDescriptionResponse {
  success: boolean;
  data?: {
    description: string;
    style: string;
    wordCount: number;
    suggestions?: string[];
  };
  error?: {
    code: string;
    message: string;
  };
}

// 直播话术建议请求
export interface BroadcastSuggestionRequest {
  auctionId: number;
  auctionStatus: 'pending' | 'active' | 'completed' | 'cancelled';
  currentPrice?: number;
  startingPrice?: number;
  capPrice?: number;
  timeLeft?: number;
  participantCount?: number;
  productName?: string;
  productFeatures?: string[];
  style?: 'exciting' | 'professional' | 'friendly';
}

// 直播话术建议响应
export interface BroadcastSuggestionResponse {
  success: boolean;
  data?: {
    suggestions: BroadcastSuggestion[];
    timestamp: Date;
  };
  error?: {
    code: string;
    message: string;
  };
}

// 直播话术建议
export interface BroadcastSuggestion {
  id: string;
  type: 'opening' | 'bidding' | 'countdown' | 'closing' | 'interaction' | 'custom';
  content: string;
  timing: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}

// 话术模板
export interface BroadcastTemplate {
  id: string;
  name: string;
  category: 'opening' | 'bidding' | 'countdown' | 'closing' | 'interaction';
  content: string;
  variables: string[];
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 话术模板创建请求
export interface CreateTemplateRequest {
  name: string;
  category: 'opening' | 'bidding' | 'countdown' | 'closing' | 'interaction';
  content: string;
  variables?: string[];
  description?: string;
}

// 话术模板更新请求
export interface UpdateTemplateRequest {
  name?: string;
  category?: 'opening' | 'bidding' | 'countdown' | 'closing' | 'interaction';
  content?: string;
  variables?: string[];
  description?: string;
  isActive?: boolean;
}

// 商品描述风格配置
export interface DescriptionStyleConfig {
  style: 'professional' | 'lively' | 'luxury';
  name: string;
  description: string;
  promptTemplate: string;
  examples: string[];
}

// 直播话术风格配置
export interface BroadcastStyleConfig {
  style: 'exciting' | 'professional' | 'friendly';
  name: string;
  description: string;
  tone: string;
  examples: string[];
}

// AI辅助模块配置
export interface AIAssistantConfig {
  maxDescriptionLength: number;
  maxSuggestionsCount: number;
  defaultDescriptionStyle: 'professional' | 'lively' | 'luxury';
  defaultBroadcastStyle: 'exciting' | 'professional' | 'friendly';
  cacheEnabled: boolean;
  cacheTTL: number;
}

// 缓存键生成
export class AIAssistantCacheKeys {
  // 商品描述缓存
  static productDescription(productName: string, style: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5')
      .update(`desc:${productName}:${style}`)
      .digest('hex');
    return `ai:desc:${hash}`;
  }

  // 直播话术缓存
  static broadcastSuggestion(auctionId: number, status: string): string {
    return `ai:broadcast:${auctionId}:${status}`;
  }

  // 话术模板缓存
  static template(templateId: string): string {
    return `ai:template:${templateId}`;
  }

  // 所有模板缓存
  static allTemplates(): string {
    return 'ai:templates:all';
  }
}

// 错误代码
export enum AIAssistantErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  GENERATION_FAILED = 'GENERATION_FAILED',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  TEMPLATE_ALREADY_EXISTS = 'TEMPLATE_ALREADY_EXISTS',
  CACHE_ERROR = 'CACHE_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  RATE_LIMITED = 'RATE_LIMITED',
}

// 定价建议请求
export interface SuggestPricingRequest {
  productName: string;
  productType?: string;
  images?: string[];
  targetAudience?: string;
}

// 定价建议响应
export interface SuggestPricingResponse {
  success: boolean;
  data?: {
    suggestedStartingPrice: number;
    suggestedPriceIncrement: number;
    reasoning: string;
    confidence: number;
    marketData: {
      averagePrice: number;
      priceRange: [number, number];
      competitorCount: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

// 直播话术生成请求
export interface LiveScriptRequest {
  productName: string;
  productFeatures?: string[];
  auctionInfo?: {
    startingPrice: number;
    timeRemaining?: number;
    currentBidCount?: number;
    currentPrice?: number;
  };
  style?: 'enthusiastic' | 'professional' | 'friendly';
}

// 直播话术生成响应
export interface LiveScriptResponse {
  success: boolean;
  data?: {
    opening: string;
    productIntro: string;
    biddingGuide: string;
    urgencyTactics: string;
    closing: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// 错误响应
export class AIAssistantError extends Error {
  code: AIAssistantErrorCode;
  details?: any;

  constructor(code: AIAssistantErrorCode, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'AIAssistantError';
  }
}
