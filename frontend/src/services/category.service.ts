import api from './api';
import { Category, CreateCategoryRequest, UpdateCategoryRequest, ApiResponse } from '../types';

class CategoryService {
  private toCamelCase(category: any): Category {
    return {
      id: category.id,
      name: category.name,
      icon: category.icon,
      sortOrder: category.sort_order,
      productCount: category.product_count,
      createdAt: category.created_at,
      updatedAt: category.updated_at,
    };
  }

  async getCategories(): Promise<Category[]> {
    const response = await api.get<ApiResponse<any[]>>('/categories');
    return (response.data.data || []).map((c) => this.toCamelCase(c));
  }

  async getCategory(id: number): Promise<Category> {
    const response = await api.get<ApiResponse<any>>(`/categories/${id}`);
    return this.toCamelCase(response.data.data!);
  }

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    const payload = {
      name: data.name,
      icon: data.icon,
      sort_order: data.sortOrder,
    };
    const response = await api.post<ApiResponse<any>>('/categories', payload);
    return this.toCamelCase(response.data.data!);
  }

  async updateCategory(id: number, data: UpdateCategoryRequest): Promise<Category> {
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.icon !== undefined) payload.icon = data.icon;
    if (data.sortOrder !== undefined) payload.sort_order = data.sortOrder;
    const response = await api.put<ApiResponse<any>>(`/categories/${id}`, payload);
    return this.toCamelCase(response.data.data!);
  }

  async deleteCategory(id: number): Promise<void> {
    await api.delete(`/categories/${id}`);
  }
}

export const categoryService = new CategoryService();
