import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import auctionRoutes from './auction.routes';
import bidRoutes from './bid.routes';
import orderRoutes from './order.routes';
import aiRoutes from './ai.routes';
import aiAssistantRoutes from './ai-assistant.routes';
import userAiRoutes from './user-ai.routes';
import uploadRoutes from './upload.routes';
import shippingTemplateRoutes from './shipping-template.routes';
import exportRoutes from './export.routes';
import notificationRoutes from './notification.routes';
import analyticsRoutes from './analytics.routes';
import pageViewRoutes from './page-view.routes';
import favoriteRoutes from './favorite.routes';

const router = Router();

// 认证路由
router.use('/auth', authRoutes);

// 商品路由
router.use('/products', productRoutes);

router.use('/categories', categoryRoutes);

// 竞拍路由
router.use('/auctions', auctionRoutes);

// 出价路由
router.use('/bids', bidRoutes);

// 订单路由
router.use('/orders', orderRoutes);

// AI服务路由
router.use('/ai', aiRoutes);

// AI辅助路由
router.use('/ai/assistant', aiAssistantRoutes);

// 用户端AI路由
router.use('/ai/user', userAiRoutes);

// 文件上传路由
router.use('/upload', uploadRoutes);

// 运费模板路由
router.use('/shipping-templates', shippingTemplateRoutes);

router.use('/export', exportRoutes);

router.use('/notifications', notificationRoutes);

router.use('/analytics', analyticsRoutes);

// 页面浏览记录路由
router.use('/page-views', pageViewRoutes);

router.use('/favorites', favoriteRoutes);

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: '直播竞拍全栈系统API',
      version: '1.0.0',
      description: '抖音电商直播竞拍全栈系统后端服务',
      endpoints: {
        auth: '/api/auth',
        products: '/api/products',
        categories: '/api/categories',
        auctions: '/api/auctions',
        bids: '/api/bids',
        orders: '/api/orders',
        upload: '/api/upload',
        shippingTemplates: '/api/shipping-templates',
        export: '/api/export',
        notifications: '/api/notifications',
        analytics: '/api/analytics',
        pageViews: '/api/page-views',
        ai: '/api/ai',
        userAi: '/api/ai/user',
      },
      documentation: '/api/docs',
      health: '/health',
    },
  });
});

export default router;