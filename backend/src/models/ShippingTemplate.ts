import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { IShippingTemplate } from '../types';

interface ShippingTemplateCreationAttributes extends Optional<IShippingTemplate, 'id' | 'rules' | 'created_at' | 'updated_at'> {}

export class ShippingTemplate extends Model<IShippingTemplate, ShippingTemplateCreationAttributes> implements IShippingTemplate {
  public id!: number;
  public merchant_id!: number;
  public name!: string;
  public readonly rules?: any[];
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  static associate(models: any) {
    ShippingTemplate.hasMany(models.ShippingRule, {
      foreignKey: 'template_id',
      as: 'rules',
      onDelete: 'CASCADE',
    });

    ShippingTemplate.belongsTo(models.User, {
      foreignKey: 'merchant_id',
      as: 'merchant',
    });
  }
}

ShippingTemplate.init(
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
        len: [1, 100],
        notEmpty: true,
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
    modelName: 'ShippingTemplate',
    tableName: 'shipping_templates',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default ShippingTemplate;
