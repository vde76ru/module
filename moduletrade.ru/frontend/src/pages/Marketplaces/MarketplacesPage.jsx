// ===================================================
// ФАЙЛ: frontend/src/pages/Marketplaces/MarketplacesPage.jsx
// ===================================================
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Tooltip,
  Progress,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  SettingOutlined,
} from '@ant-design/icons';

import PermissionGuard from '../../components/Auth/PermissionGuard';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../utils/constants';

const { Option } = Select;
const { Title } = Typography;
const { TextArea } = Input;

const MarketplacesPage = () => {
  const [marketplaces, setMarketplaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState(null);
  const [form] = Form.useForm();
  const [stats, setStats] = useState({
    total: 0,
    connected: 0,
    syncing: 0,
  });

  const { hasPermission } = usePermissions();

  useEffect(() => {
    fetchMarketplaces();
    fetchStats();
  }, []);

  const fetchMarketplaces = async () => {
    setLoading(true);
    try {
      // Демо данные
      setTimeout(() => {
        setMarketplaces([
          {
            id: '1',
            name: 'Ozon',
            type: 'ozon',
            is_active: true,
            last_sync: new Date().toISOString(),
            sync_status: 'success',
            total_products: 1250,
            total_orders: 89,
          },
          {
            id: '2',
            name: 'Wildberries',
            type: 'wildberries',
            is_active: true,
            last_sync: new Date(Date.now() - 3600000).toISOString(),
            sync_status: 'warning',
            total_products: 980,
            total_orders: 156,
          },
          {
            id: '3',
            name: 'Yandex Market',
            type: 'yandex_market',
            is_active: false,
            last_sync: null,
            sync_status: 'error',
            total_products: 0,
            total_orders: 0,
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      message.error('Ошибка загрузки маркетплейсов');
      setLoading(false);
    }
  };

  const fetchStats = () => {
    setStats({
      total: 3,
      connected: 2,
      syncing: 1,
    });
  };

  const handleCreate = () => {
    setEditingMarketplace(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (marketplace) => {
    setEditingMarketplace(marketplace);
    form.setFieldsValue(marketplace);
    setIsModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      message.success('Маркетплейс удален');
      fetchMarketplaces();
    } catch (error) {
      message.error('Ошибка удаления маркетплейса');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingMarketplace) {
        message.success('Маркетплейс обновлен');
      } else {
        message.success('Маркетплейс создан');
      }
      setIsModalVisible(false);
      fetchMarketplaces();
    } catch (error) {
      message.error('Ошибка сохранения маркетплейса');
    }
  };

  const handleSync = async (id) => {
    try {
      message.success('Синхронизация запущена');
    } catch (error) {
      message.error('Ошибка запуска синхронизации');
    }
  };

  const handleToggleStatus = async (id, checked) => {
    try {
      message.success(`Маркетплейс ${checked ? 'активирован' : 'деактивирован'}`);
      fetchMarketplaces();
    } catch (error) {
      message.error('Ошибка изменения статуса');
    }
  };

  const getSyncStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <SyncOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const columns = [
    {
      title: 'Маркетплейс',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <strong>{text}</strong>
          <Tag color="blue">{record.type}</Tag>
        </Space>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      render: (active, record) => (
        <PermissionGuard permission={PERMISSIONS.MARKETPLACES_UPDATE}>
          <Switch
            checked={active}
            onChange={(checked) => handleToggleStatus(record.id, checked)}
            checkedChildren="Активен"
            unCheckedChildren="Отключен"
          />
        </PermissionGuard>
      ),
    },
    {
      title: 'Синхронизация',
      dataIndex: 'sync_status',
      key: 'sync_status',
      width: 150,
      render: (status, record) => (
        <Space>
          {getSyncStatusIcon(status)}
          <span>
            {record.last_sync 
              ? new Date(record.last_sync).toLocaleDateString('ru-RU')
              : 'Никогда'
            }
          </span>
        </Space>
      ),
    },
    {
      title: 'Товары',
      dataIndex: 'total_products',
      key: 'total_products',
      width: 100,
      render: (count) => count.toLocaleString('ru-RU'),
    },
    {
      title: 'Заказы',
      dataIndex: 'total_orders',
      key: 'total_orders',
      width: 100,
      render: (count) => count.toLocaleString('ru-RU'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="Синхронизировать">
            <Button
              type="text"
              icon={<SyncOutlined />}
              onClick={() => handleSync(record.id)}
              disabled={!record.is_active}
            />
          </Tooltip>
          <Tooltip title="Настройки">
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <PermissionGuard permission={PERMISSIONS.MARKETPLACES_UPDATE}>
            <Tooltip title="Редактировать">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.MARKETPLACES_DELETE}>
            <Tooltip title="Удалить">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: 'Удалить маркетплейс?',
                    content: 'Это действие нельзя отменить',
                    onOk: () => handleDelete(record.id),
                  });
                }}
              />
            </Tooltip>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="Всего маркетплейсов" value={stats.total} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="Подключено" 
              value={stats.connected} 
              valueStyle={{ color: '#52c41a' }} 
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="Синхронизируется" 
              value={stats.syncing} 
              valueStyle={{ color: '#1890ff' }} 
            />
          </Card>
        </Col>
      </Row>

      {/* Основная таблица */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>Маркетплейсы</Title>
            <PermissionGuard permission={PERMISSIONS.MARKETPLACES_CREATE}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Подключить маркетплейс
              </Button>
            </PermissionGuard>
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={marketplaces}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* Модальное окно создания/редактирования */}
      <Modal
        title={editingMarketplace ? 'Редактировать маркетплейс' : 'Подключить маркетплейс'}
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="Тип маркетплейса"
            name="type"
            rules={[{ required: true, message: 'Выберите тип маркетплейса' }]}
          >
            <Select placeholder="Выберите маркетплейс">
              <Option value="ozon">Ozon</Option>
              <Option value="wildberries">Wildberries</Option>
              <Option value="yandex_market">Yandex Market</Option>
              <Option value="avito">Avito</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Название"
            name="name"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Название маркетплейса" />
          </Form.Item>

          <Form.Item
            label="API ключ"
            name="api_key"
            rules={[{ required: true, message: 'Введите API ключ' }]}
          >
            <Input.Password placeholder="API ключ" />
          </Form.Item>

          <Form.Item
            label="Client ID"
            name="client_id"
          >
            <Input placeholder="Client ID (если требуется)" />
          </Form.Item>

          <Form.Item
            label="Дополнительные настройки"
            name="settings"
          >
            <TextArea rows={3} placeholder="JSON конфигурация (опционально)" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsModalVisible(false)}>
                Отмена
              </Button>
              <Button type="primary" htmlType="submit">
                {editingMarketplace ? 'Сохранить' : 'Подключить'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MarketplacesPage;