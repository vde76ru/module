// ===================================================
// ФАЙЛ: frontend/src/pages/Settings/SettingsPage.jsx
// ===================================================
import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Switch, Typography, Divider, Table, Modal, Select } from 'antd';
import api from 'utils/axios';

const { Title } = Typography;

const SettingsPage = () => {
  const [form] = Form.useForm();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);

  const onFinish = (values) => {
    console.log('Settings saved:', values);
  };

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/jobs/schedules');
      setSchedules(res.data.data || []);
    } catch (e) {
      // noop
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSchedules(); }, []);

  const openCreate = () => { setEditing(null); setModalVisible(true); };
  const openEdit = (record) => { setEditing(record); setModalVisible(true); };
  const closeModal = () => { setModalVisible(false); setEditing(null); };

  const submitSchedule = async (values) => {
    try {
      if (editing) {
        await api.put(`/api/jobs/schedules/${editing.id}`, values);
      } else {
        await api.post('/api/jobs/schedules', values);
      }
      closeModal();
      await loadSchedules();
    } catch (e) {
      // noop
    }
  };

  const deleteSchedule = async (record) => {
    try {
      await api.delete(`/api/jobs/schedules/${record.id}`);
      await loadSchedules();
    } catch (e) {
      // noop
    }
  };

  return (
    <div>
      <Title level={2}>Настройки</Title>

      <Card title="Общие настройки">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="Название компании" name="company_name">
            <Input placeholder="ModuleTrade" />
          </Form.Item>

          <Form.Item label="Email для уведомлений" name="notification_email">
            <Input type="email" placeholder="admin@company.com" />
          </Form.Item>

          <Divider />

          <Form.Item label="Автоматическая синхронизация" name="auto_sync" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="Уведомления о заказах" name="order_notifications" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              Сохранить настройки
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Divider />

      <Card title="Расписания задач (Cron)">
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={openCreate}>Добавить расписание</Button>
          <Button onClick={loadSchedules} loading={loading}>Обновить</Button>
        </div>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={schedules}
          columns={[
            { title: 'Название', dataIndex: 'schedule_name' },
            { title: 'Тип', dataIndex: 'schedule_type' },
            { title: 'Cron', dataIndex: 'cron_expression' },
            { title: 'Активно', dataIndex: 'is_active', render: v => v ? 'Да' : 'Нет' },
            { title: 'Следующий запуск', dataIndex: 'next_run', render: v => v ? new Date(v).toLocaleString() : '-' },
            { title: 'Действия', render: (_, r) => (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" onClick={() => openEdit(r)}>Изменить</Button>
                <Button size="small" danger onClick={() => deleteSchedule(r)}>Удалить</Button>
              </div>
            ) },
          ]}
        />

        <Modal
          open={modalVisible}
          onCancel={closeModal}
          title={editing ? 'Изменить расписание' : 'Новое расписание'}
          footer={null}
          destroyOnClose
        >
          <Form layout="vertical" onFinish={submitSchedule} initialValues={editing || { is_active: true }}>
            <Form.Item label="Название" name="schedule_name" rules={[{ required: true, message: 'Укажите название' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Тип" name="schedule_type" rules={[{ required: true, message: 'Выберите тип' }]}>
              <Select
                options={[
                  { value: 'import', label: 'Импорт товаров (поставщик/бренды)' },
                  { value: 'supplier-prices', label: 'Обновление цен от поставщика' },
                  { value: 'supplier-stocks', label: 'Обновление остатков от поставщика' },
                  { value: 'prices', label: 'Обновление цен' },
                  { value: 'analytics', label: 'Аналитика' },
                  { value: 'subscriptions', label: 'Подписки' },
                  { value: 'marketplaces', label: 'Синхронизация МП' },
                  { value: 'popularity', label: 'Популярность товаров' },
                  { value: 'cache-cleanup', label: 'Очистка кэша' },
                  { value: 'log-cleanup', label: 'Очистка логов' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Cron выражение" name="cron_expression" rules={[{ required: true, message: 'Укажите cron' }]}>
              <Input placeholder="*/15 * * * *" />
            </Form.Item>
            {/* Дополнительные настройки для поставщиков/экспортов через JSON до выделения отдельных полей */}
            <Form.Item label="Доп. настройки (JSON)" name="settings">
              <Input.TextArea rows={4} placeholder='{"supplier_id":"...","brand_ids":["..."],"marketplace_id":"..."}' />
            </Form.Item>
            <Form.Item label="Активно" name="is_active" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button onClick={closeModal}>Отмена</Button>
                <Button type="primary" htmlType="submit">Сохранить</Button>
              </div>
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default SettingsPage;