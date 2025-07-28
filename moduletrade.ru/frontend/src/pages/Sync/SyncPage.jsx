// frontend/src/pages/Sync/SyncPage.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Tag,
  Progress,
  Space,
  Typography,
  Tabs,
  Timeline,
  Alert,
  Statistic,
  Badge,
  Divider,
  Switch,
  Tooltip,
} from 'antd';
import {
  SyncOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ShopOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  syncStock,
  syncOrders,
  fetchSyncLogs,
  fetchSyncStatus,
  fetchMarketplaces,
  fetchSuppliers,
} from 'store/syncSlice';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const SyncPage = () => {
  const dispatch = useDispatch();
  const {
    loading,
    syncing,
    logs,
    status,
    marketplaces,
    suppliers,
  } = useSelector((state) => state.sync);

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    dispatch(fetchSyncStatus());
    dispatch(fetchMarketplaces());
    dispatch(fetchSuppliers());
    dispatch(fetchSyncLogs({ limit: 50 }));
  }, [dispatch]);

  const handleSync = async (type, id) => {
    try {
      if (type === 'stock') {
        await dispatch(syncStock({ marketplace_id: id })).unwrap();
      } else if (type === 'orders') {
        await dispatch(syncOrders({ marketplace_id: id })).unwrap();
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  const handleSyncAll = async () => {
    try {
      // Синхронизируем все активные маркетплейсы
      const activeMarketplaces = marketplaces.filter(m => m.is_active);
      
      for (const marketplace of activeMarketplaces) {
        await dispatch(syncStock({ marketplace_id: marketplace.id })).unwrap();
        await dispatch(syncOrders({ marketplace_id: marketplace.id })).unwrap();
      }
    } catch (error) {
      console.error('Sync all error:', error);
    }
  };

  const marketplaceColumns = [
    {
      title: 'Маркетплейс',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <ShopOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'status',
      render: (value) => (
        <Badge
          status={value ? 'success' : 'default'}
          text={value ? 'Активен' : 'Неактивен'}
        />
      ),
    },
    {
      title: 'Последняя синхронизация',
      dataIndex: 'last_sync',
      key: 'last_sync',
      render: (value) => value ? dayjs(value).fromNow() : 'Никогда',
    },
    {
      title: 'Товары',
      dataIndex: 'products_count',
      key: 'products_count',
      render: (value) => value || 0,
    },
    {
      title: 'Заказы (сегодня)',
      dataIndex: 'orders_today',
      key: 'orders_today',
      render: (value) => value || 0,
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Синхронизировать остатки">
            <Button
              type="text"
              icon={<InboxOutlined />}
              size="small"
              loading={syncing}
              onClick={() => handleSync('stock', record.id)}
              disabled={!record.is_active}
            />
          </Tooltip>
          <Tooltip title="Синхронизировать заказы">
            <Button
              type="text"
              icon={<SyncOutlined />}
              size="small"
              loading={syncing}
              onClick={() => handleSync('orders', record.id)}
              disabled={!record.is_active}
            />
          </Tooltip>
          <Tooltip title="Настройки">
            <Button
              type="text"
              icon={<SettingOutlined />}
              size="small"
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const supplierColumns = [
    {
      title: 'Поставщик',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <InboxOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeConfig = {
          etm: { color: 'purple', text: 'ETM' },
          rs24: { color: 'cyan', text: 'RS24' },
          custom: { color: 'orange', text: 'Custom API' },
        };
        const config = typeConfig[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'status',
      render: (value) => (
        <Badge
          status={value ? 'success' : 'default'}
          text={value ? 'Активен' : 'Неактивен'}
        />
      ),
    },
    {
      title: 'Последний импорт',
      dataIndex: 'last_import',
      key: 'last_import',
      render: (value) => value ? dayjs(value).fromNow() : 'Никогда',
    },
    {
      title: 'Товары',
      dataIndex: 'products_count',
      key: 'products_count',
      render: (value) => value || 0,
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Импортировать товары">
            <Button
              type="text"
              icon={<SyncOutlined />}
              size="small"
              loading={syncing}
              disabled={!record.is_active}
            />
          </Tooltip>
          <Tooltip title="Настройки">
            <Button
              type="text"
              icon={<SettingOutlined />}
              size="small"
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const logColumns = [
    {
      title: 'Время',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (value) => dayjs(value).format('DD.MM.YY HH:mm'),
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => {
        const typeConfig = {
          stock_sync: { color: 'blue', text: 'Остатки' },
          orders_sync: { color: 'green', text: 'Заказы' },
          products_import: { color: 'purple', text: 'Импорт' },
        };
        const config = typeConfig[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Источник',
      dataIndex: 'source',
      key: 'source',
      width: 150,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusConfig = {
          success: { icon: <CheckCircleOutlined />, color: 'success', text: 'Успех' },
          error: { icon: <CloseCircleOutlined />, color: 'error', text: 'Ошибка' },
          running: { icon: <SyncOutlined spin />, color: 'processing', text: 'Выполняется' },
          warning: { icon: <WarningOutlined />, color: 'warning', text: 'Предупреждение' },
        };
        const config = statusConfig[status] || { icon: null, color: 'default', text: status };
        return (
          <Space>
            {config.icon}
            <Text type={config.color}>{config.text}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Сообщение',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            Синхронизация данных
          </Title>
        </Col>
        <Col>
          <Space>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              loading={syncing}
              onClick={handleSyncAll}
            >
              Синхронизировать все
            </Button>
          </Space>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Обзор" key="overview">
          {/* Общая статистика */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Активные маркетплейсы"
                  value={marketplaces.filter(m => m.is_active).length}
                  suffix={`/ ${marketplaces.length}`}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Активные поставщики"
                  value={suppliers.filter(s => s.is_active).length}
                  suffix={`/ ${suppliers.length}`}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Синхронизаций сегодня"
                  value={logs.filter(log => 
                    dayjs(log.created_at).isSame(dayjs(), 'day')
                  ).length}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Успешных"
                  value={logs.filter(log => 
                    log.status === 'success' &&
                    dayjs(log.created_at).isSame(dayjs(), 'day')
                  ).length}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Последние синхронизации */}
          <Card title="Последние синхронизации" size="small">
            <Timeline>
              {logs.slice(0, 10).map((log, index) => (
                <Timeline.Item
                  key={index}
                  dot={
                    log.status === 'success' ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : log.status === 'error' ? (
                      <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                    ) : (
                      <ClockCircleOutlined style={{ color: '#1890ff' }} />
                    )
                  }
                >
                  <div>
                    <Space>
                      <Tag color="blue">{log.type}</Tag>
                      <Text strong>{log.source}</Text>
                      <Text type="secondary">
                        {dayjs(log.created_at).fromNow()}
                      </Text>
                    </Space>
                    <div>
                      <Text type="secondary">{log.message}</Text>
                    </div>
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </TabPane>

        <TabPane tab="Маркетплейсы" key="marketplaces">
          <Card>
            <Table
              columns={marketplaceColumns}
              dataSource={marketplaces}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </TabPane>

        <TabPane tab="Поставщики" key="suppliers">
          <Card>
            <Table
              columns={supplierColumns}
              dataSource={suppliers}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </TabPane>

        <TabPane tab="Логи" key="logs">
          <Card>
            <Table
              columns={logColumns}
              dataSource={logs}
              rowKey="id"
              loading={loading}
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} из ${total} записей`,
              }}
              size="small"
              scroll={{ x: 1000 }}
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default SyncPage;