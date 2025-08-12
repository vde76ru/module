import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  Input,
  Tag,
  message,
  Row,
  Col,
  Typography,
  Modal,
  Form,
  InputNumber,
  Switch,
  Progress,
  Tooltip,
  Badge,
  Alert,
  Tabs,
  Statistic,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  SettingOutlined,
  HomeOutlined,
  TruckOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { api } from 'services';

const { Option } = Select;
const { Search } = Input;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

const WarehouseManager = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadWarehouses();
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (selectedWarehouse) {
      loadWarehouseProducts(selectedWarehouse);
    }
  }, [selectedWarehouse]);

  const loadWarehouses = async () => {
    try {
      const response = await api.warehouses.getWarehouses();
      setWarehouses(response || []);
    } catch (error) {
      message.error('Ошибка загрузки складов');
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await api.suppliers.getSuppliers();
      setSuppliers(response || []);
    } catch (error) {
      message.error('Ошибка загрузки поставщиков');
    }
  };

  const loadWarehouseProducts = async (warehouseId) => {
    setLoading(true);
    try {
      const response = await api.warehouses.getWarehouseStock(warehouseId);
      setProducts(response || []);
    } catch (error) {
      message.error('Ошибка загрузки товаров склада');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedWarehouse) {
      message.warning('Выберите склад для синхронизации');
      return;
    }

    setSyncing(true);
    try {
      await api.sync.syncStock({
        warehouse_id: selectedWarehouse,
        sync_type: 'full'
      });
      message.success('Синхронизация завершена');
      loadWarehouseProducts(selectedWarehouse);
    } catch (error) {
      message.error('Ошибка синхронизации');
    } finally {
      setSyncing(false);
    }
  };

  const handleEditStock = (product) => {
    setEditingProduct(product);
    form.setFieldsValue({
      current_stock: product.current_stock,
      min_stock_level: product.min_stock_level,
      max_stock_level: product.max_stock_level,
      reorder_point: product.reorder_point,
      is_active: product.is_active
    });
    setModalVisible(true);
  };

  const handleSubmitStock = async (values) => {
    try {
      await api.warehouses.updateStock({
        warehouse_id: selectedWarehouse,
        product_id: editingProduct.id,
        ...values
      });
      message.success('Остатки обновлены');
      setModalVisible(false);
      loadWarehouseProducts(selectedWarehouse);
    } catch (error) {
      message.error('Ошибка обновления остатков');
    }
  };

  const columns = [
    {
      title: 'Товар',
      dataIndex: 'product_name',
      key: 'product_name',
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.sku} • {record.barcode}
          </div>
        </div>
      )
    },
    {
      title: 'Поставщик',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      render: (name, record) => (
        <Tag color={record.is_main_supplier ? 'blue' : 'default'}>
          {name}
          {record.is_main_supplier && ' (основной)'}
        </Tag>
      )
    },
    {
      title: 'Текущий остаток',
      dataIndex: 'current_stock',
      key: 'current_stock',
      render: (stock, record) => {
        const percentage = record.max_stock_level
          ? Math.round((stock / record.max_stock_level) * 100)
          : 0;

        let color = 'green';
        if (stock <= record.min_stock_level) color = 'red';
        else if (stock <= record.reorder_point) color = 'orange';

        return (
          <div>
            <div style={{ fontWeight: 'bold', color }}>
              {stock} {record.unit || 'шт'}
            </div>
            {record.max_stock_level && (
              <Progress
                percent={percentage}
                size="small"
                showInfo={false}
                strokeColor={color}
              />
            )}
          </div>
        );
      }
    },
    {
      title: 'Лимиты',
      key: 'limits',
      render: (_, record) => (
        <div style={{ fontSize: '12px' }}>
          <div>Мин: {record.min_stock_level || 0}</div>
          <div>Макс: {record.max_stock_level || '∞'}</div>
          <div>Заказ: {record.reorder_point || 0}</div>
        </div>
      )
    },
    {
      title: 'Статус',
      key: 'status',
      render: (_, record) => {
        if (record.current_stock <= record.min_stock_level) {
          return <Badge status="error" text="Критично" />;
        }
        if (record.current_stock <= record.reorder_point) {
          return <Badge status="warning" text="Требует заказа" />;
        }
        return <Badge status="success" text="Норма" />;
      }
    },
    {
      title: 'Последнее обновление',
      dataIndex: 'last_updated',
      key: 'last_updated',
      render: (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-'
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditStock(record)}
          >
            Изменить
          </Button>
          <Button
            size="small"
            icon={<SyncOutlined />}
            onClick={() => handleSyncProduct(record.id)}
          >
            Синхронизировать
          </Button>
        </Space>
      )
    }
  ];

  const handleSyncProduct = async (productId) => {
    try {
      await api.sync.syncStock({
        warehouse_id: selectedWarehouse,
        product_id: productId,
        sync_type: 'single'
      });
      message.success('Товар синхронизирован');
      loadWarehouseProducts(selectedWarehouse);
    } catch (error) {
      message.error('Ошибка синхронизации товара');
    }
  };

  const getWarehouseStats = () => {
    if (!products.length) return { total: 0, critical: 0, low: 0, normal: 0 };

    const total = products.length;
    const critical = products.filter(p => p.current_stock <= p.min_stock_level).length;
    const low = products.filter(p =>
      p.current_stock > p.min_stock_level && p.current_stock <= p.reorder_point
    ).length;
    const normal = total - critical - low;

    return { total, critical, low, normal };
  };

  const stats = getWarehouseStats();

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Управление складами</Title>

      {/* Выбор склада */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Select
              placeholder="Выберите склад"
              value={selectedWarehouse}
              onChange={setSelectedWarehouse}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="children"
            >
              {warehouses.map(warehouse => (
                <Option key={warehouse.id} value={warehouse.id}>
                  <HomeOutlined /> {warehouse.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={handleSync}
              loading={syncing}
              disabled={!selectedWarehouse}
            >
              Синхронизировать склад
            </Button>
          </Col>
          <Col span={8}>
            <Text type="secondary">
              {selectedWarehouse ? 'Выбран склад для управления' : 'Выберите склад для начала работы'}
            </Text>
          </Col>
        </Row>
      </Card>

      {selectedWarehouse && (
        <>
          {/* Статистика склада */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Всего товаров"
                  value={stats.total}
                  prefix={<HomeOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Критический уровень"
                  value={stats.critical}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Требует заказа"
                  value={stats.low}
                  valueStyle={{ color: '#fa8c16' }}
                  prefix={<TruckOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Нормальный уровень"
                  value={stats.normal}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* Товары склада */}
          <Card
            title="Товары на складе"
            extra={
              <Space>
                <Search
                  placeholder="Поиск товаров"
                  style={{ width: 300 }}
                  onSearch={(value) => {
                    // Фильтрация товаров по поиску
                    console.log('Search:', value);
                  }}
                />
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => loadWarehouseProducts(selectedWarehouse)}
                >
                  Обновить
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={products}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Всего: ${total}`,
              }}
            />
          </Card>
        </>
      )}

      {/* Модальное окно редактирования остатков */}
      <Modal
        title="Редактирование остатков товара"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitStock}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="current_stock"
                label="Текущий остаток"
                rules={[{ required: true, message: 'Введите текущий остаток' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="min_stock_level"
                label="Минимальный уровень"
                rules={[{ required: true, message: 'Введите минимальный уровень' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="max_stock_level"
                label="Максимальный уровень"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="∞"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reorder_point"
                label="Точка заказа"
                rules={[{ required: true, message: 'Введите точку заказа' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="is_active"
            label="Активен"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                Отмена
              </Button>
              <Button type="primary" htmlType="submit">
                Сохранить
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WarehouseManager;
