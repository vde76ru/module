// ===================================================
// ФАЙЛ: frontend/src/pages/Auth/Register.jsx
// ОБНОВЛЕННАЯ ВЕРСИЯ: Полная страница регистрации с демо тарифом
// ===================================================
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Row,
  Col,
  Checkbox,
  Divider,
  Space,
  Tag,
  Spin
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  BankOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  CheckCircleOutlined,
  GiftOutlined,
  PhoneOutlined
} from '@ant-design/icons';
import { registerUser, clearError } from 'store/authSlice';

const { Title, Text, Paragraph } = Typography;

const Register = () => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { loading, error } = useSelector((state) => state.auth);
  const [agreementChecked, setAgreementChecked] = useState(false);

  const handleSubmit = async (values) => {
    try {
      await dispatch(registerUser({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        companyName: values.companyName,
        phone: values.phone,
        name: `${values.firstName} ${values.lastName}`.trim()
      })).unwrap();

      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  const handleClearError = () => {
    dispatch(clearError());
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 600,
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          borderRadius: '12px'
        }}
        bodyStyle={{ padding: '40px' }}
      >
        {/* Заголовок */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8, color: '#1890ff' }}>
            Создать аккаунт
          </Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            Присоединяйтесь к платформе управления торговлей
          </Text>

          {/* Демо тариф баннер */}
          <div style={{
            background: 'linear-gradient(90deg, #52c41a, #389e0d)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginTop: '20px',
            color: 'white'
          }}>
            <Space>
              <GiftOutlined style={{ fontSize: '18px' }} />
              <Text style={{ color: 'white', fontWeight: 'bold' }}>
                Бесплатный демо тариф на 14 дней!
              </Text>
            </Space>
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9 }}>
              До 100 товаров • 1 маркетплейс • Базовая аналитика
            </div>
          </div>
        </div>

        {/* Ошибки */}
        {error && (
          <Alert
            message="Ошибка регистрации"
            description={error}
            type="error"
            showIcon
            closable
            onClose={handleClearError}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Форма регистрации */}
        <Spin spinning={loading}>
          <Form
            form={form}
            name="register"
            onFinish={handleSubmit}
            layout="vertical"
            requiredMark={false}
            size="large"
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="firstName"
                  label="Имя"
                  rules={[
                    { required: true, message: 'Введите ваше имя' },
                    { min: 2, message: 'Имя должно содержать минимум 2 символа' },
                    { max: 50, message: 'Имя не должно превышать 50 символов' }
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="Введите имя"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="lastName"
                  label="Фамилия"
                  rules={[
                    { required: true, message: 'Введите вашу фамилию' },
                    { min: 2, message: 'Фамилия должна содержать минимум 2 символа' },
                    { max: 50, message: 'Фамилия не должна превышать 50 символов' }
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="Введите фамилию"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="email"
              label="Email адрес"
              rules={[
                { required: true, message: 'Введите ваш email' },
                { type: 'email', message: 'Введите корректный email адрес' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="your@company.com"
              />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Телефон"
            >
              <Input
                prefix={<PhoneOutlined />}
                placeholder="+7 (999) 123-45-67"
              />
            </Form.Item>

            <Form.Item
              name="companyName"
              label="Название компании"
              rules={[
                { required: true, message: 'Введите название компании' },
                { min: 2, message: 'Название должно содержать минимум 2 символа' },
                { max: 100, message: 'Название не должно превышать 100 символов' }
              ]}
            >
              <Input
                prefix={<BankOutlined />}
                placeholder="ООО 'Ваша компания'"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Пароль"
              rules={[
                { required: true, message: 'Введите пароль' },
                { min: 8, message: 'Пароль должен содержать минимум 8 символов' },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Пароль должен содержать заглавную букву, строчную букву и цифру'
                }
              ]}
              extra="Минимум 8 символов, включая заглавную букву, строчную букву и цифру"
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Введите надежный пароль"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Подтвердите пароль"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Подтвердите пароль' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Пароли не совпадают'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Повторите пароль"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item
              name="agreement"
              valuePropName="checked"
              rules={[
                {
                  validator: (_, value) =>
                    value ? Promise.resolve() : Promise.reject(new Error('Необходимо согласие с условиями'))
                }
              ]}
            >
              <Checkbox checked={agreementChecked} onChange={(e) => setAgreementChecked(e.target.checked)}>
                Я согласен с{' '}
                <Link to="/terms" target="_blank">
                  условиями использования
                </Link>{' '}
                и{' '}
                <Link to="/privacy" target="_blank">
                  политикой конфиденциальности
                </Link>
              </Checkbox>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                disabled={!agreementChecked}
                style={{
                  height: '50px',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Создаём аккаунт...' : 'Создать аккаунт бесплатно'}
              </Button>
            </Form.Item>
          </Form>
        </Spin>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            Уже есть аккаунт?{' '}
            <Link to="/login" style={{ fontWeight: 'bold' }}>
              Войти
            </Link>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Register;