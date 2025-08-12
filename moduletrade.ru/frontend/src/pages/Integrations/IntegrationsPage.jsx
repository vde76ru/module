import React, { useState, useEffect } from 'react';
import {
  Card, Tabs, Form, Input, Button, message, Space, Typography,
  Row, Col, Switch, InputNumber, Select, Divider, Alert, Tag,
  Descriptions, Modal, Spin, Tooltip, Icon
} from 'antd';
import {
  SettingOutlined, SyncOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, InfoCircleOutlined, LinkOutlined
} from '@ant-design/icons';
import { api } from 'services';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const IntegrationsPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [integrations, setIntegrations] = useState({});
  const [rs24Form] = Form.useForm();
  const [yandexForm] = Form.useForm();

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const response = await api.settings.getIntegrations();
      setIntegrations(response.data || {});

      // Заполняем формы текущими значениями
      if (response.data) {
        const rs24Integration = response.data.find(i => i.type === 'rs24');
        const yandexIntegration = response.data.find(i => i.type === 'yandex');

        if (rs24Integration) {
          rs24Form.setFieldsValue({
            api_url: rs24Integration.api_url || 'https://api.russvet.ru',
            api_key: rs24Integration.api_key || '',
            username: rs24Integration.username || '',
            password: rs24Integration.password || '',
            is_active: rs24Integration.is_active !== false,
            sync_frequency: rs24Integration.sync_frequency || 'hourly',
            max_products_per_sync: rs24Integration.max_products_per_sync || 1000
          });
        }

        if (yandexIntegration) {
          yandexForm.setFieldsValue({
            business_id: yandexIntegration.business_id || '',
            campaign_id: yandexIntegration.campaign_id || '',
            api_key: yandexIntegration.api_key || '',
            oauth_token: yandexIntegration.oauth_token || '',
            is_active: yandexIntegration.is_active !== false,
            sync_frequency: yandexIntegration.sync_frequency || 'hourly',
            auto_update_prices: yandexIntegration.auto_update_prices || false,
            auto_update_stocks: yandexIntegration.auto_update_stocks || false
          });
        }
      }
    } catch (error) {
      message.error('Ошибка загрузки интеграций');
      console.error('Load integrations error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testRS24Connection = async () => {
    setTesting(true);
    try {
      const values = await rs24Form.validateFields();
      const response = await api.integrations.testRS24({
        api_url: values.api_url,
        api_key: values.api_key,
        username: values.username,
        password: values.password
      });

      if (response.success) {
        message.success('Подключение к RS24 успешно!');
        Modal.success({
          title: 'Тест подключения RS24',
          content: (
            <div>
              <p>✅ Подключение установлено успешно</p>
              <p>📊 Доступно товаров: {response.data.total_products || 'N/A'}</p>
              <p>🏪 Доступно складов: {response.data.total_warehouses || 'N/A'}</p>
              <p>📦 Последняя синхронизация: {response.data.last_sync || 'N/A'}</p>
            </div>
          )
        });
      } else {
        message.error('Ошибка подключения к RS24');
      }
    } catch (error) {
      message.error('Ошибка тестирования подключения RS24');
      console.error('Test RS24 error:', error);
    } finally {
      setTesting(false);
    }
  };

  const testYandexConnection = async () => {
    setTesting(true);
    try {
      const values = await yandexForm.validateFields();
      const response = await api.integrations.testYandex({
        business_id: values.business_id,
        campaign_id: values.campaign_id,
        api_key: values.api_key,
        oauth_token: values.oauth_token
      });

      if (response.success) {
        message.success('Подключение к Яндекс.Маркет успешно!');
        Modal.success({
          title: 'Тест подключения Яндекс.Маркет',
          content: (
            <div>
              <p>✅ Подключение установлено успешно</p>
              <p>🏪 Кампания: {response.data.campaign_name || 'N/A'}</p>
              <p>📊 Доступно товаров: {response.data.total_offers || 'N/A'}</p>
              <p>📦 Последняя синхронизация: {response.data.last_sync || 'N/A'}</p>
            </div>
          )
        });
      } else {
        message.error('Ошибка подключения к Яндекс.Маркет');
      }
    } catch (error) {
      message.error('Ошибка тестирования подключения Яндекс.Маркет');
      console.error('Test Yandex error:', error);
    } finally {
      setTesting(false);
    }
  };

  const saveRS24Integration = async () => {
    try {
      const values = await rs24Form.validateFields();
      await api.integrations.saveRS24({
        type: 'rs24',
        name: 'RS24 (Русский Свет)',
        api_url: values.api_url,
        api_key: values.api_key,
        username: values.username,
        password: values.password,
        is_active: values.is_active,
        sync_frequency: values.sync_frequency,
        max_products_per_sync: values.max_products_per_sync
      });

      message.success('Настройки RS24 сохранены');
      loadIntegrations();
    } catch (error) {
      message.error('Ошибка сохранения настроек RS24');
      console.error('Save RS24 error:', error);
    }
  };

  const saveYandexIntegration = async () => {
    try {
      const values = await yandexForm.validateFields();
      await api.integrations.saveYandex({
        type: 'yandex',
        name: 'Яндекс.Маркет',
        business_id: values.business_id,
        campaign_id: values.campaign_id,
        api_key: values.api_key,
        oauth_token: values.oauth_token,
        is_active: values.is_active,
        sync_frequency: values.sync_frequency,
        auto_update_prices: values.auto_update_prices,
        auto_update_stocks: values.auto_update_stocks
      });

      message.success('Настройки Яндекс.Маркет сохранены');
      loadIntegrations();
    } catch (error) {
      message.error('Ошибка сохранения настроек Яндекс.Маркет');
      console.error('Save Yandex error:', error);
    }
  };

  const startSync = async (type) => {
    try {
      setLoading(true);
      await api.integrations.startSync(type);
      message.success(`Синхронизация ${type === 'rs24' ? 'RS24' : 'Яндекс.Маркет'} запущена`);
    } catch (error) {
      message.error(`Ошибка запуска синхронизации ${type === 'rs24' ? 'RS24' : 'Яндекс.Маркет'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <SettingOutlined /> Настройки интеграций
      </Title>

      <Alert
        message="Интеграции с поставщиками и маркетплейсами"
        description="Настройте подключения к внешним системам для автоматической синхронизации товаров, цен и остатков."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Card>
        <Tabs defaultActiveKey="rs24" size="large">
          {/* RS24 Интеграция */}
          <TabPane tab="RS24 (Русский Свет)" key="rs24">
            <Row gutter={24}>
              <Col span={16}>
                <Form
                  form={rs24Form}
                  layout="vertical"
                  onFinish={saveRS24Integration}
                >
                  <Title level={4}>Настройки подключения к RS24</Title>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="api_url"
                        label="API URL"
                        rules={[{ required: true, message: 'Введите API URL' }]}
                        extra="Базовый URL для API RS24"
                      >
                        <Input placeholder="https://api.russvet.ru" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="api_key"
                        label="API Ключ"
                         extra="Необязательно для RS24. Оставьте пустым, если используется вход по логину и паролю"
                      >
                         <Input.Password placeholder="Опционально: API ключ (если выдан)" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="username"
                        label="Имя пользователя"
                        extra="Логин для доступа к системе"
                      >
                        <Input placeholder="Введите имя пользователя" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="password"
                        label="Пароль"
                        extra="Пароль для доступа к системе"
                      >
                        <Input.Password placeholder="Введите пароль" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="sync_frequency"
                        label="Частота синхронизации"
                        extra="Как часто обновлять данные"
                      >
                        <Select>
                          <Select.Option value="manual">Вручную</Select.Option>
                          <Select.Option value="hourly">Каждый час</Select.Option>
                          <Select.Option value="daily">Ежедневно</Select.Option>
                          <Select.Option value="weekly">Еженедельно</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="max_products_per_sync"
                        label="Максимум товаров за синхронизацию"
                        extra="Ограничение количества товаров за один раз"
                      >
                        <InputNumber
                          min={100}
                          max={10000}
                          step={100}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="is_active"
                    label="Активна"
                    valuePropName="checked"
                    extra="Включить/выключить интеграцию"
                  >
                    <Switch />
                  </Form.Item>

                  <Space>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={saveRS24Integration}
                    >
                      Сохранить настройки
                    </Button>
                    <Button
                      icon={<SyncOutlined />}
                      onClick={() => testRS24Connection()}
                      loading={testing}
                    >
                      Тест подключения
                    </Button>
                    <Button
                      type="default"
                      icon={<SyncOutlined />}
                      onClick={() => startSync('rs24')}
                      loading={loading}
                    >
                      Запустить синхронизацию
                    </Button>
                    <Button
                      type="default"
                      onClick={() => navigate('/integrations/rs24/wizard')}
                    >
                      Открыть мастер настройки RS24
                    </Button>
                  </Space>
                </Form>
              </Col>

              <Col span={8}>
                <Card title="Информация о RS24" size="small">
                  <Paragraph>
                    <strong>Русский Свет (RS24)</strong> - один из крупнейших поставщиков светотехники в России.
                  </Paragraph>

                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="API Документация">
                      <a href="https://cdis.russvet.ru/rs" target="_blank" rel="noopener noreferrer">
                        <LinkOutlined /> Открыть документацию
                      </a>
                    </Descriptions.Item>
                    <Descriptions.Item label="Поддерживаемые операции">
                      <Tag color="green">Товары</Tag>
                      <Tag color="green">Цены</Tag>
                      <Tag color="green">Остатки</Tag>
                      <Tag color="green">Категории</Tag>
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider />

                  <Title level={5}>Статус интеграции</Title>
                  {integrations.rs24 ? (
                    <div>
                      <Tag color={integrations.rs24.is_active ? 'green' : 'red'}>
                        {integrations.rs24.is_active ? 'Активна' : 'Неактивна'}
                      </Tag>
                      <p>Последняя синхронизация: {integrations.rs24.last_sync || 'Не было'}</p>
                    </div>
                  ) : (
                    <Tag color="orange">Не настроена</Tag>
                  )}
                </Card>
              </Col>
            </Row>
          </TabPane>

          {/* Яндекс.Маркет Интеграция */}
          <TabPane tab="Яндекс.Маркет" key="yandex">
            <Row gutter={24}>
              <Col span={16}>
                <Form
                  form={yandexForm}
                  layout="vertical"
                  onFinish={saveYandexIntegration}
                >
                  <Title level={4}>Настройки подключения к Яндекс.Маркет</Title>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="business_id"
                        label="Business ID"
                        rules={[{ required: true, message: 'Введите Business ID' }]}
                        extra="Идентификатор бизнес-аккаунта"
                      >
                        <Input placeholder="Введите Business ID" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="campaign_id"
                        label="Campaign ID"
                        rules={[{ required: true, message: 'Введите Campaign ID' }]}
                        extra="Идентификатор кампании"
                      >
                        <Input placeholder="Введите Campaign ID" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="api_key"
                        label="API Ключ"
                        rules={[{ required: true, message: 'Введите API ключ' }]}
                        extra="Основной ключ для доступа к API"
                      >
                        <Input.Password placeholder="Введите API ключ" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="oauth_token"
                        label="OAuth Токен"
                        extra="Токен для OAuth аутентификации (опционально)"
                      >
                        <Input.Password placeholder="Введите OAuth токен" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="sync_frequency"
                        label="Частота синхронизации"
                        extra="Как часто обновлять данные"
                      >
                        <Select>
                          <Select.Option value="manual">Вручную</Select.Option>
                          <Select.Option value="hourly">Каждый час</Select.Option>
                          <Select.Option value="daily">Ежедневно</Select.Option>
                          <Select.Option value="weekly">Еженедельно</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="is_active"
                        label="Активна"
                        valuePropName="checked"
                        extra="Включить/выключить интеграцию"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="auto_update_prices"
                        label="Автообновление цен"
                        valuePropName="checked"
                        extra="Автоматически обновлять цены товаров"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="auto_update_stocks"
                        label="Автообновление остатков"
                        valuePropName="checked"
                        extra="Автоматически обновлять остатки товаров"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Space>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={saveYandexIntegration}
                    >
                      Сохранить настройки
                    </Button>
                    <Button
                      icon={<SyncOutlined />}
                      onClick={() => testYandexConnection()}
                      loading={testing}
                    >
                      Тест подключения
                    </Button>
                    <Button
                      type="default"
                      icon={<SyncOutlined />}
                      onClick={() => startSync('yandex')}
                      loading={loading}
                    >
                      Запустить синхронизацию
                    </Button>
                  </Space>
                </Form>
              </Col>

              <Col span={8}>
                <Card title="Информация о Яндекс.Маркет" size="small">
                  <Paragraph>
                    <strong>Яндекс.Маркет</strong> - крупнейший маркетплейс в России с развитой API.
                  </Paragraph>

                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="API Документация">
                      <a href="https://yandex.ru/dev/market/partner-api/" target="_blank" rel="noopener noreferrer">
                        <LinkOutlined /> Открыть документацию
                      </a>
                    </Descriptions.Item>
                    <Descriptions.Item label="Поддерживаемые операции">
                      <Tag color="green">Товары</Tag>
                      <Tag color="green">Цены</Tag>
                      <Tag color="green">Остатки</Tag>
                      <Tag color="green">Заказы</Tag>
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider />

                  <Title level={5}>Статус интеграции</Title>
                  {integrations.yandex ? (
                    <div>
                      <Tag color={integrations.yandex.is_active ? 'green' : 'red'}>
                        {integrations.yandex.is_active ? 'Активна' : 'Неактивна'}
                      </Tag>
                      <p>Последняя синхронизация: {integrations.yandex.last_sync || 'Не было'}</p>
                    </div>
                  ) : (
                    <Tag color="orange">Не настроена</Tag>
                  )}
                </Card>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default IntegrationsPage;
