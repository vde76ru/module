import React, { useEffect, useState } from 'react';
import { Card, Tabs, Table, Tag, Space, Button, Select, message, Progress } from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from 'services';
import axios from 'utils/axios';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;

const scoreColor = (score) => {
  if (score >= 0.85) return 'green';
  if (score >= 0.6) return 'gold';
  return 'red';
};

const MappingDashboard = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [brandSuggestions, setBrandSuggestions] = useState([]);
  const [categorySuggestions, setCategorySuggestions] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.suppliers.getSuppliers();
        setSuppliers(Array.isArray(data) ? data : data?.data || []);
      } catch (e) {
        message.error('Не удалось загрузить поставщиков');
      }
    })();
  }, []);

  const loadData = async () => {
    if (!supplierId) return;
    setLoading(true);
    try {
      // Категории поставщика
      const catsResp = await axios.get(`/api/product-import/supplier-categories/${supplierId}`);
      const externalCats = catsResp?.data?.data || [];
      const topCats = externalCats.slice(0, 50); // ограничим для производительности
      const catSuggest = await Promise.all(
        topCats.map(async (c) => {
          try {
            const r = await axios.get('/api/product-import/mapping/suggest/category', { params: { external_name: c.name, limit: 1 } });
            const best = (r?.data?.data || [])[0];
            return {
              kind: 'category',
              external_id: c.id,
              external: c.name,
              internal: best?.name || null,
              internal_id: best?.id || null,
              score: best?.score || 0,
            };
          } catch (_) {
            return { kind: 'category', external_id: c.id, external: c.name, internal: null, internal_id: null, score: 0 };
          }
        })
      );
      setCategorySuggestions(catSuggest);

      // Бренды поставщика (через сервис интеграции)
      const brands = await api.suppliers.getSupplierBrands(supplierId);
      const brandNames = Array.isArray(brands) ? brands : brands?.data || [];
      const topBrands = brandNames.slice(0, 100);
      const brandSuggest = await Promise.all(
        topBrands.map(async (b) => {
          const name = b.name || b;
          try {
            const r = await axios.get(`/api/suppliers/${supplierId}/brand-mapping/suggest`, { params: { q: name } });
            const best = (r?.data?.data?.suggestions || [])[0];
            return {
              kind: 'brand',
              external: name,
              internal: best?.brand_name || null,
              internal_id: best?.brand_id || null,
              score: best ? 1 : 0, // suggest без скоров — считаем уверенность 100% при наличии
            };
          } catch (_) {
            return { kind: 'brand', external: name, internal: null, internal_id: null, score: 0 };
          }
        })
      );
      setBrandSuggestions(brandSuggest);
    } catch (e) {
      message.error('Не удалось загрузить данные для маппинга');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [supplierId]);

  const columnsCommon = [
    {
      title: 'Источник',
      dataIndex: 'external',
      render: (v) => v || '-',
    },
    {
      title: 'Система',
      dataIndex: 'internal',
      render: (v) => v || <Tag color="red">Не сопоставлено</Tag>,
    },
    {
      title: 'Уверенность',
      dataIndex: 'score',
      width: 160,
      render: (score) => (
        <Space>
          <Tag color={scoreColor(score || 0)}>{Math.round((score || 0) * 100)}%</Tag>
          <Progress percent={Math.round((score || 0) * 100)} size="small" showInfo={false} />
        </Space>
      )
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.kind === 'category' && record.internal_id && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={async () => {
                try {
                  await axios.post('/api/product-import/mapping/categories', {
                    supplier_id: supplierId,
                    external_category_id: record.external_id,
                    internal_category_id: record.internal_id,
                  });
                  message.success('Категория сопоставлена');
                } catch (e) {
                  message.error('Ошибка подтверждения категории');
                }
              }}
            >
              Подтвердить
            </Button>
          )}
          {record.kind === 'brand' && record.internal_id && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={async () => {
                try {
                  await axios.post(`/api/suppliers/${supplierId}/brand-mapping/confirm`, {
                    brand_id: record.internal_id,
                    external_brand_name: record.external,
                  });
                  message.success('Бренд сопоставлен');
                } catch (e) {
                  message.error('Ошибка подтверждения бренда');
                }
              }}
            >
              Подтвердить
            </Button>
          )}
          <Button danger size="small" icon={<CloseOutlined />}>Отклонить</Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Панель маппингов"
        extra={
          <Space>
            <Select
              style={{ minWidth: 260 }}
              placeholder="Выберите поставщика"
              value={supplierId}
              onChange={setSupplierId}
              options={suppliers.map(s => ({ label: s.name, value: s.id }))}
            />
            <Button type="primary" onClick={() => navigate('/mapping/intelligent')}>
              Интеллектуальный маппинг
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData}>Обновить</Button>
          </Space>
        }
      >
        <Tabs defaultActiveKey="brands">
          <TabPane tab="Бренды" key="brands">
            <Table
              rowKey={(r, idx) => idx}
              columns={columnsCommon}
              dataSource={brandSuggestions}
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </TabPane>
          <TabPane tab="Категории" key="categories">
            <Table
              rowKey={(r, idx) => idx}
              columns={columnsCommon}
              dataSource={categorySuggestions}
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </TabPane>
          {/* Вкладка атрибутов будет добавлена после появления API списка внешних атрибутов */}
        </Tabs>
      </Card>
    </div>
  );
};

export default MappingDashboard;


