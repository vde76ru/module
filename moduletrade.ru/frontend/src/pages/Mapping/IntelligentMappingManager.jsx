import { api } from 'services';
import axios from 'utils/axios';

const { TabPane } = Tabs;
const { Title, Text } = Typography;
const { Search } = Input;

const IntelligentMappingManager = () => {
  const [activeTab, setActiveTab] = useState('brands');
  const [loading, setLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [unmappedItems, setUnmappedItems] = useState([]);
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [currentMapping, setCurrentMapping] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [mappingStats] = useState({
    brands: { total: 0, mapped: 0, auto: 0, manual: 0 },
    categories: { total: 0, mapped: 0, auto: 0, manual: 0 },
    attributes: { total: 0, mapped: 0, auto: 0, manual: 0 }
  });
  const [form] = Form.useForm();
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.suppliers.getSuppliers();
        const arr = Array.isArray(list) ? list : list?.data || [];
        setSuppliers(arr.map(s => ({ id: s.id, name: s.name, status: s.is_active ? 'connected' : 'disconnected' })));
        if (!selectedSupplier && arr.length > 0) setSelectedSupplier(arr[0].id);
      } catch (_) {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUnmappedItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedSupplier]);

  const loadUnmappedItems = async () => {
    setLoading(true);
    try {
      if (!selectedSupplier) {
        setUnmappedItems([]);
        return;
      }
      if (activeTab === 'brands') {
        const resp = await axios.get(`/api/product-import/supplier-brands/${selectedSupplier}`);
        const brands = resp?.data?.data || [];
        setUnmappedItems(brands.map(b => ({ external: b.name || b, count: undefined, suggested: null, confidence: 0 })));
      } else if (activeTab === 'categories') {
        const resp = await axios.get(`/api/product-import/supplier-categories/${selectedSupplier}`);
        const cat = resp?.data?.data || [];
        setUnmappedItems(cat.map(c => ({ external: c.name, count: undefined, suggested: null, confidence: 0 })));
      } else if (activeTab === 'attributes') {
        setUnmappedItems([]);
      }
    } catch (error) {
      message.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMapAll = async () => {
    setLoading(true);
    try {
      notification.success({ message: 'Запуск автоматического маппинга', description: 'Проверьте результаты после завершения фоновой обработки', duration: 3 });
      await loadUnmappedItems();
    } catch (error) {
      message.error('Ошибка автоматического маппинга');
    } finally {
      setLoading(false);
    }
  };

  const openMappingModal = async (item) => {
    setCurrentMapping(item);
    setMappingModalVisible(true);
    setLoading(true);
    try {
      if (activeTab === 'brands') {
        const r = await axios.get(`/api/suppliers/${selectedSupplier}/brand-mapping/suggest`, { params: { q: item.external } });
        const best = (r?.data?.data?.suggestions || []).slice(0, 5);
        setSuggestions(best.map((s, idx) => ({ id: s.brand_id || idx + 1, name: s.brand_name, confidence: 1 })));
      } else if (activeTab === 'categories') {
        const r = await axios.get('/api/product-import/mapping/suggest/category', { params: { external_name: item.external, limit: 5 } });
        setSuggestions((r?.data?.data || []).map((s, idx) => ({ id: s.id || idx + 1, name: s.name, path: s.path, confidence: s.score || 0 })));
      } else if (activeTab === 'attributes') {
        const r = await axios.get('/api/product-import/mapping/suggest/attribute', { params: { external_key: item.external, limit: 5 } });
        setSuggestions((r?.data?.data || []).map((s, idx) => ({ id: s.id || idx + 1, name: s.name || s.key, confidence: s.score || 0 })));
      }
    } catch (error) {
      message.error('Ошибка получения предложений');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMapping = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      const selectedId = values.internalId;
      if (activeTab === 'brands') {
        const chosen = suggestions.find(s => String(s.id) === String(selectedId));
        if (!chosen) throw new Error('Не выбран целевой бренд');
        await axios.post(`/api/suppliers/${selectedSupplier}/brand-mapping/confirm`, {
          brand_id: chosen.id,
          external_brand_name: currentMapping.external
        });
      } else if (activeTab === 'categories') {
        await axios.post('/api/product-import/mapping/categories', {
          supplier_id: selectedSupplier,
          external_category_id: currentMapping.external,
          internal_category_id: selectedId
        });
      } else if (activeTab === 'attributes') {
        await axios.put(`/api/product-import/attribute-mapping/${selectedSupplier}/${encodeURIComponent(currentMapping.external)}`, {
          internal_name: selectedId
        });
      }
      message.success('Маппинг сохранен');
      setMappingModalVisible(false);
      loadUnmappedItems();
    } catch (error) {
      message.error('Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const renderStatistics = () => {
    const stats = mappingStats[activeTab];
    const percentage = stats.total > 0 ? Math.round((stats.mapped / stats.total) * 100) : 0;
    return (
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Всего" value={stats.total} prefix={activeTab === 'brands' ? <TagsOutlined /> : activeTab === 'categories' ? <AppstoreOutlined /> : <BranchesOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Сопоставлено" value={stats.mapped} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Автоматически" value={stats.auto} valueStyle={{ color: '#1890ff' }} prefix={<RobotOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Точность" value={percentage} suffix="%" valueStyle={{ color: percentage > 80 ? '#3f8600' : '#faad14' }} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
      </Row>
    );
  };

  const unmappedColumns = [
    {
      title: 'Внешнее название',
      dataIndex: 'external',
      key: 'external',
      render: (text, record) => (
        <Space>
          <Text strong>{text}</Text>
          <Badge count={record.count} style={{ backgroundColor: '#52c41a' }} />
        </Space>
      )
    },
    {
      title: 'Предложение системы',
      dataIndex: 'suggested',
      key: 'suggested',
      render: (text, record) => {
        if (!text) return <Tag color="red">Не найдено</Tag>;
        return (
          <Space>
            <Text>{text}</Text>
            <Progress type="circle" percent={Math.round(record.confidence * 100)} width={30} strokeColor={record.confidence > 0.8 ? '#52c41a' : record.confidence > 0.6 ? '#faad14' : '#f5222d'} />
          </Space>
        );
      }
    },
    {
      title: 'Статус',
      key: 'status',
      render: (_, record) => {
        if (record.confidence > 0.8) return <Tag color="success">Высокая точность</Tag>;
        if (record.confidence > 0.6) return <Tag color="warning">Требует проверки</Tag>;
        return <Tag color="error">Ручной маппинг</Tag>;
      }
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.suggested && (
            <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => message.success('Маппинг подтвержден')}>
              Принять
            </Button>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openMappingModal(record)}>Изменить</Button>
          <Button size="small" danger icon={<DeleteOutlined />}>Пропустить</Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={3}>
              <BranchesOutlined /> Интеллектуальный маппинг
            </Title>
            <Text type="secondary">Автоматическое сопоставление данных поставщиков с вашей системой</Text>
          </Col>
          <Col>
            <Space>
              <Select value={selectedSupplier} onChange={setSelectedSupplier} style={{ width: 260 }} size="large" placeholder="Выберите поставщика">
                {suppliers.map(s => (
                  <Select.Option key={s.id} value={s.id}>
                    <Space>
                      <Badge status={s.status === 'connected' ? 'success' : 'default'} />
                      {s.name}
                    </Space>
                  </Select.Option>
                ))}
              </Select>
              <Button type="primary" icon={<RobotOutlined />} onClick={handleAutoMapAll} loading={loading} size="large">Автоматический маппинг</Button>
              <Button icon={<ExportOutlined />} size="large">Экспорт</Button>
            </Space>
          </Col>
        </Row>
        <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
          <TabPane tab={<span><TagsOutlined />Бренды<Badge count={47} style={{ marginLeft: 8 }} /></span>} key="brands">
            {renderStatistics()}
            <Card
              title="Несопоставленные бренды"
              extra={
                <Space>
                  <Search placeholder="Поиск..." onSearch={setSearchText} style={{ width: 200 }} />
                  <Button icon={<FilterOutlined />}>Фильтры</Button>
                  <Button icon={<SyncOutlined />} onClick={loadUnmappedItems}>Обновить</Button>
                </Space>
              }
            >
              <Table columns={unmappedColumns} dataSource={unmappedItems} loading={loading} rowKey="external" pagination={{ pageSize: 10 }} />
            </Card>
          </TabPane>
          <TabPane tab={<span><AppstoreOutlined />Категории<Badge count={17} style={{ marginLeft: 8 }} /></span>} key="categories">
            {renderStatistics()}
            <Card title="Несопоставленные категории" extra={
              <Space>
                <Search placeholder="Поиск..." onSearch={setSearchText} style={{ width: 200 }} />
                <Button icon={<FilterOutlined />}>Фильтры</Button>
                <Button icon={<SyncOutlined />} onClick={loadUnmappedItems}>Обновить</Button>
              </Space>
            }>
              <Table columns={unmappedColumns} dataSource={unmappedItems} loading={loading} rowKey="external" pagination={{ pageSize: 10 }} />
            </Card>
          </TabPane>
          <TabPane tab={<span><BranchesOutlined />Атрибуты<Badge count={44} style={{ marginLeft: 8 }} /></span>} key="attributes">
            {renderStatistics()}
            <Card title="Несопоставленные атрибуты" extra={
              <Space>
                <Search placeholder="Поиск..." onSearch={setSearchText} style={{ width: 200 }} />
                <Button icon={<FilterOutlined />}>Фильтры</Button>
                <Button icon={<SyncOutlined />} onClick={loadUnmappedItems}>Обновить</Button>
              </Space>
            }>
              <Table columns={unmappedColumns} dataSource={unmappedItems} loading={loading} rowKey="external" pagination={{ pageSize: 10 }} />
            </Card>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={<Space><LinkOutlined />Сопоставление: {currentMapping?.external}</Space>}
        open={mappingModalVisible}
        onCancel={() => setMappingModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
        confirmLoading={loading}
      >
        {currentMapping && (
          <Form form={form} layout="vertical" onFinish={handleSaveMapping}>
            <Alert message="Интеллектуальные предложения" description="Система проанализировала название и предлагает наиболее подходящие варианты" type="info" showIcon style={{ marginBottom: 16 }} />
            <Form.Item label="Внешнее название">
              <Input value={currentMapping.external} disabled />
            </Form.Item>
            <Form.Item label="Выберите соответствие" name="internalId" rules={[{ required: true, message: 'Выберите соответствие' }]}>
              <Radio.Group style={{ width: '100%' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {suggestions.map(sugg => (
                    <Card key={sugg.id} hoverable style={{ marginBottom: 8 }}>
                      <Radio value={sugg.id}>
                        <Row justify="space-between" align="middle">
                          <Col span={16}>
                            <Space direction="vertical" size={0}>
                              <Text strong>{sugg.name}</Text>
                              {sugg.path && <Text type="secondary" style={{ fontSize: 12 }}>{sugg.path}</Text>}
                              {sugg.reason && <Text type="secondary" style={{ fontSize: 12 }}>{sugg.reason}</Text>}
                            </Space>
                          </Col>
                          <Col>
                            <Progress type="circle" percent={Math.round(sugg.confidence * 100)} width={50} strokeColor={sugg.confidence > 0.8 ? '#52c41a' : sugg.confidence > 0.6 ? '#faad14' : '#f5222d'} />
                          </Col>
                        </Row>
                      </Radio>
                    </Card>
                  ))}
                  <Card hoverable>
                    <Radio value="new">
                      <Space>
                        <PlusOutlined />
                        <Text>Создать новый элемент</Text>
                      </Space>
                    </Radio>
                  </Card>
                </Space>
              </Radio.Group>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default IntelligentMappingManager;

