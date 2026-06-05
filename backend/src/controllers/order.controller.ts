import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { orderService } from '../services/order.service';
import { ValidationError, AuthenticationError, AuthorizationError, NotFoundError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { successResponse, noDataResponse } from '../utils/response';
import { OrderQueryDto, ShipOrderDto, RefundActionDto, UpdateRemarkDto, UpdateAddressDto } from '../dto/order.dto';

export const orderController = {
  /**
   * 获取订单列表
   */
  async getOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const query: OrderQueryDto = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        status: req.query.status as any,
        auctionId: req.query.auctionId as string,
      };

      logger.info('getOrders called', { userId: req.user.userId, role: req.user.role, query });

      const result = await orderService.getOrders(req.user.userId, query, req.user.role);

      logger.info('getOrders result', { total: result.total, ordersCount: result.orders?.length });

      successResponse(res, result);
    } catch (error: any) {
      logger.error('getOrders error', { 
        message: error.message, 
        name: error.name, 
        stack: error.stack,
        sql: error.sql,
        original: error.original,
      });
      next(error);
    }
  },

  /**
   * 获取订单详情
   */
  async getOrderById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        throw new ValidationError('无效的订单ID');
      }

      const order = await orderService.getOrderById(orderId, req.user.userId, req.user.role);

      successResponse(res, order);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 模拟支付订单
   */
  async payOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        throw new ValidationError('无效的订单ID');
      }

      const result = await orderService.payOrder(orderId, req.user.userId, req.body?.shipping_address);

      logger.info(`Order paid by user ${req.user.userId}: ${orderId}`);

      successResponse(res, result, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 取消订单
   */
  async cancelOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        throw new ValidationError('无效的订单ID');
      }

      const result = await orderService.cancelOrder(orderId, req.user.userId);

      logger.info(`Order cancelled by user ${req.user.userId}: ${orderId}`);

      successResponse(res, result, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 获取用户订单列表
   */
  async getUserOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const query: OrderQueryDto = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        status: req.query.status as any,
      };

      const result = await orderService.getUserOrders(req.user.userId, query);

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 获取商家订单列表
   */
  async getMerchantOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const query: OrderQueryDto = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        status: req.query.status as any,
      };

      const result = await orderService.getMerchantOrders(req.user.userId, query);

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 获取订单统计
   */
  async getOrderStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const stats = await orderService.getOrderStats(req.user.userId, req.user.role);

      successResponse(res, stats);
    } catch (error) {
      next(error);
    }
  },

  async shipOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以发货');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        throw new ValidationError('无效的订单ID');
      }

      const shipData: ShipOrderDto = {
        tracking_number: req.body.tracking_number,
        shipping_company: req.body.shipping_company,
        remark: req.body.remark,
      };

      const result = await orderService.shipOrder(orderId, req.user.userId, shipData);

      logger.info(`Order shipped by merchant ${req.user.userId}: ${orderId}`);

      successResponse(res, result, '发货成功');
    } catch (error) {
      next(error);
    }
  },

  async handleRefund(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以处理退款');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        throw new ValidationError('无效的订单ID');
      }

      const refundData: RefundActionDto = {
        action: req.body.action,
        reason: req.body.reason,
      };

      const result = await orderService.handleRefund(orderId, req.user.userId, refundData);

      logger.info(`Refund ${refundData.action} by merchant ${req.user.userId}: ${orderId}`);

      successResponse(res, result, refundData.action === 'approve' ? '退款已同意' : '退款已拒绝');
    } catch (error) {
      next(error);
    }
  },

  async updateRemark(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以修改备注');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        throw new ValidationError('无效的订单ID');
      }

      const remarkData: UpdateRemarkDto = {
        remark: req.body.remark,
        merchant_remark: req.body.merchant_remark,
      };

      const result = await orderService.updateRemark(orderId, req.user.userId, remarkData);

      successResponse(res, result, '备注已更新');
    } catch (error) {
      next(error);
    }
  },

  async updateAddress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以修改地址');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        throw new ValidationError('无效的订单ID');
      }

      const addressData: UpdateAddressDto = {
        shipping_address: req.body.shipping_address,
      };

      const result = await orderService.updateAddress(orderId, req.user.userId, addressData);

      successResponse(res, result, '地址已更新');
    } catch (error) {
      next(error);
    }
  },
};

export default orderController;