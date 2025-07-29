// ===================================================
// ФАЙЛ: frontend/src/components/Layout/Header.jsx
// ===================================================
import React from 'react';
import { Layout, Space, Dropdown, Avatar, Tag, Button, Typography, theme } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  BellOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { USER_ROLE_LABELS, USER_ROLE_COLORS } from '../../utils/constants';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isAdmin } = usePermissions();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Профиль',
      onClick: () => navigate('/settings/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider',
    },
    {
      key: 'help',
      icon: <QuestionCircleOutlined />,
      label: 'Помощь',
      onClick: () => window.open('https://help.moduletrade.ru', '_blank'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Выйти',
      onClick: logout,
    },
  ];

  return (
    <AntHeader
      style={{
        background: colorBgContainer,
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #f0f0f0',
        boxShadow: '0 1px 4px rgba(0,21,41,.08)',
      }}
    >
      {/* Левая часть - информация о тенанте */}
      <div>
        <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
          ModuleTrade
        </Text>
        {user?.tenant?.name && (
          <Text type="secondary" style={{ marginLeft: 12 }}>
            • {user.tenant.name}
          </Text>
        )}
        {isAdmin() && (
          <Tag color="red" style={{ marginLeft: 12 }}>
            Admin
          </Tag>
        )}
      </div>

      {/* Правая часть - уведомления и профиль */}
      <Space size="large">
        {/* Уведомления */}
        <Button
          type="text"
          icon={<BellOutlined />}
          style={{ fontSize: 16 }}
          onClick={() => navigate('/notifications')}
        />

        {/* Профиль пользователя */}
        <Space>
          <div style={{ textAlign: 'right' }}>
            <div>
              <Text strong>{user?.name || user?.email}</Text>
            </div>
            <div>
              <Tag
                color={USER_ROLE_COLORS[user?.role]}
                size="small"
              >
                {USER_ROLE_LABELS[user?.role] || user?.role}
              </Tag>
            </div>
          </div>

          <Dropdown
            menu={{ items: userMenuItems }}
            placement="bottomRight"
            trigger={['click']}
          >
            <Avatar
              icon={<UserOutlined />}
              style={{
                cursor: 'pointer',
                backgroundColor: '#1890ff',
              }}
            />
          </Dropdown>
        </Space>
      </Space>
    </AntHeader>
  );
};

export default Header;