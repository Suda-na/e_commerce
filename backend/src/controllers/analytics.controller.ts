import { Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { successResponse } from '../utils/response';

export const analyticsController = {
  async getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.user?.role === 'merchant' ? req.user.userId : undefined;

      const dashboard = await analyticsService.getDashboard(merchantId);

      successResponse(res, dashboard);
    } catch (error: any) {
      logger.error('getDashboard error', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      next(error);
    }
  },

  async getAIDailyReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.user?.role === 'merchant' ? req.user.userId : undefined;
      const report = await analyticsService.getAIDailyReport(merchantId);
      successResponse(res, report);
    } catch (error: any) {
      logger.error('getAIDailyReport error', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      next(error);
    }
  },

  async getAuctionFunnel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.user?.role === 'merchant' ? req.user.userId : undefined;
      const funnel = await analyticsService.getAuctionFunnel(merchantId);
      successResponse(res, funnel);
    } catch (error: any) {
      logger.error('getAuctionFunnel error', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      next(error);
    }
  },

  async getPricingSuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.user?.role === 'merchant' ? req.user.userId : undefined;
      const suggestions = await analyticsService.getPricingSuggestions(merchantId);
      successResponse(res, suggestions);
    } catch (error: any) {
      logger.error('getPricingSuggestions error', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      next(error);
    }
  },
};

export default analyticsController;
