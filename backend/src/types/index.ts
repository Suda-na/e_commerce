import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

// 用户角色类型
export type UserRole = 'user' | 'merchant' | 'admin';

// 用户接口
export interface IUser {
  id: number;
  username: string;
  password: string;
  role: UserRole;
  avatar?: string | null;
  email?: string | null;
  phone?: string | null;
  status: number;
  login_count: number;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  detail_address?: string | null;
  created_at: Date;
  updated_at: Date;
}

// 用户创建接口
export interface IUserCreate {
  username: string;
  password: string;
  role: UserRole;
  avatar?: string | null;
  email?: string | null;
  phone?: string | null;
}

// 用户更新接口
export interface IUserUpdate {
  username?: string;
  password?: string;
  avatar?: string | null;
  email?: string | null;
  phone?: string | null;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  detail_address?: string | null;
}

// 用户登录接口
export interface IUserLogin {
  username: string;
  password: string;
}

// 用户响应接口（不包含密码）
export interface IUserResponse {
  id: number;
  username: string;
  role: UserRole;
  avatar?: string | null;
  email?: string | null;
  phone?: string | null;
  status: number;
  login_count: number;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  detail_address?: string | null;
  created_at: Date;
  updated_at: Date;
}

// JWT载荷接口
export interface IJwtPayload extends JwtPayload {
  userId: number;
  username: string;
  role: UserRole;
}

// 认证请求接口
export interface AuthRequest extends Request {
  user?: IJwtPayload;
}

// 商品状态类型
export type ProductStatus = 'pending' | 'active' | 'completed' | 'cancelled';

// 商品接口
export interface IProduct {
  id: number;
  merchant_id: number;
  name: string;
  description?: string;
  images?: string[];
  starting_price: number;
  price_increment: number;
  duration: number;
  cap_price?: number;
  delay_time: number;
  status: ProductStatus;
  category_id?: number | null;
  tags?: string[];
  stock: number;
  stock_warning: number;
  sku?: string;
  weight?: number;
  shipping_template_id?: number | null;
  specifications?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

export interface ICategory {
  id: number;
  merchant_id: number;
  name: string;
  icon?: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface IProductCreate {
  name: string;
  description?: string;
  images?: string[];
  starting_price: number;
  price_increment: number;
  duration: number;
  cap_price?: number;
  delay_time?: number;
  category_id?: number;
  tags?: string[];
  stock?: number;
  stock_warning?: number;
  sku?: string;
  weight?: number;
  shipping_template_id?: number;
  specifications?: Record<string, string>;
}

export interface IProductUpdate {
  name?: string;
  description?: string;
  images?: string[];
  starting_price?: number;
  price_increment?: number;
  duration?: number;
  cap_price?: number;
  delay_time?: number;
  status?: ProductStatus;
  category_id?: number;
  tags?: string[];
  stock?: number;
  stock_warning?: number;
  sku?: string;
  weight?: number;
  shipping_template_id?: number;
  specifications?: Record<string, string>;
}
export type AuctionStatus = 'pending' | 'active' | 'completed' | 'cancelled';

// 竞拍接口
export interface IAuction {
  id: number;
  product_id: number;
  start_time?: Date;
  end_time?: Date;
  current_price?: number;
  winner_id?: number;
  status: AuctionStatus;
  created_at: Date;
  updated_at: Date;
}

// 竞拍创建接口
export interface IAuctionCreate {
  product_id: number;
}

// 竞拍更新接口
export interface IAuctionUpdate {
  start_time?: Date;
  end_time?: Date;
  current_price?: number;
  winner_id?: number;
  status?: AuctionStatus;
}

// 竞拍详情接口（包含商品信息）
export interface IAuctionDetail extends IAuction {
  product: IProduct;
  winner?: IUserResponse;
  bids_count?: number;
  online_count?: number;
}

// 出价接口
export interface IBid {
  id: number;
  auction_id: number;
  user_id: number;
  amount: number;
  created_at: Date;
  updated_at: Date;
}

// 出价创建接口
export interface IBidCreate {
  auction_id: number;
  amount: number;
}

// 出价响应接口
export interface IBidResponse extends IBid {
  user: IUserResponse;
}

// 排行榜接口
export interface ILeaderboardEntry {
  user_id: number;
  username: string;
  avatar?: string | null;
  amount: number;
  rank: number;
}

// 订单状态类型
export interface IShippingRule {
  id: number;
  template_id: number;
  regions: string[];
  first_item_fee: number;
  additional_item_fee: number;
  free_threshold?: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface IShippingTemplate {
  id: number;
  merchant_id: number;
  name: string;
  rules?: IShippingRule[];
  created_at: Date;
  updated_at: Date;
}

export type ShippingCalculationMethod = 'by_item' | 'by_weight' | 'by_volume';

export interface IShippingFeeRequest {
  template_id: number;
  region: string;
  quantity: number;
  total_amount?: number;
  weight?: number;
}

export interface IShippingFeeResult {
  fee: number;
  is_free: boolean;
  matched_rule?: {
    id: number;
    template_id: number;
    regions: string[];
    first_item_fee: number;
    additional_item_fee: number;
    free_threshold?: number | null;
  };
  template_name: string;
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'refunding' | 'refunded' | 'cancelled';

// 订单接口
export interface IOrder {
  id: number;
  auction_id: number;
  user_id: number;
  merchant_id: number;
  amount: number;
  status: OrderStatus;
  tracking_number?: string;
  shipping_company?: string;
  shipping_address?: string;
  receiver_name?: string;
  receiver_phone?: string;
  remark?: string;
  merchant_remark?: string;
  refund_reason?: string;
  refund_rejected_reason?: string;
  created_at: Date;
  updated_at: Date;
}

// 订单创建接口
export interface IOrderCreate {
  auction_id: number;
  user_id: number;
  merchant_id: number;
  amount: number;
}

// 订单更新接口
export interface IOrderUpdate {
  status?: OrderStatus;
}

// 订单详情接口
export interface IOrderDetail extends IOrder {
  auction: IAuction;
  user: IUserResponse;
  product: IProduct;
}

// WebSocket事件类型
export interface SocketEvents {
  // 客户端事件
  join_auction: (auctionId: string) => void;
  leave_auction: (auctionId: string) => void;
  place_bid: (data: { auctionId: string; amount: number }) => void;
  
  // 服务器事件
  auction_status: (data: { auctionId: string; status: AuctionStatus }) => void;
  new_bid: (data: { auctionId: string; userId: number; amount: number; timestamp: Date }) => void;
  leaderboard_update: (data: { auctionId: string; leaderboard: ILeaderboardEntry[] }) => void;
  auction_update: (data: { auctionId: string; currentPrice: number; timeLeft: number }) => void;
  time_extended: (data: { auctionId: string; newEndTime: Date }) => void;
  auction_ended: (data: { auctionId: string; winnerId?: number; finalPrice?: number }) => void;
  outbid: (data: { auctionId: string; newAmount: number }) => void;
  user_joined: (data: { auctionId: string; userId: number; username: string }) => void;
  user_left: (data: { auctionId: string; userId: number; username: string }) => void;
  bid_error: (data: { message: string }) => void;
}

// API响应接口
export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  requestId?: string;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: ResponseMeta;
}

// 分页查询接口
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

// 筛选查询接口
export interface FilterQuery extends PaginationQuery {
  status?: string;
  search?: string;
}

// AI服务接口
export interface AIServiceRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIServiceResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// 竞拍配置接口
export interface AuctionConfig {
  defaultDuration: number;
  defaultDelay: number;
  maxDelay: number;
}

// Redis缓存键类型
export type RedisKey = 
  | `auction:${number}:data`
  | `auction:${number}:leaderboard`
  | `auction:${number}:online`
  | `bid:${number}:${number}`
  | `user:${number}:session`
  | `rate_limit:${string}`;

// 数据库模型类型
export interface ModelStatic<M> {
  new (): M;
  findAll(options?: any): Promise<M[]>;
  findOne(options?: any): Promise<M | null>;
  findByPk(id: number | string): Promise<M | null>;
  create(values: any): Promise<M>;
  update(values: any, options: any): Promise<[number, M[]]>;
  destroy(options: any): Promise<number>;
}