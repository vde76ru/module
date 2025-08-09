import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Modal, Form, Input, Select,
    InputNumber, Space, Tag, Switch, Tabs, message,
    Collapse, Alert, Divider, Tooltip, Popconfirm
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    SettingOutlined, ApiOutlined, CheckCircleOutlined,
    CloseCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import axios from 'utils/axios';

const { TabPane } = Tabs;
const { Panel } = Collapse;

const MarketplaceSettings = () => {
    const [marketplaces, setMarketplaces] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingMarketplace, setEditingMarketplace] = useState(null);
    const [testingConnection, setTestingConnection] = useState({});
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    // Используем единый axios-инстанс с интерсепторами
    const api = axios;

    // Загрузка списка маркетплейсов
    useEffect(() => {
        loadMarketplaces();
    }, []);

    const loadMarketplaces = async () => {
        setLoading(true);
        try {
            const response = await api.get('/marketplaces');
            setMarketplaces(response.data.data);
        } catch (error) {
            message.error('Ошибка загрузки маркетплейсов');
        } finally {
            setLoading(false);
        }
    };

    // Тестирование подключения
    const testConnection = async (marketplaceId) => {
        setTestingConnection({ ...testingConnection, [marketplaceId]: true });
        try {
            const response = await api.post(`/marketplaces/${marketplaceId}/test`);
            if (response.data.success) {
                message.success('Подключение успешно установлено');
            } else {
                message.error(response.data.message || 'Ошибка подключения');
            }
        } catch (error) {
            message.error('Не удалось проверить подключение');
        } finally {
            setTestingConnection({ ...testingConnection, [marketplaceId]: false });
        }
    };

    // Компонент настройки комиссий
    const CommissionSettings = ({ marketplace, onUpdate }) => {
        const [commissions, setCommissions] = useState(marketplace?.commission_rules || { default: 15 });
        const [editMode, setEditMode] = useState(false);

        const categories = [
            { key: 'electronics', name: 'Электрика', icon: '⚡' },
            { key: 'plumbing', name: 'Сантехника', icon: '🚿' },
            { key: 'lighting', name: 'Освещение', icon: '💡' },
            { key: 'cables', name: 'Кабельная продукция', icon: '🔌' },
            { key: 'automation', name: 'Автоматика', icon: '🔧' },
            { key: 'tools', name: 'Инструменты', icon: '🛠' }
        ];

        const handleSave = async () => {
            try {
                await api.put(`/marketplaces/${marketplace.id}/commissions`, {
                    commission_rules: commissions
                });
                message.success('Комиссии обновлены');
                setEditMode(false);
                onUpdate();
            } catch (error) {
                message.error('Ошибка сохранения комиссий');
            }
        };

        return (
            <Card
                title="Настройка комиссий по категориям"
                extra={
                    <Space>
                        {editMode && (
                            <Button type="primary" onClick={handleSave}>
                                Сохранить
                            </Button>
                        )}
                        <Button onClick={() => setEditMode(!editMode)}>
                            {editMode ? 'Отмена' : 'Редактировать'}
                        </Button>
                    </Space>
                }
            >
                <Alert
                    message={`Базовая комиссия: ${commissions.default || 15}%`}
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />

                {editMode && (
                    <Form.Item label="Базовая комиссия (%)">
                        <InputNumber
                            min={0}
                            max={100}
                            value={commissions.default}
                            onChange={(value) => setCommissions({ ...commissions, default: value })}
                            style={{ width: 120 }}
                        />
                    </Form.Item>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {categories.map(category => (
                        <Card key={category.key} size="small">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Space>
                                    <span style={{ fontSize: 24 }}>{category.icon}</span>
                                    <span>{category.name}</span>
                                </Space>
                                {editMode ? (
                                    <InputNumber
                                        min={0}
                                        max={100}
                                        value={commissions.categories?.[category.key] || commissions.default || 15}
                                        onChange={(value) => {
                                            setCommissions(prev => ({
                                                ...prev,
                                                categories: {
                                                    ...prev.categories,
                                                    [category.key]: value
                                                }
                                            }));
                                        }}
                                        formatter={value => `${value}%`}
                                        parser={value => value.replace('%', '')}
                                    />
                                ) : (
                                    <Tag color="blue">
                                        {commissions.categories?.[category.key] || commissions.default || 15}%
                                    </Tag>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            </Card>
        );
    };

    // Компонент настройки складов
    const WarehouseSettings = ({ marketplace, onUpdate }) => {
        const [warehouses, setWarehouses] = useState([]);
        const [loading, setLoading] = useState(false);

        useEffect(() => {
            loadWarehouses();
        }, [marketplace]);

        const loadWarehouses = async () => {
            setLoading(true);
            try {
                const response = await api.get(`/marketplaces/${marketplace.id}/warehouses`);
                setWarehouses(response.data.data);
            } catch (error) {
                message.error('Ошибка загрузки складов');
            } finally {
                setLoading(false);
            }
        };

        const toggleWarehouse = async (warehouseId, enabled) => {
            try {
                await api.put(`/marketplaces/${marketplace.id}/warehouses/${warehouseId}`, {
                    enabled
                });
                message.success('Настройки склада обновлены');
                loadWarehouses();
            } catch (error) {
                message.error('Ошибка обновления настроек склада');
            }
        };

        return (
            <Card title="Управление складами" loading={loading}>
                <Table
                    dataSource={warehouses}
                    rowKey="id"
                    pagination={false}
                    columns={[
                        {
                            title: 'Название',
                            dataIndex: 'name',
                            key: 'name'
                        },
                        {
                            title: 'Код',
                            dataIndex: 'code',
                            key: 'code'
                        },
                        {
                            title: 'Адрес',
                            dataIndex: 'address',
                            key: 'address'
                        },
                        {
                            title: 'Активен',
                            dataIndex: 'enabled',
                            key: 'enabled',
                            render: (enabled, record) => (
                                <Switch
                                    checked={enabled}
                                    onChange={(checked) => toggleWarehouse(record.id, checked)}
                                />
                            )
                        }
                    ]}
                />
            </Card>
        );
    };

    // Форма маркетплейса
    const MarketplaceForm = () => {
        const marketplaceTypes = {
            ozon: {
                name: 'Ozon',
                fields: ['client_id', 'api_key'],
                docs: 'https://docs.ozon.ru/api/seller'
            },
            yandex: {
                name: 'Яндекс.Маркет',
                fields: ['campaign_id', 'oauth_token'],
                docs: 'https://yandex.ru/dev/market/partner-api'
            },
            wildberries: {
                name: 'Wildberries',
                fields: ['api_key'],
                docs: 'https://openapi.wildberries.ru'
            },
            megamarket: {
                name: 'Мегамаркет',
                fields: ['merchant_id', 'api_key'],
                docs: 'https://api.megamarket.ru/docs'
            }
        };

        const [selectedType, setSelectedType] = useState(
            editingMarketplace?.api_type || null
        );

        return (
            <Form
                form={form}
                layout="vertical"
                initialValues={editingMarketplace}
                onFinish={async (values) => {
                    try {
                        if (editingMarketplace) {
                            await api.put(`/marketplaces/${editingMarketplace.id}`, values);
                            message.success('Маркетплейс обновлен');
                        } else {
                            await api.post('/marketplaces', values);
                            message.success('Маркетплейс добавлен');
                        }
                        setModalVisible(false);
                        loadMarketplaces();
                    } catch (error) {
                        message.error('Ошибка сохранения');
                    }
                }}
            >
                <Form.Item name="api_type" label="Тип маркетплейса" rules={[{ required: true }]}>
                    <Select
                        placeholder="Выберите маркетплейс"
                        onChange={setSelectedType}
                    >
                        {Object.entries(marketplaceTypes).map(([key, mp]) => (
                            <Select.Option key={key} value={key}>
                                {mp.name}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item name="name" label="Название" rules={[{ required: true }]}>
                    <Input placeholder="Мой магазин на Ozon" />
                </Form.Item>

                {selectedType && (
                    <>
                        <Alert
                            message="Параметры API"
                            description={
                                <a href={marketplaceTypes[selectedType].docs} target="_blank" rel="noopener noreferrer">
                                    Документация по получению ключей →
                                </a>
                            }
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />

                        {marketplaceTypes[selectedType].fields.includes('client_id') && (
                            <Form.Item
                                name={['api_config', 'client_id']}
                                label="Client ID"
                                rules={[{ required: true }]}
                            >
                                <Input placeholder="Введите Client ID" />
                            </Form.Item>
                        )}

                        {marketplaceTypes[selectedType].fields.includes('api_key') && (
                            <Form.Item
                                name={['api_config', 'api_key']}
                                label="API Key"
                                rules={[{ required: true }]}
                            >
                                <Input.Password placeholder="Введите API ключ" />
                            </Form.Item>
                        )}

                        {marketplaceTypes[selectedType].fields.includes('campaign_id') && (
                            <Form.Item
                                name={['api_config', 'campaign_id']}
                                label="Campaign ID"
                                rules={[{ required: true }]}
                            >
                                <Input placeholder="Введите Campaign ID" />
                            </Form.Item>
                        )}

                        {marketplaceTypes[selectedType].fields.includes('oauth_token') && (
                            <Form.Item
                                name={['api_config', 'oauth_token']}
                                label="OAuth Token"
                                rules={[{ required: true }]}
                            >
                                <Input.Password placeholder="Введите OAuth токен" />
                            </Form.Item>
                        )}

                        {marketplaceTypes[selectedType].fields.includes('merchant_id') && (
                            <Form.Item
                                name={['api_config', 'merchant_id']}
                                label="Merchant ID"
                                rules={[{ required: true }]}
                            >
                                <Input placeholder="Введите Merchant ID" />
                            </Form.Item>
                        )}
                    </>
                )}

                <Divider>Настройки комиссий</Divider>

                <Form.Item
                    name={['commission_rules', 'default']}
                    label="Базовая комиссия (%)"
                    rules={[{ required: true }]}
                    initialValue={15}
                >
                    <InputNumber
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                        formatter={value => `${value}%`}
                        parser={value => value.replace('%', '')}
                    />
                </Form.Item>

                <Form.Item>
                    <Space>
                        <Button type="primary" htmlType="submit">
                            {editingMarketplace ? 'Обновить' : 'Добавить'}
                        </Button>
                        <Button onClick={() => setModalVisible(false)}>
                            Отмена
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        );
    };

    // Колонки таблицы
    const columns = [
        {
            title: 'Название',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <Space>
                    <ApiOutlined />
                    <strong>{text}</strong>
                    {record.is_active && <Tag color="success">Активен</Tag>}
                </Space>
            )
        },
        {
            title: 'Тип',
            dataIndex: 'api_type',
            key: 'api_type',
            render: (type) => {
                const typeNames = {
                    ozon: 'Ozon',
                    yandex: 'Яндекс.Маркет',
                    wildberries: 'Wildberries',
                    megamarket: 'Мегамаркет'
                };
                return <Tag color="blue">{typeNames[type] || type}</Tag>;
            }
        },
        {
            title: 'Комиссия',
            dataIndex: 'commission_rules',
            key: 'commission',
            render: (rules) => `${rules?.default || 15}%`
        },
        {
            title: 'Статус подключения',
            key: 'connection',
            render: (_, record) => (
                <Button
                    size="small"
                    loading={testingConnection[record.id]}
                    onClick={() => testConnection(record.id)}
                >
                    Проверить
                </Button>
            )
        },
        {
            title: 'Действия',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Настройки">
                        <Button
                            icon={<SettingOutlined />}
                            onClick={() => {
                                setEditingMarketplace(record);
                                setModalVisible(true);
                            }}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Удалить маркетплейс?"
                        onConfirm={async () => {
                            try {
                                await api.delete(`/marketplaces/${record.id}`);
                                message.success('Маркетплейс удален');
                                loadMarketplaces();
                            } catch (error) {
                                message.error('Ошибка удаления');
                            }
                        }}
                    >
                        <Button danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Card
                title="Управление маркетплейсами"
                extra={
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            setEditingMarketplace(null);
                            form.resetFields();
                            setModalVisible(true);
                        }}
                    >
                        Добавить маркетплейс
                    </Button>
                }
            >
                <Table
                    columns={columns}
                    dataSource={marketplaces}
                    rowKey="id"
                    loading={loading}
                    expandable={{
                        expandedRowRender: (record) => (
                            <Tabs defaultActiveKey="commissions">
                                <TabPane tab="Комиссии" key="commissions">
                                    <CommissionSettings
                                        marketplace={record}
                                        onUpdate={loadMarketplaces}
                                    />
                                </TabPane>
                                <TabPane tab="Склады" key="warehouses">
                                    <WarehouseSettings
                                        marketplace={record}
                                        onUpdate={loadMarketplaces}
                                    />
                                </TabPane>
                                <TabPane tab="Настройки API" key="api">
                                    <Card>
                                        <pre>{JSON.stringify(record.api_config, null, 2)}</pre>
                                    </Card>
                                </TabPane>
                            </Tabs>
                        )
                    }}
                />
            </Card>

            <Modal
                title={editingMarketplace ? 'Редактирование маркетплейса' : 'Добавление маркетплейса'}
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={600}
            >
                <MarketplaceForm />
            </Modal>
        </div>
    );
};

export default MarketplaceSettings;
