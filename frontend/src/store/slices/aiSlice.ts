import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { aiAssistantService } from '../../services/ai-assistant.service';
import {
  GenerateDescriptionRequest,
  GenerateDescriptionResponse,
  BroadcastSuggestionResponse,
  ScriptTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '../../types';

// ==================== Async Thunks ====================

export const generateDescription = createAsyncThunk(
  'ai/generateDescription',
  async (data: GenerateDescriptionRequest, { rejectWithValue }) => {
    try {
      const result = await aiAssistantService.generateDescription(data);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'AI 描述生成失败');
    }
  }
);

export const fetchBroadcastSuggestion = createAsyncThunk(
  'ai/fetchBroadcastSuggestion',
  async ({ auctionId, context }: { auctionId: number; context?: string }, { rejectWithValue }) => {
    try {
      const result = await aiAssistantService.getBroadcastSuggestion(auctionId, context);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '获取话术建议失败');
    }
  }
);

export const fetchTemplates = createAsyncThunk(
  'ai/fetchTemplates',
  async (_, { rejectWithValue }) => {
    try {
      const result = await aiAssistantService.getAllTemplates();
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '获取模板列表失败');
    }
  }
);

export const createTemplate = createAsyncThunk(
  'ai/createTemplate',
  async (data: CreateTemplateRequest, { rejectWithValue }) => {
    try {
      const result = await aiAssistantService.createTemplate(data);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '创建模板失败');
    }
  }
);

export const updateTemplate = createAsyncThunk(
  'ai/updateTemplate',
  async ({ id, data }: { id: string; data: UpdateTemplateRequest }, { rejectWithValue }) => {
    try {
      const result = await aiAssistantService.updateTemplate(id, data);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '更新模板失败');
    }
  }
);

export const deleteTemplate = createAsyncThunk(
  'ai/deleteTemplate',
  async (id: string, { rejectWithValue }) => {
    try {
      await aiAssistantService.deleteTemplate(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '删除模板失败');
    }
  }
);

// ==================== State Interface ====================

interface AIState {
  // Description generation
  descriptionLoading: boolean;
  descriptionResult: GenerateDescriptionResponse | null;
  descriptionError: string | null;

  // Broadcast suggestions
  broadcastLoading: boolean;
  broadcastResult: BroadcastSuggestionResponse | null;
  broadcastError: string | null;

  // Templates
  templates: ScriptTemplate[];
  templatesLoading: boolean;
  templatesError: string | null;

  // Template CRUD
  templateSaving: boolean;
  templateDeleting: boolean;

  // General
  lastError: string | null;
}

const initialState: AIState = {
  descriptionLoading: false,
  descriptionResult: null,
  descriptionError: null,

  broadcastLoading: false,
  broadcastResult: null,
  broadcastError: null,

  templates: [],
  templatesLoading: false,
  templatesError: null,

  templateSaving: false,
  templateDeleting: false,

  lastError: null,
};

// ==================== Slice ====================

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    clearDescriptionResult(state) {
      state.descriptionResult = null;
      state.descriptionError = null;
    },
    clearBroadcastResult(state) {
      state.broadcastResult = null;
      state.broadcastError = null;
    },
    clearErrors(state) {
      state.descriptionError = null;
      state.broadcastError = null;
      state.templatesError = null;
      state.lastError = null;
    },
  },
  extraReducers: (builder) => {
    // ---- generateDescription ----
    builder
      .addCase(generateDescription.pending, (state) => {
        state.descriptionLoading = true;
        state.descriptionError = null;
      })
      .addCase(generateDescription.fulfilled, (state, action: PayloadAction<GenerateDescriptionResponse>) => {
        state.descriptionLoading = false;
        state.descriptionResult = action.payload;
      })
      .addCase(generateDescription.rejected, (state, action) => {
        state.descriptionLoading = false;
        state.descriptionError = action.payload as string;
        state.lastError = action.payload as string;
      });

    // ---- fetchBroadcastSuggestion ----
    builder
      .addCase(fetchBroadcastSuggestion.pending, (state) => {
        state.broadcastLoading = true;
        state.broadcastError = null;
      })
      .addCase(fetchBroadcastSuggestion.fulfilled, (state, action: PayloadAction<BroadcastSuggestionResponse>) => {
        state.broadcastLoading = false;
        state.broadcastResult = action.payload;
      })
      .addCase(fetchBroadcastSuggestion.rejected, (state, action) => {
        state.broadcastLoading = false;
        state.broadcastError = action.payload as string;
        state.lastError = action.payload as string;
      });

    // ---- fetchTemplates ----
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.templatesLoading = true;
        state.templatesError = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action: PayloadAction<ScriptTemplate[]>) => {
        state.templatesLoading = false;
        state.templates = action.payload;
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.templatesLoading = false;
        state.templatesError = action.payload as string;
      });

    // ---- createTemplate ----
    builder
      .addCase(createTemplate.pending, (state) => {
        state.templateSaving = true;
      })
      .addCase(createTemplate.fulfilled, (state, action: PayloadAction<ScriptTemplate>) => {
        state.templateSaving = false;
        state.templates.push(action.payload);
      })
      .addCase(createTemplate.rejected, (state, action) => {
        state.templateSaving = false;
        state.lastError = action.payload as string;
      });

    // ---- updateTemplate ----
    builder
      .addCase(updateTemplate.pending, (state) => {
        state.templateSaving = true;
      })
      .addCase(updateTemplate.fulfilled, (state, action: PayloadAction<ScriptTemplate>) => {
        state.templateSaving = false;
        const index = state.templates.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.templates[index] = action.payload;
        }
      })
      .addCase(updateTemplate.rejected, (state, action) => {
        state.templateSaving = false;
        state.lastError = action.payload as string;
      });

    // ---- deleteTemplate ----
    builder
      .addCase(deleteTemplate.pending, (state) => {
        state.templateDeleting = true;
      })
      .addCase(deleteTemplate.fulfilled, (state, action: PayloadAction<string>) => {
        state.templateDeleting = false;
        state.templates = state.templates.filter((t) => t.id !== action.payload);
      })
      .addCase(deleteTemplate.rejected, (state, action) => {
        state.templateDeleting = false;
        state.lastError = action.payload as string;
      });
  },
});

export const { clearDescriptionResult, clearBroadcastResult, clearErrors } = aiSlice.actions;
export default aiSlice.reducer;
