import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { auctionService } from '../services/auction.service';
import { 
  CreateAuctionDto, 
  UpdateAuctionStatusDto, 
  AuctionQueryDto 
} from '../dto/auction.dto';
import { AuthenticationError, AuthorizationError, ValidationError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { successResponse, successResponseWithPagination, createdResponse, noDataResponse } from '../utils/response';

export class AuctionController {
  /**
   * 创建竞拍
   */
  async createAuction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以创建竞拍');
      }

      const auctionData: CreateAuctionDto = {
        product_id: req.body.product_id,
      };

      const auction = await auctionService.createAuction(req.user.userId, auctionData);

      logger.info(`Auction created via API: ${auction.id}`);

      createdResponse(res, auction, '竞拍创建成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 开始竞拍
   */
  async startAuction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以开始竞拍');
      }

      const auctionId = parseInt(req.params.id);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      const auction = await auctionService.startAuction(auctionId, req.user.userId);

      logger.info(`Auction started via API: ${auctionId}`);

      successResponse(res, auction, '竞拍已开始');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 结束竞拍
   */
  async completeAuction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以结束竞拍');
      }

      const auctionId = parseInt(req.params.id);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      const auction = await auctionService.completeAuction(auctionId);

      logger.info(`Auction completed via API: ${auctionId}`);

      successResponse(res, auction, '竞拍已结束');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 取消竞拍
   */
  async cancelAuction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以取消竞拍');
      }

      const auctionId = parseInt(req.params.id);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      const auction = await auctionService.cancelAuction(auctionId, req.user.userId);

      logger.info(`Auction cancelled via API: ${auctionId}`);

      successResponse(res, auction, '竞拍已取消');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 上架商品（创建竞拍并立即开始）
   */
  async listProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以上架商品');
      }

      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        throw new ValidationError('无效的商品ID');
      }

      const auction = await auctionService.listProduct(req.user.userId, productId);

      logger.info(`Product listed via API: product ${productId}`);

      successResponse(res, auction, '商品已上架');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 下架商品（取消竞拍并将状态改为已取消）
   */
  async delistProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以下架商品');
      }

      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        throw new ValidationError('无效的商品ID');
      }

      const auction = await auctionService.delistProduct(req.user.userId, productId);

      logger.info(`Product delisted via API: product ${productId}`);

      successResponse(res, auction, '商品已下架');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取竞拍详情
   */
  async getAuctionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctionId = parseInt(req.params.id);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      const auction = await auctionService.getAuctionById(auctionId);

      successResponse(res, auction);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取竞拍列表
   */
  async getAuctions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query: AuctionQueryDto = {
        status: req.query.status as any,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sort: req.query.sort as string,
        order: req.query.order as 'ASC' | 'DESC',
        keyword: req.query.keyword as string,
        merchant_id: req.query.merchant_id ? parseInt(req.query.merchant_id as string) : undefined,
      };

      const result = await auctionService.getAuctions(query);

      successResponseWithPagination(res, result.auctions, result.page, result.limit, result.total, result.totalPages);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取商家的竞拍列表
   */
  async getMerchantAuctions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以查看自己的竞拍');
      }

      const query: AuctionQueryDto = {
        status: req.query.status as any,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sort: req.query.sort as string,
        order: req.query.order as 'ASC' | 'DESC',
      };

      const result = await auctionService.getMerchantAuctions(req.user.userId, query);

      successResponseWithPagination(res, result.auctions, result.page, result.limit, result.total, result.totalPages);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取商品的竞拍
   */
  async getAuctionByProductId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        throw new ValidationError('无效的商品ID');
      }

      const auction = await auctionService.getAuctionByProductId(productId);

      successResponse(res, auction);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户加入竞拍房间
   */
  async joinAuctionRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const auctionId = parseInt(req.params.id);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      await auctionService.joinAuctionRoom(auctionId, req.user.userId);

      noDataResponse(res, '已加入竞拍房间');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户离开竞拍房间
   */
  async leaveAuctionRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const auctionId = parseInt(req.params.id);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      await auctionService.leaveAuctionRoom(auctionId, req.user.userId);

      noDataResponse(res, '已离开竞拍房间');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取竞拍排行榜
   */
  async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctionId = parseInt(req.params.id);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const leaderboard = await auctionService.getLeaderboard(auctionId, limit);

      successResponse(res, leaderboard);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 处理出价（HTTP接口，主要用于测试）
   */
  async placeBid(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const auctionId = parseInt(req.params.id);
      if (isNaN(auctionId)) {
        throw new ValidationError('无效的竞拍ID');
      }

      const amount = parseFloat(req.body.amount);
      if (isNaN(amount)) {
        throw new ValidationError('无效的出价金额');
      }

      const result = await auctionService.placeBid(auctionId, req.user.userId, amount);

      logger.info(`Bid placed via API: auction ${auctionId}, user ${req.user.userId}, amount ${amount}`);

      successResponse(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const auctionController = new AuctionController();