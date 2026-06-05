import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface IFavorite {
  id: number;
  user_id: number;
  merchant_id: number;
  created_at: Date;
  updated_at: Date;
}

interface FavoriteCreationAttributes extends Optional<IFavorite, 'id' | 'created_at' | 'updated_at'> {}

export class Favorite extends Model<IFavorite, FavoriteCreationAttributes> implements IFavorite {
  public id!: number;
  public user_id!: number;
  public merchant_id!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  static associate(models: any) {
    Favorite.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Favorite.belongsTo(models.User, { foreignKey: 'merchant_id', as: 'merchant' });
  }
}

Favorite.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    merchant_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'Favorite',
    tableName: 'favorites',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id', 'merchant_id'], unique: true },
      { fields: ['user_id'] },
      { fields: ['merchant_id'] },
    ],
  }
);

export default Favorite;
