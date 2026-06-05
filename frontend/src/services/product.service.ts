import api from './api';
import { Product, CreateProductRequest, UpdateProductRequest, ApiResponse, PaginatedResponse } from '../types';

class ProductService {
  private toCamelCase(product: any): Product {
    return {
      id: product.id,
      merchantId: product.merchant_id,
      name: product.name,
      description: product.description,
      images: product.images || [],
      startingPrice: product.starting_price,
      priceIncrement: product.price_increment,
      duration: product.duration,
      capPrice: product.cap_price,
      delayTime: product.delay_time,
      status: product.status,
      categoryId: product.category_id,
      tags: product.tags || [],
      stock: product.stock ?? 1,
      stockWarning: product.stock_warning ?? 5,
      sku: product.sku,
      weight: product.weight ? parseFloat(product.weight) : undefined,
      specifications: product.specifications || undefined,
      category: product.category ? {
        id: product.category.id,
        name: product.category.name,
        icon: product.category.icon,
      } : undefined,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    };
  }

  async getProducts(params?: { page?: number; pageSize?: number; status?: string; search?: string; categoryId?: number; tag?: string }): Promise<PaginatedResponse<Product>> {
    const response = await api.get<any>('/products/merchant', {
      params: {
        page: params?.page,
        limit: params?.pageSize,
        pageSize: undefined,
        status: params?.status,
        search: params?.search,
        category_id: params?.categoryId,
        tag: params?.tag,
      },
    });
    const { data, meta } = response.data;
    return {
      items: (data || []).map((p: any) => this.toCamelCase(p)),
      total: meta?.total || 0,
      page: meta?.page || 1,
      pageSize: meta?.limit || 10,
      totalPages: meta?.totalPages || 0,
    };
  }

  async getMerchantProducts(params?: { page?: number; pageSize?: number; status?: string; search?: string; categoryId?: number; tag?: string }): Promise<PaginatedResponse<Product>> {
    const response = await api.get<any>('/products/merchant', {
      params: {
        page: params?.page,
        limit: params?.pageSize,
        pageSize: undefined,
        status: params?.status,
        search: params?.search,
        category_id: params?.categoryId,
        tag: params?.tag,
      },
    });
    const { data, meta } = response.data;
    return {
      items: (data || []).map((p: any) => this.toCamelCase(p)),
      total: meta?.total || 0,
      page: meta?.page || 1,
      pageSize: meta?.limit || 10,
      totalPages: meta?.totalPages || 0,
    };
  }

  async getProduct(id: number): Promise<Product> {
    const response = await api.get<ApiResponse<any>>(`/products/${id}`);
    return this.toCamelCase(response.data.data!);
  }

  async createProduct(data: CreateProductRequest): Promise<Product> {
    const payload = {
      name: data.name,
      description: data.description,
      images: data.images,
      starting_price: data.startingPrice,
      price_increment: data.priceIncrement,
      duration: data.duration,
      cap_price: data.capPrice,
      delay_time: data.delayTime,
      category_id: data.categoryId,
      tags: data.tags,
      stock: data.stock,
      stock_warning: data.stockWarning,
      sku: data.sku,
      weight: data.weight,
      specifications: data.specifications,
    };
    const response = await api.post<ApiResponse<any>>('/products', payload);
    return this.toCamelCase(response.data.data!);
  }

  async updateProduct(id: number, data: UpdateProductRequest): Promise<Product> {
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.images !== undefined) payload.images = data.images;
    if (data.startingPrice !== undefined) payload.starting_price = data.startingPrice;
    if (data.priceIncrement !== undefined) payload.price_increment = data.priceIncrement;
    if (data.duration !== undefined) payload.duration = data.duration;
    if (data.capPrice !== undefined) payload.cap_price = data.capPrice;
    if (data.delayTime !== undefined) payload.delay_time = data.delayTime;
    if (data.categoryId !== undefined) payload.category_id = data.categoryId;
    if (data.tags !== undefined) payload.tags = data.tags;
    if (data.stock !== undefined) payload.stock = data.stock;
    if (data.stockWarning !== undefined) payload.stock_warning = data.stockWarning;
    if (data.sku !== undefined) payload.sku = data.sku;
    if (data.weight !== undefined) payload.weight = data.weight;
    if (data.specifications !== undefined) payload.specifications = data.specifications;
    const response = await api.put<ApiResponse<any>>(`/products/${id}`, payload);
    return this.toCamelCase(response.data.data!);
  }

  async deleteProduct(id: number): Promise<void> {
    await api.delete(`/products/${id}`);
  }

  async updateProductStatus(id: number, status: string): Promise<Product> {
    const response = await api.patch<ApiResponse<any>>(`/products/${id}/status`, { status });
    return this.toCamelCase(response.data.data!);
  }
}

export const productService = new ProductService();
