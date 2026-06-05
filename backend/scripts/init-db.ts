import { sequelize } from '../src/config/database';
import { testRedisConnection, closeRedis } from '../src/config/redis';
import { syncModels } from '../src/models';
import { logger } from '../src/utils/logger';
import { config, validateConfig } from '../src/config';

// 数据库初始化脚本
async function initDatabase() {
  try {
    logger.info('Starting database initialization...');
    
    // 验证配置
    validateConfig();
    
    // 测试数据库连接
    logger.info('Testing database connection...');
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');
    
    // 测试Redis连接
    logger.info('Testing Redis connection...');
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      logger.warn('Redis connection failed. Some features may not work properly.');
    } else {
      logger.info('Redis connection established successfully.');
    }
    
    // 同步数据库模型
    logger.info('Syncing database models...');
    const force = process.argv.includes('--force');
    
    if (force) {
      logger.warn('WARNING: --force flag detected. This will drop all tables!');
    }
    
    await syncModels(force);
    logger.info('Database models synced successfully.');
    
    // 创建默认管理员账户（如果不存在）
    await createDefaultAdmin();
    
    logger.info('Database initialization completed successfully.');
    
    // 关闭连接
    await sequelize.close();
    await closeRedis();
    logger.info('Database and Redis connections closed.');
    
    process.exit(0);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// 创建默认管理员账户
async function createDefaultAdmin() {
  try {
    const { User } = await import('../src/models');
    const bcrypt = await import('bcryptjs');
    
    const adminUsername = 'admin';
    const adminPassword = 'admin123';
    
    // 检查管理员是否已存在
    const existingAdmin = await User.findOne({
      where: { username: adminUsername },
    });
    
    if (existingAdmin) {
      logger.info('Default admin user already exists.');
      return;
    }
    
    // 创建管理员账户
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    
    await User.create({
      username: adminUsername,
      password: hashedPassword,
      role: 'merchant',
    });
    
    logger.info('Default admin user created successfully.');
    logger.info(`Username: ${adminUsername}`);
    logger.info(`Password: ${adminPassword}`);
    logger.warn('Please change the default password after first login!');
  } catch (error) {
    logger.error('Failed to create default admin user:', error);
    throw error;
  }
}

// 运行初始化
initDatabase();