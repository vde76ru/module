// ===================================================
// ФАЙЛ: frontend/src/pages/Products/ProductsPage.jsx
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
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import PermissionGuard from '../../components/Auth/PermissionGuard';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS, PRODUCT_STATUS_COLORS } from '../../utils/constants';
import api from '../../services/api';

const { Search } = Input;
const { Option } = Select;
const { Title } = Typography;

const ProductsPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    lowStock: 0,
  });

  const { hasPermission } = usePermissions();

  // Проверяем права
  const canCreate = hasPermission(PERMISSIONS.PRODUCTS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.PRODUCTS_DELETE);
  const canImport = hasPermission(PERMISSIONS.PRODUCTS_IMPORT);
  const canExport = hasPermission(PERMISSIONS.PRODUCTS_EXPORT);

  useEffect(() => {
    fetchProducts();
  }, [searchText, statusFilter, sourceFilter, pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/products', {
        params: {
          search: searchText || undefined,
          is_active: statusFilter !== 'all' ? (statusFilter === 'active') : undefined,
          source_type: sourceFilter !== 'all' ? sourceFilter : undefined,
          page: pagination.current,
          limit: pagination.pageSize,
        }
      });

      if (response.data.success) {
        setProducts(response.data.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.total || 0,
        }));
      }
    } catch (error) {
      console.error('Fetch products error:', error);
      message.error('Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/products/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await api.delete(`/api/products/${id}`);
      if (response.data.success) {
        message.success('Товар удален');
        fetchProducts();
        fetchStats();
      }
    } catch (error) {
      console.error('Delete product error:', error);
      message.error('Ошибка удаления товара');
    }
  };

  const handleTableChange = (pag) => {
    setPagination({
      ...pagination,
      current: pag.current,
      pageSize: pag.pageSize,
    });
  };

  const handleImport = () => {
    // TODO: Реализовать модальное окно импорта
    message.info('Функция импорта в разработке');
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/api/products/export', {
        params: {
          search: searchText || undefined,
          is_active: statusFilter !== 'all' ? (statusFilter === 'active') : undefined,
          source_type: sourceFilter !== 'all' ? sourceFilter : undefined,
        },
        responseType: 'blob',
      });

      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'products.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('Экспорт выполнен успешно');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Ошибка экспорта товаров');
    }
  };

  const columns = [
    {
      title: 'Артикул',
      dataIndex: 'internal_code',
      key: 'internal_code',
      width: 120,
      fixed: 'left',
    },
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text, record) => (
        <Tooltip title={text}>
          <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/products/${record.id}`)}>
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Бренд',
      dataIndex: ['brand', 'canonical_name'],
      key: 'brand_name',
      width: 150,
      render: (text) => text || '-',
    },
    {
      title: 'Категория',
      dataIndex: ['category', 'canonical_name'],
      key: 'category_name',
      width: 150,
      render: (text) => text || '-',
    },
    {
      title: 'Источник',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 100,
      render: (source) => (
        <Tag color={source === 'etm' ? 'blue' : source === 'rs24' ? 'green' : 'default'}>
          {source?.toUpperCase() || 'Неизвестно'}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active) => (
        <Tag color={active ? PRODUCT_STATUS_COLORS.ACTIVE : PRODUCT_STATUS_COLORS.INACTIVE}>
          {active ? 'Активен' : 'Неактивен'}
        </Tag>
      ),
    },
    {
      title: 'Остаток',
      dataIndex: 'total_stock',
      key: 'total_stock',
      width: 100,
      render: (stock) => {
        const stockValue = stock || 0;
        return (
          <span style={{ color: stockValue < 10 ? '#ff4d4f' : '#52c41a' }}>
            {stockValue}
          </span>
        );
      },
    },
    {
      title: 'Обновлен',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 120,
      render: (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <PermissionGuard permission={PERMISSIONS.PRODUCTS_UPDATE}>
            <Tooltip title="Редактировать">
              <Button
                type="text"
                icon={<EditOutlined />}
                size="small"
                onClick={() => navigate(`/products/${record.id}/edit`)}
              />
            </Tooltip>
          </PermissionGuard>

          <PermissionGuard permission={PERMISSIONS.PRODUCTS_DELETE}>
            <Popconfirm
              title="Удалить товар?"
              description="Это действие нельзя отменить"
              onConfirm={() => handleDelete(record.id)}
              okText="Да"
              cancelText="Нет"
            >
              <Tooltip title="Удалить">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                />
              </Tooltip>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Заголовок с статистикой */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего товаров"
              value={stats.total}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Активных"
              value={stats.active}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Мало на складе"
              value={stats.lowStock}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="% активных"
              value={stats.total ? ((stats.active / stats.total) * 100).toFixed(1) : 0}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Основная карточка */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>Товары</Title>
            <Space>
              <PermissionGuard permission={PERMISSIONS.PRODUCTS_IMPORT}>
                <Button
                  icon={<UploadOutlined />}
                  onClick={handleImport}
                >
                  Импорт
                </Button>
              </PermissionGuard>

              <PermissionGuard permission={PERMISSIONS.PRODUCTS_EXPORT}>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  loading={loading}
                >
                  Экспорт
                </Button>
              </PermissionGuard>

              <PermissionGuard permission={PERMISSIONS.PRODUCTS_CREATE}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/products/new')}
                >
                  Добавить товар
                </Button>
              </PermissionGuard>
            </Space>
          </div>
        }
      >
        {/* Фильтры */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Search
              placeholder="Поиск по названию или артикулу"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={fetchProducts}
              allowClear
              enterButton={<SearchOutlined />}
            />
          </Col>

          <Col span={4}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              placeholder="Статус"
            >
              <Option value="all">Все статусы</Option>
              <Option value="active">Активные</Option>
              <Option value="inactive">Неактивные</Option>
            </Select>
          </Col>

          <Col span={4}>
            <Select
              value={sourceFilter}
              onChange={setSourceFilter}
              style={{ width: '100%' }}
              placeholder="Источник"
            >
              <Option value="all">Все источники</Option>
              <Option value="etm">ETM</Option>
              <Option value="rs24">RS24</Option>
              <Option value="manual">Ручной ввод</Option>
            </Select>
          </Col>

          <Col span={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchProducts}
              loading={loading}
            >
              Обновить
            </Button>
          </Col>
        </Row>

        {/* Таблица товаров */}
        <Table
          columns={columns}
          dataSource={products}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} из ${total} товаров`,
            pageSizeOptions: ['20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default ProductsPage;