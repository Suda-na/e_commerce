import { Sequelize } from 'sequelize';
import { config } from './index';
import { logger } from '../utils/logger';

// 创建Sequelize实例
export const sequelize = new Sequelize(
  config.database.database,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    logging: config.database.logging ? (msg) => logger.debug(msg) : false,
    pool: config.database.pool,
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    timezone: '+08:00',
  }
);

// 测试数据库连接
export const testConnection = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    return false;
  }
};

// 同步数据库模型
export const syncDatabase = async (force: boolean = false): Promise<void> => {
  try {
    // 禁用alter模式，避免索引累积导致超过MySQL的64个索引限制
    // 如果需要更新表结构，请手动运行SQL迁移脚本
    await sequelize.sync({ force, alter: false });
    logger.info(`Database synced successfully. Force: ${force}`);
  } catch (error) {
    logger.error('Failed to sync database:', error);
    throw error;
  }
};

// 关闭数据库连接
export const closeDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    logger.info('Database connection closed.');
  } catch (error) {
    logger.error('Failed to close database connection:', error);
    throw error;
  }
};

export default sequelize;