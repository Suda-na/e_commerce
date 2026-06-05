import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';

export class CategoryService {
  /**
   * 创建分类（自动关联商家）
   */
  async createCategory(merchantId: number, data: { name: string; icon?: string; sort_order?: number }) {
    // 校验同名分类（同一商家下不可重复）
    const existing = await Category.findOne({
      where: { merchant_id: merchantId, name: data.name },
    });
    if (existing) {
      throw new ValidationError('分类名称已存在');
    }

    const category = await Category.create({
      merchant_id: merchantId,
      name: data.name,
      icon: data.icon || null,
      sort_order: data.sort_order || 0,
    });

    logger.info(`Category created: ${category.id} - ${category.name} by merchant ${merchantId}`);
    return this.formatCategoryResponse(category, 0);
  }

  /**
   * 获取商家的分类列表（按商家隔离，仅返回该商家有商品的分类 + 该商家创建的空分类）
   */
  async getCategoriesByMerchant(merchantId: number) {
    // 1. 获取该商家商品关联的不重复分类ID
    const productCategoryIds = await Product.findAll({
      where: { merchant_id: merchantId },
      attributes: ['category_id'],
      group: ['category_id'],
      raw: true,
    });

    const categoryIdsFromProducts = productCategoryIds
      .map((p: any) => p.category_id)
      .filter((id: any) => id !== null);

    // 2. 获取该商家自己创建的分类ID
    const merchantOwnCategories = await Category.findAll({
      where: { merchant_id: merchantId },
      attributes: ['id'],
      raw: true,
    });
    const ownCategoryIds = merchantOwnCategories.map((c: any) => c.id);

    // 3. 合并去重
    const allCategoryIds = [...new Set([...categoryIdsFromProducts, ...ownCategoryIds])];

    if (allCategoryIds.length === 0) {
      return [];
    }

    // 4. 查询分类详情，附带该商家的商品计数
    const categories = await Category.findAll({
      where: {
        id: { [Op.in]: allCategoryIds },
        merchant_id: merchantId,
      },
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']],
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id'],
          where: { merchant_id: merchantId },
          required: false,
        },
      ],
    });

    return categories.map((cat) => this.formatCategoryResponse(cat));
  }

  /**
   * 获取分类详情（按商家隔离）
   */
  async getCategoryById(id: number, merchantId: number) {
    const category = await Category.findOne({
      where: { id, merchant_id: merchantId },
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id'],
          where: { merchant_id: merchantId },
          required: false,
        },
      ],
    });

    if (!category) {
      throw new NotFoundError('分类不存在');
    }

    return this.formatCategoryResponse(category);
  }

  /**
   * 更新分类（按商家隔离）
   */
  async updateCategory(id: number, merchantId: number, data: { name?: string; icon?: string; sort_order?: number }) {
    const category = await Category.findOne({ where: { id, merchant_id: merchantId } });
    if (!category) {
      throw new NotFoundError('分类不存在');
    }

    if (data.name && data.name !== category.name) {
      const existing = await Category.findOne({
        where: { merchant_id: merchantId, name: data.name },
      });
      if (existing) {
        throw new ValidationError('分类名称已存在');
      }
    }

    await category.update(data);
    logger.info(`Category updated: ${id} by merchant ${merchantId}`);
    return this.formatCategoryResponse(category);
  }

  /**
   * 删除分类（按商家隔离）
   */
  async deleteCategory(id: number, merchantId: number) {
    const category = await Category.findOne({ where: { id, merchant_id: merchantId } });
    if (!category) {
      throw new NotFoundError('分类不存在');
    }

    const productCount = await Product.count({
      where: { category_id: id, merchant_id: merchantId },
    });
    if (productCount > 0) {
      throw new ValidationError(`该分类下有 ${productCount} 个商品，无法删除`);
    }

    await category.destroy();
    logger.info(`Category deleted: ${id} by merchant ${merchantId}`);
  }

  private formatCategoryResponse(category: any, productCount?: number) {
    const response: any = {
      id: category.id,
      merchant_id: category.merchant_id,
      name: category.name,
      icon: category.icon,
      sort_order: category.sort_order,
      created_at: category.created_at,
      updated_at: category.updated_at,
    };

    // 优先使用 include 关联的商品计数
    if (category.products) {
      response.product_count = category.products.length;
    } else if (productCount !== undefined) {
      response.product_count = productCount;
    }

    return response;
  }
}

export const categoryService = new CategoryService();
