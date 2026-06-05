import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { favoriteService } from '../services/favorite.service';
import { AuthenticationError, ValidationError } from '../middleware/errorHandler';
import { successResponse } from '../utils/response';

export const favoriteController = {
  async toggleFavorite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const merchantId = parseInt(req.params.merchantId);
      if (isNaN(merchantId)) throw new ValidationError('无效的商家ID');

      const result = await favoriteService.addFavorite(req.user.userId, merchantId);

      successResponse(res, result, result.isFavorite ? '已收藏' : '已取消收藏');
    } catch (error) {
      next(error);
    }
  },

  async checkFavorite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const merchantId = parseInt(req.params.merchantId);
      if (isNaN(merchantId)) throw new ValidationError('无效的商家ID');

      const isFavorite = await favoriteService.checkFavorite(req.user.userId, merchantId);

      res.json({ success: true, data: { isFavorite } });
    } catch (error) {
      next(error);
    }
  },

  async getFavorites(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const result = await favoriteService.getFavorites(req.user.userId, {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  async removeFavorite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('未认证');

      const merchantId = parseInt(req.params.merchantId);
      if (isNaN(merchantId)) throw new ValidationError('无效的商家ID');

      const deleted = await favoriteService.removeFavorite(req.user.userId, merchantId);
      if (!deleted) throw new ValidationError('收藏记录不存在');

      successResponse(res, null, '已取消收藏');
    } catch (error) {
      next(error);
    }
  },
};

export default favoriteController;
