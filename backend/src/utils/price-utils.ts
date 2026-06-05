/**
 * 价格工具函数
 * 统一处理价格的小数位精度，避免浮点数精度问题
 */

/**
 * 将价格四舍五入到小数点后两位
 * @param price 价格值
 * @returns 保留两位小数的价格
 */
export function roundPrice2(price: number): number {
  return Math.round(price * 100) / 100;
}

/**
 * 将价格四舍五入到小数点后两位（字符串输入）
 * @param value 可能是字符串或数字的值
 * @returns 保留两位小数的价格数字
 */
export function parsePrice2(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : roundPrice2(num);
}
