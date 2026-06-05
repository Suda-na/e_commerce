import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { shippingTemplateService } from '../services/shipping-template.service';
import {
  CreateShippingTemplateDto,
  UpdateShippingTemplateDto,
  ShippingTemplateQueryDto,
  CalculateShippingFeeDto,
} from '../dto/shipping-template.dto';
import { AuthorizationError, ValidationError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { successResponse, successResponseWithPagination, createdResponse, noDataResponse } from '../utils/response';

export class ShippingTemplateController {
  async createTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以创建运费模板');
      }

      const templateData: CreateShippingTemplateDto = {
        name: req.body.name,
        rules: req.body.rules,
      };

      const template = await shippingTemplateService.createTemplate(req.user.userId, templateData);

      logger.info(`Shipping template created via API: ${template.id}`);

      createdResponse(res, template, '运费模板创建成功');
    } catch (error) {
      next(error);
    }
  }

  async getTemplates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以查看运费模板');
      }

      const query: ShippingTemplateQueryDto = {
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      };

      const result = await shippingTemplateService.getTemplates(req.user.userId, query);

      successResponseWithPagination(res, result.templates, result.page, result.limit, result.total, result.totalPages);
    } catch (error) {
      next(error);
    }
  }

  async getTemplateById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以查看运费模板');
      }

      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        throw new ValidationError('无效的模板ID');
      }

      const template = await shippingTemplateService.getTemplateById(templateId, req.user.userId);

      successResponse(res, template);
    } catch (error) {
      next(error);
    }
  }

  async updateTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以更新运费模板');
      }

      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        throw new ValidationError('无效的模板ID');
      }

      const updateData: UpdateShippingTemplateDto = {
        name: req.body.name,
        rules: req.body.rules,
      };

      const template = await shippingTemplateService.updateTemplate(templateId, req.user.userId, updateData);

      logger.info(`Shipping template updated via API: ${templateId}`);

      successResponse(res, template, '运费模板更新成功');
    } catch (error) {
      next(error);
    }
  }

  async deleteTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以删除运费模板');
      }

      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        throw new ValidationError('无效的模板ID');
      }

      await shippingTemplateService.deleteTemplate(templateId, req.user.userId);

      logger.info(`Shipping template deleted via API: ${templateId}`);

      noDataResponse(res, '运费模板删除成功');
    } catch (error) {
      next(error);
    }
  }

  async calculateShippingFee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const data: CalculateShippingFeeDto = {
        template_id: req.body.template_id,
        region: req.body.region,
        quantity: req.body.quantity,
        total_amount: req.body.total_amount,
        weight: req.body.weight,
      };

      const result = await shippingTemplateService.calculateShippingFee(data);

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const shippingTemplateController = new ShippingTemplateController();
