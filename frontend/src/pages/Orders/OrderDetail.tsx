import React, { useEffect } from 'react';
import {
  Card,
  Typography,
  Tag,
  Descriptions,
  Button,
  Space,
  Divider,
  Row,
  Col,
  Spin,
  Empty,
  Avatar,
  App,
} from 'antd';
import {
  ArrowLeftOutlined,
  DollarOutlined,
  UserOutlined,
  ShoppingOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { fetchOrder, clearCurrentOrder } from '../../store/slices/orderSlice';
import { formatPrice, formatDate, statusColors, statusLabels } from '../../utils/hooks';
import { orderService } from '../../services/order.service';
import GoldDivider from '../../components/Common/GoldDivider';

const { Title, Text } = Typography;

const OrderDetailPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { orders, currentOrder, loading } = useAppSelector((state) => state.orders);

  const order = currentOrder || orders.find((o) => o.id === Number(id));

  useEffect(() => {
    if (id) {
      dispatch(fetchOrder(Number(id)));
    }

    return () => {
      dispatch(clearCurrentOrder());
    };
  }, [dispatch, id]);

  const handlePayOrder = async () => {
    if (!order) return;
    modal.confirm({
      title: '确认模拟支付',
      content: '这是一个演示功能，将模拟完成支付流程',
      onOk: async () => {
        try {
          await orderService.payOrder(order.id);
          message.success('支付成功');
          dispatch(fetchOrder(order.id));
        } catch (error: any) {
          message.error(error || '支付失败');
        }
      },
    });
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    modal.confirm({
      title: '确认取消订单',
      content: '取消后将无法恢复',
      okType: 'danger',
      onOk: async () => {
        try {
          await orderService.cancelOrder(order.id);
          message.success('订单已取消');
          dispatch(fetchOrder(order.id));
        } catch (error: any) {
          message.error(error || '取消失败');
        }
      },
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 24, color: '#d4a017' }} spin />} />
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Empty description="订单不存在" />
        <Button type="primary" onClick={() => navigate('/merchant/orders')} style={{ marginTop: 16 }}>
          返回订单列表
        </Button>
      </div>
    );
  }

  const isPending = order.status === 'pending';

  return (
    <div>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/merchant/orders')}
          />
          <div>
            <GoldDivider />
            <Title level={4} style={{ margin: 0 }}>
              订单详情
            </Title>
            <Text type="secondary">查看订单详细信息</Text>
          </div>
        </Space>
        <Space>
          {isPending && (
            <>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleCancelOrder}
              >
                取消订单
              </Button>
              <Button
                type="primary"
                icon={<DollarOutlined />}
                onClick={handlePayOrder}
              >
                模拟支付
              </Button>
            </>
          )}
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {/* Order Info */}
        <Col xs={24} lg={16}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Tag color={statusColors[order.status]} style={{ fontSize: 14, padding: '2px 12px' }}>
                  {statusLabels[order.status]}
                </Tag>
                <Text strong style={{ fontSize: 18 }}>
                  订单 #{order.id}
                </Text>
              </Space>
            </div>

            <Divider />

            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item
                label={
                  <Space>
                    <DollarOutlined />
                    <span>订单金额</span>
                  </Space>
                }
              >
                <Text strong style={{ fontSize: 24, color: '#d4a017' }}>
                  {formatPrice(order.amount)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <Space>
                    <ClockCircleOutlined />
                    <span>创建时间</span>
                  </Space>
                }
              >
                <Text>{formatDate(order.createdAt)}</Text>
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <Space>
                    <ClockCircleOutlined />
                    <span>更新时间</span>
                  </Space>
                }
              >
                <Text>{formatDate(order.updatedAt)}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Product & Buyer Info */}
        <Col xs={24} lg={8}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ marginBottom: 8, display: 'block' }}>商品信息</Text>
              <Space>
                <Avatar
                  shape="square"
                  size={48}
                  icon={<ShoppingOutlined />}
                  src={order.auction?.product?.images?.[0]}
                  style={{ borderRadius: 8 }}
                />
                <div>
                  <Text strong>{order.auction?.product?.name || '未知商品'}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    竞拍 #{order.auctionId}
                  </Text>
                </div>
              </Space>
            </div>

            <Divider />

            <div>
              <Text strong style={{ marginBottom: 8, display: 'block' }}>买家信息</Text>
              <Space>
                <Avatar size={32} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                <div>
                  <Text strong>{order.user?.username || '未知用户'}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    用户ID: {order.userId}
                  </Text>
                </div>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OrderDetailPage;
