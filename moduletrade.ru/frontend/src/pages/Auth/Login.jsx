import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Checkbox, Alert, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from 'store/slices/authSlice';
import './Login.css';

const { Title, Text } = Typography;

const Login = () => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [rememberMe, setRememberMe] = useState(false);

  const onFinish = async (values) => {
    try {
      const result = await dispatch(login({
        email: values.email,
        password: values.password,
        rememberMe: values.remember
      })).unwrap();

      if (result.success) {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="login-container">
      {/* Левая часть - информация о компании */}
      <div className="login-info">
        <div className="logo-section">
          <img
            src="/logo.png"
            alt="ModuleTrade"
            className="login-logo"
          />
          <Title level={1} className="brand-title">
            ModuleTrade
          </Title>
          <Text className="brand-subtitle">
            SaaS-платформа для управления товарами и маркетплейсами
          </Text>
        </div>

        <div className="features-section">
          <div className="feature-item">
            <div className="feature-icon">🏪</div>
            <div>
              <Title level={4}>Маркетплейсы</Title>
              <Text>Ozon, Wildberries, Yandex Market</Text>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon">📦</div>
            <div>
              <Title level={4}>Управление товарами</Title>
              <Text>PIM система с нормализацией данных</Text>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon">🏭</div>
            <div>
              <Title level={4}>Поставщики</Title>
              <Text>ETM, RS24, собственные API</Text>
            </div>
          </div>
        </div>
      </div>

      {/* Правая часть - форма входа */}
      <div className="login-form-section">
        <Card className="login-card">
          <div className="login-header">
            <Title level={2}>Вход в систему</Title>
            <Text type="secondary">
              Войдите в свой аккаунт для продолжения работы
            </Text>
          </div>

          {error && (
            <Alert
              message="Ошибка входа"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Form
            form={form}
            name="login-form"
            onFinish={onFinish}
            autoComplete="on"
            size="large"
            layout="vertical"
          >
            <Form.Item
              label="Email"
              name="email"
              rules={[
                {
                  required: true,
                  message: 'Пожалуйста, введите email!',
                },
                {
                  type: 'email',
                  message: 'Введите корректный email!',
                },
              ]}
            >
              <Input
                id="login-email"
                name="email"
                prefix={<UserOutlined />}
                placeholder="Введите ваш email"
                autoComplete="email"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              label="Пароль"
              name="password"
              rules={[
                {
                  required: true,
                  message: 'Пожалуйста, введите пароль!',
                },
                {
                  min: 6,
                  message: 'Пароль должен содержать минимум 6 символов!',
                },
              ]}
            >
              <Input.Password
                id="login-password"
                name="password"
                prefix={<LockOutlined />}
                placeholder="Введите ваш пароль"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item>
              <div className="login-options">
                <Form.Item
                  name="remember"
                  valuePropName="checked"
                  noStyle
                >
                  <Checkbox
                    id="login-remember"
                    name="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  >
                    Запомнить меня
                  </Checkbox>
                </Form.Item>

                <a href="/forgot-password" className="forgot-password">
                  Забыли пароль?
                </a>
              </div>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="login-button"
                loading={loading}
                disabled={loading}
                block
              >
                {loading ? (
                  <>
                    <Spin size="small" style={{ marginRight: 8 }} />
                    Вход в систему...
                  </>
                ) : (
                  'Войти'
                )}
              </Button>
            </Form.Item>

            <div className="register-link">
              <Text>
                Нет аккаунта?{' '}
                <a href="/register">
                  Зарегистрироваться
                </a>
              </Text>
            </div>
          </Form>

          {/* Demo credentials */}
          <div className="demo-credentials">
            <Text type="secondary" style={{ fontSize: '12px' }}>
              <strong>Демо-аккаунт:</strong><br />
              Email: demo@test.com<br />
              Пароль: 123456
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;