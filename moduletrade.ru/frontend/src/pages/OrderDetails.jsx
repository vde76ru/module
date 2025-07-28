import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Descriptions,
  Statistic,
  Timeline,
  message,
  Spin,
  Space,
  Divider,
  Typography,
  Progress,
  Tooltip
} from 'antd';
import {
  ArrowLeftOutlined,
  PrinterOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  PercentageOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TruckOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import axios from '../utils/axios';
import moment from 'moment';

const { Title, Text } = Typography;

/**
 * Компонент детальной информации о заказе с расчетом прибыльности
 */
const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  /**
   * Загрузка детальной информации о заказе
   */
  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const [orderResponse, historyResponse] = await Promise.all([
        axios.get(`/api/orders/${orderId}`),
        axios.get(`/api/orders/${orderId}/history`)
      ]);

      setOrder(orderResponse.data.order);
      setOrderItems(orderResponse.data.items);
      setStatusHistory(historyResponse.data);
    } catch (error) {
      message.error('Ошибка загрузки данных заказа');
      console.error(error);
    }
    setLoading(false);
  };

  /**
   * Печать заказа
   */
  const handlePrint = () => {
    window.print();
  };

  /**
   * Возврат к списку заказов
   */
  const goBack = () => {
    navigate('/orders');
  };

  /**
   * Получение цвета для значения прибыли
   */
  const getProfitColor = (value) => {
    if (value > 0) return '#52c41a';
    if (value < 0) return '#ff4d4f';
    return '#d9d9d9';
  };

  /**
   * Получение иконки для статуса
   */
  const getStatusIcon = (status) => {
    const icons = {
      pending: <ClockCircleOutlined />,
      processing: <ClockCircleOutlined />,
      shipped: <TruckOutlined />,
      delivered: <CheckCircleOutlined />,
      cancelled: <CloseCircleOutlined />,
      refunded: <CloseCircleOutlined />
    };
    return icons[status] || <InfoCircleOutlined />;
  };

  /**
   * Колонки таблицы позиций заказа
   */
  const itemColumns = [
    {
      title: 'SKU',
      dataIndex: ['product', 'sku'],
      key: 'sku',
      fixed: 'left',
      width: 120
    },
    {
      title: 'Наименование',
      dataIndex: ['product', 'name'],
      key: 'name',
      width: 300,
      render: (text) => (
        <Tooltip title={text}>
          <Text ellipsis>{text}</Text>
        </Tooltip>
      )
    },
    {
      title: 'Склад',
      dataIndex: ['warehouse', 'name'],
      key: 'warehouse',
      width: 150,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Кол-во',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center'
    },
    {
      title: 'Цена продажи',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right',
      render: (price) => `₽${price?.toFixed(2) || 0}`
    },
    {
      title: 'Сумма продажи',
      key: 'sale_total',
      width: 130,
      align: 'right',
      render: (_, record) => {
        const total = record.price * record.quantity;
        return `₽${total.toFixed(2)}`;
      }
    },
    {
      title: 'Цена закупки',
      dataIndex: 'purchase_price',
      key: 'purchase_price',
      width: 120,
      align: 'right',
      render: (price) => (
        <Text type="secondary">₽{price?.toFixed(2) || 0}</Text>
      )
    },
    {
      title: 'Сумма закупки',
      key: 'purchase_total',
      width: 130,
      align: 'right',
      render: (_, record) => {
        const total = record.purchase_price * record.quantity;
        return <Text type="secondary">₽{total.toFixed(2)}</Text>;
      }
    },
    {
      title: 'Комиссия',
      dataIndex: 'commission_amount',
      key: 'commission',
      width: 100,
      align: 'right',
      render: (commission) => (
        <Text type="warning">₽{commission?.toFixed(2) || 0}</Text>
      )
    },
    {
      title: 'Прибыль, ₽',
      dataIndex: 'profit_amount',
      key: 'profit_amount',
      width: 120,
      align: 'right',
      fixed: 'right',
      render: (profit) => (
        <Text strong style={{ color: getProfitColor(profit) }}>
          ₽{profit?.toFixed(2) || 0}
        </Text>
      )
    },
    {
      title: 'Прибыль, %',
      dataIndex: 'profit_margin',
      key: 'profit_margin',
      width: 100,
      align: 'right',
      fixed: 'right',
      render: (margin) => (
        <Text strong style={{ color: getProfitColor(margin) }}>
          {margin?.toFixed(2) || 0}%
        </Text>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="Загрузка данных заказа..." />
      </div>
    );
  }

  if (!order) {
    return (
      <Card>
        <Text>Заказ не найден</Text>
        <Button onClick={goBack} style={{ marginLeft: 16 }}>
          Вернуться к списку
        </Button>
      </Card>
    );
  }

  // Расчет итоговых показателей
  const totalStats = {
    items: orderItems.length,
    quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
    revenue: order.total_amount,
    cost: order.total_purchase_price,
    commission: order.total_commission,
    profit: order.total_profit,
    margin: order.profit_margin
  };

  return (
    <div className="order-details-page">
      {/* Заголовок с кнопками действий */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
              Назад
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              Заказ №{order.order_number}
            </Title>
            <Tag color={order.status === 'delivered' ? 'green' : 'blue'} icon={getStatusIcon(order.status)}>
              {order.status}
            </Tag>
          </Space>
        </Col>
        <Col>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            Печать
          </Button>
        </Col>
      </Row>

      {/* Основная информация о заказе */}
      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="Информация о заказе" className="no-print">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Номер заказа">
                {order.order_number}
              </Descriptions.Item>
              <Descriptions.Item label="Маркетплейс">
                <Tag color="blue">{order.marketplace?.name}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Дата создания">
                {moment(order.created_at).format('DD.MM.YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Статус">
                <Tag color={order.status === 'delivered' ? 'green' : 'blue'}>
                  {order.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Покупатель" span={2}>
                {order.customer_name}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {order.customer_email}
              </Descriptions.Item>
              <Descriptions.Item label="Телефон">
                {order.customer_phone}
              </Descriptions.Item>
              <Descriptions.Item label="Адрес доставки" span={2}>
                {order.delivery_address}
              </Descriptions.Item>
              <Descriptions.Item label="Способ доставки">
                {order.delivery_method}
              </Descriptions.Item>
              <Descriptions.Item label="Стоимость доставки">
                ₽{order.delivery_cost?.toFixed(2) || 0}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Финансовые показатели */}
        <Col span={8}>
          <Card title="Финансовые показатели">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="Выручка"
                    value={totalStats.revenue}
                    precision={2}
                    prefix="₽"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="Себестоимость"
                    value={totalStats.cost}
                    precision={2}
                    prefix="₽"
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="Комиссия"
                    value={totalStats.commission}
                    precision={2}
                    prefix="₽"
                    valueStyle={{ color: '#ff7875' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="Прибыль"
                    value={totalStats.profit}
                    precision={2}
                    prefix="₽"
                    valueStyle={{ color: getProfitColor(totalStats.profit) }}
                  />
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small">
                  <Statistic
                    title="Маржинальность"
                    value={totalStats.margin}
                    precision={2}
                    suffix="%"
                    prefix={<PercentageOutlined />}
                    valueStyle={{ color: getProfitColor(totalStats.margin) }}
                  />
                  <Progress
                    percent={Math.max(0, Math.min(100, totalStats.margin))}
                    strokeColor={getProfitColor(totalStats.margin)}
                    showInfo={false}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Таблица позиций заказа */}
      <Card 
        title="Позиции заказа" 
        style={{ marginTop: 16 }}
        extra={
          <Space>
            <Text>Позиций: {totalStats.items}</Text>
            <Divider type="vertical" />
            <Text>Товаров: {totalStats.quantity}</Text>
          </Space>
        }
      >
        <Table
          columns={itemColumns}
          dataSource={orderItems}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1500 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}>
                  <Text strong>Итого:</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="center">
                  <Text strong>{totalStats.quantity}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
                <Table.Summary.Cell index={5} align="right">
                  <Text strong>₽{totalStats.revenue.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} />
                <Table.Summary.Cell index={7} align="right">
                  <Text strong type="secondary">₽{totalStats.cost.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">
                  <Text strong type="warning">₽{totalStats.commission.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={9} align="right">
                  <Text strong style={{ color: getProfitColor(totalStats.profit) }}>
                    ₽{totalStats.profit.toFixed(2)}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={10} align="right">
                  <Text strong style={{ color: getProfitColor(totalStats.margin) }}>
                    {totalStats.margin.toFixed(2)}%
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* История изменений статуса */}
      <Card title="История заказа" style={{ marginTop: 16 }} className="no-print">
        <Timeline>
          {statusHistory.map((item, index) => (
            <Timeline.Item
              key={index}
              color={item.status === 'delivered' ? 'green' : 'blue'}
              dot={getStatusIcon(item.status)}
            >
              <Space direction="vertical" size={0}>
                <Text strong>{item.status}</Text>
                <Text type="secondary">
                  {moment(item.created_at).format('DD.MM.YYYY HH:mm')}
                </Text>
                {item.comment && <Text>{item.comment}</Text>}
              </Space>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      {/* Стили для печати */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .ant-layout-header,
          .ant-layout-sider,
          .ant-page-header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default OrderDetails;
