import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Typography,
  Spin,
  Tag,
  Space,
  Empty,
  message,
  Alert,
  Progress,
  Button,
  List,
} from 'antd';
import {
  ShoppingOutlined,
  ThunderboltOutlined,
  SwapRightOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  EyeOutlined,
  TrophyOutlined,
  RobotOutlined,
  BulbOutlined,
  FunnelPlotOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';
import { analyticsService } from '../../services/analytics.service';
import { AnalyticsDashboard, TopProduct, AIDailyReport, AuctionFunnel, PricingSuggestion } from '../../types';
import GoldDivider from '../../components/Common/GoldDivider';

const { Title, Text } = Typography;

const GOLD_COLORS = ['#d4a017', '#e8b830', '#f0c040', '#c49512', '#a67c00', '#8b6914'];

const EmptyChart: React.FC<{ text?: string }> = ({ text = '暂无数据' }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280 }}>
    <Empty description={text} image={Empty.PRESENTED_IMAGE_SIMPLE} />
  </div>
);

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState<AIDailyReport | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [funnel, setFunnel] = useState<AuctionFunnel | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [pricingSuggestions, setPricingSuggestions] = useState<PricingSuggestion[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await analyticsService.getDashboard();
        setData(result);
      } catch {
        message.error('数据分析加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fetchAIReport = async () => {
    setAiReportLoading(true);
    try {
      const result = await analyticsService.getAIDailyReport();
      setAiReport(result);
    } catch {
      message.error('AI经营日报加载失败');
    } finally {
      setAiReportLoading(false);
    }
  };

  const fetchFunnel = async () => {
    setFunnelLoading(true);
    try {
      const result = await analyticsService.getAuctionFunnel();
      setFunnel(result);
    } catch {
      message.error('漏斗分析加载失败');
    } finally {
      setFunnelLoading(false);
    }
  };

  const fetchPricingSuggestions = async () => {
    setPricingLoading(true);
    try {
      const result = await analyticsService.getPricingSuggestions();
      setPricingSuggestions(result);
    } catch {
      message.error('定价建议加载失败');
    } finally {
      setPricingLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">正在加载分析数据...</Text>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 0' }}>
        <Empty description="暂无分析数据" />
      </div>
    );
  }

  const { overview, topProducts, priceDistribution, hourlyTraffic, categoryPerformance } = data;

  const topProductColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: TopProduct, index: number) => (
        <Tag
          color={index < 3 ? 'gold' : 'default'}
          style={{ borderRadius: '50%', minWidth: 28, textAlign: 'center' }}
        >
          {index + 1}
        </Tag>
      ),
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '浏览量',
      dataIndex: 'views',
      key: 'views',
      render: (views: number) => (
        <Space size={4}>
          <EyeOutlined style={{ color: '#8c8c8c' }} />
          <span>{views.toLocaleString()}</span>
        </Space>
      ),
    },
    {
      title: '出价数',
      dataIndex: 'bids',
      key: 'bids',
      render: (bids: number) => (
        <Space size={4}>
          <SwapRightOutlined style={{ color: '#d4a017' }} />
          <span>{bids}</span>
        </Space>
      ),
    },
    {
      title: '当前价格',
      dataIndex: 'finalPrice',
      key: 'finalPrice',
      render: (price: number) => (
        <Text strong style={{ color: '#d4a017' }}>¥{price.toLocaleString()}</Text>
      ),
    },
    {
      title: '收入',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (revenue: number) => (
        <Text strong style={{ color: revenue > 0 ? '#52c41a' : undefined }}>
          {revenue > 0 ? `¥${revenue.toLocaleString()}` : '-'}
        </Text>
      ),
    },
  ];

  const priceDistChartData = priceDistribution.map((item) => ({
    range: item.range,
    count: item.count,
    percentage: item.percentage,
  }));

  const pieData = priceDistribution
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: item.range,
      value: item.count,
      percentage: item.percentage,
    }));

  const trafficLineData = hourlyTraffic.map((item) => ({
    hour: `${item.hour}:00`,
    浏览量: item.views,
    出价数: item.bids,
  }));

  const hasTraffic = hourlyTraffic.some((item) => item.views > 0 || item.bids > 0);

  const categoryBarData = categoryPerformance.map((item) => ({
    category: item.category,
    totalRevenue: item.totalRevenue,
    productCount: item.productCount,
    avgConversionRate: item.avgConversionRate,
  }));

  const categoryColumns = [
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string) => <Tag color="gold">{cat}</Tag>,
    },
    {
      title: '商品数',
      dataIndex: 'productCount',
      key: 'productCount',
    },
    {
      title: '总收入',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#d4a017' : undefined }}>
          {v > 0 ? `¥${v.toLocaleString()}` : '-'}
        </Text>
      ),
    },
    {
      title: '平均转化率',
      dataIndex: 'avgConversionRate',
      key: 'avgConversionRate',
      render: (v: number) => (
        <Space size={4}>
          {v >= 0 ? <RiseOutlined style={{ color: '#52c41a' }} /> : <FallOutlined style={{ color: '#ff4d4f' }} />}
          <span>{(v * 100).toFixed(1)}%</span>
        </Space>
      ),
    },
  ];

  const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, percent, name }: any) => {
    if (percent === 0) return null;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#666" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
        {name} {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <GoldDivider />
        <Title level={4} style={{ margin: 0 }}>
          商品数据分析
        </Title>
        <Text type="secondary">全方位掌握商品表现与市场趋势</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={4}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, borderTop: '3px solid #d4a017' }}
          >
            <Statistic
              title="商品总数"
              value={overview.totalProducts}
              prefix={<ShoppingOutlined style={{ color: '#d4a017' }} />}
              valueStyle={{ color: '#d4a017' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, borderTop: '3px solid #52c41a' }}
          >
            <Statistic
              title="活跃竞拍"
              value={overview.activeAuctions}
              prefix={<ThunderboltOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, borderTop: '3px solid #1890ff' }}
          >
            <Statistic
              title="浏览→出价转化率"
              value={(overview.conversionRate * 100).toFixed(1)}
              suffix="%"
              prefix={<SwapRightOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, borderTop: '3px solid #722ed1' }}
          >
            <Statistic
              title="平均成交价"
              value={overview.avgSellingPrice}
              prefix={<DollarOutlined style={{ color: '#722ed1' }} />}
              suffix="元"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, borderTop: `3px solid ${overview.revenueGrowth >= 0 ? '#52c41a' : '#ff4d4f'}` }}
          >
            <Statistic
              title="较上周增长"
              value={Math.abs(overview.revenueGrowth * 100).toFixed(1)}
              suffix="%"
              prefix={
                overview.revenueGrowth >= 0
                  ? <RiseOutlined style={{ color: '#52c41a' }} />
                  : <FallOutlined style={{ color: '#ff4d4f' }} />
              }
              valueStyle={{ color: overview.revenueGrowth >= 0 ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#d4a017' }} />
                <span>热门商品排行</span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
          >
            {topProducts.length > 0 ? (
              <Table
                dataSource={topProducts}
                columns={topProductColumns}
                rowKey="productId"
                pagination={false}
                size="middle"
              />
            ) : (
              <Empty description="暂无商品数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <DollarOutlined style={{ color: '#d4a017' }} />
                <span>当前价格分布</span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
          >
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={renderCustomizedLabel}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={GOLD_COLORS[index % GOLD_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip
                    formatter={(value: any, name: any, props: any) => [
                      `${value} 件 (${props.payload.percentage}%)`,
                      name,
                    ]}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart text="暂无价格分布数据" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <EyeOutlined style={{ color: '#d4a017' }} />
                <span>24小时流量趋势</span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
          >
            {hasTraffic ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trafficLineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="浏览量" stroke="#d4a017" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="出价数" stroke="#52c41a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart text="暂无流量数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ShoppingOutlined style={{ color: '#d4a017' }} />
                <span>当前价格区间分布</span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
          >
            {priceDistribution.some((item) => item.count > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={priceDistChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RTooltip
                    formatter={(value: any, _name: any, props: any) => [
                      `${value} 件 (${props.payload.percentage}%)`,
                      '商品数量',
                    ]}
                  />
                  <Bar dataKey="count" name="商品数量" radius={[4, 4, 0, 0]}>
                    {priceDistChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={GOLD_COLORS[index % GOLD_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart text="暂无价格分布数据" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <DollarOutlined style={{ color: '#d4a017' }} />
                <span>分类收入对比</span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
          >
            {categoryBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RTooltip
                    formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '总收入']}
                  />
                  <Bar dataKey="totalRevenue" name="总收入" fill="#d4a017" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart text="暂无分类收入数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#d4a017' }} />
                <span>分类表现详情</span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
          >
            {categoryPerformance.length > 0 ? (
              <Table
                dataSource={categoryPerformance}
                columns={categoryColumns}
                rowKey="category"
                pagination={false}
                size="middle"
              />
            ) : (
              <Empty description="暂无分类表现数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* AI经营日报 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <Card
            title={
              <Space>
                <RobotOutlined style={{ color: '#d4a017' }} />
                <span>AI 经营日报</span>
                <Tag color="blue">智能分析</Tag>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
            extra={
              <Button
                type="primary"
                icon={<RobotOutlined />}
                loading={aiReportLoading}
                onClick={fetchAIReport}
                size="small"
                style={{ background: '#d4a017', borderColor: '#d4a017' }}
              >
                生成日报
              </Button>
            }
          >
            {aiReport ? (
              <div>
                <Alert
                  message={aiReport.summary}
                  type="info"
                  showIcon
                  style={{ marginBottom: 16, borderRadius: 8 }}
                />
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={12} sm={6}>
                    <Statistic title="今日收入" value={aiReport.metrics.totalRevenue} precision={2} prefix="¥" valueStyle={{ color: '#d4a017' }} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic title="收入变化" value={aiReport.metrics.revenueChange} precision={1} suffix="%" valueStyle={{ color: aiReport.metrics.revenueChange >= 0 ? '#52c41a' : '#ff4d4f' }} prefix={aiReport.metrics.revenueChange >= 0 ? <RiseOutlined /> : <FallOutlined />} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic title="今日订单" value={aiReport.metrics.totalOrders} valueStyle={{ color: '#1677ff' }} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic title="转化率" value={(aiReport.metrics.avgConversionRate * 100).toFixed(1)} suffix="%" valueStyle={{ color: '#722ed1' }} />
                  </Col>
                </Row>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Card size="small" title={<Space><BulbOutlined style={{ color: '#52c41a' }} />今日亮点</Space>} style={{ borderRadius: 8 }}>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {aiReport.highlights.map((h, i) => <li key={i}><Text style={{ fontSize: 13 }}>{h}</Text></li>)}
                      </ul>
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card size="small" title={<Space><RobotOutlined style={{ color: '#d4a017' }} />AI建议</Space>} style={{ borderRadius: 8 }}>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {aiReport.suggestions.map((s, i) => <li key={i}><Text style={{ fontSize: 13 }}>{s}</Text></li>)}
                      </ul>
                    </Card>
                  </Col>
                </Row>
              </div>
            ) : (
              <Empty description="点击「生成日报」，AI将为你生成今日经营分析" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      {/* 竞拍漏斗分析 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FunnelPlotOutlined style={{ color: '#d4a017' }} />
                <span>竞拍漏斗分析</span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
            extra={
              <Button icon={<FunnelPlotOutlined />} loading={funnelLoading} onClick={fetchFunnel} size="small">
                分析漏斗
              </Button>
            }
          >
            {funnel ? (
              <div>
                {funnel.steps.map((step, index) => (
                  <div key={step.step} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 13 }}>{step.label}</Text>
                      <Space>
                        <Text style={{ fontSize: 12 }}>{step.count} 件</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>转化率 {step.rate.toFixed(1)}%</Text>
                      </Space>
                    </div>
                    <Progress
                      percent={step.rate}
                      strokeColor={index === 0 ? '#d4a017' : index === 1 ? '#1677ff' : index === 2 ? '#52c41a' : '#722ed1'}
                      showInfo={false}
                      size="small"
                    />
                    {index < funnel.steps.length - 1 && step.dropoffRate > 0 && (
                      <Text type="secondary" style={{ fontSize: 11 }}>↓ 流失 {step.dropoffRate.toFixed(1)}%</Text>
                    )}
                  </div>
                ))}
                <div style={{ marginTop: 16, padding: '8px 12px', background: '#fff7e6', borderRadius: 8 }}>
                  <Space direction="vertical" size={4}>
                    <Text strong style={{ fontSize: 12 }}>瓶颈环节: {funnel.bottleneck}</Text>
                    <Text style={{ fontSize: 12 }}>{funnel.suggestion}</Text>
                  </Space>
                </div>
              </div>
            ) : (
              <Empty description="点击「分析漏斗」查看竞拍转化漏斗" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        {/* 智能定价建议 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <DollarOutlined style={{ color: '#d4a017' }} />
                <span>智能定价建议</span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
            extra={
              <Button icon={<DollarOutlined />} loading={pricingLoading} onClick={fetchPricingSuggestions} size="small">
                获取建议
              </Button>
            }
          >
            {pricingSuggestions.length > 0 ? (
              <List
                size="small"
                dataSource={pricingSuggestions}
                renderItem={(item) => (
                  <List.Item style={{ padding: '10px 0' }}>
                    <List.Item.Meta
                      title={<Text strong style={{ fontSize: 13 }}>{item.productName}</Text>}
                      description={
                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                          <Text style={{ fontSize: 12 }}>
                            当前起拍价: <Text delete>¥{item.currentStartingPrice}</Text>
                            {' → '}
                            <Text strong style={{ color: '#52c41a' }}>¥{item.suggestedStartingPrice}</Text>
                          </Text>
                          <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{item.reason}</Text>
                          <Tag color={item.confidence > 70 ? 'green' : item.confidence > 40 ? 'orange' : 'red'} style={{ fontSize: 11 }}>
                            置信度 {item.confidence}%
                          </Tag>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="点击「获取建议」，AI将分析需要调价的商品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnalyticsPage;
