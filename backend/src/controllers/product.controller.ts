import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { productService } from '../services/product.service';
import { 
  CreateProductDto, 
  UpdateProductDto, 
  UpdateProductStatusDto,
  ProductQueryDto 
} from '../dto/product.dto';
import { AuthenticationError, AuthorizationError, ValidationError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { successResponse, successResponseWithPagination, createdResponse, noDataResponse } from '../utils/response';

export class ProductController {
  /**
   * 创建商品
   */
  async createProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以创建商品');
      }

      const productData: CreateProductDto = {
        name: req.body.name,
        description: req.body.description,
        images: req.body.images,
        starting_price: req.body.starting_price,
        price_increment: req.body.price_increment,
        duration: req.body.duration,
        cap_price: req.body.cap_price,
        delay_time: req.body.delay_time,
        category_id: req.body.category_id,
        tags: req.body.tags,
        shipping_template_id: req.body.shipping_template_id,
      };

      const product = await productService.createProduct(req.user.userId, productData);

      logger.info(`Product created via API: ${product.id}`);

      createdResponse(res, product, '商品创建成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取商品列表
   */
  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query: ProductQueryDto = {
        search: req.query.search as string,
        status: req.query.status as any,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sort: req.query.sort as string,
        order: req.query.order as 'ASC' | 'DESC',
        category_id: req.query.category_id ? parseInt(req.query.category_id as string) : undefined,
        tag: req.query.tag as string,
      };

      const result = await productService.getProducts(query);

      successResponseWithPagination(res, result.products, result.page, result.limit, result.total, result.totalPages);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取商品详情
   */
  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        throw new ValidationError('无效的商品ID');
      }

      const product = await productService.getProductById(productId);

      successResponse(res, product);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新商品
   */
  async updateProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以更新商品');
      }

      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        throw new ValidationError('无效的商品ID');
      }

      const updateData: UpdateProductDto = {
        name: req.body.name,
        description: req.body.description,
        images: req.body.images,
        starting_price: req.body.starting_price,
        price_increment: req.body.price_increment,
        duration: req.body.duration,
        cap_price: req.body.cap_price,
        delay_time: req.body.delay_time,
        category_id: req.body.category_id,
        tags: req.body.tags,
        shipping_template_id: req.body.shipping_template_id,
      };

      const product = await productService.updateProduct(productId, req.user.userId, updateData);

      logger.info(`Product updated via API: ${productId}`);

      successResponse(res, product, '商品更新成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除商品
   */
  async deleteProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以删除商品');
      }

      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        throw new ValidationError('无效的商品ID');
      }

      await productService.deleteProduct(productId, req.user.userId);

      logger.info(`Product deleted via API: ${productId}`);

      noDataResponse(res, '商品删除成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新商品状态
   */
  async updateProductStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以更新商品状态');
      }

      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        throw new ValidationError('无效的商品ID');
      }

      const statusData: UpdateProductStatusDto = {
        status: req.body.status,
      };

      const product = await productService.updateProductStatus(productId, req.user.userId, statusData);

      logger.info(`Product status updated via API: ${productId} to ${statusData.status}`);

      successResponse(res, product, '商品状态更新成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取商家的商品列表
   */
  async getMerchantProducts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以查看自己的商品');
      }

      const query: ProductQueryDto = {
        search: req.query.search as string,
        status: req.query.status as any,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sort: req.query.sort as string,
        order: req.query.order as 'ASC' | 'DESC',
        category_id: req.query.category_id ? parseInt(req.query.category_id as string) : undefined,
        tag: req.query.tag as string,
      };

      const result = await productService.getMerchantProducts(req.user.userId, query);

      successResponseWithPagination(res, result.products, result.page, result.limit, result.total, result.totalPages);
    } catch (error) {
      next(error);
    }
  }
}

export const productController = new ProductController();