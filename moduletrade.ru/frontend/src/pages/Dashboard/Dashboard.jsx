// frontend/src/pages/Dashboard/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Table,
  Tag,
  Space,
  Button,
  Progress,
  List,
  Avatar,
  Divider,
  Badge,
} from 'antd';
import {
  ShoppingOutlined,
  ShopOutlined,
  DollarOutlined,
  SyncOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ShoppingCartOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'utils/axios';
import { api } from 'services';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [syncStatus, setSyncStatus] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Используем правильные API сервисы
      const [statsRes, ordersRes, stockRes, syncRes] = await Promise.allSettled([
        api.analytics.getDashboard(),
        api.orders.getOrders({ limit: 5, sort: 'created_at:desc' }),
        api.products.getProducts({ limit: 5, low_stock: true }),
        api.sync.getSyncStatus(),
      ]);

      // Обрабатываем результаты
      setStatistics(statsRes.status === 'fulfilled' ? statsRes.value : {});
      setRecentOrders(ordersRes.status === 'fulfilled' ? ordersRes.value.items || [] : []);
      setLowStockProducts(stockRes.status === 'fulfilled' ? stockRes.value.items || [] : []);
      setSyncStatus(syncRes.status === 'fulfilled' ? syncRes.value || [] : []);
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      // Показываем заглушку с демо-данными если API недоступно
      setStatistics({
        totalProducts: 1250,
        totalOrders: 156,
        totalRevenue: 125000,
        syncStatus: 'success'
      });
      setRecentOrders([
        {
          id: '1',
          order_number: 'ORD-001',
          status: 'delivered',
          total: 2500,
          created_at: new Date().toISOString(),
          marketplace: 'Ozon'
        }
      ]);
      setLowStockProducts([
        {
          id: '1',
          name: 'Товар с низким остатком',
          stock: 5,
          min_stock: 10
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Колонки для таблицы заказов
  const orderColumns = [
    {
      title: 'Номер заказа',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (text, record) => (
        <Button
          type="link"
          onClick={() => navigate(`/orders/${record.id}`)}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          pending: { color: 'orange', text: 'В обработке' },
          confirmed: { color: 'blue', text: 'Подтвержден' },
          shipped: { color: 'cyan', text: 'Отправлен' },
          delivered: { color: 'green', text: 'Доставлен' },
          cancelled: { color: 'red', text: 'Отменен' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Сумма',
      dataIndex: 'total',
      key: 'total',
      render: (total) => `₽${Number(total || 0).toLocaleString()}`,
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
  ];

  // Колонки для товаров с низким остатком
  const stockColumns = [
    {
      title: 'Товар',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Button
          type="link"
          onClick={() => navigate(`/products/${record.id}`)}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Остаток',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock, record) => (
        <Text type={stock <= (record.min_stock || 0) ? 'danger' : 'warning'}>
          {stock}
        </Text>
      ),
    },
    {
      title: 'Мин. остаток',
      dataIndex: 'min_stock',
      key: 'min_stock',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Панель управления</Title>

      {/* Основная статистика */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Всего товаров"
              value={statistics.totalProducts || 0}
              prefix={<ShoppingOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Заказов за месяц"
              value={statistics.totalOrders || 0}
              prefix={<ShoppingCartOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Выручка за месяц"
              value={statistics.totalRevenue || 0}
              prefix={<DollarOutlined />}
              precision={0}
              formatter={(value) => `₽${Number(value).toLocaleString()}`}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Статус синхронизации"
              value={statistics.syncStatus === 'success' ? 'Активна' : 'Проблемы'}
              prefix={
                statistics.syncStatus === 'success' ?
                <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                <AlertOutlined style={{ color: '#ff4d4f' }} />
              }
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* Недавние заказы и низкие остатки */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="Недавние заказы"
            extra={
              <Button type="primary" onClick={() => navigate('/orders')}>
                Все заказы
              </Button>
            }
          >
            <Table
              columns={orderColumns}
              dataSource={recentOrders}
              pagination={false}
              loading={loading}
              size="small"
              locale={{ emptyText: 'Нет данных' }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="Товары с низким остатком"
            extra={
              <Button type="primary" onClick={() => navigate('/products')}>
                Все товары
              </Button>
            }
          >
            <Table
              columns={stockColumns}
              dataSource={lowStockProducts}
              pagination={false}
              loading={loading}
              size="small"
              locale={{ emptyText: 'Нет данных' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Быстрые действия */}
      <Card title="Быстрые действия" style={{ marginTop: '24px' }}>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/products/new')}
          >
            Добавить товар
          </Button>
          <Button
            icon={<SyncOutlined />}
            onClick={() => navigate('/sync')}
          >
            Синхронизация
          </Button>
          <Button
            icon={<ShopOutlined />}
            onClick={() => navigate('/marketplaces')}
          >
            Маркетплейсы
          </Button>
          <Button
            icon={<DollarOutlined />}
            onClick={() => navigate('/analytics')}
          >
            Аналитика
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default Dashboard;