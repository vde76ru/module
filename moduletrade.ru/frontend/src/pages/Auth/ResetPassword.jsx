// ===================================================
// ФАЙЛ: frontend/src/pages/Auth/ResetPassword.jsx
// Страница ввода нового пароля по токену
// ===================================================
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { resetPassword, clearError } from '../../store/authSlice';

const { Title, Text } = Typography;

const ResetPassword = () => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [params] = useSearchParams();
  const token = params.get('token');

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const onFinish = async (values) => {
    try {
      await dispatch(resetPassword({ token, newPassword: values.newPassword })).unwrap();
      navigate('/login', { replace: true });
    } catch (e) {
      // Ошибка уже показана уведомлением
    }
  };

  const passwordRules = [
    { required: true, message: 'Введите новый пароль' },
    { min: 8, message: 'Минимум 8 символов' },
  ];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <Card style={{ width: 420 }}>
        <Title level={3} style={{ marginBottom: 8 }}>Сброс пароля</Title>
        <Text type="secondary">Введите новый пароль для вашего аккаунта</Text>

        {!token && (
          <Alert style={{ marginTop: 16 }} type="error" message="Некорректная ссылка" description="Отсутствует токен сброса" />
        )}

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
          disabled={!token || loading}
        >
          <Form.Item label="Новый пароль" name="newPassword" rules={passwordRules} hasFeedback>
            <Input.Password
              prefix={<LockOutlined />}
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              placeholder="Введите новый пароль"
            />
          </Form.Item>
          <Form.Item
            label="Повторите пароль"
            name="confirmPassword"
            dependencies={["newPassword"]}
            hasFeedback
            rules={[
              { required: true, message: 'Повторите пароль' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Пароли не совпадают'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              placeholder="Повторите новый пароль"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} disabled={!token || loading}>
              Сохранить пароль
            </Button>
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Link to="/login">Войти</Link>
            <Link to="/register">Зарегистрироваться</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default ResetPassword;

