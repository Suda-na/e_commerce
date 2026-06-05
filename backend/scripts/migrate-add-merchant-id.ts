import { sequelize } from '../src/config/database';
import { logger } from '../src/utils/logger';

/**
 * 迁移脚本：为 orders 表添加 merchant_id 字段并回填数据
 *
 * 用法：npx ts-node scripts/migrate-add-merchant-id.ts
 */
async function migrate() {
  try {
    logger.info('Starting migration: add merchant_id to orders table...');

    await sequelize.authenticate();
    logger.info('Database connection established.');

    // 1. 添加 merchant_id 列（如果不存在）
    const [columns] = await sequelize.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'merchant_id'"
    );

    if ((columns as any[]).length === 0) {
      logger.info('Adding merchant_id column to orders table...');
      await sequelize.query(`
        ALTER TABLE orders
        ADD COLUMN merchant_id BIGINT NULL,
        ADD CONSTRAINT fk_orders_merchant
          FOREIGN KEY (merchant_id) REFERENCES users(id)
          ON UPDATE CASCADE ON DELETE CASCADE
      `);
      logger.info('merchant_id column added successfully.');
    } else {
      logger.info('merchant_id column already exists, skipping ALTER TABLE.');
    }

    // 2. 回填已有订单的 merchant_id（通过 auctions -> products 关联）
    logger.info('Backfilling merchant_id for existing orders...');
    const [result] = await sequelize.query(`
      UPDATE orders o
      INNER JOIN auctions a ON o.auction_id = a.id
      INNER JOIN products p ON a.product_id = p.id
      SET o.merchant_id = p.merchant_id
      WHERE o.merchant_id IS NULL
    `);
    logger.info(`Backfill completed. Affected rows: ${(result as any).affectedRows || 'unknown'}`);

    // 3. 检查是否还有未回填的记录
    const [remaining] = await sequelize.query(
      "SELECT COUNT(*) as count FROM orders WHERE merchant_id IS NULL"
    );
    const nullCount = (remaining as any[])[0]?.count || 0;

    if (nullCount > 0) {
      logger.warn(`There are still ${nullCount} orders with NULL merchant_id. These may be orphaned records.`);
    } else {
      logger.info('All orders have been backfilled with merchant_id.');
    }

    // 4. 将 merchant_id 设为 NOT NULL（所有记录已回填）
    logger.info('Setting merchant_id to NOT NULL...');
    await sequelize.query(`
      ALTER TABLE orders
      MODIFY COLUMN merchant_id BIGINT NOT NULL
    `);
    logger.info('merchant_id set to NOT NULL successfully.');

    // 5. 添加索引以提高查询性能
    logger.info('Adding index on merchant_id...');
    await sequelize.query(`
      CREATE INDEX idx_orders_merchant_id ON orders (merchant_id)
    `);
    logger.info('Index created successfully.');

    logger.info('Migration completed successfully!');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
