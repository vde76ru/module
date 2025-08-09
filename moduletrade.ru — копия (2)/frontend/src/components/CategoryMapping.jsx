import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import {
    Card, Tree, Input, Button, Space, Tag, Modal,
    message, Tooltip, Badge, Divider, Select
} from 'antd';
import {
    FolderOutlined, LinkOutlined, DeleteOutlined,
    PlusOutlined, SearchOutlined
} from '@ant-design/icons';
import axios from 'utils/axios';

const { Search } = Input;

const CategoryMapping = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [supplierCategories, setSupplierCategories] = useState([]);
    const [systemCategories, setSystemCategories] = useState([]);
    const [mappings, setMappings] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [draggedItem, setDraggedItem] = useState(null);
    const [loading, setLoading] = useState(false);

    // Используем единый axios-инстанс с интерсепторами
    const api = axios;

    // Загрузка данных
    useEffect(() => {
        loadSuppliers();
        loadSystemCategories();
    }, []);

    useEffect(() => {
        if (selectedSupplier) {
            loadSupplierCategories(selectedSupplier);
            loadMappings(selectedSupplier);
        }
    }, [selectedSupplier]);

    const loadSuppliers = async () => {
        try {
            const response = await api.get('/suppliers');
            setSuppliers(response.data.data);
        } catch (error) {
            message.error('Ошибка загрузки поставщиков');
        }
    };

    const loadSystemCategories = async () => {
        try {
            const response = await api.get('/categories/tree');
            setSystemCategories(transformToTreeData(response.data.data));
        } catch (error) {
            message.error('Ошибка загрузки системных категорий');
        }
    };

    const loadSupplierCategories = async (supplierId) => {
        setLoading(true);
        try {
            const response = await api.get(`/product-import/supplier-categories/${supplierId}`);
            setSupplierCategories(response.data.data || response.data);
        } catch (error) {
            message.error('Ошибка загрузки категорий поставщика');
        } finally {
            setLoading(false);
        }
    };

    const loadMappings = async (supplierId) => {
        try {
            const response = await api.get(`/product-import/mapping/categories?supplier_id=${supplierId}`);
            const mappingsObj = {};
            response.data.data.forEach(mapping => {
                mappingsObj[mapping.supplier_category_id] = mapping.system_category_id;
            });
            setMappings(mappingsObj);
        } catch (error) {
            message.error('Ошибка загрузки маппингов');
        }
    };

    // Преобразование категорий в формат для Tree компонента
    const transformToTreeData = (categories, parentId = null) => {
        return categories
            .filter(cat => cat.parent_id === parentId)
            .map(cat => ({
                key: cat.id,
                title: cat.name,
                icon: <FolderOutlined />,
                children: transformToTreeData(categories, cat.id),
                data: cat
            }));
    };

    // Компонент категории поставщика (draggable)
    const SupplierCategory = ({ category }) => {
        const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
            id: `supplier-${category.id}`,
            data: category
        });

        const style = {
            opacity: isDragging ? 0.5 : 1,
            cursor: 'move',
            padding: '8px 12px',
            marginBottom: '8px',
            backgroundColor: mappings[category.id] ? '#f6ffed' : '#fafafa',
            border: mappings[category.id] ? '1px solid #b7eb8f' : '1px solid #d9d9d9',
            borderRadius: '4px',
            transition: 'all 0.2s'
        };

        return (
            <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                        <FolderOutlined />
                        <span>{category.name}</span>
                        {category.products_count > 0 && (
                            <Badge count={category.products_count} style={{ backgroundColor: '#52c41a' }} />
                        )}
                    </Space>
                    {mappings[category.id] && (
                        <Tag color="success" icon={<LinkOutlined />}>
                            Связано
                        </Tag>
                    )}
                </Space>
            </div>
        );
    };

    // Компонент системной категории (droppable)
    const SystemCategory = ({ category }) => {
        const { setNodeRef, isOver } = useDroppable({
            id: `system-${category.key}`,
            data: category
        });

        const mappedSupplierCategories = Object.entries(mappings)
            .filter(([supplierId, systemId]) => systemId === category.key)
            .map(([supplierId]) =>
                supplierCategories.find(cat => cat.id === supplierId)
            )
            .filter(Boolean);

        const style = {
            padding: '12px',
            backgroundColor: isOver ? '#e6f7ff' : '#fff',
            border: isOver ? '2px dashed #1890ff' : '1px solid #f0f0f0',
            borderRadius: '4px',
            marginBottom: '8px',
            transition: 'all 0.2s'
        };

        return (
            <div ref={setNodeRef} style={style}>
                <div style={{ marginBottom: '8px' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                            <FolderOutlined />
                            <strong>{category.title}</strong>
                        </Space>
                        <Space>
                            {mappedSupplierCategories.length > 0 && (
                                <Badge count={mappedSupplierCategories.length} />
                            )}
                            <Button
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => showManualMappingModal(category)}
                            >
                                Добавить вручную
                            </Button>
                        </Space>
                    </Space>
                </div>

                {mappedSupplierCategories.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                        <Divider style={{ margin: '8px 0' }} />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {mappedSupplierCategories.map(cat => (
                                <Tag
                                    key={cat.id}
                                    closable
                                    onClose={() => removeMapping(cat.id)}
                                    color="green"
                                >
                                    {cat.name}
                                </Tag>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Обработка drag & drop
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setDraggedItem(null);

        if (!over) return;

        const supplierCategoryId = active.data.current.id;
        const systemCategoryId = over.data.current.key;

        try {
            await api.post('/product-import/mapping/categories', {
                company_id: localStorage.getItem('companyId'),
                supplier_id: selectedSupplier,
                external_category_id: supplierCategoryId,
                internal_category_id: systemCategoryId
            });

            setMappings(prev => ({
                ...prev,
                [supplierCategoryId]: systemCategoryId
            }));

            message.success('Категория успешно связана');
        } catch (error) {
            message.error('Ошибка при связывании категорий');
        }
    };

    // Удаление маппинга
    const removeMapping = async (supplierCategoryId) => {
        try {
            await api.delete(`/product-import/mapping/categories/${supplierCategoryId}`, {
                params: { supplier_id: selectedSupplier }
            });

            setMappings(prev => {
                const newMappings = { ...prev };
                delete newMappings[supplierCategoryId];
                return newMappings;
            });

            message.success('Связь удалена');
        } catch (error) {
            message.error('Ошибка при удалении связи');
        }
    };

    // Автоматический маппинг
    const autoMapCategories = async () => {
        Modal.confirm({
            title: 'Автоматический маппинг',
            content: 'Система попытается автоматически сопоставить категории по схожести названий. Продолжить?',
            onOk: async () => {
                setLoading(true);
                try {
                    const response = await api.post('/mapping/categories/auto', {
                        supplier_id: selectedSupplier
                    });

                    const newMappings = {};
                    response.data.data.forEach(mapping => {
                        newMappings[mapping.supplier_category_id] = mapping.system_category_id;
                    });

                    setMappings(newMappings);
                    message.success(`Автоматически связано категорий: ${response.data.data.length}`);
                } catch (error) {
                    message.error('Ошибка автоматического маппинга');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    // Модальное окно для ручного добавления маппинга
    const showManualMappingModal = (systemCategory) => {
        const unmappedCategories = supplierCategories.filter(cat => !mappings[cat.id]);

        Modal.info({
            title: `Добавить категории к "${systemCategory.title}"`,
            width: 600,
            content: (
                <Select
                    mode="multiple"
                    style={{ width: '100%', marginTop: 16 }}
                    placeholder="Выберите категории поставщика"
                    options={unmappedCategories.map(cat => ({
                        label: cat.name,
                        value: cat.id
                    }))}
                    onSelect={async (value) => {
                        try {
                            await api.post('/mapping/categories', {
                                company_id: localStorage.getItem('companyId'),
                                supplier_id: selectedSupplier,
                                external_category_id: value,
                                internal_category_id: systemCategory.key
                            });

                            setMappings(prev => ({
                                ...prev,
                                [value]: systemCategory.key
                            }));

                            message.success('Категория добавлена');
                        } catch (error) {
                            message.error('Ошибка при добавлении категории');
                        }
                    }}
                />
            ),
            okText: 'Закрыть'
        });
    };

    return (
        <div style={{ padding: '24px' }}>
            <Card
                title="Маппинг категорий"
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
                                icon={<LinkOutlined />}
                                onClick={autoMapCategories}
                                loading={loading}
                            >
                                Автоматический маппинг
                            </Button>
                        )}
                    </Space>
                }
            >
                {selectedSupplier ? (
                    <DndContext onDragEnd={handleDragEnd} onDragStart={(event) => setDraggedItem(event.active.data.current)}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            {/* Категории поставщика */}
                            <Card
                                title="Категории поставщика"
                                size="small"
                                extra={
                                    <Search
                                        placeholder="Поиск категорий"
                                        onSearch={setSearchTerm}
                                        style={{ width: 200 }}
                                    />
                                }
                                loading={loading}
                            >
                                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                                    {supplierCategories
                                        .filter(cat =>
                                            cat.name.toLowerCase().includes(searchTerm.toLowerCase())
                                        )
                                        .map(category => (
                                            <SupplierCategory key={category.id} category={category} />
                                        ))
                                    }
                                </div>
                            </Card>

                            {/* Системные категории */}
                            <Card title="Системные категории" size="small">
                                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                                    <Tree
                                        treeData={systemCategories}
                                        titleRender={(node) => (
                                            <SystemCategory category={node} />
                                        )}
                                        defaultExpandAll
                                    />
                                </div>
                            </Card>
                        </div>

                        <DragOverlay>
                            {draggedItem && (
                                <div style={{
                                    padding: '8px 12px',
                                    backgroundColor: 'white',
                                    border: '1px solid #1890ff',
                                    borderRadius: 4,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                }}>
                                    <Space>
                                        <FolderOutlined />
                                        {draggedItem.name}
                                    </Space>
                                </div>
                            )}
                        </DragOverlay>
                    </DndContext>
                ) : (
                    <div style={{ textAlign: 'center', padding: 48 }}>
                        <p>Выберите поставщика для начала маппинга категорий</p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default CategoryMapping;
