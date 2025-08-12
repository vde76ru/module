// ===================================================
// ФАЙЛ: frontend/src/pages/Orders/OrdersPage.jsx
// ✅ ИСПРАВЛЕНО: Приведено в соответствие с бэкендом
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
  ShopOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '../../utils/constants';
import { api } from 'services'; // ✅ ИСПРАВЛЕНО: Используем новый API

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
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
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
  }, [searchText, statusFilter, marketplaceFilter, dateRange, pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchStats();
  }, []);

  // ✅ ИСПРАВЛЕНО: Используем новый API
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
        sort: 'created_at:desc'
      };

      if (searchText) {
        params.search = searchText;
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (marketplaceFilter !== 'all') {
        params.marketplace_id = marketplaceFilter;
      }

      if (dateRange && dateRange.length === 2) {
        params.date_from = dateRange[0].toISOString();
        params.date_to = dateRange[1].toISOString();
      }

      const result = await api.orders.getOrders(params);

      setOrders(result.orders || []);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0,
      }));
    } catch (error) {
      message.error('Ошибка при загрузке заказов');
      console.error('Fetch orders error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ИСПРАВЛЕНО: Используем новый API для статистики
  const fetchStats = async () => {
    try {
      // Получаем статистику через отдельные запросы
      const [totalResult, newResult, processingResult, deliveredResult] = await Promise.all([
        api.orders.getOrders({ limit: 1 }),
        api.orders.getOrders({ status: 'new', limit: 1 }),
        api.orders.getOrders({ status: 'processing', limit: 1 }),
        api.orders.getOrders({ status: 'delivered', limit: 1 }),
      ]);

      setStats({
        total: totalResult.total || 0,
        new: newResult.total || 0,
        processing: processingResult.total || 0,
        delivered: deliveredResult.total || 0,
      });
    } catch (error) {
      console.error('Fetch stats error:', error);
      // Не показываем ошибку пользователю для статистики
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

  const handleMarketplaceFilter = (value) => {
    setMarketplaceFilter(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleTableChange = (newPagination, filters, sorter) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    }));
  };

  const handleViewOrder = (order) => {
    navigate(`/orders/${order.id}`);
  };

  const handleEditOrder = (order) => {
    navigate(`/orders/${order.id}/edit`);
  };

  // ✅ ИСПРАВЛЕНО: Используем новый API для экспорта
  const handleExport = async () => {
    try {
      const params = {};

      if (searchText) {
        params.search = searchText;
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (marketplaceFilter !== 'all') {
        params.marketplace_id = marketplaceFilter;
      }

      if (dateRange && dateRange.length === 2) {
        params.date_from = dateRange[0].toISOString();
        params.date_to = dateRange[1].toISOString();
      }

      const response = await api.orders.exportOrders(params);

      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('Файл экспорта скачан');
    } catch (error) {
      message.error('Ошибка при экспорте заказов');
      console.error('Export error:', error);
    }
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
      dataIndex: 'marketplace_name',
      key: 'marketplace',
      width: 150,
    },
    {
      title: 'Сумма',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (amount) => `${Number(amount).toLocaleString()} ₽`,
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
          <Col span={6}>
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
              <Option value="confirmed">Подтвержден</Option>
              <Option value="processing">В обработке</Option>
              <Option value="shipped">Отправлено</Option>
              <Option value="delivered">Доставлено</Option>
              <Option value="cancelled">Отменено</Option>
              <Option value="returned">Возвращено</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Маркетплейс"
              allowClear
              style={{ width: '100%' }}
              value={marketplaceFilter}
              onChange={handleMarketplaceFilter}
            >
              <Option value="all">Все маркетплейсы</Option>
              <Option value="ozon">Ozon</Option>
              <Option value="wildberries">Wildberries</Option>
              <Option value="yandex_market">Яндекс.Маркет</Option>
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Дата от', 'Дата до']}
              onChange={handleDateRangeChange}
            />
          </Col>
          <Col span={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText('');
                setStatusFilter('all');
                setMarketplaceFilter('all');
                setDateRange([]);
                fetchOrders();
              }}
            >
              Сбросить
            </Button>
          </Col>
        </Row>

        {/* Таблица */}
        <Table
          columns={columns}
          dataSource={orders}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} из ${total} заказов`,
            pageSizeOptions: ['20', '50', '100', '200'],
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
