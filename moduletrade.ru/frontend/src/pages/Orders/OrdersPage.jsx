// ===================================================
// ФАЙЛ: frontend/src/pages/Orders/OrdersPage.jsx
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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import PermissionGuard from '../../components/Auth/PermissionGuard';
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
            customer_name: 'Иван Петров',
            status: 'new',
            total: 2500,
            created_at: new Date().toISOString(),
            marketplace: 'Ozon'
          },
          {
            id: '2',
            order_number: 'ORD-002',
            customer_name: 'Анна Сидорова',
            status: 'processing',
            total: 1800,
            created_at: new Date().toISOString(),
            marketplace: 'Wildberries'
          }
        ]);
        setPagination({ ...pagination, total: 2 });
        setLoading(false);
      }, 1000);
    } catch (error) {
      message.error('Ошибка загрузки заказов');
      setLoading(false);
    }
  };

  const fetchStats = () => {
    setStats({
      total: 156,
      new: 23,
      processing: 67,
      delivered: 66,
    });
  };

  const columns = [
    {
      title: 'Номер заказа',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/orders/${record.id}`)}>
          {text}
        </Button>
      ),
    },
    {
      title: 'Клиент',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'Маркетплейс',
      dataIndex: 'marketplace',
      key: 'marketplace',
      render: (marketplace) => <Tag color="blue">{marketplace}</Tag>,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={ORDER_STATUS_COLORS[status]}>
          {ORDER_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: 'Сумма',
      dataIndex: 'total',
      key: 'total',
      render: (total) => `${total.toLocaleString('ru-RU')} ₽`,
    },
    {
      title: 'Дата создания',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString('ru-RU'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.id}`)}
          />
          <PermissionGuard permission={PERMISSIONS.ORDERS_UPDATE}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/orders/${record.id}/edit`)}
            />
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Всего заказов" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Новые" value={stats.new} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="В обработке" value={stats.processing} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Доставлены" value={stats.delivered} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      {/* Основная таблица */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>Заказы</Title>
            <Space>
              <PermissionGuard permission={PERMISSIONS.ORDERS_CREATE}>
                <Button type="primary" icon={<PlusOutlined />}>
                  Создать заказ
                </Button>
              </PermissionGuard>
              <Button icon={<DownloadOutlined />}>
                Экспорт
              </Button>
            </Space>
          </div>
        }
      >
        {/* Фильтры */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Search
              placeholder="Поиск по номеру заказа, клиенту..."
              allowClear
              onSearch={setSearchText}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="Статус"
              allowClear
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="all">Все статусы</Option>
              <Option value="new">Новые</Option>
              <Option value="processing">В обработке</Option>
              <Option value="delivered">Доставлены</Option>
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Дата от', 'Дата до']}
              onChange={setDateRange}
            />
          </Col>
          <Col span={2}>
            <Button icon={<ReloadOutlined />} onClick={fetchOrders} />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Всего ${total} заказов`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
          }}
        />
      </Card>
    </div>
  );
};

export default OrdersPage;