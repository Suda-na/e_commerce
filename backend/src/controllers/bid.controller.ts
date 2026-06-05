import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { bidService } from '../services/bid.service';
import { ValidationError, AuthenticationError, NotFoundError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { PlaceBidDto, BidQueryDto } from '../dto/bid.dto';
import { successResponse, noDataResponse } from '../utils/response';

export const bidController = {
  /**
   * 出价（核心高并发接口）
   */
  async placeBid(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const auctionId = parseInt(req.params.auctionId);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      const bidData: PlaceBidDto = {
        amount: req.body.amount,
        requestId: req.body.requestId,
      };

      // 调用出价服务
      const result = await bidService.placeBid(auctionId, req.user.userId, bidData);

      logger.info(`Bid placed by user ${req.user.userId} for auction ${auctionId}: ${bidData.amount}`);

      successResponse(res, result, '出价成功');
    } catch (error) {
      next(error);
    }
  },

  /**
   * 验证出价金额
   */
  async validateBidAmount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctionId = parseInt(req.params.auctionId);
      const amount = parseFloat(req.params.amount);

      if (isNaN(auctionId) || isNaN(amount)) {
        throw new ValidationError('无效的竞拍ID或金额');
      }

      const validation = await bidService.validateBidAmount(auctionId, amount);

      successResponse(res, validation);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 获取竞拍排行榜
   */
  async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctionId = parseInt(req.params.auctionId);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await bidService.getLeaderboard(auctionId, limit);

      successResponse(res, leaderboard);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 获取出价历史
   */
  async getBidHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctionId = parseInt(req.params.auctionId);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      // 可选认证：如果有用户ID则获取该用户的出价历史
      const userId = req.user?.userId;
      const history = await bidService.getBidHistory(auctionId, userId);

      successResponse(res, history);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 获取出价统计
   */
  async getBidStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctionId = parseInt(req.params.auctionId);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      const stats = await bidService.getBidStats(auctionId);

      successResponse(res, stats);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 获取当前用户的出价记录
   */
  async getUserBids(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      // 先刷新Redis队列中的出价到数据库，确保查询结果准确
      try {
        await bidService.flushAllBidQueues();
      } catch (flushError) {
        logger.warn('[getUserBids] 刷新Redis队列失败:', flushError);
      }

      const query: BidQueryDto = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
      };

      const result = await bidService.getUserBids(req.user.userId, query);

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 获取竞拍的出价列表
   */
  async getAuctionBids(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctionId = parseInt(req.params.auctionId);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const query: BidQueryDto = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        userId: req.query.userId as string,
      };

      const result = await bidService.getAuctionBids(auctionId, query);

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 手动刷新所有出价队列（管理员功能）
   */
  async flushAllBidQueues(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 检查管理员权限（这里简单检查用户ID为1的管理员）
      if (req.user.userId !== 1) {
        throw new ValidationError('无管理员权限');
      }

      await bidService.flushAllBidQueues();

      logger.info(`All bid queues flushed by admin user ${req.user.userId}`);

      noDataResponse(res, '所有出价队列已刷新');
    } catch (error) {
      next(error);
    }
  },
};

export default bidController;