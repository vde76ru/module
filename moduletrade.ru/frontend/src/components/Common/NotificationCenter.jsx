import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Drawer,
  List,
  Badge,
  Button,
  Typography,
  Space,
  Tag,
  Avatar,
  Tooltip,
  Divider,
  Empty,
  Popconfirm,
  Switch,
  Card,
  Tabs,
  Input,
  Select,
  message
} from 'antd';
import {
  BellOutlined,
  CloseOutlined,
  DeleteOutlined,
  MarkOutlined,
  SettingOutlined,
  SearchOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  BugOutlined,
  ShoppingOutlined,
  SyncOutlined,
  DollarOutlined
} from '@ant-design/icons';
import axios from '../utils/axios';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const { Text, Title } = Typography;
const { TabPane } = Tabs;
const { Search } = Input;
const { Option } = Select;

const NotificationCenter = ({ visible, onClose }) => {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState({
    push: true,
    email: true,
    sms: false,
    sound: true
  });

  useEffect(() => {
    if (visible) {
      fetchNotifications();
      fetchSettings();
    }
  }, [visible]);

  useEffect(() => {
    // WebSocket подключение для real-time уведомлений
    if (user?.id) {
      initializeWebSocket();
    }
    
    return () => {
      if (window.notificationWs) {
        window.notificationWs.close();
      }
    };
  }, [user]);

  const initializeWebSocket = () => {
    const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:3000'}/notifications`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'auth',
        token: localStorage.getItem('token')
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'notification') {
        handleNewNotification(data.payload);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    window.notificationWs = ws;
  };

  const handleNewNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // Показываем браузерное уведомление
    if (settings.push && 'Notification' in window && Notification.permission === 'granted') {
      showBrowserNotification(notification);
    }
    
    // Воспроизводим звук
    if (settings.sound) {
      playNotificationSound(notification.type);
    }
  }, [settings]);

  const showBrowserNotification = (notification) => {
    const browserNotification = new Notification(notification.title, {
      body: notification.message,
      icon: getNotificationIcon(notification.type),
      badge: '/favicon.ico',
      tag: notification.id,
      requireInteraction: notification.priority === 'high'
    });
    
    browserNotification.onclick = () => {
      window.focus();
      handleNotificationClick(notification);
      browserNotification.close();
    };
  };

  const playNotificationSound = (type) => {
    const soundMap = {
      error: '/sounds/error.mp3',
      warning: '/sounds/warning.mp3',
      success: '/sounds/success.mp3',
      info: '/sounds/info.mp3'
    };
    
    const audio = new Audio(soundMap[type] || soundMap.info);
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Игнорируем ошибки воспроизведения
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/notifications');
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      message.error('Ошибка загрузки уведомлений');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/notifications/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      message.error('Ошибка пометки как прочитанное');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      message.success('Все уведомления отмечены как прочитанные');
    } catch (error) {
      message.error('Ошибка при пометке уведомлений');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await axios.delete(`/api/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      message.success('Уведомление удалено');
    } catch (error) {
      message.error('Ошибка удаления уведомления');
    }
  };

  const clearAll = async () => {
    try {
      await axios.delete('/api/notifications/clear-all');
      setNotifications([]);
      setUnreadCount(0);
      message.success('Все уведомления удалены');
    } catch (error) {
      message.error('Ошибка очистки уведомлений');
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      await axios.patch('/api/notifications/settings', newSettings);
      setSettings(newSettings);
      message.success('Настройки сохранены');
    } catch (error) {
      message.error('Ошибка сохранения настроек');
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        message.success('Разрешение на уведомления получено');
      }
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    // Навигация в зависимости от типа уведомления
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
  };

  const getNotificationIcon = (type) => {
    const iconMap = {
      error: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      warning: <WarningOutlined style={{ color: '#faad14' }} />,
      success: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      info: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
      system: <BugOutlined style={{ color: '#722ed1' }} />,
      order: <ShoppingOutlined style={{ color: '#13c2c2' }} />,
      sync: <SyncOutlined style={{ color: '#eb2f96' }} />,
      billing: <DollarOutlined style={{ color: '#faad14' }} />
    };
    
    return iconMap[type] || iconMap.info;
  };

  const getNotificationColor = (type) => {
    const colorMap = {
      error: 'red',
      warning: 'orange',
      success: 'green',
      info: 'blue',
      system: 'purple',
      order: 'cyan',
      sync: 'magenta',
      billing: 'gold'
    };
    
    return colorMap[type] || 'blue';
  };

  const filteredNotifications = notifications.filter(notification => {
    const matchesFilter = filter === 'all' || 
      (filter === 'unread' && !notification.read) ||
      (filter === 'read' && notification.read) ||
      (filter === notification.type);
    
    const matchesSearch = !searchQuery || 
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const filterOptions = [
    { value: 'all', label: 'Все', count: notifications.length },
    { value: 'unread', label: 'Непрочитанные', count: unreadCount },
    { value: 'error', label: 'Ошибки', count: notifications.filter(n => n.type === 'error').length },
    { value: 'warning', label: 'Предупреждения', count: notifications.filter(n => n.type === 'warning').length },
    { value: 'success', label: 'Успешные', count: notifications.filter(n => n.type === 'success').length },
    { value: 'order', label: 'Заказы', count: notifications.filter(n => n.type === 'order').length },
    { value: 'sync', label: 'Синхронизация', count: notifications.filter(n => n.type === 'sync').length }
  ];

  return (
    <Drawer
      title={
        <Space>
          <BellOutlined />
          Центр уведомлений
          {unreadCount > 0 && <Badge count={unreadCount} />}
        </Space>
      }
      width={480}
      visible={visible}
      onClose={onClose}
      bodyStyle={{ padding: 0 }}
      extra={
        <Space>
          {unreadCount > 0 && (
            <Button
              type="link"
              size="small"
              icon={<MarkOutlined />}
              onClick={markAllAsRead}
            >
              Прочитать все
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={onClose}
          />
        </Space>
      }
    >
      <Tabs defaultActiveKey="notifications">
        <TabPane tab="Уведомления" key="notifications">
          <div style={{ padding: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Search
                placeholder="Поиск уведомлений..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%' }}
              />
              
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Select
                  value={filter}
                  onChange={setFilter}
                  style={{ width: 180 }}
                >
                  {filterOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label} ({option.count})
                    </Option>
                  ))}
                </Select>
                
                {notifications.length > 0 && (
                  <Popconfirm
                    title="Удалить все уведомления?"
                    onConfirm={clearAll}
                    okText="Да"
                    cancelText="Отмена"
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                    >
                      Очистить все
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Space>
          </div>

          <List
            loading={loading}
            dataSource={filteredNotifications}
            locale={{
              emptyText: (
                <Empty
                  description="Нет уведомлений"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
            renderItem={(notification) => (
              <List.Item
                style={{
                  backgroundColor: notification.read ? 'transparent' : '#f6ffed',
                  borderLeft: notification.read ? 'none' : `3px solid ${getNotificationColor(notification.type)}`,
                  padding: '12px 24px',
                  cursor: 'pointer'
                }}
                onClick={() => handleNotificationClick(notification)}
                actions={[
                  <Tooltip title="Удалить">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                    />
                  </Tooltip>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      icon={getNotificationIcon(notification.type)}
                      style={{ 
                        backgroundColor: 'transparent',
                        border: `2px solid ${getNotificationColor(notification.type)}`
                      }}
                    />
                  }
                  title={
                    <Space>
                      <Text strong={!notification.read}>
                        {notification.title}
                      </Text>
                      <Tag color={getNotificationColor(notification.type)} size="small">
                        {notification.type}
                      </Tag>
                      {notification.priority === 'high' && (
                        <Tag color="red" size="small">
                          Важно
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <div>
                      <Text type="secondary">{notification.message}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ru
                        })}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </TabPane>

        <TabPane tab="Настройки" key="settings">
          <div style={{ padding: '24px' }}>
            <Title level={4}>Настройки уведомлений</Title>
            
            <Card style={{ marginBottom: '16px' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Push-уведомления</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Уведомления в браузере
                    </Text>
                  </div>
                  <Switch
                    checked={settings.push}
                    onChange={(checked) => {
                      if (checked) {
                        requestNotificationPermission();
                      }
                      updateSettings({ ...settings, push: checked });
                    }}
                  />
                </div>
                
                <Divider />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Email уведомления</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Отправка на электронную почту
                    </Text>
                  </div>
                  <Switch
                    checked={settings.email}
                    onChange={(checked) => updateSettings({ ...settings, email: checked })}
                  />
                </div>
                
                <Divider />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>SMS уведомления</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Отправка на мобильный телефон
                    </Text>
                  </div>
                  <Switch
                    checked={settings.sms}
                    onChange={(checked) => updateSettings({ ...settings, sms: checked })}
                  />
                </div>
                
                <Divider />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Звуковые уведомления</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Воспроизведение звука
                    </Text>
                  </div>
                  <Switch
                    checked={settings.sound}
                    onChange={(checked) => updateSettings({ ...settings, sound: checked })}
                  />
                </div>
              </Space>
            </Card>

            <Text type="secondary" style={{ fontSize: '12px' }}>
              Некоторые настройки могут потребовать разрешения браузера или операционной системы.
            </Text>
          </div>
        </TabPane>
      </Tabs>
    </Drawer>
  );
};

export default NotificationCenter;