// ===================================================
// ФАЙЛ: frontend/src/pages/Suppliers/SuppliersPage.jsx
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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

import PermissionGuard from '../../components/Auth/PermissionGuard';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../utils/constants';

const { Option } = Select;
const { Title } = Typography;

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form] = Form.useForm();

  const { hasPermission } = usePermissions();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      // Демо данные
      setTimeout(() => {
        setSuppliers([
          {
            id: '1',
            name: 'ETM Group',
            code: 'etm',
            type: 'api',
            is_active: true,
            last_sync: new Date().toISOString(),
            total_products: 15000,
            sync_status: 'success',
          },
          {
            id: '2',
            name: 'RS Components',
            code: 'rs24',
            type: 'api',
            is_active: true,
            last_sync: new Date(Date.now() - 7200000).toISOString(),
            total_products: 8500,
            sync_status: 'warning',
          },
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      message.error('Ошибка загрузки поставщиков');
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSupplier(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    form.setFieldsValue(supplier);
    setIsModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      message.success(editingSupplier ? 'Поставщик обновлен' : 'Поставщик создан');
      setIsModalVisible(false);
      fetchSuppliers();
    } catch (error) {
      message.error('Ошибка сохранения поставщика');
    }
  };

  const handleSync = async (id) => {
    try {
      message.success('Синхронизация запущена');
    } catch (error) {
      message.error('Ошибка запуска синхронизации');
    }
  };

  const columns = [
    {
      title: 'Поставщик',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space direction="vertical" size="small">
          <strong>{text}</strong>
          <Tag color="blue">{record.code}</Tag>
        </Space>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'api' ? 'green' : 'default'}>
          {type === 'api' ? 'API' : 'Ручной'}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? 'Активен' : 'Неактивен'}
        </Tag>
      ),
    },
    {
      title: 'Товары',
      dataIndex: 'total_products',
      key: 'total_products',
      render: (count) => count?.toLocaleString('ru-RU') || 0,
    },
    {
      title: 'Последняя синхронизация',
      dataIndex: 'last_sync',
      key: 'last_sync',
      render: (date, record) => (
        <Space>
          {record.sync_status === 'success' ? (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          ) : (
            <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
          )}
          {date ? new Date(date).toLocaleDateString('ru-RU') : 'Никогда'}
        </Space>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<SyncOutlined />}
            onClick={() => handleSync(record.id)}
            disabled={!record.is_active}
          />
          <PermissionGuard permission={PERMISSIONS.SUPPLIERS_UPDATE}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.SUPPLIERS_DELETE}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: 'Удалить поставщика?',
                  onOk: () => message.success('Поставщик удален'),
                });
              }}
            />
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="Всего поставщиков" value={suppliers.length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="Активных" 
              value={suppliers.filter(s => s.is_active).length} 
              valueStyle={{ color: '#52c41a' }} 
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="Общее количество товаров" 
              value={suppliers.reduce((sum, s) => sum + (s.total_products || 0), 0)} 
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>Поставщики</Title>
            <PermissionGuard permission={PERMISSIONS.SUPPLIERS_CREATE}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Добавить поставщика
              </Button>
            </PermissionGuard>
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={suppliers}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingSupplier ? 'Редактировать поставщика' : 'Добавить поставщика'}
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Название"
            name="name"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Название поставщика" />
          </Form.Item>

          <Form.Item
            label="Код"
            name="code"
            rules={[{ required: true, message: 'Введите код' }]}
          >
            <Input placeholder="Уникальный код поставщика" />
          </Form.Item>

          <Form.Item
            label="Тип"
            name="type"
            rules={[{ required: true, message: 'Выберите тип' }]}
          >
            <Select placeholder="Выберите тип">
              <Option value="api">API интеграция</Option>
              <Option value="manual">Ручной ввод</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Активен" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsModalVisible(false)}>Отмена</Button>
              <Button type="primary" htmlType="submit">
                {editingSupplier ? 'Сохранить' : 'Создать'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SuppliersPage;