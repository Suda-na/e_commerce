/**
 * 页面浏览数据采集服务
 * 
 * 功能：
 * 1. 记录页面浏览行为
 * 2. 获取商品浏览量
 * 3. 批量获取商品浏览量
 * 4. 获取24小时流量统计
 * 5. 获取商品浏览趋势
 */

import { request } from '../utils/request';
import { getSessionId } from '../utils/storage';

class PageViewService {
  private sessionId: string;

  constructor() {
    this.sessionId = getSessionId();
  }

  /**
   * 记录页面浏览
   * @param productId 商品ID
   * @param pageType 页面类型（product/auction/live）
   */
  async recordView(productId: number, pageType: string = 'product'): Promise<void> {
    try {
      await request.post('/page-views', {
        product_id: productId,
        page_type: pageType,
        session_id: this.sessionId,
      });
    } catch (error) {
      // 静默失败，不影响用户体验
      console.error('记录浏览失败:', error);
    }
  }

  /**
   * 获取商品浏览量
   * @param productId 商品ID
   * @returns 浏览量
   */
  async getProductViews(productId: number): Promise<number> {
    try {
      const res = await request.get(`/page-views/product/${productId}`);
      return res.data?.views || 0;
    } catch (error) {
      console.error('获取浏览量失败:', error);
      return 0;
    }
  }

  /**
   * 批量获取商品浏览量
   * @param productIds 商品ID数组
   * @returns 商品ID到浏览量的映射
   */
  async getProductsViews(productIds: number[]): Promise<Map<number, number>> {
    try {
      const res = await request.post('/page-views/batch', { product_ids: productIds });
      
      const viewsMap = new Map<number, number>();
      if (res.data) {
        Object.entries(res.data).forEach(([key, value]) => {
          viewsMap.set(parseInt(key), value as number);
        });
      }
      return viewsMap;
    } catch (error) {
      console.error('批量获取浏览量失败:', error);
      return new Map();
    }
  }

  /**
   * 获取24小时流量统计
   * @param merchantId 商家ID（可选）
   * @returns 24小时流量数据
   */
  async getHourlyTraffic(merchantId?: number): Promise<Array<{hour: number; views: number}>> {
    try {
      const url = merchantId 
        ? `/page-views/hourly?merchant_id=${merchantId}`
        : '/page-views/hourly';
      
      const res = await request.get(url);
      return res.data || [];
    } catch (error) {
      console.error('获取小时流量失败:', error);
      return [];
    }
  }

  /**
   * 获取商品浏览趋势
   * @param productId 商品ID
   * @param days 天数（默认7天）
   * @returns 趋势数据
   */
  async getViewsTrend(productId: number, days: number = 7): Promise<Array<{date: string; views: number}>> {
    try {
      const res = await request.get(`/page-views/trend/${productId}?days=${days}`);
      return res.data || [];
    } catch (error) {
      console.error('获取浏览趋势失败:', error);
      return [];
    }
  }
}

export const pageViewService = new PageViewService();