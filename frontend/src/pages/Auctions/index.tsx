import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Select,
  Modal,
  App,
  Badge,
  Tooltip,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  DownloadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import {
  fetchAuctions,
  createAuction,
  startAuction,
  endAuction,
  cancelAuction,
} from '../../store/slices/auctionSlice';
import { formatPrice, formatDate } from '../../utils/hooks';
import { Auction } from '../../types';
import { exportService } from '../../services/export.service';
import GoldDivider from '../../components/Common/GoldDivider';

const { Title, Text } = Typography;

const auctionStatusLabels: Record<string, string> = {
  pending: '待开始',
  active: '进行中',
  completed: '已结束',
  cancelled: '已取消',
};

const auctionStatusColors: Record<string, string> = {
  pending: 'default',
  active: 'processing',
  completed: 'success',
  cancelled: 'error',
};

const AuctionsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { auctions, loading, total } = useAppSelector((state) => state.auctions);
  const { products } = useAppSelector((state) => state.products);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const refreshList = () => {
    dispatch(fetchAuctions({ page, pageSize: 10, status: statusFilter || undefined }));
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExportLoading(true);
      await exportService.exportData({
        type: 'bids',
        format,
        status: statusFilter || undefined,
      });
      message.success('竞拍记录导出成功');
    } catch (error: any) {
      message.error(error?.response?.data?.error?.message || '导出失败');
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => {
    dispatch(fetchAuctions({ page, pageSize: 10, status: statusFilter || undefined }));
  }, [dispatch, page, statusFilter]);

  const handleCreateAuction = async () => {
    if (!selectedProductId) {
      message.warning('请选择商品');
      return;
    }
    try {
      await dispatch(createAuction({ productId: selectedProductId })).unwrap();
      message.success('竞拍创建成功');
      setCreateModalVisible(false);
      setSelectedProductId(null);
      refreshList();
    } catch (error: any) {
      message.error(error || '创建竞拍失败');
    }
  };

  const handleStartAuction = async (id: number) => {
    modal.confirm({
      title: '确定开始竞拍？',
      content: '开始后将无法修改竞拍参数',
      onOk: async () => {
        try {
          await dispatch(startAuction(id)).unwrap();
          message.success('竞拍已开始');
          refreshList();
        } catch (error: any) {
          message.error(error || '开始竞拍失败');
        }
      },
    });
  };

  const handleEndAuction = async (id: number) => {
    modal.confirm({
      title: '确定结束竞拍？',
      content: '结束后将确定获胜者并创建订单',
      onOk: async () => {
        try {
          await dispatch(endAuction(id)).unwrap();
          message.success('竞拍已结束');
          refreshList();
        } catch (error: any) {
          message.error(error || '结束竞拍失败');
        }
      },
    });
  };

  const handleCancelAuction = async (id: number) => {
    modal.confirm({
      title: '确定取消竞拍？',
      content: '取消后将通知所有参与者',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(cancelAuction(id)).unwrap();
          message.success('竞拍已取消');
          refreshList();
        } catch (error: any) {
          message.error(error || '取消竞拍失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '竞拍信息',
      key: 'info',
      render: (_: any, record: Auction) => (
        <Space>
          <div
            style={{
              width: 48,
              height: 36,
              borderRadius: 8,
              background: record.status === 'active'
                ? 'linear-gradient(135deg, rgba(82,196,26,0.15), rgba(82,196,26,0.05))'
                : 'linear-gradient(135deg, rgba(212,160,23,0.15), rgba(212,160,23,0.05))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThunderboltOutlined
              style={{
                color: record.status === 'active' ? '#52c41a' : '#d4a017',
                fontSize: 18,
              }}
            />
          </div>
          <div>
            <Text strong>竞拍 #{record.id}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.product?.name || '未知商品'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '当前价格',
      key: 'price',
      render: (_: any, record: Auction) => {
        const hasBid = record.currentPrice != null && record.currentPrice > 0 && record.currentPrice !== record.product?.startingPrice;
        return (
          <div>
            <Text strong style={{ color: '#d4a017', fontSize: 16 }}>
              {formatPrice(record.currentPrice || record.product?.startingPrice || 0)}
            </Text>
            {hasBid && record.product?.startingPrice && (
              <>
                <br />
                <Text type="secondary" style={{ fontSize: 12, textDecoration: 'line-through' }}>
                  起拍价 {formatPrice(record.product.startingPrice)}
                </Text>
              </>
            )}
          </div>
        );
      },
    },
    {
      title: '参与情况',
      key: 'participation',
      render: (_: any, record: Auction) => (
        <Space direction="vertical" size={0}>
          <Space>
            <TeamOutlined style={{ color: '#1677ff' }} />
            <Text>{record.participantCount} 参与</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.bidCount} 次出价
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: Auction) => {
        const badgeStatusMap: Record<string, 'processing' | 'success' | 'warning' | 'default'> = {
          pending: 'default',
          active: 'processing',
          completed: 'success',
          cancelled: 'warning',
        };
        return (
          <Badge
            status={badgeStatusMap[record.status] || 'default'}
            text={
              <Tag
                color={auctionStatusColors[record.status]}
                style={{ borderRadius: 12, padding: '2px 12px' }}
              >
                {auctionStatusLabels[record.status]}
              </Tag>
            }
          />
        );
      },
    },
    {
      title: '时间',
      key: 'time',
      render: (_: any, record: Auction) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(record.createdAt)}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Auction) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/merchant/auctions/${record.id}`)}
            />
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="开始竞拍">
              <Button
                type="text"
                icon={<PlayCircleOutlined />}
                style={{ color: '#52c41a' }}
                onClick={() => handleStartAuction(record.id)}
              />
            </Tooltip>
          )}
          {record.status === 'active' && (
            <>
              <Tooltip title="结束竞拍">
                <Button
                  type="text"
                  icon={<StopOutlined />}
                  style={{ color: '#faad14' }}
                  onClick={() => handleEndAuction(record.id)}
                />
              </Tooltip>
              <Tooltip title="取消竞拍">
                <Button
                  type="text"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleCancelAuction(record.id)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <GoldDivider />
          <Title level={4} style={{ margin: 0 }}>
            竞拍管理
          </Title>
          <Text type="secondary">管理您的竞拍活动</Text>
        </div>
        <Space wrap>
          <Select
            placeholder="筛选状态"
            allowClear
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            style={{ width: 140 }}
            options={[
              { value: '', label: '全部' },
              { value: 'pending', label: '待开始' },
              { value: 'active', label: '进行中' },
              { value: 'completed', label: '已结束' },
              { value: 'cancelled', label: '已取消' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建竞拍
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'exportBidsCsv',
                  icon: <DownloadOutlined />,
                  label: '导出竞拍记录 CSV',
                  disabled: exportLoading,
                  onClick: () => handleExport('csv'),
                },
                {
                  key: 'exportBidsExcel',
                  icon: <FileExcelOutlined />,
                  label: '导出竞拍记录 Excel',
                  disabled: exportLoading,
                  onClick: () => handleExport('excel'),
                },
              ],
            }}
          >
            <Button icon={<DownloadOutlined />} loading={exportLoading}>
              数据导出
            </Button>
          </Dropdown>
        </Space>
      </div>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={auctions}
          rowKey="id"
          loading={loading}
          scroll={{ x: 800 }}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: setPage,
            showTotal: (total) => `共 ${total} 条`,
            responsive: true,
          }}
        />
      </Card>

      {/* Create Auction Modal */}
      <Modal
        title="创建竞拍"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setSelectedProductId(null);
        }}
        onOk={handleCreateAuction}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ padding: '16px 0' }}>
          <Text style={{ marginBottom: 8, display: 'block' }}>选择商品：</Text>
          <Select
            placeholder="选择一个商品创建竞拍"
            style={{ width: '100%' }}
            value={selectedProductId}
            onChange={setSelectedProductId}
            showSearch
            optionFilterProp="label"
            options={(products ?? [])
              .filter((p) => p.status === 'pending')
              .map((p) => ({
                value: p.id,
                label: `${p.name} - ${formatPrice(p.startingPrice)}`,
              }))}
          />
        </div>
      </Modal>
    </div>
  );
};

export default AuctionsPage;
