// ===================================================
// ФАЙЛ: frontend/src/pages/Marketplaces/MarketplacesPage.jsx
// ✅ ИСПРАВЛЕНО: Убран PermissionGuard, заменен на hasPermission условия
// ===================================================
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  message,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Row,
  Col,
  Statistic,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';

// ✅ ИСПРАВЛЕНО: Убран PermissionGuard, оставлен только usePermissions
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../utils/constants';

const { Option } = Select;
const { Title } = Typography;

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

  // Проверяем права
  const canCreate = hasPermission(PERMISSIONS.MARKETPLACES_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.MARKETPLACES_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.MARKETPLACES_DELETE);

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
            name: 'Wildberries',
            code: 'wb',
            status: 'connected',
            is_active: true,
            last_sync: new Date().toISOString(),
            total_products: 1500,
            total_orders: 345,
            sync_status: 'success',
          },
          {
            id: '2',
            name: 'Ozon',
            code: 'ozon',
            status: 'connected',
            is_active: true,
            last_sync: new Date(Date.now() - 3600000).toISOString(),
            total_products: 890,
            total_orders: 156,
            sync_status: 'syncing',
          },
          {
            id: '3',
            name: 'Яндекс.Маркет',
            code: 'yandex',
            status: 'error',
            is_active: false,
            last_sync: new Date(Date.now() - 86400000).toISOString(),
            total_products: 0,
            total_orders: 0,
            sync_status: 'error',
          },
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      message.error('Ошибка загрузки маркетплейсов');
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Демо статистика
      setStats({
        total: 3,
        connected: 2,
        syncing: 1,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
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

  const handleSubmit = async (values) => {
    try {
      message.success(editingMarketplace ? 'Маркетплейс обновлен' : 'Маркетплейс подключен');
      setIsModalVisible(false);
      fetchMarketplaces();
      fetchStats();
    } catch (error) {
      message.error('Ошибка сохранения маркетплейса');
    }
  };

  const handleDelete = async (marketplaceId) => {
    try {
      message.success('Маркетплейс удален');
      fetchMarketplaces();
      fetchStats();
    } catch (error) {
      message.error('Ошибка удаления маркетплейса');
    }
  };

  const handleSync = async (marketplaceId) => {
    try {
      message.success('Синхронизация запущена');
      // Обновляем статус синхронизации
      setMarketplaces(prev => prev.map(mp => 
        mp.id === marketplaceId 
          ? { ...mp, sync_status: 'syncing' }
          : mp
      ));
    } catch (error) {
      message.error('Ошибка синхронизации');
    }
  };

  const getSyncStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'syncing':
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return null;
    }
  };

  const columns = [
    {
      title: 'Маркетплейс',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{name}</span>
          <Tag>{record.code}</Tag>
        </Space>
      ),
    },
    {
      title: 'Статус подключения',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          connected: { label: 'Подключен', color: 'green' },
          connecting: { label: 'Подключается', color: 'blue' },
          error: { label: 'Ошибка', color: 'red' },
          disconnected: { label: 'Отключен', color: 'default' },
        };
        const config = statusConfig[status] || statusConfig.disconnected;
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Активность',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Активен' : 'Неактивен'}
        </Tag>
      ),
    },
    {
      title: 'Последняя синхронизация',
      dataIndex: 'last_sync',
      key: 'last_sync',
      render: (lastSync, record) => (
        <Space>
          {getSyncStatusIcon(record.sync_status)}
          <span>
            {lastSync 
              ? new Date(lastSync).toLocaleDateString('ru-RU')
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
      render: (_, record) => {
        const actions = [];

        // Синхронизация - доступна всем кто может просматривать
        if (record.is_active) {
          actions.push(
            <Tooltip key="sync" title="Синхронизировать">
              <Button
                type="text"
                icon={<SyncOutlined />}
                onClick={() => handleSync(record.id)}
                disabled={record.sync_status === 'syncing'}
              />
            </Tooltip>
          );
        }

        // Настройки - всегда доступны
        actions.push(
          <Tooltip key="settings" title="Настройки">
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
        );

        // Редактирование - только с правами UPDATE
        if (canUpdate) {
          actions.push(
            <Tooltip key="edit" title="Редактировать">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          );
        }

        // Удаление - только с правами DELETE
        if (canDelete) {
          actions.push(
            <Tooltip key="delete" title="Удалить">
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
          );
        }

        return actions.length > 0 ? <Space>{actions}</Space> : null;
      },
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
            {/* ✅ ИСПРАВЛЕНО: Заменен PermissionGuard на условие */}
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Подключить маркетплейс
              </Button>
            )}
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={marketplaces}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total}`,
          }}
        />
      </Card>

      {/* Модальное окно создания/редактирования */}
      <Modal
        title={editingMarketplace ? 'Настройки маркетплейса' : 'Подключить маркетплейс'}
        open={isModalVisible}
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
            name="name"
            label="Название маркетплейса"
            rules={[{ required: true, message: 'Введите название маркетплейса' }]}
          >
            <Select placeholder="Выберите маркетплейс">
              <Option value="wildberries">Wildberries</Option>
              <Option value="ozon">Ozon</Option>
              <Option value="yandex">Яндекс.Маркет</Option>
              <Option value="avito">Авито</Option>
              <Option value="lamoda">Lamoda</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="api_key"
            label="API ключ"
            rules={[{ required: true, message: 'Введите API ключ' }]}
          >
            <Input.Password placeholder="Введите API ключ маркетплейса" />
          </Form.Item>

          <Form.Item
            name="client_id"
            label="Client ID"
          >
            <Input placeholder="Введите Client ID (если требуется)" />
          </Form.Item>

          <Form.Item
            name="warehouse_id"
            label="ID склада"
          >
            <Input placeholder="ID склада на маркетплейсе" />
          </Form.Item>

          <Form.Item
            name="sync_frequency"
            label="Частота синхронизации"
            initialValue="hourly"
          >
            <Select>
              <Option value="manual">Вручную</Option>
              <Option value="hourly">Каждый час</Option>
              <Option value="daily">Ежедневно</Option>
              <Option value="weekly">Еженедельно</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="auto_accept_orders"
            label="Автоматически принимать заказы"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="auto_update_stock"
            label="Автоматически обновлять остатки"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Активен"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
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