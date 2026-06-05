import api from './api';
import { Order, ApiResponse, PaginatedResponse } from '../types';

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  totalAmount: number;
  averageAmount: number;
}

class OrderService {
  private toCamelCase(order: any): Order {
    return {
      id: order.id,
      auctionId: order.auction_id,
      auction: order.auction,
      userId: order.user_id,
      merchantId: order.merchant_id,
      user: order.user ? {
        ...order.user,
        receiverName: order.user.receiver_name || undefined,
        receiverPhone: order.user.receiver_phone || undefined,
        province: order.user.province || undefined,
        city: order.user.city || undefined,
        district: order.user.district || undefined,
        detailAddress: order.user.detail_address || undefined,
      } : undefined,
      amount: order.amount,
      status: order.status,
      trackingNumber: order.tracking_number || undefined,
      shippingCompany: order.shipping_company || undefined,
      shippingAddress: order.shipping_address || undefined,
      receiverName: order.receiver_name || undefined,
      receiverPhone: order.receiver_phone || undefined,
      remark: order.remark || undefined,
      merchantRemark: order.merchant_remark || undefined,
      refundReason: order.refund_reason || undefined,
      refundRejectedReason: order.refund_rejected_reason || undefined,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }

  async getOrders(params?: { page?: number; pageSize?: number; status?: string }): Promise<PaginatedResponse<Order>> {
    const response = await api.get<any>('/orders', {
      params: { ...params, limit: params?.pageSize, pageSize: undefined },
    });
    const result = response.data.data;
    return {
      items: (result?.orders || []).map((o: any) => this.toCamelCase(o)),
      total: result?.total ?? 0,
      page: result?.page ?? 1,
      pageSize: result?.limit ?? 10,
      totalPages: result?.totalPages ?? 1,
    };
  }

  async getMerchantOrders(params?: { page?: number; pageSize?: number; status?: string }): Promise<PaginatedResponse<Order>> {
    const response = await api.get<any>('/orders/merchant', {
      params: { ...params, limit: params?.pageSize, pageSize: undefined },
    });
    const result = response.data.data;
    return {
      items: (result?.orders || []).map((o: any) => this.toCamelCase(o)),
      total: result?.total ?? 0,
      page: result?.page ?? 1,
      pageSize: result?.limit ?? 10,
      totalPages: result?.totalPages ?? 1,
    };
  }

  async getOrderStats(): Promise<OrderStats> {
    const response = await api.get<ApiResponse<OrderStats>>('/orders/stats');
    return response.data.data!;
  }

  async getOrder(id: number): Promise<Order> {
    const response = await api.get<ApiResponse<any>>(`/orders/${id}`);
    return this.toCamelCase(response.data.data!);
  }

  async payOrder(id: number): Promise<Order> {
    const response = await api.post<ApiResponse<any>>(`/orders/${id}/pay`);
    return this.toCamelCase(response.data.data!);
  }

  async cancelOrder(id: number): Promise<Order> {
    const response = await api.post<ApiResponse<any>>(`/orders/${id}/cancel`);
    return this.toCamelCase(response.data.data!);
  }

  async shipOrder(id: number, data: { trackingNumber: string; shippingCompany: string; remark?: string }): Promise<Order> {
    const response = await api.post<ApiResponse<any>>(`/orders/${id}/ship`, {
      tracking_number: data.trackingNumber,
      shipping_company: data.shippingCompany,
      remark: data.remark,
    });
    return this.toCamelCase(response.data.data!);
  }

  async handleRefund(id: number, action: 'approve' | 'reject', reason?: string): Promise<Order> {
    const response = await api.post<ApiResponse<any>>(`/orders/${id}/refund`, {
      action,
      reason,
    });
    return this.toCamelCase(response.data.data!);
  }

  async updateRemark(id: number, data: { remark?: string; merchantRemark?: string }): Promise<Order> {
    const response = await api.put<ApiResponse<any>>(`/orders/${id}/remark`, {
      remark: data.remark,
      merchant_remark: data.merchantRemark,
    });
    return this.toCamelCase(response.data.data!);
  }

  async updateAddress(id: number, shippingAddress: string): Promise<Order> {
    const response = await api.put<ApiResponse<any>>(`/orders/${id}/address`, {
      shipping_address: shippingAddress,
    });
    return this.toCamelCase(response.data.data!);
  }
}

export const orderService = new OrderService();
