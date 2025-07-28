import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Form,
  Input,
  Select,
  Button,
  Upload,
  Image,
  Card,
  Row,
  Col,
  InputNumber,
  Switch,
  message,
  Space,
  Divider,
  Tag,
  Tooltip,
  Modal,
  Table,
  Tabs
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  DeleteOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  TagOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { createProduct, updateProduct } from '../../store/productsSlice';
import axios from '../utils/axios';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const ProductForm = ({ product, visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.products);

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [fileList, setFileList] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [supplierPrices, setSupplierPrices] = useState([]);
  const [marketplaceMappings, setMarketplaceMappings] = useState([]);

  const isEdit = !!product;

  useEffect(() => {
    if (visible) {
      fetchDictionaries();
      if (isEdit) {
        populateForm();
      } else {
        form.resetFields();
        setFileList([]);
        setAttributes([]);
        setSupplierPrices([]);
        setMarketplaceMappings([]);
      }
    }
  }, [visible, product]);

  const fetchDictionaries = async () => {
    try {
      const [categoriesRes, brandsRes, suppliersRes] = await Promise.all([
        axios.get('/api/dictionaries/categories'),
        axios.get('/api/dictionaries/brands'),
        axios.get('/api/dictionaries/suppliers')
      ]);

      setCategories(categoriesRes.data);
      setBrands(brandsRes.data);
      setSuppliers(suppliersRes.data);
    } catch (error) {
      message.error('Ошибка загрузки справочников');
    }
  };

  const populateForm = () => {
    form.setFieldsValue({
      ...product,
      category_id: product.category?.id,
      brand_id: product.brand?.id,
      supplier_id: product.supplier?.id
    });

    if (product.images) {
      setFileList(product.images.map((url, index) => ({
        uid: `-${index}`,
        name: `image-${index}.jpg`,
        status: 'done',
        url
      })));
    }

    setAttributes(product.attributes || []);
    setSupplierPrices(product.supplier_prices || []);
    setMarketplaceMappings(product.marketplace_mappings || []);
  };

  const handleSubmit = async (values) => {
    try {
      const formData = {
        ...values,
        images: fileList.map(file => file.url || file.response?.url).filter(Boolean),
        attributes,
        supplier_prices: supplierPrices,
        marketplace_mappings: marketplaceMappings
      };

      if (isEdit) {
        await dispatch(updateProduct({ id: product.id, ...formData })).unwrap();
        message.success('Товар успешно обновлен');
      } else {
        await dispatch(createProduct(formData)).unwrap();
        message.success('Товар успешно создан');
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      message.error(isEdit ? 'Ошибка обновления товара' : 'Ошибка создания товара');
    }
  };

  const handleImageUpload = {
    name: 'file',
    action: '/api/upload/images',
    listType: 'picture-card',
    fileList,
    onChange: (info) => {
      setFileList(info.fileList);
      if (info.file.status === 'done') {
        message.success(`${info.file.name} успешно загружена`);
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} не удалось загрузить`);
      }
    },
    onPreview: (file) => {
      Modal.info({
        title: 'Предварительный просмотр',
        content: <Image src={file.url || file.thumbUrl} width="100%" />
      });
    }
  };

  const addAttribute = () => {
    setAttributes([...attributes, { name: '', value: '', id: Date.now() }]);
  };

  const updateAttribute = (id, field, value) => {
    setAttributes(attributes.map(attr => 
      attr.id === id ? { ...attr, [field]: value } : attr
    ));
  };

  const removeAttribute = (id) => {
    setAttributes(attributes.filter(attr => attr.id !== id));
  };

  const addSupplierPrice = () => {
    setSupplierPrices([...supplierPrices, {
      id: Date.now(),
      supplier_id: '',
      price: 0,
      currency: 'RUB',
      min_quantity: 1,
      is_active: true
    }]);
  };

  const updateSupplierPrice = (id, field, value) => {
    setSupplierPrices(supplierPrices.map(price => 
      price.id === id ? { ...price, [field]: value } : price
    ));
  };

  const removeSupplierPrice = (id) => {
    setSupplierPrices(supplierPrices.filter(price => price.id !== id));
  };

  const uploadButton = (
    <div>
      <PlusOutlined />
      <div style={{ marginTop: 8 }}>Загрузить</div>
    </div>
  );

  return (
    <Modal
      title={isEdit ? 'Редактировать товар' : 'Создать товар'}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          is_active: true,
          track_quantity: true,
          currency: 'RUB'
        }}
      >
        <Tabs defaultActiveKey="basic">
          <TabPane tab="Основные данные" key="basic">
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="Название товара"
                  rules={[{ required: true, message: 'Введите название товара' }]}
                >
                  <Input placeholder="Введите название товара" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="sku"
                  label="Артикул"
                  rules={[{ required: true, message: 'Введите артикул' }]}
                >
                  <Input placeholder="SKU-12345" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="description"
              label="Описание"
            >
              <TextArea rows={4} placeholder="Описание товара" />
            </Form.Item>

            <Row gutter={24}>
              <Col span={8}>
                <Form.Item
                  name="category_id"
                  label="Категория"
                  rules={[{ required: true, message: 'Выберите категорию' }]}
                >
                  <Select placeholder="Выберите категорию" showSearch>
                    {categories.map(category => (
                      <Option key={category.id} value={category.id}>
                        {category.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="brand_id"
                  label="Бренд"
                >
                  <Select placeholder="Выберите бренд" showSearch allowClear>
                    {brands.map(brand => (
                      <Option key={brand.id} value={brand.id}>
                        {brand.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="supplier_id"
                  label="Поставщик"
                >
                  <Select placeholder="Выберите поставщика" showSearch allowClear>
                    {suppliers.map(supplier => (
                      <Option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={8}>
                <Form.Item
                  name="price"
                  label="Цена"
                  rules={[{ required: true, message: 'Введите цену' }]}
                >
                  <InputNumber
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    style={{ width: '100%' }}
                    formatter={value => `₽ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value.replace(/₽\s?|(,*)/g, '')}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="weight"
                  label="Вес (кг)"
                >
                  <InputNumber
                    min={0}
                    step={0.001}
                    placeholder="0.000"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="currency"
                  label="Валюта"
                >
                  <Select defaultValue="RUB">
                    <Option value="RUB">₽ RUB</Option>
                    <Option value="USD">$ USD</Option>
                    <Option value="EUR">€ EUR</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="is_active"
                  label="Активен"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="track_quantity"
                  label="Отслеживать остатки"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab="Изображения" key="images">
            <Form.Item label="Изображения товара">
              <Upload {...handleImageUpload}>
                {fileList.length >= 8 ? null : uploadButton}
              </Upload>
            </Form.Item>
          </TabPane>

          <TabPane tab="Атрибуты" key="attributes">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="dashed"
                onClick={addAttribute}
                icon={<PlusOutlined />}
                block
              >
                Добавить атрибут
              </Button>
            </div>

            {attributes.map((attr, index) => (
              <Card key={attr.id} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16} align="middle">
                  <Col span={10}>
                    <Input
                      placeholder="Название атрибута"
                      value={attr.name}
                      onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                    />
                  </Col>
                  <Col span={10}>
                    <Input
                      placeholder="Значение"
                      value={attr.value}
                      onChange={(e) => updateAttribute(attr.id, 'value', e.target.value)}
                    />
                  </Col>
                  <Col span={4}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeAttribute(attr.id)}
                    />
                  </Col>
                </Row>
              </Card>
            ))}
          </TabPane>

          <TabPane tab="Цены поставщиков" key="prices">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="dashed"
                onClick={addSupplierPrice}
                icon={<PlusOutlined />}
                block
              >
                Добавить цену поставщика
              </Button>
            </div>

            {supplierPrices.map((price) => (
              <Card key={price.id} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16} align="middle">
                  <Col span={6}>
                    <Select
                      placeholder="Поставщик"
                      value={price.supplier_id}
                      onChange={(value) => updateSupplierPrice(price.id, 'supplier_id', value)}
                      style={{ width: '100%' }}
                    >
                      {suppliers.map(supplier => (
                        <Option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <InputNumber
                      placeholder="Цена"
                      value={price.price}
                      onChange={(value) => updateSupplierPrice(price.id, 'price', value)}
                      style={{ width: '100%' }}
                      min={0}
                      step={0.01}
                    />
                  </Col>
                  <Col span={4}>
                    <Select
                      value={price.currency}
                      onChange={(value) => updateSupplierPrice(price.id, 'currency', value)}
                    >
                      <Option value="RUB">RUB</Option>
                      <Option value="USD">USD</Option>
                      <Option value="EUR">EUR</Option>
                    </Select>
                  </Col>
                  <Col span={4}>
                    <InputNumber
                      placeholder="Мин. кол-во"
                      value={price.min_quantity}
                      onChange={(value) => updateSupplierPrice(price.id, 'min_quantity', value)}
                      style={{ width: '100%' }}
                      min={1}
                    />
                  </Col>
                  <Col span={4}>
                    <Switch
                      checked={price.is_active}
                      onChange={(checked) => updateSupplierPrice(price.id, 'is_active', checked)}
                    />
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeSupplierPrice(price.id)}
                    />
                  </Col>
                </Row>
              </Card>
            ))}
          </TabPane>
        </Tabs>

        <Divider />

        <Form.Item>
          <Space>
            <Button onClick={onClose}>
              Отмена
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SaveOutlined />}
            >
              {isEdit ? 'Сохранить изменения' : 'Создать товар'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProductForm;