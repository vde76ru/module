// ===================================================
// ФАЙЛ: frontend/src/pages/Warehouses/WarehousesPage.jsx
// ИСПРАВЛЕНО: Правильные импорты из store внутри src/
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
  Switch
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

// ✅ ИСПРАВЛЕНО: Правильный путь к store внутри src/
import {
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  transferProduct,
} from '../../store/warehousesSlice';

import PermissionGuard from '../../components/Auth/PermissionGuard';
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

  useEffect(() => {
    dispatch(fetchWarehouses());
  }, [dispatch]);

  // ✅ ИСПРАВЛЕНО: Безопасная проверка на массив
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
    form.setFieldsValue({
      ...warehouse,
      components: warehouse.components || [],
    });
    setSelectedComponents(warehouse.components || []);
    setIsModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteWarehouse(id)).unwrap();
      message.success('Склад удален');
    } catch (error) {
      message.error('Ошибка удаления склада');
    }
  };

  const handleSave = async (values) => {
    try {
      const warehouseData = {
        ...values,
        components: values.type === 'multi' ? selectedComponents : undefined,
      };

      if (editingWarehouse) {
        await dispatch(updateWarehouse({ id: editingWarehouse.id, data: warehouseData })).unwrap();
        message.success('Склад обновлен');
      } else {
        await dispatch(createWarehouse(warehouseData)).unwrap();
        message.success('Склад создан');
      }

      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('Ошибка сохранения склада');
    }
  };

  const handleTransfer = () => {
    setIsTransferVisible(true);
    transferForm.resetFields();
  };

  const handleTransferSubmit = async (values) => {
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
    setSelectedWarehouse(warehouse);
    setSelectedComponents(warehouse.components || []);
    setIsComponentModalVisible(true);
  };

  const handleComponentsChange = (targetKeys) => {
    setSelectedComponents(targetKeys);
  };

  const saveComponents = async () => {
    try {
      const warehouseData = {
        ...selectedWarehouse,
        components: selectedComponents,
      };

      await dispatch(updateWarehouse({ 
        id: selectedWarehouse.id, 
        data: warehouseData 
      })).unwrap();
      
      message.success('Компоненты склада обновлены');
      setIsComponentModalVisible(false);
    } catch (error) {
      message.error('Ошибка обновления компонентов');
    }
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {record.type === 'physical' && <ShopOutlined />}
          {record.type === 'virtual' && <CloudOutlined />}
          {record.type === 'multi' && <ApartmentOutlined />}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeConfig = {
          physical: { color: 'blue', text: 'Физический' },
          virtual: { color: 'green', text: 'Виртуальный' },
          multi: { color: 'purple', text: 'Мульти-склад' },
        };
        const config = typeConfig[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Адрес',
      dataIndex: 'address',
      key: 'address',
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
      render: (_, record) => (
        <Space>
          <PermissionGuard permission={PERMISSIONS.WAREHOUSES_VIEW}>
            <Button
              type="link"
              icon={<InfoCircleOutlined />}
              onClick={() => handleEdit(record)}
            >
              Просмотр
            </Button>
          </PermissionGuard>

          <PermissionGuard permission={PERMISSIONS.WAREHOUSES_UPDATE}>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              Редактировать
            </Button>
          </PermissionGuard>

          {record.type === 'multi' && (
            <PermissionGuard permission={PERMISSIONS.WAREHOUSES_UPDATE}>
              <Button
                type="link"
                icon={<SettingOutlined />}
                onClick={() => handleManageComponents(record)}
              >
                Компоненты
              </Button>
            </PermissionGuard>
          )}

          <PermissionGuard permission={PERMISSIONS.WAREHOUSES_DELETE}>
            <Popconfirm
              title="Удалить склад?"
              onConfirm={() => handleDelete(record.id)}
              okText="Да"
              cancelText="Нет"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                Удалить
              </Button>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4}>Склады</Title>
          </Col>
          <Col>
            <Space>
              <PermissionGuard permission={PERMISSIONS.WAREHOUSES_CREATE}>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  Добавить склад
                </Button>
              </PermissionGuard>
              <Button icon={<SwapOutlined />} onClick={handleTransfer}>
                Перемещение товаров
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={Array.isArray(warehouses) ? warehouses : []}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total}`,
          }}
        />
      </Card>

      {/* Модальное окно создания/редактирования склада */}
      <Modal
        title={editingWarehouse ? 'Редактировать склад' : 'Создать склад'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: 'Введите название склада' }]}
          >
            <Input placeholder="Название склада" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Тип склада"
            rules={[{ required: true, message: 'Выберите тип склада' }]}
          >
            <Select placeholder="Выберите тип склада">
              <Option value="physical">Физический</Option>
              <Option value="virtual">Виртуальный</Option>
              <Option value="multi">Мульти-склад</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="address"
            label="Адрес"
          >
            <TextArea rows={2} placeholder="Адрес склада" />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Статус"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="Активен" unCheckedChildren="Неактивен" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingWarehouse ? 'Обновить' : 'Создать'}
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>
                Отмена
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно перемещения товаров */}
      <Modal
        title="Перемещение товаров"
        open={isTransferVisible}
        onCancel={() => setIsTransferVisible(false)}
        footer={null}
      >
        <Form
          form={transferForm}
          layout="vertical"
          onFinish={handleTransferSubmit}
        >
          <Form.Item
            name="product_id"
            label="Товар"
            rules={[{ required: true, message: 'Выберите товар' }]}
          >
            <Select placeholder="Выберите товар">
              {/* Здесь будет список товаров */}
            </Select>
          </Form.Item>

          <Form.Item
            name="from_warehouse_id"
            label="Из склада"
            rules={[{ required: true, message: 'Выберите склад-источник' }]}
          >
            <Select placeholder="Выберите склад-источник">
              {warehouses.map(warehouse => (
                <Option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="to_warehouse_id"
            label="В склад"
            rules={[{ required: true, message: 'Выберите склад-получатель' }]}
          >
            <Select placeholder="Выберите склад-получатель">
              {warehouses.map(warehouse => (
                <Option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Количество"
            rules={[{ required: true, message: 'Введите количество' }]}
          >
            <Input type="number" min={1} placeholder="Количество" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Переместить
              </Button>
              <Button onClick={() => setIsTransferVisible(false)}>
                Отмена
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно управления компонентами мульти-склада */}
      <Modal
        title="Управление компонентами мульти-склада"
        open={isComponentModalVisible}
        onCancel={() => setIsComponentModalVisible(false)}
        onOk={saveComponents}
        width={800}
      >
        <Alert
          message="Выберите физические склады, которые будут входить в состав мульти-склада"
          type="info"
          style={{ marginBottom: 16 }}
        />
        
        <Transfer
          dataSource={availableWarehouses.map(w => ({
            key: w.id,
            title: w.name,
            description: w.address,
          }))}
          titles={['Доступные склады', 'Выбранные склады']}
          targetKeys={selectedComponents}
          onChange={handleComponentsChange}
          render={item => item.title}
        />
      </Modal>
    </div>
  );
};

export default WarehousesPage;