import React from 'react';
import { Menu, Spin } from 'antd'; // Импортируем Spin для индикатора загрузки
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux'; // Импортируем useSelector
import {
  DashboardOutlined,
  ShoppingOutlined,
  ShopOutlined,
  HomeOutlined,
  TruckOutlined,
  TeamOutlined,
  BarChartOutlined,
  SyncOutlined,
  SettingOutlined,
} from '@ant-design/icons';

import { usePermissions } from 'hooks/usePermissions';
import { PERMISSIONS } from 'utils/constants';

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, isAdmin } = usePermissions();

  // Получаем состояние аутентификации из Redux
  const { user, loading } = useSelector(state => state.auth);

  // ==================================================================
  //                        ВОТ ИСПРАВЛЕНИЕ
  // ==================================================================
  // Если данные пользователя еще загружаются или отсутствуют,
  // мы не пытаемся строить меню, а показываем индикатор загрузки.
  // Это предотвращает любые ошибки, связанные с отсутствием user.permissions.
  if (loading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin />
      </div>
    );
  }
  // ==================================================================


  // Определяем активный ключ на основе текущего пути
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/products')) return '/products';
    if (path.startsWith('/orders')) return '/orders';
    if (path.startsWith('/marketplaces')) return '/marketplaces';
    if (path.startsWith('/warehouses')) return '/warehouses';
    if (path.startsWith('/suppliers')) return '/suppliers';
    if (path.startsWith('/sync')) return '/sync';
    if (path.startsWith('/analytics')) return '/analytics';
    if (path.startsWith('/users')) return '/users';
    if (path.startsWith('/settings')) return '/settings';
    return '/dashboard';
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Дашборд',
      show: true,
    },
    {
      key: '/products',
      icon: <ShoppingOutlined />,
      label: 'Товары',
      show: hasPermission(PERMISSIONS.PRODUCTS_VIEW),
    },
    {
      key: '/orders',
      icon: <ShopOutlined />,
      label: 'Заказы',
      show: hasPermission(PERMISSIONS.ORDERS_VIEW),
    },
    {
      key: '/marketplaces',
      icon: <HomeOutlined />,
      label: 'Маркетплейсы',
      show: hasPermission(PERMISSIONS.MARKETPLACES_VIEW),
    },
    {
      key: '/warehouses',
      icon: <HomeOutlined />,
      label: 'Склады',
      show: hasPermission(PERMISSIONS.WAREHOUSES_VIEW),
    },
    {
      key: '/suppliers',
      icon: <TruckOutlined />,
      label: 'Поставщики',
      show: hasPermission(PERMISSIONS.SUPPLIERS_VIEW),
    },
    {
      key: '/sync',
      icon: <SyncOutlined />,
      label: 'Синхронизация',
      show: hasPermission(PERMISSIONS.SYNC_EXECUTE),
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: 'Аналитика',
      show: hasPermission(PERMISSIONS.ANALYTICS_VIEW),
    },
    {
      key: '/users',
      icon: <TeamOutlined />,
      label: 'Пользователи',
      show: isAdmin(),
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
      show: true, // Настройки доступны всем
    },
  ].filter(item => item.show);

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  return (
    <div>
      {/* Логотип */}
      <div style={{
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: collapsed ? '16px' : '18px',
        fontWeight: 'bold',
        borderBottom: '1px solid #404040',
        marginBottom: '16px',
      }}>
        {collapsed ? 'MT' : 'ModuleTrade'}
      </div>

      {/* Меню */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[getSelectedKey()]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ border: 'none' }}
      />
    </div>
  );
};

export default Sidebar;
