// Модуль: Warehouse Manager Page
// Файл: frontend/src/pages/Warehouses/WarehouseManager.jsx
// Основание: Требования пользователя, Блок 1
// Действие: Интерфейс для создания, редактирования и управления складами

import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Space, Modal, Form, Input, Select,
    Tag, Tabs, Drawer, Tree, message, Popconfirm, Badge,
    Row, Col, Statistic, Alert, Transfer, InputNumber,
    Tooltip, Empty, Spin, Divider
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    ShopOutlined, CloudOutlined, ApartmentOutlined,
    SwapOutlined, InfoCircleOutlined, ReloadOutlined,
    ArrowRightOutlined, WarningOutlined
} from '@ant-design/icons';
import axios from 'utils/axios';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const WarehouseManager = () => {
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState(null);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [form] = Form.useForm();
    const [transferForm] = Form.useForm();

    // Состояние для управления компонентами мульти-склада
    const [availableWarehouses, setAvailableWarehouses] = useState([]);
    const [selectedComponents, setSelectedComponents] = useState([]);
    const [isComponentModalVisible, setIsComponentModalVisible] = useState(false);

    // Статистика
    const [warehouseStats, setWarehouseStats] = useState({});
    const [movements, setMovements] = useState([]);

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/warehouses');
            setWarehouses(response.data);
        } catch (error) {
            message.error('Ошибка загрузки складов');
        } finally {
            setLoading(false);
        }
    };

    const fetchWarehouseDetails = async (warehouseId) => {
        try {
            const response = await axios.get(`/api/warehouses/${warehouseId}`);
            setSelectedWarehouse(response.data);
            setWarehouseStats(response.data.statistics || {});

            if (response.data.type === 'multi') {
                setSelectedComponents(response.data.components?.map(c => c.source_warehouse_id) || []);
            }

            // Загружаем историю движений
            const movementsResponse = await axios.get(`/api/warehouses/${warehouseId}/movements`);
            setMovements(movementsResponse.data);

        } catch (error) {
            message.error('Ошибка загрузки деталей склада');
        }
    };

    const handleCreateWarehouse = () => {
        setEditingWarehouse(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEditWarehouse = (warehouse) => {
        setEditingWarehouse(warehouse);
        form.setFieldsValue(warehouse);
        setIsModalVisible(true);
    };

    const handleSaveWarehouse = async (values) => {
        try {
            if (editingWarehouse) {
                await axios.put(`/api/warehouses/${editingWarehouse.id}`, values);
                message.success('Склад обновлен');
            } else {
                await axios.post('/api/warehouses', values);
                message.success('Склад создан');
            }
            setIsModalVisible(false);
            fetchWarehouses();
        } catch (error) {
            message.error('Ошибка сохранения склада');
        }
    };

    const handleDeleteWarehouse = async (warehouseId) => {
        try {
            await axios.delete(`/api/warehouses/${warehouseId}`);
            message.success('Склад удален');
            fetchWarehouses();
        } catch (error) {
            message.error('Ошибка удаления склада');
        }
    };

    const handleManageComponents = async (warehouse) => {
        setSelectedWarehouse(warehouse);

        // Загружаем доступные склады для добавления
        const response = await axios.get('/warehouses', {
            params: { type: 'physical,virtual' }
        });

        const available = response.data.filter(w =>
            w.id !== warehouse.id &&
            w.type !== 'multi'
        );

        setAvailableWarehouses(available);

        // Загружаем текущие компоненты
        const detailsResponse = await axios.get(`/api/warehouses/${warehouse.id}`);
        setSelectedComponents(detailsResponse.data.components?.map(c => c.source_warehouse_id) || []);

        setIsComponentModalVisible(true);
    };

    const handleSaveComponents = async () => {
        try {
            // Получаем текущие компоненты
            const currentResponse = await axios.get(`/api/warehouses/${selectedWarehouse.id}`);
            const currentComponents = currentResponse.data.components?.map(c => c.source_warehouse_id) || [];

            // Определяем, какие добавить и какие удалить
            const toAdd = selectedComponents.filter(id => !currentComponents.includes(id));
            const toRemove = currentComponents.filter(id => !selectedComponents.includes(id));

            // Добавляем новые компоненты
            for (const warehouseId of toAdd) {
                await axios.post(`/api/warehouses/${selectedWarehouse.id}/components`, {
                    source_warehouse_id: warehouseId,
                    priority: 0
                });
            }

            // Удаляем ненужные компоненты
            for (const warehouseId of toRemove) {
                await axios.delete(`/api/warehouses/${selectedWarehouse.id}/components/${warehouseId}`);
            }

            message.success('Состав мульти-склада обновлен');
            setIsComponentModalVisible(false);
            fetchWarehouses();

        } catch (error) {
            message.error('Ошибка обновления состава склада');
        }
    };

    const handleProductTransfer = async (values) => {
        try {
            await axios.post('/api/warehouses/transfer', values);
            message.success('Товар перемещен');
            transferForm.resetFields();
            setIsDrawerVisible(false);
            fetchWarehouseDetails(selectedWarehouse.id);
        } catch (error) {
            message.error('Ошибка перемещения товара');
        }
    };

    const getWarehouseIcon = (type) => {
        switch (type) {
            case 'physical':
                return <ShopOutlined />;
            case 'virtual':
                return <CloudOutlined />;
            case 'multi':
                return <ApartmentOutlined />;
            default:
                return <ShopOutlined />;
        }
    };

    const getWarehouseTypeTag = (type) => {
        const config = {
            physical: { color: 'blue', text: 'Физический' },
            virtual: { color: 'green', text: 'Виртуальный' },
            multi: { color: 'purple', text: 'Мульти-склад' }
        };
        const { color, text } = config[type] || { color: 'default', text: type };
        return <Tag color={color}>{text}</Tag>;
    };

    const columns = [
        {
            title: 'Название',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <Space>
                    {getWarehouseIcon(record.type)}
                    <a onClick={() => {
                        setSelectedWarehouse(record);
                        fetchWarehouseDetails(record.id);
                        setIsDrawerVisible(true);
                    }}>
                        {text}
                    </a>
                </Space>
            )
        },
        {
            title: 'Тип',
            dataIndex: 'type',
            key: 'type',
            render: (type) => getWarehouseTypeTag(type)
        },
        {
            title: 'Товаров',
            dataIndex: 'product_count',
            key: 'product_count',
            render: (count) => <Badge count={count} showZero style={{ backgroundColor: '#52c41a' }} />
        },
        {
            title: 'Всего единиц',
            dataIndex: 'total_items',
            key: 'total_items',
            render: (total) => total?.toLocaleString() || 0
        },
        {
            title: 'Приоритет',
            dataIndex: 'priority',
            key: 'priority',
            render: (priority) => (
                <Tag color={priority > 5 ? 'gold' : 'default'}>
                    {priority}
                </Tag>
            )
        },
        {
            title: 'Статус',
            dataIndex: 'is_active',
            key: 'is_active',
            render: (active) => (
                <Tag color={active ? 'green' : 'red'}>
                    {active ? 'Активен' : 'Неактивен'}
                </Tag>
            )
        },
        {
            title: 'Действия',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Редактировать">
                        <Button
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => handleEditWarehouse(record)}
                        />
                    </Tooltip>
                    {record.type === 'multi' && (
                        <Tooltip title="Управление составом">
                            <Button
                                icon={<ApartmentOutlined />}
                                size="small"
                                onClick={() => handleManageComponents(record)}
                            />
                        </Tooltip>
                    )}
                    <Popconfirm
                        title="Удалить склад?"
                        onConfirm={() => handleDeleteWarehouse(record.id)}
                        disabled={record.product_count > 0}
                    >
                        <Button
                            icon={<DeleteOutlined />}
                            size="small"
                            danger
                            disabled={record.product_count > 0}
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const movementColumns = [
        {
            title: 'Дата',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date) => new Date(date).toLocaleString()
        },
        {
            title: 'Товар',
            dataIndex: 'product_name',
            key: 'product_name'
        },
        {
            title: 'Тип операции',
            dataIndex: 'movement_type',
            key: 'movement_type',
            render: (type) => {
                const types = {
                    transfer: { text: 'Перемещение', color: 'blue' },
                    sale: { text: 'Продажа', color: 'green' },
                    purchase: { text: 'Поступление', color: 'cyan' },
                    return: { text: 'Возврат', color: 'orange' },
                    adjustment: { text: 'Корректировка', color: 'purple' }
                };
                const config = types[type] || { text: type, color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            }
        },
        {
            title: 'Количество',
            dataIndex: 'quantity',
            key: 'quantity'
        },
        {
            title: 'Откуда',
            dataIndex: 'from_warehouse_name',
            key: 'from_warehouse_name',
            render: (text) => text || '-'
        },
        {
            title: 'Куда',
            dataIndex: 'to_warehouse_name',
            key: 'to_warehouse_name',
            render: (text) => text || '-'
        },
        {
            title: 'Причина',
            dataIndex: 'reason',
            key: 'reason',
            ellipsis: true
        }
    ];

    return (
        <div className="warehouse-manager">
            <div className="page-header">
                <h1>Управление складами</h1>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateWarehouse}
                >
                    Создать склад
                </Button>
            </div>

            <Card>
                <Table
                    columns={columns}
                    dataSource={warehouses}
                    rowKey="id"
                    loading={loading}
                />
            </Card>

            {/* Модальное окно создания/редактирования склада */}
            <Modal
                title={editingWarehouse ? 'Редактировать склад' : 'Создать склад'}
                visible={isModalVisible}
                onOk={() => form.submit()}
                onCancel={() => setIsModalVisible(false)}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSaveWarehouse}
                >
                    <Form.Item
                        name="name"
                        label="Название"
                        rules={[{ required: true, message: 'Введите название склада' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="type"
                        label="Тип склада"
                        rules={[{ required: true, message: 'Выберите тип склада' }]}
                    >
                        <Select disabled={!!editingWarehouse}>
                            <Option value="physical">
                                <Space>
                                    <ShopOutlined />
                                    Физический склад
                                </Space>
                            </Option>
                            <Option value="virtual">
                                <Space>
                                    <CloudOutlined />
                                    Виртуальный склад
                                </Space>
                            </Option>
                            <Option value="multi">
                                <Space>
                                    <ApartmentOutlined />
                                    Мульти-склад
                                </Space>
                            </Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Описание"
                    >
                        <TextArea rows={3} />
                    </Form.Item>

                    <Form.Item
                        name="address"
                        label="Адрес"
                    >
                        <TextArea rows={2} />
                    </Form.Item>

                    <Form.Item
                        name="priority"
                        label="Приоритет"
                        tooltip="Склады с более высоким приоритетом используются первыми при продаже"
                    >
                        <InputNumber min={0} max={100} />
                    </Form.Item>

                    <Form.Item
                        name="is_active"
                        label="Статус"
                        valuePropName="checked"
                        initialValue={true}
                    >
                        <Select>
                            <Option value={true}>Активен</Option>
                            <Option value={false}>Неактивен</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Модальное окно управления компонентами мульти-склада */}
            <Modal
                title={`Управление составом мульти-склада: ${selectedWarehouse?.name}`}
                visible={isComponentModalVisible}
                onOk={handleSaveComponents}
                onCancel={() => setIsComponentModalVisible(false)}
                width={700}
            >
                <Alert
                    message="Выберите склады, которые будут входить в состав мульти-склада"
                    description="Остатки на мульти-складе будут автоматически суммироваться из выбранных складов"
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />

                <Transfer
                    dataSource={availableWarehouses}
                    titles={['Доступные склады', 'Компоненты мульти-склада']}
                    targetKeys={selectedComponents}
                    onChange={setSelectedComponents}
                    render={item => (
                        <Space>
                            {getWarehouseIcon(item.type)}
                            {item.name}
                        </Space>
                    )}
                    rowKey={item => item.id}
                    listStyle={{
                        width: 300,
                        height: 400
                    }}
                />
            </Modal>

            {/* Drawer с детальной информацией о складе */}
            <Drawer
                title={
                    <Space>
                        {selectedWarehouse && getWarehouseIcon(selectedWarehouse.type)}
                        {selectedWarehouse?.name}
                    </Space>
                }
                placement="right"
                width={800}
                onClose={() => setIsDrawerVisible(false)}
                visible={isDrawerVisible}
                extra={
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => fetchWarehouseDetails(selectedWarehouse.id)}>
                            Обновить
                        </Button>
                        <Button type="primary" icon={<SwapOutlined />} onClick={() => {
                            transferForm.resetFields();
                            Modal.confirm({
                                title: 'Перемещение товара',
                                width: 600,
                                content: (
                                    <Form
                                        form={transferForm}
                                        layout="vertical"
                                        style={{ marginTop: 20 }}
                                    >
                                        <Form.Item
                                            name="product_id"
                                            label="Товар"
                                            rules={[{ required: true }]}
                                        >
                                            <Input placeholder="ID товара" />
                                        </Form.Item>
                                        <Form.Item
                                            name="from_warehouse_id"
                                            label="Со склада"
                                            rules={[{ required: true }]}
                                            initialValue={selectedWarehouse.id}
                                        >
                                            <Select>
                                                {warehouses.map(w => (
                                                    <Option key={w.id} value={w.id}>{w.name}</Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                        <Form.Item
                                            name="to_warehouse_id"
                                            label="На склад"
                                            rules={[{ required: true }]}
                                        >
                                            <Select>
                                                {warehouses.filter(w => w.id !== selectedWarehouse.id).map(w => (
                                                    <Option key={w.id} value={w.id}>{w.name}</Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                        <Form.Item
                                            name="quantity"
                                            label="Количество"
                                            rules={[{ required: true }]}
                                        >
                                            <InputNumber min={1} style={{ width: '100%' }} />
                                        </Form.Item>
                                        <Form.Item
                                            name="reason"
                                            label="Причина"
                                        >
                                            <TextArea rows={2} />
                                        </Form.Item>
                                    </Form>
                                ),
                                onOk: () => {
                                    transferForm.validateFields().then(values => {
                                        handleProductTransfer(values);
                                    });
                                }
                            });
                        }}>
                            Переместить товар
                        </Button>
                    </Space>
                }
            >
                {selectedWarehouse && (
                    <Tabs defaultActiveKey="1">
                        <TabPane tab="Информация" key="1">
                            <Row gutter={[16, 16]}>
                                <Col span={8}>
                                    <Card>
                                        <Statistic
                                            title="Уникальных товаров"
                                            value={warehouseStats.unique_products || 0}
                                            prefix={<ShopOutlined />}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card>
                                        <Statistic
                                            title="Всего единиц"
                                            value={warehouseStats.total_quantity || 0}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card>
                                        <Statistic
                                            title="Общая стоимость"
                                            value={warehouseStats.total_value || 0}
                                            prefix="₽"
                                            precision={2}
                                        />
                                    </Card>
                                </Col>
                            </Row>

                            <Divider />

                            <h3>Основная информация</h3>
                            <p><strong>Тип:</strong> {getWarehouseTypeTag(selectedWarehouse.type)}</p>
                            <p><strong>Описание:</strong> {selectedWarehouse.description || '-'}</p>
                            <p><strong>Адрес:</strong> {selectedWarehouse.address || '-'}</p>
                            <p><strong>Приоритет:</strong> {selectedWarehouse.priority}</p>
                            <p><strong>Статус:</strong> {selectedWarehouse.is_active ?
                                <Tag color="green">Активен</Tag> :
                                <Tag color="red">Неактивен</Tag>
                            }</p>

                            {selectedWarehouse.type === 'multi' && selectedWarehouse.components && (
                                <>
                                    <Divider />
                                    <h3>Компоненты мульти-склада</h3>
                                    <Table
                                        dataSource={selectedWarehouse.components}
                                        columns={[
                                            {
                                                title: 'Склад',
                                                dataIndex: 'source_warehouse_name',
                                                key: 'source_warehouse_name'
                                            },
                                            {
                                                title: 'Тип',
                                                dataIndex: 'source_warehouse_type',
                                                key: 'source_warehouse_type',
                                                render: (type) => getWarehouseTypeTag(type)
                                            },
                                            {
                                                title: 'Товаров',
                                                dataIndex: 'product_count',
                                                key: 'product_count'
                                            },
                                            {
                                                title: 'Единиц',
                                                dataIndex: 'total_quantity',
                                                key: 'total_quantity'
                                            }
                                        ]}
                                        rowKey="id"
                                        pagination={false}
                                        size="small"
                                    />
                                </>
                            )}
                        </TabPane>

                        <TabPane tab="История движений" key="2">
                            <Table
                                dataSource={movements}
                                columns={movementColumns}
                                rowKey="id"
                                size="small"
                            />
                        </TabPane>
                    </Tabs>
                )}
            </Drawer>
        </div>
    );
};

export default WarehouseManager;
