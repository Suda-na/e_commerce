import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuctionState, Auction, AuctionStatus, LeaderboardEntry } from '../../types';
import { auctionService } from '../../services/auction.service';

const initialState: AuctionState = {
  auctions: [],
  currentAuction: null,
  leaderboard: [],
  onlineCount: 0,
  participantCount: 0,
  loading: false,
  error: null,
  total: 0,
};

const extractErrorMessage = (error: any, fallback: string): string => {
  return error.response?.data?.error?.message || error.response?.data?.message || error.message || fallback;
};

export const fetchAuctions = createAsyncThunk(
  'auctions/fetchAuctions',
  async (params: { page?: number; pageSize?: number; status?: string } | undefined, { rejectWithValue }) => {
    try {
      return await auctionService.getAuctions(params);
    } catch (error: any) {
      return rejectWithValue(extractErrorMessage(error, '获取竞拍列表失败'));
    }
  }
);

export const fetchAuction = createAsyncThunk(
  'auctions/fetchAuction',
  async (id: number, { rejectWithValue }) => {
    try {
      return await auctionService.getAuction(id);
    } catch (error: any) {
      return rejectWithValue(extractErrorMessage(error, '获取竞拍详情失败'));
    }
  }
);

export const createAuction = createAsyncThunk(
  'auctions/createAuction',
  async (data: { productId: number }, { rejectWithValue }) => {
    try {
      return await auctionService.createAuction(data);
    } catch (error: any) {
      return rejectWithValue(extractErrorMessage(error, '创建竞拍失败'));
    }
  }
);

export const startAuction = createAsyncThunk(
  'auctions/startAuction',
  async (id: number, { rejectWithValue }) => {
    try {
      return await auctionService.startAuction(id);
    } catch (error: any) {
      return rejectWithValue(extractErrorMessage(error, '开始竞拍失败'));
    }
  }
);

export const endAuction = createAsyncThunk(
  'auctions/endAuction',
  async (id: number, { rejectWithValue }) => {
    try {
      return await auctionService.endAuction(id);
    } catch (error: any) {
      return rejectWithValue(extractErrorMessage(error, '结束竞拍失败'));
    }
  }
);

export const cancelAuction = createAsyncThunk(
  'auctions/cancelAuction',
  async (id: number, { rejectWithValue }) => {
    try {
      return await auctionService.cancelAuction(id);
    } catch (error: any) {
      return rejectWithValue(extractErrorMessage(error, '取消竞拍失败'));
    }
  }
);

export const fetchLeaderboard = createAsyncThunk(
  'auctions/fetchLeaderboard',
  async (id: number, { rejectWithValue }) => {
    try {
      return await auctionService.getLeaderboard(id);
    } catch (error: any) {
      return rejectWithValue(extractErrorMessage(error, '获取排行榜失败'));
    }
  }
);

const auctionSlice = createSlice({
  name: 'auctions',
  initialState,
  reducers: {
    clearCurrentAuction(state) {
      state.currentAuction = null;
      state.leaderboard = [];
      state.onlineCount = 0;
      state.participantCount = 0;
    },
    clearError(state) {
      state.error = null;
    },
    updateLeaderboard(state, action: PayloadAction<LeaderboardEntry[]>) {
      state.leaderboard = action.payload;
    },
    updateOnlineCount(state, action: PayloadAction<number>) {
      state.onlineCount = action.payload;
    },
    updateParticipantCount(state, action: PayloadAction<number>) {
      state.participantCount = action.payload;
    },
    updateCurrentPrice(state, action: PayloadAction<{ price: number; bidCount: number }>) {
      if (state.currentAuction) {
        state.currentAuction.currentPrice = action.payload.price;
        state.currentAuction.bidCount = action.payload.bidCount;
      }
    },
    updateAuctionStatus(state, action: PayloadAction<AuctionStatus>) {
      if (state.currentAuction) {
        state.currentAuction.status = action.payload;
      }
    },
    updateEndTime(state, action: PayloadAction<string>) {
      if (state.currentAuction) {
        state.currentAuction.endTime = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuctions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAuctions.fulfilled, (state, action) => {
        state.loading = false;
        state.auctions = action.payload?.items ?? [];
        state.total = action.payload?.total ?? 0;
      })
      .addCase(fetchAuctions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAuction.fulfilled, (state, action: PayloadAction<Auction>) => {
        state.currentAuction = action.payload;
        state.participantCount = action.payload.participantCount ?? 0;
      })
      .addCase(createAuction.fulfilled, (state, action: PayloadAction<Auction>) => {
        if (!state.auctions) state.auctions = [];
        state.auctions.unshift(action.payload);
        state.total += 1;
      })
      .addCase(startAuction.fulfilled, (state, action: PayloadAction<Auction>) => {
        const index = state.auctions.findIndex((a) => a.id === action.payload.id);
        if (index !== -1) state.auctions[index] = action.payload;
        if (state.currentAuction?.id === action.payload.id) state.currentAuction = action.payload;
      })
      .addCase(endAuction.fulfilled, (state, action: PayloadAction<Auction>) => {
        const index = state.auctions.findIndex((a) => a.id === action.payload.id);
        if (index !== -1) state.auctions[index] = action.payload;
        if (state.currentAuction?.id === action.payload.id) {
          state.currentAuction = action.payload;
          state.participantCount = action.payload.participantCount ?? 0;
        }
      })
      .addCase(cancelAuction.fulfilled, (state, action: PayloadAction<Auction>) => {
        const index = state.auctions.findIndex((a) => a.id === action.payload.id);
        if (index !== -1) state.auctions[index] = action.payload;
        if (state.currentAuction?.id === action.payload.id) state.currentAuction = action.payload;
      })
      .addCase(fetchLeaderboard.fulfilled, (state, action: PayloadAction<LeaderboardEntry[]>) => {
        state.leaderboard = action.payload;
      });
  },
});

export const { clearCurrentAuction, clearError, updateLeaderboard, updateOnlineCount, updateParticipantCount, updateCurrentPrice, updateAuctionStatus, updateEndTime } = auctionSlice.actions;
export default auctionSlice.reducer;
