// ===================================================
// ФАЙЛ: frontend/src/pages/Users/UsersPage.jsx
// ===================================================
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Typography,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  UserOutlined,
  MailOutlined,
} from '@ant-design/icons';

import PermissionGuard from '../../components/Auth/PermissionGuard';
import { usePermissions } from '../../hooks/usePermissions';
import {
  PERMISSIONS,
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_ROLE_COLORS
} from '../../utils/constants';
import api from '../../services/api';

const { Option } = Select;
const { Title } = Typography;

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [form] = Form.useForm();

  const { isAdmin } = usePermissions();

  // Проверяем права
  const canCreate = isAdmin();
  const canUpdate = isAdmin();

  useEffect(() => {
    if (isAdmin()) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/users');
      if (response.data.success) {
        setUsers(response.data.data || []);
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      message.error('Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      ...user,
      password: '', // Пароль не заполняем при редактировании
    });
    setModalVisible(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleSave = async (values) => {
    setFormLoading(true);
    try {
      // Убираем пустой пароль при редактировании
      const payload = { ...values };
      if (editingUser && !payload.password) {
        delete payload.password;
      }

      let response;
      if (editingUser) {
        response = await api.put(`/api/users/${editingUser.id}`, payload);
      } else {
        response = await api.post('/api/users', payload);
      }

      if (response.data.success) {
        message.success(editingUser ? 'Пользователь обновлен' : 'Пользователь создан');
        setModalVisible(false);
        setEditingUser(null);
        form.resetFields();
        fetchUsers();
      }
    } catch (error) {
      console.error('Save user error:', error);
      message.error('Ошибка сохранения пользователя');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancel = () => {
    setModalVisible(false);
    setEditingUser(null);
    form.resetFields();
  };

  const columns = [
    {
      title: 'Имя',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <UserOutlined />
          <span>{name || record.email}</span>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email) => (
        <Space>
          <MailOutlined />
          <span>{email}</span>
        </Space>
      ),
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={USER_ROLE_COLORS[role]}>
          {USER_ROLE_LABELS[role] || role}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Активен' : 'Заблокирован'}
        </Tag>
      ),
    },
    {
      title: 'Последний вход',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (date) => date ? new Date(date).toLocaleString('ru-RU') : 'Никогда',
    },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString('ru-RU'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <PermissionGuard permission={PERMISSIONS.USERS_UPDATE}>
          <Tooltip title="Редактировать">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
        </PermissionGuard>
      ),
    },
  ];

  if (!isAdmin()) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Title level={4}>Доступ запрещен</Title>
          <p>У вас нет прав для просмотра этой страницы</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>Управление пользователями</Title>
            <PermissionGuard permission={PERMISSIONS.USERS_CREATE}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                Добавить пользователя
              </Button>
            </PermissionGuard>
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Всего ${total} пользователей`,
          }}
        />
      </Card>

      {/* Модальное окно создания/редактирования */}
      <Modal
        title={editingUser ? 'Редактировать пользователя' : 'Создать пользователя'}
        open={modalVisible}
        onCancel={handleCancel}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            is_active: true,
            role: USER_ROLES.VIEWER,
          }}
        >
          <Form.Item
            name="name"
            label="Имя пользователя"
            rules={[{ required: true, message: 'Введите имя пользователя' }]}
          >
            <Input placeholder="Введите имя пользователя" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Некорректный email' }
            ]}
          >
            <Input placeholder="Введите email" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Роль"
            rules={[{ required: true, message: 'Выберите роль' }]}
          >
            <Select placeholder="Выберите роль">
              {Object.values(USER_ROLES).map(role => (
                <Option key={role} value={role}>
                  {USER_ROLE_LABELS[role]}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}
            rules={editingUser ? [] : [
              { required: true, message: 'Введите пароль' },
              { min: 6, message: 'Минимум 6 символов' }
            ]}
          >
            <Input.Password placeholder={editingUser ? 'Новый пароль' : 'Введите пароль'} />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Статус"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Активен"
              unCheckedChildren="Заблокирован"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCancel}>
                Отмена
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={formLoading}
              >
                {editingUser ? 'Сохранить' : 'Создать'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;