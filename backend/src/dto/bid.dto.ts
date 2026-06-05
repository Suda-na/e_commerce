import { IsNumber, IsOptional, IsString, Min, Max, Length } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * 出价DTO
 */
export class PlaceBidDto {
  @IsNumber()
  @Min(0.01)
  @Max(99999999.99)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  requestId?: string; // 用于幂等性检查
}

/**
 * 出价查询DTO
 */
export class BidQueryDto {
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
  @IsString()
  @Length(1, 100)
  userId?: string;
}

/**
 * 出价响应DTO
 */
export class BidResponseDto {
  id!: number;
  auction_id!: number;
  user_id!: number;
  amount!: number;
  created_at!: Date;
  updated_at!: Date;
  user?: {
    id: number;
    username: string;
    avatar?: string | null;
  };
  auction?: {
    id: number;
    product_id: number;
    status: string;
    current_price: number;
    end_time: Date;
    winner_id?: number | null;
    product?: {
      id: number;
      name: string;
      images: string[];
      merchant_id: number;
    };
  };
}

/**
 * 出价结果DTO
 */
export class BidResultDto {
  success!: boolean;
  message!: string;
  bid?: BidResponseDto;
  auction?: any;
  isExtended?: boolean;
  isCompleted?: boolean;
  currentPrice?: number;
  winnerId?: number;
  endTime?: Date;
  delayTime?: number;
  requestId?: string;
  capPrice?: number; // 封顶价（达到封顶价自动成交时使用）
}

/**
 * 排行榜条目DTO
 */
export class LeaderboardEntryDto {
  user_id!: number;
  username!: string;
  avatar?: string | null;
  amount!: number;
  rank!: number;
}

/**
 * 出价统计DTO
 */
export class BidStatsDto {
  totalBids!: number;
  totalAmount!: number;
  averageAmount!: number;
  highestBid!: number;
  lowestBid!: number;
  uniqueBidders!: number;
}

/**
 * 出价历史DTO
 */
export class BidHistoryDto {
  auction_id!: number;
  user_id!: number;
  bids!: Array<{
    id: number;
    amount: number;
    created_at: Date;
  }>;
  stats!: BidStatsDto;
}

/**
 * 出价校验结果DTO
 */
export class BidValidationDto {
  valid!: boolean;
  message?: string;
  minBid?: number;
  maxBid?: number;
  priceIncrement?: number;
  capPrice?: number;
}

/**
 * 出价幂等性键生成器
 */
export class BidCacheKeys {
  /**
   * 出价幂等性键
   */
  static bidIdempotency(auctionId: number, requestId: string): string {
    return `bid:idempotency:${auctionId}:${requestId}`;
  }

  /**
   * 用户出价记录键
   */
  static userBids(auctionId: number, userId: number): string {
    return `bid:user:${auctionId}:${userId}`;
  }

  /**
   * 出价统计键
   */
  static bidStats(auctionId: number): string {
    return `bid:stats:${auctionId}`;
  }

  /**
   * 出价队列键（用于批量写入数据库）
   */
  static bidQueue(auctionId: number): string {
    return `bid:queue:${auctionId}`;
  }

  /**
   * 出价锁键
   */
  static bidLock(auctionId: number): string {
    return `bid:lock:${auctionId}`;
  }

  /**
   * 用户出价频率限制键
   */
  static bidRateLimit(auctionId: number, userId: number): string {
    return `bid:rate:${auctionId}:${userId}`;
  }
}