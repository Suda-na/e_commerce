import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { categoryService } from '../services/category.service';
import { AuthRequest } from '../types';
import { AuthorizationError, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { successResponse, createdResponse, noDataResponse } from '../utils/response';

export class CategoryController {
  /**
   * 创建分类（商家专属，自动关联当前商家）
   */
  async createCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以创建分类');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const category = await categoryService.createCategory(req.user.userId, {
        name: req.body.name,
        icon: req.body.icon,
        sort_order: req.body.sort_order,
      });

      createdResponse(res, category, '分类创建成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取商家的分类列表（必须认证，按商家隔离）
   */
  async getCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以查看分类');
      }

      const categories = await categoryService.getCategoriesByMerchant(req.user.userId);

      successResponse(res, categories);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取分类详情（按商家隔离）
   */
  async getCategoryById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以查看分类');
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new ValidationError('无效的分类ID');
      }

      const category = await categoryService.getCategoryById(id, req.user.userId);

      successResponse(res, category);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新分类（按商家隔离）
   */
  async updateCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以更新分类');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new ValidationError('无效的分类ID');
      }

      const category = await categoryService.updateCategory(id, req.user.userId, {
        name: req.body.name,
        icon: req.body.icon,
        sort_order: req.body.sort_order,
      });

      successResponse(res, category, '分类更新成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除分类（按商家隔离）
   */
  async deleteCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以删除分类');
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new ValidationError('无效的分类ID');
      }

      await categoryService.deleteCategory(id, req.user.userId);

      noDataResponse(res, '分类删除成功');
    } catch (error) {
      next(error);
    }
  }
}

export const categoryController = new CategoryController();
