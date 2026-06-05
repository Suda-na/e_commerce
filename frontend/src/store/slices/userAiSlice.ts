import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { userAIService } from '../../services/user-ai.service';
import {
  BidSuggestionResponse,
  TrendAnalysisResponse,
  SmartAlertsResponse,
  RiskLevel,
} from '../../types';

// ==================== Async Thunks ====================

export const fetchBidSuggestion = createAsyncThunk(
  'userAi/fetchBidSuggestion',
  async (
    { auctionId, riskLevel, currentBudget }: { auctionId: number; riskLevel?: RiskLevel; currentBudget?: number },
    { rejectWithValue },
  ) => {
    try {
      const result = await userAIService.getBidSuggestion(auctionId, riskLevel, currentBudget);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '获取出价建议失败');
    }
  },
);

export const fetchTrendAnalysis = createAsyncThunk(
  'userAi/fetchTrendAnalysis',
  async (
    { auctionId, timeWindow }: { auctionId: number; timeWindow?: number },
    { rejectWithValue },
  ) => {
    try {
      const result = await userAIService.getTrendAnalysis(auctionId, timeWindow);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '趋势分析失败');
    }
  },
);

export const fetchSmartAlerts = createAsyncThunk(
  'userAi/fetchSmartAlerts',
  async (auctionId: number, { rejectWithValue }) => {
    try {
      const result = await userAIService.getSmartAlerts(auctionId);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '获取智能提醒失败');
    }
  },
);

// ==================== State ====================

interface UserAIState {
  bidSuggestion: BidSuggestionResponse | null;
  bidSuggestionLoading: boolean;
  bidSuggestionError: string | null;

  trendAnalysis: TrendAnalysisResponse | null;
  trendAnalysisLoading: boolean;
  trendAnalysisError: string | null;

  smartAlerts: SmartAlertsResponse | null;
  smartAlertsLoading: boolean;
  smartAlertsError: string | null;

  selectedRiskLevel: RiskLevel;
}

const initialState: UserAIState = {
  bidSuggestion: null,
  bidSuggestionLoading: false,
  bidSuggestionError: null,

  trendAnalysis: null,
  trendAnalysisLoading: false,
  trendAnalysisError: null,

  smartAlerts: null,
  smartAlertsLoading: false,
  smartAlertsError: null,

  selectedRiskLevel: 'moderate',
};

// ==================== Slice ====================

const userAiSlice = createSlice({
  name: 'userAi',
  initialState,
  reducers: {
    setRiskLevel(state, action: PayloadAction<RiskLevel>) {
      state.selectedRiskLevel = action.payload;
    },
    clearBidSuggestion(state) {
      state.bidSuggestion = null;
      state.bidSuggestionError = null;
    },
    clearTrendAnalysis(state) {
      state.trendAnalysis = null;
      state.trendAnalysisError = null;
    },
    clearSmartAlerts(state) {
      state.smartAlerts = null;
      state.smartAlertsError = null;
    },
    clearAllUserAI(state) {
      state.bidSuggestion = null;
      state.trendAnalysis = null;
      state.smartAlerts = null;
      state.bidSuggestionError = null;
      state.trendAnalysisError = null;
      state.smartAlertsError = null;
    },
  },
  extraReducers: (builder) => {
    // fetchBidSuggestion
    builder
      .addCase(fetchBidSuggestion.pending, (state) => {
        state.bidSuggestionLoading = true;
        state.bidSuggestionError = null;
      })
      .addCase(fetchBidSuggestion.fulfilled, (state, action: PayloadAction<BidSuggestionResponse>) => {
        state.bidSuggestionLoading = false;
        state.bidSuggestion = action.payload;
      })
      .addCase(fetchBidSuggestion.rejected, (state, action) => {
        state.bidSuggestionLoading = false;
        state.bidSuggestionError = action.payload as string;
      });

    // fetchTrendAnalysis
    builder
      .addCase(fetchTrendAnalysis.pending, (state) => {
        state.trendAnalysisLoading = true;
        state.trendAnalysisError = null;
      })
      .addCase(fetchTrendAnalysis.fulfilled, (state, action: PayloadAction<TrendAnalysisResponse>) => {
        state.trendAnalysisLoading = false;
        state.trendAnalysis = action.payload;
      })
      .addCase(fetchTrendAnalysis.rejected, (state, action) => {
        state.trendAnalysisLoading = false;
        state.trendAnalysisError = action.payload as string;
      });

    // fetchSmartAlerts
    builder
      .addCase(fetchSmartAlerts.pending, (state) => {
        state.smartAlertsLoading = true;
        state.smartAlertsError = null;
      })
      .addCase(fetchSmartAlerts.fulfilled, (state, action: PayloadAction<SmartAlertsResponse>) => {
        state.smartAlertsLoading = false;
        state.smartAlerts = action.payload;
      })
      .addCase(fetchSmartAlerts.rejected, (state, action) => {
        state.smartAlertsLoading = false;
        state.smartAlertsError = action.payload as string;
      });
  },
});

export const { setRiskLevel, clearBidSuggestion, clearTrendAnalysis, clearSmartAlerts, clearAllUserAI } = userAiSlice.actions;
export default userAiSlice.reducer;
