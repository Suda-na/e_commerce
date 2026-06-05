import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ProductState, Product, CreateProductRequest, UpdateProductRequest } from '../../types';
import { productService } from '../../services/product.service';

const initialState: ProductState = {
  products: [],
  currentProduct: null,
  loading: false,
  error: null,
  detailLoading: false,
  detailError: null,
  total: 0,
  categories: [],
  selectedCategoryId: null,
};

export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (params: { page?: number; pageSize?: number; status?: string; search?: string; categoryId?: number; tag?: string } | undefined, { rejectWithValue }) => {
    try {
      return await productService.getMerchantProducts(params);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '获取商品列表失败');
    }
  }
);

export const fetchProduct = createAsyncThunk(
  'products/fetchProduct',
  async (id: number, { rejectWithValue }) => {
    try {
      return await productService.getProduct(id);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '获取商品详情失败');
    }
  }
);

export const createProduct = createAsyncThunk(
  'products/createProduct',
  async (data: CreateProductRequest, { rejectWithValue }) => {
    try {
      return await productService.createProduct(data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '创建商品失败');
    }
  }
);

export const updateProduct = createAsyncThunk(
  'products/updateProduct',
  async ({ id, data }: { id: number; data: UpdateProductRequest }, { rejectWithValue }) => {
    try {
      return await productService.updateProduct(id, data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '更新商品失败');
    }
  }
);

export const deleteProduct = createAsyncThunk(
  'products/deleteProduct',
  async (id: number, { rejectWithValue }) => {
    try {
      await productService.deleteProduct(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '删除商品失败');
    }
  }
);

export const restoreProduct = createAsyncThunk(
  'products/restoreProduct',
  async (id: number, { rejectWithValue }) => {
    try {
      return await productService.updateProductStatus(id, 'pending');
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '恢复商品失败');
    }
  }
);

export const updateProductStatus = createAsyncThunk(
  'products/updateProductStatus',
  async ({ id, status }: { id: number; status: string }, { rejectWithValue }) => {
    try {
      return await productService.updateProductStatus(id, status);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '更新商品状态失败');
    }
  }
);

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    clearCurrentProduct(state) {
      state.currentProduct = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.items ?? [];
        state.total = action.payload.total;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchProduct.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
      })
      .addCase(fetchProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        state.detailLoading = false;
        state.currentProduct = action.payload;
      })
      .addCase(fetchProduct.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload as string;
      })
      .addCase(createProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        if (!state.products) state.products = [];
        state.products.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updateProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        const index = (state.products ?? []).findIndex((p) => p.id === action.payload.id);
        if (index !== -1) state.products[index] = action.payload;
        if (state.currentProduct?.id === action.payload.id) state.currentProduct = action.payload;
      })
      .addCase(deleteProduct.fulfilled, (state, action: PayloadAction<number>) => {
        state.products = (state.products ?? []).filter((p) => p.id !== action.payload);
        state.total -= 1;
      })
      .addCase(restoreProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        const index = (state.products ?? []).findIndex((p) => p.id === action.payload.id);
        if (index !== -1) state.products[index] = action.payload;
      })
      .addCase(updateProductStatus.fulfilled, (state, action: PayloadAction<Product>) => {
        const index = (state.products ?? []).findIndex((p) => p.id === action.payload.id);
        if (index !== -1) state.products[index] = action.payload;
        if (state.currentProduct?.id === action.payload.id) state.currentProduct = action.payload;
      });
  },
});

export const { clearCurrentProduct, clearError } = productSlice.actions;
export default productSlice.reducer;
