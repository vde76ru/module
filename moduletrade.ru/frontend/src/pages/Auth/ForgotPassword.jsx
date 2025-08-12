// ===================================================
// ФАЙЛ: frontend/src/pages/Auth/ForgotPassword.jsx
// Страница запроса на сброс пароля
// ===================================================
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { forgotPassword, clearError } from '../../store/authSlice';

const { Title, Text } = Typography;

const ForgotPassword = () => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const onFinish = async (values) => {
    try {
      await dispatch(forgotPassword({ email: values.email })).unwrap();
      navigate('/login', { replace: true });
    } catch (e) {
      // Ошибка уже показана уведомлением
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <Card style={{ width: 420 }}>
        <Title level={3} style={{ marginBottom: 8 }}>Восстановление доступа</Title>
        <Text type="secondary">Укажите email — мы отправим ссылку для сброса пароля</Text>

        {error && (
          <Alert
            style={{ marginTop: 16 }}
            type="error"
            message="Ошибка"
            description={error}
            showIcon
            closable
            onClose={() => dispatch(clearError())}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          size="large"
          style={{ marginTop: 16 }}
          onFinish={onFinish}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Введите email' }, { type: 'email', message: 'Некорректный email' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="you@example.com" disabled={loading} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} disabled={loading}>
              Отправить ссылку
            </Button>
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Link to="/login">Вернуться ко входу</Link>
            <Link to="/register">Зарегистрироваться</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default ForgotPassword;

