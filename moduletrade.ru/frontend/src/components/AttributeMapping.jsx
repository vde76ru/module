import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
    InputNumber, Popconfirm, message, Tabs, Collapse, Switch,
    AutoComplete, Badge, Tooltip, Empty
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined,
    QuestionCircleOutlined, SettingOutlined, SwapOutlined
} from '@ant-design/icons';
import axios from 'utils/axios';

const { Panel } = Collapse;
const { TabPane } = Tabs;

const AttributeMapping = () => {
    const [attributes, setAttributes] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingMapping, setEditingMapping] = useState(null);
    const [form] = Form.useForm();

    // API клиент
    const api = axios.create({
        baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        }
    });

    // Загрузка данных
    useEffect(() => {
        loadAttributes();
        loadSuppliers();
    }, []);

    useEffect(() => {
        if (selectedSupplier) {
            loadMappings();
        }
    }, [selectedSupplier]);

    const loadAttributes = async () => {
        try {
            const response = await api.get('/attributes');
            setAttributes(response.data.data);
        } catch (error) {
            message.error('Ошибка загрузки атрибутов');
        }
    };

    const loadSuppliers = async () => {
        try {
            const response = await api.get('/suppliers');
            setSuppliers(response.data.data);
        } catch (error) {
            message.error('Ошибка загрузки поставщиков');
        }
    };

    const loadMappings = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/mapping/attributes?supplier_id=${selectedSupplier}`);
            setMappings(response.data.data);
        } catch (error) {
            message.error('Ошибка загрузки маппингов');
        } finally {
            setLoading(false);
        }
    };

    // Типы единиц измерения
    const unitTypes = {
        length: { name: 'Длина', units: ['мм', 'см', 'м', 'км'] },
        weight: { name: 'Вес', units: ['г', 'кг', 'т'] },
        volume: { name: 'Объем', units: ['мл', 'л', 'м³'] },
        power: { name: 'Мощность', units: ['Вт', 'кВт', 'МВт'] },
        voltage: { name: 'Напряжение', units: ['В', 'кВ'] },
        current: { name: 'Ток', units: ['мА', 'А'] },
        temperature: { name: 'Температура', units: ['°C', '°F', 'K'] },
        time: { name: 'Время', units: ['с', 'мин', 'ч', 'дн'] }
    };

    // Правила конвертации
    const conversionRules = {
        length: {
            'мм->см': 0.1,
            'мм->м': 0.001,
            'см->м': 0.01,
            'м->км': 0.001
        },
        weight: {
            'г->кг': 0.001,
            'кг->т': 0.001
        },
        volume: {
            'мл->л': 0.001,
            'л->м³': 0.001
        },
        power: {
            'Вт->кВт': 0.001,
            'кВт->МВт': 0.001
        }
    };

    // Колонки таблицы атрибутов
    const attributeColumns = [
        {
            title: 'Атрибут',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <Space>
                    <strong>{text}</strong>
                    {record.canonical_name && (
                        <Tag color="blue">{record.canonical_name}</Tag>
                    )}
                </Space>
            )
        },
        {
            title: 'Тип данных',
            dataIndex: 'data_type',
            key: 'data_type',
            render: (type) => {
                const typeColors = {
                    string: 'blue',
                    number: 'green',
                    boolean: 'orange',
                    enum: 'purple'
                };
                return <Tag color={typeColors[type] || 'default'}>{type}</Tag>;
            }
        },
        {
            title: 'Единица измерения',
            dataIndex: 'unit_type',
            key: 'unit_type',
            render: (unitType, record) => (
                unitType ? (
                    <Space>
                        <Tag>{unitTypes[unitType]?.name}</Tag>
                        <Tag color="green">{record.default_unit}</Tag>
                    </Space>
                ) : '-'
            )
        },
        {
            title: 'Маппинги',
            key: 'mappings',
            render: (_, record) => {
                const attributeMappings = mappings.filter(m => m.attribute_id === record.id);
                return (
                    <Space direction="vertical" style={{ width: '100%' }}>
                        {attributeMappings.map(mapping => (
                            <Tag
                                key={mapping.id}
                                closable
                                onClose={() => deleteMapping(mapping.id)}
                                color="success"
                            >
                                {mapping.source_name}
                                {mapping.unit_conversion && (
                                    <Tooltip title={`Коэффициент: ${mapping.unit_conversion.multiplier}`}>
                                        <SwapOutlined style={{ marginLeft: 4 }} />
                                    </Tooltip>
                                )}
                            </Tag>
                        ))}
                        <Button
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => showModal(record)}
                        >
                            Добавить синоним
                        </Button>
                    </Space>
                );
            }
        }
    ];

    // Модальное окно для добавления/редактирования маппинга
    const showModal = (attribute, mapping = null) => {
        setEditingMapping(mapping);
        form.resetFields();
        
        if (mapping) {
            form.setFieldsValue({
                source_name: mapping.source_name,
                unit_conversion: mapping.unit_conversion
            });
        }

        Modal.confirm({
            title: `Маппинг атрибута "${attribute.name}"`,
            width: 600,
            content: (
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item
                        name="source_name"
                        label="Название атрибута у поставщика"
                        rules={[{ required: true, message: 'Введите название атрибута' }]}
                    >
                        <AutoComplete
                            placeholder="Например: Световой поток, Мощность лампы"
                            options={getSuggestions(attribute)}
                        />
                    </Form.Item>

                    {attribute.unit_type && (
                        <Collapse defaultActiveKey={['conversion']}>
                            <Panel header="Настройки конвертации единиц" key="conversion">
                                <Form.Item
                                    name={['unit_conversion', 'enabled']}
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Switch checkedChildren="Вкл" unCheckedChildren="Выкл" />
                                    <span style={{ marginLeft: 8 }}>Требуется конвертация</span>
                                </Form.Item>

                                <Form.Item
                                    noStyle
                                    shouldUpdate={(prevValues, currentValues) =>
                                        prevValues?.unit_conversion?.enabled !== currentValues?.unit_conversion?.enabled
                                    }
                                >
                                    {({ getFieldValue }) =>
                                        getFieldValue(['unit_conversion', 'enabled']) && (
                                            <>
                                                <Form.Item
                                                    name={['unit_conversion', 'from_unit']}
                                                    label="Единица измерения поставщика"
                                                    rules={[{ required: true }]}
                                                >
                                                    <Select>
                                                        {unitTypes[attribute.unit_type]?.units.map(unit => (
                                                            <Select.Option key={unit} value={unit}>
                                                                {unit}
                                                            </Select.Option>
                                                        ))}
                                                    </Select>
                                                </Form.Item>

                                                <Form.Item
                                                    name={['unit_conversion', 'to_unit']}
                                                    label="Целевая единица измерения"
                                                    initialValue={attribute.default_unit}
                                                >
                                                    <Select disabled>
                                                        <Select.Option value={attribute.default_unit}>
                                                            {attribute.default_unit}
                                                        </Select.Option>
                                                    </Select>
                                                </Form.Item>

                                                <Form.Item
                                                    name={['unit_conversion', 'multiplier']}
                                                    label="Коэффициент конвертации"
                                                    rules={[{ required: true }]}
                                                    extra="Значение поставщика будет умножено на этот коэффициент"
                                                >
                                                    <InputNumber
                                                        style={{ width: '100%' }}
                                                        step={0.001}
                                                        placeholder="1.0"
                                                    />
                                                </Form.Item>
                                            </>
                                        )
                                    }
                                </Form.Item>
                            </Panel>
                        </Collapse>
                    )}

                    {attribute.data_type === 'enum' && (
                        <Form.Item
                            name="value_mappings"
                            label="Маппинг значений"
                            extra="Сопоставьте значения поставщика с системными"
                        >
                            <ValueMappingEditor
                                systemValues={attribute.allowed_values || []}
                            />
                        </Form.Item>
                    )}
                </Form>
            ),
            onOk: async () => {
                try {
                    const values = await form.validateFields();
                    
                    const data = {
                        attribute_id: attribute.id,
                        supplier_id: selectedSupplier,
                        source_name: values.source_name,
                        unit_conversion: values.unit_conversion?.enabled ? {
                            from_unit: values.unit_conversion.from_unit,
                            to_unit: attribute.default_unit,
                            multiplier: values.unit_conversion.multiplier
                        } : null,
                        value_mappings: values.value_mappings || null
                    };

                    if (editingMapping) {
                        await api.put(`/mapping/attributes/${editingMapping.id}`, data);
                        message.success('Маппинг обновлен');
                    } else {
                        await api.post('/mapping/attributes', data);
                        message.success('Маппинг добавлен');
                    }

                    loadMappings();
                } catch (error) {
                    if (error.errorFields) {
                        return Promise.reject();
                    }
                    message.error('Ошибка сохранения маппинга');
                }
            }
        });
    };

    // Удаление маппинга
    const deleteMapping = async (mappingId) => {
        try {
            await api.delete(`/mapping/attributes/${mappingId}`);
            message.success('Маппинг удален');
            loadMappings();
        } catch (error) {
            message.error('Ошибка удаления маппинга');
        }
    };

    // Автоматический маппинг
    const autoMapAttributes = async () => {
        Modal.confirm({
            title: 'Автоматический маппинг атрибутов',
            content: 'Система попытается автоматически сопоставить атрибуты на основе анализа названий и типов данных. Продолжить?',
            onOk: async () => {
                setLoading(true);
                try {
                    const response = await api.post('/mapping/attributes/auto', {
                        supplier_id: selectedSupplier
                    });

                    message.success(`Автоматически создано маппингов: ${response.data.created}`);
                    loadMappings();
                } catch (error) {
                    message.error('Ошибка автоматического маппинга');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    // Компонент для маппинга значений enum
    const ValueMappingEditor = ({ systemValues, value, onChange }) => {
        const [mappings, setMappings] = useState(value || {});

        const handleChange = (supplierValue, systemValue) => {
            const newMappings = { ...mappings };
            if (systemValue) {
                newMappings[supplierValue] = systemValue;
            } else {
                delete newMappings[supplierValue];
            }
            setMappings(newMappings);
            onChange?.(newMappings);
        };

        return (
            <div>
                <Space direction="vertical" style={{ width: '100%' }}>
                    {Object.entries(mappings).map(([supplierValue, systemValue]) => (
                        <Input.Group key={supplierValue} compact>
                            <Input
                                style={{ width: '45%' }}
                                value={supplierValue}
                                placeholder="Значение поставщика"
                            />
                            <Input
                                style={{ width: '10%', textAlign: 'center' }}
                                value="→"
                                disabled
                            />
                            <Select
                                style={{ width: '45%' }}
                                value={systemValue}
                                onChange={(val) => handleChange(supplierValue, val)}
                            >
                                {systemValues.map(v => (
                                    <Select.Option key={v} value={v}>{v}</Select.Option>
                                ))}
                            </Select>
                        </Input.Group>
                    ))}
                    <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => handleChange('', systemValues[0])}
                    >
                        Добавить сопоставление
                    </Button>
                </Space>
            </div>
        );
    };

    // Получение предложений для автозаполнения
    const getSuggestions = (attribute) => {
        const suggestions = {
            power: ['Мощность', 'Потребляемая мощность', 'Номинальная мощность', 'Power'],
            voltage: ['Напряжение', 'Рабочее напряжение', 'Voltage', 'U'],
            current: ['Ток', 'Номинальный ток', 'Current', 'I'],
            luminous_flux: ['Световой поток', 'Яркость', 'Luminous flux', 'Lm'],
            color_temperature: ['Цветовая температура', 'Температура цвета', 'CCT'],
            length: ['Длина', 'Габарит длина', 'Length', 'L'],
            width: ['Ширина', 'Габарит ширина', 'Width', 'W'],
            height: ['Высота', 'Габарит высота', 'Height', 'H'],
            weight: ['Вес', 'Масса', 'Weight', 'M']
        };

        return suggestions[attribute.canonical_name]?.map(s => ({ value: s })) || [];
    };

    return (
        <div style={{ padding: '24px' }}>
            <Card
                title="Маппинг атрибутов"
                extra={
                    <Space>
                        <Select
                            style={{ width: 200 }}
                            placeholder="Выберите поставщика"
                            value={selectedSupplier}
                            onChange={setSelectedSupplier}
                            options={suppliers.map(s => ({
                                label: s.name,
                                value: s.id
                            }))}
                        />
                        {selectedSupplier && (
                            <Button
                                type="primary"
                                icon={<SyncOutlined />}
                                onClick={autoMapAttributes}
                                loading={loading}
                            >
                                Автоматический маппинг
                            </Button>
                        )}
                    </Space>
                }
            >
                {selectedSupplier ? (
                    <Table
                        columns={attributeColumns}
                        dataSource={attributes}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            pageSize: 20,
                            showSizeChanger: true,
                            showTotal: (total) => `Всего атрибутов: ${total}`
                        }}
                    />
                ) : (
                    <Empty description="Выберите поставщика для начала маппинга атрибутов" />
                )}
            </Card>
        </div>
    );
};

export default AttributeMapping;
