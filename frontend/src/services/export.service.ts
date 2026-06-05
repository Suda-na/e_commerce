import api from './api';

export type ExportType = 'products' | 'orders' | 'buyers' | 'bids';
export type ExportFormat = 'csv' | 'excel';

export interface ExportParams {
  type: ExportType;
  format?: ExportFormat;
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
  categoryId?: string;
}

class ExportService {
  async exportData(params: ExportParams): Promise<void> {
    const searchParams = new URLSearchParams();
    searchParams.append('type', params.type);
    if (params.format) searchParams.append('format', params.format);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.status) searchParams.append('status', params.status);
    if (params.search) searchParams.append('search', params.search);
    if (params.categoryId) searchParams.append('categoryId', params.categoryId);

    const response = await api.get(`/export?${searchParams.toString()}`, {
      responseType: 'blob',
    });

    const contentType = String(response.headers['content-type'] || '');
    let extension = '.csv';
    if (contentType.includes('spreadsheetml')) {
      extension = '.xlsx';
    }

    const typeNames: Record<ExportType, string> = {
      products: '商品清单',
      orders: '订单明细',
      buyers: '买家信息',
      bids: '竞拍记录',
    };

    const filename = `${typeNames[params.type]}_${new Date().toISOString().slice(0, 10)}${extension}`;

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
