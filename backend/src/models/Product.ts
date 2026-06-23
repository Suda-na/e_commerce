import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { IProduct, ProductStatus } from '../types';

// 商品创建属性接口
interface ProductCreationAttributes extends Optional<IProduct, 'id' | 'description' | 'images' | 'cap_price' | 'delay_time' | 'status' | 'category_id' | 'tags' | 'stock' | 'stock_warning' | 'sku' | 'weight' | 'shipping_template_id' | 'specifications' | 'created_at' | 'updated_at'> {}

// 商品模型类
export class Product extends Model<IProduct, ProductCreationAttributes> implements IProduct {
  public id!: number;
  public merchant_id!: number;
  public name!: string;
  public description?: string;
  public images?: string[];
  public starting_price!: number;
  public price_increment!: number;
  public duration!: number;
  public cap_price?: number;
  public delay_time!: number;
  public status!: ProductStatus;
  public category_id!: number | null;
  public tags!: string[];
  public stock!: number;
  public stock_warning!: number;
  public sku?: string;
  public weight?: number;
  public shipping_template_id?: number;
  public specifications?: Record<string, string>;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public readonly merchant?: any;
  public readonly auction?: any;

  // 关联方法
  static associate(models: any) {
    Product.belongsTo(models.Category, {
      foreignKey: 'category_id',
      as: 'category',
    });

    Product.belongsTo(models.User, {
      foreignKey: 'merchant_id',
      as: 'merchant',
    });

    // 商品有一个竞拍
    Product.hasOne(models.Auction, {
      foreignKey: 'product_id',
      as: 'auction',
    });

    Product.belongsTo(models.ShippingTemplate, {
      foreignKey: 'shipping_template_id',
      as: 'shipping_template',
    });
  }
}

// 初始化商品模型
Product.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true,
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    starting_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    price_increment: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    cap_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0.01,
      },
    },
    delay_time: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      allowNull: false,
      validate: {
        min: 10,
        max: 30,
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'completed', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
      onUpdate: 'SET NULL',
      onDelete: 'SET NULL',
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 0,
      },
    },
    stock_warning: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      validate: {
        min: 0,
      },
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      validate: {
        len: [0, 50],
      },
    },
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    shipping_template_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'shipping_templates',
        key: 'id',
      },
      onUpdate: 'SET NULL',
      onDelete: 'SET NULL',
    },
    specifications: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
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
    modelName: 'Product',
    tableName: 'products',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeValidate: (product: Product) => {
        // 验证封顶价必须大于起拍价
        if (product.cap_price && product.cap_price <= product.starting_price) {
          throw new Error('封顶价必须大于起拍价');
        }
      },
    },
  }
);

export default Product;