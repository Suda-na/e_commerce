import { sequelize } from '../config/database';
import User from './User';
import Product from './Product';
import Auction from './Auction';
import Bid from './Bid';
import Order from './Order';
import Category from './Category';
import ShippingTemplate from './ShippingTemplate';
import ShippingRule from './ShippingRule';
import Notification from './Notification';
import PageView from './PageView';
import Favorite from './Favorite';
import { logger } from '../utils/logger';

const models = {
  User,
  Product,
  Auction,
  Bid,
  Order,
  Category,
  ShippingTemplate,
  ShippingRule,
  Notification,
  PageView,
  Favorite,
};

// 建立模型关联
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

// 同步数据库
export const syncModels = async (force: boolean = false): Promise<void> => {
  try {
    // 禁用alter模式，避免索引累积导致超过MySQL的64个索引限制
    // 如果需要更新表结构，请手动运行SQL迁移脚本
    await sequelize.sync({ force, alter: false });
    logger.info(`Database models synced successfully. Force: ${force}`);
  } catch (error) {
    logger.error('Failed to sync database models:', error);
    throw error;
  }
};

export {
  User,
  Product,
  Auction,
  Bid,
  Order,
  Category,
  ShippingTemplate,
  ShippingRule,
  Notification,
  PageView,
  Favorite,
};

// 导出sequelize实例
export { sequelize };

export default models;