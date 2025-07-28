import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Tag,
  Card,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  message,
  Tooltip,
  Badge
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import axios from '../../utils/axios';
import moment from 'moment';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

/**
 * Компонент списка заказов с фильтрацией и статистикой
 */
const OrderList = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: null,
    marketplace_id: null,
    date_range: null
  });
  const [marketplaces, setMarketplaces] = useState([]);
  const [statistics, setStatistics] = useState({
    total_orders: 0,
    total_revenue: 0,
    total_profit: 0,
    average_margin: 0
  });

  // Загрузка списка маркетплейсов
  useEffect(() => {
    fetchMarketplaces();
  }, []);

  // Загрузка заказов при изменении фильтров или пагинации
  useEffect(() => {
    fetchOrders();
  }, [pagination.current, pagination.pageSize, filters]);

  /**
   * Получение списка маркетплейсов
   */
  const fetchMarketplaces = async () => {
    try {
      const response = await axios.get('/api/marketplaces');
      setMarketplaces(response.data);
    } catch (error) {
      message.error('Ошибка загрузки маркетплейсов');
    }
  };

  /**
   * Получение списка заказов с учетом фильтров
   */
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters,
        start_date: filters.date_range ? filters.date_range[0].format('YYYY-MM-DD') : undefined,
        end_date: filters.date_range ? filters.date_range[1].format('YYYY-MM-DD') : undefined
      };

      const response = await axios.get('/api/orders', { params });
      
      setOrders(response.data.orders);
      setPagination({
        ...pagination,
        total: response.data.pagination.total
      });
      setStatistics(response.data.statistics);
    } catch (error) {
      message.error('Ошибка загрузки заказов');
      console.error(error);
    }
    setLoading(false);
  };

  /**
   * Обработка изменения страницы
   */
  const handleTableChange = (newPagination) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  /**
   * Обработка поиска
   */
  const handleSearch = (value) => {
    setFilters({ ...filters, search: value });
    setPagination({ ...pagination, current: 1 });
  };

  /**
   * Обработка изменения фильтров
   */
  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, current: 1 });
  };

  /**
   * Открытие детальной информации о заказе
   */
  const viewOrderDetails = (orderId) => {
    navigate(`/orders/${orderId}`);
  };

  /**
   * Обновление статуса заказа
   */
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.put(`/api/orders/${orderId}/status`, { status: newStatus });
      message.success('Статус заказа обновлен');
      fetchOrders();
    } catch (error) {
      message.error('Ошибка обновления статуса');
    }
  };

  /**
   * Определение цвета для статуса
   */
  const getStatusColor = (status) => {
    const statusColors = {
      pending: 'orange',
      processing: 'blue',
      shipped: 'green',
      delivered: 'green',
      cancelled: 'red',
      refunded: 'red'
    };
    return statusColors[status] || 'default';
  };

  /**
   * Определение иконки для статуса
   */
  const getStatusIcon = (status) => {
    const statusIcons = {
      pending: <ClockCircleOutlined />,
      processing: <ClockCircleOutlined />,
      shipped: <CheckCircleOutlined />,
      delivered: <CheckCircleOutlined />,
      cancelled: <CloseCircleOutlined />,
      refunded: <CloseCircleOutlined />
    };
    return statusIcons[status] || null;
  };

  /**
   * Форматирование прибыли с цветовой индикацией
   */
  const formatProfit = (profit, margin) => {
    const color = profit > 0 ? '#52c41a' : profit < 0 ? '#ff4d4f' : '#d9d9d9';
    return (
      <Tooltip title={`Маржа: ${margin?.toFixed(2) || 0}%`}>
        <span style={{ color, fontWeight: 'bold' }}>
          ₽{profit?.toFixed(2) || 0}
        </span>
      </Tooltip>
    );
  };

  // Колонки таблицы
  const columns = [
    {
      title: 'Номер заказа',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (text, record) => (
        <Button type="link" onClick={() => viewOrderDetails(record.id)}>
          {text}
        </Button>
      )
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => moment(date).format('DD.MM.YYYY HH:mm'),
      sorter: true
    },
    {
      title: 'Маркетплейс',
      dataIndex: 'marketplace',
      key: 'marketplace',
      render: (marketplace) => (
        <Tag color="blue">{marketplace?.name}</Tag>
      )
    },
    {
      title: 'Покупатель',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status}
        </Tag>
      )
    },
    {
      title: 'Сумма заказа',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount) => `₽${amount?.toFixed(2) || 0}`,
      sorter: true
    },
    {
      title: 'Прибыль',
      dataIndex: 'total_profit',
      key: 'total_profit',
      render: (profit, record) => formatProfit(profit, record.profit_margin),
      sorter: true
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="Посмотреть детали">
            <Button
              icon={<EyeOutlined />}
              onClick={() => viewOrderDetails(record.id)}
            />
          </Tooltip>
          <Select
            size="small"
            value={record.status}
            style={{ width: 120 }}
            onChange={(value) => updateOrderStatus(record.id, value)}
          >
            <Option value="pending">В ожидании</Option>
            <Option value="processing">В обработке</Option>
            <Option value="shipped">Отправлен</Option>
            <Option value="delivered">Доставлен</Option>
            <Option value="cancelled">Отменен</Option>
          </Select>
        </Space>
      )
    }
  ];

  return (
    <div className="order-list-page">
      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего заказов"
              value={statistics.total_orders}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Общая выручка"
              value={statistics.total_revenue}
              prefix="₽"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Общая прибыль"
              value={statistics.total_profit}
              prefix="₽"
              precision={2}
              valueStyle={{ color: statistics.total_profit > 0 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Средняя маржа"
              value={statistics.average_margin}
              suffix="%"
              precision={2}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Фильтры */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Search
              placeholder="Поиск по номеру заказа"
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="Статус"
              style={{ width: '100%' }}
              allowClear
              onChange={(value) => handleFilterChange('status', value)}
            >
              <Option value="pending">В ожидании</Option>
              <Option value="processing">В обработке</Option>
              <Option value="shipped">Отправлен</Option>
              <Option value="delivered">Доставлен</Option>
              <Option value="cancelled">Отменен</Option>
              <Option value="refunded">Возврат</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Маркетплейс"
              style={{ width: '100%' }}
              allowClear
              onChange={(value) => handleFilterChange('marketplace_id', value)}
            >
              {marketplaces.map(mp => (
                <Option key={mp.id} value={mp.id}>{mp.name}</Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={(dates) => handleFilterChange('date_range', dates)}
              format="DD.MM.YYYY"
            />
          </Col>
          <Col span={2}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchOrders}
              loading={loading}
            >
              Обновить
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Таблица заказов */}
      <Card>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total} заказов`
          }}
          onChange={handleTableChange}
        />
      </Card>
    </div>
  );
};

export default OrderList;
