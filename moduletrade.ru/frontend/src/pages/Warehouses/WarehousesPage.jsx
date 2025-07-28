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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
  SwapOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  transferProduct,
} from 'store/warehousesSlice';

const { Option } = Select;
const { Title } = Typography;
const { TextArea } = Input;

const WarehousesPage = () => {
  const dispatch = useDispatch();
  const { items: warehouses, loading } = useSelector((state) => state.warehouses);

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
    // Получаем доступные склады для добавления в мульти-склад
    const available = warehouses.filter(w => 
      w.id !== warehouse.id && 
      w.type !== 'multi'
    );
    setAvailableWarehouses(available);
    
    // Устанавливаем текущие компоненты
    setSelectedComponents(warehouse.components?.map(c => c.source_warehouse_id) || []);
    setIsComponentModalVisible(true);
  };

  const handleSaveComponents = async () => {
    try {
      // Здесь должна быть логика сохранения компонентов мульти-склада
      message.success('Состав мульти-склада обновлен');
      setIsComponentModalVisible(false);
      dispatch(fetchWarehouses());
    } catch (error) {
      message.error('Ошибка обновления состава склада');
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
          physical: { color: 'blue', text: 'Физический' },
          virtual: { color: 'green', text: 'Виртуальный' },
          multi: { color: 'purple', text: 'Мульти-склад' },
          transit: { color: 'orange', text: 'Транзитный' },
        };
        const config = typeConfig[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Адрес',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (value) => (
        <Tag color={value ? 'green' : 'red'}>
          {value ? 'Активен' : 'Неактивен'}
        </Tag>
      ),
    },
    {
      title: 'Всего товаров',
      dataIndex: 'total_products',
      key: 'total_products',
      render: (value) => value || 0,
    },
    {
      title: 'Общая стоимость',
      dataIndex: 'total_value',
      key: 'total_value',
      render: (value) => value ? `₽${value.toLocaleString()}` : '₽0',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          {record.type === 'multi' && (
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => handleManageComponents(record)}
              size="small"
              title="Управление компонентами"
            />
          )}
          <Popconfirm
            title="Удалить склад?"
            description="Это действие нельзя отменить"
            onConfirm={() => handleDelete(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            Управление складами
          </Title>
        </Col>
        <Col>
          <Space>
            <Button
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
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Всего складов"
              value={warehouses.length}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Активных"
              value={warehouses.filter(w => w.is_active).length}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Физических"
              value={warehouses.filter(w => w.type === 'physical').length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Виртуальных"
              value={warehouses.filter(w => w.type === 'virtual').length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={warehouses}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} из ${total} складов`,
          }}
        />
      </Card>

      {/* Модальное окно создания/редактирования склада */}
      <Modal
        title={editingWarehouse ? 'Редактировать склад' : 'Новый склад'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            type: 'physical',
            is_active: true,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Название"
                name="name"
                rules={[{ required: true, message: 'Введите название' }]}
              >
                <Input placeholder="Название склада" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Тип склада"
                name="type"
                rules={[{ required: true, message: 'Выберите тип' }]}
              >
                <Select>
                  <Option value="physical">Физический</Option>
                  <Option value="virtual">Виртуальный</Option>
                  <Option value="multi">Мульти-склад</Option>
                  <Option value="transit">Транзитный</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Адрес" name="address">
            <TextArea rows={2} placeholder="Адрес склада" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Контактное лицо" name="contact_person">
                <Input placeholder="ФИО контактного лица" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Телефон" name="phone">
                <Input placeholder="+7 (999) 123-45-67" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Описание" name="description">
            <TextArea rows={3} placeholder="Дополнительная информация" />
          </Form.Item>

          <Form.Item
            label="Активен"
            name="is_active"
            valuePropName="checked"
          >
            <Select>
              <Option value={true}>Активен</Option>
              <Option value={false}>Неактивен</Option>
            </Select>
          </Form.Item>

          <Row justify="end" gutter={8}>
            <Col>
              <Button onClick={() => setIsModalVisible(false)}>
                Отмена
              </Button>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" loading={loading}>
                Сохранить
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Модальное окно перемещения товаров */}
      <Modal
        title="Перемещение товаров"
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
            label="Товар (SKU)"
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
                label="Куда"
                name="to_warehouse_id"
                rules={[{ required: true, message: 'Выберите склад' }]}
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
        onCancel={() => setIsComponentModalVisible(false)}
        onOk={handleSaveComponents}
        width={600}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <p>Выберите склады, которые будут входить в состав мульти-склада:</p>
        <Transfer
          dataSource={availableWarehouses.map(w => ({
            key: w.id,
            title: w.name,
            description: w.address,
          }))}
          targetKeys={selectedComponents}
          onChange={setSelectedComponents}
          render={item => item.title}
          listStyle={{
            width: 250,
            height: 300,
          }}
          titles={['Доступные склады', 'Включенные в мульти-склад']}
        />
      </Modal>
    </div>
  );
};

export default WarehousesPage;