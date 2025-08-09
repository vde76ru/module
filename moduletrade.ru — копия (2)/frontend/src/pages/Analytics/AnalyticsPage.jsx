// ===================================================
// ФАЙЛ: frontend/src/pages/Analytics/AnalyticsPage.jsx
// ✅ ИСПРАВЛЕНО: Приведено в соответствие с бэкендом
// ===================================================
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin, message } from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  ShoppingOutlined,
  ShopOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { api } from 'services'; // ✅ ИСПРАВЛЕНО: Используем новый API

const { Title } = Typography;

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    summary: {
      orders: {},
      products: {},
      sync: {}
    },
    daily_stats: [],
    top_products: []
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ✅ ИСПРАВЛЕНО: Используем новый API
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const data = await api.analytics.getDashboard();
      setDashboardData(data);
    } catch (error) {
      message.error('Ошибка при загрузке аналитики');
      console.error('Fetch dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>Загрузка аналитики...</div>
      </div>
    );
  }

  const { summary, daily_stats, top_products } = dashboardData;

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Аналитика</Title>

      {/* Основная статистика */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Общая выручка"
              value={summary.orders?.total_revenue || 0}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
              prefix="₽"
              suffix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Средний чек"
              value={summary.orders?.avg_order_value || 0}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
              prefix="₽"
              suffix={<LineChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего заказов"
              value={summary.orders?.total_orders || 0}
              valueStyle={{ color: '#722ed1' }}
              suffix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Активных дней"
              value={summary.orders?.active_days || 0}
              valueStyle={{ color: '#fa8c16' }}
              suffix={<LineChartOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Статистика товаров */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего товаров"
              value={summary.products?.total_products || 0}
              valueStyle={{ color: '#52c41a' }}
              suffix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Активных товаров"
              value={summary.products?.active_products || 0}
              valueStyle={{ color: '#3f8600' }}
              suffix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Брендов"
              value={summary.products?.total_brands || 0}
              valueStyle={{ color: '#1890ff' }}
              suffix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Категорий"
              value={summary.products?.total_categories || 0}
              valueStyle={{ color: '#722ed1' }}
              suffix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Статистика синхронизации */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Всего синхронизаций"
              value={summary.sync?.total_syncs || 0}
              valueStyle={{ color: '#1890ff' }}
              suffix={<SyncOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Успешных синхронизаций"
              value={summary.sync?.successful_syncs || 0}
              valueStyle={{ color: '#3f8600' }}
              suffix={<SyncOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Неудачных синхронизаций"
              value={summary.sync?.failed_syncs || 0}
              valueStyle={{ color: '#cf1322' }}
              suffix={<SyncOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Топ товары */}
      {top_products && top_products.length > 0 && (
        <Card title="Топ товары по выручке" style={{ marginBottom: '24px' }}>
          <Row gutter={16}>
            {top_products.slice(0, 4).map((product, index) => (
              <Col span={6} key={product.id || index}>
                <Card size="small">
                  <Statistic
                    title={product.product_name || 'Товар'}
                    value={product.total_revenue || 0}
                    precision={2}
                    valueStyle={{ color: '#3f8600' }}
                    prefix="₽"
                  />
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Заказов: {product.orders_count || 0}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* Графики (заглушка) */}
      <Card title="Графики продаж" style={{ marginBottom: '24px' }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <PieChartOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
          <div style={{ marginTop: '16px', color: '#666' }}>
            Графики будут добавлены в следующих версиях
          </div>
        </div>
      </Card>

      {/* Детальная аналитика */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Аналитика по дням">
            {daily_stats && daily_stats.length > 0 ? (
              <div>
                {daily_stats.slice(0, 7).map((stat, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: index < 6 ? '1px solid #f0f0f0' : 'none'
                  }}>
                    <span>{new Date(stat.date).toLocaleDateString('ru-RU')}</span>
                    <span>{stat.orders_count || 0} заказов</span>
                    <span>₽{Number(stat.revenue || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#666' }}>
                Нет данных для отображения
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Быстрые действия">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer'
                }}
                onClick={() => window.open('/analytics/sales', '_blank')}
              >
                Отчет по продажам
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer'
                }}
                onClick={() => window.open('/analytics/products', '_blank')}
              >
                Аналитика товаров
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer'
                }}
                onClick={() => window.open('/analytics/marketplace', '_blank')}
              >
                Аналитика по маркетплейсам
              </button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnalyticsPage;