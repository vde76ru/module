// frontend/src/pages/Analytics/AnalyticsPage.jsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Typography,
  Table,
  Progress,
  Space,
  Tag,
  Button,
} from 'antd';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  RiseOutlined,
  FallOutlined,
  PercentageOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import axios from 'utils/axios';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);
  const [selectedMarketplace, setSelectedMarketplace] = useState(null);
  const [marketplaces, setMarketplaces] = useState([]);

  const [analytics, setAnalytics] = useState({
    summary: {},
    salesChart: [],
    profitChart: [],
    marketplaceStats: [],
    topProducts: [],
    categoryStats: [],
  });

  useEffect(() => {
    fetchMarketplaces();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, selectedMarketplace]);

  const fetchMarketplaces = async () => {
    try {
      // ИСПРАВЛЕНО: убрали дублирующий /api/ префикс
      const response = await axios.get('/marketplaces');
      setMarketplaces(response.data.data || []);
    } catch (error) {
      console.error('Marketplaces fetch error:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = {
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        marketplace_id: selectedMarketplace,
      };

      // ИСПРАВЛЕНО: убрали дублирующий /api/ префикс
      const [dashboardRes, salesRes, profitRes] = await Promise.all([
        axios.get('/analytics/dashboard', { params }),
        axios.get('/analytics/sales', { params }).catch(() => ({ data: { data: [] } })),
        axios.get('/analytics/profit', { params }).catch(() => ({ data: { data: [] } }))
      ]);

      setAnalytics({
        summary: dashboardRes.data.data || {},
        salesChart: salesRes.data.data || [],
        profitChart: profitRes.data.data || [],
        marketplaceStats: [],
        topProducts: [],
        categoryStats: []
      });

    } catch (error) {
      console.error('Analytics fetch error:', error);
      // Показываем демо-данные при ошибке
      setAnalytics({
        summary: {
          totalRevenue: 125000,
          totalOrders: 156,
          avgOrderValue: 801,
          conversionRate: 3.2
        },
        salesChart: generateDemoSalesData(),
        profitChart: generateDemoProfitData(),
        marketplaceStats: [
          { name: 'Ozon', orders: 45, revenue: 52000 },
          { name: 'Wildberries', orders: 38, revenue: 41000 },
          { name: 'Yandex Market', orders: 25, revenue: 32000 }
        ],
        topProducts: [
          { name: 'Товар 1', sales: 1250, revenue: 25000 },
          { name: 'Товар 2', sales: 890, revenue: 18500 },
          { name: 'Товар 3', sales: 567, revenue: 12000 }
        ],
        categoryStats: []
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDemoSalesData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = dayjs().subtract(i, 'days');
      data.push({
        date: date.format('DD.MM'),
        sales: Math.floor(Math.random() * 15000) + 5000,
        orders: Math.floor(Math.random() * 50) + 10
      });
    }
    return data;
  };

  const generateDemoProfitData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = dayjs().subtract(i, 'days');
      const revenue = Math.floor(Math.random() * 15000) + 5000;
      const cost = Math.floor(revenue * (0.6 + Math.random() * 0.2));
      data.push({
        date: date.format('DD.MM'),
        revenue,
        cost,
        profit: revenue - cost
      });
    }
    return data;
  };

  const handleExport = () => {
    const params = new URLSearchParams({
      start_date: dateRange[0].format('YYYY-MM-DD'),
      end_date: dateRange[1].format('YYYY-MM-DD'),
      marketplace_id: selectedMarketplace || '',
      format: 'xlsx',
    });

    // ИСПРАВЛЕНО: убрали дублирующий /api/ префикс
    window.open(`/analytics/export?${params}`, '_blank');
  };

  const topProductsColumns = [
    {
      title: 'Товар',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Продажи',
      dataIndex: 'sales',
      key: 'sales',
      render: (value) => Number(value).toLocaleString(),
    },
    {
      title: 'Выручка',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (value) => `₽${Number(value).toLocaleString()}`,
    },
  ];

  const marketplaceColumns = [
    {
      title: 'Маркетплейс',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Заказы',
      dataIndex: 'orders',
      key: 'orders',
    },
    {
      title: 'Выручка',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (value) => `₽${Number(value).toLocaleString()}`,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>Аналитика</Title>
        <Space>
          <Select
            placeholder="Выберите маркетплейс"
            style={{ width: 200 }}
            allowClear
            value={selectedMarketplace}
            onChange={setSelectedMarketplace}
          >
            {marketplaces.map(marketplace => (
              <Option key={marketplace.id} value={marketplace.id}>
                {marketplace.name}
              </Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="DD.MM.YYYY"
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            Экспорт
          </Button>
        </Space>
      </div>

      {/* Основные метрики */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Общая выручка"
              value={analytics.summary.totalRevenue || 0}
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
              title="Количество заказов"
              value={analytics.summary.totalOrders || 0}
              prefix={<ShoppingCartOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Средний чек"
              value={analytics.summary.avgOrderValue || 0}
              prefix={<RiseOutlined />}
              precision={0}
              formatter={(value) => `₽${Number(value).toLocaleString()}`}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Конверсия"
              value={analytics.summary.conversionRate || 0}
              suffix="%"
              prefix={<PercentageOutlined />}
              precision={1}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* Графики */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card title="Динамика продаж" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.salesChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    name === 'sales' ? `₽${Number(value).toLocaleString()}` : value,
                    name === 'sales' ? 'Продажи' : 'Заказы'
                  ]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#1890ff"
                  fill="#1890ff"
                  fillOpacity={0.3}
                  name="Продажи"
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#52c41a"
                  name="Заказы"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Прибыльность" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.profitChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `₽${Number(value).toLocaleString()}`}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#1890ff" name="Выручка" />
                <Bar dataKey="cost" fill="#ff4d4f" name="Затраты" />
                <Bar dataKey="profit" fill="#52c41a" name="Прибыль" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Таблицы */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Топ товары" loading={loading}>
            <Table
              columns={topProductsColumns}
              dataSource={analytics.topProducts}
              pagination={false}
              size="small"
              rowKey="name"
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="По маркетплейсам" loading={loading}>
            <Table
              columns={marketplaceColumns}
              dataSource={analytics.marketplaceStats}
              pagination={false}
              size="small"
              rowKey="name"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnalyticsPage;