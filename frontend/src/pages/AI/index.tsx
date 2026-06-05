import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Input,
  Select,
  Button,
  Space,
  Tag,
  List,
  Modal,
  Form,
  message,
  Tabs,
  Divider,
  Spin,
  Empty,
  Popconfirm,
  Tooltip,
  Alert,
} from 'antd';
import {
  RobotOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  CopyOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  BulbOutlined,
  SendOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { aiAssistantService } from '../../services/ai-assistant.service';
import { auctionService } from '../../services/auction.service';
import {
  DescriptionStyle,
  GenerateDescriptionResponse,
  BroadcastSuggestionResponse,
  ScriptTemplate,
} from '../../types';
import GoldDivider from '../../components/Common/GoldDivider';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const AIAssistantPage: React.FC = () => {
  // Description generation state
  const [descLoading, setDescLoading] = useState(false);
  const [descResult, setDescResult] = useState<GenerateDescriptionResponse | null>(null);
  const [descStyle, setDescStyle] = useState<DescriptionStyle>('professional');
  const [productName, setProductName] = useState('');
  const [productType, setProductType] = useState('');
  const [features, setFeatures] = useState('');
  const [descError, setDescError] = useState<string | null>(null);

  // Broadcast suggestion state
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<BroadcastSuggestionResponse | null>(null);
  const [broadcastAuctionId, setBroadcastAuctionId] = useState<number | null>(null);
  const [broadcastContext, setBroadcastContext] = useState('');
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [auctionOptions, setAuctionOptions] = useState<{ value: number; label: string; status: string }[]>([]);

  // Template state
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ScriptTemplate | null>(null);
  const [templateForm] = Form.useForm();

  // Active tab
  const [activeTab, setActiveTab] = useState('description');

  const loadAuctionOptions = useCallback(async () => {
    try {
      const res = await auctionService.getAuctions({ page: 1, pageSize: 100 });
      setAuctionOptions(
        (res?.items || []).map((a) => ({
          value: a.id,
          label: `竞拍 #${a.id} - ${a.product?.name || '未知商品'}`,
          status: a.status || 'pending',
        }))
      );
    } catch (error) {
      console.error('Failed to load auctions:', error);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true);
    try {
      const data = await aiAssistantService.getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadAuctionOptions();
  }, [loadTemplates, loadAuctionOptions]);

  // Generate description
  const handleGenerateDescription = async () => {
    if (!productName.trim()) {
      message.warning('请输入商品名称');
      return;
    }

    setDescLoading(true);
    setDescError(null);
    try {
      const result = await aiAssistantService.generateDescription({
        productName,
        productType,
        features: features.split(',').filter(Boolean).map((f) => f.trim()),
        style: descStyle,
      });
      setDescResult(result);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'AI 描述生成失败，请稍后重试';
      setDescError(errorMsg);
      message.error(errorMsg);
    } finally {
      setDescLoading(false);
    }
  };

  // Get broadcast suggestions
  const handleBroadcastSuggestion = async () => {
    if (!broadcastAuctionId) {
      message.warning('请输入竞拍 ID');
      return;
    }

    setBroadcastLoading(true);
    setBroadcastError(null);
    try {
      const selectedAuction = auctionOptions.find((a) => a.value === broadcastAuctionId);
      const result = await aiAssistantService.getBroadcastSuggestion(broadcastAuctionId, selectedAuction?.status, broadcastContext);
      setBroadcastResult(result);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || '获取话术建议失败，请稍后重试';
      setBroadcastError(errorMsg);
      message.error(errorMsg);
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Template CRUD
  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    templateForm.resetFields();
    setTemplateModalVisible(true);
  };

  const handleEditTemplate = (template: ScriptTemplate) => {
    setEditingTemplate(template);
    templateForm.setFieldsValue({
      name: template.name,
      content: template.content,
      category: template.category,
    });
    setTemplateModalVisible(true);
  };

  const handleSaveTemplate = async (values: any) => {
    try {
      if (editingTemplate) {
        await aiAssistantService.updateTemplate(editingTemplate.id, values);
        message.success('模板更新成功');
      } else {
        await aiAssistantService.createTemplate(values);
        message.success('模板创建成功');
      }
      setTemplateModalVisible(false);
      loadTemplates();
    } catch (error) {
      message.error('保存模板失败');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await aiAssistantService.deleteTemplate(id);
      message.success('模板删除成功');
      loadTemplates();
    } catch (error) {
      message.error('删除模板失败');
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const handleCopyAllBroadcast = () => {
    if (broadcastResult?.suggestions?.length) {
      const allText = broadcastResult.suggestions.map((s, i) => `${i + 1}. ${s.content}`).join('\n');
      navigator.clipboard.writeText(allText);
      message.success('已复制全部话术到剪贴板');
    }
  };

  const styleOptions = [
    { value: 'professional', label: '专业严谨', color: '#1677ff' },
    { value: 'lively', label: '活泼生动', color: '#52c41a' },
    { value: 'luxury', label: '奢华高端', color: '#d4a017' },
  ];

  const categoryOptions = [
    { value: 'opening', label: '开场白' },
    { value: 'bidding', label: '出价引导' },
    { value: 'closing', label: '结束语' },
    { value: 'interaction', label: '互动话术' },
    { value: 'promotion', label: '促销话术' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <GoldDivider />
        <Title level={4} style={{ margin: 0 }}>
          <RobotOutlined style={{ color: '#d4a017', marginRight: 8 }} />
          AI 智能助手
        </Title>
        <Text type="secondary">利用 AI 提升您的直播竞拍效率</Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'description',
            label: (
              <span>
                <EditOutlined />
                商品描述生成
              </span>
            ),
            children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={10}>
                  <Card
                    title={
                      <Space>
                        <EditOutlined style={{ color: '#d4a017', marginRight: 8 }} />
                        <span>输入商品信息</span>
                      </Space>
                    }
                    bordered={false}
                    style={{ borderRadius: 12 }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size={16}>
                      <div>
                        <Text style={{ marginBottom: 4, display: 'block' }}>商品名称 *</Text>
                        <Input
                          placeholder="输入商品名称"
                          value={productName}
                          onChange={(e) => setProductName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Text style={{ marginBottom: 4, display: 'block' }}>商品类型</Text>
                        <Input
                          placeholder="例如：数码产品、服装、美妆"
                          value={productType}
                          onChange={(e) => setProductType(e.target.value)}
                        />
                      </div>
                      <div>
                        <Text style={{ marginBottom: 4, display: 'block' }}>商品特点 (逗号分隔)</Text>
                        <Input
                          placeholder="例如：轻薄、高性能、长续航"
                          value={features}
                          onChange={(e) => setFeatures(e.target.value)}
                        />
                      </div>
                      <div>
                        <Text style={{ marginBottom: 4, display: 'block' }}>描述风格</Text>
                        <Select
                          value={descStyle}
                          onChange={setDescStyle}
                          style={{ width: '100%' }}
                          options={styleOptions}
                        />
                      </div>
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        loading={descLoading}
                        onClick={handleGenerateDescription}
                        block
                        size="large"
                      >
                        AI 生成描述
                      </Button>
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} lg={14}>
                  <Card
                    title={
                      <Space>
                        <ThunderboltOutlined style={{ color: '#d4a017', marginRight: 8 }} />
                        <span>生成结果</span>
                      </Space>
                    }
                    bordered={false}
                    style={{ borderRadius: 12, minHeight: 400 }}
                    extra={
                      descResult && (
                        <Space>
                          <Tag color={styleOptions.find((s) => s.value === descResult.style)?.color}>
                            {styleOptions.find((s) => s.value === descResult.style)?.label}
                          </Tag>
                          {descResult.cached && <Tag color="orange">缓存</Tag>}
                          <Tooltip title="复制描述">
                            <Button
                              type="text"
                              icon={<CopyOutlined />}
                              onClick={() => handleCopyText(descResult.description)}
                            />
                          </Tooltip>
                          <Tooltip title="重新生成">
                            <Button
                              type="text"
                              icon={<ReloadOutlined />}
                              onClick={handleGenerateDescription}
                            />
                          </Tooltip>
                        </Space>
                      )
                    }
                  >
                    {descLoading ? (
                      <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 24, color: '#d4a017' }} spin />} />
                        <div style={{ marginTop: 16 }}>
                          <Text type="secondary">AI 正在生成描述...</Text>
                        </div>
                      </div>
                    ) : descError ? (
                      <Alert
                        type="error"
                        message="生成失败"
                        description={descError}
                        showIcon
                        action={
                          <Button size="small" onClick={handleGenerateDescription}>
                            重试
                          </Button>
                        }
                      />
                    ) : descResult ? (
                      <div>
                        <Paragraph
                          style={{
                            whiteSpace: 'pre-wrap',
                            fontSize: 14,
                            lineHeight: 1.8,
                            marginBottom: 16,
                          }}
                        >
                          {descResult.description}
                        </Paragraph>
                        <Divider />
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Space>
                            <Button
                              icon={<CopyOutlined />}
                              onClick={() => handleCopyText(descResult.description)}
                            >
                              复制描述
                            </Button>
                          </Space>
                        </div>
                      </div>
                    ) : (
                      <Empty
                        description="输入商品信息后点击生成"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'broadcast',
            label: (
              <span>
                <BulbOutlined />
                直播话术建议
              </span>
            ),
            children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={10}>
                  <Card
                    title={
                      <Space>
                        <BulbOutlined style={{ color: '#d4a017', marginRight: 8 }} />
                        <span>获取话术建议</span>
                      </Space>
                    }
                    bordered={false}
                    style={{ borderRadius: 12 }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size={16}>
                      <div>
                        <Text style={{ marginBottom: 4, display: 'block' }}>竞拍 ID *</Text>
                        <Select
                          placeholder="选择或搜索竞拍"
                          value={broadcastAuctionId}
                          onChange={(v) => setBroadcastAuctionId(v)}
                          showSearch
                          optionFilterProp="label"
                          options={auctionOptions}
                          style={{ width: '100%' }}
                          notFoundContent="暂无可用竞拍"
                        />
                      </div>
                      <div>
                        <Text style={{ marginBottom: 4, display: 'block' }}>上下文 (可选)</Text>
                        <TextArea
                          placeholder="描述当前直播情况，例如：刚开始介绍商品、竞拍进入白热化阶段"
                          rows={3}
                          value={broadcastContext}
                          onChange={(e) => setBroadcastContext(e.target.value)}
                        />
                      </div>
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={broadcastLoading}
                        onClick={handleBroadcastSuggestion}
                        block
                        size="large"
                      >
                        获取话术建议
                      </Button>
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} lg={14}>
                  <Card
                    title={
                      <Space>
                        <BulbOutlined style={{ color: '#d4a017', marginRight: 8 }} />
                        <span>话术建议</span>
                      </Space>
                    }
                    bordered={false}
                    style={{ borderRadius: 12, minHeight: 400 }}
                    extra={
                      broadcastResult && (
                        <Space>
                          <Tag color={broadcastResult.auctionStatus === 'active' ? 'green' : 'default'}>
                            {broadcastResult.auctionStatus === 'active' ? '进行中' : broadcastResult.auctionStatus}
                          </Tag>
                          {broadcastResult.currentPrice && (
                            <Tag color="gold">当前价: ¥{broadcastResult.currentPrice}</Tag>
                          )}
                          {broadcastResult.suggestions?.length > 0 && (
                            <Button
                              type="text"
                              icon={<CopyOutlined />}
                              onClick={handleCopyAllBroadcast}
                            >
                              复制全部
                            </Button>
                          )}
                        </Space>
                      )
                    }
                  >
                    {broadcastLoading ? (
                      <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 24, color: '#d4a017' }} spin />} />
                        <div style={{ marginTop: 16 }}>
                          <Text type="secondary">AI 正在生成话术...</Text>
                        </div>
                      </div>
                    ) : broadcastError ? (
                      <Alert
                        type="error"
                        message="获取失败"
                        description={broadcastError}
                        showIcon
                        action={
                          <Button size="small" onClick={handleBroadcastSuggestion}>
                            重试
                          </Button>
                        }
                      />
                    ) : broadcastResult?.suggestions?.length ? (
                      <div>
                        <List
                          dataSource={broadcastResult.suggestions}
                          renderItem={(item, index) => (
                            <List.Item
                              style={{
                                padding: '12px 16px',
                                background: index % 2 === 0 ? '#fafafa' : '#fff',
                                borderRadius: 8,
                                marginBottom: 8,
                              }}
                              actions={[
                                <Tooltip title="复制话术" key="copy">
                                  <Button
                                    type="text"
                                    icon={<CopyOutlined />}
                                    onClick={() => handleCopyText(item.content)}
                                  />
                                </Tooltip>,
                              ]}
                            >
                              <List.Item.Meta
                                avatar={
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 8,
                                      background: 'linear-gradient(135deg, #d4a017, #f0c040)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#0a0e27',
                                      fontWeight: 700,
                                      fontSize: 14,
                                    }}
                                  >
                                    {index + 1}
                                  </div>
                                }
                                description={
                                  <Text style={{ color: 'rgba(0,0,0,0.85)' }}>{item.content}</Text>
                                }
                              />
                            </List.Item>
                          )}
                        />
                        {broadcastResult.bidCount !== undefined && (
                          <div style={{ marginTop: 16, padding: '8px 12px', background: '#f6ffed', borderRadius: 8 }}>
                            <Space>
                              <Text type="secondary">出价次数：</Text>
                              <Text strong>{broadcastResult.bidCount}</Text>
                            </Space>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Empty
                        description="输入竞拍 ID 后获取话术建议"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'templates',
            label: (
              <span>
                <FileTextOutlined />
                话术模板库
              </span>
            ),
            children: (
              <Card
                title={
                  <Space>
                    <FileTextOutlined style={{ color: '#d4a017', marginRight: 8 }} />
                    <span>话术模板</span>
                  </Space>
                }
                bordered={false}
                style={{ borderRadius: 12 }}
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTemplate}>
                    新建模板
                  </Button>
                }
              >
                <List
                  loading={templateLoading}
                  dataSource={templates}
                  locale={{ emptyText: '暂无模板' }}
                  renderItem={(template) => (
                    <List.Item
                      actions={[
                        <Tooltip title="复制模板" key="copy">
                          <Button
                            type="text"
                            icon={<CopyOutlined />}
                            onClick={() => handleCopyText(template.content)}
                          />
                        </Tooltip>,
                        <Tooltip title="编辑模板" key="edit">
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEditTemplate(template)}
                          />
                        </Tooltip>,
                        <Popconfirm
                          title="确定删除此模板？"
                          onConfirm={() => handleDeleteTemplate(template.id)}
                          key="delete"
                        >
                          <Tooltip title="删除模板">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                          </Tooltip>
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{template.name}</Text>
                            <Tag>{categoryOptions.find((c) => c.value === template.category)?.label || template.category}</Tag>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {template.content.substring(0, 100)}
                            {template.content.length > 100 ? '...' : ''}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Template Modal */}
      <Modal
        title={editingTemplate ? '编辑模板' : '新建模板'}
        open={templateModalVisible}
        onCancel={() => setTemplateModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={templateForm}
          layout="vertical"
          onFinish={handleSaveTemplate}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="输入模板名称" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="选择分类" options={categoryOptions} />
          </Form.Item>
          <Form.Item name="content" label="模板内容" rules={[{ required: true, message: '请输入模板内容' }]}>
            <TextArea rows={6} placeholder="输入话术模板内容" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setTemplateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingTemplate ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AIAssistantPage;
