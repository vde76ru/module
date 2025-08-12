// ===================================================
// ФАЙЛ: frontend/src/pages/Users/UsersPage.jsx
// ✅ ИСПРАВЛЕНО: Убран PermissionGuard, заменен на hasPermission условия
// ===================================================
import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Popconfirm,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { api } from 'services';
import axios from 'utils/axios';

// ✅ ИСПРАВЛЕНО: Только новый импорт usePermissions, убран PermissionGuard
import { usePermissions } from 'hooks/usePermissions';
import { PERMISSIONS, USER_ROLES, USER_ROLE_LABELS, USER_ROLE_COLORS } from 'utils/constants';

const { Option } = Select;
const { Title } = Typography;

const UsersPage = () => {
  const { hasPermission, user: currentUser } = usePermissions();
  const dispatch = useDispatch();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [roles, setRoles] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    admins: 0,
  });

  // Проверяем права
  const canCreate = hasPermission(PERMISSIONS.USERS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.USERS_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.USERS_DELETE);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const resp = await api.users.getUsers();
      const items = Array.isArray(resp) ? resp : (resp.data || []);
      setUsers(items);
      const total = items.length;
      const active = items.filter(u => u.is_active).length;
      const admins = items.filter(u => (u.role || '').toLowerCase() === (USER_ROLES.ADMIN)).length;
      setStats({ total, active, admins });
    } catch (error) {
      message.error('Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const resp = await axios.get('/api/dictionaries/roles');
      const list = Array.isArray(resp?.data?.data) ? resp.data.data : [];
      setRoles(list);
    } catch (error) {
      console.warn('Failed to load roles:', error);
    }
  };

  const fetchStats = async () => {
    try {
      // Демо статистика
      setStats({
        total: 3,
        active: 2,
        admins: 1,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setIsModalVisible(true);
  };

  const handleChangePassword = (user) => {
    setEditingUser(user);
    passwordForm.resetFields();
    setIsPasswordModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingUser) {
        const payload = {
          name: values.name,
          phone: values.phone,
          role: values.role,
          is_active: values.is_active,
        };
        await api.users.updateUser(editingUser.id, payload);
        message.success('Пользователь обновлен');
      } else {
        const payload = {
          name: values.name,
          email: values.email,
          phone: values.phone,
          role: values.role,
          password: values.password,
        };
        await api.users.createUser(payload);
        message.success('Пользователь создан');
      }
      setIsModalVisible(false);
      await fetchUsers();
    } catch (error) {
      message.error('Ошибка сохранения пользователя');
    }
  };

  const handlePasswordSubmit = async (values) => {
    try {
      // Если пользователь меняет свой пароль — используем auth.changePassword
      if (editingUser && currentUser && editingUser.id === currentUser.id) {
        await api.auth.changePassword(values.current_password || '', values.new_password);
      } else if (editingUser) {
        // Админ меняет пароль другого пользователя
        await api.users.updateUser(editingUser.id, { password: values.new_password });
      }
      message.success('Пароль изменен');
      setIsPasswordModalVisible(false);
      await fetchUsers();
    } catch (error) {
      message.error(error?.message || 'Ошибка изменения пароля');
    }
  };

  const handleDelete = async (userId) => {
    try {
      await api.users.deleteUser(userId);
      message.success('Пользователь удален');
      fetchUsers();
    } catch (error) {
      message.error(error?.message || 'Ошибка удаления пользователя');
    }
  };

  const columns = [
    {
      title: 'Имя',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <UserOutlined />
          <span style={{ fontWeight: 500 }}>{name}</span>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
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
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Активен' : 'Заблокирован'}
        </Tag>
      ),
    },
    {
      title: 'Последний вход',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (lastLogin) => (
        <span>
          {lastLogin
            ? new Date(lastLogin).toLocaleString('ru-RU')
            : 'Никогда'
          }
        </span>
      ),
    },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (createdAt) => (
        <span>
          {new Date(createdAt).toLocaleDateString('ru-RU')}
        </span>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => {
        const actions = [];

        // Редактирование - только с правами UPDATE
        if (canUpdate) {
          actions.push(
            <Button
              key="edit"
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            >
              Редактировать
            </Button>
          );

          actions.push(
            <Button
              key="password"
              type="link"
              icon={<KeyOutlined />}
              onClick={() => handleChangePassword(record)}
              size="small"
            >
              Сменить пароль
            </Button>
          );
        }

        // Удаление - только с правами DELETE и не для самого себя
        if (canDelete && record.id !== currentUser?.id) {
          actions.push(
            <Popconfirm
              key="delete"
              title="Удалить пользователя?"
              onConfirm={() => handleDelete(record.id)}
              okText="Да"
              cancelText="Нет"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
              >
                Удалить
              </Button>
            </Popconfirm>
          );
        }

        return actions.length > 0 ? <Space size="small">{actions}</Space> : null;
      },
    },
  ];

  return (
    <div>
      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Всего пользователей"
              value={stats.total}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Активных"
              value={stats.active}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Администраторов"
              value={stats.admins}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Основная таблица */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>Пользователи</Title>
            {/* ✅ ИСПРАВЛЕНО: Заменен PermissionGuard на условие */}
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Добавить пользователя
              </Button>
            )}
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
            showTotal: (total) => `Всего: ${total}`,
          }}
        />
      </Card>

      {/* Модальное окно создания/редактирования пользователя */}
      <Modal
        title={editingUser ? 'Редактировать пользователя' : 'Добавить пользователя'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Имя пользователя"
            rules={[{ required: true, message: 'Введите имя пользователя' }]}
          >
            <Input placeholder="Имя пользователя" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Введите корректный email' }
            ]}
          >
            <Input placeholder="user@company.ru" disabled={!!editingUser} />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Телефон"
          >
            <Input placeholder="+7 (999) 123-45-67" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Роль"
            rules={[{ required: true, message: 'Выберите роль' }]}
          >
            <Select placeholder="Выберите роль" loading={!roles.length}>
              {roles.map((r) => (
                <Option key={r.id} value={r.code || r.name}>
                  <Tag color={USER_ROLE_COLORS[r.code] || 'default'}>
                    {r.display_name || r.name}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {!editingUser && (
            <Form.Item
              name="password"
              label="Пароль"
              rules={[
                { required: true, message: 'Введите пароль' },
                { min: 6, message: 'Пароль должен содержать минимум 6 символов' }
              ]}
            >
              <Input.Password placeholder="Пароль" />
            </Form.Item>
          )}

          {!editingUser && (
            <Form.Item
              name="confirmPassword"
              label="Подтверждение пароля"
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
              <Input.Password placeholder="Подтверждение пароля" />
            </Form.Item>
          )}

          <Form.Item
            name="is_active"
            label="Статус"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="Активен" unCheckedChildren="Заблокирован" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>
                Отмена
              </Button>
              <Button type="primary" htmlType="submit">
                {editingUser ? 'Сохранить' : 'Создать'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно изменения пароля */}
      <Modal
        title="Изменить пароль"
        open={isPasswordModalVisible}
        onCancel={() => setIsPasswordModalVisible(false)}
        footer={null}
        width={400}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordSubmit}
        >
          <Form.Item
            name="new_password"
            label="Новый пароль"
            rules={[
              { required: true, message: 'Введите новый пароль' },
              { min: 6, message: 'Пароль должен содержать минимум 6 символов' }
            ]}
          >
            <Input.Password placeholder="Новый пароль" />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="Подтверждение пароля"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Подтвердите новый пароль' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Пароли не совпадают'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Подтверждение пароля" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsPasswordModalVisible(false)}>
                Отмена
              </Button>
              <Button type="primary" htmlType="submit">
                Изменить пароль
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;