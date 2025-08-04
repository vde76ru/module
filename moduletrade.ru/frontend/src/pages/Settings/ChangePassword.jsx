// ===================================================
// ФАЙЛ: frontend/src/pages/Settings/ChangePassword.jsx
// Страница смены пароля
// ===================================================
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  Alert,
  Typography,
  Space,
  Divider
} from 'antd';
import {
  LockOutlined,
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone
} from '@ant-design/icons';
import { changePassword, clearError } from 'store/authSlice';

const { Title, Text, Paragraph } = Typography;

const ChangePassword = () => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setSuccess(false);
      const result = await dispatch(changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      })).unwrap();

      if (result) {
        setSuccess(true);
        form.resetFields();

        // Опционально: перенаправить на страницу входа через 3 секунды
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('Change password error:', error);
    }
  };

  const handleClearError = () => {
    dispatch(clearError());
  };

  const passwordRules = [
    { required: true, message: 'Введите пароль' },
    { min: 8, message: 'Пароль должен содержать минимум 8 символов' },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      message: 'Пароль должен содержать заглавную букву, строчную букву и цифру'
    }
  ];

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={3}>
              <LockOutlined /> Смена пароля
            </Title>
            <Paragraph type="secondary">
              Для безопасности вашего аккаунта рекомендуем использовать сложный пароль
              и менять его каждые 3-6 месяцев.
            </Paragraph>
          </div>

          <Divider />

          {/* Сообщение об успехе */}
          {success && (
            <Alert
              message="Пароль успешно изменен"
              description="Вы будете перенаправлены на страницу входа через несколько секунд"
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              style={{ marginBottom: 24 }}
            />
          )}

          {/* Ошибки */}
          {error && (
            <Alert
              message="Ошибка смены пароля"
              description={error}
              type="error"
              showIcon
              closable
              onClose={handleClearError}
              style={{ marginBottom: 24 }}
            />
          )}

          <Form
            form={form}
            name="changePassword"
            onFinish={handleSubmit}
            layout="vertical"
            requiredMark={false}
            size="large"
          >
            <Form.Item
              name="currentPassword"
              label="Текущий пароль"
              rules={[
                { required: true, message: 'Введите текущий пароль' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Введите текущий пароль"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item
              name="newPassword"
              label="Новый пароль"
              rules={passwordRules}
              extra="Минимум 8 символов, включая заглавную букву, строчную букву и цифру"
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Введите новый пароль"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Подтвердите новый пароль"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Подтвердите новый пароль' },
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
                placeholder="Повторите новый пароль"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  size="large"
                >
                  Сменить пароль
                </Button>
                <Button
                  onClick={() => navigate(-1)}
                  size="large"
                >
                  Отмена
                </Button>
              </Space>
            </Form.Item>
          </Form>

          <Divider />

          <div style={{ textAlign: 'center' }}>
            <Title level={5}>Рекомендации по безопасности</Title>
            <Space direction="vertical" size="small" style={{ textAlign: 'left' }}>
              <Text type="secondary">
                • Не используйте пароли, которые легко угадать
              </Text>
              <Text type="secondary">
                • Не используйте один и тот же пароль для разных сервисов
              </Text>
              <Text type="secondary">
                • Регулярно меняйте пароль
              </Text>
              <Text type="secondary">
                • Используйте менеджер паролей для хранения
              </Text>
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default ChangePassword;