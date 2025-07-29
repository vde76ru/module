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
        axios.get('/dictionaries/categories'),
        axios.get('/dictionaries/brands'),
        axios.get('/dictionaries/suppliers'),
        axios.get('/warehouses'),
      ]);

      setCategories(categoriesRes.data);
      setBrands(brandsRes.data);
      setSuppliers(suppliersRes.data);
      setWarehouses(warehousesRes.data);
    } catch (error) {
      message.error('Ошибка загрузки справочников');
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
        supplier_id: productData.supplier?.id,
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
      const formData = new FormData();
      formData.append('image', file);

      await axios.post(`/api/products/${id}/images`, formData);
      message.success('Изображение загружено');
      fetchProduct();
    } catch (error) {
      message.error('Ошибка загрузки изображения');
    }
    return false; // Prevent auto upload
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
                  <Form.Item label="Поставщик" name="supplier_id">
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
                    label="Цена продажи"
                    name="price"
                    rules={[{ required: true, message: 'Введите цену' }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0.00"
                      min={0}
                      precision={2}
                      formatter={value => `₽ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/₽\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Цена закупки" name="cost_price">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0.00"
                      min={0}
                      precision={2}
                      formatter={value => `₽ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/₽\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Статус" name="status">
                    <Select>
                      <Option value="active">Активен</Option>
                      <Option value="inactive">Неактивен</Option>
                      <Option value="draft">Черновик</Option>
                      <Option value="archived">Архив</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Активен" name="is_active" valuePropName="checked">
                    <Switch />
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
                    {isNewProduct && (
                      <Text type="secondary">
                        Изображения можно добавить после создания товара
                      </Text>
                    )}
                  </div>

                  {product?.images && product.images.length > 0 && (
                    <Image.PreviewGroup>
                      <Row gutter={[16, 16]}>
                        {product.images.map((image, index) => (
                          <Col key={index} span={6}>
                            <div style={{ position: 'relative' }}>
                              <Image
                                width="100%"
                                height={120}
                                src={image.url}
                                style={{ objectFit: 'cover' }}
                              />
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                style={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  background: 'rgba(255,255,255,0.8)',
                                }}
                                onClick={() => {
                                  // Handle image delete
                                }}
                              />
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