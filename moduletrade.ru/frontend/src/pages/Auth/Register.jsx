import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, BankOutlined } from '@ant-design/icons';
import { registerUser } from 'store/authSlice';

const { Title, Text } = Typography;

const Register = () => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const handleSubmit = async (values) => {
    try {
      await dispatch(registerUser(values)).unwrap();
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card" style={{ maxWidth: 500 }}>
        <div className="login-header">
          <Title level={2}>Регистрация</Title>
          <Text type="secondary">Создайте новый аккаунт</Text>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon closable style={{ marginBottom: 24 }} />
        )}

        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="name"
            label="Полное имя"
            rules={[{ required: true, message: 'Введите ваше имя!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Ваше имя" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Введите email!' },
              { type: 'email', message: 'Введите корректный email!' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="your@email.com" />
          </Form.Item>

          <Form.Item
            name="company_name"
            label="Название компании"
            rules={[{ required: true, message: 'Введите название компании!' }]}
          >
            <Input prefix={<BankOutlined />} placeholder="ООО 'Ваша компания'" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            rules={[
              { required: true, message: 'Введите пароль!' },
              { min: 6, message: 'Пароль должен содержать минимум 6 символов!' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Минимум 6 символов" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Зарегистрироваться
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <Text type="secondary">
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Register;