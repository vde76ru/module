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
  Tabs,
  Typography,
  Collapse,
  Badge,
  Alert
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  DeleteOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  TagOutlined,
  DollarOutlined,
  FileTextOutlined,
  HomeOutlined,
  UserOutlined,
  DragOutlined,
  StarOutlined
} from '@ant-design/icons';
import { createProduct, updateProduct } from 'store/productsSlice';
import { api } from 'services'; // ✅ ИСПРАВЛЕНО: Используем новый API

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Title, Text } = Typography;
const { Panel } = Collapse;

const ProductForm = ({ product, visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.products);

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [fileList, setFileList] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [supplierPrices, setSupplierPrices] = useState([]);
  const [marketplaceMappings, setMarketplaceMappings] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [warehouseMappings, setWarehouseMappings] = useState([]);
  const [supplierMappings, setSupplierMappings] = useState([]);

  const isEdit = !!product;

  // Типы атрибутов
  const attributeTypes = [
    { value: 'text', label: 'Текст' },
    { value: 'number', label: 'Число' },
    { value: 'boolean', label: 'Да/Нет' },
    { value: 'select', label: 'Выбор из списка' },
    { value: 'multiselect', label: 'Множественный выбор' }
  ];

  // Единицы измерения
  const units = [
    { value: 'шт', label: 'Штука' },
    { value: 'кг', label: 'Килограмм' },
    { value: 'г', label: 'Грамм' },
    { value: 'л', label: 'Литр' },
    { value: 'м', label: 'Метр' },
    { value: 'см', label: 'Сантиметр' },
    { value: 'мм', label: 'Миллиметр' },
    { value: 'м²', label: 'Квадратный метр' },
    { value: 'м³', label: 'Кубический метр' },
    { value: 'компл', label: 'Комплект' },
    { value: 'упак', label: 'Упаковка' }
  ];

  // Типы документов
  const documentTypes = [
    { value: 'certificate', label: 'Сертификат' },
    { value: 'manual', label: 'Инструкция' },
    { value: 'datasheet', label: 'Технические характеристики' },
    { value: 'warranty', label: 'Гарантия' },
    { value: 'other', label: 'Другое' }
  ];

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
        setDocuments([]);
        setWarehouseMappings([]);
        setSupplierMappings([]);
      }
    }
  }, [visible, product]);

  // ✅ ИСПРАВЛЕНО: Используем новый API для загрузки справочников
  const fetchDictionaries = async () => {
    try {
      const [categoriesRes, brandsRes, suppliersRes, warehousesRes] = await Promise.all([
        api.products.getCategories(),
        api.products.getBrands(),
        api.suppliers.getSuppliers(),
        api.warehouses.getWarehouses()
      ]);

      // ✅ ИСПРАВЛЕНО: Добавляем дополнительную защиту от null/undefined
      setCategories(Array.isArray(categoriesRes) ? categoriesRes : []);
      setBrands(Array.isArray(brandsRes) ? brandsRes : []);
      setSuppliers(Array.isArray(suppliersRes) ? suppliersRes : []);
      setWarehouses(Array.isArray(warehousesRes) ? warehousesRes : []);
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

  const populateForm = () => {
    form.setFieldsValue({
      ...product,
      category_id: product.category_id,
      brand_id: product.brand_id,
      main_supplier_id: product.main_supplier_id,
      internal_code: product.internal_code || product.sku
    });

    if (product.images && Array.isArray(product.images)) {
      setFileList(product.images.map((img, index) => ({
        uid: String(img.id || index),
        name: `image-${index}.jpg`,
        status: 'done',
        url: img.proxy_url || img.image_url,
        isMain: img.is_main || false
      })));
    }

    setAttributes(Array.isArray(product.attributes) ? product.attributes : []);
    setSupplierPrices(Array.isArray(product.supplier_prices) ? product.supplier_prices : []);
    setMarketplaceMappings(Array.isArray(product.marketplace_mappings) ? product.marketplace_mappings : []);
    setDocuments(Array.isArray(product.documents) ? product.documents : []);
    setWarehouseMappings(Array.isArray(product.warehouse_mappings) ? product.warehouse_mappings : []);
    setSupplierMappings(Array.isArray(product.supplier_mappings) ? product.supplier_mappings : []);
  };

  // ✅ ИСПРАВЛЕНО: Правильная структура данных для бэкенда
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values) => {
    if (isSubmitting) return; // Предотвращаем двойную отправку

    try {
      setIsSubmitting(true);

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
            acc[attr.name] = {
              value: attr.value,
              type: attr.type || 'text',
              unit: attr.unit,
              required: attr.required || false,
              group: attr.group || 'general'
            };
          }
          return acc;
        }, {}),
        meta_title: values.meta_title,
        meta_description: values.meta_description,
        meta_keywords: values.meta_keywords,
        slug: values.slug,
        documents: documents,
        warehouse_mappings: warehouseMappings,
        supplier_mappings: supplierMappings
      };

      if (isEdit) {
        const updated = await api.products.updateProduct(product.id, formData);
        message.success('Товар успешно обновлен');
        onSuccess?.(updated);
        onClose();
      } else {
        const created = await api.products.createProduct(formData);
        message.success('Товар успешно создан');
        onSuccess?.(created);
        onClose();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.error ||
                          error.message ||
                          (isEdit ? 'Ошибка обновления товара' : 'Ошибка создания товара');

      message.error(errorMessage);
      console.error('Product save error:', {
        error: error.message,
        response: error.response?.data,
        stack: error.stack
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = {
    name: 'images',
    action: product ? `/api/products/${product.id}/images` : undefined,
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('Можно загружать только изображения!');
        return false;
      }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('Размер файла должен быть меньше 5MB!');
        return false;
      }
      return false; // Отключаем автоматическую загрузку
    },
    listType: 'picture-card',
    fileList,
    onChange: (info) => {
      setFileList(info.fileList);
      if (info.file.status === 'done') {
        message.success(`${info.file.name} успешно загружена`);
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} не удалось загрузить`);
      } else if (info.file.status === 'uploading') {
        // Показываем прогресс загрузки
        message.loading(`Загрузка ${info.file.name}...`, 0);
      }
    },
    onPreview: (file) => {
      Modal.info({
        title: 'Предварительный просмотр',
        content: <Image src={file.url || file.thumbUrl} width="100%" />
      });
    },
    // ✅ ИСПРАВЛЕНО: Добавляем поддержку миниатюр
    itemRender: (originNode, file, currFileList) => {
      const imageUrl = file.url || file.thumbUrl || (file.response && file.response.url);
      return (
        <div style={{ position: 'relative' }}>
          <img
            src={imageUrl}
            alt={file.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '6px'
            }}
          />
          {file.isMain && (
            <div style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#1890ff',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              <StarOutlined />
            </div>
          )}
        </div>
      );
    }
  };

  // Управление атрибутами
  const addAttribute = () => {
    setAttributes([...attributes, {
      id: Date.now(),
      name: '',
      value: '',
      type: 'text',
      unit: '',
      required: false,
      group: 'general'
    }]);
  };

  const updateAttribute = (id, field, value) => {
    setAttributes(Array.isArray(attributes) ? attributes.map(attr =>
      attr.id === id ? { ...attr, [field]: value } : attr
    ) : []);
  };

  const removeAttribute = (id) => {
    setAttributes(attributes.filter(attr => attr.id !== id));
  };

  const setMainImage = (uid) => {
    setFileList(Array.isArray(fileList) ? fileList.map(file => ({
      ...file,
      isMain: file.uid === uid
    })) : []);
  };

  // Управление документами
  const addDocument = () => {
    setDocuments([...documents, {
      id: Date.now(),
      type: 'certificate',
      title: '',
      file_url: '',
      external_url: '',
      supplier_id: null
    }]);
  };

  const updateDocument = (id, field, value) => {
    setDocuments(Array.isArray(documents) ? documents.map(doc =>
      doc.id === id ? { ...doc, [field]: value } : doc
    ) : []);
  };

  const removeDocument = (id) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  // Управление складами
  const addWarehouseMapping = () => {
    setWarehouseMappings([...warehouseMappings, {
      id: Date.now(),
      warehouse_id: null,
      supplier_warehouse_id: null,
      min_stock_level: 0,
      max_stock_level: null,
      reorder_point: 0,
      is_active: true
    }]);
  };

  const updateWarehouseMapping = (id, field, value) => {
    setWarehouseMappings(Array.isArray(warehouseMappings) ? warehouseMappings.map(mapping =>
      mapping.id === id ? { ...mapping, [field]: value } : mapping
    ) : []);
  };

  const removeWarehouseMapping = (id) => {
    setWarehouseMappings(warehouseMappings.filter(mapping => mapping.id !== id));
  };

  // Управление поставщиками
  const addSupplierMapping = () => {
    setSupplierMappings([...supplierMappings, {
      id: Date.now(),
      supplier_id: null,
      is_main: false,
      priority: 1,
      is_active: true
    }]);
  };

  const updateSupplierMapping = (id, field, value) => {
    setSupplierMappings(Array.isArray(supplierMappings) ? supplierMappings.map(mapping =>
      mapping.id === id ? { ...mapping, [field]: value } : mapping
    ) : []);
  };

  const removeSupplierMapping = (id) => {
    setSupplierMappings(supplierMappings.filter(mapping => mapping.id !== id));
  };

  const addMarketplaceMapping = () => {
    setMarketplaceMappings([...marketplaceMappings, {
      id: Date.now(),
      marketplace: 'ozon',
      category_id: '',
      attributes: [],
      is_active: true
    }]);
  };

  const updateMarketplaceMapping = (id, field, value) => {
    setMarketplaceMappings(Array.isArray(marketplaceMappings) ? marketplaceMappings.map(mp =>
      mp.id === id ? { ...mp, [field]: value } : mp
    ) : []);
  };

  const removeMarketplaceMapping = (id) => {
    setMarketplaceMappings(Array.isArray(marketplaceMappings) ? marketplaceMappings.filter(mp => mp.id !== id) : []);
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
    setSupplierPrices(Array.isArray(supplierPrices) ? supplierPrices.map(price =>
      price.id === id ? { ...price, [field]: value } : price
    ) : []);
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
        title={
          <div>
            {isEdit ? 'Редактировать товар' : 'Создать новый товар'}
            <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginTop: '4px' }}>
              {form.getFieldValue('name') && form.getFieldValue('internal_code') && form.getFieldValue('category_id')
                ? '✅ Основные поля заполнены'
                : '⚠️ Заполните основные поля'
              }
            </div>
          </div>
        }
        open={visible}
        onCancel={() => {
          // ✅ ИСПРАВЛЕНО: Предупреждаем пользователя о потере данных
          Modal.confirm({
            title: 'Закрыть форму?',
            content: 'Все несохраненные изменения будут потеряны.',
            okText: 'Закрыть',
            cancelText: 'Отмена',
            onOk: () => {
              // Сбрасываем форму и закрываем
              form.resetFields();
              setFileList([]);
              setAttributes([]);
              setSupplierPrices([]);
              setMarketplaceMappings([]);
              setDocuments([]);
              setWarehouseMappings([]);
              setSupplierMappings([]);
              onClose();
            }
          });
        }}
        width={1200}
        footer={null}
        destroyOnClose={false}
      >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          status: 'active',
          is_visible: true,
          is_active: true
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <Alert
            message="Прогресс заполнения"
            description={
              <div>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Основные поля:</Text> {form.getFieldValue('name') && form.getFieldValue('internal_code') && form.getFieldValue('category_id') ? '✅ Заполнено' : '❌ Не заполнено'}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Изображения:</Text> {fileList.length > 0 ? `✅ ${fileList.length} изображений` : '❌ Не загружено'}
                </div>
                <div>
                  <Text strong>Атрибуты:</Text> {attributes.length > 0 ? `✅ ${attributes.length} атрибутов` : '❌ Не добавлено'}
                </div>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        </div>

        <Tabs defaultActiveKey="basic" size="large" style={{ marginTop: '16px' }}>
          <TabPane
            tab={
              <span>
                Основная информация
                {form.getFieldValue('name') && form.getFieldValue('internal_code') && form.getFieldValue('category_id') && (
                  <Badge count="✓" style={{ backgroundColor: '#52c41a', marginLeft: '8px' }} />
                )}
              </span>
            }
            key="basic"
          >
            <Alert
              message="Основные характеристики товара"
              description="Заполните основные поля для создания товара. Поля со звездочкой обязательны для заполнения."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="Название товара"
                  rules={[{ required: true, message: 'Введите название товара' }]}
                  extra="Укажите полное название товара для лучшего поиска"
                >
                  <Input placeholder="Название товара" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="internal_code"
                  label="Внутренний код"
                  rules={[{ required: true, message: 'Введите внутренний код' }]}
                  extra="Уникальный код для внутреннего учета товара"
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
                  extra="Уникальный артикул товара для идентификации"
                >
                  <Input
                    placeholder="SKU-12345"
                    suffix={
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const name = form.getFieldValue('name');
                          if (name) {
                            const sku = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
                            form.setFieldsValue({ sku: `SKU-${sku}` });
                            message.success('SKU сгенерирован из названия');
                          } else {
                            message.warning('Сначала заполните название товара');
                          }
                        }}
                        icon={<TagOutlined />}
                      >
                        Авто
                      </Button>
                    }
                  />
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
                  name="slug"
                  label="URL slug"
                  extra="URL-friendly название для SEO оптимизации"
                >
                  <Input
                    placeholder="url-friendly-name"
                    suffix={
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const name = form.getFieldValue('name');
                          if (name) {
                            const slug = name
                              .toLowerCase()
                              .replace(/[^a-z0-9\s-]/g, '')
                              .replace(/\s+/g, '-')
                              .replace(/-+/g, '-')
                              .trim('-');
                            form.setFieldsValue({ slug });
                            message.success('Slug сгенерирован из названия');
                          } else {
                            message.warning('Сначала заполните название товара');
                          }
                        }}
                        icon={<TagOutlined />}
                      >
                        Авто
                      </Button>
                    }
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
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
            </Row>

            <Form.Item
              name="description"
              label="Описание"
              extra="Подробное описание товара, его характеристик и преимуществ"
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
                  extra="Выберите основную категорию для правильной классификации товара"
                >
                  <Select placeholder="Выберите категорию" showSearch>
                    {Array.isArray(categories) ? categories.map(category => (
                      <Option key={category.id} value={category.id}>
                        {category.name}
                      </Option>
                    )) : null}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="brand_id"
                  label="Бренд"
                >
                  <Select placeholder="Выберите бренд" showSearch allowClear>
                    {Array.isArray(brands) ? brands.map(brand => (
                      <Option key={brand.id} value={brand.id}>
                        {brand.name}
                      </Option>
                    )) : null}
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
                    placeholder="0.0"
                    min={0}
                    step={0.1}
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
                    placeholder="0"
                    min={0}
                    step={0.1}
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
                    placeholder="0"
                    min={0}
                    step={0.1}
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
                    placeholder="0"
                    min={0}
                    step={0.1}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
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
              <Col span={8}>
                <Form.Item
                  name="meta_title"
                  label="Meta Title"
                >
                  <Input placeholder="SEO заголовок" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="meta_keywords"
                  label="Meta Keywords"
                >
                  <Input placeholder="Ключевые слова через запятую" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="meta_description"
                  label="Meta Description"
                >
                  <TextArea rows={2} placeholder="SEO описание" />
                </Form.Item>
              </Col>
            </Row>
          </TabPane>

          <TabPane
            tab={
              <span>
                Изображения
                {fileList.length > 0 && (
                  <Badge count={fileList.length} style={{ backgroundColor: '#1890ff', marginLeft: '8px' }} />
                )}
              </span>
            }
            key="images"
          >
            <Alert
              message="Изображения товара"
              description="Загрузите качественные изображения товара. Первое изображение будет главным. Поддерживаются форматы: JPG, PNG, WebP. Максимум 8 изображений."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <Form.Item label="Загрузка изображений">
              <Upload {...handleImageUpload}>
                {fileList.length >= 8 ? null : uploadButton}
              </Upload>
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary">
                  💡 Совет: Используйте изображения размером не менее 800x800 пикселей для лучшего качества
                </Text>
              </div>
            </Form.Item>

            {fileList.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>Управление изображениями</Title>
                <Row gutter={16}>
                  {Array.isArray(fileList) ? fileList.map((file, index) => (
                    <Col span={6} key={file.uid}>
                      <Card
                        size="small"
                        cover={
                          <div style={{ position: 'relative' }}>
                            <Image
                              src={file.url || file.thumbUrl}
                              alt={file.name}
                              style={{ width: '100%', height: 120, objectFit: 'cover' }}
                            />
                            {file.isMain && (
                              <Badge
                                count={<StarOutlined style={{ color: '#faad14' }} />}
                                style={{ position: 'absolute', top: 8, right: 8 }}
                              />
                            )}
                          </div>
                        }
                        actions={[
                          <Button
                            key="main"
                            type={file.isMain ? "primary" : "default"}
                            size="small"
                            onClick={() => setMainImage(file.uid)}
                            icon={<StarOutlined />}
                          >
                            {file.isMain ? 'Главное' : 'Сделать главным'}
                          </Button>
                        ]}
                      >
                        <div style={{ textAlign: 'center' }}>
                          <Text strong>{file.name}</Text>
                        </div>
                      </Card>
                    </Col>
                  )) : null}
                </Row>
              </div>
            )}
          </TabPane>

          <TabPane
            tab={
              <span>
                Атрибуты
                {attributes.length > 0 && (
                  <Badge count={attributes.length} style={{ backgroundColor: '#722ed1', marginLeft: '8px' }} />
                )}
              </span>
            }
            key="attributes"
          >
            <Alert
              message="Атрибуты товара"
              description="Создайте детальные характеристики товара для лучшего поиска и фильтрации. Атрибуты помогут покупателям найти именно то, что им нужно."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Button
                  type="dashed"
                  onClick={addAttribute}
                  icon={<PlusOutlined />}
                >
                  Добавить атрибут
                </Button>
                <Button
                  type="link"
                  onClick={() => {
                    // Быстрое добавление популярных атрибутов
                    const popularAttributes = [
                      { name: 'Цвет', value: '', type: 'text', unit: '', required: false },
                      { name: 'Размер', value: '', type: 'text', unit: '', required: false },
                      { name: 'Материал', value: '', type: 'text', unit: '', required: false },
                      { name: 'Вес', value: '', type: 'number', unit: 'кг', required: false },
                      { name: 'Гарантия', value: '', type: 'text', unit: 'мес', required: false }
                    ];
                    setAttributes([...attributes, ...popularAttributes.map(attr => ({
                      ...attr,
                      id: Date.now() + Math.random()
                    }))]);
                    message.success('Добавлены популярные атрибуты');
                  }}
                  icon={<TagOutlined />}
                >
                  Добавить популярные
                </Button>
                <Text type="secondary">
                  Создайте атрибуты для детального описания товара
                </Text>
              </Space>
            </div>

            {Array.isArray(attributes) ? attributes.map((attr, index) => (
              <Card key={attr.id} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16} align="middle">
                  <Col span={6}>
                    <Input
                      placeholder="Название атрибута"
                      value={attr.name}
                      onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                    />
                  </Col>
                  <Col span={4}>
                    <Select
                      placeholder="Тип"
                      value={attr.type}
                      onChange={(value) => updateAttribute(attr.id, 'type', value)}
                      style={{ width: '100%' }}
                    >
                      {Array.isArray(attributeTypes) ? attributeTypes.map(type => (
                        <Option key={type.value} value={type.value}>
                          {type.label}
                        </Option>
                      )) : null}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Input
                      placeholder="Значение"
                      value={attr.value}
                      onChange={(e) => updateAttribute(attr.id, 'value', e.target.value)}
                    />
                  </Col>
                  <Col span={3}>
                    <Select
                      placeholder="Единица"
                      value={attr.unit}
                      onChange={(value) => updateAttribute(attr.id, 'unit', value)}
                      allowClear
                      style={{ width: '100%' }}
                    >
                      {Array.isArray(units) ? units.map(unit => (
                        <Option key={unit.value} value={unit.value}>
                          {unit.label}
                        </Option>
                      )) : null}
                    </Select>
                  </Col>
                  <Col span={3}>
                    <Switch
                      checked={attr.required}
                      onChange={(checked) => updateAttribute(attr.id, 'required', checked)}
                      size="small"
                    />
                    <div style={{ fontSize: '12px', color: '#666' }}>Обязательный</div>
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeAttribute(attr.id)}
                    />
                  </Col>
                </Row>
              </Card>
            )) : null}
          </TabPane>

          <TabPane
            tab={
              <span>
                Маппинг маркетплейсов
                {marketplaceMappings.length > 0 && (
                  <Badge count={marketplaceMappings.length} style={{ backgroundColor: '#13c2c2', marginLeft: '8px' }} />
                )}
              </span>
            }
            key="marketplaces"
          >
            <Alert
              message="Настройка маркетплейсов"
              description="Настройте соответствие товара требованиям различных маркетплейсов. Укажите категории, атрибуты и специфичные настройки для каждого маркетплейса."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button
                  type="dashed"
                  onClick={addMarketplaceMapping}
                  icon={<PlusOutlined />}
                >
                  Добавить маркетплейс
                </Button>
                <Text type="secondary">
                  Настройте соответствие товара требованиям маркетплейсов
                </Text>
              </Space>
            </div>

            {Array.isArray(marketplaceMappings) ? marketplaceMappings.map((mapping) => (
              <Card key={mapping.id} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16} align="middle">
                  <Col span={6}>
                    <Select
                      placeholder="Маркетплейс"
                      value={mapping.marketplace}
                      onChange={(value) => updateMarketplaceMapping(mapping.id, 'marketplace', value)}
                      style={{ width: '100%' }}
                    >
                      <Option value="ozon">Ozon</Option>
                      <Option value="wildberries">Wildberries</Option>
                      <Option value="yandex">Яндекс.Маркет</Option>
                      <Option value="amazon">Amazon</Option>
                      <Option value="aliexpress">AliExpress</Option>
                    </Select>
                  </Col>
                  <Col span={6}>
                    <Input
                      placeholder="ID категории"
                      value={mapping.category_id}
                      onChange={(e) => updateMarketplaceMapping(mapping.id, 'category_id', e.target.value)}
                    />
                  </Col>
                  <Col span={4}>
                    <Switch
                      checked={mapping.is_active}
                      onChange={(checked) => updateMarketplaceMapping(mapping.id, 'is_active', checked)}
                      size="small"
                    />
                    <div style={{ fontSize: '12px', color: '#666' }}>Активен</div>
                  </Col>
                  <Col span={4}>
                    <Button
                      type="text"
                      icon={<TagOutlined />}
                      onClick={() => {
                        // TODO: Открыть модальное окно для настройки атрибутов
                        message.info('Настройка атрибутов будет доступна в следующей версии');
                      }}
                    >
                      Атрибуты
                    </Button>
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeMarketplaceMapping(mapping.id)}
                    />
                  </Col>
                </Row>
              </Card>
            )) : null}
          </TabPane>

          <TabPane
            tab={
              <span>
                Документация
                {documents.length > 0 && (
                  <Badge count={documents.length} style={{ backgroundColor: '#fa8c16', marginLeft: '8px' }} />
                )}
              </span>
            }
            key="documents"
          >
            <Alert
              message="Документация товара"
              description="Загрузите сертификаты, инструкции, технические характеристики и другую документацию для товара. Это поможет покупателям лучше понять товар."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Button
                  type="dashed"
                  onClick={addDocument}
                  icon={<PlusOutlined />}
                >
                  Добавить документ
                </Button>
                <Button
                  type="link"
                  onClick={() => {
                    // Быстрое добавление популярных документов
                    const popularDocuments = [
                      { type: 'certificate', title: 'Сертификат качества', external_url: '', supplier_id: '' },
                      { type: 'manual', title: 'Инструкция по эксплуатации', external_url: '', supplier_id: '' },
                      { type: 'datasheet', title: 'Технические характеристики', external_url: '', supplier_id: '' }
                    ];
                    setDocuments([...documents, ...popularDocuments.map(doc => ({
                      ...doc,
                      id: Date.now() + Math.random()
                    }))]);
                    message.success('Добавлены популярные документы');
                  }}
                  icon={<FileTextOutlined />}
                >
                  Добавить популярные
                </Button>
                <Text type="secondary">
                  Загрузите сертификаты, инструкции и другую документацию
                </Text>
              </Space>
            </div>

            {Array.isArray(documents) ? documents.map((doc) => (
              <Card key={doc.id} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16} align="middle">
                  <Col span={4}>
                    <Select
                      placeholder="Тип документа"
                      value={doc.type}
                      onChange={(value) => updateDocument(doc.id, 'type', value)}
                      style={{ width: '100%' }}
                    >
                      {Array.isArray(documentTypes) ? documentTypes.map(type => (
                        <Option key={type.value} value={type.value}>
                          {type.label}
                        </Option>
                      )) : null}
                    </Select>
                  </Col>
                  <Col span={6}>
                    <Input
                      placeholder="Название документа"
                      value={doc.title}
                      onChange={(e) => updateDocument(doc.id, 'title', e.target.value)}
                    />
                  </Col>
                  <Col span={6}>
                    <Input
                      placeholder="Ссылка на файл"
                      value={doc.external_url}
                      onChange={(e) => updateDocument(doc.id, 'external_url', e.target.value)}
                    />
                  </Col>
                  <Col span={4}>
                    <Select
                      placeholder="Поставщик"
                      value={doc.supplier_id}
                      onChange={(value) => updateDocument(doc.id, 'supplier_id', value)}
                      allowClear
                      style={{ width: '100%' }}
                    >
                      {Array.isArray(suppliers) ? suppliers.map(supplier => (
                        <Option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </Option>
                      )) : null}
                    </Select>
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeDocument(doc.id)}
                    />
                  </Col>
                </Row>
              </Card>
            )) : null}
          </TabPane>

          <TabPane
            tab={
              <span>
                Склады
                {warehouseMappings.length > 0 && (
                  <Badge count={warehouseMappings.length} style={{ backgroundColor: '#eb2f96', marginLeft: '8px' }} />
                )}
              </span>
            }
            key="warehouses"
          >
            <Alert
              message="Управление складами"
              description="Настройте склады для товара, уровни остатков и точки заказа. Это поможет автоматизировать процесс пополнения запасов."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Button
                  type="dashed"
                  onClick={addWarehouseMapping}
                  icon={<PlusOutlined />}
                >
                  Добавить склад
                </Button>
                <Button
                  type="link"
                  onClick={() => {
                    // Быстрое добавление популярных складов
                    if (warehouses.length > 0) {
                      const firstWarehouse = warehouses[0];
                      setWarehouseMappings([...warehouseMappings, {
                        id: Date.now(),
                        warehouse_id: firstWarehouse.id,
                        min_stock_level: 10,
                        max_stock_level: 100,
                        reorder_point: 20,
                        is_active: true
                      }]);
                      message.success('Добавлен склад по умолчанию');
                    } else {
                      message.warning('Сначала добавьте склады в системе');
                    }
                  }}
                  icon={<HomeOutlined />}
                >
                  Добавить по умолчанию
                </Button>
                <Text type="secondary">
                  Настройте склады для товара и уровни остатков
                </Text>
              </Space>
            </div>

            {Array.isArray(warehouseMappings) ? warehouseMappings.map((mapping) => (
              <Card key={mapping.id} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16} align="middle">
                  <Col span={6}>
                    <Select
                      placeholder="Выберите склад"
                      value={mapping.warehouse_id}
                      onChange={(value) => updateWarehouseMapping(mapping.id, 'warehouse_id', value)}
                      style={{ width: '100%' }}
                    >
                      {Array.isArray(warehouses) ? warehouses.map(warehouse => (
                        <Option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </Option>
                      )) : null}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <InputNumber
                      placeholder="Мин. остаток"
                      value={mapping.min_stock_level}
                      onChange={(value) => updateWarehouseMapping(mapping.id, 'min_stock_level', value)}
                      min={0}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={4}>
                    <InputNumber
                      placeholder="Макс. остаток"
                      value={mapping.max_stock_level}
                      onChange={(value) => updateWarehouseMapping(mapping.id, 'max_stock_level', value)}
                      min={0}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={4}>
                    <InputNumber
                      placeholder="Точка заказа"
                      value={mapping.reorder_point}
                      onChange={(value) => updateWarehouseMapping(mapping.id, 'reorder_point', value)}
                      min={0}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={3}>
                    <Switch
                      checked={mapping.is_active}
                      onChange={(checked) => updateWarehouseMapping(mapping.id, 'is_active', checked)}
                      size="small"
                    />
                    <div style={{ fontSize: '12px', color: '#666' }}>Активен</div>
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeWarehouseMapping(mapping.id)}
                    />
                  </Col>
                </Row>
              </Card>
            )) : null}
          </TabPane>

          <TabPane
            tab={
              <span>
                Поставщики
                {supplierMappings.length > 0 && (
                  <Badge count={supplierMappings.length} style={{ backgroundColor: '#f5222d', marginLeft: '8px' }} />
                )}
              </span>
            }
            key="suppliers"
          >
            <Alert
              message="Управление поставщиками"
              description="Настройте основных и дополнительных поставщиков для товара. Укажите приоритеты и статусы для эффективного управления закупками."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Button
                  type="dashed"
                  onClick={addSupplierMapping}
                  icon={<PlusOutlined />}
                >
                  Добавить поставщика
                </Button>
                <Button
                  type="link"
                  onClick={() => {
                    // Быстрое добавление популярных поставщиков
                    if (suppliers.length > 0) {
                      const firstSupplier = suppliers[0];
                      setSupplierMappings([...supplierMappings, {
                        id: Date.now(),
                        supplier_id: firstSupplier.id,
                        is_main: true,
                        priority: 1,
                        is_active: true
                      }]);
                      message.success('Добавлен основной поставщик');
                    } else {
                      message.warning('Сначала добавьте поставщиков в системе');
                    }
                  }}
                  icon={<UserOutlined />}
                >
                  Добавить основного
                </Button>
                <Text type="secondary">
                  Настройте основных и дополнительных поставщиков
                </Text>
              </Space>
            </div>

            {Array.isArray(supplierMappings) ? supplierMappings.map((mapping) => (
              <Card key={mapping.id} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16} align="middle">
                  <Col span={6}>
                    <Select
                      placeholder="Выберите поставщика"
                      value={mapping.supplier_id}
                      onChange={(value) => updateSupplierMapping(mapping.id, 'supplier_id', value)}
                      style={{ width: '100%' }}
                    >
                      {Array.isArray(suppliers) ? suppliers.map(supplier => (
                        <Option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </Option>
                      )) : null}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Switch
                      checked={mapping.is_main}
                      onChange={(checked) => updateSupplierMapping(mapping.id, 'is_main', checked)}
                      size="small"
                    />
                    <div style={{ fontSize: '12px', color: '#666' }}>Основной</div>
                  </Col>
                  <Col span={4}>
                    <InputNumber
                      placeholder="Приоритет"
                      value={mapping.priority}
                      onChange={(value) => updateSupplierMapping(mapping.id, 'priority', value)}
                      min={1}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={4}>
                    <Switch
                      checked={mapping.is_active}
                      onChange={(checked) => updateSupplierMapping(mapping.id, 'is_active', checked)}
                      size="small"
                    />
                    <div style={{ fontSize: '12px', color: '#666' }}>Активен</div>
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeSupplierMapping(mapping.id)}
                    />
                  </Col>
                </Row>
              </Card>
            )) : null}
          </TabPane>

          <TabPane
            tab={
              <span>
                Цены поставщиков
                {supplierPrices.length > 0 && (
                  <Badge count={supplierPrices.length} style={{ backgroundColor: '#faad14', marginLeft: '8px' }} />
                )}
              </span>
            }
            key="prices"
          >
            <Alert
              message="Цены поставщиков"
              description="Установите цены от разных поставщиков с учетом минимальных количеств и валют. Это поможет оптимизировать закупки и ценообразование."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Button
                  type="dashed"
                  onClick={addSupplierPrice}
                  icon={<PlusOutlined />}
                >
                  Добавить цену поставщика
                </Button>
                <Button
                  type="link"
                  onClick={() => {
                    // Быстрое добавление популярных цен поставщиков
                    if (suppliers.length > 0) {
                      const firstSupplier = suppliers[0];
                      setSupplierPrices([...supplierPrices, {
                        id: Date.now(),
                        main_supplier_id: firstSupplier.id,
                        price: 0,
                        currency: 'RUB',
                        min_quantity: 1,
                        is_active: true
                      }]);
                      message.success('Добавлена цена поставщика по умолчанию');
                    } else {
                      message.warning('Сначала добавьте поставщиков в системе');
                    }
                  }}
                  icon={<DollarOutlined />}
                >
                  Добавить по умолчанию
                </Button>
              </Space>
            </div>

            {Array.isArray(supplierPrices) ? supplierPrices.map((price) => (
              <Card key={price.id} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16} align="middle">
                  <Col span={6}>
                    <Select
                      placeholder="Поставщик"
                      value={price.main_supplier_id}
                      onChange={(value) => updateSupplierPrice(price.id, 'main_supplier_id', value)}
                      style={{ width: '100%' }}
                    >
                      {Array.isArray(suppliers) ? suppliers.map(supplier => (
                        <Option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </Option>
                      )) : null}
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
            )) : null}
          </TabPane>
        </Tabs>

        <Divider />

        <Form.Item>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0',
            borderTop: '1px solid #f0f0f0',
            marginTop: '24px'
          }}>
            <div>
              <Text type="secondary">
                💡 Совет: Заполните основные поля (название, код, категорию) для быстрого создания товара
              </Text>
            </div>
            <Space size="middle">
              <Button
                onClick={onClose}
                size="large"
              >
                Отмена
              </Button>
              <Button
                type="default"
                onClick={() => {
                  // Сохраняем как черновик
                  const values = form.getFieldsValue();
                  values.status = 'draft';
                  handleSubmit(values);
                }}
                loading={isSubmitting}
                disabled={isSubmitting}
                icon={<FileTextOutlined />}
                size="large"
              >
                Сохранить черновик
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isSubmitting}
                disabled={isSubmitting}
                icon={<SaveOutlined />}
                size="large"
              >
                {isSubmitting ? 'Сохранение...' : (isEdit ? 'Сохранить изменения' : 'Создать товар')}
              </Button>
            </Space>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProductForm;