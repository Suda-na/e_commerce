import { PageView } from '../models/PageView';
import { logger } from '../utils/logger';
import { cacheManager } from '../utils/cache-manager';

export class PageViewService {
  /**
   * 记录页面浏览
   */
  async recordView(data: {
    product_id: number;
    user_id?: number;
    session_id: string;
    ip_address: string;
    user_agent: string;
    referrer?: string;
    page_type?: 'product' | 'auction' | 'live';
  }): Promise<void> {
    try {
      await PageView.recordView(data);
      
      // 失效相关缓存
      await this.invalidateCache(data.product_id);
      
      logger.debug(`Page view recorded for product ${data.product_id}`);
    } catch (error) {
      logger.error('Failed to record page view:', error);
      // 不抛出错误，避免影响主业务流程
    }
  }

  /**
   * 批量记录页面浏览（用于高并发场景）
   */
  async recordViewsBatch(views: Array<{
    product_id: number;
    user_id?: number;
    session_id: string;
    ip_address: string;
    user_agent: string;
    referrer?: string;
    page_type?: 'product' | 'auction' | 'live';
  }>): Promise<void> {
    try {
      await PageView.bulkCreate(views.map(v => ({
        product_id: v.product_id,
        user_id: v.user_id || null,
        session_id: v.session_id,
        ip_address: v.ip_address,
        user_agent: v.user_agent,
        referrer: v.referrer || null,
        page_type: v.page_type || 'product',
      })));

      // 失效相关缓存
      const productIds = [...new Set(views.map(v => v.product_id))];
      for (const productId of productIds) {
        await this.invalidateCache(productId);
      }

      logger.debug(`Batch page view recorded for ${views.length} views`);
    } catch (error) {
      logger.error('Failed to record batch page views:', error);
    }
  }

  /**
   * 获取商品浏览量
   */
  async getProductViews(productId: number): Promise<number> {
    const cacheKey = `page_views:product:${productId}`;
    
    return await cacheManager.getOrSet(cacheKey, async () => {
      return await PageView.getProductViews(productId);
    }, { ttl: 300 }); // 缓存5分钟
  }

  /**
   * 批量获取商品浏览量
   */
  async getProductsViews(productIds: number[]): Promise<Map<number, number>> {
    if (productIds.length === 0) {
      return new Map();
    }

    // 对于批量查询，直接从数据库获取，避免缓存复杂性
    return await PageView.getProductsViews(productIds);
  }

  /**
   * 获取24小时流量统计
   */
  async getHourlyTraffic(merchantId?: number): Promise<Array<{ hour: number; views: number }>> {
    const cacheKey = merchantId 
      ? `page_views:hourly:merchant:${merchantId}` 
      : 'page_views:hourly:global';

    return await cacheManager.getOrSet(cacheKey, async () => {
      return await PageView.getHourlyTraffic(merchantId);
    }, { ttl: 60 }); // 缓存1分钟
  }

  /**
   * 获取商品浏览量趋势
   */
  async getViewsTrend(productId: number, days: number = 7): Promise<Array<{ date: string; views: number }>> {
    const cacheKey = `page_views:trend:product:${productId}:${days}d`;

    return await cacheManager.getOrSet(cacheKey, async () => {
      return await PageView.getViewsTrend(productId, days);
    }, { ttl: 300 }); // 缓存5分钟
  }

  /**
   * 失效缓存
   */
  private async invalidateCache(productId: number): Promise<void> {
    await cacheManager.del(`page_views:product:${productId}`);
    await cacheManager.delPattern('page_views:hourly:*');
    await cacheManager.delPattern('dashboard:*');
  }
}

export const pageViewService = new PageViewService();