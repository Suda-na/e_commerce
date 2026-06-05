import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { IOrder, OrderStatus } from '../types';

// 订单创建属性接口
interface OrderCreationAttributes extends Optional<IOrder, 'id' | 'status' | 'created_at' | 'updated_at'> {}

// 订单模型类
export class Order extends Model<IOrder, OrderCreationAttributes> implements IOrder {
  public id!: number;
  public auction_id!: number;
  public user_id!: number;
  public merchant_id!: number;
  public amount!: number;
  public status!: OrderStatus;
  public tracking_number?: string;
  public shipping_company?: string;
  public shipping_address?: string;
  public receiver_name?: string;
  public receiver_phone?: string;
  public remark?: string;
  public merchant_remark?: string;
  public refund_reason?: string;
  public refund_rejected_reason?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public readonly auction?: any;
  public readonly user?: any;
  public readonly merchant?: any;

  // 关联方法
  static associate(models: any) {
    // 订单属于一个竞拍
    Order.belongsTo(models.Auction, {
      foreignKey: 'auction_id',
      as: 'auction',
    });

    // 订单属于一个用户（买家）
    Order.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    // 订单属于一个商家
    Order.belongsTo(models.User, {
      foreignKey: 'merchant_id',
      as: 'merchant',
    });
  }
}

// 初始化订单模型
Order.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    auction_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'auctions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    merchant_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'shipped', 'refunding', 'refunded', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false,
      validate: {
        isIn: [['pending', 'paid', 'shipped', 'refunding', 'refunded', 'cancelled']],
      },
    },
    tracking_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    shipping_company: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    shipping_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    receiver_name: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    receiver_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    remark: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    merchant_remark: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refund_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refund_rejected_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Order;