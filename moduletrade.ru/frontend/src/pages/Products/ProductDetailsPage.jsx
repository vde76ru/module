// frontend/src/pages/Products/ProductDetailsPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Form,
  Input,
  Select,
  Button,
  Upload,
  Image,
  Tag,
  Divider,
  Tabs,
  Table,
  Space,
  Typography,
  message,
  InputNumber,
  Switch,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { updateProduct, createProduct } from 'store/productsSlice';
import axios from 'utils/axios';
import { api } from 'services';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

const ProductDetailsPage = () => {
  const { id } = useParams(); // 'new' для создания нового товара
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [stock, setStock] = useState([]);
  const [marketplaceMappings, setMarketplaceMappings] = useState([]);

  const isNewProduct = id === 'new';

  useEffect(() => {
    fetchDictionaries();
    if (!isNewProduct) {
      fetchProduct();
    }
  }, [id]);

  const fetchDictionaries = async () => {
    try {
      const [categoriesRes, brandsRes, suppliersRes, warehousesRes] = await Promise.all([
        axios.get('/api/categories'),
        axios.get('/api/brands'),
        axios.get('/api/suppliers'),
        axios.get('/warehouses'),
      ]);

      // ✅ ИСПРАВЛЕНО: Добавляем защиту от null/undefined и проверяем структуру ответа
      setCategories(Array.isArray(categoriesRes?.data) ? categoriesRes.data : []);
      setBrands(Array.isArray(brandsRes?.data) ? brandsRes.data : []);
      setSuppliers(Array.isArray(suppliersRes?.data) ? suppliersRes.data : []);
      setWarehouses(Array.isArray(warehousesRes?.data) ? warehousesRes.data : []);
    } catch (error) {
      message.error('Ошибка загрузки справочников');
      console.error('Fetch dictionaries error:', error);
      // Устанавливаем пустые массивы в случае ошибки
      setCategories([]);
      setBrands([]);
      setSuppliers([]);
      setWarehouses([]);
    }
  };

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const [productRes, stockRes, mappingsRes] = await Promise.all([
        axios.get(`/api/products/${id}`),
        axios.get(`/api/products/${id}/stock`),
        axios.get(`/api/products/${id}/marketplace-mappings`),
      ]);

      const productData = productRes.data;
      setProduct(productData);
      setStock(stockRes.data);
      setMarketplaceMappings(mappingsRes.data);

      // Заполняем форму данными
      form.setFieldsValue({
        ...productData,
        category_id: productData.category?.id,
        brand_id: productData.brand?.id,
        main_supplier_id: productData.main_supplier?.id,
      });
    } catch (error) {
      message.error('Ошибка загрузки товара');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values) => {
    try {
      setLoading(true);

      if (isNewProduct) {
        await dispatch(createProduct(values)).unwrap();
        message.success('Товар создан успешно');
        navigate('/products');
      } else {
        await dispatch(updateProduct({ id, data: values })).unwrap();
        message.success('Товар обновлен успешно');
        fetchProduct(); // Перезагружаем данные
      }
    } catch (error) {
      message.error('Ошибка сохранения товара');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file) => {
    try {
      await api.products.uploadProductImages(id, [file]);
      message.success('Изображение загружено');
      fetchProduct();
    } catch (error) {
      message.error('Ошибка загрузки изображения');
    }
    return false; // Prevent auto upload
  };

  const handleAddImageUrls = async () => {
    const input = window.prompt('Вставьте ссылки на изображения через запятую');
    if (!input) return;
    const urls = input
      .split(',')
      .map(u => u.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (!urls.length) return;
    try {
      await api.products.addProductImageUrls(id, urls);
      message.success('Ссылки добавлены');
      fetchProduct();
    } catch (_) {
      message.error('Не удалось добавить ссылки');
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await api.products.deleteProductImage(id, imageId);
      message.success('Изображение удалено');
      fetchProduct();
    } catch (_) {
      message.error('Не удалось удалить изображение');
    }
  };

  const handleMakeMain = async (imageId) => {
    try {
      const order = (product?.images || []).map(img => img.id);
      await api.products.sortProductImages(id, order, imageId);
      message.success('Главное изображение установлено');
      fetchProduct();
    } catch (_) {
      message.error('Не удалось установить главное изображение');
    }
  };

  const stockColumns = [
    {
      title: 'Склад',
      dataIndex: ['warehouse', 'name'],
      key: 'warehouse',
    },
    {
      title: 'Остаток',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (value) => (
        <Tag color={value > 10 ? 'green' : value > 0 ? 'orange' : 'red'}>
          {value}
        </Tag>
      ),
    },
    {
      title: 'Зарезервировано',
      dataIndex: 'reserved',
      key: 'reserved',
    },
    {
      title: 'Доступно',
      dataIndex: 'available',
      key: 'available',
      render: (_, record) => record.quantity - (record.reserved || 0),
    },
  ];

  const mappingColumns = [
    {
      title: 'Маркетплейс',
      dataIndex: ['marketplace', 'name'],
      key: 'marketplace',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'ID товара',
      dataIndex: 'marketplace_product_id',
      key: 'marketplace_product_id',
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (value) => (
        <Tag color={value ? 'green' : 'default'}>
          {value ? 'Активна' : 'Неактивна'}
        </Tag>
      ),
    },
    {
      title: 'Последняя синхронизация',
      dataIndex: 'last_sync',
      key: 'last_sync',
      render: (value) => value ? new Date(value).toLocaleString() : '-',
    },
  ];

  if (loading && !isNewProduct) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/products')}
            >
              Назад
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              {isNewProduct ? 'Новый товар' : product?.name}
            </Title>
          </Space>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={() => form.submit()}
          >
            Сохранить
          </Button>
        </Col>
      </Row>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            status: 'active',
            is_active: true,
            track_stock: true,
          }}
        >
          <Tabs defaultActiveKey="general">
            <TabPane tab="Общая информация" key="general">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Название товара"
                    name="name"
                    rules={[{ required: true, message: 'Введите название' }]}
                  >
                    <Input placeholder="Название товара" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Артикул"
                    name="sku"
                    rules={[{ required: true, message: 'Введите артикул' }]}
                  >
                    <Input placeholder="SKU" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Описание" name="description">
                <TextArea rows={4} placeholder="Описание товара" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="Категория" name="category_id">
                    <Select placeholder="Выберите категорию" allowClear>
                      {categories.map(cat => (
                        <Option key={cat.id} value={cat.id}>
                          {cat.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Бренд" name="brand_id">
                    <Select placeholder="Выберите бренд" allowClear>
                      {brands.map(brand => (
                        <Option key={brand.id} value={brand.id}>
                          {brand.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Основной поставщик" name="main_supplier_id">
                    <Select placeholder="Выберите поставщика" allowClear>
                      {suppliers.map(supplier => (
                        <Option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item
                    label="Внутренний код"
                    name="internal_code"
                    rules={[{ required: true, message: 'Введите внутренний код' }]}
                  >
                    <Input placeholder="INT-001" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="Тип источника"
                    name="source_type"
                    rules={[{ required: true, message: 'Выберите тип источника' }]}
                  >
                    <Select placeholder="Выберите тип">
                      <Option value="manual">Ручной ввод</Option>
                      <Option value="import">Импорт</Option>
                      <Option value="api">API</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="Единица измерения"
                    name="base_unit"
                    rules={[{ required: true, message: 'Выберите единицу' }]}
                  >
                    <Select placeholder="Выберите единицу">
                      <Option value="шт">Штуки</Option>
                      <Option value="кг">Килограммы</Option>
                      <Option value="л">Литры</Option>
                      <Option value="м">Метры</Option>
                      <Option value="м²">Квадратные метры</Option>
                      <Option value="м³">Кубические метры</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Статус" name="status">
                    <Select>
                      <Option value="draft">Черновик</Option>
                      <Option value="active">Активный</Option>
                      <Option value="discontinued">Снят с производства</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="Вес (кг)" name="weight">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0.000"
                      min={0}
                      step={0.001}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Длина (см)" name="length">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0.0"
                      min={0}
                      step={0.1}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Ширина (см)" name="width">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0.0"
                      min={0}
                      step={0.1}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Высота (см)" name="height">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0.0"
                      min={0}
                      step={0.1}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="Объём (м³)" name="volume">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0.000"
                      min={0}
                      step={0.001}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Мин. количество заказа" name="min_order_quantity">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="1"
                      min={1}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Делимый товар" name="is_divisible" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Видимый в каталоге" name="is_visible" valuePropName="checked">
                    <Switch defaultChecked />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="Активен" name="is_active" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Штрихкод" name="barcode">
                    <Input placeholder="Штрихкод товара" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Внешний ID" name="external_id">
                    <Input placeholder="ID в внешней системе" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="URL slug" name="slug">
                    <Input placeholder="url-friendly-name" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Краткое описание" name="short_description">
                    <Input placeholder="Краткое описание для каталога" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Meta Title" name="meta_title">
                    <Input placeholder="SEO заголовок" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Meta Description" name="meta_description">
                    <TextArea rows={2} placeholder="SEO описание" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Meta Keywords" name="meta_keywords">
                    <Input placeholder="Ключевые слова через запятую" />
                  </Form.Item>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab="Изображения" key="images">
              <Row gutter={16}>
                <Col span={24}>
                  <div style={{ marginBottom: 16 }}>
                    <Upload
                      accept="image/*"
                      beforeUpload={isNewProduct ? null : handleImageUpload}
                      listType="picture-card"
                      showUploadList={false}
                      disabled={isNewProduct}
                    >
                      <div>
                        <PlusOutlined />
                        <div style={{ marginTop: 8 }}>Загрузить</div>
                      </div>
                    </Upload>
                    <Button style={{ marginLeft: 8 }} onClick={handleAddImageUrls}>Добавить по URL</Button>
                    {isNewProduct && (
                      <Text type="secondary">
                        Изображения можно добавить после создания товара
                      </Text>
                    )}
                  </div>

                  {product?.images && product.images.length > 0 && (
                    <Image.PreviewGroup>
                      <Row gutter={[16, 16]}>
                        {product.images.map((image) => (
                          <Col key={image.id} span={6}>
                            <div style={{ position: 'relative' }}>
                              <Image
                                width="100%"
                                height={120}
                                src={image.proxy_url || image.image_url}
                                style={{ objectFit: 'cover' }}
                              />
                              <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 6 }}>
                                <Button
                                  type="default"
                                  size="small"
                                  onClick={() => handleMakeMain(image.id)}
                                  disabled={!!image.is_main}
                                >Главное</Button>
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  style={{ background: 'rgba(255,255,255,0.8)' }}
                                  onClick={() => handleDeleteImage(image.id)}
                                />
                              </div>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </Image.PreviewGroup>
                  )}
                </Col>
              </Row>
            </TabPane>

            {!isNewProduct && (
              <>
                <TabPane tab="Остатки" key="stock">
                  <Table
                    columns={stockColumns}
                    dataSource={stock}
                    rowKey="warehouse_id"
                    pagination={false}
                    size="small"
                  />
                </TabPane>

                <TabPane tab="Маркетплейсы" key="marketplaces">
                  <Table
                    columns={mappingColumns}
                    dataSource={marketplaceMappings}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                </TabPane>
              </>
            )}
          </Tabs>
        </Form>
      </Card>
    </div>
  );
};

export default ProductDetailsPage;