import { Product } from '../models/Product';
import { Auction } from '../models/Auction';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { ShippingTemplate } from '../models/ShippingTemplate';
import models from '../models';
import { 
  CreateProductDto, 
  UpdateProductDto, 
  UpdateProductStatusDto,
  ProductQueryDto,
  ProductResponseDto,
  canEditOrDelete,
  isValidStatusTransition 
} from '../dto/product.dto';
import { AuthenticationError, AuthorizationError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { cacheManager } from '../utils/cache-manager';
import { Op } from 'sequelize';

export class ProductService {
  /**
   * 创建商品
   */
  async createProduct(merchantId: number, data: CreateProductDto): Promise<ProductResponseDto> {
    try {
      // 验证商家是否存在
      const merchant = await User.findByPk(merchantId, {
        attributes: ['id', 'role'],
      });
      if (!merchant || merchant.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以创建商品');
      }

      // 验证封顶价（如果提供）
      if (data.cap_price && data.cap_price <= data.starting_price) {
        throw new ValidationError('封顶价必须大于起拍价');
      }

      // 创建商品
      const product = await Product.create({
        merchant_id: merchantId,
        name: data.name,
        description: data.description,
        images: data.images || [],
        starting_price: data.starting_price,
        price_increment: data.price_increment,
        duration: data.duration,
        cap_price: data.cap_price,
        delay_time: data.delay_time || 10,
        status: 'pending',
        category_id: data.category_id,
        tags: data.tags || [],
        stock: data.stock ?? 1,
        stock_warning: data.stock_warning ?? 5,
        sku: data.sku,
        weight: data.weight,
        shipping_template_id: data.shipping_template_id,
        specifications: data.specifications || {},
      });

      logger.info(`Product created: ${product.id} by merchant ${merchantId}`);

      await cacheManager.invalidateByTag(`merchant:${merchantId}:products`);
      await cacheManager.delPattern('productList:*');

      return this.formatProductResponse(product);
    } catch (error) {
      logger.error('Create product failed:', error);
      throw error;
    }
  }

  /**
   * 获取商品列表（支持分页、筛选、排序）
   */
  async getProducts(query: ProductQueryDto, userId?: number): Promise<{
    products: ProductResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      // 构建查询条件
      const where: any = {};

      // 状态筛选
      if (query.status) {
        where.status = query.status;
      }

      if (query.category_id) {
        where.category_id = query.category_id;
      }

      if (query.tag) {
        where.tags = { [Op.contains]: [query.tag] };
      }

      // 搜索条件
      if (query.search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${query.search}%` } },
          { description: { [Op.like]: `%${query.search}%` } },
        ];
      }

      // 排序
      const order: any[] = [];
      if (query.sort) {
        order.push([query.sort, query.order || 'DESC']);
      } else {
        order.push(['created_at', 'DESC']);
      }

      // 查询商品（列表查询不关联竞拍，避免1:N关系导致重复行）
      const cacheKey = `products:${JSON.stringify(query)}`;
      const cached = await cacheManager.get<{
        products: ProductResponseDto[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`productList:${cacheKey}`);
      if (cached) {
        return cached;
      }

      const { count, rows: products } = await Product.findAndCountAll({
        where,
        attributes: ['id', 'merchant_id', 'name', 'description', 'images', 'starting_price', 'price_increment', 'duration', 'cap_price', 'delay_time', 'status', 'stock', 'stock_warning', 'category_id', 'tags', 'sku', 'weight', 'shipping_template_id', 'created_at', 'updated_at'],
        include: [
          {
            model: User,
            as: 'merchant',
            attributes: ['id', 'username', 'avatar'],
          },
          {
            model: models.Category,
            as: 'category',
            attributes: ['id', 'name', 'icon'],
            required: false,
          },
        ],
        order,
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      const result = {
        products: products.map(product => this.formatProductResponse(product)),
        total: count,
        page,
        limit,
        totalPages,
      };

      await cacheManager.set(`productList:${cacheKey}`, result, { strategy: 'productList' });

      return result;
    } catch (error) {
      logger.error('Get products failed:', error);
      throw error;
    }
  }

  /**
   * 获取商品详情
   */
  async getProductById(productId: number): Promise<ProductResponseDto> {
    try {
      return await cacheManager.getOrSet<ProductResponseDto>(
        `product:${productId}`,
        async () => {
          const product = await Product.findByPk(productId, {
            include: [
              {
                model: User,
                as: 'merchant',
                attributes: ['id', 'username', 'avatar'],
              },
              {
                model: Category,
                as: 'category',
                attributes: ['id', 'name', 'icon'],
                required: false,
              },
              {
                model: Auction,
                as: 'auction',
                attributes: ['id', 'status', 'current_price', 'end_time', 'winner_id'],
                required: false,
                order: [['created_at', 'DESC']],
              },
              {
                model: ShippingTemplate,
                as: 'shipping_template',
                attributes: ['id', 'name'],
                required: false,
              },
            ],
          });

          if (!product) {
            throw new NotFoundError('商品不存在');
          }

          return this.formatProductResponse(product);
        },
        { strategy: 'product' }
      );
    } catch (error) {
      logger.error('Get product failed:', error);
      throw error;
    }
  }

  /**
   * 更新商品
   */
  async updateProduct(
    productId: number,
    merchantId: number,
    data: UpdateProductDto
  ): Promise<ProductResponseDto> {
    try {
      const product = await Product.findByPk(productId);

      if (!product) {
        throw new NotFoundError('商品不存在');
      }

      // 验证商品所有权
      if (product.merchant_id !== merchantId) {
        throw new AuthorizationError('只能操作自己创建的商品');
      }

      // 检查商品是否可编辑
      if (!canEditOrDelete(product.status)) {
        throw new ValidationError('已开始竞拍的商品不可编辑');
      }

      // 验证封顶价（如果更新）
      const startingPrice = data.starting_price || product.starting_price;
      const capPrice = data.cap_price !== undefined ? data.cap_price : product.cap_price;
      
      if (capPrice && capPrice <= startingPrice) {
        throw new ValidationError('封顶价必须大于起拍价');
      }

      await product.update(data);

      await cacheManager.del(`product:${productId}`);
      await cacheManager.invalidateByTag(`product:${productId}`);
      await cacheManager.invalidateByTag(`merchant:${merchantId}:products`);
      await cacheManager.delPattern('productList:*');

      logger.info(`Product updated: ${productId} by merchant ${merchantId}`);

      return this.formatProductResponse(product);
    } catch (error) {
      logger.error('Update product failed:', error);
      throw error;
    }
  }

  /**
   * 删除商品
   */
  async deleteProduct(productId: number, merchantId: number): Promise<void> {
    try {
      const product = await Product.findByPk(productId, {
        attributes: ['id', 'merchant_id', 'status'],
      });

      if (!product) {
        throw new NotFoundError('商品不存在');
      }

      if (product.merchant_id !== merchantId) {
        throw new AuthorizationError('只能操作自己创建的商品');
      }

      if (!canEditOrDelete(product.status)) {
        throw new ValidationError('已开始竞拍的商品不可删除');
      }

      await product.destroy();

      await cacheManager.del(`product:${productId}`);
      await cacheManager.invalidateByTag(`product:${productId}`);
      await cacheManager.invalidateByTag(`merchant:${merchantId}:products`);
      await cacheManager.delPattern('productList:*');

      logger.info(`Product deleted: ${productId} by merchant ${merchantId}`);
    } catch (error) {
      logger.error('Delete product failed:', error);
      throw error;
    }
  }

  /**
   * 更新商品状态
   */
  async updateProductStatus(
    productId: number,
    merchantId: number,
    data: UpdateProductStatusDto
  ): Promise<ProductResponseDto> {
    try {
      const product = await Product.findByPk(productId, {
        attributes: ['id', 'merchant_id', 'status'],
      });

      if (!product) {
        throw new NotFoundError('商品不存在');
      }

      if (product.merchant_id !== merchantId) {
        throw new AuthorizationError('只能操作自己创建的商品');
      }

      if (!isValidStatusTransition(product.status, data.status)) {
        throw new ValidationError(`不能从 ${product.status} 转换为 ${data.status}`);
      }

      await product.update({ status: data.status });

      await cacheManager.del(`product:${productId}`);
      await cacheManager.invalidateByTag(`product:${productId}`);
      await cacheManager.delPattern('productList:*');

      logger.info(`Product status updated: ${productId} from ${product.status} to ${data.status}`);

      return this.formatProductResponse(product);
    } catch (error) {
      logger.error('Update product status failed:', error);
      throw error;
    }
  }

  /**
   * 获取商家的商品列表
   */
  async getMerchantProducts(
    merchantId: number,
    query: ProductQueryDto
  ): Promise<{
    products: ProductResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      // 验证商家是否存在
      const merchant = await User.findByPk(merchantId, {
        attributes: ['id', 'role'],
      });
      if (!merchant || merchant.role !== 'merchant') {
        throw new AuthorizationError('商家不存在');
      }

      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      // 构建查询条件
      const where: any = { merchant_id: merchantId };

      // 状态筛选
      if (query.status) {
        where.status = query.status;
      }

      if (query.category_id) {
        where.category_id = query.category_id;
      }

      if (query.tag) {
        where.tags = { [Op.contains]: [query.tag] };
      }

      // 搜索条件
      if (query.search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${query.search}%` } },
          { description: { [Op.like]: `%${query.search}%` } },
        ];
      }

      // 排序
      const order: any[] = [];
      if (query.sort) {
        order.push([query.sort, query.order || 'DESC']);
      } else {
        order.push(['created_at', 'DESC']);
      }

      // 查询商品（列表查询不关联竞拍，避免1:N关系导致重复行）
      const { count, rows: products } = await Product.findAndCountAll({
        where,
        attributes: ['id', 'merchant_id', 'name', 'description', 'images', 'starting_price', 'price_increment', 'duration', 'cap_price', 'delay_time', 'status', 'stock', 'stock_warning', 'category_id', 'tags', 'sku', 'weight', 'shipping_template_id', 'created_at', 'updated_at'],
        include: [
          {
            model: models.Category,
            as: 'category',
            attributes: ['id', 'name', 'icon'],
            required: false,
          },
        ],
        order,
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      return {
        products: products.map(product => this.formatProductResponse(product)),
        total: count,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Get merchant products failed:', error);
      throw error;
    }
  }

  /**
   * 格式化商品响应
   */
  private formatProductResponse(product: any): ProductResponseDto {
    const response: ProductResponseDto = {
      id: product.id,
      merchant_id: product.merchant_id,
      name: product.name,
      description: product.description,
      images: product.images || [],
      starting_price: parseFloat(product.starting_price),
      price_increment: parseFloat(product.price_increment),
      duration: product.duration,
      cap_price: product.cap_price ? parseFloat(product.cap_price) : undefined,
      delay_time: product.delay_time,
      status: product.status,
      stock: product.stock ?? 1,
      stock_warning: product.stock_warning ?? 5,
      sku: product.sku,
      weight: product.weight ? parseFloat(product.weight) : undefined,
      shipping_template_id: product.shipping_template_id,
      specifications: product.specifications || {},
      created_at: product.created_at,
      updated_at: product.updated_at,
    };

    response.category_id = product.category_id;
    response.tags = product.tags || [];

    if (product.category) {
      response.category = {
        id: product.category.id,
        name: product.category.name,
        icon: product.category.icon,
      };
    }

    // 添加商家信息
    if (product.merchant) {
      response.merchant = {
        id: product.merchant.id,
        username: product.merchant.username,
        avatar: product.merchant.avatar,
      };
    }

    // 添加竞拍信息
    if (product.auction) {
      response.auction = {
        id: product.auction.id,
        status: product.auction.status,
        current_price: product.auction.current_price ? parseFloat(product.auction.current_price) : undefined,
        end_time: product.auction.end_time,
      };
    }

    if (product.shipping_template) {
      response.shipping_template = {
        id: product.shipping_template.id,
        name: product.shipping_template.name,
      };
    }

    return response;
  }
}

export const productService = new ProductService();