import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import productReducer from './slices/productSlice';
import auctionReducer from './slices/auctionSlice';
import orderReducer from './slices/orderSlice';
import aiReducer from './slices/aiSlice';
import userAiReducer from './slices/userAiSlice';
import categoryReducer from './slices/categorySlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    products: productReducer,
    auctions: auctionReducer,
    orders: orderReducer,
    ai: aiReducer,
    userAi: userAiReducer,
    categories: categoryReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
