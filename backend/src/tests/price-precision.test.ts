/**
 * 价格精度处理单元测试
 *
 * 覆盖场景：
 * 1. 整数价格（如 18.00）
 * 2. 一位小数价格（如 18.2）
 * 3. 两位小数价格（如 19.20）
 * 4. 边界值（0.01, 99999999.99）
 * 5. 加价计算精度（在当前价格基础上加价）
 * 6. parsePrice2 对各种输入的处理
 */

import { roundPrice2, parsePrice2 } from '../src/utils/price-utils';

describe('Price Utils - 价格精度工具函数', () => {
  describe('roundPrice2 - 四舍五入到两位小数', () => {
    // 整数价格
    test('整数价格应保持不变 (18.00)', () => {
      expect(roundPrice2(18)).toBe(18);
      expect(roundPrice2(18.0)).toBe(18);
    });

    // 一位小数价格
    test('一位小数价格应保留小数部分 (18.2)', () => {
      expect(roundPrice2(18.2)).toBe(18.2);
    });

    // 两位小数价格
    test('两位小数价格应保持不变 (19.20)', () => {
      expect(roundPrice2(19.2)).toBe(19.2);
      expect(roundPrice2(19.29)).toBe(19.29);
    });

    // 超过两位小数的截断
    test('超过两位小数应四舍五入 (18.256 -> 18.26)', () => {
      expect(roundPrice2(18.256)).toBe(18.26);
      expect(roundPrice2(18.254)).toBe(18.25);
    });

    // 浮点数精度问题
    test('浮点数精度问题应正确处理 (0.1 + 0.2 = 0.3)', () => {
      expect(roundPrice2(0.1 + 0.2)).toBe(0.3);
    });

    test('浮点数精度问题应正确处理 (18.2 + 1.2 = 19.4)', () => {
      const currentPrice = 18.2;
      const increment = 1.2;
      expect(roundPrice2(currentPrice + increment)).toBe(19.4);
    });

    // 边界值
    test('最小边界值 (0.01)', () => {
      expect(roundPrice2(0.01)).toBe(0.01);
      expect(roundPrice2(0.001)).toBe(0); // 小于0.005四舍五入为0
    });

    test('最大边界值 (99999999.99)', () => {
      expect(roundPrice2(99999999.99)).toBe(99999999.99);
      expect(roundPrice2(99999999.995)).toBe(100000000); // 进位
    });
  });

  describe('parsePrice2 - 解析并标准化价格', () => {
    // 数字输入
    test('数字输入应正确解析', () => {
      expect(parsePrice2(18.2)).toBe(18.2);
      expect(parsePrice2(19)).toBe(19);
      expect(parsePrice2(0)).toBe(0);
    });

    // 字符串输入
    test('字符串输入应正确解析', () => {
      expect(parsePrice2('18.2')).toBe(18.2);
      expect(parsePrice2('19')).toBe(19);
      expect(parsePrice2('0.01')).toBe(0.01);
      expect(parsePrice2('99999999.99')).toBe(99999999.99);
    });

    // null/undefined 输入
    test('null/undefined 应返回 0', () => {
      expect(parsePrice2(null)).toBe(0);
      expect(parsePrice2(undefined)).toBe(0);
    });

    // 无效输入
    test('无效字符串应返回 0', () => {
      expect(parsePrice2('abc')).toBe(0);
      expect(parsePrice2('')).toBe(0);
      expect(parsePrice2(NaN)).toBe(0);
    });

    // Redis Lua 返回的字符串（模拟场景）
    test('Redis Lua 返回的字符串价格应正确解析', () => {
      // 模拟 Redis Lua tostring() 返回的字符串
      expect(parsePrice2('18.2')).toBe(18.2);
      expect(parsePrice2('19.4')).toBe(19.4);
      expect(parsePrice2('100.55')).toBe(100.55);
    });
  });

  describe('加价计算场景 - 模拟真实竞拍流程', () => {
    // 场景1: 用户出价18.2元，加价幅度1.2元，下一出价应为19.4元
    test('18.2元基础上加价1.2元应为19.4元', () => {
      const currentPrice = 18.2;
      const priceIncrement = 1.2;
      const minBid = roundPrice2(currentPrice + priceIncrement);
      expect(minBid).toBe(19.4);

      // 用户按最低出价
      const userBid = minBid;
      expect(userBid).toBe(19.4);
    });

    // 场景2: 从整数开始，加一位小数的幅度
    test('10.00元基础上加价0.5元应为10.50元', () => {
      const currentPrice = 10;
      const priceIncrement = 0.5;
      const minBid = roundPrice2(currentPrice + priceIncrement);
      expect(minBid).toBe(10.5);
    });

    // 场景3: 连续多次加价
    test('连续加价应保持精度', () => {
      let price = 17; // 起拍价

      // 第一次出价: 17 + 1.2 = 18.2
      price = roundPrice2(price + 1.2);
      expect(price).toBe(18.2);

      // 第二次出价: 18.2 + 1.2 = 19.4
      price = roundPrice2(price + 1.2);
      expect(price).toBe(19.4);

      // 第三次出价: 19.4 + 1.2 = 20.6
      price = roundPrice2(price + 1.2);
      expect(price).toBe(20.6);
    });

    // 场景4: 不同加价幅度的精度
    test('不同加价幅度应保持精度', () => {
      const basePrice = 15;

      // 加价幅度 0.1
      expect(roundPrice2(basePrice + 0.1)).toBe(15.1);

      // 加价幅度 0.05
      expect(roundPrice2(basePrice + 0.05)).toBe(15.05);

      // 加价幅度 1.23
      expect(roundPrice2(basePrice + 1.23)).toBe(16.23);

      // 加价幅度 9.99
      expect(roundPrice2(basePrice + 9.99)).toBe(24.99);
    });

    // 场景5: 封顶价检查精度
    test('封顶价比较应考虑精度', () => {
      const capPrice = 100.5;
      const bid1 = 100.49; // 未达到封顶价
      const bid2 = 100.5;  // 达到封顶价
      const bid3 = 100.51; // 超过封顶价（不应允许）

      expect(bid1 < capPrice).toBe(true);
      expect(bid2 >= capPrice).toBe(true);
      expect(roundPrice2(bid3) <= capPrice).toBe(false);
    });
  });
});
