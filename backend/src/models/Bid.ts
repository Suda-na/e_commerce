import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { IBid } from '../types';

// 出价创建属性接口
interface BidCreationAttributes extends Optional<IBid, 'id' | 'created_at' | 'updated_at'> {}

// 出价模型类
export class Bid extends Model<IBid, BidCreationAttributes> implements IBid {
  public id!: number;
  public auction_id!: number;
  public user_id!: number;
  public amount!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public readonly auction?: any;
  public readonly user?: any;

  // 关联方法
  static associate(models: any) {
    // 出价属于一个竞拍
    Bid.belongsTo(models.Auction, {
      foreignKey: 'auction_id',
      as: 'auction',
    });

    // 出价属于一个用户
    Bid.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  }
}

// 初始化出价模型
Bid.init(
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
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
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
    modelName: 'Bid',
    tableName: 'bids',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Bid;