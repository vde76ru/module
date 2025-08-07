// ===================================================
// ФАЙЛ: frontend/src/pages/Warehouses/WarehousesPage.jsx
// ✅ ИСПРАВЛЕНО: transferProduct заменен на transferStock
// ✅ ИСПРАВЛЕНО: Убран PermissionGuard, заменен на hasPermission условия
// ✅ ИСПРАВЛЕНО: Убран дублирующий импорт usePermissions
// ✅ ИСПРАВЛЕНО: Правильные импорты из store внутри src/
// ===================================================
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
  Switch,
  InputNumber
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

// ✅ ИСПРАВЛЕНО: transferProduct заменен на transferStock
import {
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  transferStock,
} from '../../store/warehousesSlice';

// ✅ ИСПРАВЛЕНО: Только один импорт usePermissions
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../utils/constants';

const { Option } = Select;
const { Title } = Typography;
const { TextArea } = Input;

const WarehousesPage = () => {
  const dispatch = useDispatch();
  const { items: warehouses = [], loading } = useSelector((state) => state.warehouses || {});
  const { hasPermission } = usePermissions();

  const [form] = Form.useForm();
  const [transferForm] = Form.useForm();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isTransferVisible, setIsTransferVisible] = useState(false);
  const [isComponentModalVisible, setIsComponentModalVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [availableWarehouses, setAvailableWarehouses] = useState([]);
  const [selectedComponents, setSelectedComponents] = useState([]);

  // Проверяем права
  const canCreate = hasPermission(PERMISSIONS.WAREHOUSES_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.WAREHOUSES_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.WAREHOUSES_DELETE);
  const canView = hasPermission(PERMISSIONS.WAREHOUSES_VIEW);

  useEffect(() => {
    if (canView) {
      dispatch(fetchWarehouses());
    }
  }, [dispatch, canView]);

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

  const handleSubmit = async (values) => {
    try {
      if (editingWarehouse) {
        await dispatch(updateWarehouse({ id: editingWarehouse.id, data: values })).unwrap();
        message.success('Склад обновлен');
      } else {
        await dispatch(createWarehouse(values)).unwrap();
        message.success('Склад создан');
      }
      setIsModalVisible(false);
    } catch (error) {
      message.error('Ошибка сохранения склада');
    }
  };

  const handleDelete = async (warehouseId) => {
    try {
      await dispatch(deleteWarehouse(warehouseId)).unwrap();
      message.success('Склад удален');
    } catch (error) {
      message.error('Ошибка удаления склада');
    }
  };

  const handleTransfer = () => {
    setIsTransferVisible(true);
  };

  const handleManageComponents = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setIsComponentModalVisible(true);
  };

  // ✅ ИСПРАВЛЕНО: transferProduct заменен на transferStock
  const handleTransferSubmit = async (values) => {
    try {
      await dispatch(transferStock(values)).unwrap();
      message.success('Перемещение выполнено');
      setIsTransferVisible(false);
      transferForm.resetFields();
    } catch (error) {
      message.error('Ошибка перемещения товара');
    }
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeConfig = {
          main: { label: 'Основной', icon: <ShopOutlined />, color: 'blue' },
          regional: { label: 'Региональный', icon: <ShopOutlined />, color: 'green' },
          pickup: { label: 'Пункт выдачи', icon: <ShopOutlined />, color: 'orange' },
          virtual: { label: 'Виртуальный', icon: <CloudOutlined />, color: 'purple' },
        };
        const config = typeConfig[type] || typeConfig.main;
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Адрес',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: 'Товары',
      dataIndex: 'total_products',
      key: 'total_products',
      render: (count) => count || 0,
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
      title: 'Действия',
      key: 'actions',
      render: (_, warehouse) => (
        <Space>
          {canUpdate && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(warehouse)}
            >
              Редактировать
            </Button>
          )}
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => handleManageComponents(warehouse)}
          >
            Управление
          </Button>
          {canDelete && (
            <Popconfirm
              title="Удалить склад?"
              description="Это действие нельзя отменить"
              onConfirm={() => handleDelete(warehouse.id)}
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
          )}
        </Space>
      ),
    },
  ];

  if (!canView) {
    return (
      <Alert
        message="Нет доступа"
        description="У вас нет прав для просмотра складов"
        type="warning"
        showIcon
      />
    );
  }

  return (
    <div className="warehouses-page">
      <Card>
        <div className="page-header">
          <Title level={2}>Управление складами</Title>
          <Space>
            <Button
              type="primary"
              icon={<SwapOutlined />}
              onClick={handleTransfer}
            >
              Перемещение товара
            </Button>
            {canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                Добавить склад
              </Button>
            )}
          </Space>
        </div>

        <Table
          dataSource={warehouses}
          columns={columns}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} из ${total} складов`,
          }}
        />
      </Card>

      {/* Модальное окно создания/редактирования склада */}
      <Modal
        title={editingWarehouse ? 'Редактировать склад' : 'Создать склад'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Название"
                name="name"
                rules={[
                  { required: true, message: 'Введите название склада' },
                  { min: 2, message: 'Минимум 2 символа' }
                ]}
              >
                <Input placeholder="Основной склад" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Тип склада"
                name="type"
                rules={[{ required: true, message: 'Выберите тип склада' }]}
              >
                <Select placeholder="Выберите тип">
                  <Option value="main">Основной</Option>
                  <Option value="regional">Региональный</Option>
                  <Option value="pickup">Пункт выдачи</Option>
                  <Option value="virtual">Виртуальный</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Адрес"
            name="address"
            rules={[{ required: true, message: 'Введите адрес склада' }]}
          >
            <TextArea
              placeholder="г. Москва, ул. Примерная, д. 1"
              rows={2}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Контактное лицо"
                name="contact_person"
              >
                <Input placeholder="Иван Иванов" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Телефон"
                name="contact_phone"
              >
                <Input placeholder="+7 (999) 123-45-67" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Описание"
            name="description"
          >
            <TextArea
              placeholder="Дополнительная информация о складе"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
            <span style={{ marginLeft: 8 }}>Активен</span>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно перемещения товара */}
      <Modal
        title="Перемещение товара между складами"
        open={isTransferVisible}
        onCancel={() => setIsTransferVisible(false)}
        onOk={() => transferForm.submit()}
        width={600}
      >
        <Form
          form={transferForm}
          layout="vertical"
          onFinish={handleTransferSubmit}
        >
          <Form.Item
            label="Товар"
            name="product_id"
            rules={[{ required: true, message: 'Выберите товар' }]}
          >
            <Select
              placeholder="Выберите товар"
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {/* Здесь должен быть список товаров */}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Со склада"
                name="from_warehouse_id"
                rules={[{ required: true, message: 'Выберите склад-источник' }]}
              >
                <Select placeholder="Выберите склад">
                  {warehouses.map(warehouse => (
                    <Option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="На склад"
                name="to_warehouse_id"
                rules={[{ required: true, message: 'Выберите склад-получатель' }]}
              >
                <Select placeholder="Выберите склад">
                  {warehouses.map(warehouse => (
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
            rules={[
              { required: true, message: 'Введите количество' },
              { type: 'number', min: 1, message: 'Количество должно быть больше 0' }
            ]}
          >
            <InputNumber
              placeholder="1"
              min={1}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="Причина перемещения"
            name="reason"
          >
            <TextArea
              placeholder="Опишите причину перемещения (необязательно)"
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer для управления компонентами склада */}
      <Drawer
        title={`Управление компонентами: ${selectedWarehouse?.name}`}
        placement="right"
        onClose={() => setIsComponentModalVisible(false)}
        open={isComponentModalVisible}
        width={800}
      >
        <div className="warehouse-components">
          <Alert
            message="Управление компонентами склада"
            description="Здесь вы можете настроить зоны хранения, стеллажи и другие компоненты склада"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card title="Зоны хранения" size="small">
                <Button type="dashed" block icon={<PlusOutlined />}>
                  Добавить зону
                </Button>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Стеллажи" size="small">
                <Button type="dashed" block icon={<PlusOutlined />}>
                  Добавить стеллаж
                </Button>
              </Card>
            </Col>
          </Row>

          <Card title="Статистика склада" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Общий объем"
                  value={1000}
                  suffix="м³"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Занято"
                  value={750}
                  suffix="м³"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Свободно"
                  value={250}
                  suffix="м³"
                />
              </Col>
            </Row>
          </Card>
        </div>
      </Drawer>
    </div>
  );
};

export default WarehousesPage;