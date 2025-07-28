// frontend/src/pages/Dashboard.jsx
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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'utils/axios';
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
      const [statsRes, ordersRes, stockRes, syncRes] = await Promise.all([
        axios.get('/api/analytics/dashboard'),
        axios.get('/api/orders?limit=5&sort=created_at:desc'),
        axios.get('/api/products?limit=5&low_stock=true'),
        axios.get('/api/sync/status'),
      ]);

      setStatistics(statsRes.data);
      setRecentOrders(ordersRes.data.items || []);
      setLowStockProducts(stockRes.data.items || []);
      setSyncStatus(syncRes.data || []);
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
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
      title: 'Маркетплейс',
      dataIndex: ['marketplace', 'name'],
      key: 'marketplace',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Сумма',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (value) => `₽${value?.toLocaleString()}`,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          new: { color: 'orange', text: 'Новый' },
          paid: { color: 'green', text: 'Оплачен' },
          shipped: { color: 'blue', text: 'Отправлен' },
          delivered: { color: 'success', text: 'Доставлен' },
          cancelled: { color: 'red', text: 'Отменен' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value) => dayjs(value).format('DD.MM.YYYY HH:mm'),
    },
  ];

  return (
    <div>
      <Title level={2}>Дашборд</Title>

      {/* Основная статистика */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Всего товаров"
              value={statistics.total_products || 0}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Активных складов"
              value={statistics.active_warehouses || 0}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Заказов за месяц"
              value={statistics.monthly_orders || 0}
              prefix={<ShoppingCartOutlined />}
              suffix={
                <ArrowUpOutlined style={{ color: '#52c41a', fontSize: 12 }} />
              }
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Выручка за месяц"
              value={statistics.monthly_revenue || 0}
              prefix={<DollarOutlined />}
              suffix="₽"
              precision={0}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Последние заказы */}
        <Col xs={24} lg={16}>
          <Card
            title="Последние заказы"
            extra={
              <Button type="link" onClick={() => navigate('/orders')}>
                Все заказы
              </Button>
            }
          >
            <Table
              columns={orderColumns}
              dataSource={recentOrders}
              pagination={false}
              loading={loading}
              rowKey="id"
              size="small"
            />
          </Card>
        </Col>

        {/* Статус синхронизации */}
        <Col xs={24} lg={8}>
          <Card title="Статус синхронизации">
            <List
              dataSource={syncStatus}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Badge
                        status={item.is_active ? 'success' : 'default'}
                        dot
                      />
                    }
                    title={item.name}
                    description={
                      item.last_sync
                        ? `Последняя синхронизация: ${dayjs(item.last_sync).fromNow()}`
                        : 'Синхронизация не выполнялась'
                    }
                  />
                </List.Item>
              )}
            />
            <Divider />
            <Button
              type="primary"
              icon={<SyncOutlined />}
              block
              onClick={() => navigate('/sync')}
            >
              Управление синхронизацией
            </Button>
          </Card>
        </Col>
      </Row>

      {/* Товары с низким остатком */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            title={
              <Space>
                <AlertOutlined style={{ color: '#ff4d4f' }} />
                Товары с низким остатком
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/products')}>
                Все товары
              </Button>
            }
          >
            <List
              dataSource={lowStockProducts}
              renderItem={(product) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        shape="square"
                        size={48}
                        src={product.images?.[0]?.url}
                        icon={<ShoppingOutlined />}
                      />
                    }
                    title={
                      <Button
                        type="link"
                        onClick={() => navigate(`/products/${product.id}`)}
                        style={{ padding: 0, height: 'auto' }}
                      >
                        {product.name}
                      </Button>
                    }
                    description={
                      <Space size="large">
                        <Text type="secondary">
                          Артикул: {product.sku}
                        </Text>
                        <Text type="danger">
                          Остаток: {product.stock_quantity} шт.
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;