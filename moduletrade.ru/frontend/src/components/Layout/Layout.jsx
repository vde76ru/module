// frontend/src/components/Layout/Layout.jsx
import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Typography, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  ShoppingOutlined,
  ShopOutlined,
  SyncOutlined,
  BarChartOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { logout } from 'store/authSlice';
import './Layout.css';

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  // Меню навигации
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Дашборд',
    },
    {
      key: '/products',
      icon: <ShoppingOutlined />,
      label: 'Товары',
    },
    {
      key: '/warehouses',
      icon: <ShopOutlined />,
      label: 'Склады',
    },
    {
      key: '/orders',
      icon: <ShoppingCartOutlined />,
      label: 'Заказы',
    },
    {
      key: '/sync',
      icon: <SyncOutlined />,
      label: 'Синхронизация',
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: 'Аналитика',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
    },
  ];

  // Меню пользователя
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Профиль',
      onClick: () => navigate('/settings/profile'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Выйти',
      onClick: handleLogout,
    },
  ];

  function handleLogout() {
    dispatch(logout());
    navigate('/login');
  }

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  return (
    <AntLayout className="layout-container">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="layout-sider"
        width={240}
        collapsedWidth={80}
      >
        <div className="layout-logo">
          <img
            src="/logo.png"
            alt="ModuleTrade"
            className="logo-image"
          />
          {!collapsed && (
            <Text className="logo-text">ModuleTrade</Text>
          )}
        </div>
        
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="layout-menu"
        />
      </Sider>

      <AntLayout>
        <Header className="layout-header">
          <div className="header-left">
            <div
              className="trigger-btn"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
          </div>

          <div className="header-right">
            <Badge count={5} className="notification-btn">
              <BellOutlined style={{ fontSize: '18px' }} />
            </Badge>

            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
            >
              <div className="user-info">
                <Avatar
                  size={32}
                  icon={<UserOutlined />}
                  className="user-avatar"
                />
                <div className="user-details">
                  <Text strong>{user?.name || 'Пользователь'}</Text>
                  <Text type="secondary" className="user-role">
                    {user?.role || 'Менеджер'}
                  </Text>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="layout-content">
          <div className="content-wrapper">
            {children}
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;