import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Select,
  Descriptions,
  Modal,
  App,
  Avatar,
  Row,
  Col,
  Statistic,
  Input,
  Form,
  Tooltip,
  Dropdown,
} from 'antd';
import {
  EyeOutlined,
  DollarOutlined,
  ShoppingOutlined,
  UserOutlined,
  CheckCircleOutlined,
  SendOutlined,
  CarOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PrinterOutlined,
  RollbackOutlined,
  MessageOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { fetchOrders, fetchOrder, clearCurrentOrder } from '../../store/slices/orderSlice';
import { formatPrice, formatDate, statusColors, statusLabels } from '../../utils/hooks';
import { orderService } from '../../services/order.service';
import { Order } from '../../types';
import { exportService } from '../../services/export.service';
import GoldDivider from '../../components/Common/GoldDivider';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SHIPPING_COMPANIES = [
  { value: '顺丰速运', label: '顺丰速运' },
  { value: '中通快递', label: '中通快递' },
  { value: '圆通速递', label: '圆通速递' },
  { value: '韵达快递', label: '韵达快递' },
  { value: '申通快递', label: '申通快递' },
  { value: '极兔速递', label: '极兔速递' },
  { value: '京东物流', label: '京东物流' },
  { value: '百世快递', label: '百世快递' },
  { value: '邮政EMS', label: '邮政EMS' },
  { value: '德邦快递', label: '德邦快递' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待付款' },
  { value: 'paid', label: '已付款' },
  { value: 'shipped', label: '已发货' },
  { value: 'refunding', label: '退款中' },
  { value: 'refunded', label: '已退款' },
  { value: 'cancelled', label: '已取消' },
];

const OrdersPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const dispatch = useAppDispatch();
  const { orders, currentOrder, loading, total } = useAppSelector((state) => state.orders);
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [detailVisible, setDetailVisible] = useState(false);

  const [shipModalVisible, setShipModalVisible] = useState(false);
  const [shipOrderId, setShipOrderId] = useState<number | null>(null);
  const [shipForm] = Form.useForm();
  const [shipLoading, setShipLoading] = useState(false);

  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState<number | null>(null);
  const [refundAction, setRefundAction] = useState<'approve' | 'reject'>('approve');
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);

  const [remarkModalVisible, setRemarkModalVisible] = useState(false);
  const [remarkOrderId, setRemarkOrderId] = useState<number | null>(null);
  const [remarkForm] = Form.useForm();
  const [remarkLoading, setRemarkLoading] = useState(false);

  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [addressOrderId, setAddressOrderId] = useState<number | null>(null);
  const [addressForm] = Form.useForm();
  const [addressLoading, setAddressLoading] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async (format: 'csv' | 'excel', type: 'orders' | 'buyers') => {
    try {
      setExportLoading(true);
      await exportService.exportData({
        type,
        format,
        status: statusFilter || undefined,
      });
      message.success(type === 'orders' ? '订单数据导出成功' : '买家数据导出成功');
    } catch (error: any) {
      message.error(error?.response?.data?.error?.message || '导出失败');
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => {
    dispatch(fetchOrders({ page, pageSize: 10, status: statusFilter || undefined }));
  }, [dispatch, page, statusFilter]);

  // 从URL参数中读取orderId，自动打开订单详情弹窗（通知跳转场景）
  useEffect(() => {
    const orderIdParam = searchParams.get('orderId');
    if (orderIdParam) {
      const orderId = Number(orderIdParam);
      if (!isNaN(orderId)) {
        dispatch(fetchOrder(orderId)).then(() => {
          setDetailVisible(true);
        });
        // 清除URL参数，避免刷新页面时重复打开
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, dispatch, setSearchParams]);

  const refreshList = () => {
    dispatch(fetchOrders({ page, pageSize: 10, status: statusFilter || undefined }));
  };

  const handleViewDetail = async (id: number) => {
    await dispatch(fetchOrder(id));
    setDetailVisible(true);
  };

  const handleCancelOrder = async (id: number) => {
    modal.confirm({
      title: '确认取消订单',
      content: '取消后将无法恢复',
      okType: 'danger',
      onOk: async () => {
        try {
          await orderService.cancelOrder(id);
          message.success('订单已取消');
          refreshList();
        } catch (error: any) {
          message.error(error || '取消失败');
        }
      },
    });
  };

  const handleOpenShipModal = (id: number) => {
    setShipOrderId(id);
    shipForm.resetFields();
    setShipModalVisible(true);
  };

  const handleShipSubmit = async () => {
    try {
      const values = await shipForm.validateFields();
      if (!shipOrderId) return;
      setShipLoading(true);
      await orderService.shipOrder(shipOrderId, {
        trackingNumber: values.trackingNumber,
        shippingCompany: values.shippingCompany,
        remark: values.remark,
      });
      message.success('发货成功');
      setShipModalVisible(false);
      refreshList();
      if (detailVisible && currentOrder?.id === shipOrderId) {
        dispatch(fetchOrder(shipOrderId));
      }
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error?.response?.data?.message || error?.message || '发货失败');
    } finally {
      setShipLoading(false);
    }
  };

  const handleOpenRefundModal = (id: number, action: 'approve' | 'reject') => {
    setRefundOrderId(id);
    setRefundAction(action);
    setRefundReason('');
    setRefundModalVisible(true);
  };

  const handleRefundSubmit = async () => {
    if (!refundOrderId) return;
    setRefundLoading(true);
    try {
      await orderService.handleRefund(refundOrderId, refundAction, refundReason || undefined);
      message.success(refundAction === 'approve' ? '退款已同意' : '退款已拒绝');
      setRefundModalVisible(false);
      refreshList();
      if (detailVisible && currentOrder?.id === refundOrderId) {
        dispatch(fetchOrder(refundOrderId));
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '操作失败');
    } finally {
      setRefundLoading(false);
    }
  };

  const handleOpenRemarkModal = (record: Order) => {
    setRemarkOrderId(record.id);
    remarkForm.setFieldsValue({
      remark: record.remark || '',
      merchantRemark: record.merchantRemark || '',
    });
    setRemarkModalVisible(true);
  };

  const handleRemarkSubmit = async () => {
    try {
      const values = await remarkForm.validateFields();
      if (!remarkOrderId) return;
      setRemarkLoading(true);
      await orderService.updateRemark(remarkOrderId, {
        remark: values.remark,
        merchantRemark: values.merchantRemark,
      });
      message.success('备注已更新');
      setRemarkModalVisible(false);
      refreshList();
      if (detailVisible && currentOrder?.id === remarkOrderId) {
        dispatch(fetchOrder(remarkOrderId));
      }
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error?.response?.data?.message || error?.message || '更新失败');
    } finally {
      setRemarkLoading(false);
    }
  };

  const handleOpenAddressModal = (record: Order) => {
    setAddressOrderId(record.id);
    addressForm.setFieldsValue({
      shippingAddress: record.shippingAddress || '',
    });
    setAddressModalVisible(true);
  };

  const handleAddressSubmit = async () => {
    try {
      const values = await addressForm.validateFields();
      if (!addressOrderId) return;
      setAddressLoading(true);
      await orderService.updateAddress(addressOrderId, values.shippingAddress);
      message.success('地址已更新');
      setAddressModalVisible(false);
      refreshList();
      if (detailVisible && currentOrder?.id === addressOrderId) {
        dispatch(fetchOrder(addressOrderId));
      }
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error?.response?.data?.message || error?.message || '更新失败');
    } finally {
      setAddressLoading(false);
    }
  };

  const handlePrintOrder = (record: Order) => {
    // 收货地址：优先用订单上的 shippingAddress，否则拼接 user 中的省市区+详细地址
    const shippingAddr = record.shippingAddress
      || [record.user?.province, record.user?.city, record.user?.district, record.user?.detailAddress].filter(Boolean).join(' ')
      || '-';

    const printContent = `
      <html><head><title>发货单 #${record.id}</title>
      <style>
        body { font-family: 'Microsoft YaHei', sans-serif; padding: 40px; }
        h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .info { margin: 20px 0; line-height: 2; }
        .info span { display: inline-block; width: 120px; font-weight: bold; }
        .footer { margin-top: 40px; text-align: right; }
      </style></head><body>
      <h1>发货单</h1>
      <div class="info">
        <div><span>订单号：</span>#${record.id}</div>
        <div><span>商品名称：</span>${record.auction?.product?.name || '-'}</div>
        <div><span>买家：</span>${record.user?.username || '-'}</div>
        <div><span>金额：</span>¥${(record.amount != null ? Number(record.amount).toFixed(2) : '0.00')}</div>
        <div><span>物流公司：</span>${record.shippingCompany || '-'}</div>
        <div><span>快递单号：</span>${record.trackingNumber || '-'}</div>
        <div><span>收货人：</span>${record.receiverName || record.user?.receiverName || '-'}</div>
        <div><span>联系电话：</span>${record.receiverPhone || record.user?.receiverPhone || '-'}</div>
        <div><span>收货地址：</span>${shippingAddr}</div>
        <div><span>备注：</span>${record.remark || '-'}</div>
        <div><span>商家备注：</span>${record.merchantRemark || '-'}</div>
      </div>
      <div class="footer">打印时间：${new Date().toLocaleString('zh-CN')}</div>
      </body></html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const columns = [
    {
      title: '订单号',
      key: 'id',
      width: 100,
      render: (_: any, record: Order) => (
        <Text copyable style={{ fontFamily: 'monospace' }}>
          #{record.id}
        </Text>
      ),
    },
    {
      title: '商品',
      key: 'product',
      render: (_: any, record: Order) => (
        <Space>
          <Avatar
            shape="square"
            size={40}
            icon={<ShoppingOutlined />}
            src={record.auction?.product?.images?.[0]}
            style={{ borderRadius: 8 }}
          />
          <div>
            <Text strong>{record.auction?.product?.name || '-'}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              竞拍 #{record.auctionId}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '买家',
      key: 'buyer',
      responsive: ['md'] as any,
      render: (_: any, record: Order) => (
        <Space>
          <Avatar size={24} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
          <Text>{record.user?.username || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '金额',
      key: 'amount',
      render: (_: any, record: Order) => (
        <Text strong style={{ color: '#d4a017', fontSize: 15 }}>
          {formatPrice(record.amount)}
        </Text>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: Order) => (
        <Tag color={statusColors[record.status]}>{statusLabels[record.status]}</Tag>
      ),
    },
    {
      title: '物流',
      key: 'shipping',
      responsive: ['lg'] as any,
      render: (_: any, record: Order) => (
        record.trackingNumber ? (
          <Tooltip title={`${record.shippingCompany} - ${record.trackingNumber}`}>
            <Space size={4}>
              <CarOutlined style={{ color: '#1677ff' }} />
              <Text style={{ fontSize: 12 }}>{record.shippingCompany}</Text>
            </Space>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>未发货</Text>
        )
      ),
    },
    {
      title: '收货信息',
      key: 'address',
      responsive: ['xl'] as any,
      width: 220,
      render: (_: any, record: Order) => {
        const address = record.shippingAddress
          || (record.user && [record.user.province, record.user.city, record.user.district, record.user.detailAddress].filter(Boolean).join(' '))
          || '';
        const receiver = record.receiverName
          || (record.user && record.user.receiverName)
          || '';
        const phone = record.receiverPhone
          || (record.user && record.user.receiverPhone)
          || '';
        const receiverInfo = receiver ? `${receiver}${phone ? ' ' + phone : ''}` : '';
        const fullInfo = [receiverInfo, address].filter(Boolean).join(' | ');
        return fullInfo ? (
          <Tooltip title={fullInfo}>
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>{fullInfo}</Text>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>未设置</Text>
        );
      },
    },
    {
      title: '创建时间',
      key: 'createdAt',
      responsive: ['lg'] as any,
      render: (_: any, record: Order) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(record.createdAt)}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Order) => (
        <Space size={4} wrap>
          <Tooltip title="详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)} />
          </Tooltip>
          {record.status === 'paid' && (
            <Tooltip title="发货">
              <Button type="text" size="small" icon={<SendOutlined />} style={{ color: '#1677ff' }} onClick={() => handleOpenShipModal(record.id)} />
            </Tooltip>
          )}
          {record.status === 'refunding' && (
            <>
              <Tooltip title="同意退款">
                <Button type="text" size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }} onClick={() => handleOpenRefundModal(record.id, 'approve')} />
              </Tooltip>
              <Tooltip title="拒绝退款">
                <Button type="text" size="small" icon={<CloseCircleOutlined />} style={{ color: '#ff4d4f' }} onClick={() => handleOpenRefundModal(record.id, 'reject')} />
              </Tooltip>
            </>
          )}
          <Tooltip title="备注">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenRemarkModal(record)} />
          </Tooltip>
          {(record.status === 'paid' || record.status === 'shipped') && (
            <Tooltip title="修改地址">
              <Button type="text" size="small" icon={<EnvironmentOutlined />} onClick={() => handleOpenAddressModal(record)} />
            </Tooltip>
          )}
          {(record.status === 'paid' || record.status === 'shipped') && (
            <Tooltip title="打印发货单">
              <Button type="text" size="small" icon={<PrinterOutlined />} onClick={() => handlePrintOrder(record)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const pendingCount = (orders ?? []).filter((o) => o.status === 'pending').length;
  const paidCount = (orders ?? []).filter((o) => o.status === 'paid').length;
  const shippedCount = (orders ?? []).filter((o) => o.status === 'shipped').length;
  const refundingCount = (orders ?? []).filter((o) => o.status === 'refunding').length;

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
            订单管理
          </Title>
          <Text type="secondary">管理竞拍成交订单</Text>
        </div>
        <Space wrap>
          <Select
            placeholder="筛选状态"
            allowClear
            value={statusFilter || undefined}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
            style={{ width: 140 }}
            options={STATUS_OPTIONS}
          />
          <Dropdown
            menu={{
              items: [
                {
                  key: 'exportOrdersCsv',
                  icon: <DownloadOutlined />,
                  label: '导出订单 CSV',
                  disabled: exportLoading,
                  onClick: () => handleExport('csv', 'orders'),
                },
                {
                  key: 'exportOrdersExcel',
                  icon: <FileExcelOutlined />,
                  label: '导出订单 Excel',
                  disabled: exportLoading,
                  onClick: () => handleExport('excel', 'orders'),
                },
                { type: 'divider' },
                {
                  key: 'exportBuyersCsv',
                  icon: <DownloadOutlined />,
                  label: '导出买家 CSV',
                  disabled: exportLoading,
                  onClick: () => handleExport('csv', 'buyers'),
                },
                {
                  key: 'exportBuyersExcel',
                  icon: <FileExcelOutlined />,
                  label: '导出买家 Excel',
                  disabled: exportLoading,
                  onClick: () => handleExport('excel', 'buyers'),
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

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.02) 100%)', border: '1px solid rgba(0,0,0,0.06)' }} styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="待付款" value={pendingCount} prefix={<DollarOutlined />} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: 'linear-gradient(135deg, rgba(82,196,26,0.1) 0%, rgba(82,196,26,0.05) 100%)', border: '1px solid rgba(82,196,26,0.15)' }} styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="待发货" value={paidCount} prefix={<CarOutlined />} valueStyle={{ color: '#52c41a', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: 'linear-gradient(135deg, rgba(22,119,255,0.1) 0%, rgba(22,119,255,0.05) 100%)', border: '1px solid rgba(22,119,255,0.15)' }} styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="已发货" value={shippedCount} prefix={<SendOutlined />} valueStyle={{ color: '#1677ff', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: 'linear-gradient(135deg, rgba(212,160,23,0.1) 0%, rgba(212,160,23,0.05) 100%)', border: '1px solid rgba(212,160,23,0.15)' }} styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="退款中" value={refundingCount} prefix={<RollbackOutlined />} valueStyle={{ color: '#faad14', fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          scroll={{ x: 800 }}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
            responsive: true,
          }}
        />
      </Card>

      {/* Order Detail Modal */}
      <Modal
        title={`订单详情 #${currentOrder?.id || ''}`}
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          dispatch(clearCurrentOrder());
        }}
        footer={
          currentOrder ? (
            <Space>
              {currentOrder.status === 'pending' && (
                <>
                  <Button danger onClick={() => { handleCancelOrder(currentOrder.id); setDetailVisible(false); }}>
                    取消订单
                  </Button>
                  <Button type="primary" onClick={() => { handlePayOrder(currentOrder.id); setDetailVisible(false); }}>
                    模拟支付
                  </Button>
                </>
              )}
              {currentOrder.status === 'paid' && (
                <Button type="primary" icon={<SendOutlined />} onClick={() => { setDetailVisible(false); handleOpenShipModal(currentOrder.id); }}>
                  发货
                </Button>
              )}
              {currentOrder.status === 'refunding' && (
                <>
                  <Button danger icon={<CheckCircleOutlined />} onClick={() => { setDetailVisible(false); handleOpenRefundModal(currentOrder.id, 'approve'); }}>
                    同意退款
                  </Button>
                  <Button icon={<CloseCircleOutlined />} onClick={() => { setDetailVisible(false); handleOpenRefundModal(currentOrder.id, 'reject'); }}>
                    拒绝退款
                  </Button>
                </>
              )}
              <Button icon={<EditOutlined />} onClick={() => { setDetailVisible(false); handleOpenRemarkModal(currentOrder); }}>
                备注
              </Button>
              {(currentOrder.status === 'paid' || currentOrder.status === 'shipped') && (
                <Button icon={<EnvironmentOutlined />} onClick={() => { setDetailVisible(false); handleOpenAddressModal(currentOrder); }}>
                  修改地址
                </Button>
              )}
              <Button onClick={() => { setDetailVisible(false); dispatch(clearCurrentOrder()); }}>
                关闭
              </Button>
            </Space>
          ) : null
        }
        width={600}
      >
        {currentOrder && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="订单号">#{currentOrder.id}</Descriptions.Item>
            <Descriptions.Item label="商品">
              {currentOrder.auction?.product?.name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="买家">
              {currentOrder.user?.username || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="金额">
              <Text strong style={{ color: '#d4a017' }}>
                {formatPrice(currentOrder.amount)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[currentOrder.status]}>
                {statusLabels[currentOrder.status]}
              </Tag>
            </Descriptions.Item>
            {currentOrder.trackingNumber && (
              <Descriptions.Item label="快递信息">
                <Space>
                  <CarOutlined />
                  <Text>{currentOrder.shippingCompany}</Text>
                  <Text copyable style={{ fontFamily: 'monospace' }}>{currentOrder.trackingNumber}</Text>
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="收货人姓名">
              <Space>
                <UserOutlined />
                <Text>{currentOrder.receiverName || currentOrder.user?.receiverName || '-'}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="收货人电话">
              <Space>
                <PhoneOutlined />
                <Text>{currentOrder.receiverPhone || currentOrder.user?.receiverPhone || '-'}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="收货地址">
              <Space>
                <EnvironmentOutlined />
                <Text>{currentOrder.shippingAddress || (currentOrder.user && [currentOrder.user.province, currentOrder.user.city, currentOrder.user.district, currentOrder.user.detailAddress].filter(Boolean).join(' ')) || '-'}</Text>
              </Space>
            </Descriptions.Item>
            {currentOrder.remark && (
              <Descriptions.Item label="买家备注">{currentOrder.remark}</Descriptions.Item>
            )}
            {currentOrder.merchantRemark && (
              <Descriptions.Item label="商家备注">{currentOrder.merchantRemark}</Descriptions.Item>
            )}
            {currentOrder.refundReason && (
              <Descriptions.Item label="退款原因">
                <Text type="danger">{currentOrder.refundReason}</Text>
              </Descriptions.Item>
            )}
            {currentOrder.refundRejectedReason && (
              <Descriptions.Item label="拒绝退款原因">
                <Text type="warning">{currentOrder.refundRejectedReason}</Text>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">
              {formatDate(currentOrder.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {formatDate(currentOrder.updatedAt)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Ship Modal */}
      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: '#d4a017' }} />
            <span>订单发货</span>
          </Space>
        }
        open={shipModalVisible}
        onCancel={() => setShipModalVisible(false)}
        onOk={handleShipSubmit}
        confirmLoading={shipLoading}
        okText="确认发货"
        cancelText="取消"
        width={480}
        destroyOnClose
      >
        <Form form={shipForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="shippingCompany"
            label="物流公司"
            rules={[{ required: true, message: '请选择物流公司' }]}
          >
            <Select
              placeholder="选择物流公司"
              showSearch
              options={SHIPPING_COMPANIES}
            />
          </Form.Item>
          <Form.Item
            name="trackingNumber"
            label="快递单号"
            rules={[
              { required: true, message: '请输入快递单号' },
              { max: 100, message: '快递单号最多100个字符' },
            ]}
          >
            <Input placeholder="输入快递单号" />
          </Form.Item>
          <Form.Item name="remark" label="发货备注 (可选)">
            <TextArea rows={2} placeholder="发货备注信息" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Refund Modal */}
      <Modal
        title={
          <Space>
            {refundAction === 'approve' ? (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            )}
            <span>{refundAction === 'approve' ? '同意退款' : '拒绝退款'}</span>
          </Space>
        }
        open={refundModalVisible}
        onCancel={() => setRefundModalVisible(false)}
        onOk={handleRefundSubmit}
        confirmLoading={refundLoading}
        okText={refundAction === 'approve' ? '确认同意' : '确认拒绝'}
        okButtonProps={{ danger: refundAction === 'reject' }}
        cancelText="取消"
        width={440}
        destroyOnClose
      >
        <div style={{ marginTop: 16 }}>
          {refundAction === 'approve' ? (
            <Text>确认同意退款？退款金额将原路返回买家账户。</Text>
          ) : (
            <Text>确认拒绝退款？请填写拒绝原因。</Text>
          )}
          <Form layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label={refundAction === 'reject' ? '拒绝原因' : '备注 (可选)'}>
              <TextArea
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={refundAction === 'reject' ? '请输入拒绝退款的原因' : '可选备注'}
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* Remark Modal */}
      <Modal
        title={
          <Space>
            <MessageOutlined style={{ color: '#d4a017' }} />
            <span>订单备注</span>
          </Space>
        }
        open={remarkModalVisible}
        onCancel={() => setRemarkModalVisible(false)}
        onOk={handleRemarkSubmit}
        confirmLoading={remarkLoading}
        okText="保存"
        cancelText="取消"
        width={480}
        destroyOnClose
      >
        <Form form={remarkForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="remark" label="买家备注">
            <TextArea rows={2} placeholder="买家可见的备注信息" maxLength={1000} showCount />
          </Form.Item>
          <Form.Item name="merchantRemark" label="商家内部备注">
            <TextArea rows={2} placeholder="仅商家可见的内部备注" maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Address Modal */}
      <Modal
        title={
          <Space>
            <EnvironmentOutlined style={{ color: '#d4a017' }} />
            <span>修改收货地址</span>
          </Space>
        }
        open={addressModalVisible}
        onCancel={() => setAddressModalVisible(false)}
        onOk={handleAddressSubmit}
        confirmLoading={addressLoading}
        okText="保存"
        cancelText="取消"
        width={480}
        destroyOnClose
      >
        <Form form={addressForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="shippingAddress"
            label="收货地址"
            rules={[
              { required: true, message: '请输入收货地址' },
              { max: 500, message: '地址最多500个字符' },
            ]}
          >
            <TextArea rows={3} placeholder="输入完整的收货地址（省/市/区/街道/门牌号/收件人/电话）" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OrdersPage;
