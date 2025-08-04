// ===================================================
// ФАЙЛ: frontend/src/pages/Orders/OrdersPage.jsx
// ✅ ИСПРАВЛЕНО: Добавлен импорт ShopOutlined
// ===================================================
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  DownloadOutlined,
  ShopOutlined, // ✅ ИСПРАВЛЕНО: Добавлена эта иконка
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '../../utils/constants';

const { Search } = Input;
const { Option } = Select;
const { Title } = Typography;
const { RangePicker } = DatePicker;

const OrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    processing: 0,
    delivered: 0,
  });

  const { hasPermission } = usePermissions();

  // Проверяем права
  const canCreate = hasPermission(PERMISSIONS.ORDERS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.ORDERS_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.ORDERS_DELETE);
  const canExport = hasPermission(PERMISSIONS.ORDERS_EXPORT);

  useEffect(() => {
    fetchOrders();
  }, [searchText, statusFilter, dateRange, pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Демо данные
      setTimeout(() => {
        setOrders([
          {
            id: '1',
            order_number: 'ORD-001',
            customer_name: 'ООО "Компания"',
            customer_email: 'order@company.ru',
            total_amount: 15000,
            status: 'new',
            marketplace: 'Wildberries',
            created_at: new Date().toISOString(),
            items_count: 3,
          },
          {
            id: '2',
            order_number: 'ORD-002',
            customer_name: 'Иван Петров',
            customer_email: 'ivan@example.ru',
            total_amount: 2500,
            status: 'processing',
            marketplace: 'Ozon',
            created_at: new Date(Date.now() - 86400000).toISOString(),
            items_count: 1,
          },
          {
            id: '3',
            order_number: 'ORD-003',
            customer_name: 'ЗАО "ТехСервис"',
            customer_email: 'orders@techserv.ru',
            total_amount: 45000,
            status: 'shipped',
            marketplace: 'Яндекс.Маркет',
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            items_count: 5,
          },
          {
            id: '4',
            order_number: 'ORD-004',
            customer_name: 'Мария Сидорова',
            customer_email: 'maria@example.ru',
            total_amount: 7200,
            status: 'delivered',
            marketplace: 'Wildberries',
            created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
            items_count: 2,
          },
        ]);
        setPagination(prev => ({ ...prev, total: 4 }));
        setLoading(false);
      }, 800);
    } catch (error) {
      message.error('Ошибка при загрузке заказов');
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Демо данные
      setTimeout(() => {
        setStats({
          total: 125,
          new: 15,
          processing: 32,
          delivered: 78,
        });
      }, 500);
    } catch (error) {
      message.error('Ошибка при загрузке статистики');
    }
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleTableChange = (pagination) => {
    setPagination(pagination);
  };

  const handleViewOrder = (order) => {
    navigate(`/orders/${order.id}`);
  };

  const handleEditOrder = (order) => {
    navigate(`/orders/${order.id}/edit`);
  };

  const handleExport = () => {
    message.info('Экспорт заказов будет реализован');
  };

  const columns = [
    {
      title: 'Номер заказа',
      dataIndex: 'order_number',
      key: 'order_number',
      width: 120,
      render: (text, record) => (
        <Button type="link" onClick={() => handleViewOrder(record)}>
          {text}
        </Button>
      ),
    },
    {
      title: 'Клиент',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 200,
      render: (text, record) => (
        <div>
          <div>{text}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {record.customer_email}
          </div>
        </div>
      ),
    },
    {
      title: 'Маркетплейс',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 150,
    },
    {
      title: 'Сумма',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (amount) => `${amount.toLocaleString()} ₽`,
    },
    {
      title: 'Товаров',
      dataIndex: 'items_count',
      key: 'items_count',
      width: 80,
      align: 'center',
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={ORDER_STATUS_COLORS[status] || 'default'}>
          {ORDER_STATUS_LABELS[status] || status}
        </Tag>
      ),
    },
    {
      title: 'Дата создания',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (date) => new Date(date).toLocaleDateString('ru-RU'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewOrder(record)}
            title="Просмотр"
          />
          {canUpdate && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditOrder(record)}
              title="Редактировать"
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего заказов"
              value={stats.total}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Новые"
              value={stats.new}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="В обработке"
              value={stats.processing}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Доставлено"
              value={stats.delivered}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Основная карточка */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>
              Заказы
            </Title>
            <Space>
              {canExport && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                >
                  Экспорт
                </Button>
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchOrders}
                loading={loading}
              >
                Обновить
              </Button>
            </Space>
          </div>
        }
      >
        {/* Фильтры */}
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={8}>
            <Search
              placeholder="Поиск по номеру заказа или клиенту"
              allowClear
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="Статус"
              allowClear
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={handleStatusFilter}
            >
              <Option value="all">Все статусы</Option>
              <Option value="new">Новые</Option>
              <Option value="processing">В обработке</Option>
              <Option value="shipped">Отправлено</Option>
              <Option value="delivered">Доставлено</Option>
              <Option value="cancelled">Отменено</Option>
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Дата от', 'Дата до']}
              onChange={handleDateRangeChange}
            />
          </Col>
        </Row>

        {/* Таблица */}
        <Table
          columns={columns}
          dataSource={orders}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} из ${total} заказов`,
          }}
          onChange={handleTableChange}
          rowKey="id"
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
};

export default OrdersPage;
