// frontend/src/pages/Products/ProductsPage.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Card,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Avatar,
  Popconfirm,
  message,
  Upload,
  Modal,
  Row,
  Col,
  Typography,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  SyncOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import {
  fetchProducts,
  deleteProduct,
  importProducts,
  setFilters,
} from '../../store/productsSlice';
import moment from 'moment';

const { Search } = Input;
const { Option } = Select;
const { Title } = Typography;

const ProductsPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    items: products,
    total,
    loading,
    filters,
    importStatus,
  } = useSelector((state) => state.products);

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  useEffect(() => {
    fetchProductsList();
  }, [dispatch, pagination.current, pagination.pageSize, filters]);

  const fetchProductsList = () => {
    dispatch(
      fetchProducts({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters,
      })
    );
  };

  const handleTableChange = (paginationConfig) => {
    setPagination({
      ...pagination,
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
    });
  };

  const handleSearch = (value) => {
    dispatch(setFilters({ ...filters, search: value }));
    setPagination({ ...pagination, current: 1 });
  };

  const handleFilterChange = (key, value) => {
    dispatch(setFilters({ ...filters, [key]: value }));
    setPagination({ ...pagination, current: 1 });
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteProduct(id)).unwrap();
      message.success('Товар удален');
      fetchProductsList();
    } catch (error) {
      message.error('Ошибка удаления товара');
    }
  };

  const handleImport = async (file) => {
    try {
      await dispatch(importProducts(file)).unwrap();
      message.success('Импорт завершен успешно');
      fetchProductsList();
    } catch (error) {
      message.error('Ошибка импорта');
    }
    return false; // Prevent auto upload
  };

  const handleExport = () => {
    window.open('/api/products/export/yml', '_blank');
  };

  const columns = [
    {
      title: 'Изображение',
      dataIndex: 'images',
      key: 'image',
      width: 80,
      render: (images) => (
        <Avatar
          shape="square"
          size={48}
          src={images?.[0]?.url}
          icon={<ShoppingOutlined />}
        />
      ),
    },
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text, record) => (
        <Button
          type="link"
          onClick={() => navigate(`/products/${record.id}`)}
          style={{ padding: 0, textAlign: 'left', height: 'auto' }}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Артикул',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
    },
    {
      title: 'Цена',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (value) => `₽${value?.toLocaleString()}`,
    },
    {
      title: 'Остаток',
      dataIndex: 'stock_quantity',
      key: 'stock',
      width: 80,
      render: (value) => (
        <Tag color={value > 10 ? 'green' : value > 0 ? 'orange' : 'red'}>
          {value}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusConfig = {
          active: { color: 'green', text: 'Активен' },
          inactive: { color: 'red', text: 'Неактивен' },
          draft: { color: 'orange', text: 'Черновик' },
          archived: { color: 'default', text: 'Архив' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Источник',
      dataIndex: 'source_type',
      key: 'source',
      width: 100,
      render: (source) => {
        const sourceConfig = {
          internal: { color: 'blue', text: 'Внутренний' },
          etm: { color: 'purple', text: 'ETM' },
          rs24: { color: 'cyan', text: 'RS24' },
          custom: { color: 'orange', text: 'Custom' },
        };
        const config = sourceConfig[source] || { color: 'default', text: source };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Обновлен',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 120,
      render: (value) => moment(value).format('DD.MM.YY'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/products/${record.id}`)}
            size="small"
          />
          <Popconfirm
            title="Удалить товар?"
            description="Это действие нельзя отменить"
            onConfirm={() => handleDelete(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            Управление товарами
          </Title>
        </Col>
        <Col>
          <Space>
            <Upload
              accept=".xlsx,.xls,.csv,.xml"
              beforeUpload={handleImport}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>Импорт</Button>
            </Upload>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Экспорт
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/products/new')}
            >
              Добавить товар
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Всего товаров"
              value={total}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Активных"
              value={products.filter(p => p.status === 'active').length}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Мало остатков"
              value={products.filter(p => p.stock_quantity < 10).length}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Выбрано"
              value={selectedRowKeys.length}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        {/* Фильтры */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Search
              placeholder="Поиск по названию, артикулу"
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
              onChange={(value) => handleFilterChange('status', value)}
            >
              <Option value="active">Активен</Option>
              <Option value="inactive">Неактивен</Option>
              <Option value="draft">Черновик</Option>
              <Option value="archived">Архив</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Источник"
              allowClear
              style={{ width: '100%' }}
              onChange={(value) => handleFilterChange('source_type', value)}
            >
              <Option value="internal">Внутренний</Option>
              <Option value="etm">ETM</Option>
              <Option value="rs24">RS24</Option>
              <Option value="custom">Custom</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Остатки"
              allowClear
              style={{ width: '100%' }}
              onChange={(value) => handleFilterChange('stock_filter', value)}
            >
              <Option value="in_stock">В наличии</Option>
              <Option value="out_of_stock">Нет в наличии</Option>
              <Option value="low_stock">Мало остатков</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button
              icon={<SyncOutlined />}
              onClick={fetchProductsList}
              loading={loading}
            >
              Обновить
            </Button>
          </Col>
        </Row>

        {/* Массовые действия */}
        {selectedRowKeys.length > 0 && (
          <Row style={{ marginBottom: 16 }}>
            <Col>
              <Space>
                <span>Выбрано: {selectedRowKeys.length}</span>
                <Button size="small">Изменить статус</Button>
                <Button size="small">Экспорт выбранных</Button>
                <Button size="small" danger>
                  Удалить выбранные
                </Button>
              </Space>
            </Col>
          </Row>
        )}

        {/* Таблица товаров */}
        <Table
          columns={columns}
          dataSource={products}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} из ${total} товаров`,
          }}
          onChange={handleTableChange}
          rowSelection={rowSelection}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default ProductsPage;