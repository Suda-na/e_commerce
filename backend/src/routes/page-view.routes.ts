import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { distributedRateLimit } from '../middleware/security.middleware';
import { securityConfig } from '../config/security.config';
import { pageViewService } from '../services/page-view.service';
import { logger } from '../utils/logger';

const router = Router();

const apiRateLimit = distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.api.windowMs,
  max: securityConfig.apiSecurity.rateLimit.api.max,
  keyGenerator: (req) => `rate:api:page-views:${req.ip}`,
  message: 'API请求过于频繁，请稍后再试',
});

/**
 * POST /api/page-views
 * 记录页面浏览
 */
router.post(
  '/',
  apiRateLimit,
  [
    body('product_id')
      .isInt({ min: 1 })
      .withMessage('无效的商品ID')
      .toInt(),
    body('page_type')
      .optional()
      .isIn(['product', 'auction', 'live'])
      .withMessage('页面类型必须是 product、auction 或 live'),
    body('session_id')
      .notEmpty()
      .withMessage('会话ID不能为空')
      .isLength({ max: 128 })
      .withMessage('会话ID不能超过128个字符'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { product_id, page_type, session_id } = req.body;

    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referrer = (req.headers.referer || req.headers.referrer || null) as string | null;
    const userId = (req as any).user?.userId;

    await pageViewService.recordView({
      product_id,
      user_id: userId,
      session_id,
      ip_address: ipAddress,
      user_agent: userAgent,
      referrer: referrer || undefined,
      page_type: page_type || 'product',
    });

    res.json({
      success: true,
      message: '浏览记录已保存',
    });
  })
);

/**
 * GET /api/page-views/product/:productId
 * 获取商品浏览量
 */
router.get(
  '/product/:productId',
  apiRateLimit,
  [
    param('productId')
      .isInt({ min: 1 })
      .withMessage('无效的商品ID')
      .toInt(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const productId = parseInt(req.params.productId);

    const views = await pageViewService.getProductViews(productId);

    res.json({
      success: true,
      data: {
        productId,
        views,
      },
    });
  })
);

/**
 * POST /api/page-views/batch
 * 批量获取商品浏览量
 */
router.post(
  '/batch',
  apiRateLimit,
  [
    body('product_ids')
      .isArray({ min: 1, max: 100 })
      .withMessage('商品ID数组长度必须在1-100之间'),
    body('product_ids.*')
      .isInt({ min: 1 })
      .withMessage('无效的商品ID')
      .toInt(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { product_ids } = req.body;

    const viewsMap = await pageViewService.getProductsViews(product_ids);

    // 将Map转换为普通对象
    const data: Record<number, number> = {};
    viewsMap.forEach((value, key) => {
      data[key] = value;
    });

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * GET /api/page-views/hourly
 * 获取24小时流量统计
 */
router.get(
  '/hourly',
  apiRateLimit,
  [
    query('merchant_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('无效的商家ID')
      .toInt(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const merchantId = req.query.merchant_id 
      ? parseInt(req.query.merchant_id as string) 
      : undefined;

    const data = await pageViewService.getHourlyTraffic(merchantId);

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * GET /api/page-views/trend/:productId
 * 获取商品浏览趋势
 */
router.get(
  '/trend/:productId',
  apiRateLimit,
  [
    param('productId')
      .isInt({ min: 1 })
      .withMessage('无效的商品ID')
      .toInt(),
    query('days')
      .optional()
      .isInt({ min: 1, max: 90 })
      .withMessage('天数必须在1-90之间')
      .toInt(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const productId = parseInt(req.params.productId);
    const days = req.query.days ? parseInt(req.query.days as string) : 7;

    const data = await pageViewService.getViewsTrend(productId, days);

    res.json({
      success: true,
      data,
    });
  })
);

export default router;
