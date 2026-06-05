import React, { useEffect } from 'react';
import {
  Card,
  Typography,
  Tag,
  Descriptions,
  Image,
  Button,
  Space,
  Divider,
  Row,
  Col,
  Spin,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  PictureOutlined,
  TagOutlined,
  LoadingOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { fetchProduct, clearCurrentProduct } from '../../store/slices/productSlice';
import { formatPrice, formatDate, statusColors, productStatusLabels } from '../../utils/hooks';
import GoldDivider from '../../components/Common/GoldDivider';

const { Title, Text, Paragraph } = Typography;

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentProduct: product, detailLoading: loading, detailError } = useAppSelector((state) => state.products);

  useEffect(() => {
    if (id) {
      dispatch(fetchProduct(Number(id)));
    }
    return () => {
      dispatch(clearCurrentProduct());
    };
  }, [dispatch, id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 24, color: '#d4a017' }} spin />} />
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Empty description={detailError || '商品不存在'} />
        <Button type="primary" onClick={() => navigate('/merchant/products')} style={{ marginTop: 16 }}>
          返回商品列表
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/merchant/products')}
          />
          <div>
            <GoldDivider />
            <Title level={4} style={{ margin: 0 }}>
              商品详情
            </Title>
            <Text type="secondary">查看商品详细信息</Text>
          </div>
        </Space>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => navigate('/merchant/products')}
          disabled={product.status !== 'pending'}
        >
          编辑商品
        </Button>
      </div>

      <Row gutter={24}>
        {/* Left: Images */}
        <Col xs={24} lg={10}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            {product.images && product.images.length > 0 ? (
              <div>
                <Image.PreviewGroup>
                  <Image
                    src={product.images[0]}
                    width="100%"
                    style={{ borderRadius: 8, objectFit: 'cover', maxHeight: 400 }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGVIMDCAlxmbzmCIHFEBEFMAoKDSAYN0fERHRUYAIYnMZAoYPk0E7PABNk/A7A/gzALYFhcKWDQMHB0ycA05AYJ8YGgAE9dg3HBwSAxIQ0hDP0F0Q4JN6OIgyXoIR4khKSgAO58OjkBKhhAAAAAElFTkSuQmCC"
                  />
                  {product.images.length > 1 && (
                    <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                      {product.images.slice(1).map((img, index) => (
                        <Col span={6} key={index}>
                          <Image
                            src={img}
                            width="100%"
                            height={60}
                            style={{ borderRadius: 4, objectFit: 'cover' }}
                          />
                        </Col>
                      ))}
                    </Row>
                  )}
                </Image.PreviewGroup>
              </div>
            ) : (
              <div
                style={{
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f5f5f5',
                  borderRadius: 8,
                }}
              >
                <PictureOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <Text type="secondary" style={{ marginLeft: 8 }}>暂无图片</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Right: Info */}
        <Col xs={24} lg={14}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Tag color={statusColors[product.status]} style={{ fontSize: 14, padding: '2px 12px' }}>
                  {productStatusLabels[product.status]}
                </Tag>
              </Space>
              <Title level={3} style={{ margin: '8px 0 0 0' }}>
                {product.name}
              </Title>
            </div>

            <Divider />

            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item
                label={
                  <Space>
                    <DollarOutlined />
                    <span>起拍价</span>
                  </Space>
                }
              >
                <Text strong style={{ fontSize: 20, color: '#d4a017' }}>
                  {formatPrice(product.startingPrice)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <Space>
                    <TagOutlined />
                    <span>加价幅度</span>
                  </Space>
                }
              >
                <Text>{formatPrice(product.priceIncrement)}</Text>
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <Space>
                    <ClockCircleOutlined />
                    <span>竞拍时长</span>
                  </Space>
                }
              >
                <Text>{product.duration} 分钟</Text>
              </Descriptions.Item>
              {product.capPrice && (
                <Descriptions.Item label="封顶价">
                  <Text>{formatPrice(product.capPrice)}</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="延时时间">
                <Text>{product.delayTime || 10} 秒</Text>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                <Text type="secondary">{formatDate(product.createdAt)}</Text>
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <Space>
                    <AppstoreOutlined />
                    <span>分类</span>
                  </Space>
                }
              >
                {product.category ? (
                  <Tag color="gold">{product.category.name}</Tag>
                ) : (
                  <Text type="secondary">未分类</Text>
                )}
              </Descriptions.Item>
              {product.tags && product.tags.length > 0 && (
                <Descriptions.Item label="标签">
                  <Space size={[4, 4]} wrap>
                    {product.tags.map((tag) => (
                      <Tag key={tag} icon={<TagOutlined />}>{tag}</Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>

            {product.description && (
              <>
                <Divider />
                <div>
                  <Text strong style={{ marginBottom: 8, display: 'block' }}>商品描述</Text>
                  <Paragraph
                    style={{
                      background: '#fafafa',
                      padding: 16,
                      borderRadius: 8,
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                    }}
                  >
                    {product.description}
                  </Paragraph>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProductDetailPage;
