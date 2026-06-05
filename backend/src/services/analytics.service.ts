import { sequelize } from '../config/database';
import { Product } from '../models/Product';
import { Auction } from '../models/Auction';
import { Bid } from '../models/Bid';
import { Order } from '../models/Order';
import { Category } from '../models/Category';
import { PageView } from '../models/PageView';
import { logger } from '../utils/logger';
import { cacheManager } from '../utils/cache-manager';
import { Op, QueryTypes, fn, col, literal } from 'sequelize';

interface AnalyticsOverview {
  totalProducts: number;
  activeAuctions: number;
  conversionRate: number;
  avgSellingPrice: number;
  revenueGrowth: number;
}

interface TopProduct {
  productId: number;
  name: string;
  views: number;
  bids: number;
  finalPrice: number;
  revenue: number;
}

interface PriceDistribution {
  range: string;
  count: number;
  percentage: number;
}

interface HourlyTraffic {
  hour: number;
  views: number;
  bids: number;
}

interface CategoryPerformance {
  category: string;
  productCount: number;
  totalRevenue: number;
  avgConversionRate: number;
}

interface AnalyticsDashboard {
  overview: AnalyticsOverview;
  topProducts: TopProduct[];
  priceDistribution: PriceDistribution[];
  hourlyTraffic: HourlyTraffic[];
  categoryPerformance: CategoryPerformance[];
}

export class AnalyticsService {
  async getDashboard(merchantId?: number): Promise<AnalyticsDashboard> {
    const cacheKey = merchantId ? `dashboard:merchant:${merchantId}` : 'dashboard:global';
    const cached = await cacheManager.get<AnalyticsDashboard>(cacheKey);
    if (cached) {
      return cached;
    }

    const [overview, topProducts, priceDistribution, hourlyTraffic, categoryPerformance] = await Promise.all([
      this.getOverview(merchantId),
      this.getTopProducts(merchantId),
      this.getPriceDistribution(merchantId),
      this.getHourlyTraffic(merchantId),
      this.getCategoryPerformance(merchantId),
    ]);

    const result: AnalyticsDashboard = {
      overview,
      topProducts,
      priceDistribution,
      hourlyTraffic,
      categoryPerformance,
    };

    await cacheManager.set(cacheKey, result, { strategy: 'dashboard' });

    return result;
  }

  private async getOverview(merchantId?: number): Promise<AnalyticsOverview> {
    const productWhere: any = {};
    if (merchantId) productWhere.merchant_id = merchantId;

    const totalProducts = await Product.count({ where: productWhere });

    const auctionWhere: any = { status: 'active' };
    if (merchantId) {
      auctionWhere['$product.merchant_id$'] = merchantId;
    }
    const activeAuctions = await Auction.count({
      where: auctionWhere,
      include: merchantId ? [{ model: Product, as: 'product', attributes: [] }] : [],
      distinct: true,
    });

    const totalAuctions = await Auction.count({
      where: merchantId ? { '$product.merchant_id$': merchantId } : {},
      include: merchantId ? [{ model: Product, as: 'product', attributes: [] }] : [],
      distinct: true,
    });

    const completedAuctions = await Auction.count({
      where: {
        status: 'completed',
        ...(merchantId ? { '$product.merchant_id$': merchantId } : {}),
      },
      include: merchantId ? [{ model: Product, as: 'product', attributes: [] }] : [],
      distinct: true,
    });

    const conversionRate = totalAuctions > 0 ? completedAuctions / totalAuctions : 0;

    const orderWhere: any = {
      status: { [Op.in]: ['paid', 'shipped'] },
    };
    if (merchantId) {
      orderWhere.merchant_id = merchantId;
    }

    const avgResult = await Order.findAll({
      where: orderWhere,
      attributes: [[fn('AVG', col('amount')), 'avgPrice']],
      raw: true,
    });

    const avgSellingPrice = parseFloat((avgResult[0] as any)?.avgPrice?.toString() || '0');

    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekRevenue = await this.getRevenueInRange(thisWeekStart, now, merchantId);
    const lastWeekRevenue = await this.getRevenueInRange(lastWeekStart, thisWeekStart, merchantId);

    const revenueGrowth = lastWeekRevenue > 0
      ? (thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue
      : thisWeekRevenue > 0 ? 1 : 0;

    return {
      totalProducts,
      activeAuctions,
      conversionRate,
      avgSellingPrice,
      revenueGrowth,
    };
  }

  private async getRevenueInRange(start: Date, end: Date, merchantId?: number): Promise<number> {
    const where: any = {
      status: { [Op.in]: ['paid', 'shipped'] },
      created_at: { [Op.between]: [start, end] },
    };
    if (merchantId) {
      where.merchant_id = merchantId;
    }

    const result = await Order.findAll({
      where,
      attributes: [[fn('SUM', col('amount')), 'totalRevenue']],
      raw: true,
    });

    return parseFloat((result[0] as any)?.totalRevenue?.toString() || '0');
  }

  private async getTopProducts(merchantId?: number): Promise<TopProduct[]> {
    const productWhere: any = {};
    if (merchantId) productWhere.merchant_id = merchantId;

    const products = await Product.findAll({
      where: productWhere,
      include: [
        {
          model: Auction,
          as: 'auction',
          attributes: ['id', 'current_price', 'status'],
          include: [
            {
              model: Bid,
              as: 'bids',
              attributes: ['id'],
            },
            {
              model: Order,
              as: 'order',
              attributes: ['amount', 'status'],
              where: { status: { [Op.in]: ['paid', 'shipped'] } },
              required: false,
            },
          ],
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    // 批量获取商品浏览量
    const productIds = products.map((p: any) => p.id);
    const viewsMap = await PageView.getProductsViews(productIds);

    const topProducts: TopProduct[] = products
      .map((product: any) => {
        const auction = product.auction;
        const bidCount = auction?.bids?.length || 0;
        const finalPrice = auction?.current_price ? parseFloat(auction.current_price.toString()) : parseFloat(product.starting_price.toString());
        const orderAmount = auction?.order?.amount ? parseFloat(auction.order.amount.toString()) : 0;
        const revenue = orderAmount;

        return {
          productId: product.id,
          name: product.name,
          views: viewsMap.get(product.id) || 0,
          bids: bidCount,
          finalPrice,
          revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.views - a.views || b.finalPrice - a.finalPrice)
      .slice(0, 10);

    return topProducts;
  }

  private async getPriceDistribution(merchantId?: number): Promise<PriceDistribution[]> {
    const productWhere: any = {};
    if (merchantId) productWhere.merchant_id = merchantId;

    const products = await Product.findAll({
      where: productWhere,
      attributes: ['id', 'starting_price'],
      include: [
        {
          model: Auction,
          as: 'auction',
          attributes: ['id', 'current_price'],
          required: false,
        },
      ],
    });

    const ranges = [
      { label: '0-100', min: 0, max: 100 },
      { label: '100-500', min: 100, max: 500 },
      { label: '500-1000', min: 500, max: 1000 },
      { label: '1000-5000', min: 1000, max: 5000 },
      { label: '5000+', min: 5000, max: Infinity },
    ];

    const total = products.length || 1;

    const distribution: PriceDistribution[] = ranges.map((range) => {
      const count = products.filter((p: any) => {
        const price = p.auction?.current_price
          ? parseFloat(p.auction.current_price.toString())
          : parseFloat(p.starting_price.toString());
        return price >= range.min && price < range.max;
      }).length;

      return {
        range: range.label,
        count,
        percentage: parseFloat(((count / total) * 100).toFixed(1)),
      };
    });

    return distribution;
  }

  private async getHourlyTraffic(merchantId?: number): Promise<HourlyTraffic[]> {
    // 获取出价数据
    const bidWhere: any = {};
    if (merchantId) {
      bidWhere['$auction.product.merchant_id$'] = merchantId;
    }

    const bids = await Bid.findAll({
      where: bidWhere,
      attributes: [
        [fn('HOUR', col('Bid.created_at')), 'hour'],
        [fn('COUNT', col('Bid.id')), 'bidCount'],
      ],
      include: merchantId
        ? [{ model: Auction, as: 'auction', attributes: [], include: [{ model: Product, as: 'product', attributes: [] }] }]
        : [],
      group: [fn('HOUR', col('Bid.created_at'))],
      raw: true,
    });

    const bidMap = new Map<number, number>();
    bids.forEach((bid: any) => {
      const hour = parseInt(bid.hour?.toString() || '0');
      const count = parseInt(bid.bidCount?.toString() || '0');
      bidMap.set(hour, count);
    });

    // 获取浏览量数据
    const pageViewHourly = await PageView.getHourlyTraffic(merchantId);
    const viewMap = new Map<number, number>();
    pageViewHourly.forEach(item => {
      viewMap.set(item.hour, item.views);
    });

    const hourlyTraffic: HourlyTraffic[] = [];
    for (let h = 0; h < 24; h++) {
      hourlyTraffic.push({
        hour: h,
        views: viewMap.get(h) || 0,
        bids: bidMap.get(h) || 0,
      });
    }

    return hourlyTraffic;
  }

  private async getCategoryPerformance(merchantId?: number): Promise<CategoryPerformance[]> {
    const productWhere: any = {};
    if (merchantId) productWhere.merchant_id = merchantId;

    const products = await Product.findAll({
      where: productWhere,
      attributes: ['id', 'starting_price', 'category_id'],
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
        },
        {
          model: Auction,
          as: 'auction',
          attributes: ['id', 'status'],
          include: [
            {
              model: Order,
              as: 'order',
              attributes: ['amount', 'status'],
              where: { status: { [Op.in]: ['paid', 'shipped'] } },
              required: false,
            },
          ],
        },
      ],
    });

    const categoryMap = new Map<string, { productCount: number; totalRevenue: number; totalAuctions: number; completedAuctions: number }>();

    products.forEach((product: any) => {
      const catName = product.category?.name || '未分类';
      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, { productCount: 0, totalRevenue: 0, totalAuctions: 0, completedAuctions: 0 });
      }
      const entry = categoryMap.get(catName)!;
      entry.productCount++;

      if (product.auction) {
        entry.totalAuctions++;
        if (product.auction.status === 'completed') {
          entry.completedAuctions++;
        }
        if (product.auction.order) {
          entry.totalRevenue += parseFloat(product.auction.order.amount.toString());
        }
      }
    });

    const categoryPerformance: CategoryPerformance[] = [];
    categoryMap.forEach((value, key) => {
      const avgConversionRate = value.totalAuctions > 0 ? value.completedAuctions / value.totalAuctions : 0;
      categoryPerformance.push({
        category: key,
        productCount: value.productCount,
        totalRevenue: value.totalRevenue,
        avgConversionRate: parseFloat(avgConversionRate.toFixed(4)),
      });
    });

    return categoryPerformance
      .filter((c) => c.productCount > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * AI经营日报
   */
  async getAIDailyReport(merchantId?: number): Promise<any> {
    const cacheKey = merchantId ? `analytics:ai:daily:${merchantId}` : 'analytics:ai:daily:global';
    const cached = await cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const [todayRevenue, yesterdayRevenue, todayOrders, yesterdayOrders, completedAuctions, totalAuctions, topCategoryResult] = await Promise.all([
      this.getRevenueInRange(todayStart, now, merchantId),
      this.getRevenueInRange(yesterdayStart, todayStart, merchantId),
      Order.count({
        where: {
          status: { [Op.in]: ['paid', 'shipped'] },
          created_at: { [Op.gte]: todayStart },
          ...(merchantId ? { merchant_id: merchantId } : {}),
        },
      }),
      Order.count({
        where: {
          status: { [Op.in]: ['paid', 'shipped'] },
          created_at: { [Op.gte]: yesterdayStart, [Op.lt]: todayStart },
          ...(merchantId ? { merchant_id: merchantId } : {}),
        },
      }),
      Auction.count({
        where: { status: 'completed' },
        include: merchantId ? [{ model: Product, as: 'product', attributes: [], where: { merchant_id: merchantId } }] : [],
        distinct: true,
      }),
      Auction.count({
        include: merchantId ? [{ model: Product, as: 'product', attributes: [], where: { merchant_id: merchantId } }] : [],
        distinct: true,
      }),
      this.getTopCategory(merchantId),
    ]);

    const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : (todayRevenue > 0 ? 100 : 0);
    const orderChange = yesterdayOrders > 0 ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100 : (todayOrders > 0 ? 100 : 0);
    const conversionRate = totalAuctions > 0 ? completedAuctions / totalAuctions : 0;

    const highlights: string[] = [];
    const suggestions: string[] = [];

    if (revenueChange > 0) highlights.push(`今日收入较昨日增长 ${revenueChange.toFixed(1)}%`);
    else if (revenueChange < 0) highlights.push(`今日收入较昨日下降 ${Math.abs(revenueChange).toFixed(1)}%`);
    else highlights.push('今日收入与昨日持平');

    if (todayOrders > 0) highlights.push(`今日成交 ${todayOrders} 笔订单`);
    if (topCategoryResult) highlights.push(`最热门品类: ${topCategoryResult}`);

    if (conversionRate < 0.3) suggestions.push('竞拍转化率偏低，建议降低起拍价或增加商品吸引力');
    if (todayOrders === 0) suggestions.push('今日暂无成交，建议检查商品定价和竞拍设置');
    if (revenueChange < -20) suggestions.push('收入下滑明显，建议优化商品组合或调整竞拍策略');
    if (suggestions.length === 0) suggestions.push('经营状况良好，继续保持当前策略');

    const result = {
      date: todayStart.toISOString().split('T')[0],
      summary: `今日收入 ¥${todayRevenue.toFixed(2)}，成交 ${todayOrders} 笔，转化率 ${(conversionRate * 100).toFixed(1)}%`,
      highlights,
      suggestions,
      metrics: {
        totalRevenue: todayRevenue,
        revenueChange,
        totalOrders: todayOrders,
        orderChange,
        avgConversionRate: conversionRate,
        topCategory: topCategoryResult || '暂无',
      },
    };

    await cacheManager.set(cacheKey, result, { strategy: 'dashboard' });
    return result;
  }

  /**
   * 竞拍漏斗分析
   */
  async getAuctionFunnel(merchantId?: number): Promise<any> {
    const cacheKey = merchantId ? `analytics:funnel:${merchantId}` : 'analytics:funnel:global';
    const cached = await cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    const productWhere: any = {};
    if (merchantId) productWhere.merchant_id = merchantId;

    const [totalProducts, productsWithAuctions, productsWithBids, completedAuctions] = await Promise.all([
      Product.count({ where: productWhere }),
      Product.count({ where: productWhere, include: [{ model: Auction, as: 'auction', required: true }], distinct: true }),
      Product.count({
        where: productWhere,
        include: [{ model: Auction, as: 'auction', required: true, include: [{ model: Bid, as: 'bids', required: true }] }],
        distinct: true,
      }),
      Auction.count({
        where: { status: 'completed' },
        include: merchantId ? [{ model: Product, as: 'product', attributes: [], where: { merchant_id: merchantId } }] : [],
        distinct: true,
      }),
    ]);

    const step1Rate = totalProducts > 0 ? (productsWithAuctions / totalProducts) * 100 : 0;
    const step2Rate = productsWithAuctions > 0 ? (productsWithBids / productsWithAuctions) * 100 : 0;
    const step3Rate = productsWithBids > 0 ? (completedAuctions / productsWithBids) * 100 : 0;
    const overallRate = totalProducts > 0 ? (completedAuctions / totalProducts) * 100 : 0;

    const steps = [
      { step: 'listed', label: '已上架商品', count: totalProducts, rate: 100, dropoffRate: 100 - step1Rate },
      { step: 'auctioned', label: '发起竞拍', count: productsWithAuctions, rate: step1Rate, dropoffRate: step1Rate - step2Rate },
      { step: 'bid', label: '有人出价', count: productsWithBids, rate: step2Rate, dropoffRate: step2Rate - step3Rate },
      { step: 'completed', label: '竞拍成交', count: completedAuctions, rate: step3Rate, dropoffRate: step3Rate },
    ];

    let bottleneck = '';
    let suggestion = '';
    const maxDropoff = Math.max(steps[0].dropoffRate, steps[1].dropoffRate, steps[2].dropoffRate);
    if (maxDropoff === steps[0].dropoffRate) {
      bottleneck = '上架→竞拍';
      suggestion = '大量商品未发起竞拍，建议尽快为商品创建竞拍活动';
    } else if (maxDropoff === steps[1].dropoffRate) {
      bottleneck = '竞拍→出价';
      suggestion = '竞拍参与度低，建议降低起拍价、优化商品描述或增加推广';
    } else {
      bottleneck = '出价→成交';
      suggestion = '出价后成交率低，建议检查封顶价设置或竞拍时长是否合理';
    }

    const result = {
      steps,
      overallConversionRate: overallRate,
      bottleneck,
      suggestion,
    };

    await cacheManager.set(cacheKey, result, { strategy: 'dashboard' });
    return result;
  }

  /**
   * 智能定价建议
   */
  async getPricingSuggestions(merchantId?: number): Promise<any[]> {
    const cacheKey = merchantId ? `analytics:pricing:${merchantId}` : 'analytics:pricing:global';
    const cached = await cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;

    const productWhere: any = { status: { [Op.ne]: 'cancelled' } };
    if (merchantId) productWhere.merchant_id = merchantId;

    const products = await Product.findAll({
      where: productWhere,
      include: [
        { model: Auction, as: 'auction', include: [{ model: Bid, as: 'bids' }] },
      ],
      limit: 20,
    });

    const suggestions: any[] = [];

    for (const product of products) {
      const p = product as any;
      const auction = p.auction;
      if (!auction) continue;

      const bids = auction.bids || [];
      const bidCount = bids.length;
      const currentPrice = parseFloat(p.starting_price.toString());
      const increment = parseFloat(p.price_increment.toString());

      if (bidCount === 0) {
        const suggestedPrice = Math.round(currentPrice * 0.8 * 100) / 100;
        suggestions.push({
          productId: p.id,
          productName: p.name,
          currentStartingPrice: currentPrice,
          suggestedStartingPrice: suggestedPrice,
          currentIncrement: increment,
          suggestedIncrement: Math.max(increment, Math.round(currentPrice * 0.05 * 100) / 100),
          reason: '该商品竞拍无人出价，建议降低起拍价以吸引竞拍者',
          confidence: 75,
          historicalData: { avgBids: 0, avgFinalPrice: 0, completionRate: 0 },
        });
      } else if (bidCount < 3) {
        suggestions.push({
          productId: p.id,
          productName: p.name,
          currentStartingPrice: currentPrice,
          suggestedStartingPrice: currentPrice,
          currentIncrement: increment,
          suggestedIncrement: Math.max(increment * 0.8, 1),
          reason: '出价人数较少，建议降低加价幅度以提高参与度',
          confidence: 60,
          historicalData: {
            avgBids: bidCount,
            avgFinalPrice: bids.length > 0 ? parseFloat(bids[bids.length - 1].amount.toString()) : currentPrice,
            completionRate: 0.3,
          },
        });
      }
    }

    await cacheManager.set(cacheKey, suggestions, { strategy: 'dashboard' });
    return suggestions;
  }

  /**
   * 获取最热门品类
   */
  private async getTopCategory(merchantId?: number): Promise<string | null> {
    const categories = await this.getCategoryPerformance(merchantId);
    if (categories.length === 0) return null;
    return categories.sort((a, b) => b.totalRevenue - a.totalRevenue)[0].category;
  }
}

export const analyticsService = new AnalyticsService();
