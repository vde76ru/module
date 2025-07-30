// ===================================================
// ФАЙЛ: frontend/src/pages/Analytics/AnalyticsPage.jsx
// ИСПРАВЛЕНО: Удален дублированный импорт React
// ===================================================
import React from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { BarChartOutlined, LineChartOutlined, PieChartOutlined } from '@ant-design/icons';

const { Title } = Typography;

const AnalyticsPage = () => {
  return (
    <div>
      <Title level={2}>Аналитика</Title>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Общая выручка"
              value={1125600}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
              prefix="₽"
              suffix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Средний чек"
              value={2584}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
              prefix="₽"
              suffix={<LineChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Конверсия"
              value={3.25}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
              suffix={<><PieChartOutlined /> %</>}
            />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 16 }}>
        <p>Здесь будут графики и подробная аналитика</p>
      </Card>
    </div>
  );
};

export default AnalyticsPage;