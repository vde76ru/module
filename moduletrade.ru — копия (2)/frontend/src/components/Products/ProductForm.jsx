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
import { createProduct, updateProduct } from 'store/productsSlice';
import { api } from 'services'; // ✅ ИСПРАВЛЕНО: Используем новый API

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

  // ✅ ИСПРАВЛЕНО: Используем новый API для загрузки справочников
  const fetchDictionaries = async () => {
    try {
      const [categoriesRes, brandsRes, suppliersRes] = await Promise.all([
        api.products.getCategories(),
        api.suppliers.getSuppliers(),
        api.suppliers.getSuppliers()
      ]);

      setCategories(categoriesRes || []);
      setBrands(brandsRes || []);
      setSuppliers(suppliersRes || []);
    } catch (error) {
      message.error('Ошибка загрузки справочников');
      console.error('Fetch dictionaries error:', error);
    }
  };

  const populateForm = () => {
    form.setFieldsValue({
      ...product,
      category_id: product.category_id,
      brand_id: product.brand_id,
      main_supplier_id: product.main_supplier_id,
      internal_code: product.internal_code || product.sku
    });

    if (product.images) {
      setFileList(product.images.map((img, index) => ({
        uid: String(img.id || index),
        name: `image-${index}.jpg`,
        status: 'done',
        url: img.proxy_url || img.image_url
      })));
    }

    setAttributes(product.attributes || []);
    setSupplierPrices(product.supplier_prices || []);
    setMarketplaceMappings(product.marketplace_mappings || []);
  };

  // ✅ ИСПРАВЛЕНО: Правильная структура данных для бэкенда
  const handleSubmit = async (values) => {
    try {
      const formData = {
        name: values.name,
        description: values.description,
        short_description: values.short_description,
        internal_code: values.internal_code || values.sku, // Добавляем internal_code
        sku: values.sku,
        barcode: values.barcode,
        brand_id: values.brand_id,
        category_id: values.category_id,
        weight: values.weight,
        length: values.length,
        width: values.width,
        height: values.height,
        status: values.status || 'active',
        is_visible: values.is_visible !== false,
        attributes: attributes.reduce((acc, attr) => {
          if (attr.name && attr.value) {
            acc[attr.name] = attr.value;
          }
          return acc;
        }, {}),
        meta_title: values.meta_title,
        meta_description: values.meta_description,
        meta_keywords: values.meta_keywords,
        slug: values.slug
      };

      if (isEdit) {
        await api.products.updateProduct(product.id, formData);
        message.success('Товар успешно обновлен');
      } else {
        await api.products.createProduct(formData);
        message.success('Товар успешно создан');
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      message.error(isEdit ? 'Ошибка обновления товара' : 'Ошибка создания товара');
      console.error('Product save error:', error);
    }
  };

  const handleImageUpload = {
    name: 'images',
    action: product ? `/api/products/${product.id}/images` : undefined,
    beforeUpload: () => false,
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
      main_supplier_id: '',
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
          is_visible: true,
          status: 'active'
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
                  name="internal_code"
                  label="Внутренний код"
                  rules={[{ required: true, message: 'Введите внутренний код' }]}
                >
                  <Input placeholder="INT-001" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="sku"
                  label="Артикул"
                >
                  <Input placeholder="SKU-12345" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="barcode"
                  label="Штрихкод"
                >
                  <Input placeholder="Штрихкод товара" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="barcode"
                  label="Штрихкод"
                >
                  <Input placeholder="Штрихкод товара" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="slug"
                  label="URL slug"
                >
                  <Input placeholder="url-friendly-name" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="description"
              label="Описание"
            >
              <TextArea rows={4} placeholder="Описание товара" />
            </Form.Item>

            <Form.Item
              name="short_description"
              label="Краткое описание"
            >
              <TextArea rows={2} placeholder="Краткое описание для каталога" />
            </Form.Item>

            <Row gutter={24}>
              <Col span={12}>
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
              <Col span={12}>
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
            </Row>

            <Row gutter={24}>
              <Col span={6}>
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
              <Col span={6}>
                <Form.Item
                  name="length"
                  label="Длина (см)"
                >
                  <InputNumber
                    min={0}
                    step={0.1}
                    placeholder="0.0"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="width"
                  label="Ширина (см)"
                >
                  <InputNumber
                    min={0}
                    step={0.1}
                    placeholder="0.0"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="height"
                  label="Высота (см)"
                >
                  <InputNumber
                    min={0}
                    step={0.1}
                    placeholder="0.0"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={8}>
                <Form.Item
                  name="status"
                  label="Статус товара"
                >
                  <Select placeholder="Выберите статус">
                    <Option value="active">Активный</Option>
                    <Option value="inactive">Неактивный</Option>
                    <Option value="draft">Черновик</Option>
                    <Option value="archived">Архивный</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="is_visible"
                  label="Видимый в каталоге"
                  valuePropName="checked"
                >
                  <Switch defaultChecked />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="is_active"
                  label="Активен"
                  valuePropName="checked"
                >
                  <Switch defaultChecked />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="meta_title"
                  label="Meta Title"
                >
                  <Input placeholder="SEO заголовок" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="meta_keywords"
                  label="Meta Keywords"
                >
                  <Input placeholder="Ключевые слова через запятую" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={24}>
                <Form.Item
                  name="meta_description"
                  label="Meta Description"
                >
                  <TextArea rows={2} placeholder="SEO описание" />
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
                      value={price.main_supplier_id}
                      onChange={(value) => updateSupplierPrice(price.id, 'main_supplier_id', value)}
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