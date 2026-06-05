import { ShippingTemplate } from '../models/ShippingTemplate';
import { ShippingRule } from '../models/ShippingRule';
import { User } from '../models/User';
import {
  CreateShippingTemplateDto,
  UpdateShippingTemplateDto,
  ShippingTemplateQueryDto,
  CalculateShippingFeeDto,
  ShippingTemplateResponseDto,
  ShippingRuleResponseDto,
} from '../dto/shipping-template.dto';
import { AuthorizationError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';
import { IShippingFeeResult } from '../types';

export class ShippingTemplateService {
  async createTemplate(merchantId: number, data: CreateShippingTemplateDto): Promise<ShippingTemplateResponseDto> {
    try {
      const merchant = await User.findByPk(merchantId);
      if (!merchant || merchant.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以创建运费模板');
      }

      if (!data.rules || data.rules.length === 0) {
        throw new ValidationError('运费模板至少需要一条配送规则');
      }

      const template = await ShippingTemplate.create({
        merchant_id: merchantId,
        name: data.name,
      });

      const rules = await ShippingRule.bulkCreate(
        data.rules.map((rule) => ({
          template_id: template.id,
          regions: rule.regions,
          first_item_fee: rule.first_item_fee,
          additional_item_fee: rule.additional_item_fee,
          free_threshold: rule.free_threshold ?? null,
        }))
      );

      logger.info(`Shipping template created: ${template.id} by merchant ${merchantId}`);

      return this.formatTemplateResponse(template, rules);
    } catch (error) {
      logger.error('Create shipping template failed:', error);
      throw error;
    }
  }

  async getTemplates(
    merchantId: number,
    query: ShippingTemplateQueryDto
  ): Promise<{
    templates: ShippingTemplateResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      const where: any = { merchant_id: merchantId };

      if (query.search) {
        where.name = { [Op.like]: `%${query.search}%` };
      }

      const { count, rows: templates } = await ShippingTemplate.findAndCountAll({
        where,
        include: [
          {
            model: ShippingRule,
            as: 'rules',
          },
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      return {
        templates: templates.map((t) => this.formatTemplateResponse(t, t.rules || [])),
        total: count,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Get shipping templates failed:', error);
      throw error;
    }
  }

  async getTemplateById(templateId: number, merchantId: number): Promise<ShippingTemplateResponseDto> {
    try {
      const template = await ShippingTemplate.findByPk(templateId, {
        include: [
          {
            model: ShippingRule,
            as: 'rules',
          },
        ],
      });

      if (!template) {
        throw new NotFoundError('运费模板不存在');
      }

      if (template.merchant_id !== merchantId) {
        throw new AuthorizationError('只能查看自己的运费模板');
      }

      return this.formatTemplateResponse(template, template.rules || []);
    } catch (error) {
      logger.error('Get shipping template failed:', error);
      throw error;
    }
  }

  async updateTemplate(
    templateId: number,
    merchantId: number,
    data: UpdateShippingTemplateDto
  ): Promise<ShippingTemplateResponseDto> {
    try {
      const template = await ShippingTemplate.findByPk(templateId, {
        include: [{ model: ShippingRule, as: 'rules' }],
      });

      if (!template) {
        throw new NotFoundError('运费模板不存在');
      }

      if (template.merchant_id !== merchantId) {
        throw new AuthorizationError('只能操作自己的运费模板');
      }

      if (data.name) {
        await template.update({ name: data.name });
      }

      if (data.rules && data.rules.length > 0) {
        await ShippingRule.destroy({ where: { template_id: templateId } });

        const newRules = await ShippingRule.bulkCreate(
          data.rules.map((rule) => ({
            template_id: templateId,
            regions: rule.regions,
            first_item_fee: rule.first_item_fee,
            additional_item_fee: rule.additional_item_fee,
            free_threshold: rule.free_threshold ?? null,
          }))
        );

        logger.info(`Shipping template updated: ${templateId} by merchant ${merchantId}`);
        return this.formatTemplateResponse(template, newRules);
      }

      logger.info(`Shipping template updated: ${templateId} by merchant ${merchantId}`);
      return this.formatTemplateResponse(template, template.rules || []);
    } catch (error) {
      logger.error('Update shipping template failed:', error);
      throw error;
    }
  }

  async deleteTemplate(templateId: number, merchantId: number): Promise<void> {
    try {
      const template = await ShippingTemplate.findByPk(templateId);

      if (!template) {
        throw new NotFoundError('运费模板不存在');
      }

      if (template.merchant_id !== merchantId) {
        throw new AuthorizationError('只能操作自己的运费模板');
      }

      await ShippingRule.destroy({ where: { template_id: templateId } });
      await template.destroy();

      logger.info(`Shipping template deleted: ${templateId} by merchant ${merchantId}`);
    } catch (error) {
      logger.error('Delete shipping template failed:', error);
      throw error;
    }
  }

  async calculateShippingFee(data: CalculateShippingFeeDto): Promise<IShippingFeeResult> {
    try {
      const template = await ShippingTemplate.findByPk(data.template_id, {
        include: [{ model: ShippingRule, as: 'rules' }],
      });

      if (!template) {
        throw new NotFoundError('运费模板不存在');
      }

      const rules = template.rules || [];
      if (rules.length === 0) {
        throw new ValidationError('运费模板没有配送规则');
      }

      let matchedRule: ShippingRule | null = null;

      for (const rule of rules) {
        const regions: string[] = rule.regions || [];
        if (regions.some((r) => data.region.includes(r) || r.includes(data.region))) {
          matchedRule = rule;
          break;
        }
      }

      if (!matchedRule) {
        const defaultRule = rules.find((r) =>
          (r.regions || []).includes('默认') || (r.regions || []).includes('全国')
        );
        if (!defaultRule) {
          throw new ValidationError(`未找到地区「${data.region}」的配送规则`);
        }
        matchedRule = defaultRule;
      }

      const freeThreshold = matchedRule!.free_threshold ? parseFloat(String(matchedRule!.free_threshold)) : null;
      const totalAmount = data.total_amount ?? 0;

      if (freeThreshold !== null && freeThreshold > 0 && totalAmount >= freeThreshold) {
        return {
          fee: 0,
          is_free: true,
          matched_rule: this.formatRuleResponse(matchedRule!),
          template_name: template.name,
        };
      }

      const firstItemFee = parseFloat(String(matchedRule!.first_item_fee));
      const additionalItemFee = parseFloat(String(matchedRule!.additional_item_fee));
      const additionalCount = Math.max(0, data.quantity - 1);
      const fee = firstItemFee + additionalCount * additionalItemFee;

      return {
        fee: Math.round(fee * 100) / 100,
        is_free: false,
        matched_rule: this.formatRuleResponse(matchedRule!),
        template_name: template.name,
      };
    } catch (error) {
      logger.error('Calculate shipping fee failed:', error);
      throw error;
    }
  }

  private formatRuleResponse(rule: any): ShippingRuleResponseDto {
    return {
      id: rule.id,
      template_id: rule.template_id,
      regions: rule.regions || [],
      first_item_fee: parseFloat(rule.first_item_fee),
      additional_item_fee: parseFloat(rule.additional_item_fee),
      free_threshold: rule.free_threshold ? parseFloat(rule.free_threshold) : null,
    };
  }

  private formatTemplateResponse(template: any, rules: any[]): ShippingTemplateResponseDto {
    return {
      id: template.id,
      merchant_id: template.merchant_id,
      name: template.name,
      rules: rules.map((r) => this.formatRuleResponse(r)),
      created_at: template.created_at,
      updated_at: template.updated_at,
    };
  }
}

export const shippingTemplateService = new ShippingTemplateService();
