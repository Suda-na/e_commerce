import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type NotificationType =
  | 'new_order'
  | 'order_paid'
  | 'refund_request'
  | 'auction_ending_soon'
  | 'auction_ended'
  | 'auction_won'
  | 'outbid'
  | 'stock_warning'
  | 'system_announcement'
  | 'auction_cancelled';

export type NotificationPriority = 'high' | 'medium' | 'low';

export interface INotification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

interface NotificationCreationAttributes extends Optional<INotification, 'id' | 'link' | 'is_read' | 'metadata' | 'created_at' | 'updated_at'> {}

export class Notification extends Model<INotification, NotificationCreationAttributes> implements INotification {
  public id!: number;
  public user_id!: number;
  public type!: NotificationType;
  public title!: string;
  public message!: string;
  public priority!: NotificationPriority;
  public link!: string | null;
  public is_read!: boolean;
  public metadata!: Record<string, any> | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  static associate(models: any) {
    Notification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  }
}

Notification.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    type: {
      type: DataTypes.ENUM(
        'new_order',
        'order_paid',
        'refund_request',
        'auction_ending_soon',
        'auction_ended',
        'auction_won',
        'outbid',
        'stock_warning',
        'system_announcement',
        'auction_cancelled'
      ),
      allowNull: false,
    },
    title: { type: DataTypes.STRING(200), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    priority: {
      type: DataTypes.ENUM('high', 'medium', 'low'),
      allowNull: false,
      defaultValue: 'medium',
    },
    link: { type: DataTypes.STRING(500), allowNull: true },
    is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    metadata: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id', 'is_read'] },
      { fields: ['user_id', 'created_at'] },
      { fields: ['type'] },
    ],
  }
);

export default Notification;
