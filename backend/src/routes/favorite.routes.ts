import { Router } from 'express';
import { param, query } from 'express-validator';
import { favoriteController } from '../controllers/favorite.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post(
  '/:merchantId',
  authenticate,
  param('merchantId').isInt({ min: 1 }).withMessage('无效的商家ID'),
  asyncHandler(favoriteController.toggleFavorite)
);

router.get(
  '/check/:merchantId',
  authenticate,
  param('merchantId').isInt({ min: 1 }).withMessage('无效的商家ID'),
  asyncHandler(favoriteController.checkFavorite)
);

router.get(
  '/',
  authenticate,
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量1-50').toInt(),
  asyncHandler(favoriteController.getFavorites)
);

router.delete(
  '/:merchantId',
  authenticate,
  param('merchantId').isInt({ min: 1 }).withMessage('无效的商家ID'),
  asyncHandler(favoriteController.removeFavorite)
);

export default router;
