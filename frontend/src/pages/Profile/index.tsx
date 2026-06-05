import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Avatar,
  Space,
  message,
  Divider,
  Row,
  Col,
  Statistic,
  Upload,
  Table,
  Tag,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  SaveOutlined,
  ShopOutlined,
  PlusOutlined,
  LoadingOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAppSelector, useAppDispatch } from '../../utils/hooks';
import { getProfile } from '../../store/slices/authSlice';
import { authService } from '../../services/auth.service';
import GoldDivider from '../../components/Common/GoldDivider';
import api from '../../services/api';

const { Title, Text } = Typography;

const ProfilePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatar);
  const [uploading, setUploading] = useState(false);

  // AI连接测试相关状态
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    connected?: boolean;
    model?: string;
    endpointId?: string;
    latency?: number;
    status?: string;
    error?: string;
  } | null>(null);

  const handleEdit = () => {
    setEditing(true);
    setAvatarUrl(user?.avatar);
    form.setFieldsValue({
      username: user?.username,
    });
  };

  const handleCancel = () => {
    setEditing(false);
    form.resetFields();
    setAvatarUrl(user?.avatar);
  };

  const handleAvatarUpload = async (info: any) => {
    if (info.file.status === 'uploading') {
      setUploading(true);
      return;
    }
    if (info.file.status === 'done') {
      setUploading(false);
      // 从响应中获取URL
      const response = info.file.response;
      let url = '';
      // 专用头像上传端点返回格式：{ success: true, data: { url: "...", user: {...} } }
      if (response?.data?.url) {
        url = response.data.url;
      } else if (response?.url) {
        url = response.url;
      }
      if (url) {
        setAvatarUrl(url);
        // 刷新Redux store，使header和profile卡片立即显示新头像
        dispatch(getProfile());
        message.success('头像上传成功');
      }
    } else if (info.file.status === 'error') {
      setUploading(false);
      message.error('头像上传失败');
    }
  };

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      await authService.updateProfile({ ...values, avatar: avatarUrl });
      dispatch(getProfile());
      message.success('个人信息更新成功');
      setEditing(false);
    } catch (error: any) {
      message.error(error?.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAiTest = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const [statusRes, healthRes] = await Promise.allSettled([
        api.get('/ai/status'),
        api.get('/ai/health'),
      ]);

      const statusData = statusRes.status === 'fulfilled' ? statusRes.value.data?.data : null;
      const healthData = healthRes.status === 'fulfilled' ? healthRes.value.data?.data : null;

      const connected = statusData?.connected ?? false;
      const result: typeof aiTestResult = {
        connected,
        model: statusData?.model || '-',
        endpointId: statusData?.endpointId || '-',
        latency: statusData?.latency,
        status: healthData?.status || (connected ? 'healthy' : 'unhealthy'),
        error: !connected
          ? (statusRes.status === 'rejected' ? statusRes.reason?.response?.data?.error?.message : '连接失败')
          : undefined,
      };

      setAiTestResult(result);
      if (connected) {
        message.success(`AI连接测试成功，延迟 ${result.latency}ms`);
      } else {
        message.error('AI连接测试失败');
      }
    } catch (error: any) {
      setAiTestResult({
        connected: false,
        error: error?.response?.data?.error?.message || error?.message || '连接失败',
        status: 'unhealthy',
      });
      message.error('AI连接测试失败');
    } finally {
      setAiTesting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <GoldDivider />
        <Title level={4} style={{ margin: 0 }}>
          个人信息
        </Title>
        <Text type="secondary">管理您的商家账号信息</Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Profile Card */}
        <Col xs={24} lg={8}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Avatar
                size={120}
                src={user?.avatar}
                icon={<UserOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #d4a017 0%, #f0c040 100%)',
                  color: '#0a0e27',
                  fontSize: 48,
                  marginBottom: 16,
                }}
              />
              <Title level={4} style={{ margin: '8px 0 4px' }}>
                {user?.username || '商家'}
              </Title>
              <Text type="secondary">商家账号</Text>
              
              <Divider />
              
              <div style={{ textAlign: 'left' }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">用户ID</Text>
                    <Text>{user?.id || '-'}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">角色</Text>
                    <Text>{user?.role === 'merchant' ? '商家' : '用户'}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">注册时间</Text>
                    <Text>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}</Text>
                  </div>
                </Space>
              </div>
            </div>
          </Card>
        </Col>

        {/* Edit Form */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <ShopOutlined style={{ color: '#d4a017' }} />
                <span>账号信息</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
            extra={
              !editing && (
                <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
                  编辑信息
                </Button>
              )
            }
          >
            {editing ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                initialValues={{
                  username: user?.username,
                }}
              >
                <Form.Item
                  name="username"
                  label="用户名"
                  rules={[
                    { required: true, message: '请输入用户名' },
                    { min: 5, message: '用户名至少5个字符' },
                    { max: 50, message: '用户名最多50个字符' },
                  ]}
                >
                  <Input prefix={<UserOutlined />} placeholder="输入用户名" />
                </Form.Item>

                <Form.Item label="头像">
                  <Upload
                    listType="picture-card"
                    maxCount={1}
                    action={`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/avatar`}
                    headers={{
                      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
                    }}
                    name="avatar"
                    accept="image/*"
                    showUploadList={false}
                    onChange={handleAvatarUpload}
                    beforeUpload={(file) => {
                      const isImage = file.type.startsWith('image/');
                      const isLt5M = file.size / 1024 / 1024 <= 5;
                      if (!isImage) {
                        message.error('只能上传图片文件！');
                        return Upload.LIST_IGNORE;
                      }
                      if (!isLt5M) {
                        message.error('图片大小不能超过 5MB！');
                        return Upload.LIST_IGNORE;
                      }
                      return true;
                    }}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div>
                        {uploading ? <LoadingOutlined /> : <PlusOutlined />}
                        <div style={{ marginTop: 8, fontSize: 12 }}>上传头像</div>
                      </div>
                    )}
                  </Upload>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                    支持 jpg/png 格式，大小不超过 5MB
                  </Text>
                </Form.Item>

                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                      保存修改
                    </Button>
                    <Button onClick={handleCancel}>取消</Button>
                  </Space>
                </Form.Item>
              </Form>
            ) : (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>用户名</Text>
                  <Text strong style={{ fontSize: 16 }}>{user?.username || '-'}</Text>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>头像</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Avatar
                      size={80}
                      src={user?.avatar}
                      icon={<UserOutlined />}
                      style={{
                        background: user?.avatar ? 'transparent' : '#d4a017',
                        color: '#0a0e27',
                        border: '2px solid #f0f0f0',
                      }}
                    />
                    <div>
                      <Text strong style={{ display: 'block' }}>
                        {user?.avatar ? '已设置头像' : '未设置头像'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {user?.avatar ? '头像上传成功' : '点击编辑信息上传头像'}
                      </Text>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>账号状态</Text>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      background: '#f6ffed',
                      border: '1px solid #b7eb8f',
                      borderRadius: 6,
                      color: '#52c41a',
                    }}
                  >
                    正常
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Account Stats */}
          <Card
            title={
              <Space>
                <ShopOutlined style={{ color: '#d4a017' }} />
                <span>账号统计</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, marginTop: 16 }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Statistic title="账号类型" value="商家" />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic title="账号状态" value="正常" valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic title="登录次数" value={user?.loginCount ?? 0} />
              </Col>
            </Row>
          </Card>

          {/* AI Connection Test */}
          <Card
            title={
              <Space>
                <ApiOutlined style={{ color: '#d4a017' }} />
                <span>AI 连接测试</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, marginTop: 16 }}
            extra={
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleAiTest}
                loading={aiTesting}
              >
                测试连接
              </Button>
            }
          >
            <Table
              dataSource={[
                { key: 'status', label: '连接状态', value: aiTestResult ? (aiTestResult.connected ? '已连接' : '未连接') : '未测试' },
                { key: 'model', label: 'AI 模型', value: aiTestResult?.model || '-' },
                { key: 'endpointId', label: '端点 ID', value: aiTestResult?.endpointId || '-' },
                { key: 'latency', label: '响应延迟', value: aiTestResult?.latency != null ? `${aiTestResult.latency}ms` : '-' },
                { key: 'health', label: '健康状态', value: aiTestResult?.status || '-' },
                { key: 'error', label: '错误信息', value: aiTestResult?.error || '-' },
              ]}
              columns={[
                {
                  title: '项目',
                  dataIndex: 'label',
                  key: 'label',
                  width: '30%',
                  render: (text: string) => <Text strong>{text}</Text>,
                },
                {
                  title: '结果',
                  dataIndex: 'value',
                  key: 'value',
                  render: (text: string, record: any) => {
                    if (record.key === 'status') {
                      if (!aiTestResult) return <Tag>未测试</Tag>;
                      return aiTestResult.connected
                        ? <Tag icon={<CheckCircleOutlined />} color="success">已连接</Tag>
                        : <Tag icon={<CloseCircleOutlined />} color="error">未连接</Tag>;
                    }
                    if (record.key === 'health') {
                      if (!aiTestResult) return <Tag>未测试</Tag>;
                      const colorMap: Record<string, string> = { healthy: 'success', degraded: 'warning', unhealthy: 'error' };
                      return <Tag color={colorMap[aiTestResult.status!] || 'default'}>{text}</Tag>;
                    }
                    if (record.key === 'latency' && aiTestResult?.latency != null) {
                      const latency = aiTestResult.latency!;
                      const color = latency < 1000 ? '#52c41a' : latency < 3000 ? '#faad14' : '#ff4d4f';
                      return <Text style={{ color }}>{text}</Text>;
                    }
                    if (record.key === 'error' && aiTestResult?.error) {
                      return <Text type="danger">{text}</Text>;
                    }
                    return <Text>{text}</Text>;
                  },
                },
              ]}
              pagination={false}
              size="small"
              bordered
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProfilePage;