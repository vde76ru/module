import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Space,
  Alert,
  Select,
  Row,
  Col,
  Checkbox,
  Divider
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  PhoneOutlined,
  BankOutlined
} from '@ant-design/icons';
import { registerUser, clearError } from 'store/authSlice';

const { Title, Text } = Typography;
const { Option } = Select;

const RegisterForm = () => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { loading, error } = useSelector((state) => state.auth);
  const [step, setStep] = useState(1);

  const handleSubmit = async (values) => {
    try {
      await dispatch(registerUser({
        email: values.email,
        password: values.password,
        name: `${values.firstName} ${values.lastName}`,
        company_name: values.companyName,
        phone: values.phone,
        plan: values.plan || 'basic'
      })).unwrap();

      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  const nextStep = () => {
    form.validateFields(['firstName', 'lastName', 'email', 'password', 'confirmPassword'])
      .then(() => setStep(2))
      .catch(() => {});
  };

  const prevStep = () => setStep(1);

  return (
    <div className="register-container">
      <Card
        className="register-card"
        style={{
          width: '100%',
          maxWidth: 500,
          margin: '50px auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            Создать аккаунт
          </Title>
          <Text type="secondary">
            Присоединяйтесь к ModuleTrade и начните управлять своей торговлей
          </Text>
        </div>

        {error && (
          <Alert
            message="Ошибка регистрации"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => dispatch(clearError())}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          name="register"
          onFinish={handleSubmit}
          layout="vertical"
          requiredMark={false}
        >
          {step === 1 && (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="firstName"
                    label="Имя"
                    rules={[
                      { required: true, message: 'Введите ваше имя' },
                      { min: 2, message: 'Имя должно содержать минимум 2 символа' }
                    ]}
                  >
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="Введите имя"
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="lastName"
                    label="Фамилия"
                    rules={[
                      { required: true, message: 'Введите вашу фамилию' },
                      { min: 2, message: 'Фамилия должна содержать минимум 2 символа' }
                    ]}
                  >
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="Введите фамилию"
                      size="large"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Введите ваш email' },
                  { type: 'email', message: 'Введите корректный email' }
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="your@email.com"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="Пароль"
                rules={[
                  { required: true, message: 'Введите пароль' },
                  { min: 6, message: 'Пароль должен содержать минимум 6 символов' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Введите пароль"
                  size="large"
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
                  size="large"
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  onClick={nextStep}
                  block
                  size="large"
                  style={{ marginTop: 16 }}
                >
                  Продолжить
                </Button>
              </Form.Item>
            </>
          )}

          {step === 2 && (
            <>
              <Form.Item
                name="companyName"
                label="Название компании"
                rules={[
                  { required: true, message: 'Введите название компании' },
                  { min: 2, message: 'Название должно содержать минимум 2 символа' }
                ]}
              >
                <Input
                  prefix={<BankOutlined />}
                  placeholder="ООО Ваша компания"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="phone"
                label="Телефон"
                rules={[
                  { required: true, message: 'Введите номер телефона' },
                  { pattern: /^[\+]?[1-9][\d]{10,14}$/, message: 'Введите корректный номер телефона' }
                ]}
              >
                <Input
                  prefix={<PhoneOutlined />}
                  placeholder="+7 (999) 123-45-67"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="plan"
                label="Тарифный план"
                initialValue="basic"
              >
                <Select size="large" placeholder="Выберите тарифный план">
                  <Option value="basic">
                    <div>
                      <div><strong>Базовый</strong> - Бесплатно</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        До 100 товаров, 1 маркетплейс
                      </div>
                    </div>
                  </Option>
                  <Option value="standard">
                    <div>
                      <div><strong>Стандарт</strong> - 2990₽/мес</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        До 5000 товаров, 3 маркетплейса
                      </div>
                    </div>
                  </Option>
                  <Option value="premium">
                    <div>
                      <div><strong>Премиум</strong> - 7990₽/мес</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Неограниченно товаров и маркетплейсов
                      </div>
                    </div>
                  </Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="agreement"
                valuePropName="checked"
                rules={[
                  { validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Необходимо согласие')) }
                ]}
              >
                <Checkbox>
                  Я согласен с <Link to="/terms">условиями использования</Link> и{' '}
                  <Link to="/privacy">политикой конфиденциальности</Link>
                </Checkbox>
              </Form.Item>

              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Button onClick={prevStep} size="large">
                    Назад
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    size="large"
                  >
                    Создать аккаунт
                  </Button>
                </Space>
              </Form.Item>
            </>
          )}
        </Form>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            Уже есть аккаунт?{' '}
            <Link to="/login">Войти</Link>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default RegisterForm;