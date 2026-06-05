import { redisClient } from '../config/redis';
import { logger } from './logger';
import { parsePrice2 } from './price-utils';

/**
 * Redis Lua脚本工具类
 * 使用Lua脚本实现原子操作，确保数据一致性
 */
export class RedisLua {
  private readonly redis: typeof redisClient;

  constructor(redis: typeof redisClient) {
    this.redis = redis;
  }

  /**
   * 原子出价操作
   * 使用Lua脚本实现出价的原子性，包含以下操作：
   * 1. 验证竞拍状态
   * 2. 验证出价金额
   * 3. 检查封顶价
   * 4. 更新当前价格和获胜者
   * 5. 更新排行榜
   * 6. 检查是否需要延时
   * 7. 检查是否达到封顶价
   * 
   * @param auctionKey 竞拍缓存键
   * @param leaderboardKey 排行榜缓存键
   * @param userId 用户ID
   * @param amount 出价金额
   * @param priceIncrement 加价幅度
   * @param capPrice 封顶价（可选）
   * @param delayTime 延时时长（秒）
   * @param currentTime 当前时间戳（毫秒）
   * @returns 操作结果
   */
  async atomicBid(
    auctionKey: string,
    leaderboardKey: string,
    userId: number,
    amount: number,
    priceIncrement: number,
    capPrice: number | null,
    delayTime: number,
    currentTime: number
  ): Promise<{
    success: boolean;
    message: string;
    currentPrice: number;
    winnerId: number;
    endTime: number;
    isExtended: boolean;
    isCompleted: boolean;
    needsDelay: boolean;
  }> {
    // Lua脚本实现原子操作
    const script = `
      -- 从ARGV获取参数（Redis Lua中不能直接访问外部变量）
      local userId = tonumber(ARGV[1]) or 0
      local amount = tonumber(ARGV[2]) or 0
      local priceIncrement = tonumber(ARGV[3]) or 0.01
      local capPriceParam = tonumber(ARGV[4]) or 0
      local delayTimeParam = tonumber(ARGV[5]) or 10
      local currentTime = tonumber(ARGV[6]) or 0
      
      -- 参数有效性检查
      if userId <= 0 or amount <= 0 or currentTime <= 0 then
        return {0, '参数无效', 0, 0, 0, 0, 0, 0}
      end
      
      -- 获取竞拍信息
      local auctionData = redis.call('GET', KEYS[1])
      if not auctionData then
        return {0, '竞拍不存在', 0, 0, 0, 0, 0, 0}
      end
      
      local auction = cjson.decode(auctionData)
      local status = tostring(auction.status or 'unknown')
      local currentPrice = tonumber(auction.current_price) or 0
      local endTime = tonumber(auction.end_time) or 0
      local capPriceVal = tonumber(auction.cap_price) or 0
      local delayTimeVal = tonumber(auction.delay_time) or 10
      local priceIncrementVal = tonumber(auction.price_increment) or 0.01
      
      -- 验证竞拍状态
      if status ~= 'active' then
        return {0, '竞拍未在进行中', currentPrice, auction.winner_id or 0, endTime, 0, 0, 0}
      end
      
      -- 检查竞拍是否已结束（仅在endTime有效时检查）
      if endTime > 0 and currentTime > endTime then
        return {0, '竞拍已结束', currentPrice, auction.winner_id or 0, endTime, 0, 0, 0}
      end
      
      -- 验证出价金额
      local minBid = currentPrice + priceIncrementVal
      if amount < minBid then
        return {0, '出价金额必须大于等于 ' .. tostring(minBid), currentPrice, auction.winner_id or 0, endTime, 0, 0, 0}
      end
      
      -- 检查封顶价
      if capPriceVal > 0 and amount > capPriceVal then
        return {0, '出价金额不能超过封顶价 ' .. tostring(capPriceVal), currentPrice, auction.winner_id or 0, endTime, 0, 0, 0}
      end
      
      -- 检查是否达到封顶价
      local isCompleted = 0
      if capPriceVal > 0 and amount >= capPriceVal then
        isCompleted = 1
      end
      
      -- 检查是否需要延时（仅在endTime有效时检查）
      local isExtended = 0
      local newEndTime = endTime
      if endTime > 0 then
        local timeLeft = math.floor((endTime - currentTime) / 1000)
        if timeLeft <= delayTimeVal then
          -- 延长delayTime秒：在原结束时间上叠加延时时长
          newEndTime = endTime + (delayTimeVal * 1000)
          isExtended = 1
        end
      end
      
      -- 更新竞拍信息
      auction.current_price = amount
      auction.winner_id = userId
      auction.end_time = newEndTime
      
      if isCompleted == 1 then
        auction.status = 'completed'
      end
      
      -- 保存更新后的竞拍信息
      redis.call('SET', KEYS[1], cjson.encode(auction))
      
      -- 更新排行榜（使用ZADD实现幂等性）
      redis.call('ZADD', KEYS[2], amount, tostring(userId))
      
      -- 返回结果
      -- 注意：Redis 会将 Lua number 截断为整数，因此价格相关值必须以字符串返回以保留小数精度
      return {
        1, -- success
        isCompleted == 1 and '出价成功，已达到封顶价自动成交' or '出价成功',
        tostring(amount), -- 以字符串返回价格，避免 Redis 截断小数部分
        userId,
        newEndTime,
        isExtended,
        isCompleted,
        isExtended
      }
    `;

    try {
      const result = await this.redis.eval(
        script,
        2, // 2个KEY
        auctionKey,
        leaderboardKey,
        userId,
        amount,
        priceIncrement,
        capPrice || 0,
        delayTime,
        currentTime
      ) as number[];

      // 解析结果
      const success = result[0] === 1;
      const message = String(result[1]);
      // currentPrice 从 Lua 以字符串返回，需用 parsePrice2 解析以保留小数精度
      const currentPrice = parsePrice2(result[2]);
      const winnerId = Number(result[3]);
      const endTime = Number(result[4]);
      const isExtended = result[5] === 1;
      const isCompleted = result[6] === 1;
      const needsDelay = result[7] === 1;

      logger.debug(`Atomic bid result: success=${success}, message=${message}, currentPrice=${currentPrice}, winnerId=${winnerId}, endTime=${endTime}, isExtended=${isExtended}, isCompleted=${isCompleted}`);

      return {
        success,
        message,
        currentPrice,
        winnerId,
        endTime,
        isExtended,
        isCompleted,
        needsDelay,
      };
    } catch (error) {
      logger.error('Atomic bid failed:', error);
      throw error;
    }
  }

  /**
   * 原子更新竞拍状态
   * @param auctionKey 竞拍缓存键
   * @param newStatus 新状态
   * @param expectedStatus 预期状态
   * @returns 是否更新成功
   */
  async atomicUpdateAuctionStatus(
    auctionKey: string,
    newStatus: string,
    expectedStatus: string
  ): Promise<boolean> {
    const script = `
      local auctionData = redis.call('GET', KEYS[1])
      if not auctionData then
        return 0
      end
      
      local auction = cjson.decode(auctionData)
      if auction.status ~= ARGV[2] then
        return 0
      end
      
      auction.status = ARGV[1]
      redis.call('SET', KEYS[1], cjson.encode(auction))
      return 1
    `;

    try {
      const result = await this.redis.eval(script, 1, auctionKey, newStatus, expectedStatus);
      return result === 1;
    } catch (error) {
      logger.error('Atomic update auction status failed:', error);
      return false;
    }
  }

  /**
   * 原子获取竞拍排行榜
   * @param leaderboardKey 排行榜缓存键
   * @param limit 获取数量
   * @returns 排行榜数据
   */
  async atomicGetLeaderboard(
    leaderboardKey: string,
    limit: number = 10
  ): Promise<Array<{ userId: number; amount: number; rank: number }>> {
    const script = `
      local entries = redis.call('ZREVRANGE', KEYS[1], 0, ARGV[1] - 1, 'WITHSCORES')
      local result = {}
      local rank = 1
      
      for i = 1, #entries, 2 do
        -- 金额以字符串返回，避免 Redis 将 Lua number 截断为整数
        table.insert(result, {tonumber(entries[i]), entries[i + 1], rank})
        rank = rank + 1
      end
      
      return result
    `;

    try {
      const result = await this.redis.eval(script, 1, leaderboardKey, limit) as Array<[number, string, number]>;
      
      return result.map(([userId, amountStr, rank]) => ({
        userId,
        amount: parsePrice2(amountStr),
        rank,
      }));
    } catch (error) {
      logger.error('Atomic get leaderboard failed:', error);
      return [];
    }
  }

  /**
   * 原子检查出价幂等性
   * @param bidIdempotencyKey 幂等性键
   * @param requestId 请求ID
   * @param ttl 过期时间（秒）
   * @returns 是否重复出价
   */
  async atomicCheckIdempotency(
    bidIdempotencyKey: string,
    requestId: string,
    ttl: number = 300
  ): Promise<boolean> {
    const script = `
      local exists = redis.call('EXISTS', KEYS[1])
      if exists == 1 then
        return 0 -- 已存在，重复出价
      end
      
      redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
      return 1 -- 新出价
    `;

    try {
      const result = await this.redis.eval(script, 1, bidIdempotencyKey, requestId, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Atomic check idempotency failed:', error);
      return false;
    }
  }

  /**
   * 原子批量更新排行榜
   * @param leaderboardKey 排行榜缓存键
   * @param updates 更新数据数组
   * @returns 是否更新成功
   */
  async atomicBatchUpdateLeaderboard(
    leaderboardKey: string,
    updates: Array<{ userId: number; amount: number }>
  ): Promise<boolean> {
    if (updates.length === 0) {
      return true;
    }

    // 构建参数
    const args: (string | number)[] = [];
    for (const update of updates) {
      args.push(update.amount, update.userId.toString());
    }

    const script = `
      for i = 1, #ARGV, 2 do
        redis.call('ZADD', KEYS[1], ARGV[i], ARGV[i + 1])
      end
      return 1
    `;

    try {
      const result = await this.redis.eval(script, 1, leaderboardKey, ...args);
      return result === 1;
    } catch (error) {
      logger.error('Atomic batch update leaderboard failed:', error);
      return false;
    }
  }

  /**
   * 原子清理过期的幂等性键
   * @param pattern 键模式
   * @param batchSize 批量大小
   * @returns 清理的键数量
   */
  async atomicCleanupIdempotencyKeys(
    pattern: string,
    batchSize: number = 100
  ): Promise<number> {
    const script = `
      local keys = redis.call('KEYS', ARGV[1])
      local count = 0
      
      for i = 1, math.min(#keys, ARGV[2]) do
        local ttl = redis.call('TTL', keys[i])
        if ttl == -1 then -- 无过期时间
          redis.call('DEL', keys[i])
          count = count + 1
        end
      end
      
      return count
    `;

    try {
      const result = await this.redis.eval(script, 0, pattern, batchSize);
      return result as number;
    } catch (error) {
      logger.error('Atomic cleanup idempotency keys failed:', error);
      return 0;
    }
  }
}

// 创建Redis Lua脚本实例
export const redisLua = new RedisLua(redisClient);

export default redisLua;