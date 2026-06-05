import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { IUser, UserRole } from '../types';

// 用户创建属性接口
interface UserCreationAttributes extends Optional<IUser, 'id' | 'avatar' | 'email' | 'phone' | 'status' | 'login_count' | 'receiver_name' | 'receiver_phone' | 'province' | 'city' | 'district' | 'detail_address' | 'created_at' | 'updated_at'> {}

// 用户模型类
export class User extends Model<IUser, UserCreationAttributes> implements IUser {
  public id!: number;
  public username!: string;
  public password!: string;
  public role!: UserRole;
  public avatar?: string | null;
  public email?: string | null;
  public phone?: string | null;
  public status!: number;
  public login_count!: number;
  public receiver_name?: string | null;
  public receiver_phone?: string | null;
  public province?: string | null;
  public city?: string | null;
  public district?: string | null;
  public detail_address?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // 关联方法
  static associate(models: any) {
    // 用户拥有多个商品
    User.hasMany(models.Product, {
      foreignKey: 'merchant_id',
      as: 'products',
    });

    // 用户拥有多个出价
    User.hasMany(models.Bid, {
      foreignKey: 'user_id',
      as: 'bids',
    });

    // 用户拥有多个订单
    User.hasMany(models.Order, {
      foreignKey: 'user_id',
      as: 'orders',
    });

    // 用户赢得多个竞拍
    User.hasMany(models.Auction, {
      foreignKey: 'winner_id',
      as: 'wonAuctions',
    });
  }
}

// 初始化用户模型
User.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [5, 50],
        notEmpty: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    role: {
      type: DataTypes.ENUM('merchant', 'user'),
      defaultValue: 'user',
      allowNull: false,
    },
    avatar: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrlOrNull(value: string | null | undefined) {
          if (value != null && value !== '') {
            try {
              new URL(value);
            } catch {
              throw new Error('头像必须是有效的URL');
            }
          }
        },
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    status: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
    },
    login_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    receiver_name: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    receiver_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    province: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    detail_address: {
      type: DataTypes.STRING(255),
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
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default User;