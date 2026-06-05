import { IsNumber, IsOptional, IsString, IsEnum, Min, Max, Length } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OrderStatus } from '../types';

export class OrderQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsEnum(['pending', 'paid', 'shipped', 'refunding', 'refunded', 'cancelled'])
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  auctionId?: string;
}

export class OrderResponseDto {
  id!: number;
  auction_id!: number;
  user_id!: number;
  merchant_id!: number;
  amount!: number;
  status!: OrderStatus;
  tracking_number?: string;
  shipping_company?: string;
  shipping_address?: string;
  receiver_name?: string;
  receiver_phone?: string;
  remark?: string;
  merchant_remark?: string;
  refund_reason?: string;
  refund_rejected_reason?: string;
  created_at!: Date;
  updated_at!: Date;
  auction?: {
    id: number;
    product_id: number;
    status: string;
    current_price: number;
    end_time: Date;
    product?: {
      id: number;
      name: string;
      images: string[];
    };
  };
  user?: {
    id: number;
    username: string;
    avatar?: string | null;
    receiverName?: string | null;
    receiverPhone?: string | null;
    province?: string | null;
    city?: string | null;
    district?: string | null;
    detailAddress?: string | null;
  };
}

export class OrderListResponseDto {
  orders!: OrderResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class OrderUpdateStatusDto {
  @IsEnum(['pending', 'paid', 'shipped', 'refunding', 'refunded', 'cancelled'])
  status!: OrderStatus;
}

export class ShipOrderDto {
  @IsString()
  @Length(1, 100)
  tracking_number!: string;

  @IsString()
  @Length(1, 100)
  shipping_company!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}

export class RefundActionDto {
  @IsEnum(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}

export class UpdateRemarkDto {
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  remark?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  merchant_remark?: string;
}

export class UpdateAddressDto {
  @IsString()
  @Length(1, 500)
  shipping_address!: string;
}

export class OrderPayResultDto {
  success!: boolean;
  message!: string;
  order?: OrderResponseDto;
  paymentId?: string;
  paidAt?: Date;
}

export class OrderCancelResultDto {
  success!: boolean;
  message!: string;
  order?: OrderResponseDto;
  cancelledAt?: Date;
}

export class OrderStatsDto {
  totalOrders!: number;
  pendingOrders!: number;
  paidOrders!: number;
  cancelledOrders!: number;
  totalAmount!: number;
  averageAmount!: number;
}