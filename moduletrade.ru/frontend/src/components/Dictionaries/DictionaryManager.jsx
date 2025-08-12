import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
  message, Tabs, InputNumber, Switch, Popconfirm, Tooltip, Badge,
  TreeSelect, Divider, Typography, Row, Col
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined,
  FolderOutlined, TagOutlined, SettingOutlined, ReloadOutlined
} from '@ant-design/icons';
import { api } from 'services';

const { TabPane } = Tabs;
const { Title, Text } = Typography;
const { TextArea } = Input;

const DictionaryManager = () => {
  const [activeTab, setActiveTab] = useState('categories');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  // Данные справочников
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Загрузка данных
  useEffect(() => {
    loadAllDictionaries();
  }, []);

  const loadAllDictionaries = async () => {
    setLoading(true);
    try {
      const [categoriesRes, brandsRes, attributesRes, suppliersRes, warehousesRes] = await Promise.all([
        api.products.getCategories(),
        api.products.getBrands(),
        api.products.getAttributes(),
        api.suppliers.getSuppliers(),
        api.warehouses.getWarehouses()
      ]);

      setCategories(Array.isArray(categoriesRes) ? categoriesRes : []);
      setBrands(Array.isArray(brandsRes) ? brandsRes : []);
      setAttributes(Array.isArray(attributesRes) ? attributesRes : []);
      setSuppliers(Array.isArray(suppliersRes) ? suppliersRes : []);
      setWarehouses(Array.isArray(warehousesRes) ? warehousesRes : []);
    } catch (error) {
      message.error('Ошибка загрузки справочников');
      console.error('Load dictionaries error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Обработчики для категорий
  const handleAddCategory = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditCategory = (category) => {
    setEditingItem(category);
    form.setFieldsValue({
      name: category.name,
      description: category.description,
      parent_id: category.parent_id,
      is_active: category.is_active !== false,
      sort_order: category.sort_order || 0
    });
    setModalVisible(true);
  };

  const handleSaveCategory = async (values) => {
    try {
      if (editingItem) {
        await api.products.updateCategory(editingItem.id, values);
        message.success('Категория обновлена');
      } else {
        await api.products.createCategory(values);
        message.success('Категория создана');
      }
      setModalVisible(false);
      loadAllDictionaries();
    } catch (error) {
      message.error('Ошибка сохранения категории');
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await api.products.deleteCategory(id);
      message.success('Категория удалена');
      loadAllDictionaries();
    } catch (error) {
      message.error('Ошибка удаления категории');
    }
  };

  // Обработчики для брендов
  const handleAddBrand = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditBrand = (brand) => {
    setEditingItem(brand);
    form.setFieldsValue({
      name: brand.name,
      description: brand.description,
      website: brand.website,
      is_active: brand.is_active !== false,
      sort_order: brand.sort_order || 0
    });
    setModalVisible(true);
  };

  const handleSaveBrand = async (values) => {
    try {
      if (editingItem) {
        await api.products.updateBrand(editingItem.id, values);
        message.success('Бренд обновлен');
      } else {
        await api.products.createBrand(values);
        message.success('Бренд создан');
      }
      setModalVisible(false);
      loadAllDictionaries();
    } catch (error) {
      message.error('Ошибка сохранения бренда');
    }
  };

  const handleDeleteBrand = async (id) => {
    try {
      await api.products.deleteBrand(id);
      message.success('Бренд удален');
      loadAllDictionaries();
    } catch (error) {
      message.error('Ошибка удаления бренда');
    }
  };

  // Обработчики для атрибутов
  const handleAddAttribute = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditAttribute = (attribute) => {
    setEditingItem(attribute);
    form.setFieldsValue({
      name: attribute.name,
      description: attribute.description,
      data_type: attribute.data_type,
      default_unit: attribute.default_unit,
      is_required: attribute.is_required || false,
      is_filterable: attribute.is_filterable || false,
      is_searchable: attribute.is_searchable || false,
      allowed_values: attribute.allowed_values ? attribute.allowed_values.join('\n') : '',
      sort_order: attribute.sort_order || 0
    });
    setModalVisible(true);
  };

  const handleSaveAttribute = async (values) => {
    try {
      const data = {
        ...values,
        allowed_values: values.allowed_values ? values.allowed_values.split('\n').filter(v => v.trim()) : []
      };

      if (editingItem) {
        await api.products.updateAttribute(editingItem.id, data);
        message.success('Атрибут обновлен');
      } else {
        await api.products.createAttribute(data);
        message.success('Атрибут создан');
      }
      setModalVisible(false);
      loadAllDictionaries();
    } catch (error) {
      message.error('Ошибка сохранения атрибута');
    }
  };

  const handleDeleteAttribute = async (id) => {
    try {
      await api.products.deleteAttribute(id);
      message.success('Атрибут удален');
      loadAllDictionaries();
    } catch (error) {
      message.error('Ошибка удаления атрибута');
    }
  };

  // Колонки для таблиц
  const categoryColumns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <FolderOutlined style={{ color: '#1890ff' }} />
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Родительская категория',
      dataIndex: 'parent_name',
      key: 'parent_name',
      render: (text) => text ? <Tag color="blue">{text}</Tag> : '-'
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => (
        <Badge status={active ? 'success' : 'default'} text={active ? 'Активна' : 'Неактивна'} />
      )
    },
    {
      title: 'Порядок',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 100
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditCategory(record)}
            size="small"
          />
          <Popconfirm
            title="Удалить категорию?"
            onConfirm={() => handleDeleteCategory(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const brandColumns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Сайт',
      dataIndex: 'website',
      key: 'website',
      render: (url) => url ? <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> : '-'
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => (
        <Badge status={active ? 'success' : 'default'} text={active ? 'Активен' : 'Неактивен'} />
      )
    },
    {
      title: 'Порядок',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 100
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditBrand(record)}
            size="small"
          />
          <Popconfirm
            title="Удалить бренд?"
            onConfirm={() => handleDeleteBrand(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const attributeColumns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Тип данных',
      dataIndex: 'data_type',
      key: 'data_type',
      render: (type) => {
        const typeLabels = {
          text: 'Текст',
          number: 'Число',
          boolean: 'Да/Нет',
          enum: 'Список',
          date: 'Дата'
        };
        return <Tag color="blue">{typeLabels[type] || type}</Tag>;
      }
    },
    {
      title: 'Единица измерения',
      dataIndex: 'default_unit',
      key: 'default_unit',
      render: (unit) => unit ? <Tag color="green">{unit}</Tag> : '-'
    },
    {
      title: 'Обязательный',
      dataIndex: 'is_required',
      key: 'is_required',
      render: (required) => (
        <Badge status={required ? 'error' : 'default'} text={required ? 'Да' : 'Нет'} />
      )
    },
    {
      title: 'Фильтруемый',
      dataIndex: 'is_filterable',
      key: 'is_filterable',
      render: (filterable) => (
        <Badge status={filterable ? 'success' : 'default'} text={filterable ? 'Да' : 'Нет'} />
      )
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditAttribute(record)}
            size="small"
          />
          <Popconfirm
            title="Удалить атрибут?"
            onConfirm={() => handleDeleteAttribute(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  // Рендер модального окна в зависимости от активной вкладки
  const renderModalContent = () => {
    switch (activeTab) {
      case 'categories':
        return (
          <Form form={form} layout="vertical" onFinish={handleSaveCategory}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="Название категории"
                  rules={[{ required: true, message: 'Введите название категории' }]}
                >
                  <Input placeholder="Введите название" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="parent_id"
                  label="Родительская категория"
                >
                  <TreeSelect
                    placeholder="Выберите родительскую категорию"
                    treeData={categories.map(cat => ({
                      title: cat.name,
                      value: cat.id,
                      children: cat.children
                    }))}
                    allowClear
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="description"
              label="Описание"
            >
              <TextArea rows={3} placeholder="Введите описание категории" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="sort_order"
                  label="Порядок сортировки"
                  initialValue={0}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="is_active"
                  label="Активна"
                  valuePropName="checked"
                  initialValue={true}
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        );

      case 'brands':
        return (
          <Form form={form} layout="vertical" onFinish={handleSaveBrand}>
            <Form.Item
              name="name"
              label="Название бренда"
              rules={[{ required: true, message: 'Введите название бренда' }]}
            >
              <Input placeholder="Введите название бренда" />
            </Form.Item>
            <Form.Item
              name="description"
              label="Описание"
            >
              <TextArea rows={3} placeholder="Введите описание бренда" />
            </Form.Item>
            <Form.Item
              name="website"
              label="Сайт"
            >
              <Input placeholder="https://example.com" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="sort_order"
                  label="Порядок сортировки"
                  initialValue={0}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="is_active"
                  label="Активен"
                  valuePropName="checked"
                  initialValue={true}
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        );

      case 'attributes':
        return (
          <Form form={form} layout="vertical" onFinish={handleSaveAttribute}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="Название атрибута"
                  rules={[{ required: true, message: 'Введите название атрибута' }]}
                >
                  <Input placeholder="Введите название" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="data_type"
                  label="Тип данных"
                  rules={[{ required: true, message: 'Выберите тип данных' }]}
                  initialValue="text"
                >
                  <Select>
                    <Select.Option value="text">Текст</Select.Option>
                    <Select.Option value="number">Число</Select.Option>
                    <Select.Option value="boolean">Да/Нет</Select.Option>
                    <Select.Option value="enum">Список значений</Select.Option>
                    <Select.Option value="date">Дата</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="description"
              label="Описание"
            >
              <TextArea rows={3} placeholder="Введите описание атрибута" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="default_unit"
                  label="Единица измерения"
                >
                  <Select placeholder="Выберите единицу" allowClear>
                    <Select.Option value="шт">Штука</Select.Option>
                    <Select.Option value="кг">Килограмм</Select.Option>
                    <Select.Option value="г">Грамм</Select.Option>
                    <Select.Option value="л">Литр</Select.Option>
                    <Select.Option value="м">Метр</Select.Option>
                    <Select.Option value="см">Сантиметр</Select.Option>
                    <Select.Option value="мм">Миллиметр</Select.Option>
                    <Select.Option value="м²">Квадратный метр</Select.Option>
                    <Select.Option value="м³">Кубический метр</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="sort_order"
                  label="Порядок сортировки"
                  initialValue={0}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="is_required"
                  label="Обязательный"
                  valuePropName="checked"
                  initialValue={false}
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="is_filterable"
                  label="Использовать в фильтрах"
                  valuePropName="checked"
                  initialValue={false}
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="is_searchable"
                  label="Использовать в поиске"
                  valuePropName="checked"
                  initialValue={false}
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="allowed_values"
              label="Допустимые значения (по одному на строку)"
              extra="Заполните, если тип данных - 'Список значений'"
            >
              <TextArea rows={4} placeholder="Значение 1&#10;Значение 2&#10;Значение 3" />
            </Form.Item>
          </Form>
        );

      default:
        return null;
    }
  };

  const getModalTitle = () => {
    const action = editingItem ? 'Редактировать' : 'Добавить';
    const itemType = {
      categories: 'категорию',
      brands: 'бренд',
      attributes: 'атрибут'
    }[activeTab];
    return `${action} ${itemType}`;
  };

  const getAddButtonText = () => {
    const itemType = {
      categories: 'категорию',
      brands: 'бренд',
      attributes: 'атрибут'
    }[activeTab];
    return `Добавить ${itemType}`;
  };

  const handleAdd = () => {
    switch (activeTab) {
      case 'categories':
        return handleAddCategory();
      case 'brands':
        return handleAddBrand();
      case 'attributes':
        return handleAddAttribute();
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Управление справочниками</Title>
      
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Категории" key="categories">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                {getAddButtonText()}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadAllDictionaries}
                style={{ marginLeft: 8 }}
              >
                Обновить
              </Button>
            </div>
            <Table
              columns={categoryColumns}
              dataSource={categories}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </TabPane>

          <TabPane tab="Бренды" key="brands">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                {getAddButtonText()}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadAllDictionaries}
                style={{ marginLeft: 8 }}
              >
                Обновить
              </Button>
            </div>
            <Table
              columns={brandColumns}
              dataSource={brands}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </TabPane>

          <TabPane tab="Атрибуты" key="attributes">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                {getAddButtonText()}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadAllDictionaries}
                style={{ marginLeft: 8 }}
              >
                Обновить
              </Button>
            </div>
            <Table
              columns={attributeColumns}
              dataSource={attributes}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </TabPane>

          <TabPane tab="Поставщики" key="suppliers">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => window.location.href = '/suppliers'}
              >
                Управлять поставщиками
              </Button>
            </div>
            <Table
              columns={[
                { title: 'Название', dataIndex: 'name', key: 'name' },
                { title: 'Тип', dataIndex: 'type', key: 'type' },
                { title: 'Статус', dataIndex: 'is_active', key: 'is_active' }
              ]}
              dataSource={suppliers}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </TabPane>

          <TabPane tab="Склады" key="warehouses">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => window.location.href = '/warehouses'}
              >
                Управлять складами
              </Button>
            </div>
            <Table
              columns={[
                { title: 'Название', dataIndex: 'name', key: 'name' },
                { title: 'Адрес', dataIndex: 'address', key: 'address' },
                { title: 'Статус', dataIndex: 'is_active', key: 'is_active' }
              ]}
              dataSource={warehouses}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={getModalTitle()}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            Отмена
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()}>
            <SaveOutlined /> Сохранить
          </Button>
        ]}
        width={600}
        destroyOnClose
      >
        {renderModalContent()}
      </Modal>
    </div>
  );
};

export default DictionaryManager;
