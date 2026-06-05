import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { distributedRateLimit } from '../middleware/security.middleware';
import { securityConfig } from '../config/security.config';

const router = Router();

const apiRateLimit = distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.api.windowMs,
  max: securityConfig.apiSecurity.rateLimit.api.max,
  keyGenerator: (req) => `rate:api:analytics:${req.ip}`,
  message: 'API请求过于频繁，请稍后再试',
});

router.get(
  '/dashboard',
  authenticate,
  apiRateLimit,
  asyncHandler(analyticsController.getDashboard)
);

router.get(
  '/ai-daily-report',
  authenticate,
  apiRateLimit,
  asyncHandler(analyticsController.getAIDailyReport)
);

router.get(
  '/funnel',
  authenticate,
  apiRateLimit,
  asyncHandler(analyticsController.getAuctionFunnel)
);

router.get(
  '/pricing-suggestions',
  authenticate,
  apiRateLimit,
  asyncHandler(analyticsController.getPricingSuggestions)
);

export default router;
