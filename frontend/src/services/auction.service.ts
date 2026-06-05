import api from './api';
import { Auction, CreateAuctionRequest, LeaderboardEntry, ApiResponse, PaginatedResponse } from '../types';

class AuctionService {
  private toCamelCase(auction: any): Auction {
    return {
      id: auction.id,
      productId: auction.product_id,
      product: auction.product ? {
        id: auction.product.id,
        merchantId: auction.product.merchant_id,
        name: auction.product.name,
        description: auction.product.description,
        images: auction.product.images || [],
        startingPrice: auction.product.starting_price,
        priceIncrement: auction.product.price_increment,
        duration: auction.product.duration,
        capPrice: auction.product.cap_price,
        delayTime: auction.product.delay_time,
        status: auction.product.status,
        stock: auction.product.stock ?? 1,
        stockWarning: auction.product.stock_warning ?? 5,
        sku: auction.product.sku,
        weight: auction.product.weight ? parseFloat(auction.product.weight) : undefined,
        specifications: auction.product.specifications || undefined,
      } : undefined,
      startTime: auction.start_time,
      endTime: auction.end_time,
      currentPrice: auction.current_price != null ? auction.current_price : 0,
      winnerId: auction.winner_id,
      winner: auction.winner,
      status: auction.status,
      bidCount: auction.bids_count ?? 0,
      onlineCount: auction.online_count ?? 0,
      participantCount: auction.participant_count ?? 0,
      createdAt: auction.created_at,
      updatedAt: auction.updated_at,
    };
  }

  private toCamelCaseLeaderboard(entry: any): LeaderboardEntry {
    return {
      userId: entry.user_id,
      username: entry.username,
      avatar: entry.avatar,
      amount: entry.amount,
      rank: entry.rank,
    };
  }

  async getAuctions(params?: { page?: number; pageSize?: number; status?: string }): Promise<PaginatedResponse<Auction>> {
    // 调用商家专属接口，只返回当前商家的竞拍
    const response = await api.get<any>('/auctions/merchant', {
      params: { ...params, limit: params?.pageSize, pageSize: undefined },
    });
    const { data, meta } = response.data;
    return {
      items: (data || []).map((a: any) => this.toCamelCase(a)),
      total: meta?.total ?? 0,
      page: meta?.page ?? 1,
      pageSize: meta?.limit ?? 10,
      totalPages: meta?.totalPages ?? 1,
    };
  }

  async getAuction(id: number): Promise<Auction> {
    const response = await api.get<ApiResponse<any>>(`/auctions/${id}`);
    return this.toCamelCase(response.data.data!);
  }

  async createAuction(data: CreateAuctionRequest): Promise<Auction> {
    // 前端camelCase → 后端snake_case
    const payload = { product_id: data.productId };
    const response = await api.post<ApiResponse<any>>('/auctions', payload);
    return this.toCamelCase(response.data.data!);
  }

  async startAuction(id: number): Promise<Auction> {
    const response = await api.post<ApiResponse<any>>(`/auctions/${id}/start`);
    return this.toCamelCase(response.data.data!);
  }

  async endAuction(id: number): Promise<Auction> {
    const response = await api.post<ApiResponse<any>>(`/auctions/${id}/complete`);
    return this.toCamelCase(response.data.data!);
  }

  async cancelAuction(id: number): Promise<Auction> {
    const response = await api.post<ApiResponse<any>>(`/auctions/${id}/cancel`);
    return this.toCamelCase(response.data.data!);
  }

  async listProduct(productId: number): Promise<Auction> {
    const response = await api.post<ApiResponse<any>>(`/auctions/list-product/${productId}`);
    return this.toCamelCase(response.data.data!);
  }

  async delistProduct(productId: number): Promise<Auction> {
    const response = await api.post<ApiResponse<any>>(`/auctions/delist-product/${productId}`);
    return this.toCamelCase(response.data.data!);
  }

  async getLeaderboard(id: number): Promise<LeaderboardEntry[]> {
    const response = await api.get<ApiResponse<any[]>>(`/auctions/${id}/leaderboard`);
    return (response.data.data || []).map((e: any) => this.toCamelCaseLeaderboard(e));
  }
}

export const auctionService = new AuctionService();
