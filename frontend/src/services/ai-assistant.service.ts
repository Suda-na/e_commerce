import api from './api';
import {
  GenerateDescriptionRequest,
  GenerateDescriptionResponse,
  BroadcastSuggestionResponse,
  ScriptTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  DescriptionStyle,
  SuggestPricingRequest,
  SuggestedPricing,
  LiveScriptRequest,
  LiveScript,
  ApiResponse,
} from '../types';

class AIAssistantService {
  async generateDescription(data: GenerateDescriptionRequest): Promise<GenerateDescriptionResponse> {
    const response = await api.post<ApiResponse<any>>('/ai/assistant/generate-description', data);
    const result = response.data.data!;
    return {
      description: result.description,
      style: result.style as DescriptionStyle,
      cached: false, // 后端没有返回cached字段，默认为false
    };
  }

  async getBroadcastSuggestion(auctionId: number, auctionStatus?: string, context?: string): Promise<BroadcastSuggestionResponse> {
    const response = await api.get<ApiResponse<any>>(`/ai/assistant/broadcast-suggestion/${auctionId}`, {
      params: { auctionStatus: auctionStatus || 'active', context },
    });
    const result = response.data.data!;
    return {
      suggestions: result.suggestions || [],
      auctionStatus: 'active', // 后端没有返回auctionStatus字段，默认为'active'
      currentPrice: undefined, // 后端没有返回currentPrice字段
      bidCount: undefined, // 后端没有返回bidCount字段
    };
  }

  async getDescriptionStyles(): Promise<DescriptionStyle[]> {
    const response = await api.get<ApiResponse<DescriptionStyle[]>>('/ai/assistant/description-styles');
    return response.data.data!;
  }

  async getAllTemplates(): Promise<ScriptTemplate[]> {
    const response = await api.get<ApiResponse<ScriptTemplate[]>>('/ai/assistant/templates');
    return response.data.data!;
  }

  async getTemplate(id: string): Promise<ScriptTemplate> {
    const response = await api.get<ApiResponse<ScriptTemplate>>(`/ai/assistant/templates/${id}`);
    return response.data.data!;
  }

  async createTemplate(data: CreateTemplateRequest): Promise<ScriptTemplate> {
    const response = await api.post<ApiResponse<ScriptTemplate>>('/ai/assistant/templates', data);
    return response.data.data!;
  }

  async updateTemplate(id: string, data: UpdateTemplateRequest): Promise<ScriptTemplate> {
    const response = await api.put<ApiResponse<ScriptTemplate>>(`/ai/assistant/templates/${id}`, data);
    return response.data.data!;
  }

  async deleteTemplate(id: string): Promise<void> {
    await api.delete(`/ai/assistant/templates/${id}`);
  }

  async suggestPricing(data: SuggestPricingRequest): Promise<SuggestedPricing> {
    const response = await api.post<ApiResponse<SuggestedPricing>>('/ai/assistant/suggest-pricing', data);
    return response.data.data!;
  }

  async generateLiveScript(data: LiveScriptRequest): Promise<LiveScript> {
    const response = await api.post<ApiResponse<LiveScript>>('/ai/assistant/generate-live-script', data);
    return response.data.data!;
  }
}

export const aiAssistantService = new AIAssistantService();
