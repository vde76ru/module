// frontend/src/pages/Auth/Login.jsx
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Space,
  Divider,
  Alert,
  Checkbox
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone
} from '@ant-design/icons';
import { loginUser, clearError } from 'store/authSlice';
import './Login.css';

const { Title, Text, Link } = Typography;

const Login = () => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);

  // Перенаправляем авторизованного пользователя
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Очищаем ошибки при размонтировании
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleSubmit = async (values) => {
    try {
      await dispatch(loginUser({
        email: values.email,
        password: values.password,
      })).unwrap();
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleDemoLogin = () => {
    form.setFieldsValue({
      email: 'admin@demo.com',
      password: 'admin123',
    });
    
    handleSubmit({
      email: 'admin@demo.com',
      password: 'admin123',
    });
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-content">
          {/* Левая часть - информация */}
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
                  message="Ошибка авторизации"
                  description={error}
                  type="error"
                  showIcon
                  closable
                  className="login-error"
                  onClose={() => dispatch(clearError())}
                />
              )}

              <Form
                form={form}
                name="login"
                onFinish={handleSubmit}
                layout="vertical"
                size="large"
                className="login-form"
              >
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: 'Введите email' },
                    { type: 'email', message: 'Введите корректный email' },
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="admin@demo.com"
                    autoComplete="email"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="Пароль"
                  rules={[
                    { required: true, message: 'Введите пароль' },
                    { min: 6, message: 'Пароль должен содержать минимум 6 символов' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="admin123"
                    autoComplete="current-password"
                    iconRender={(visible) => 
                      visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                    }
                  />
                </Form.Item>

                <Form.Item>
                  <div className="login-options">
                    <Checkbox>Запомнить меня</Checkbox>
                    <Link href="#" className="forgot-password">
                      Забыли пароль?
                    </Link>
                  </div>
                </Form.Item>

                <Form.Item>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      className="login-button"
                    >
                      Войти
                    </Button>

                    <Divider>или</Divider>

                    <Button
                      type="default"
                      onClick={handleDemoLogin}
                      block
                      className="demo-button"
                    >
                      Демо вход
                    </Button>
                  </Space>
                </Form.Item>
              </Form>

              <div className="login-footer">
                <Text type="secondary">
                  Нет аккаунта? <Link href="#register">Зарегистрироваться</Link>
                </Text>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;