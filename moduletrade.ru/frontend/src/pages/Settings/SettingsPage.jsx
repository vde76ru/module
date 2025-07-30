// ===================================================
// ФАЙЛ: frontend/src/pages/Settings/SettingsPage.jsx
// ===================================================
import React from 'react';
import { Card, Form, Input, Button, Switch, Typography, Divider } from 'antd';

const { Title } = Typography;

const SettingsPage = () => {
  const [form] = Form.useForm();

  const onFinish = (values) => {
    console.log('Settings saved:', values);
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
    </div>
  );
};

export default SettingsPage;