/**
 * 数据迁移脚本：修复竞拍系统历史价格精度问题
 *
 * 问题：由于 Redis Lua 脚本返回数值时 Redis 会截断小数部分，
 * 导致 auctions.current_price 和 orders.amount 可能只存储了整数部分。
 *
 * 修复策略：
 * 1. 对每个竞拍，从 bids 表查找最高出价，修正 auctions.current_price
 * 2. 对每个订单，从对应竞拍的最高出价修正 orders.amount
 * 3. 输出修复报告
 *
 * 用法：npx ts-node scripts/migrate-fix-price-precision.ts
 */

import { sequelize } from '../src/config/database';
import { logger } from '../src/utils/logger';
import { QueryInterface } from 'sequelize';

interface AuctionRow {
  id: number;
  current_price: string;
  winner_id: number | null;
}

interface BidRow {
  auction_id: number;
  max_amount: string;
}

interface OrderRow {
  id: number;
  auction_id: number;
  amount: string;
}

interface FixRecord {
  auction_id: number;
  old_price: string;
  new_price: string;
  source: 'bid_max' | 'already_correct';
}

async function migrateFixPricePrecision(): Promise<void> {
  const qi: QueryInterface = sequelize.getQueryInterface();
  const fixRecords: FixRecord[] = [];

  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功，开始价格精度迁移...');

    // 1. 获取所有竞拍的当前价格
    const auctions = await sequelize.query<AuctionRow>(
      `SELECT id, current_price, winner_id FROM auctions WHERE current_price IS NOT NULL`,
      { type: 'SELECT' }
    );

    logger.info(`找到 ${auctions.length} 条竞拍记录需要检查`);

    // 2. 获取每个竞拍的最高出价
    const bidMaxAmounts = await sequelize.query<BidRow>(
      `SELECT auction_id, MAX(amount) AS max_amount FROM bids GROUP BY auction_id`,
      { type: 'SELECT' }
    );

    const bidMaxMap = new Map<number, string>();
    for (const row of bidMaxAmounts) {
      bidMaxMap.set(row.auction_id, row.max_amount);
    }

    // 3. 逐个检查并修复
    for (const auction of auctions) {
      const currentPrice = parseFloat(auction.current_price);
      const bidMaxAmount = bidMaxMap.get(auction.id);

      if (!bidMaxAmount) {
        // 没有出价记录，无法修正，跳过
        continue;
      }

      const maxBidPrice = parseFloat(bidMaxAmount);

      // 如果当前价格与最高出价不一致（差值大于0.001），说明可能被截断
      if (Math.abs(currentPrice - maxBidPrice) > 0.001) {
        // 修正 auctions.current_price
        await qi.sequelize.query(
          `UPDATE auctions SET current_price = :maxPrice WHERE id = :auctionId`,
          {
            replacements: { maxPrice: bidMaxAmount, auctionId: auction.id },
          }
        );

        fixRecords.push({
          auction_id: auction.id,
          old_price: auction.current_price,
          new_price: bidMaxAmount,
          source: 'bid_max',
        });

        logger.info(
          `竞拍 #${auction.id}: 价格从 ${auction.current_price} 修正为 ${bidMaxAmount}`
        );

        // 4. 同时修正关联订单的金额
        if (auction.winner_id) {
          await qi.sequelize.query(
            `UPDATE orders SET amount = :maxPrice WHERE auction_id = :auctionId`,
            {
              replacements: { maxPrice: bidMaxAmount, auctionId: auction.id },
            }
          );
          logger.info(
            `竞拍 #${auction.id}: 关联订单金额已修正为 ${bidMaxAmount}`
          );
        }
      }
    }

    // 5. 输出修复报告
    const fixedCount = fixRecords.filter((r) => r.source === 'bid_max').length;
    logger.info(`\n===== 价格精度迁移报告 =====`);
    logger.info(`检查竞拍数: ${auctions.length}`);
    logger.info(`修复竞拍数: ${fixedCount}`);

    if (fixedCount > 0) {
      logger.info(`\n修复详情:`);
      for (const record of fixRecords) {
        if (record.source === 'bid_max') {
          logger.info(
            `  竞拍 #${record.auction_id}: ${record.old_price} -> ${record.new_price}`
          );
        }
      }
    } else {
      logger.info(`无需修复的数据`);
    }

    logger.info(`\n迁移完成!`);
  } catch (error) {
    logger.error('价格精度迁移失败:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// 执行迁移
migrateFixPricePrecision()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
