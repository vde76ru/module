// ===================================================
// ФАЙЛ: frontend/src/components/Layout/Header.jsx
// ✅ ИСПРАВЛЕНО: Заменен импорт AuthContext на новый useAuth хук
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

// ✅ ИСПРАВЛЕНО: Заменен contexts/AuthContext на hooks/useAuth
import { useAuth } from 'hooks/useAuth';
import { usePermissions } from 'hooks/usePermissions';
import { api } from 'services';
import { useEffect, useState } from 'react';
import { USER_ROLE_LABELS, USER_ROLE_COLORS } from 'utils/constants';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const Header = () => {
  const navigate = useNavigate();
  const { user, company, logout } = useAuth();
  const [billing, setBilling] = useState(null);
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const usage = await api.billing.getUsage().catch(() => null);
        if (mounted) setBilling(usage || null);
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, []);

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
        {(company?.name || user?.company_name) && (
          <Text type="secondary" style={{ marginLeft: 12 }}>
            • {company?.name || user?.company_name}
          </Text>
        )}
        {isAdmin() && (
          <Tag color="red" style={{ marginLeft: 12 }}>
            Admin
          </Tag>
        )}
      </div>

      {/* Правая часть - уведомления и профиль */}
      <Space size="middle">
        {/* Информация о подписке/лимитах */}
        {company && (
          <Space>
            <Tag color={company.subscription_status === 'trial' ? 'gold' : 'green'}>
              {company.subscription_status === 'trial' ? 'Пробный период' : 'Подписка активна'}
            </Tag>
            {billing?.api?.limit && (
              <Tag color={billing.api.total_requests >= (billing.api.limit * 0.9) ? 'red' : 'blue'}>
                API {billing.api.total_requests}/{billing.api.limit}
              </Tag>
            )}
            {billing?.products?.limit && (
              <Tag color={billing.products.count >= (billing.products.limit * 0.9) ? 'red' : 'green'}>
                Товары {billing.products.count}/{billing.products.limit}
              </Tag>
            )}
          </Space>
        )}
        {/* Уведомления */}
        <Button
          type="text"
          icon={<BellOutlined />}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />

        {/* Профиль пользователя */}
        <Dropdown
          menu={{ items: userMenuItems }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Space style={{ cursor: 'pointer' }}>
            <Avatar size="small" icon={<UserOutlined />} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Text strong style={{ lineHeight: '16px', fontSize: '14px' }}>
                {user?.name || user?.email || 'Пользователь'}
              </Text>
              {user?.role && (
                <Text
                  type="secondary"
                  style={{
                    lineHeight: '12px',
                    fontSize: '12px',
                    color: USER_ROLE_COLORS[user.role] || '#666',
                  }}
                >
                  {USER_ROLE_LABELS[user.role] || user.role}
                </Text>
              )}
            </div>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default Header;