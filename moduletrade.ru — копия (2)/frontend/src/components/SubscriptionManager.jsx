import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Button, Tag, Progress, Statistic,
  Alert, Modal, message, Descriptions, Badge, Space,
  Table, Timeline
} from 'antd';
import {
  CrownOutlined, CheckCircleOutlined, CloseCircleOutlined,
  RiseOutlined, FallOutlined, SyncOutlined
} from '@ant-design/icons';
import { loadStripe } from '@stripe/stripe-js';
import { api } from 'services';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const SubscriptionManager = () => {
  const [currentTariff, setCurrentTariff] = useState(null);
  const [availableTariffs, setAvailableTariffs] = useState([]);
  const [usage, setUsage] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [selectedTariff, setSelectedTariff] = useState(null);

  useEffect(() => {
    fetchUserData();
    fetchTariffs();
    fetchUsage();
    fetchTransactions();
  }, []);

  const fetchUserData = async () => {
    try {
      // Статистика использования
      await api.billing.getUsage().catch(() => null);
      // Информация о подписке
      const subscription = await api.billing.getSubscriptionInfo().catch(() => null);
      if (subscription) {
        setCurrentTariff({
          id: subscription?.tariff?.id,
          name: subscription?.tariff?.name,
          limits: subscription?.tariff?.limits,
          features: subscription?.tariff?.features,
          price: subscription?.tariff?.price,
          description: subscription?.tariff?.description,
          trial_days: subscription?.tariff?.trial_days,
          days_left_in_trial: subscription?.company?.days_left_in_trial,
          days_left_in_subscription: subscription?.company?.days_left_in_subscription,
          trial_ends_at: subscription?.company?.trial_ends_at,
        });
      }
    } catch (error) {
      message.error('Ошибка загрузки данных подписки');
    }
  };

  const fetchTariffs = async () => {
    try {
      const list = await api.billing.getTariffs();
      setAvailableTariffs(list || []);
    } catch (error) {
      message.error('Ошибка загрузки тарифов');
    }
  };

  const fetchUsage = async () => {
    try {
      const u = await api.billing.getUsage();
      setUsage(u || {});
    } catch (error) {
      message.error('Ошибка загрузки статистики использования');
    }
  };

  const fetchTransactions = async () => {
    try {
      const t = await api.billing.getTransactions({ limit: 10 });
      setTransactions(t?.items || t || []);
    } catch (error) {
      message.error('Ошибка загрузки транзакций');
    }
  };

  const handleUpgrade = async () => {
    if (!selectedTariff) return;

    setLoading(true);
    try {
      const stripe = await stripePromise;

      // Создаем сессию оплаты
      const response = await api.billing.createPaymentIntent?.(selectedTariff.id) || {};

      // Перенаправляем на Stripe Checkout
      // Для Payment Intent показываем клиентский секрет (дальше может быть Stripe Elements/Modal)
      if (response?.client_secret) {
        message.success('Платеж создан. Завершите оплату в открывшемся окне.');
        return;
      }
      const { error } = await stripe?.redirectToCheckout?.({ sessionId: response?.session_id });

      if (error) {
        message.error(error.message);
      }
    } catch (error) {
      message.error('Ошибка создания платежа');
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercent = (used, limit) => {
    if (!limit) return 0;
    return Math.round((used / limit) * 100);
  };

  const getUsageStatus = (percent) => {
    if (percent >= 90) return 'exception';
    if (percent >= 70) return 'normal';
    return 'success';
  };

  const tariffColumns = [
    {
      title: 'Функция',
      dataIndex: 'feature',
      key: 'feature'
    },
    {
      title: 'Текущий',
      dataIndex: 'current',
      key: 'current',
      render: (value) => value ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    },
    {
      title: 'Новый',
      dataIndex: 'new',
      key: 'new',
      render: (value) => value ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    }
  ];

  return (
    <div className="subscription-manager">
      {/* Текущий тариф и использование */}
      <Card title="Текущий тарифный план" className="mb-24">
        <Row gutter={24}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Тарифный план"
                value={currentTariff?.name || 'Бесплатный'}
                prefix={<CrownOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Следующее списание"
                value="15 февраля 2025"
                suffix="₽2,990"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Статус"
                value="Активен"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Использование ресурсов */}
      <Card title="Использование ресурсов" className="mb-24">
        <Row gutter={[24, 24]}>
          <Col span={8}>
            <h4>Товары</h4>
            <Progress
              percent={getUsagePercent(usage.products?.count || 0, usage.products?.limit)}
              status={getUsageStatus(getUsagePercent(usage.products?.count || 0, usage.products?.limit))}
            />
            <p>{usage.products?.count || 0} из {usage.products?.limit || '∞'}</p>
          </Col>
          <Col span={8}>
            <h4>Пользователи</h4>
            <Progress
              percent={getUsagePercent(usage.users?.count || 0, usage.users?.limit)}
              status={getUsageStatus(getUsagePercent(usage.users?.count || 0, usage.users?.limit))}
            />
            <p>{usage.users?.count || 0} из {usage.users?.limit || '∞'}</p>
          </Col>
          <Col span={8}>
            <h4>API вызовы</h4>
            <Progress
              percent={getUsagePercent(usage.api?.total_requests || 0, usage.api?.limit)}
              status={getUsageStatus(getUsagePercent(usage.api?.total_requests || 0, usage.api?.limit))}
            />
            <p>{usage.api?.total_requests || 0} из {usage.api?.limit || '∞'}</p>
          </Col>
        </Row>
        <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
          <Col span={8}>
            <h4>Хранилище</h4>
            <Progress
              percent={getUsagePercent(usage.storage?.used || 0, usage.storage?.limit)}
              status={getUsageStatus(getUsagePercent(usage.storage?.used || 0, usage.storage?.limit))}
            />
            <p>{Math.round((usage.storage?.used || 0) / (1024 * 1024))} МБ из {Math.round((usage.storage?.limit || 0) / (1024 * 1024)) || '∞'} МБ</p>
          </Col>
        </Row>
      </Card>

      {/* Доступные тарифы */}
      <Card title="Доступные тарифные планы" className="mb-24">
        <Row gutter={24}>
          {availableTariffs.map(tariff => (
            <Col span={8} key={tariff.id}>
              <Card
                hoverable
                className={currentTariff?.name === tariff.name ? 'current-tariff' : ''}
              >
                <h3>{tariff.name}</h3>
                <div className="price">
                  <span className="amount">₽{tariff.price.toLocaleString()}</span>
                  <span className="period">/месяц</span>
                </div>

                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Товары">
                    {tariff.limits.products || 'Без ограничений'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Маркетплейсы">
                    {tariff.limits.marketplaces || 'Без ограничений'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Заказы/месяц">
                    {tariff.limits.orders || 'Без ограничений'}
                  </Descriptions.Item>
                  <Descriptions.Item label="API вызовы">
                    {tariff.limits.api_calls || 'Без ограничений'}
                  </Descriptions.Item>
                </Descriptions>

                <div className="features">
                  {tariff.features.map(feature => (
                    <Tag key={feature} color="blue">{feature}</Tag>
                  ))}
                </div>

                {currentTariff?.name !== tariff.name && (
                  <Button
                    type="primary"
                    block
                    onClick={() => {
                      setSelectedTariff(tariff);
                      setUpgradeModalVisible(true);
                    }}
                  >
                    {tariff.price > (currentTariff?.price || 0) ? 'Повысить' : 'Понизить'}
                  </Button>
                )}

                {currentTariff?.name === tariff.name && (
                  <Badge status="success" text="Текущий тариф" />
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* История транзакций */}
      <Card title="История платежей">
        <Timeline>
          {transactions.map(transaction => (
            <Timeline.Item
              key={transaction.id}
              color={transaction.amount > 0 ? 'green' : 'red'}
            >
              <Row justify="space-between" align="middle">
                <Col>
                  <strong>{transaction.description}</strong>
                  <br />
                  <small>{new Date(transaction.created_at).toLocaleDateString()}</small>
                </Col>
                <Col>
                  <Statistic
                    value={Math.abs(transaction.amount)}
                    prefix={transaction.amount > 0 ? '+' : '-'}
                    suffix="₽"
                    valueStyle={{
                      color: transaction.amount > 0 ? '#3f8600' : '#cf1322',
                      fontSize: '16px'
                    }}
                  />
                </Col>
              </Row>
            </Timeline.Item>
          ))}
        </Timeline>

        <Button type="link" block>
          Показать все транзакции
        </Button>
      </Card>

      {/* Модальное окно изменения тарифа */}
      <Modal
        title="Изменение тарифного плана"
        visible={upgradeModalVisible}
        onOk={handleUpgrade}
        onCancel={() => {
          setUpgradeModalVisible(false);
          setSelectedTariff(null);
        }}
        confirmLoading={loading}
        width={700}
      >
        {selectedTariff && currentTariff && (
          <>
            <Alert
              message="Изменения вступят в силу немедленно"
              description="Оплата будет произведена с учетом оставшихся дней текущего периода"
              type="info"
              showIcon
              className="mb-16"
            />

            <Row gutter={24}>
              <Col span={12}>
                <Card title="Текущий план">
                  <h3>{currentTariff.name}</h3>
                  <p>₽{currentTariff.price}/месяц</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Новый план">
                  <h3>{selectedTariff.name}</h3>
                  <p>₽{selectedTariff.price}/месяц</p>
                </Card>
              </Col>
            </Row>

            <h4 className="mt-16">Сравнение возможностей:</h4>
            <Table
              dataSource={[
                {
                  feature: 'Количество товаров',
                  current: currentTariff.limits.products || '∞',
                  new: selectedTariff.limits.products || '∞'
                },
                {
                  feature: 'Маркетплейсы',
                  current: currentTariff.limits.marketplaces || '∞',
                  new: selectedTariff.limits.marketplaces || '∞'
                },
                {
                  feature: 'API доступ',
                  current: currentTariff.features.includes('api_access'),
                  new: selectedTariff.features.includes('api_access')
                },
                {
                  feature: 'YML фиды',
                  current: currentTariff.features.includes('yml_feed'),
                  new: selectedTariff.features.includes('yml_feed')
                }
              ]}
              columns={tariffColumns}
              pagination={false}
              size="small"
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default SubscriptionManager;
