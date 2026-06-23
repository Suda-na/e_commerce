// order.service.ts
// 订单服务

import { request } from '../utils/request'

interface OrderListParams {
  page?: number
  limit?: number
  status?: string
}

interface CreateOrderParams {
  auctionId: string
  addressId: string
  remark?: string
}

// 数据转换函数：将后端下划线命名转换为前端驼峰命名
function transformOrderData(order: any): any {
  if (!order) return order
  
  const transformed = { ...order }
  
  // 转换顶层字段
  if (order.auction_id !== undefined) {
    transformed.auctionId = order.auction_id
  }
  if (order.user_id !== undefined) {
    transformed.userId = order.user_id
  }
  if (order.shipping_address !== undefined) {
    transformed.shippingAddress = order.shipping_address
  }
  if (order.receiver_name !== undefined) {
    transformed.receiverName = order.receiver_name
  }
  if (order.receiver_phone !== undefined) {
    transformed.receiverPhone = order.receiver_phone
  }
  if (order.created_at !== undefined) {
    transformed.createdAt = order.created_at
  }
  if (order.updated_at !== undefined) {
    transformed.updatedAt = order.updated_at
  }
  
  // 转换auction对象
  if (order.auction) {
    transformed.auction = { ...order.auction }
    if (order.auction.product_id !== undefined) {
      transformed.auction.productId = order.auction.product_id
    }
    if (order.auction.current_price !== undefined) {
      transformed.auction.currentPrice = order.auction.current_price
    }
    if (order.auction.end_time !== undefined) {
      transformed.auction.endTime = order.auction.end_time
    }
    
    // 转换product对象
    if (order.auction.product) {
      transformed.auction.product = { ...order.auction.product }
    }
  }
  
  // 转换user对象
  if (order.user) {
    transformed.user = { ...order.user }
    if (order.user.receiver_name !== undefined) {
      transformed.user.receiverName = order.user.receiver_name
    }
    if (order.user.receiver_phone !== undefined) {
      transformed.user.receiverPhone = order.user.receiver_phone
    }
    if (order.user.detail_address !== undefined) {
      transformed.user.detailAddress = order.user.detail_address
    }
  }
  
  return transformed
}

class OrderService {
  // 获取订单列表
  async getOrderList(params: OrderListParams): Promise<{ list: any[], total: number }> {
    const res = await request.get<any>('/orders', params)
    // 后端返回 { success: true, data: { orders: [...], total: number, page: number, limit: number, totalPages: number }, meta: { ... } }
    const data = res.data?.data || res.data
    // 兼容两种格式：后端返回 orders 或 list
    const rawList = data?.orders || data?.list || []
    const total = data?.total || 0
    
    // 转换数据格式（下划线转驼峰）
    const list = rawList.map((order: any) => transformOrderData(order))
    
    return {
      list,
      total
    }
  }

  // 获取订单详情
  async getOrderDetail(orderId: string): Promise<any> {
    const res = await request.get<any>(`/orders/${orderId}`)
    // 后端返回 { success: true, data: order }
    const data = res.data?.data || res.data
    return transformOrderData(data)
  }

  // 通过竞拍ID查找对应的中标订单
  async getOrderByAuctionId(auctionId: string): Promise<any> {
    const res = await request.get<any>(`/orders/auction/${auctionId}`)
    const data = res.data?.data || res.data
    return transformOrderData(data)
  }

  // 创建订单
  async createOrder(params: CreateOrderParams): Promise<any> {
    const res = await request.post<any>('/orders', params)
    return res.data
  }

  // 支付订单
  async payOrder(orderId: string, shippingAddress?: string): Promise<any> {
    const body: any = {}
    if (shippingAddress) {
      body.shipping_address = shippingAddress
    }
    const res = await request.post<any>(`/orders/${orderId}/pay`, body)
    // 后端返回 { success: true, data: { success, message, order, paymentId, paidAt } }
    const data = res.data?.data || res.data
    if (data?.order) {
      data.order = transformOrderData(data.order)
    }
    return data
  }

  // 取消订单
  async cancelOrder(orderId: string, reason?: string): Promise<any> {
    const res = await request.post<any>(`/orders/${orderId}/cancel`, { reason })
    // 后端返回 { success: true, data: { success, message, order, cancelledAt } }
    const data = res.data?.data || res.data
    if (data?.order) {
      data.order = transformOrderData(data.order)
    }
    return data
  }

  // 确认收货
  async confirmOrder(orderId: string): Promise<any> {
    const res = await request.post<any>(`/orders/${orderId}/confirm`)
    return res.data
  }

  // 删除订单
  async deleteOrder(orderId: string): Promise<any> {
    const res = await request.delete<any>(`/orders/${orderId}`)
    return res.data
  }

  // 获取订单统计
  async getOrderStats(): Promise<any> {
    const res = await request.get<any>('/orders/stats')
    return res.data
  }
}

export const orderService = new OrderService()