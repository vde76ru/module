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
  TrendingUpOutlined,
  TrendingDownOutlined,
  PercentageOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import axios from '../../utils/axios';
import moment from 'moment';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([
    moment().subtract(30, 'days'),
    moment(),
  ]);
  const [selectedMarketplace, setSelectedMarketplace] = useState(null);
  
  const [analytics, setAnalytics] = useState({
    summary: {},
    salesChart: [],
    profitChart: [],
    marketplaceStats: [],
    topProducts: [],
    categoryStats: [],
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, selectedMarketplace]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = {
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        marketplace_id: selectedMarketplace,
      };

      const response = await axios.get('/api/analytics/dashboard', { params });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Analytics fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams({
      start_date: dateRange[0].format('YYYY-MM-DD'),
      end_date: dateRange[1].format('YYYY-MM-DD'),
      marketplace_id: selectedMarketplace || '',
      format: 'xlsx',
    });
    
    window.open(`/api/analytics/export?${params}`, '_blank');
  };

  // Данные для графиков (мокированные для примера)
  const salesData = [
    { date: '01.01', sales: 12000, orders: 45 },
    { date: '02.01', sales: 19000, orders: 62 },
    { date: '03.01', sales: 15000, orders: 38 },
    { date: '04.01', sales: 25000, orders: 78 },
    { date: '05.01', sales: 22000, orders: 69 },
    { date: '06.01', sales: 18000, orders: 55 },
    { date: '07.01', sales: 28000, orders: 85 },
  ];

  const profitData = [
    { date: '01.01', profit: 3600, margin: 30 },
    { date: '02.01', profit: 5700, margin: 30 },
    { date: '03.01', profit: 4500, margin: 30 },
    { date: '04.01', profit: 7500, margin: 30 },
    { date: '05.01', profit: 6600, margin: 30 },
    { date: '06.01', profit: 5400, margin: 30 },
    { date: '07.01', profit: 8400, margin: 30 },
  ];

  const marketplaceData = [
    { name: 'Ozon', value: 35, color: '#0066CC' },
    { name: 'Wildberries', value: 45, color: '#CB11AB' },
    { name: 'Yandex Market', value: 20, color: '#FFCC00' },
  ];

  const topProductsColumns = [
    {
      title: 'Товар',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Продано',
      dataIndex: 'sold_quantity',
      key: 'sold_quantity',
      sorter: true,
    },
    {
      title: 'Выручка',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (value) => `₽${value?.toLocaleString()}`,
      sorter: true,
    },
    {
      title: 'Прибыль',
      dataIndex: 'profit',
      key: 'profit',
      render: (value) => `₽${value?.toLocaleString()}`,
      sorter: true,
    },
    {
      title: 'Маржа',
      dataIndex: 'margin',
      key: 'margin',
      render: (value) => (
        <Tag color={value > 25 ? 'green' : value > 15 ? 'orange' : 'red'}>
          {value}%
        </Tag>
      ),
      sorter: true,
    },
  ];

  const topProducts = [
    {
      id: 1,
      name: 'Смартфон Samsung Galaxy A54',
      sold_quantity: 125,
      revenue: 2750000,
      profit: 825000,
      margin: 30,
    },
    {
      id: 2,
      name: 'Наушники Apple AirPods Pro',
      sold_quantity: 89,
      revenue: 1780000,
      profit: 534000,
      margin: 30,
    },
    {
      id: 3,
      name: 'Чехол для iPhone 14 Pro',
      sold_quantity: 234,
      revenue: 468000,
      profit: 140400,
      margin: 30,
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            Аналитика продаж
          </Title>
        </Col>
        <Col>
          <Space>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD.MM.YYYY"
            />
            <Select
              placeholder="Все маркетплейсы"
              style={{ width: 200 }}
              allowClear
              value={selectedMarketplace}
              onChange={setSelectedMarketplace}
            >
              <Option value="ozon">Ozon</Option>
              <Option value="wildberries">Wildberries</Option>
              <Option value="yandex">Yandex Market</Option>
            </Select>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              Экспорт
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Основные показатели */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Общая выручка"
              value={139000}
              precision={0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<DollarOutlined />}
              suffix="₽"
            />
            <div style={{ marginTop: 8 }}>
              <TrendingUpOutlined style={{ color: '#3f8600' }} />
              <span style={{ color: '#3f8600', marginLeft: 4 }}>+12.5%</span>
              <span style={{ color: '#666', marginLeft: 8 }}>к прошлому периоду</span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Количество заказов"
              value={332}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ShoppingCartOutlined />}
            />
            <div style={{ marginTop: 8 }}>
              <TrendingUpOutlined style={{ color: '#3f8600' }} />
              <span style={{ color: '#3f8600', marginLeft: 4 }}>+8.2%</span>
              <span style={{ color: '#666', marginLeft: 8 }}>к прошлому периоду</span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Общая прибыль"
              value={41700}
              precision={0}
              valueStyle={{ color: '#722ed1' }}
              prefix={<DollarOutlined />}
              suffix="₽"
            />
            <div style={{ marginTop: 8 }}>
              <TrendingDownOutlined style={{ color: '#cf1322' }} />
              <span style={{ color: '#cf1322', marginLeft: 4 }}>-2.1%</span>
              <span style={{ color: '#666', marginLeft: 8 }}>к прошлому периоду</span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Средняя маржа"
              value={30}
              precision={1}
              valueStyle={{ color: '#eb2f96' }}
              prefix={<PercentageOutlined />}
              suffix="%"
            />
            <div style={{ marginTop: 8 }}>
              <TrendingUpOutlined style={{ color: '#3f8600' }} />
              <span style={{ color: '#3f8600', marginLeft: 4 }}>+1.2%</span>
              <span style={{ color: '#666', marginLeft: 8 }}>к прошлому периоду</span>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* График продаж */}
        <Col span={12}>
          <Card title="Динамика продаж" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value, name) => [
                  name === 'sales' ? `₽${value.toLocaleString()}` : value,
                  name === 'sales' ? 'Выручка' : 'Заказы'
                ]} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#1890ff"
                  fill="#1890ff"
                  fillOpacity={0.3}
                  name="Выручка"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* График прибыли */}
        <Col span={12}>
          <Card title="Динамика прибыли" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value, name) => [
                  name === 'profit' ? `₽${value.toLocaleString()}` : `${value}%`,
                  name === 'profit' ? 'Прибыль' : 'Маржа'
                ]} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#52c41a"
                  strokeWidth={3}
                  name="Прибыль"
                />
                <Line
                  type="monotone"
                  dataKey="margin"
                  stroke="#722ed1"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Маржа (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* Распределение по маркетплейсам */}
        <Col span={8}>
          <Card title="Продажи по маркетплейсам" loading={loading}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={marketplaceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {marketplaceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Показатели конверсии */}
        <Col span={8}>
          <Card title="Показатели эффективности">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span>Конверсия в покупку</span>
                  <span style={{ float: 'right', fontWeight: 'bold' }}>3.2%</span>
                </div>
                <Progress percent={32} strokeColor="#52c41a" />
              </div>
              
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span>Средний чек</span>
                  <span style={{ float: 'right', fontWeight: 'bold' }}>₽4,186</span>
                </div>
                <Progress percent={65} strokeColor="#1890ff" />
              </div>
              
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span>Возвраты</span>
                  <span style={{ float: 'right', fontWeight: 'bold' }}>1.8%</span>
                </div>
                <Progress percent={18} strokeColor="#ff4d4f" />
              </div>
              
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span>Повторные покупки</span>
                  <span style={{ float: 'right', fontWeight: 'bold' }}>24%</span>
                </div>
                <Progress percent={24} strokeColor="#722ed1" />
              </div>
            </Space>
          </Card>
        </Col>

        {/* KPI показатели */}
        <Col span={8}>
          <Card title="KPI показатели">
            <Row gutter={[0, 16]}>
              <Col span={24}>
                <Statistic
                  title="ROAS (Return on Ad Spend)"
                  value={4.2}
                  precision={1}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={24}>
                <Statistic
                  title="LTV (Lifetime Value)"
                  value={12500}
                  precision={0}
                  valueStyle={{ color: '#1890ff' }}
                  suffix="₽"
                />
              </Col>
              <Col span={24}>
                <Statistic
                  title="CAC (Customer Acquisition Cost)"
                  value={2980}
                  precision={0}
                  valueStyle={{ color: '#722ed1' }}
                  suffix="₽"
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Топ товары */}
      <Row gutter={16}>
        <Col span={24}>
          <Card title="Топ товары по продажам" loading={loading}>
            <Table
              columns={topProductsColumns}
              dataSource={topProducts}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnalyticsPage;