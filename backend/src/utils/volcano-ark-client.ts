import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { config } from '../config';
import { logger } from './logger';
import {
  VolcanoArkRequest,
  VolcanoArkResponse,
  AIError,
  AIErrorCode,
} from '../dto/ai.dto';

/**
 * 火山方舟API客户端
 * 封装与字节跳动火山方舟API的交互
 */
export class VolcanoArkClient {
  private client: AxiosInstance;
  private apiKey: string;
  private endpointId: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.ai.apiKey;
    this.endpointId = config.ai.endpointId;
    this.baseUrl = config.ai.apiUrl;

    // 创建axios实例
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30秒超时
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (requestConfig) => {
        logger.debug(`AI API Request: ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`);
        return requestConfig;
      },
      (error) => {
        logger.error('AI API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug(`AI API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        const errorDetails = {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        };
        logger.error('AI API Response Error:', JSON.stringify(errorDetails, null, 2));
        return Promise.reject(this.handleAxiosError(error));
      }
    );
  }

  /**
   * 处理Axios错误
   */
  private handleAxiosError(error: AxiosError): AIError {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 400:
          return {
            code: AIErrorCode.INVALID_REQUEST,
            message: data?.error?.message || '请求参数错误',
            retryable: false,
            details: data,
          };
        case 401:
          return {
            code: AIErrorCode.AUTHENTICATION_FAILED,
            message: 'API密钥无效或已过期',
            retryable: false,
            details: data,
          };
        case 404:
          return {
            code: AIErrorCode.MODEL_NOT_FOUND,
            message: '模型或端点不存在',
            retryable: false,
            details: data,
          };
        case 429:
          return {
            code: AIErrorCode.RATE_LIMITED,
            message: '请求频率超限',
            retryable: true,
            details: data,
          };
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            code: AIErrorCode.SERVER_ERROR,
            message: '服务器内部错误',
            retryable: true,
            details: data,
          };
        default:
          return {
            code: AIErrorCode.UNKNOWN,
            message: `未知错误: ${status}`,
            retryable: false,
            details: data,
          };
      }
    }

    if (error.code === 'ECONNABORTED') {
      return {
        code: AIErrorCode.TIMEOUT,
        message: '请求超时',
        retryable: true,
      };
    }

    return {
      code: AIErrorCode.UNKNOWN,
      message: error.message || '网络错误',
      retryable: true,
    };
  }

  /**
   * 发送聊天请求
   */
  async chatCompletion(request: VolcanoArkRequest): Promise<VolcanoArkResponse> {
    try {
      // 确保使用正确的端点ID
      const requestData = {
        ...request,
        model: this.endpointId || request.model,
      };

      const response = await this.client.post<VolcanoArkResponse>(
        '/chat/completions',
        requestData
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 发送简单的聊天请求
   */
  async simpleChat(
    userMessage: string,
    systemPrompt?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<VolcanoArkResponse> {
    const messages: VolcanoArkRequest['messages'] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: userMessage });

    return this.chatCompletion({
      model: this.endpointId || config.ai.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      stream: false,
    });
  }

  /**
   * 验证API连接
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.simpleChat('Hello', undefined, { maxTokens: 10 });
      return true;
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
  }> {
    const startTime = Date.now();
    
    try {
      const connected = await this.validateConnection();
      const latency = Date.now() - startTime;

      return {
        connected,
        model: config.ai.model,
        endpointId: this.endpointId,
        latency: connected ? latency : undefined,
      };
    } catch (error) {
      return {
        connected: false,
        model: config.ai.model,
        endpointId: this.endpointId,
      };
    }
  }
}

// 创建单例实例
export const volcanoArkClient = new VolcanoArkClient();
