import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ICategory {
  id: number;
  merchant_id: number;
  name: string;
  icon: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface CategoryCreationAttributes extends Optional<ICategory, 'id' | 'icon' | 'sort_order' | 'created_at' | 'updated_at'> {}

export class Category extends Model<ICategory, CategoryCreationAttributes> implements ICategory {
  public id!: number;
  public merchant_id!: number;
  public name!: string;
  public icon!: string | null;
  public sort_order!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  static associate(models: any) {
    Category.hasMany(models.Product, {
      foreignKey: 'category_id',
      as: 'products',
    });

    Category.belongsTo(models.User, {
      foreignKey: 'merchant_id',
      as: 'merchant',
    });
  }
}

Category.init(
  {
    id: {
      type: DataTypes.INTEGER,
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
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
    modelName: 'Category',
    tableName: 'categories',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['merchant_id', 'name'],
      },
    ],
  }
);

export default Category;
