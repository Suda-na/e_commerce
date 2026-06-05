import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { IAuction, AuctionStatus } from '../types';

// 竞拍创建属性接口
interface AuctionCreationAttributes extends Optional<IAuction, 'id' | 'start_time' | 'end_time' | 'current_price' | 'winner_id' | 'status' | 'created_at' | 'updated_at'> {}

// 竞拍模型类
export class Auction extends Model<IAuction, AuctionCreationAttributes> implements IAuction {
  public id!: number;
  public product_id!: number;
  public start_time?: Date;
  public end_time?: Date;
  public current_price?: number;
  public winner_id?: number;
  public status!: AuctionStatus;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public readonly product?: any;
  public readonly winner?: any;
  public readonly bids?: any[];
  public readonly order?: any;

  // 关联方法
  static associate(models: any) {
    // 竞拍属于一个商品
    Auction.belongsTo(models.Product, {
      foreignKey: 'product_id',
      as: 'product',
    });

    // 竞拍有一个获胜者
    Auction.belongsTo(models.User, {
      foreignKey: 'winner_id',
      as: 'winner',
    });

    // 竞拍有多个出价
    Auction.hasMany(models.Bid, {
      foreignKey: 'auction_id',
      as: 'bids',
    });

    // 竞拍有一个订单
    Auction.hasOne(models.Order, {
      foreignKey: 'auction_id',
      as: 'order',
    });
  }
}

// 初始化竞拍模型
Auction.init(
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
    start_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    current_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    winner_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'completed', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false,
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
    modelName: 'Auction',
    tableName: 'auctions',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeValidate: (auction: Auction) => {
        // 验证结束时间必须大于开始时间
        if (auction.start_time && auction.end_time && auction.end_time <= auction.start_time) {
          throw new Error('结束时间必须大于开始时间');
        }
      },
    },
  }
);

export default Auction;