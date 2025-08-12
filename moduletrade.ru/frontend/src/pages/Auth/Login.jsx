import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Checkbox, Alert, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, clearError } from '../../store/authSlice';
import './Login.css';

const { Title, Text } = Typography;

const Login = () => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);

  // ✅ ДОБАВЛЕНО: Очистка ошибок при размонтировании компонента
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  // ✅ ДОБАВЛЕНО: Автоматическое перенаправление если пользователь уже авторизован
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const onFinish = async (values) => {
    try {
      // ✅ ИСПРАВЛЕНО: Очищаем ошибки перед новой попыткой входа
      dispatch(clearError());
      
      const result = await dispatch(loginUser({
        email: values.email,
        password: values.password,
        rememberMe: values.remember
      })).unwrap();

      // ✅ УЛУЧШЕНО: Проверяем наличие данных в ответе
      if (result && result.user) {
        console.log('✅ Login successful:', result.user);
        navigate('/dashboard', { replace: true });
      } else {
        console.error('❌ Login failed: No user data in response');
      }
    } catch (error) {
      console.error('❌ Login failed:', error);
      // Ошибка уже обработана в authSlice
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-content">
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
                  closable
                  onClose={() => dispatch(clearError())}
                />
              )}

              <Form
                form={form}
                name="login-form"
                onFinish={onFinish}
                autoComplete="on"
                size="large"
                layout="vertical"
                className="login-form"
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
                    prefix={<UserOutlined />}
                    placeholder="Введите ваш email"
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
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
                    prefix={<LockOutlined />}
                    placeholder="Введите ваш пароль"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item>
                  <div className="login-options">
                    <Form.Item
                      name="remember"
                      valuePropName="checked"
                      noStyle
                    >
                      <Checkbox disabled={loading}>
                        Запомнить меня
                      </Checkbox>
                    </Form.Item>

                    <Link to="/forgot-password" className="forgot-password">
                      Забыли пароль?
                    </Link>
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
                    {loading ? 'Вход...' : 'Войти'}
                  </Button>
                </Form.Item>

                <div className="login-footer">
                  <Text type="secondary">
                    Нет аккаунта?{' '}
                    <Link to="/register">Зарегистрироваться</Link>
                  </Text>
                </div>
              </Form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;