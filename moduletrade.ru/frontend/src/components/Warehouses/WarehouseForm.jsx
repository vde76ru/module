import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Row,
  Col,
  Card,
  Transfer,
  message,
  Divider,
  Alert,
  InputNumber,
  Tooltip
} from 'antd';
import {
  SaveOutlined,
  InfoCircleOutlined,
  ShopOutlined,
  CloudOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import { createWarehouse, updateWarehouse } from 'store/warehousesSlice';
import axios from 'utils/axios';

const { Option } = Select;
const { TextArea } = Input;

const WarehouseForm = ({ warehouse, visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.warehouses);

  const [warehouseType, setWarehouseType] = useState('physical');
  const [availableWarehouses, setAvailableWarehouses] = useState([]);
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [transferData, setTransferData] = useState([]);

  const isEdit = !!warehouse;

  useEffect(() => {
    if (visible) {
      if (isEdit) {
        populateForm();
        if (warehouse.type === 'multi') {
          fetchAvailableWarehouses();
        }
      } else {
        form.resetFields();
        setWarehouseType('physical');
        setSelectedComponents([]);
      }
    }
  }, [visible, warehouse]);

  const populateForm = () => {
    form.setFieldsValue({
      ...warehouse,
      is_active: warehouse.is_active !== false
    });
    setWarehouseType(warehouse.type || 'physical');

    if (warehouse.components) {
      setSelectedComponents(warehouse.components.map(c => c.id));
    }
  };

  const fetchAvailableWarehouses = async () => {
    try {
      const response = await axios.get('/warehouses', {
        params: { type: 'physical,virtual', exclude: warehouse?.id }
      });

      const warehouses = response.data.filter(w =>
        w.type !== 'multi' && w.id !== warehouse?.id
      );

      setAvailableWarehouses(warehouses);

      const transferData = warehouses.map(w => ({
        key: w.id,
        title: w.name,
        description: `${w.type === 'physical' ? 'Физический' : 'Виртуальный'} склад`,
        chosen: warehouse?.components?.some(c => c.id === w.id) || false
      }));

      setTransferData(transferData);
    } catch (error) {
      message.error('Ошибка загрузки складов');
    }
  };

  const handleTypeChange = (value) => {
    setWarehouseType(value);
    if (value === 'multi' && availableWarehouses.length === 0) {
      fetchAvailableWarehouses();
    }
  };

  const handleSubmit = async (values) => {
    try {
      const formData = {
        ...values,
        type: warehouseType,
        components: warehouseType === 'multi' ? selectedComponents : undefined
      };

      if (isEdit) {
        await dispatch(updateWarehouse({ id: warehouse.id, ...formData })).unwrap();
        message.success('Склад успешно обновлен');
      } else {
        await dispatch(createWarehouse(formData)).unwrap();
        message.success('Склад успешно создан');
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      message.error(isEdit ? 'Ошибка обновления склада' : 'Ошибка создания склада');
    }
  };

  const handleTransferChange = (targetKeys) => {
    setSelectedComponents(targetKeys);
  };

  const getWarehouseTypeIcon = (type) => {
    switch (type) {
      case 'physical': return <ShopOutlined />;
      case 'virtual': return <CloudOutlined />;
      case 'multi': return <ApartmentOutlined />;
      default: return <ShopOutlined />;
    }
  };

  const warehouseTypes = [
    {
      value: 'physical',
      label: 'Физический склад',
      description: 'Реальный склад с физическим адресом',
      icon: <ShopOutlined />
    },
    {
      value: 'virtual',
      label: 'Виртуальный склад',
      description: 'Склад для учета товаров без физического местоположения',
      icon: <CloudOutlined />
    },
    {
      value: 'multi',
      label: 'Мульти-склад',
      description: 'Объединение нескольких складов в один логический',
      icon: <ApartmentOutlined />
    }
  ];

  return (
    <Modal
      title={isEdit ? 'Редактировать склад' : 'Создать склад'}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          is_active: true,
          type: 'physical',
          auto_reserve: true,
          allow_negative: false
        }}
      >
        <Row gutter={24}>
          <Col span={16}>
            <Form.Item
              name="name"
              label="Название склада"
              rules={[{ required: true, message: 'Введите название склада' }]}
            >
              <Input placeholder="Введите название склада" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="code"
              label="Код склада"
              rules={[{ required: true, message: 'Введите код склада' }]}
            >
              <Input placeholder="WH001" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Тип склада">
          <Select
            value={warehouseType}
            onChange={handleTypeChange}
            size="large"
          >
            {warehouseTypes.map(type => (
              <Option key={type.value} value={type.value}>
                <Space>
                  {type.icon}
                  <div>
                    <div>{type.label}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {type.description}
                    </div>
                  </div>
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        {warehouseType === 'physical' && (
          <>
            <Form.Item
              name="address"
              label="Адрес склада"
            >
              <TextArea rows={2} placeholder="Введите адрес склада" />
            </Form.Item>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="contact_person"
                  label="Контактное лицо"
                >
                  <Input placeholder="ФИО ответственного" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="phone"
                  label="Телефон"
                >
                  <Input placeholder="+7 (999) 123-45-67" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={8}>
                <Form.Item
                  name="working_hours"
                  label="Часы работы"
                >
                  <Input placeholder="9:00 - 18:00" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="capacity"
                  label="Вместимость (м³)"
                >
                  <InputNumber
                    placeholder="1000"
                    style={{ width: '100%' }}
                    min={0}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="cost_per_unit"
                  label="Стоимость хранения"
                >
                  <InputNumber
                    placeholder="10.00"
                    style={{ width: '100%' }}
                    min={0}
                    step={0.01}
                    addonAfter="₽/м³"
                  />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        {warehouseType === 'multi' && (
          <Card title="Компоненты мульти-склада" style={{ marginBottom: 16 }}>
            <Alert
              message="Мульти-склад объединяет несколько складов в один логический блок"
              description="Выберите склады, которые будут входить в состав мульти-склада. Остатки будут суммироваться автоматически."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {transferData.length > 0 ? (
              <Transfer
                dataSource={transferData}
                titles={['Доступные склады', 'Выбранные склады']}
                targetKeys={selectedComponents}
                onChange={handleTransferChange}
                render={item => (
                  <div>
                    <div>{item.title}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {item.description}
                    </div>
                  </div>
                )}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <Alert
                message="Нет доступных складов"
                description="Создайте сначала физические или виртуальные склады"
                type="warning"
                showIcon
              />
            )}
          </Card>
        )}

        <Form.Item
          name="description"
          label="Описание"
        >
          <TextArea rows={3} placeholder="Дополнительная информация о складе" />
        </Form.Item>

        <Card title="Настройки склада" size="small">
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                name="is_active"
                label="Активен"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="auto_reserve"
                label={
                  <Space>
                    Автобронирование
                    <Tooltip title="Автоматически резервировать товары при создании заказа">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="allow_negative"
                label={
                  <Space>
                    Отрицательные остатки
                    <Tooltip title="Разрешить отрицательные остатки на складе">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

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
              {isEdit ? 'Сохранить изменения' : 'Создать склад'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WarehouseForm;