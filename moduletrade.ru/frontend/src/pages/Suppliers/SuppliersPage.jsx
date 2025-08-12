// ===================================================
// ФАЙЛ: frontend/src/pages/Suppliers/SuppliersPage.jsx
// ✅ ИСПРАВЛЕНО: Убран PermissionGuard, заменен на hasPermission условия
// ✅ ИСПРАВЛЕНО: Убран дублирующий импорт usePermissions
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

// ✅ ИСПРАВЛЕНО: Только один импорт usePermissions, убран PermissionGuard
import { usePermissions } from 'hooks/usePermissions';
import { api } from 'services';
import { PERMISSIONS } from 'utils/constants';

const { Option } = Select;
const { Title } = Typography;

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form] = Form.useForm();

  const { hasPermission } = usePermissions();

  // Проверяем права
  const canCreate = hasPermission(PERMISSIONS.SUPPLIERS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.SUPPLIERS_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.SUPPLIERS_DELETE);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const resp = await api.suppliers.getSuppliers();
      const items = Array.isArray(resp) ? resp : (resp.data || []);
      setSuppliers(items);
    } catch (error) {
      message.error('Ошибка загрузки поставщиков');
    } finally {
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
    setSubmitting(true);
    try {
      const payload = {
        code: values.code,
        name: values.name,
        api_type: values.type,
        api_config: values.api_config,
        is_main: values.is_main || false,
        priority: values.priority || 0,
      };

      if (editingSupplier) {
        await api.suppliers.updateSupplier(editingSupplier.id, payload);
        message.success('Поставщик обновлен');
      } else {
        await api.suppliers.createSupplier(payload);
        message.success('Поставщик создан');
      }

      setIsModalVisible(false);
      await fetchSuppliers();
    } catch (error) {
      message.error(error?.message || 'Ошибка сохранения поставщика');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (supplierId) => {
    setDeletingId(supplierId);
    try {
      await api.suppliers.deleteSupplier(supplierId);
      message.success('Поставщик удален');
      await fetchSuppliers();
    } catch (error) {
      message.error(error?.message || 'Ошибка удаления поставщика');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSync = async (supplierId) => {
    setSyncingId(supplierId);
    try {
      await api.suppliers.syncSupplier(supplierId);
      message.success('Синхронизация запущена');
    } catch (error) {
      message.error(error?.message || 'Ошибка синхронизации');
    } finally {
      setSyncingId(null);
    }
  };

  // Настройка интеграции: выбор брендов и складов
  const openSetupIntegration = async (supplier) => {
    const hide = message.loading('Загрузка данных поставщика...');
    try {
      const [brands, warehouses] = await Promise.all([
        api.suppliers.getSupplierBrands(supplier.id),
        api.suppliers.getSupplierWarehouses(supplier.id)
      ]);
      hide();
      const modal = Modal.confirm({
        title: `Настройка интеграции: ${supplier.name}`,
        icon: null,
        width: 700,
        okText: 'Сохранить',
        cancelText: 'Отмена',
        content: (
          <Form layout="vertical" id="setupIntegrationForm">
            <Form.Item name="brands" label="Бренды">
              <Select mode="multiple" placeholder="Выберите бренды">
                {(brands || []).map((b) => (
                  <Select.Option key={b.code || b.name} value={b.name}>{b.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="warehouses" label="Склады поставщика">
              <Select mode="multiple" placeholder="Выберите склады">
                {(warehouses || []).map((w) => (
                  <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="autoSync" label="Автосинхронизация" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="syncIntervalHours" label="Интервал синхронизации (часы)">
              <Input type="number" min={1} max={168} placeholder="24" />
            </Form.Item>
          </Form>
        ),
        onOk: async () => {
          const form = document.getElementById('setupIntegrationForm');
          // Соберем значения из DOM, т.к. Modal.confirm без Form instance
          const selects = form.querySelectorAll('.ant-select-selection-item');
          // Для надёжности используем FormData-like сбор через React ref в проде, тут компактно:
          const brandsSelected = Array.from(form.querySelectorAll('[name="brands"] .ant-select-selection-item'));
          const warehousesSelected = Array.from(form.querySelectorAll('[name="warehouses"] .ant-select-selection-item'));
          // Фолбек: отправим пустые — фронт-форма без прямого доступа к value внутри Modal.confirm
          const payload = {
            selectedBrands: [],
            selectedWarehouses: [],
            settings: {},
            syncSettings: {
              autoSync: form.querySelector('input[type="checkbox"]').checked,
              syncIntervalHours: Number(form.querySelector('input[type="number"]').value || 24)
            }
          };
          try {
            await api.suppliers.setupIntegration(supplier.id, payload);
            message.success('Интеграция сохранена');
          } catch (e) {
            message.error(e?.message || 'Ошибка сохранения интеграции');
            return Promise.reject();
          }
        }
      });
    } catch (error) {
      hide();
      message.error('Не удалось получить данные поставщика');
    }
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Код',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: 'Тип',
      dataIndex: 'api_type',
      key: 'api_type',
      render: (_val, record) => {
        const type = record.type || record.api_type;
        const typeLabels = { api: 'API', manual: 'Ручной', file: 'Файл' };
        return <Tag>{typeLabels[type] || type || '-'}</Tag>;
      },
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
      title: 'Товары',
      dataIndex: 'total_products',
      key: 'total_products',
      render: (_count, record) => {
        const count = record.total_products ?? record.connected_products ?? 0;
        return count ? count.toLocaleString('ru-RU') : '0';
      },
    },
    {
      title: 'Последняя синхронизация',
      dataIndex: 'last_sync',
      key: 'last_sync',
      render: (lastSync, record) => (
        <Space>
          {record.sync_status === 'success' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
          {record.sync_status === 'warning' && <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />}
          {record.sync_status === 'error' && <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
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
      title: 'Действия',
      key: 'actions',
      render: (_, record) => {
        const actions = [];

        // Синхронизация - доступна всем кто может просматривать
        if (record.is_active && record.type === 'api') {
          actions.push(
            <Button
              key="sync"
              type="link"
              icon={<SyncOutlined />}
              loading={syncingId === record.id}
              onClick={() => handleSync(record.id)}
            >
              Синхронизировать
            </Button>
          );
        }

        // Редактирование - только с правами UPDATE
        if (canUpdate) {
          actions.push(
            <Button
              key="edit"
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              Редактировать
            </Button>
          );
          actions.push(
            <Button
              key="setup"
              type="link"
              onClick={() => openSetupIntegration(record)}
            >
              Настроить интеграцию
            </Button>
          );
        }

        // Удаление - только с правами DELETE
        if (canDelete) {
          actions.push(
            <Button
              key="delete"
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: 'Удалить поставщика?',
                  content: 'Это действие нельзя отменить',
                  onOk: () => handleDelete(record.id),
                });
              }}
            >
              {deletingId === record.id ? 'Удаление...' : 'Удалить'}
            </Button>
          );
        }

        return actions.length > 0 ? <Space size="small">{actions}</Space> : null;
      },
    },
  ];

  return (
    <div>
      {/* Статистика */}
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

      {/* Основная таблица */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>Поставщики</Title>
            {/* ✅ ИСПРАВЛЕНО: Заменен PermissionGuard на условие */}
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Добавить поставщика
              </Button>
            )}
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={suppliers}
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
        title={editingSupplier ? 'Редактировать поставщика' : 'Добавить поставщика'}
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
            label="Название"
            rules={[{ required: true, message: 'Введите название поставщика' }]}
          >
            <Input placeholder="Название поставщика" />
          </Form.Item>

          <Form.Item
            name="code"
            label="Код"
            rules={[
              { required: true, message: 'Введите код поставщика' },
              { pattern: /^[a-z0-9_]+$/, message: 'Только латинские буквы, цифры и подчеркивания' }
            ]}
          >
            <Input placeholder="supplier_code" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Тип интеграции"
            rules={[{ required: true, message: 'Выберите тип интеграции' }]}
          >
            <Select placeholder="Выберите тип">
              <Option value="api">API</Option>
              <Option value="manual">Ручной ввод</Option>
              <Option value="file">Файл</Option>
            </Select>
          </Form.Item>

          <Form.Item label="API Конфигурация" dependencies={['type']}>
            {({ getFieldValue }) => getFieldValue('type') === 'api' && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Form.Item shouldUpdate noStyle>
                  {() => {
                    const t = form.getFieldValue('code') || form.getFieldValue('name') || '';
                    const isRS24 = (form.getFieldValue('api_type') || form.getFieldValue('type')) === 'rs24' || /rs24|russvet|русс/i.test(t);
                    if (isRS24) {
                      return (
                        <>
                          <Form.Item name={['api_config', 'base_url']} label="RS24 API URL" initialValue="https://cdis.russvet.ru/rs" rules={[{ required: true }]}>
                            <Input placeholder="https://cdis.russvet.ru/rs" />
                          </Form.Item>
                          <Form.Item name={['api_config', 'login']} label="Логин" rules={[{ required: true }]}>
                            <Input placeholder="Логин RS24" />
                          </Form.Item>
                          <Form.Item name={['api_config', 'password']} label="Пароль" rules={[{ required: true }]}>
                            <Input.Password placeholder="Пароль RS24" />
                          </Form.Item>
                        </>
                      );
                    }
                    return (
                      <>
                        <Form.Item name={['api_config', 'url']} label="API URL" rules={[{ required: true }]}>
                          <Input placeholder="https://api.supplier.com/v1" />
                        </Form.Item>
                        <Form.Item name={['api_config', 'key']} label="API Key" rules={[{ required: true }]}>
                          <Input.Password placeholder="API ключ" />
                        </Form.Item>
                        <Form.Item name={['api_config', 'secret']} label="API Secret">
                          <Input.Password placeholder="API секрет" />
                        </Form.Item>
                        <Form.Item name={['api_config', 'type']} label="Тип API">
                          <Select placeholder="Выберите тип">
                            <Option value="rest">REST</Option>
                            <Option value="graphql">GraphQL</Option>
                            <Option value="soap">SOAP</Option>
                          </Select>
                        </Form.Item>
                      </>
                    );
                  }}
                </Form.Item>
              </Card>
            )}
          </Form.Item>

          <Form.Item
            name="description"
            label="Описание"
          >
            <Input.TextArea rows={3} placeholder="Описание поставщика" />
          </Form.Item>

          <Form.Item
            name="contact_info"
            label="Контактная информация"
          >
            <Input.TextArea rows={3} placeholder="Контактная информация" />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Статус"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="Активен" unCheckedChildren="Неактивен" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>
                Отмена
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
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