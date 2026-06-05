import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Table, Tag, Space, Avatar } from 'antd';
import {
  ThunderboltOutlined,
  ShoppingOutlined,
  DollarOutlined,
  RiseOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useAppSelector, formatPrice, formatDate, statusColors, statusLabels, auctionStatusLabels } from '../../utils/hooks';
import { auctionService } from '../../services/auction.service';
import { orderService } from '../../services/order.service';
import { Auction, Order } from '../../types';
import GoldDivider from '../../components/Common/GoldDivider';

const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [recentAuctions, setRecentAuctions] = useState<Auction[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({
    totalAuctions: 0,
    activeAuctions: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [auctionRes, orderRes, orderStats] = await Promise.all([
          auctionService.getAuctions({ page: 1, pageSize: 5 }),
          orderService.getMerchantOrders({ page: 1, pageSize: 5 }),
          orderService.getOrderStats(),
        ]);

        const auctions = auctionRes?.items ?? [];
        const orders = orderRes?.items ?? [];

        setRecentAuctions(auctions);
        setRecentOrders(orders);
        setStats({
          totalAuctions: auctionRes?.total ?? 0,
          activeAuctions: auctions.filter((a) => a.status === 'active').length,
          totalOrders: orderStats.totalOrders,
          totalRevenue: orderStats.totalAmount,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statCards = [
    {
      title: '竞拍总数',
      value: stats.totalAuctions,
      icon: <ThunderboltOutlined />,
      color: '#d4a017',
      bg: 'linear-gradient(135deg, rgba(212,160,23,0.1) 0%, rgba(240,192,64,0.05) 100%)',
      border: 'rgba(212,160,23,0.15)',
    },
    {
      title: '进行中',
      value: stats.activeAuctions,
      icon: <RiseOutlined />,
      color: '#52c41a',
      bg: 'linear-gradient(135deg, rgba(82,196,26,0.1) 0%, rgba(82,196,26,0.05) 100%)',
      border: 'rgba(82,196,26,0.15)',
    },
    {
      title: '订单总数',
      value: stats.totalOrders,
      icon: <ShoppingOutlined />,
      color: '#1677ff',
      bg: 'linear-gradient(135deg, rgba(22,119,255,0.1) 0%, rgba(22,119,255,0.05) 100%)',
      border: 'rgba(22,119,255,0.15)',
    },
    {
      title: '总收入',
      value: stats.totalRevenue,
      prefix: '¥',
      icon: <DollarOutlined />,
      color: '#eb2f96',
      bg: 'linear-gradient(135deg, rgba(235,47,150,0.1) 0%, rgba(235,47,150,0.05) 100%)',
      border: 'rgba(235,47,150,0.15)',
    },
  ];

  const auctionColumns = [
    {
      title: '商品',
      key: 'product',
      render: (_: any, record: Auction) => (
        <Space>
          <Avatar
            shape="square"
            size={40}
            src={record.product?.images?.[0]}
            icon={<ShoppingOutlined />}
            style={{ borderRadius: 8 }}
          />
          <Text strong>{record.product?.name || `竞拍 #${record.id}`}</Text>
        </Space>
      ),
    },
    {
      title: '当前价格',
      key: 'price',
      render: (_: any, record: Auction) => (
        <Text strong style={{ color: '#d4a017' }}>
          {formatPrice(record.currentPrice)}
        </Text>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: Auction) => (
        <Tag color={statusColors[record.status]}>{auctionStatusLabels[record.status]}</Tag>
      ),
    },
    {
      title: '出价数',
      key: 'bidCount',
      render: (_: any, record: Auction) => <Text>{record.bidCount}</Text>,
    },
  ];

  const orderColumns = [
    {
      title: '订单号',
      key: 'id',
      render: (_: any, record: Order) => <Text copyable>#{record.id}</Text>,
    },
    {
      title: '商品',
      key: 'product',
      render: (_: any, record: Order) => (
        <Text>{record.auction?.product?.name || '-'}</Text>
      ),
    },
    {
      title: '金额',
      key: 'amount',
      render: (_: any, record: Order) => (
        <Text strong style={{ color: '#d4a017' }}>
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
      title: '时间',
      key: 'time',
      render: (_: any, record: Order) => <Text type="secondary">{formatDate(record.createdAt)}</Text>,
    },
  ];

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: 24 }}>
        <GoldDivider />
        <Title level={4} style={{ margin: 0 }}>
          欢迎回来，{user?.username}
        </Title>
        <Text type="secondary">以下是您的店铺数据概览</Text>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              bordered={false}
              style={{
                background: stat.bg,
                border: `1px solid ${stat.border}`,
                borderRadius: 12,
              }}
              bodyStyle={{ padding: '20px 24px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>{stat.title}</Text>
                  <div style={{ marginTop: 8 }}>
                    <Statistic
                      value={stat.value}
                      prefix={stat.prefix}
                      valueStyle={{ color: stat.color, fontWeight: 700, fontSize: 28 }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${stat.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    color: stat.color,
                  }}
                >
                  {stat.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tables */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#d4a017' }} />
                <span>最近竞拍</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={auctionColumns}
              dataSource={recentAuctions}
              rowKey="id"
              pagination={false}
              size="small"
              loading={loading}
              scroll={{ x: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#d4a017' }} />
                <span>最近订单</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={orderColumns}
              dataSource={recentOrders}
              rowKey="id"
              pagination={false}
              size="small"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
