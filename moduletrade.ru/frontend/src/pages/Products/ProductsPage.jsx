// ===================================================
// ФАЙЛ: frontend/src/pages/Products/ProductsPage.jsx
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
  ShoppingOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

// ✅ ИСПРАВЛЕНО: Правильные импорты
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS, PRODUCT_STATUS_COLORS } from '../../utils/constants';
import { api } from 'services'; // Импорт из правильного места
import ProductForm from '../../components/Products/ProductForm';
import ProductImport from '../../components/Products/ProductImport';

const { Search } = Input;
const { Option } = Select;
const { Title } = Typography;

const ProductsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

  // Управление модалками создания/редактирования и импорта
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Открытие форм по URL (/products/new, /products/:id/edit)
  useEffect(() => {
    const path = location.pathname || '';
    const newMatch = /\/products\/new$/i.test(path);
    const editMatch = path.match(/\/products\/(\d+)\/edit$/i);

    if (newMatch && canCreate) {
      setEditingProduct(null);
      setIsFormOpen(true);
    } else if (editMatch && canUpdate) {
      const productId = editMatch[1];
      (async () => {
        try {
          const data = await api.products.getProduct(productId);
          setEditingProduct(data);
          setIsFormOpen(true);
        } catch (_) {
          message.error('Не удалось загрузить товар');
          navigate('/products', { replace: true });
        }
      })();
    } else {
      setIsFormOpen(false);
      setEditingProduct(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, canCreate, canUpdate]);

  // ✅ ИСПРАВЛЕНО: Используем новую структуру API
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const result = await api.products.getProducts({
        search: searchText || undefined,
        is_active: statusFilter !== 'all' ? (statusFilter === 'active') : undefined,
        source_type: sourceFilter !== 'all' ? sourceFilter : undefined,
        page: pagination.current,
        limit: pagination.pageSize,
      });

      const list = result.data || result.products || [];
      setProducts(list);
      const total = result.pagination?.total ?? result.total ?? result.pagination?.pages ?? 0;
      setPagination(prev => ({
        ...prev,
        total,
      }));
    } catch (error) {
      message.error('Ошибка при загрузке товаров');
      console.error('Fetch products error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ИСПРАВЛЕНО: Используем новую структуру API
  const fetchStats = async () => {
    try {
      // Получаем статистику через отдельные запросы
      const [totalResult, activeResult, lowStockResult] = await Promise.all([
        api.products.getProducts({ limit: 1 }), // Получаем только для подсчета
        api.products.getProducts({ is_active: true, limit: 1 }),
        api.products.getProducts({ low_stock: true, limit: 1 }),
      ]);

      setStats({
        total: totalResult.total || 0,
        active: activeResult.total || 0,
        lowStock: lowStockResult.total || 0,
      });
    } catch (error) {
      console.error('Fetch stats error:', error);
      // Не показываем ошибку пользователю для статистики
    }
  };

  // ✅ ИСПРАВЛЕНО: Используем новую структуру API
  const handleDelete = async (id) => {
    try {
      await api.products.deleteProduct(id);
      message.success('Товар успешно удален');
      fetchProducts();
      fetchStats();
    } catch (error) {
      message.error('Ошибка при удалении товара');
      console.error('Delete product error:', error);
    }
  };

  // ✅ ИСПРАВЛЕНО: Используем новую структуру API
  const handleBulkDelete = async (selectedRowKeys) => {
    try {
      await api.products.bulkDeleteProducts(selectedRowKeys);
      message.success(`Удалено товаров: ${selectedRowKeys.length}`);
      fetchProducts();
      fetchStats();
    } catch (error) {
      message.error('Ошибка при массовом удалении товаров');
      console.error('Bulk delete error:', error);
    }
  };

  // ✅ ИСПРАВЛЕНО: Используем новую структуру API
  const handleExport = async () => {
    try {
      const response = await api.products.exportProducts({
        search: searchText || undefined,
        is_active: statusFilter !== 'all' ? (statusFilter === 'active') : undefined,
        source_type: sourceFilter !== 'all' ? sourceFilter : undefined,
      });

      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `products_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('Файл экспорта скачан');
    } catch (error) {
      message.error('Ошибка при экспорте товаров');
      console.error('Export error:', error);
    }
  };

  const handleTableChange = (newPagination, filters, sorter) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    }));
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleSourceFilterChange = (value) => {
    setSourceFilter(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const columns = [
    {
      title: 'Изображение',
      dataIndex: 'image_url',
      key: 'image',
      width: 80,
      render: (imageUrl) => (
        <div style={{ width: 60, height: 60 }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Товар"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 4
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#f0f0f0',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ShoppingOutlined style={{ color: '#d9d9d9' }} />
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            SKU: {record.sku || '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Категория',
      dataIndex: 'category_name',
      key: 'category',
      ellipsis: true,
      render: (text) => text || '—',
    },
    {
      title: 'Бренд',
      dataIndex: 'brand_name',
      key: 'brand',
      ellipsis: true,
      render: (text) => text || '—',
    },
    {
      title: 'Цена',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price) => price ? `₽${Number(price).toLocaleString()}` : '—',
      sorter: true,
    },
    {
      title: 'Остаток',
      dataIndex: 'total_stock',
      key: 'stock',
      width: 100,
      render: (stock) => {
        const stockNum = Number(stock) || 0;
        return (
          <span style={{
            color: stockNum <= 10 ? '#ff4d4f' : stockNum <= 50 ? '#faad14' : '#52c41a'
          }}>
            {stockNum}
          </span>
        );
      },
      sorter: true,
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'status',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? PRODUCT_STATUS_COLORS.ACTIVE : PRODUCT_STATUS_COLORS.INACTIVE}>
          {isActive ? 'Активен' : 'Неактивен'}
        </Tag>
      ),
    },
    {
      title: 'Источник',
      dataIndex: 'source_type',
      key: 'source',
      width: 100,
      render: (source) => {
        const sourceLabels = {
          manual: 'Ручной',
          import: 'Импорт',
          api: 'API',
          marketplace: 'Маркетплейс'
        };
        return sourceLabels[source] || source || '—';
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="middle">
          {canUpdate && (
            <Tooltip title="Редактировать">
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => navigate(`/products/${record.id}/edit`)}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Удалить товар?"
              description="Это действие нельзя отменить"
              onConfirm={() => handleDelete(record.id)}
              okText="Удалить"
              cancelText="Отмена"
            >
              <Tooltip title="Удалить">
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    onChange: (selectedRowKeys, selectedRows) => {
      // Обработка выбора строк для массовых операций
    },
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Статистика */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8} md={8}>
          <Card>
            <Statistic
              title="Всего товаров"
              value={stats.total}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={8}>
          <Card>
            <Statistic
              title="Активных товаров"
              value={stats.active}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={8}>
          <Card>
            <Statistic
              title="Заканчивается"
              value={stats.lowStock}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Основная карточка */}
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col flex="auto">
              <Title level={4} style={{ margin: 0 }}>
                Товары
              </Title>
            </Col>
            <Col>
              <Space>
                {canExport && (
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                  >
                    Экспорт
                  </Button>
                )}
                {canImport && (
                  <Button
                    icon={<UploadOutlined />}
                    onClick={() => setIsImportOpen(true)}
                  >
                    Импорт
                  </Button>
                )}
                {canCreate && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/products/new')}
                  >
                    Добавить товар
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </div>

        {/* Фильтры */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Search
              placeholder="Поиск по названию, SKU..."
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={handleSearch}
              onChange={(e) => {
                if (!e.target.value) {
                  handleSearch('');
                }
              }}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="Статус"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={handleStatusFilterChange}
            >
              <Option value="all">Все</Option>
              <Option value="active">Активные</Option>
              <Option value="inactive">Неактивные</Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="Источник"
              style={{ width: '100%' }}
              value={sourceFilter}
              onChange={handleSourceFilterChange}
            >
              <Option value="all">Все</Option>
              <Option value="manual">Ручной</Option>
              <Option value="import">Импорт</Option>
              <Option value="api">API</Option>
              <Option value="marketplace">Маркетплейс</Option>
            </Select>
          </Col>
          <Col>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText('');
                setStatusFilter('all');
                setSourceFilter('all');
                fetchProducts();
              }}
            >
              Сбросить
            </Button>
          </Col>
        </Row>

        {/* Таблица */}
        <Table
          columns={columns}
          dataSource={products}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} из ${total} товаров`,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
          rowSelection={canDelete ? rowSelection : undefined}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Модал формы товара */}
      {isFormOpen && (
        <ProductForm
          visible={isFormOpen}
          product={editingProduct}
          onClose={() => {
            setIsFormOpen(false);
            setEditingProduct(null);
            navigate('/products', { replace: true });
          }}
          onSuccess={() => {
            fetchProducts();
            fetchStats();
          }}
        />
      )}

      {/* Модал импорта */}
      {isImportOpen && (
        <ProductImport
          visible={isImportOpen}
          onClose={() => setIsImportOpen(false)}
        />
      )}
    </div>
  );
};

export default ProductsPage;