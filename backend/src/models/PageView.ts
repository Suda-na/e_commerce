import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

// 页面浏览记录接口
interface IPageView {
  id: number;
  product_id: number;
  user_id: number | null;
  session_id: string;
  ip_address: string;
  user_agent: string;
  referrer: string | null;
  page_type: 'product' | 'auction' | 'live';
  created_at: Date;
}

// 创建属性接口（可选字段）
interface PageViewCreationAttributes extends Optional<IPageView, 'id' | 'user_id' | 'referrer' | 'created_at'> {}

// 页面浏览记录模型类
export class PageView extends Model<IPageView, PageViewCreationAttributes> implements IPageView {
  public id!: number;
  public product_id!: number;
  public user_id!: number | null;
  public session_id!: string;
  public ip_address!: string;
  public user_agent!: string;
  public referrer!: string | null;
  public page_type!: 'product' | 'auction' | 'live';
  public readonly created_at!: Date;

  // 关联方法
  static associate(models: any) {
    PageView.belongsTo(models.Product, {
      foreignKey: 'product_id',
      as: 'product',
    });

    PageView.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  }

  // 类方法：记录页面浏览
  static async recordView(data: {
    product_id: number;
    user_id?: number;
    session_id: string;
    ip_address: string;
    user_agent: string;
    referrer?: string;
    page_type?: 'product' | 'auction' | 'live';
  }): Promise<PageView> {
    return await PageView.create({
      product_id: data.product_id,
      user_id: data.user_id || null,
      session_id: data.session_id,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      referrer: data.referrer || null,
      page_type: data.page_type || 'product',
    });
  }

  // 类方法：获取商品浏览量
  static async getProductViews(productId: number): Promise<number> {
    return await PageView.count({
      where: { product_id: productId },
    });
  }

  // 类方法：批量获取商品浏览量
  static async getProductsViews(productIds: number[]): Promise<Map<number, number>> {
    const results = await PageView.findAll({
      attributes: [
        'product_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'views'],
      ],
      where: {
        product_id: productIds,
      },
      group: ['product_id'],
      raw: true,
    }) as any[];

    const viewsMap = new Map<number, number>();
    results.forEach((result: any) => {
      viewsMap.set(result.product_id, parseInt(result.views));
    });

    // 确保所有商品都有值（没有浏览记录的为0）
    productIds.forEach(id => {
      if (!viewsMap.has(id)) {
        viewsMap.set(id, 0);
      }
    });

    return viewsMap;
  }

  // 类方法：获取24小时流量统计
  static async getHourlyTraffic(merchantId?: number): Promise<Array<{ hour: number; views: number }>> {
    const whereClause: any = {};
    const includeClause: any[] = [];

    if (merchantId) {
      includeClause.push({
        model: sequelize.models.Product,
        as: 'product',
        attributes: [],
        where: { merchant_id: merchantId },
      });
    }

    const results = await PageView.findAll({
      attributes: [
        [sequelize.fn('HOUR', sequelize.col('PageView.created_at')), 'hour'],
        [sequelize.fn('COUNT', sequelize.col('PageView.id')), 'views'],
      ],
      where: whereClause,
      include: includeClause,
      group: [sequelize.fn('HOUR', sequelize.col('PageView.created_at'))],
      raw: true,
    }) as any[];

    // 转换为24小时格式
    const hourlyMap = new Map<number, number>();
    results.forEach((result: any) => {
      hourlyMap.set(parseInt(result.hour), parseInt(result.views));
    });

    const hourlyTraffic: Array<{ hour: number; views: number }> = [];
    for (let h = 0; h < 24; h++) {
      hourlyTraffic.push({
        hour: h,
        views: hourlyMap.get(h) || 0,
      });
    }

    return hourlyTraffic;
  }

  // 类方法：获取商品浏览量趋势（最近N天）
  static async getViewsTrend(productId: number, days: number = 7): Promise<Array<{ date: string; views: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await PageView.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'views'],
      ],
      where: {
        product_id: productId,
        created_at: {
          [Op.gte]: startDate,
        },
      },
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
      raw: true,
    }) as any[];

    return results.map((result: any) => ({
      date: result.date,
      views: parseInt(result.views),
    }));
  }
}

// 初始化页面浏览记录模型
PageView.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    session_id: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    referrer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    page_type: {
      type: DataTypes.ENUM('product', 'auction', 'live'),
      defaultValue: 'product',
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PageView',
    tableName: 'page_views',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        name: 'idx_page_views_product_id',
        fields: ['product_id'],
      },
      {
        name: 'idx_page_views_user_id',
        fields: ['user_id'],
      },
      {
        name: 'idx_page_views_created_at',
        fields: ['created_at'],
      },
      {
        name: 'idx_page_views_product_created',
        fields: ['product_id', 'created_at'],
      },
    ],
  }
);

export default PageView;