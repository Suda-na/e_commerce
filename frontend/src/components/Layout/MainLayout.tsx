import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
  OrderedListOutlined,
  RobotOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { logout } from '../../store/slices/authSlice';
import NotificationBell from '../Notification/NotificationBell';
import NotificationProvider from '../Notification/NotificationProvider';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const menuItems = [
    {
      key: '/merchant/dashboard',
      icon: <DashboardOutlined />,
      label: '数据看板',
    },
    {
      key: '/merchant/products',
      icon: <ShoppingOutlined />,
      label: '商品管理',
    },
    {
      key: '/merchant/auctions',
      icon: <ThunderboltOutlined />,
      label: '竞拍管理',
    },
    {
      key: '/merchant/orders',
      icon: <OrderedListOutlined />,
      label: '订单管理',
    },
    {
      key: '/merchant/ai-assistant',
      icon: <RobotOutlined />,
      label: 'AI 助手',
    },
    {
      key: '/merchant/live-room',
      icon: <VideoCameraOutlined />,
      label: '直播间',
    },
    {
      key: '/merchant/analytics',
      icon: <BarChartOutlined />,
      label: '数据分析',
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      dispatch(logout());
      navigate('/login');
    } else if (key === 'profile') {
      navigate('/merchant/profile');
    }
  };

  const selectedKey = location.pathname.startsWith('/merchant')
    ? '/merchant/' + location.pathname.split('/')[2]
    : location.pathname;

  return (
    <NotificationProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={240}
          collapsedWidth={80}
          style={{
            background: 'linear-gradient(180deg, #0a0e27 0%, #141833 50%, #0f1229 100%)',
            borderRight: '1px solid rgba(255, 215, 0, 0.08)',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            overflow: 'auto',
          }}
        >
          {/* Logo */}
          <div
            style={{
              height: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
              padding: '0 16px',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #d4a017 0%, #f0c040 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 800,
                color: '#0a0e27',
                boxShadow: '0 4px 16px rgba(212, 160, 23, 0.3)',
                flexShrink: 0,
              }}
            >
              拍
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#f0c040',
                    lineHeight: 1.2,
                    letterSpacing: '0.05em',
                  }}
                >
                  实时竞拍大师
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em' }}>
                  MERCHANT CONSOLE
                </div>
              </div>
            )}
          </div>

          {/* Menu */}
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '16px 8px',
            }}
            theme="dark"
          />

          {/* Bottom Info */}
          {!collapsed && (
            <div
              style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                right: 16,
                padding: 12,
                borderRadius: 8,
                background: 'rgba(255, 215, 0, 0.04)',
                border: '1px solid rgba(255, 215, 0, 0.08)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                系统版本 v1.0.0
              </Text>
            </div>
          )}
        </Sider>

        <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
          {/* Header */}
          <Header
            style={{
              padding: '0 24px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              zIndex: 99,
              height: 64,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
                style: { fontSize: 18, cursor: 'pointer', color: '#555' },
                onClick: () => setCollapsed(!collapsed),
              })}
            </div>

            <Space size={20}>
              <NotificationBell />

              <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar
                    size={32}
                    src={user?.avatar}
                    icon={<UserOutlined />}
                    style={{
                      background: user?.avatar ? 'transparent' : 'linear-gradient(135deg, #d4a017, #f0c040)',
                      color: '#0a0e27',
                    }}
                  />
                  <Text strong style={{ maxWidth: 100 }}>
                    {user?.username || '商家'}
                  </Text>
                </Space>
              </Dropdown>
            </Space>
          </Header>

          {/* Content */}
          <Content
            style={{
              margin: 24,
              minHeight: 280,
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </NotificationProvider>
  );
};

export default MainLayout;
