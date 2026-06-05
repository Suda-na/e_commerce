import { Order } from '../models/Order';
import { Auction } from '../models/Auction';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { IOrderCreate } from '../types';
import { 
  OrderQueryDto, 
  OrderResponseDto, 
  OrderListResponseDto, 
  OrderPayResultDto, 
  OrderCancelResultDto,
  OrderStatsDto,
  ShipOrderDto,
  RefundActionDto,
  UpdateRemarkDto,
  UpdateAddressDto
} from '../dto/order.dto';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { sequelize } from '../config/database';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { notificationCrudService } from './notification-crud.service';

export class OrderService {
  /**
   * 创建订单（系统自动调用）
   */
  async createOrder(orderData: IOrderCreate): Promise<Order> {
    try {
      const order = await Order.create({
        auction_id: orderData.auction_id,
        user_id: orderData.user_id,
        merchant_id: orderData.merchant_id,
        amount: orderData.amount,
        status: 'pending',
      });

      logger.info(`Order created: ${order.id} for auction ${orderData.auction_id}, user ${orderData.user_id}, merchant ${orderData.merchant_id}`);

      try {
        const buyer = await User.findByPk(orderData.user_id, { attributes: ['id', 'username'] });
        const product = await Product.findOne({
          where: { id: (await Auction.findByPk(orderData.auction_id))?.product_id },
          attributes: ['id', 'name', 'merchant_id'],
        });
        if (product && buyer) {
          await notificationCrudService.notifyNewOrder(
            orderData.merchant_id,
            order.id,
            product.name,
            buyer.username,
            parseFloat(order.amount.toString())
          );
        }
      } catch (notifyErr) {
        logger.warn('Failed to send new order notification:', notifyErr);
      }

      return order;
    } catch (error) {
      logger.error('Create order failed:', error);
      throw error;
    }
  }

  /**
   * 获取订单列表（支持分页、状态过滤）
   */
  async getOrders(userId: number, query: OrderQueryDto, userRole: string): Promise<OrderListResponseDto> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      // 构建查询条件
      const where: any = {};
      
      // 根据用户角色过滤
      if (userRole === 'user') {
        // 普通用户只能查看自己的订单
        where.user_id = userId;
      } else if (userRole === 'merchant') {
        // 商家只能查看自己商品的订单，通过merchant_id直接筛选
        where.merchant_id = userId;
      }

      // 状态过滤
      if (query.status) {
        where.status = query.status;
      }

      // 如果有竞拍ID过滤
      if (query.auctionId) {
        where.auction_id = parseInt(query.auctionId);
      }

      // 构建include条件
      const include: any[] = [
        {
          model: Auction,
          as: 'auction',
          attributes: ['id', 'product_id', 'status', 'current_price', 'end_time'],
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'images'],
            },
          ],
        },
        {
          model: User,
          as: 'user',
          attributes: userRole === 'merchant'
            ? ['id', 'username', 'avatar', 'receiver_name', 'receiver_phone', 'province', 'city', 'district', 'detail_address']
            : ['id', 'username', 'avatar'],
        },
      ];

      const { count, rows: orders } = await Order.findAndCountAll({
        where,
        include,
        order: [['created_at', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      return {
        orders: orders.map(order => this.formatOrderResponse(order)),
        total: count,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Get orders failed:', error);
      throw error;
    }
  }

  /**
   * 获取订单详情
   */
  async getOrderById(orderId: number, userId: number, userRole: string): Promise<OrderResponseDto> {
    try {
      const order = await Order.findByPk(orderId, {
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['id', 'product_id', 'status', 'current_price', 'end_time'],
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'images'],
              },
            ],
          },
          {
            model: User,
            as: 'user',
            attributes: userRole === 'merchant'
              ? ['id', 'username', 'avatar', 'receiver_name', 'receiver_phone', 'province', 'city', 'district', 'detail_address']
              : ['id', 'username', 'avatar'],
          },
        ],
      });

      if (!order) {
        throw new NotFoundError('订单不存在');
      }

      if (userRole === 'user' && order.user_id !== userId) {
        throw new AuthorizationError('只能查看自己的订单');
      }

      if (userRole === 'merchant' && order.merchant_id !== userId) {
        throw new AuthorizationError('只能查看自己商品的订单');
      }

      return this.formatOrderResponse(order);
    } catch (error) {
      logger.error('Get order by id failed:', error);
      throw error;
    }
  }

  /**
   * 模拟支付订单
   */
  async payOrder(orderId: number, userId: number, shippingAddress?: string): Promise<OrderPayResultDto> {
    const transaction = await sequelize.transaction();
    
    try {
      const order = await Order.findByPk(orderId, {
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['id', 'product_id', 'status', 'current_price', 'end_time'],
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'images', 'merchant_id', 'starting_price', 'price_increment'],
              },
            ],
          },
        ],
        transaction,
        lock: true,
      });

      if (!order) {
        throw new NotFoundError('订单不存在');
      }

      if (order.user_id !== userId) {
        throw new AuthorizationError('只能支付自己的订单');
      }

      if (order.status !== 'pending') {
        throw new ValidationError(`订单状态为${order.status}，无法支付`);
      }

      // 获取用户收货地址
      const user = await User.findByPk(userId, {
        attributes: ['id', 'receiver_name', 'receiver_phone', 'province', 'city', 'district', 'detail_address'],
        transaction,
      });

      // 确定收货地址：优先使用前端传递的地址，否则使用用户默认地址
      let finalAddress = shippingAddress || '';
      let finalReceiverName = '';
      let finalReceiverPhone = '';
      if (user) {
        // 始终从用户资料中获取收货人姓名和电话
        finalReceiverName = user.receiver_name || '';
        finalReceiverPhone = user.receiver_phone || '';
        // 如果前端未传地址，使用用户默认地址拼接
        if (!finalAddress) {
          const addressParts = [
            user.province,
            user.city,
            user.district,
            user.detail_address,
          ].filter(Boolean);
          finalAddress = addressParts.join(' ');
        }
      }

      if (!finalAddress) {
        throw new ValidationError('请先设置收货地址后再支付');
      }

      // 模拟支付处理（实际应调用支付接口）
      const paymentId = `PAY_${uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
      const paidAt = new Date();

      // 更新订单状态和收货地址
      await order.update({
        status: 'paid',
        shipping_address: finalAddress,
        receiver_name: finalReceiverName || undefined,
        receiver_phone: finalReceiverPhone || undefined,
      }, { transaction });

      await transaction.commit();

      logger.info(`Order paid: ${orderId}, paymentId: ${paymentId}`);

      try {
        const orderAny = order as any;
        const productName = orderAny.auction?.product?.name || '商品';
        const merchantId = orderAny.auction?.product?.merchant_id;
        if (merchantId) {
          await notificationCrudService.notifyOrderPaid(
            merchantId,
            orderId,
            productName,
            parseFloat(order.amount.toString())
          );
        }
      } catch (notifyErr) {
        logger.warn('Failed to send order paid notification:', notifyErr);
      }

      return {
        success: true,
        message: '支付成功',
        order: this.formatOrderResponse(order),
        paymentId,
        paidAt,
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Pay order failed:', error);
      throw error;
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId: number, userId: number): Promise<OrderCancelResultDto> {
    const transaction = await sequelize.transaction();
    
    try {
      const order = await Order.findByPk(orderId, {
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['id', 'product_id', 'status', 'current_price', 'end_time'],
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'merchant_id'],
              },
            ],
          },
        ],
        transaction,
        lock: true,
      });

      if (!order) {
        throw new NotFoundError('订单不存在');
      }

      if (order.user_id !== userId) {
        throw new AuthorizationError('只能取消自己的订单');
      }

      if (order.status !== 'pending') {
        throw new ValidationError(`订单状态为${order.status}，无法取消`);
      }

      const cancelledAt = new Date();

      // 更新订单状态
      await order.update({
        status: 'cancelled',
      }, { transaction });

      await transaction.commit();

      logger.info(`Order cancelled: ${orderId}`);

      return {
        success: true,
        message: '订单已取消',
        order: this.formatOrderResponse(order),
        cancelledAt,
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Cancel order failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户订单列表
   */
  async getUserOrders(userId: number, query: OrderQueryDto): Promise<OrderListResponseDto> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      const where: any = { user_id: userId };
      if (query.status) {
        where.status = query.status;
      }

      const { count, rows: orders } = await Order.findAndCountAll({
        where,
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['id', 'product_id', 'status', 'current_price', 'end_time'],
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'images'],
              },
            ],
          },
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      return {
        orders: orders.map(order => this.formatOrderResponse(order)),
        total: count,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Get user orders failed:', error);
      throw error;
    }
  }

  /**
   * 获取商家订单列表
   */
  async getMerchantOrders(merchantId: number, query: OrderQueryDto): Promise<OrderListResponseDto> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      // 通过merchant_id直接查询商家订单
      const where: any = { merchant_id: merchantId };
      if (query.status) {
        where.status = query.status;
      }

      const { count, rows: orders } = await Order.findAndCountAll({
        where,
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['id', 'product_id', 'status', 'current_price', 'end_time'],
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'images'],
              },
            ],
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'avatar', 'receiver_name', 'receiver_phone', 'province', 'city', 'district', 'detail_address'],
          },
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      return {
        orders: orders.map(order => this.formatOrderResponse(order)),
        total: count,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Get merchant orders failed:', error);
      throw error;
    }
  }

  /**
   * 获取订单统计
   */
  async getOrderStats(userId: number, userRole: string): Promise<OrderStatsDto> {
    try {
      let where: any = {};
      
      if (userRole === 'user') {
        where.user_id = userId;
      } else if (userRole === 'merchant') {
        // 商家通过merchant_id直接筛选
        where.merchant_id = userId;
      }

      // 统计总收入：只计算已付款和已发货的订单
      const revenueWhere = {
        ...where,
        status: { [Op.in]: ['paid', 'shipped'] },
      };

      const result = await Order.findOne({
        where,
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'],
        ],
        raw: true,
      }) as any;

      const revenueResult = await Order.findOne({
        where: revenueWhere,
        attributes: [
          [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('amount')), 0), 'totalAmount'],
          [sequelize.fn('COALESCE', sequelize.fn('AVG', sequelize.col('amount')), 0), 'averageAmount'],
        ],
        raw: true,
      }) as any;

      const statusCounts = await Order.findAll({
        where,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['status'],
        raw: true,
      }) as any[];

      const statusMap: Record<string, number> = {};
      for (const row of statusCounts) {
        statusMap[row.status] = parseInt(row.count);
      }

      return {
        totalOrders: parseInt(result.totalOrders) || 0,
        pendingOrders: statusMap['pending'] || 0,
        paidOrders: statusMap['paid'] || 0,
        cancelledOrders: statusMap['cancelled'] || 0,
        totalAmount: parseFloat(revenueResult.totalAmount) || 0,
        averageAmount: parseFloat(revenueResult.averageAmount) || 0,
      };
    } catch (error) {
      logger.error('Get order stats failed:', error);
      throw error;
    }
  }

  /**
   * 商家发货
   */
  async shipOrder(orderId: number, merchantId: number, data: ShipOrderDto): Promise<OrderResponseDto> {
    const transaction = await sequelize.transaction();
    try {
      const order = await Order.findByPk(orderId, { transaction, lock: true });

      if (!order) {
        throw new NotFoundError('订单不存在');
      }

      if (order.merchant_id !== merchantId) {
        throw new AuthorizationError('只能发货自己商品的订单');
      }

      if (order.status !== 'paid') {
        throw new ValidationError('只能对已付款订单进行发货操作');
      }

      await order.update({
        status: 'shipped',
        tracking_number: data.tracking_number,
        shipping_company: data.shipping_company,
        remark: data.remark || order.remark,
      }, { transaction });

      await transaction.commit();
      logger.info(`Order shipped: ${orderId}, tracking: ${data.tracking_number}`);

      // 重新查询以获取关联数据
      const refreshedOrder = await Order.findByPk(orderId, {
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['id', 'product_id', 'status', 'current_price', 'end_time'],
            include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'images'] }],
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'avatar'],
          },
        ],
      });

      return this.formatOrderResponse(refreshedOrder || order);
    } catch (error) {
      await transaction.rollback();
      logger.error('Ship order failed:', error);
      throw error;
    }
  }

  /**
   * 退款处理
   */
  async handleRefund(orderId: number, merchantId: number, data: RefundActionDto): Promise<OrderResponseDto> {
    const transaction = await sequelize.transaction();
    try {
      const order = await Order.findByPk(orderId, { transaction, lock: true });

      if (!order) {
        throw new NotFoundError('订单不存在');
      }

      if (order.merchant_id !== merchantId) {
        throw new AuthorizationError('只能处理自己商品的退款');
      }

      if (order.status !== 'refunding') {
        throw new ValidationError('只能处理退款中的订单');
      }

      if (data.action === 'approve') {
        await order.update({ status: 'refunded' }, { transaction });
        logger.info(`Refund approved for order: ${orderId}`);
      } else {
        await order.update({
          status: 'paid',
          refund_rejected_reason: data.reason || '商家拒绝退款',
        }, { transaction });
        logger.info(`Refund rejected for order: ${orderId}`);
      }

      await transaction.commit();

      // 重新查询以获取关联数据
      const refreshedOrder = await Order.findByPk(orderId, {
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['id', 'product_id', 'status', 'current_price', 'end_time'],
            include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'images'] }],
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'avatar'],
          },
        ],
      });

      return this.formatOrderResponse(refreshedOrder || order);
    } catch (error) {
      await transaction.rollback();
      logger.error('Handle refund failed:', error);
      throw error;
    }
  }

  /**
   * 用户申请退款
   */
  async requestRefund(orderId: number, userId: number, reason: string): Promise<OrderResponseDto> {
    const transaction = await sequelize.transaction();
    try {
      const order = await Order.findByPk(orderId, { transaction, lock: true });

      if (!order) {
        throw new NotFoundError('订单不存在');
      }

      if (order.user_id !== userId) {
        throw new AuthorizationError('只能对自己的订单申请退款');
      }

      if (!['paid', 'shipped'].includes(order.status)) {
        throw new ValidationError('只能对已付款或已发货的订单申请退款');
      }

      await order.update({
        status: 'refunding',
        refund_reason: reason,
      }, { transaction });

      await transaction.commit();
      logger.info(`Refund requested for order: ${orderId}, reason: ${reason}`);

      try {
        const auction = await Auction.findByPk(order.auction_id, {
          include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
        });
        const productName = (auction as any)?.product?.name || '商品';
        if (order.merchant_id) {
          await notificationCrudService.notifyRefundRequest(
            order.merchant_id,
            orderId,
            productName,
            reason
          );
        }
      } catch (notifyErr) {
        logger.warn('Failed to send refund request notification:', notifyErr);
      }

      // 重新查询以获取关联数据
      const refreshedOrder = await Order.findByPk(orderId, {
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['id', 'product_id', 'status', 'current_price', 'end_time'],
            include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'images'] }],
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'avatar'],
          },
        ],
      });

      return this.formatOrderResponse(refreshedOrder || order);
    } catch (error) {
      await transaction.rollback();
      logger.error('Request refund failed:', error);
      throw error;
    }
  }

  /**
   * 更新订单备注
   */
  async updateRemark(orderId: number, merchantId: number, data: UpdateRemarkDto): Promise<OrderResponseDto> {
    try {
      const order = await Order.findByPk(orderId);

      if (!order) {
        throw new NotFoundError('订单不存在');
      }

      if (order.merchant_id !== merchantId) {
        throw new AuthorizationError('只能修改自己商品订单的备注');
      }

      const updateData: any = {};
      if (data.remark !== undefined) updateData.remark = data.remark;
      if (data.merchant_remark !== undefined) updateData.merchant_remark = data.merchant_remark;

      await order.update(updateData);
      logger.info(`Order remark updated: ${orderId}`);

      return this.formatOrderResponse(order);
    } catch (error) {
      logger.error('Update remark failed:', error);
      throw error;
    }
  }

  /**
   * 修改收货地址
   */
  async updateAddress(orderId: number, merchantId: number, data: UpdateAddressDto): Promise<OrderResponseDto> {
    try {
      const order = await Order.findByPk(orderId);

      if (!order) {
        throw new NotFoundError('订单不存在');
      }

      if (order.merchant_id !== merchantId) {
        throw new AuthorizationError('只能修改自己商品订单的地址');
      }

      if (!['paid', 'shipped'].includes(order.status)) {
        throw new ValidationError('只能对已付款或已发货订单修改地址');
      }

      await order.update({ shipping_address: data.shipping_address });
      logger.info(`Order address updated: ${orderId}`);

      return this.formatOrderResponse(order);
    } catch (error) {
      logger.error('Update address failed:', error);
      throw error;
    }
  }

  /**
   * 格式化订单响应
   */
  private formatOrderResponse(order: any): OrderResponseDto {
    const response: OrderResponseDto = {
      id: order.id,
      auction_id: order.auction_id,
      user_id: order.user_id,
      merchant_id: order.merchant_id,
      amount: parseFloat(order.amount.toString()),
      status: order.status,
      tracking_number: order.tracking_number || undefined,
      shipping_company: order.shipping_company || undefined,
      shipping_address: order.shipping_address || (order.user ? [order.user.province, order.user.city, order.user.district, order.user.detail_address].filter(Boolean).join(' ') : undefined),
      receiver_name: order.receiver_name || order.user?.receiver_name || undefined,
      receiver_phone: order.receiver_phone || order.user?.receiver_phone || undefined,
      remark: order.remark || undefined,
      merchant_remark: order.merchant_remark || undefined,
      refund_reason: order.refund_reason || undefined,
      refund_rejected_reason: order.refund_rejected_reason || undefined,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };

    if (order.auction) {
      response.auction = {
        id: order.auction.id,
        product_id: order.auction.product_id,
        status: order.auction.status,
        current_price: parseFloat(order.auction.current_price?.toString() || '0'),
        end_time: order.auction.end_time,
      };

      if (order.auction.product) {
        response.auction.product = {
          id: order.auction.product.id,
          name: order.auction.product.name,
          images: order.auction.product.images || [],
        };
      }
    }

    if (order.user) {
      response.user = {
        id: order.user.id,
        username: order.user.username,
        avatar: order.user.avatar,
        receiverName: order.user.receiver_name || undefined,
        receiverPhone: order.user.receiver_phone || undefined,
        province: order.user.province || undefined,
        city: order.user.city || undefined,
        district: order.user.district || undefined,
        detailAddress: order.user.detail_address || undefined,
      };
    }

    return response;
  }
}

export const orderService = new OrderService();