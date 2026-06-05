import ExcelJS from 'exceljs';
import { parse } from 'json2csv';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { Auction } from '../models/Auction';
import { Bid } from '../models/Bid';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { ValidationError, AuthorizationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';

export type ExportType = 'products' | 'orders' | 'buyers' | 'bids';
export type ExportFormat = 'csv' | 'excel';

export interface ExportQuery {
  type: ExportType;
  format: ExportFormat;
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
  categoryId?: string;
}

interface ProductExportRow {
  id: number;
  name: string;
  category: string;
  starting_price: number;
  cap_price: number | null;
  stock: number;
  status: string;
  sku: string | null;
  tags: string;
  created_at: Date;
}

interface OrderExportRow {
  id: number;
  product_name: string;
  buyer_username: string;
  amount: number;
  status: string;
  tracking_number: string | null;
  shipping_company: string | null;
  shipping_address: string | null;
  created_at: Date;
  paid_at: Date | null;
}

interface BuyerExportRow {
  id: number;
  username: string;
  email: string | null;
  phone: string | null;
  order_count: number;
  total_amount: number;
  last_order_date: Date | null;
}

interface BidExportRow {
  id: number;
  auction_id: number;
  product_name: string;
  bidder_username: string;
  amount: number;
  created_at: Date;
}

const PRODUCT_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: '商品ID', key: 'id', width: 10 },
  { header: '商品名称', key: 'name', width: 30 },
  { header: '分类', key: 'category', width: 15 },
  { header: '起拍价', key: 'starting_price', width: 12 },
  { header: '封顶价', key: 'cap_price', width: 12 },
  { header: '库存', key: 'stock', width: 8 },
  { header: '状态', key: 'status', width: 12 },
  { header: 'SKU', key: 'sku', width: 15 },
  { header: '标签', key: 'tags', width: 20 },
  { header: '创建时间', key: 'created_at', width: 20 },
];

const ORDER_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: '订单ID', key: 'id', width: 10 },
  { header: '商品名称', key: 'product_name', width: 30 },
  { header: '买家', key: 'buyer_username', width: 15 },
  { header: '金额', key: 'amount', width: 12 },
  { header: '状态', key: 'status', width: 12 },
  { header: '快递单号', key: 'tracking_number', width: 20 },
  { header: '物流公司', key: 'shipping_company', width: 15 },
  { header: '收货地址', key: 'shipping_address', width: 30 },
  { header: '创建时间', key: 'created_at', width: 20 },
  { header: '支付时间', key: 'paid_at', width: 20 },
];

const BUYER_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: '用户ID', key: 'id', width: 10 },
  { header: '用户名', key: 'username', width: 15 },
  { header: '邮箱', key: 'email', width: 25 },
  { header: '手机号', key: 'phone', width: 15 },
  { header: '订单数', key: 'order_count', width: 10 },
  { header: '总消费金额', key: 'total_amount', width: 12 },
  { header: '最近下单时间', key: 'last_order_date', width: 20 },
];

const BID_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: '出价ID', key: 'id', width: 10 },
  { header: '竞拍ID', key: 'auction_id', width: 10 },
  { header: '商品名称', key: 'product_name', width: 30 },
  { header: '出价人', key: 'bidder_username', width: 15 },
  { header: '出价金额', key: 'amount', width: 12 },
  { header: '出价时间', key: 'created_at', width: 20 },
];

const STATUS_MAP: Record<string, string> = {
  pending: '待上架',
  active: '竞拍中',
  completed: '已完成',
  cancelled: '已取消',
  paid: '已付款',
  shipped: '已发货',
  refunding: '退款中',
  refunded: '已退款',
};

function translateStatus(status: string): string {
  return STATUS_MAP[status] || status;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export class ExportService {
  async exportProducts(merchantId: number, query: ExportQuery): Promise<Buffer | string> {
    const where: any = { merchant_id: merchantId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.categoryId) {
      where.category_id = parseInt(query.categoryId);
    }
    if (query.search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${query.search}%` } },
        { description: { [Op.like]: `%${query.search}%` } },
      ];
    }
    if (query.startDate || query.endDate) {
      where.created_at = {};
      if (query.startDate) where.created_at[Op.gte] = new Date(query.startDate);
      if (query.endDate) where.created_at[Op.lte] = new Date(query.endDate);
    }

    const products = await Product.findAll({
      where,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const rows: ProductExportRow[] = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category?.name || '',
      starting_price: parseFloat(p.starting_price),
      cap_price: p.cap_price ? parseFloat(p.cap_price) : null,
      stock: p.stock ?? 0,
      status: translateStatus(p.status),
      sku: p.sku || null,
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
      created_at: p.created_at,
    }));

    logger.info(`Export products: merchant=${merchantId}, count=${rows.length}`);
    return query.format === 'excel'
      ? await this.generateExcel(rows, PRODUCT_COLUMNS, '商品清单')
      : this.generateCsv(rows, PRODUCT_COLUMNS);
  }

  async exportOrders(merchantId: number, query: ExportQuery): Promise<Buffer | string> {
    const where: any = { merchant_id: merchantId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.startDate || query.endDate) {
      where.created_at = {};
      if (query.startDate) where.created_at[Op.gte] = new Date(query.startDate);
      if (query.endDate) where.created_at[Op.lte] = new Date(query.endDate);
    }

    const orders = await Order.findAll({
      where,
      include: [
        {
          model: Auction,
          as: 'auction',
          attributes: ['id', 'product_id'],
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username'],
        },
      ],
      order: [['created_at', 'DESC']],
      distinct: true,
    } as any);

    const rows: OrderExportRow[] = orders.map((o: any) => ({
      id: o.id,
      product_name: o.auction?.product?.name || '',
      buyer_username: o.user?.username || '',
      amount: parseFloat(o.amount),
      status: translateStatus(o.status),
      tracking_number: o.tracking_number || null,
      shipping_company: o.shipping_company || null,
      shipping_address: o.shipping_address || null,
      created_at: o.created_at,
      paid_at: o.status !== 'pending' && o.status !== 'cancelled' ? o.updated_at : null,
    }));

    logger.info(`Export orders: merchant=${merchantId}, count=${rows.length}`);
    return query.format === 'excel'
      ? await this.generateExcel(rows, ORDER_COLUMNS, '订单明细')
      : this.generateCsv(rows, ORDER_COLUMNS);
  }

  async exportBuyers(merchantId: number, query: ExportQuery): Promise<Buffer | string> {
    const orderWhere: any = { merchant_id: merchantId };
    if (query.startDate || query.endDate) {
      orderWhere.created_at = {};
      if (query.startDate) orderWhere.created_at[Op.gte] = new Date(query.startDate);
      if (query.endDate) orderWhere.created_at[Op.lte] = new Date(query.endDate);
    }

    const orders = await Order.findAll({
      where: orderWhere,
      include: [
        {
          model: Auction,
          as: 'auction',
          attributes: ['id', 'product_id'],
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id'],
            },
          ],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'phone'],
        },
      ],
      order: [['created_at', 'DESC']],
      distinct: true,
    } as any);

    const buyerMap = new Map<number, BuyerExportRow>();
    for (const o of orders) {
      const orderAny = o as any;
      const userId = orderAny.user_id;
      if (!userId || !orderAny.user) continue;

      const existing = buyerMap.get(userId);
      if (existing) {
        existing.order_count += 1;
        existing.total_amount += parseFloat(orderAny.amount);
        if (orderAny.created_at > (existing.last_order_date || new Date(0))) {
          existing.last_order_date = orderAny.created_at;
        }
      } else {
        buyerMap.set(userId, {
          id: orderAny.user.id,
          username: orderAny.user.username,
          email: orderAny.user.email || null,
          phone: orderAny.user.phone || null,
          order_count: 1,
          total_amount: parseFloat(orderAny.amount),
          last_order_date: orderAny.created_at,
        });
      }
    }

    const rows = Array.from(buyerMap.values());

    logger.info(`Export buyers: merchant=${merchantId}, count=${rows.length}`);
    return query.format === 'excel'
      ? await this.generateExcel(rows, BUYER_COLUMNS, '买家信息')
      : this.generateCsv(rows, BUYER_COLUMNS);
  }

  async exportBids(merchantId: number, query: ExportQuery): Promise<Buffer | string> {
    const merchantProducts = await Product.findAll({
      where: { merchant_id: merchantId },
      attributes: ['id'],
    });
    const productIds = merchantProducts.map((p: any) => p.id);

    if (productIds.length === 0) {
      const rows: BidExportRow[] = [];
      return query.format === 'excel'
        ? await this.generateExcel(rows, BID_COLUMNS, '竞拍记录')
        : this.generateCsv(rows, BID_COLUMNS);
    }

    const auctions = await Auction.findAll({
      where: { product_id: { [Op.in]: productIds } },
      attributes: ['id'],
    });
    const auctionIds = auctions.map((a: any) => a.id);

    if (auctionIds.length === 0) {
      const rows: BidExportRow[] = [];
      return query.format === 'excel'
        ? await this.generateExcel(rows, BID_COLUMNS, '竞拍记录')
        : this.generateCsv(rows, BID_COLUMNS);
    }

    const bidWhere: any = { auction_id: { [Op.in]: auctionIds } };
    if (query.startDate || query.endDate) {
      bidWhere.created_at = {};
      if (query.startDate) bidWhere.created_at[Op.gte] = new Date(query.startDate);
      if (query.endDate) bidWhere.created_at[Op.lte] = new Date(query.endDate);
    }

    const bids = await Bid.findAll({
      where: bidWhere,
      include: [
        {
          model: Auction,
          as: 'auction',
          attributes: ['id', 'product_id'],
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const rows: BidExportRow[] = bids.map((b: any) => ({
      id: b.id,
      auction_id: b.auction_id,
      product_name: b.auction?.product?.name || '',
      bidder_username: b.user?.username || '',
      amount: parseFloat(b.amount),
      created_at: b.created_at,
    }));

    logger.info(`Export bids: merchant=${merchantId}, count=${rows.length}`);
    return query.format === 'excel'
      ? await this.generateExcel(rows, BID_COLUMNS, '竞拍记录')
      : this.generateCsv(rows, BID_COLUMNS);
  }

  private async generateExcel(
    rows: any[],
    columns: Partial<ExcelJS.Column>[],
    sheetName: string
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns;

    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD4A017' },
    };
    worksheet.getRow(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };

    for (const row of rows) {
      const rowData: any = {};
      for (const col of columns) {
        const key = col.key as string;
        if (key === 'created_at' || key === 'paid_at' || key === 'last_order_date') {
          rowData[key] = formatDate(row[key]);
        } else {
          rowData[key] = row[key];
        }
      }
      worksheet.addRow(rowData);
    }

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.alignment = { vertical: 'middle' };
      if (i % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF8E1' },
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private generateCsv(rows: any[], columns: Partial<ExcelJS.Column>[]): string {
    const fields = columns
      .filter((col) => col.key && col.header)
      .map((col) => ({
        value: col.key!,
        label: col.header as string,
      }));

    const processedRows = rows.map((row) => {
      const rowData: any = {};
      for (const col of columns) {
        const key = col.key as string;
        if (key === 'created_at' || key === 'paid_at' || key === 'last_order_date') {
          rowData[key] = formatDate(row[key]);
        } else {
          rowData[key] = row[key];
        }
      }
      return rowData;
    });

    const csvFields = fields.map((f) => f.value);
    const csvLabels = fields.map((f) => f.label);

    const csv = parse(processedRows, {
      fields: csvFields,
      header: true,
    });

    const headerLine = csvLabels.join(',') + '\n';
    const dataLines = csv.split('\n').slice(1).join('\n');
    return '\uFEFF' + headerLine + dataLines;
  }
}

export const exportService = new ExportService();
