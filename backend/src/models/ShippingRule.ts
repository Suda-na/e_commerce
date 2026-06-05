import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { IShippingRule } from '../types';

interface ShippingRuleCreationAttributes extends Optional<IShippingRule, 'id' | 'free_threshold' | 'created_at' | 'updated_at'> {}

export class ShippingRule extends Model<IShippingRule, ShippingRuleCreationAttributes> implements IShippingRule {
  public id!: number;
  public template_id!: number;
  public regions!: string[];
  public first_item_fee!: number;
  public additional_item_fee!: number;
  public free_threshold?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  static associate(models: any) {
    ShippingRule.belongsTo(models.ShippingTemplate, {
      foreignKey: 'template_id',
      as: 'template',
      onDelete: 'CASCADE',
    });
  }
}

ShippingRule.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    template_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'shipping_templates',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    regions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidRegions(value: string[]) {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error('配送区域不能为空');
          }
        },
      },
    },
    first_item_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    additional_item_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    free_threshold: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0,
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
    modelName: 'ShippingRule',
    tableName: 'shipping_rules',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default ShippingRule;
