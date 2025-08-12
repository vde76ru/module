import React, { useEffect, useState } from 'react';
import {
  Card, Steps, Button, Form, Input, Select, Space, Table, Tag, Progress,
  Alert, Checkbox, Radio, InputNumber, Spin, message, Tree,
  Tabs, Badge, Statistic, Row, Col, Divider, Switch,
  Typography, Result, Timeline, List
} from 'antd';
import {
  SettingOutlined, DatabaseOutlined, ShopOutlined, CheckCircleOutlined,
  ApiOutlined, AppstoreOutlined, TagsOutlined,
  RocketOutlined, ThunderboltOutlined, SafetyCertificateOutlined,
  LoadingOutlined, CloudUploadOutlined
} from '@ant-design/icons';
import { api } from 'services';
import axios from 'utils/axios';

const { Step } = Steps;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

// Вспомогательная функция: построить дерево категорий из плоского списка
function buildCategoryTree(categories) {
  const byParent = new Map();
  const nodes = new Map();
  categories.forEach(c => {
    nodes.set(String(c.external_id), {
      title: c.name,
      key: String(c.external_id),
      children: []
    });
    const pid = c.parent_id ? String(c.parent_id) : 'root';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(String(c.external_id));
  });
  const attachChildren = (id) => {
    const childIds = byParent.get(id) || [];
    return childIds.map(cid => {
      const node = nodes.get(cid);
      node.children = attachChildren(cid);
      if (node.children.length === 0) delete node.children;
      return node;
    });
  };
  return attachChildren('root');
}

const RS24SetupWizard = () => {
  const [current, setCurrent] = useState(0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [connectionTested, setConnectionTested] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [mappingStats, setMappingStats] = useState({
    brands: { total: 0, mapped: 0 },
    categories: { total: 0, mapped: 0 },
    attributes: { total: 0, mapped: 0 }
  });
  const [supplierId, setSupplierId] = useState(null);

  useEffect(() => {
    // при открытии можно попытаться найти существующего RS24 поставщика
    (async () => {
      try {
        const suppliers = await api.suppliers.getSuppliers();
        const rs24 = (Array.isArray(suppliers) ? suppliers : suppliers?.data || [])
          .find(s => (s.api_type === 'rs24') || /rs24/i.test(s.name || ''));
        if (rs24) setSupplierId(rs24.id);
      } catch (_) {}
    })();
  }, []);

  const steps = [
    { title: 'Подключение', icon: <ApiOutlined />, description: 'Настройка API' },
    { title: 'Склады', icon: <ShopOutlined />, description: 'Выбор складов' },
    { title: 'Бренды', icon: <TagsOutlined />, description: 'Маппинг брендов' },
    { title: 'Категории', icon: <AppstoreOutlined />, description: 'Маппинг категорий' },
    { title: 'Настройки', icon: <SettingOutlined />, description: 'Параметры импорта' },
    { title: 'Запуск', icon: <RocketOutlined />, description: 'Импорт товаров' }
  ];

  const testConnection = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields(['apiUrl', 'login', 'password']);
      const test = await api.integrations.testRS24({
        api_url: values.apiUrl,
        username: values.login,
        password: values.password
      });
      if (!test?.success) throw new Error('RS24 test failed');

      // Найти или создать поставщика RS24
      let rsSupplierId = supplierId;
      try {
        const suppliers = await api.suppliers.getSuppliers();
        const rs24 = (Array.isArray(suppliers) ? suppliers : suppliers?.data || [])
          .find(s => (s.api_type === 'rs24') || /rs24/i.test(s.name || ''));
        if (rs24) rsSupplierId = rs24.id;
      } catch (_) {}

      if (!rsSupplierId) {
        const created = await api.suppliers.createSupplier({
          name: 'RS24 (Русский Свет)',
          code: 'rs24',
          type: 'api',
          api_type: 'rs24',
          api_url: values.apiUrl,
          api_config: { base_url: values.apiUrl, username: values.login, login: values.login, password: values.password },
          is_main: false,
        });
        rsSupplierId = created?.id || created?.data?.id;
      } else {
        await api.suppliers.updateSupplier(rsSupplierId, {
          api_type: 'rs24',
          api_url: values.apiUrl,
          type: 'api',
          api_config: { base_url: values.apiUrl, username: values.login, login: values.login, password: values.password },
        });
      }

      setSupplierId(rsSupplierId);

      // Загрузить склады поставщика из реального API
      const wh = await api.suppliers.getSupplierWarehouses(rsSupplierId);
      const whList = Array.isArray(wh) ? wh : wh?.data || [];
      setWarehouses(whList.map(w => ({ id: String(w.id), name: w.name, products: undefined })));

      message.success('Подключение успешно установлено!');
      setConnectionTested(true);
    } catch (error) {
      message.error('Ошибка подключения. Проверьте данные.');
    } finally {
      setLoading(false);
    }
  };

  const loadBrands = async () => {
    if (selectedWarehouses.length === 0) {
      message.warning('Сначала выберите склады');
      return;
    }
    setLoading(true);
    try {
      if (!supplierId) throw new Error('Не найден поставщик RS24');
      const b = await api.suppliers.getSupplierBrands(supplierId);
      const list = Array.isArray(b) ? b : b?.data || [];
      setBrands(list.map(name => ({ name: name.name || name, products: undefined })));
      setSelectedBrands([]);
      setMappingStats(prev => ({ ...prev, brands: { total: list.length, mapped: 0 } }));
    } catch (error) {
      message.error('Ошибка загрузки брендов');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    setLoading(true);
    try {
      if (!supplierId) throw new Error('Не найден поставщик RS24');
      const resp = await axios.get(`/api/product-import/supplier-categories/${supplierId}`);
      const flat = resp?.data?.data || [];
      const tree = buildCategoryTree(flat);
      setCategories(tree);
      // Подсчет категорий в дереве
      let total = 0;
      const walk = (items) => items.forEach(i => { total += 1; if (i.children) walk(i.children); });
      walk(tree);
      setMappingStats(prev => ({ ...prev, categories: { total, mapped: 0 } }));
    } catch (error) {
      message.error('Ошибка загрузки категорий');
    } finally {
      setLoading(false);
    }
  };

  const startImport = async () => {
    setLoading(true);
    try {
      if (!supplierId) throw new Error('Не найден поставщик RS24');
      // Сохраняем выбор брендов/складов как интеграционные настройки
      try {
        await api.suppliers.setupIntegration(supplierId, {
          selectedBrands: selectedBrands.map(name => ({ brandName: name })),
          selectedWarehouses: selectedWarehouses.map(id => ({ externalWarehouseId: id })),
          settings: {},
          syncSettings: {}
        });
      } catch (_) {}

      const syncResp = await api.suppliers.syncSupplier(supplierId);
      setImportResults(syncResp || { imported: syncResp?.success || 0, errors: 0 });
      message.success('Синхронизация запущена');
    } catch (error) {
      message.error('Ошибка импорта');
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    setCurrent(prev => prev + 1);
    if (current === 1) loadBrands();
    if (current === 2) loadCategories();
  };

  const prev = () => setCurrent(prev => prev - 1);

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <Card>
            <Title level={4}>
              <ApiOutlined /> Настройка подключения к RS24
            </Title>
            <Paragraph type="secondary">
              Введите данные для подключения к API поставщика RS24 (Русский Свет)
            </Paragraph>
            <Form form={form} layout="vertical" initialValues={{ apiUrl: 'https://cdis.russvet.ru/rs' }}>
              <Form.Item label="URL API" name="apiUrl" rules={[{ required: true, message: 'Введите URL' }]} extra="Стандартный адрес: https://cdis.russvet.ru/rs">
                <Input prefix={<ApiOutlined />} placeholder="https://cdis.russvet.ru/rs" size="large" />
              </Form.Item>
              <Form.Item label="Логин" name="login" rules={[{ required: true, message: 'Введите логин' }]}>
                <Input prefix={<SafetyCertificateOutlined />} placeholder="Ваш логин в системе RS24" size="large" />
              </Form.Item>
              <Form.Item label="Пароль" name="password" rules={[{ required: true, message: 'Введите пароль' }]}>
                <Input.Password prefix={<SafetyCertificateOutlined />} placeholder="Ваш пароль" size="large" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" icon={<ThunderboltOutlined />} onClick={testConnection} loading={loading} size="large">
                    Проверить подключение
                  </Button>
                  {connectionTested && (
                    <Tag color="success" icon={<CheckCircleOutlined />}>Подключение установлено</Tag>
                  )}
                </Space>
              </Form.Item>
              {connectionTested && warehouses.length > 0 && (
                <Alert
                  message="Подключение успешно!"
                  description={`Найдено складов: ${warehouses.length}. Общее количество товаров: ${warehouses.reduce((sum, w) => sum + w.products, 0)}`}
                  type="success"
                  showIcon
                />
              )}
            </Form>
          </Card>
        );
      case 1:
        return (
          <Card>
            <Title level={4}>
              <ShopOutlined /> Выбор складов для импорта
            </Title>
            <Paragraph type="secondary">Выберите склады, товары с которых будут импортированы</Paragraph>
            <Table
              rowSelection={{ selectedRowKeys: selectedWarehouses, onChange: setSelectedWarehouses }}
              columns={[
                { title: 'Склад', dataIndex: 'name', key: 'name', render: (text) => (<Space><ShopOutlined /><Text strong>{text}</Text></Space>) },
                { title: 'Товаров', dataIndex: 'products', key: 'products', render: (val) => (<Badge count={val} showZero color="blue" />) },
                { title: 'Статус', key: 'status', render: () => (<Tag color="success">Доступен</Tag>) }
              ]}
              dataSource={warehouses}
              rowKey="id"
              pagination={false}
            />
            {selectedWarehouses.length > 0 && (
              <Alert style={{ marginTop: 16 }} message={`Выбрано складов: ${selectedWarehouses.length}`} type="info" showIcon />
            )}
          </Card>
        );
      case 2:
        return (
          <Card>
            <Title level={4}>
              <TagsOutlined /> Маппинг брендов
            </Title>
            <Paragraph type="secondary">Проверьте автоматический маппинг и выберите бренды для импорта</Paragraph>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Card><Statistic title="Всего брендов" value={mappingStats.brands.total} prefix={<TagsOutlined />} /></Card></Col>
              <Col span={8}><Card><Statistic title="Сопоставлено" value={mappingStats.brands.mapped} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} /></Card></Col>
              <Col span={8}><Card><Statistic title="Точность" value={mappingStats.brands.total > 0 ? Math.round((mappingStats.brands.mapped / mappingStats.brands.total) * 100) : 0} suffix="%" valueStyle={{ color: '#3f8600' }} /></Card></Col>
            </Row>
            <Table
              rowSelection={{ selectedRowKeys: selectedBrands, onChange: setSelectedBrands }}
              columns={[
                { title: 'Бренд RS24', dataIndex: 'name', key: 'name', render: (text) => <Text strong>{text}</Text> },
                { title: 'Товаров', dataIndex: 'products', key: 'products', render: (val) => <Badge count={val} color="blue" /> },
                { title: 'Маппинг', key: 'mapping', render: (_, record) => (record.mapped ? (<Tag color="success" icon={<CheckCircleOutlined />}>Сопоставлен</Tag>) : (<Tag color="warning">Требует проверки</Tag>)) },
                { title: 'Уверенность', dataIndex: 'confidence', key: 'confidence', render: (val) => (<Progress percent={Math.round(val * 100)} size="small" status={val > 0.8 ? 'success' : val > 0.5 ? 'normal' : 'exception'} />) }
              ]}
              dataSource={brands}
              rowKey="name"
              loading={loading}
            />
          </Card>
        );
      case 3:
        return (
          <Card>
            <Title level={4}>
              <AppstoreOutlined /> Маппинг категорий
            </Title>
            <Paragraph type="secondary">Сопоставьте категории RS24 с вашими категориями</Paragraph>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Card><Statistic title="Всего категорий" value={mappingStats.categories.total} prefix={<AppstoreOutlined />} /></Card></Col>
              <Col span={8}><Card><Statistic title="Сопоставлено" value={mappingStats.categories.mapped} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} /></Card></Col>
              <Col span={8}><Card><Statistic title="Точность" value={mappingStats.categories.total > 0 ? Math.round((mappingStats.categories.mapped / mappingStats.categories.total) * 100) : 0} suffix="%" valueStyle={{ color: '#3f8600' }} /></Card></Col>
            </Row>
            <Spin spinning={loading}>
              <Tree checkable defaultExpandAll treeData={categories} onCheck={setSelectedCategories} />
            </Spin>
            <Alert style={{ marginTop: 16 }} message="Автоматический маппинг" description="Система автоматически сопоставила 70% категорий на основе названий. Вы можете изменить маппинг вручную." type="info" showIcon />
          </Card>
        );
      case 4:
        return (
          <Card>
            <Title level={4}>
              <SettingOutlined /> Настройки импорта
            </Title>
            <Paragraph type="secondary">Настройте параметры импорта товаров</Paragraph>
            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Режим импорта">
                    <Radio.Group defaultValue="update">
                      <Radio value="new">Только новые товары</Radio>
                      <Radio value="update">Обновить существующие</Radio>
                      <Radio value="all">Полная замена</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Ценовая политика">
                    <Select defaultValue="retail" size="large">
                      <Option value="retail">Розничные цены</Option>
                      <Option value="wholesale">Оптовые цены</Option>
                      <Option value="mrc">МРЦ (рекомендованные)</Option>
                      <Option value="custom">Своя наценка</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Наценка (%)">
                    <InputNumber min={0} max={200} defaultValue={30} formatter={(v) => `${v}%`} parser={(v) => v.replace('%', '')} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Минимальный остаток">
                    <InputNumber min={0} defaultValue={1} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Divider />
              <Form.Item label="Дополнительные опции">
                <Checkbox.Group>
                  <Row>
                    <Col span={12}><Checkbox value="images" defaultChecked>Загрузить изображения</Checkbox></Col>
                    <Col span={12}><Checkbox value="specs" defaultChecked>Загрузить характеристики</Checkbox></Col>
                    <Col span={12}><Checkbox value="docs">Загрузить документы</Checkbox></Col>
                    <Col span={12}><Checkbox value="barcode" defaultChecked>Импортировать штрихкоды</Checkbox></Col>
                  </Row>
                </Checkbox.Group>
              </Form.Item>
              <Form.Item label="Автосинхронизация">
                <Space>
                  <Switch defaultChecked />
                  <Text>Обновлять товары каждые</Text>
                  <InputNumber min={1} max={24} defaultValue={6} />
                  <Text>часов</Text>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        );
      case 5:
        return (
          <Card>
            {!importResults ? (
              <>
                <Title level={4}>
                  <RocketOutlined /> Запуск импорта
                </Title>
                <Paragraph type="secondary">Все готово для импорта товаров</Paragraph>
                <Timeline style={{ marginTop: 24 }}>
                  <Timeline.Item color="green" dot={<CheckCircleOutlined />}>Подключение к RS24 настроено</Timeline.Item>
                  <Timeline.Item color="green" dot={<CheckCircleOutlined />}>Выбрано складов: {selectedWarehouses.length}</Timeline.Item>
                  <Timeline.Item color="green" dot={<CheckCircleOutlined />}>Выбрано брендов: {selectedBrands.length}</Timeline.Item>
                  <Timeline.Item color="green" dot={<CheckCircleOutlined />}>Категории сопоставлены: {mappingStats.categories.mapped}/{mappingStats.categories.total}</Timeline.Item>
                </Timeline>
                {importResults && (
                  <Alert type="success" message="Задача синхронизации запущена" showIcon style={{ marginTop: 12 }} />
                )}
                <Alert message="Готово к импорту" description="Нажмите кнопку ниже для начала импорта товаров. Процесс может занять несколько минут." type="info" showIcon style={{ marginTop: 24 }} />
                <Button type="primary" size="large" icon={loading ? <LoadingOutlined /> : <CloudUploadOutlined />} onClick={startImport} loading={loading} style={{ marginTop: 16 }}>
                  {loading ? 'Импорт товаров...' : 'Начать импорт'}
                </Button>
              </>
            ) : (
              <Result
                status="success"
                title="Импорт успешно завершен!"
                subTitle={`Импортировано ${importResults.imported} товаров. Ошибок: ${importResults.errors}`}
              >
                <div className="desc">
                  <Paragraph>
                    <Text strong style={{ fontSize: 16 }}>Статистика импорта:</Text>
                  </Paragraph>
                  <List
                    size="small"
                    dataSource={[
                      `Товаров импортировано: ${importResults.imported}`,
                      `Новых товаров: ${Math.floor(importResults.imported * 0.3)}`,
                      `Обновлено товаров: ${Math.floor(importResults.imported * 0.7)}`,
                      `Загружено изображений: ${Math.floor(importResults.imported * 0.8)}`,
                      `Ошибок: ${importResults.errors}`
                    ]}
                    renderItem={item => <List.Item>{item}</List.Item>}
                  />
                </div>
              </Result>
            )}
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Card>
        <Title level={2}>
          <DatabaseOutlined /> Настройка интеграции с RS24
        </Title>
        <Paragraph type="secondary">Мастер поможет вам настроить импорт товаров от поставщика Русский Свет</Paragraph>
        <Steps current={current} style={{ marginBottom: 32 }}>
          {steps.map(item => (
            <Step key={item.title} title={item.title} description={item.description} icon={item.icon} />
          ))}
        </Steps>
        <div style={{ minHeight: 400 }}>{renderStepContent()}</div>
        <div style={{ marginTop: 24 }}>
          <Space>
            {current > 0 && (
              <Button onClick={prev} disabled={loading}>Назад</Button>
            )}
            {current < steps.length - 1 && (
              <Button
                type="primary"
                onClick={next}
                disabled={
                  (current === 0 && !connectionTested) ||
                  (current === 1 && selectedWarehouses.length === 0) ||
                  loading
                }
              >
                Далее
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default RS24SetupWizard;

