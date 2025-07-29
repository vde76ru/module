// frontend/src/pages/Warehouses/WarehousesPage.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Table,
  Card,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Popconfirm,
  message,
  Row,
  Col,
  Typography,
  Drawer,
  Statistic,
  Transfer,
  Alert,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
  SwapOutlined,
  SettingOutlined,
  CloudOutlined,
  ApartmentOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  transferProduct,
} from '../../../store/warehousesSlice';

const { Option } = Select;
const { Title } = Typography;
const { TextArea } = Input;

const WarehousesPage = () => {
  const dispatch = useDispatch();
  const { items: warehouses = [], loading } = useSelector((state) => state.warehouses || {});

  const [form] = Form.useForm();
  const [transferForm] = Form.useForm();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isTransferVisible, setIsTransferVisible] = useState(false);
  const [isComponentModalVisible, setIsComponentModalVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [availableWarehouses, setAvailableWarehouses] = useState([]);
  const [selectedComponents, setSelectedComponents] = useState([]);

  useEffect(() => {
    dispatch(fetchWarehouses());
  }, [dispatch]);

  // ✅ ИСПРАВЛЯЕМ ПРОБЛЕМУ С FILTER - проверяем что warehouses является массивом
  useEffect(() => {
    if (warehouses && Array.isArray(warehouses)) {
      // Фильтруем физические склады для компонентов мульти-склада
      const physicalWarehouses = warehouses.filter(w => w.type === 'physical' && w.is_active);
      setAvailableWarehouses(physicalWarehouses);
    }
  }, [warehouses]);

  const handleCreate = () => {
    setEditingWarehouse(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    form.setFieldsValue(warehouse);
    setIsModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingWarehouse) {
        await dispatch(updateWarehouse({ id: editingWarehouse.id, data: values })).unwrap();
        message.success('Склад обновлен');
      } else {
        await dispatch(createWarehouse(values)).unwrap();
        message.success('Склад создан');
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingWarehouse(null);
    } catch (error) {
      message.error('Ошибка сохранения склада');
    }
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteWarehouse(id)).unwrap();
      message.success('Склад удален');
    } catch (error) {
      message.error('Ошибка удаления склада');
    }
  };

  const handleTransfer = () => {
    transferForm.resetFields();
    setIsTransferVisible(true);
  };

  const handleTransferSave = async (values) => {
    try {
      await dispatch(transferProduct(values)).unwrap();
      message.success('Товар перемещен');
      setIsTransferVisible(false);
      transferForm.resetFields();
    } catch (error) {
      message.error('Ошибка перемещения товара');
    }
  };

  const handleManageComponents = (warehouse) => {
    if (warehouse.type !== 'multi') {
      message.warning('Управление компонентами доступно только для мульти-складов');
      return;
    }

    setSelectedWarehouse(warehouse);

    // ✅ ИСПРАВЛЕНО: Безопасная работа с массивами
    if (warehouse.components && Array.isArray(warehouse.components)) {
      setSelectedComponents(warehouse.components.map(c => c.source_warehouse_id));
    } else {
      setSelectedComponents([]);
    }

    setIsComponentModalVisible(true);
  };

  const handleSaveComponents = async () => {
    try {
      // Логика сохранения компонентов мульти-склада
      const updateData = {
        components: selectedComponents
      };

      await dispatch(updateWarehouse({
        id: selectedWarehouse.id,
        data: updateData
      })).unwrap();

      message.success('Состав мульти-склада обновлен');
      setIsComponentModalVisible(false);
      setSelectedWarehouse(null);
    } catch (error) {
      message.error('Ошибка обновления состава склада');
    }
  };

  const getWarehouseTypeIcon = (type) => {
    switch (type) {
      case 'physical':
        return <ShopOutlined />;
      case 'virtual':
        return <CloudOutlined />;
      case 'multi':
        return <ApartmentOutlined />;
      default:
        return <ShopOutlined />;
    }
  };

  const getWarehouseTypeTag = (type) => {
    const typeMap = {
      physical: { color: 'blue', text: 'Физический' },
      virtual: { color: 'purple', text: 'Виртуальный' },
      multi: { color: 'orange', text: 'Мульти-склад' }
    };

    const config = typeMap[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {getWarehouseTypeIcon(record.type)}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      render: (type) => getWarehouseTypeTag(type),
    },
    {
      title: 'Адрес',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      sorter: (a, b) => a.priority - b.priority,
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Активен' : 'Неактивен'}
        </Tag>
      ),
    },
    {
      title: 'Товаров',
      dataIndex: 'products_count',
      key: 'products_count',
      render: (count) => count || 0,
    },
    {
      title: 'Единиц',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      render: (quantity) => quantity || 0,
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Редактировать
          </Button>

          {record.type === 'multi' && (
            <Button
              type="link"
              icon={<SettingOutlined />}
              onClick={() => handleManageComponents(record)}
            >
              Компоненты
            </Button>
          )}

          <Popconfirm
            title="Вы уверены, что хотите удалить этот склад?"
            onConfirm={() => handleDelete(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ✅ БЕЗОПАСНАЯ ПРОВЕРКА НА МАССИВ ПЕРЕД РЕНДЕРОМ
  const warehousesData = Array.isArray(warehouses) ? warehouses : [];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2}>Управление складами</Title>
        </Col>
        <Col>
          <Space>
            <Button
              type="primary"
              icon={<SwapOutlined />}
              onClick={handleTransfer}
            >
              Перемещение товаров
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              Добавить склад
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Статистика */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Всего складов"
              value={warehousesData.length}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Активных складов"
              value={warehousesData.filter(w => w.is_active).length}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Физических складов"
              value={warehousesData.filter(w => w.type === 'physical').length}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Виртуальных складов"
              value={warehousesData.filter(w => w.type === 'virtual').length}
              prefix={<CloudOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Основная таблица */}
      <Card>
        <Table
          columns={columns}
          dataSource={warehousesData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} из ${total} складов`,
          }}
        />
      </Card>

      {/* Модальное окно создания/редактирования склада */}
      <Modal
        title={editingWarehouse ? 'Редактировать склад' : 'Создать склад'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingWarehouse(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            label="Название склада"
            name="name"
            rules={[{ required: true, message: 'Введите название склада' }]}
          >
            <Input placeholder="Название склада" />
          </Form.Item>

          <Form.Item
            label="Тип склада"
            name="type"
            rules={[{ required: true, message: 'Выберите тип склада' }]}
          >
            <Select placeholder="Выберите тип склада">
              <Option value="physical">
                <Space>
                  <ShopOutlined />
                  Физический склад
                </Space>
              </Option>
              <Option value="virtual">
                <Space>
                  <CloudOutlined />
                  Виртуальный склад
                </Space>
              </Option>
              <Option value="multi">
                <Space>
                  <ApartmentOutlined />
                  Мульти-склад
                </Space>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Адрес"
            name="address"
          >
            <TextArea rows={2} placeholder="Адрес склада" />
          </Form.Item>

          <Form.Item
            label="Описание"
            name="description"
          >
            <TextArea rows={3} placeholder="Описание склада" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Приоритет"
                name="priority"
                initialValue={0}
              >
                <Input type="number" min={0} placeholder="Приоритет" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Статус"
                name="is_active"
                initialValue={true}
              >
                <Select>
                  <Option value={true}>Активен</Option>
                  <Option value={false}>Неактивен</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row justify="end" gutter={8}>
            <Col>
              <Button
                onClick={() => {
                  setIsModalVisible(false);
                  setEditingWarehouse(null);
                  form.resetFields();
                }}
              >
                Отмена
              </Button>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingWarehouse ? 'Обновить' : 'Создать'}
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Модальное окно перемещения товаров */}
      <Modal
        title="Перемещение товаров между складами"
        open={isTransferVisible}
        onCancel={() => setIsTransferVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={transferForm}
          layout="vertical"
          onFinish={handleTransferSave}
        >
          <Form.Item
            label="SKU товара"
            name="product_sku"
            rules={[{ required: true, message: 'Введите SKU товара' }]}
          >
            <Input placeholder="Введите SKU товара" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Откуда"
                name="from_warehouse_id"
                rules={[{ required: true, message: 'Выберите склад' }]}
              >
                <Select placeholder="Выберите склад">
                  {warehousesData.map(warehouse => (
                    <Option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Куда"
                name="to_warehouse_id"
                rules={[{ required: true, message: 'Выберите склад' }]}
              >
                <Select placeholder="Выберите склад">
                  {warehousesData.map(warehouse => (
                    <Option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Количество"
            name="quantity"
            rules={[{ required: true, message: 'Введите количество' }]}
          >
            <Input type="number" min={1} placeholder="Количество для перемещения" />
          </Form.Item>

          <Form.Item label="Комментарий" name="comment">
            <TextArea rows={2} placeholder="Причина перемещения" />
          </Form.Item>

          <Row justify="end" gutter={8}>
            <Col>
              <Button onClick={() => setIsTransferVisible(false)}>
                Отмена
              </Button>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" loading={loading}>
                Переместить
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Модальное окно управления компонентами мульти-склада */}
      <Modal
        title={`Управление составом: ${selectedWarehouse?.name}`}
        open={isComponentModalVisible}
        onCancel={() => {
          setIsComponentModalVisible(false);
          setSelectedWarehouse(null);
        }}
        onOk={handleSaveComponents}
        width={600}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Alert
          message="Информация"
          description="Выберите склады, которые будут входить в состав мульти-склада. Остатки товаров будут суммироваться автоматически."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Transfer
          dataSource={availableWarehouses.map(w => ({
            key: w.id,
            title: w.name,
            description: w.address || 'Без адреса',
            disabled: w.id === selectedWarehouse?.id, // Склад не может включать сам себя
          }))}
          targetKeys={selectedComponents}
          onChange={setSelectedComponents}
          render={item => item.title}
          listStyle={{
            width: 250,
            height: 300,
          }}
          titles={['Доступные склады', 'Включенные в мульти-склад']}
          showSearch
          filterOption={(inputValue, option) =>
            option.title?.toLowerCase().includes(inputValue.toLowerCase())
          }
        />
      </Modal>
    </div>
  );
};

export default WarehousesPage;