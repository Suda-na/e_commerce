import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { exportService, ExportType, ExportFormat, ExportQuery } from '../services/export.service';
import { ValidationError, AuthenticationError, AuthorizationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const VALID_TYPES: ExportType[] = ['products', 'orders', 'buyers', 'bids'];
const VALID_FORMATS: ExportFormat[] = ['csv', 'excel'];

const TYPE_FILENAMES: Record<ExportType, string> = {
  products: '商品清单',
  orders: '订单明细',
  buyers: '买家信息',
  bids: '竞拍记录',
};

export const exportController = {
  async exportData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      if (req.user.role !== 'merchant') {
        throw new AuthorizationError('只有商家可以导出数据');
      }

      const type = req.query.type as ExportType;
      const format = (req.query.format as ExportFormat) || 'csv';

      if (!type || !VALID_TYPES.includes(type)) {
        throw new ValidationError(`导出类型无效，支持: ${VALID_TYPES.join(', ')}`);
      }

      if (!VALID_FORMATS.includes(format)) {
        throw new ValidationError(`导出格式无效，支持: ${VALID_FORMATS.join(', ')}`);
      }

      const query: ExportQuery = {
        type,
        format,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        status: req.query.status as string,
        search: req.query.search as string,
        categoryId: req.query.categoryId as string,
      };

      let data: Buffer | string;

      switch (type) {
        case 'products':
          data = await exportService.exportProducts(req.user.userId, query);
          break;
        case 'orders':
          data = await exportService.exportOrders(req.user.userId, query);
          break;
        case 'buyers':
          data = await exportService.exportBuyers(req.user.userId, query);
          break;
        case 'bids':
          data = await exportService.exportBids(req.user.userId, query);
          break;
        default:
          throw new ValidationError('无效的导出类型');
      }

      const filename = `${TYPE_FILENAMES[type]}_${new Date().toISOString().slice(0, 10)}`;
      const timestamp = Date.now();

      if (format === 'excel') {
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(filename)}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}.xlsx`
        );
        res.send(data as Buffer);
      } else {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(filename)}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}.csv`
        );
        res.send(data as string);
      }

      logger.info(`Data exported: type=${type}, format=${format}, merchant=${req.user.userId}`);
    } catch (error) {
      next(error);
    }
  },
};

export default exportController;
