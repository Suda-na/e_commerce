import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ConfigProvider, App as AntApp, theme, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { store } from './store';
import { useAppSelector, useAppDispatch } from './utils/hooks';
import { authService } from './services/auth.service';
import { logout } from './store/slices/authSlice';
import MainLayout from './components/Layout/MainLayout';

const LoginPage = lazy(() => import('./pages/Login'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const ProductsPage = lazy(() => import('./pages/Products'));
const ProductDetailPage = lazy(() => import('./pages/Products/ProductDetail'));
const AuctionsPage = lazy(() => import('./pages/Auctions'));
const AuctionDetailPage = lazy(() => import('./pages/Auctions/AuctionDetail'));
const OrdersPage = lazy(() => import('./pages/Orders'));
const AIAssistantPage = lazy(() => import('./pages/AI'));
const AnalyticsPage = lazy(() => import('./pages/Analytics'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const LiveRoomPage = lazy(() => import('./pages/LiveRoom'));

// Redirect old order detail route to orders page with query param
const OrderDetailRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/merchant/orders?orderId=${id}`} replace />;
};

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string }> = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  // 检查 token 是否有效（包括过期检查）
  useEffect(() => {
    if (isAuthenticated && !authService.isAuthenticated()) {
      // Token 已过期或无效，执行登出
      dispatch(logout());
    }
  }, [isAuthenticated, dispatch]);

  if (!isAuthenticated || !authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Role-based access control
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/merchant/dashboard" replace />;
  }

  return <>{children}</>;
};

// Auth route (redirect if already logged in)
const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  if (isAuthenticated) {
    return <Navigate to="/merchant/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<Spin size="large" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }} />}>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthRoute>
              <LoginPage />
            </AuthRoute>
          }
        />

        <Route
          path="/merchant"
          element={
            <ProtectedRoute requiredRole="merchant">
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/merchant/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="auctions" element={<AuctionsPage />} />
          <Route path="auctions/:id" element={<AuctionDetailPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailRedirect />} />
          <Route path="ai-assistant" element={<AIAssistantPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="live-room" element={<LiveRoomPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#d4a017',
            borderRadius: 8,
            fontFamily: "'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          },
          algorithm: theme.defaultAlgorithm,
        }}
      >
        <AntApp>
          <Router>
            <AppRoutes />
          </Router>
        </AntApp>
      </ConfigProvider>
    </Provider>
  );
};

export default App;
