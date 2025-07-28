import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Input, Select, Modal, Upload, 
  message, Space, Tag, Drawer, Form, InputNumber,
  Popconfirm, Tooltip, Badge
} from 'antd';
import { 
  PlusOutlined, UploadOutlined, DownloadOutlined,
  EditOutlined, DeleteOutlined, SyncOutlined,
  SearchOutlined, FilterOutlined
} from '@ant-design/icons';
import axios from 'utils/axios';

const { Option } = Select;
const { Search } = Input;

const MyProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    source_type: 'internal',
    search: '',
    limit: 50,
    offset: 0
  });
  
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form] = Form.useForm();
  
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [importing, setImporting] = useState(false);

  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);

  // Загрузка товаров
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/products', { params: filters });
      setProducts(response.data.data.items);
      setTotal(response.data.data.total);
    } catch (error) {
      message.error('Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка справочников
  const fetchDictionaries = async () => {
    try {
      const [brandsRes, categoriesRes] = await Promise.all([
        axios.get('/api/dictionaries/brands'),
        axios.get('/api/dictionaries/categories')
      ]);
      setBrands(brandsRes.data.data);
      setCategories(categoriesRes.data.data);
    } catch (error) {
      console.error('Error loading dictionaries:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchDictionaries();
  }, [filters]);

  // Создание/редактирование товара
  const handleSaveProduct = async (values) => {
    try {
      if (editingProduct) {
        await axios.put(`/api/products/${editingProduct.id}`, values);
        message.success('Товар обновлен');
      } else {
        await axios.post('/api/products', values);
        message.success('Товар создан');
      }
      setIsDrawerVisible(false);
      form.resetFields();
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      message.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  // Удаление товара
  const handleDeleteProduct = async (id) => {
    try {
      await axios.delete(`/api/products/${id}`);
      message.success('Товар удален');
      fetchProducts();
    } catch (error) {
      message.error('Ошибка удаления');
    }
  };

  // Импорт товаров
  const handleImport = async () => {
    if (fileList.length === 0) {
      message.error('Выберите файл для импорта');
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('file', fileList[0]);

    try {
      const response = await axios.post('/api/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(`Импорт запущен. Обрабатывается ${response.data.data.total} товаров`);
      setIsImportModalVisible(false);
      setFileList([]);
      
      // Обновляем список через несколько секунд
      setTimeout(() => fetchProducts(), 3000);
    } catch (error) {
      message.error(error.response?.data?.error || 'Ошибка импорта');
    } finally {
      setImporting(false);
    }
  };

  // Массовое обновление остатков
  const handleBulkStockUpdate = async (selectedRowKeys, newQuantity) => {
    try {
      await axios.post('/api/products/bulk-update', {
        product_ids: selectedRowKeys,
        updates: { quantity: newQuantity }
      });
      message.success('Остатки обновлены');
      fetchProducts();
    } catch (error) {
      message.error('Ошибка обновления остатков');
    }
  };

  const columns = [
    {
      title: 'Артикул',
      dataIndex: 'internal_code',
      key: 'internal_code',
      width: 120,
      fixed: 'left',
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      ellipsis: true
    },
    {
      title: 'Бренд',
      dataIndex: 'brand_name',
      key: 'brand_name',
      width: 150
    },
    {
      title: 'Категория',
      dataIndex: 'category_name',
      key: 'category_name',
      width: 200,
      ellipsis: true
    },
    {
      title: 'Остаток',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (quantity) => (
        <Badge
          count={quantity}
          showZero
          style={{ backgroundColor: quantity > 0 ? '#52c41a' : '#ff4d4f' }}
        />
      )
    },
    {
      title: 'Цена',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (price) => `${price.toLocaleString()} ₽`
    },
    {
      title: 'Источник',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 100,
      render: (type) => (
        <Tag color={type === 'internal' ? 'green' : 'orange'}>
          {type === 'internal' ? 'Внутренний' : 'Поставщик'}
        </Tag>
      )
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Активен' : 'Неактивен'}
        </Tag>
      )
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="Редактировать">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => {
                setEditingProduct(record);
                form.setFieldsValue(record);
                setIsDrawerVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить товар?"
            onConfirm={() => handleDeleteProduct(record.id)}
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="my-products-page">
      <div className="page-header">
        <h1>Мои товары</h1>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingProduct(null);
              form.resetFields();
              setIsDrawerVisible(true);
            }}
          >
            Добавить товар
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setIsImportModalVisible(true)}
          >
            Импорт
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => window.open('/api/products/export/yml', '_blank')}
          >
            Экспорт YML
          </Button>
        </Space>
      </div>

      <div className="filters-section">
        <Space>
          <Search
            placeholder="Поиск по названию или артикулу"
            style={{ width: 300 }}
            onSearch={(value) => setFilters({ ...filters, search: value })}
          />
          <Select
            placeholder="Бренд"
            style={{ width: 200 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, brand_id: value })}
          >
            {brands.map(brand => (
              <Option key={brand.id} value={brand.id}>{brand.canonical_name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Категория"
            style={{ width: 200 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, category_id: value })}
          >
            {categories.map(category => (
              <Option key={category.id} value={category.id}>{category.canonical_name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Статус"
            style={{ width: 150 }}
            onChange={(value) => setFilters({ ...filters, is_active: value })}
          >
            <Option value="">Все</Option>
            <Option value="true">Активные</Option>
            <Option value="false">Неактивные</Option>
          </Select>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={products}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1500 }}
        pagination={{
          total,
          pageSize: filters.limit,
          current: (filters.offset / filters.limit) + 1,
          onChange: (page) => setFilters({ 
            ...filters, 
            offset: (page - 1) * filters.limit 
          }),
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total} товаров`
        }}
        rowSelection={{
          type: 'checkbox',
          onChange: (selectedRowKeys) => {
            // Можно добавить массовые операции
          }
        }}
      />

      {/* Drawer для создания/редактирования */}
      <Drawer
        title={editingProduct ? 'Редактировать товар' : 'Новый товар'}
        width={720}
        open={isDrawerVisible}
        onClose={() => {
          setIsDrawerVisible(false);
          form.resetFields();
          setEditingProduct(null);
        }}
        extra={
          <Space>
            <Button onClick={() => setIsDrawerVisible(false)}>Отмена</Button>
            <Button type="primary" onClick={() => form.submit()}>
              Сохранить
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveProduct}
        >
          <Form.Item
            name="internal_code"
            label="Артикул"
            rules={[{ required: true, message: 'Введите артикул' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="brand_id"
            label="Бренд"
          >
            <Select placeholder="Выберите бренд">
              {brands.map(brand => (
                <Option key={brand.id} value={brand.id}>
                  {brand.canonical_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="category_id"
            label="Категория"
          >
            <Select placeholder="Выберите категорию">
              {categories.map(category => (
                <Option key={category.id} value={category.id}>
                  {category.canonical_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="quantity"
            label="Остаток"
            rules={[{ required: true, message: 'Введите остаток' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="price"
            label="Цена"
            rules={[{ required: true, message: 'Введите цену' }]}
          >
            <InputNumber 
              min={0} 
              style={{ width: '100%' }}
              formatter={value => `₽ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\₽\s?|(,*)/g, '')}
            />
          </Form.Item>
          
          <Form.Item
            name="is_active"
            label="Статус"
            valuePropName="checked"
            initialValue={true}
          >
            <Select>
              <Option value={true}>Активен</Option>
              <Option value={false}>Неактивен</Option>
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Модальное окно импорта */}
      <Modal
        title="Импорт товаров"
        open={isImportModalVisible}
        onOk={handleImport}
        onCancel={() => {
          setIsImportModalVisible(false);
          setFileList([]);
        }}
        confirmLoading={importing}
      >
        <Upload
          accept=".xml,.yml,.csv,.xls,.xlsx"
          fileList={fileList}
          beforeUpload={(file) => {
            setFileList([file]);
            return false;
          }}
          onRemove={() => setFileList([])}
        >
          <Button icon={<UploadOutlined />}>Выбрать файл</Button>
        </Upload>
        <div style={{ marginTop: 16 }}>
          <p>Поддерживаемые форматы:</p>
          <ul>
            <li>YML (Яндекс.Маркет)</li>
            <li>CSV (разделитель - точка с запятой)</li>
            <li>Excel (XLS, XLSX)</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default MyProducts;
