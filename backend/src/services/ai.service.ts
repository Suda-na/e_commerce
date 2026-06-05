import { config } from '../config';
import { logger } from '../utils/logger';
import { redisUtils } from '../config/redis';
import { volcanoArkClient } from '../utils/volcano-ark-client';
import { aiUtils } from '../utils/ai-utils';
import {
  AIRequestDto,
  AIResponseDto,
  AIError,
  AIErrorCode,
  AIUsageStats,
  AICacheKeys,
} from '../dto/ai.dto';

/**
 * AI服务类
 * 提供完整的AI功能，包括请求处理、缓存、限流、重试等
 */
export class AIService {
  private static instance: AIService;
  private usageStats: AIUsageStats;

  private constructor() {
    this.usageStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * 处理AI请求（主入口）
   */
  async processRequest(request: AIRequestDto, userId?: string): Promise<AIResponseDto> {
    const requestId = request.requestId || aiUtils.generateRequestId();
    const startTime = Date.now();

    try {
      // 1. 验证请求参数
      const validation = aiUtils.validateRequest(request);
      if (!validation.valid) {
        const error: AIError = {
          code: AIErrorCode.INVALID_REQUEST,
          message: validation.errors.join(', '),
          retryable: false,
        };
        return aiUtils.buildErrorResponse(error, requestId);
      }

      // 2. 安全检查
      const securityCheck = aiUtils.performSecurityCheck(request.prompt);
      if (!securityCheck.safe) {
        const error: AIError = {
          code: AIErrorCode.CONTENT_FILTERED,
          message: `内容安全检查失败: ${securityCheck.reasons?.join(', ')}`,
          retryable: false,
        };
        return aiUtils.buildErrorResponse(error, requestId);
      }

      // 3. 清理输入
      const sanitizedPrompt = aiUtils.sanitizeInput(request.prompt);
      const sanitizedRequest = {
        ...request,
        prompt: sanitizedPrompt,
        requestId,
      };

      // 4. 检查缓存
      if (config.ai.cache.enabled) {
        const cachedResponse = await this.getCachedResponse(sanitizedRequest);
        if (cachedResponse) {
          this.updateStats(true, Date.now() - startTime, 0, true);
          return cachedResponse;
        }
      }

      // 5. 检查限流
      if (userId) {
        const isAllowed = await this.checkRateLimit(userId);
        if (!isAllowed) {
          const error: AIError = {
            code: AIErrorCode.RATE_LIMITED,
            message: '请求频率超限，请稍后再试',
            retryable: true,
          };
          return aiUtils.buildErrorResponse(error, requestId);
        }
      }

      // 6. 执行请求（带重试）
      const response = await this.executeWithRetry(sanitizedRequest);

      // 7. 缓存响应
      if (config.ai.cache.enabled && response.success) {
        await this.cacheResponse(sanitizedRequest, response);
      }

      // 8. 更新统计
      const responseTime = Date.now() - startTime;
      const tokens = response.data?.usage.totalTokens || 0;
      this.updateStats(response.success, responseTime, tokens, false);

      // 9. 更新限流计数
      if (userId && response.success) {
        await this.incrementRateLimit(userId);
      }

      return response;
    } catch (error) {
      logger.error('AI request processing failed:', error);
      
      const aiError: AIError = {
        code: AIErrorCode.UNKNOWN,
        message: error instanceof Error ? error.message : '未知错误',
        retryable: false,
      };
      
      this.updateStats(false, Date.now() - startTime, 0, false);
      return aiUtils.buildErrorResponse(aiError, requestId);
    }
  }

  /**
   * 执行请求（带重试机制）
   */
  private async executeWithRetry(request: AIRequestDto): Promise<AIResponseDto> {
    const maxRetries = config.ai.retry.maxRetries;
    let lastError: AIError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 构建火山方舟请求
        const volcanoRequest: any = {
          model: config.ai.endpointId || config.ai.model,
          messages: [] as Array<{ role: string; content: string }>,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048,
          stream: false,
        };

        // 添加系统提示
        if (request.systemPrompt) {
          volcanoRequest.messages.push({
            role: 'system' as const,
            content: request.systemPrompt,
          });
        }

        // 添加用户消息
        volcanoRequest.messages.push({
          role: 'user' as const,
          content: request.prompt,
        });

        // 调用火山方舟API
        const volcanoResponse = await volcanoArkClient.chatCompletion(volcanoRequest);

        // 构建成功响应
        const choice = volcanoResponse.choices[0];
        if (!choice) {
          throw new Error('API返回空响应');
        }

        return aiUtils.buildSuccessResponse(
          choice.message.content,
          {
            promptTokens: volcanoResponse.usage.prompt_tokens,
            completionTokens: volcanoResponse.usage.completion_tokens,
            totalTokens: volcanoResponse.usage.total_tokens,
          },
          request.requestId || aiUtils.generateRequestId(),
          choice.finish_reason
        );
      } catch (error) {
        // 转换为AIError
        if (error && typeof error === 'object' && 'code' in error) {
          lastError = error as AIError;
        } else {
          lastError = {
            code: AIErrorCode.UNKNOWN,
            message: error instanceof Error ? error.message : '未知错误',
            retryable: true,
          };
        }

        // 检查是否可重试
        if (!aiUtils.isRetryableError(lastError) || attempt >= maxRetries) {
          break;
        }

        // 计算重试延迟
        const delay = aiUtils.calculateRetryDelay(attempt);
        logger.warn(`AI request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, lastError.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // 所有重试都失败
    return aiUtils.buildErrorResponse(
      lastError || {
        code: AIErrorCode.UNKNOWN,
        message: '请求失败',
        retryable: false,
      },
      request.requestId || aiUtils.generateRequestId()
    );
  }

  /**
   * 获取缓存响应
   */
  private async getCachedResponse(request: AIRequestDto): Promise<AIResponseDto | null> {
    try {
      const cacheKey = aiUtils.generateCacheKey(request.prompt, request.systemPrompt);
      const cached = await redisUtils.get(cacheKey);
      
      if (cached) {
        logger.debug(`AI cache hit for key: ${cacheKey}`);
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get cached AI response:', error);
      return null;
    }
  }

  /**
   * 缓存响应
   */
  private async cacheResponse(request: AIRequestDto, response: AIResponseDto): Promise<void> {
    try {
      const cacheKey = aiUtils.generateCacheKey(request.prompt, request.systemPrompt);
      const ttl = Math.floor(config.ai.cache.ttl / 1000); // 转换为秒
      
      await redisUtils.set(cacheKey, JSON.stringify(response), ttl);
      logger.debug(`AI response cached with key: ${cacheKey}, TTL: ${ttl}s`);
    } catch (error) {
      logger.error('Failed to cache AI response:', error);
    }
  }

  /**
   * 检查限流
   */
  private async checkRateLimit(userId: string): Promise<boolean> {
    try {
      const rateLimitKey = AICacheKeys.rateLimit(userId);
      const current = await redisUtils.get(rateLimitKey);
      const count = current ? parseInt(current) : 0;
      
      return count < config.ai.rateLimit.maxRequests;
    } catch (error) {
      logger.error('Failed to check rate limit:', error);
      // 限流检查失败时允许请求
      return true;
    }
  }

  /**
   * 增加限流计数
   */
  private async incrementRateLimit(userId: string): Promise<void> {
    try {
      const rateLimitKey = AICacheKeys.rateLimit(userId);
      const windowSeconds = Math.floor(config.ai.rateLimit.windowMs / 1000);
      
      const current = await redisUtils.get(rateLimitKey);
      const count = current ? parseInt(current) : 0;
      
      await redisUtils.set(rateLimitKey, (count + 1).toString(), windowSeconds);
    } catch (error) {
      logger.error('Failed to increment rate limit:', error);
    }
  }

  /**
   * 更新使用统计
   */
  private updateStats(success: boolean, responseTime: number, tokens: number, fromCache: boolean): void {
    this.usageStats.totalRequests++;
    
    if (success) {
      this.usageStats.successfulRequests++;
      this.usageStats.totalTokens += tokens;
      
      // 更新平均响应时间
      const totalResponseTime = this.usageStats.averageResponseTime * (this.usageStats.successfulRequests - 1);
      this.usageStats.averageResponseTime = (totalResponseTime + responseTime) / this.usageStats.successfulRequests;
    } else {
      this.usageStats.failedRequests++;
    }

    // 更新缓存命中率
    if (fromCache) {
      const totalCacheHits = this.usageStats.cacheHitRate * (this.usageStats.totalRequests - 1);
      this.usageStats.cacheHitRate = (totalCacheHits + 1) / this.usageStats.totalRequests;
    } else {
      const totalCacheHits = this.usageStats.cacheHitRate * (this.usageStats.totalRequests - 1);
      this.usageStats.cacheHitRate = totalCacheHits / this.usageStats.totalRequests;
    }

    this.usageStats.lastUpdated = new Date();
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): AIUsageStats {
    return { ...this.usageStats };
  }

  /**
   * 获取格式化的使用统计
   */
  getFormattedStats(): ReturnType<typeof aiUtils.formatUsageStats> {
    return aiUtils.formatUsageStats(this.usageStats);
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.usageStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * 验证API连接
   */
  async validateConnection(): Promise<boolean> {
    try {
      return await volcanoArkClient.validateConnection();
    } catch (error) {
      logger.error('AI API connection validation failed:', error);
      return false;
    }
  }

  /**
   * 获取API状态
   */
  async getApiStatus(): Promise<{
    connected: boolean;
    model: string;
    endpointId: string;
    latency?: number;
    stats: AIUsageStats;
  }> {
    const status = await volcanoArkClient.getApiStatus();
    
    return {
      ...status,
      stats: this.getUsageStats(),
    };
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await redisUtils.keys('ai:cache:*');
      if (keys.length > 0) {
        await redisUtils.del(...keys);
        logger.info(`Cleared ${keys.length} AI cache entries`);
      }
    } catch (error) {
      logger.error('Failed to clear AI cache:', error);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      api: boolean;
      cache: boolean;
      rateLimit: boolean;
    };
    details: any;
  }> {
    const checks = {
      api: false,
      cache: false,
      rateLimit: false,
    };

    try {
      // 检查API连接
      checks.api = await this.validateConnection();
      
      // 检查缓存
      try {
        await redisUtils.set('ai:health:check', 'ok', 10);
        checks.cache = (await redisUtils.get('ai:health:check')) === 'ok';
        await redisUtils.del('ai:health:check');
      } catch (error) {
        checks.cache = false;
      }
      
      // 检查限流
      try {
        checks.rateLimit = await this.checkRateLimit('health_check');
      } catch (error) {
        checks.rateLimit = false;
      }
    } catch (error) {
      logger.error('AI health check failed:', error);
    }

    const healthyCount = Object.values(checks).filter(Boolean).length;
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (healthyCount === 3) {
      status = 'healthy';
    } else if (healthyCount >= 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      details: {
        model: config.ai.model,
        endpointId: config.ai.endpointId,
        stats: this.getFormattedStats(),
      },
    };
  }
}

// 导出单例
export const aiService = AIService.getInstance();
