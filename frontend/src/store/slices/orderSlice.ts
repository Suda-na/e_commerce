import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { OrderState, Order } from '../../types';
import { orderService } from '../../services/order.service';

const initialState: OrderState = {
  orders: [],
  currentOrder: null,
  loading: false,
  error: null,
  total: 0,
};

export const fetchOrders = createAsyncThunk(
  'orders/fetchOrders',
  async (params: { page?: number; pageSize?: number; status?: string } | undefined, { rejectWithValue }) => {
    try {
      return await orderService.getMerchantOrders(params);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '获取订单列表失败');
    }
  }
);

export const fetchOrder = createAsyncThunk(
  'orders/fetchOrder',
  async (id: number, { rejectWithValue }) => {
    try {
      return await orderService.getOrder(id);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '获取订单详情失败');
    }
  }
);

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearCurrentOrder(state) {
      state.currentOrder = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload?.items ?? [];
        state.total = action.payload?.total ?? 0;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchOrder.fulfilled, (state, action: PayloadAction<Order>) => {
        state.currentOrder = action.payload;
      });
  },
});

export const { clearCurrentOrder, clearError } = orderSlice.actions;
export default orderSlice.reducer;
