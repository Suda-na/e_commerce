import { IsNumber, IsOptional, IsEnum, IsDate, IsString, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AuctionStatus } from '../types';

/**
 * 创建竞拍DTO
 */
export class CreateAuctionDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  product_id!: number;
}

/**
 * 更新竞拍状态DTO
 */
export class UpdateAuctionStatusDto {
  @IsEnum(['pending', 'active', 'completed', 'cancelled'])
  status!: AuctionStatus;
}

/**
 * 竞拍查询DTO
 */
export class AuctionQueryDto {
  @IsOptional()
  @IsEnum(['pending', 'active', 'completed', 'cancelled'])
  status?: AuctionStatus;

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
  @IsEnum(['created_at', 'start_time', 'end_time', 'current_price'])
  sort?: string;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  merchant_id?: number;
}

/**
 * 竞拍响应DTO
 */
export class AuctionResponseDto {
  id!: number;
  product_id!: number;
  start_time?: Date;
  end_time?: Date;
  current_price?: number;
  winner_id?: number;
  status!: AuctionStatus;
  created_at!: Date;
  updated_at!: Date;
  product?: {
    id: number;
    name: string;
    description?: string;
    images?: string[];
    starting_price: number;
    price_increment: number;
    duration: number;
    cap_price?: number;
    delay_time: number;
    merchant_id: number;
  };
  winner?: {
    id: number;
    username: string;
    avatar?: string | null;
  };
  bids_count?: number;
  online_count?: number;
  participant_count?: number;
  time_left?: number; // 剩余时间（秒）
}

/**
 * 竞拍状态机
 */
export class AuctionStateMachine {
  private static readonly validTransitions: Record<AuctionStatus, AuctionStatus[]> = {
    pending: ['active', 'cancelled'],
    active: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  private static readonly productStatusMap: Record<AuctionStatus, string> = {
    pending: 'pending',
    active: 'active',
    completed: 'completed',
    cancelled: 'cancelled',
  };

  static validateTransition(currentStatus: AuctionStatus, targetStatus: AuctionStatus): void {
    const allowed = AuctionStateMachine.validTransitions[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new Error(`非法状态转换: ${currentStatus} -> ${targetStatus}`);
    }
  }

  static isValidTransition(currentStatus: AuctionStatus, newStatus: AuctionStatus): boolean {
    const allowed = AuctionStateMachine.validTransitions[currentStatus];
    return allowed?.includes(newStatus) ?? false;
  }

  static getExpectedProductStatus(auctionStatus: AuctionStatus): string {
    return AuctionStateMachine.productStatusMap[auctionStatus];
  }

  static validateProductAuctionConsistency(auctionStatus: AuctionStatus, productStatus: string): boolean {
    const expected = AuctionStateMachine.getExpectedProductStatus(auctionStatus);
    return productStatus === expected;
  }

  /**
   * 检查竞拍是否可以开始
   */
  static canStart(auction: any): boolean {
    return auction.status === 'pending';
  }

  /**
   * 检查竞拍是否可以结束
   */
  static canComplete(auction: any): boolean {
    return auction.status === 'active';
  }

  /**
   * 检查竞拍是否可以取消
   */
  static canCancel(auction: any): boolean {
    return auction.status === 'pending' || auction.status === 'active';
  }

  /**
   * 检查竞拍是否已结束
   */
  static isEnded(auction: any): boolean {
    if (!auction.end_time) return false;
    return new Date() > new Date(auction.end_time);
  }

  /**
   * 计算剩余时间（秒）
   */
  static getTimeLeft(auction: any): number {
    if (!auction.end_time) return 0;
    const now = new Date();
    const endTime = new Date(auction.end_time);
    const timeLeft = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
    return timeLeft;
  }

  /**
   * 检查是否需要延时
   */
  static shouldExtend(auction: any, bidTime: Date, delayTime: number): boolean {
    if (!auction.end_time) return false;
    const endTime = new Date(auction.end_time);
    const timeLeft = Math.floor((endTime.getTime() - bidTime.getTime()) / 1000);
    return timeLeft <= delayTime;
  }

  /**
   * 计算延时后的新结束时间
   */
  static calculateNewEndTime(auction: any, bidTime: Date, delayTime: number): Date {
    const endTime = new Date(auction.end_time);
    const timeLeft = Math.floor((endTime.getTime() - bidTime.getTime()) / 1000);
    
    if (timeLeft <= delayTime) {
      // 延长delayTime秒：在原结束时间上叠加延时时长
      return new Date(endTime.getTime() + delayTime * 1000);
    }
    
    return endTime;
  }

  /**
   * 检查是否达到封顶价
   */
  static hasReachedCapPrice(currentPrice: number, capPrice?: number): boolean {
    if (!capPrice) return false;
    return currentPrice >= capPrice;
  }
}

/**
 * 竞拍缓存键生成器
 */
export class AuctionCacheKeys {
  static auction(auctionId: number): string {
    return `auction:${auctionId}`;
  }

  static auctionBids(auctionId: number): string {
    return `auction:${auctionId}:bids`;
  }

  static auctionLeaderboard(auctionId: number): string {
    return `auction:${auctionId}:leaderboard`;
  }

  static auctionOnlineUsers(auctionId: number): string {
    return `auction:${auctionId}:online_users`;
  }

  static auctionTimer(auctionId: number): string {
    return `auction:${auctionId}:timer`;
  }

  static activeAuctions(): string {
    return 'auctions:active';
  }
}