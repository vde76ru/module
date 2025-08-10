const axios = require('axios');

class YandexAdapter {
  constructor(config) {
    // Новая конфигурация по рекомендациям Яндекс.Маркет
    this.businessId = config.business_id || config.businessId;
    this.campaignId = config.campaign_id || config.campaignId;
    this.apiKey = config.api_key || config.apiKey;
    this.integrationName = config.integration_name || config.integrationName || 'ModuleTrade/1.0';
    this.baseURL = 'https://api.partner.market.yandex.ru';

    // Обратная совместимость (устаревший OAuth)
    this.oauthToken = config.oauth_token;

    if (!this.apiKey && !this.oauthToken) {
      throw new Error('YandexAdapter: api_key (рекомендуется) или oauth_token (устаревший) обязателен');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        ...(this.apiKey ? { 'Api-Key': this.apiKey } : { 'Authorization': `OAuth ${this.oauthToken}` }),
        'X-Market-Integration': this.integrationName,
        'Content-Type': 'application/json'
      },
      timeout: 45000
    });

    // Очередь запросов с экспоненциальным backoff под 429/420
    this.queue = Promise.resolve();
    this.backoffMs = 0;
    this.maxBackoffMs = 60_000;
  }

  enqueue(executor) {
    this.queue = this.queue.then(async () => {
      let attempt = 0;
      // эксп. backoff на уровне одного элемента очереди при ответе 429/420
      while (true) {
        try {
          const res = await executor();
          // сбрасываем backoff на успешном ответе
          this.backoffMs = Math.max(0, Math.floor(this.backoffMs / 2));
          return res;
        } catch (error) {
          const status = error?.response?.status;
          if (status === 429 || status === 420) {
            attempt += 1;
            this.backoffMs = Math.min(this.maxBackoffMs, (this.backoffMs || 1000) * 2);
            const wait = this.backoffMs + Math.floor(Math.random() * 500);
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
          throw error;
        }
      }
    });
    return this.queue;
  }

  // Получение кампаний для businessId
  async getCampaigns() {
    if (!this.businessId) {
      throw new Error('YandexAdapter.getCampaigns: business_id is required');
    }
    return this.enqueue(async () => {
      const res = await this.client.get(`/businesses/${this.businessId}/campaigns`);
      return res.data?.campaigns || [];
    });
  }

  // Обновление остатков FBS: PUT /campaigns/{campaignId}/warehouses/{warehouseId}/stocks
  async updateStockFbs({ campaignId, warehouseId, items }) {
    const cid = campaignId || this.campaignId;
    if (!cid || !warehouseId) throw new Error('YandexAdapter.updateStockFbs: campaignId and warehouseId are required');
    const payload = {
      items: items.map(it => ({
        sku: it.sku,
        type: it.type || 'FIT',
        count: it.count,
        updatedAt: new Date().toISOString()
      }))
    };
    return this.enqueue(async () => {
      const res = await this.client.put(`/campaigns/${cid}/warehouses/${warehouseId}/stocks`, payload);
      return res.data;
    });
  }

  // Получение остатков: POST /campaigns/{campaignId}/offers/stocks
  async getStocks({ campaignId, skus = [] }) {
    const cid = campaignId || this.campaignId;
    if (!cid) throw new Error('YandexAdapter.getStocks: campaignId is required');
    const payload = { offerIds: skus };
    return this.enqueue(async () => {
      const res = await this.client.post(`/campaigns/${cid}/offers/stocks`, payload);
      return res.data;
    });
  }

  // Обновление цен на уровне Бизнеса (рекомендуется): POST /businesses/{businessId}/offer-prices/updates
  async updatePricesBusiness(offers, { autoConfirmQuarantine = false } = {}) {
    if (!this.businessId) throw new Error('YandexAdapter.updatePricesBusiness: business_id is required');
    const payload = {
      offers: offers.map(u => ({
        offerId: u.offerId || u.productId,
        price: {
          value: u.price,
          currencyId: u.currencyId || 'RUR',
          discountBase: u.oldPrice || undefined
        }
      }))
    };
    const result = await this.enqueue(async () => {
      const res = await this.client.post(`/businesses/${this.businessId}/offer-prices/updates`, payload);
      return res.data;
    });

    if (autoConfirmQuarantine) {
      try {
        const q = await this.enqueue(async () => {
          const res = await this.client.post(`/businesses/${this.businessId}/price-quarantine`, {});
          return res.data;
        });
        const quarantined = q?.offers || [];
        if (quarantined.length > 0) {
          await this.enqueue(async () => {
            await this.client.post(`/businesses/${this.businessId}/price-quarantine/confirm`, {
              offers: quarantined.map(o => ({ offerId: o.offerId }))
            });
          });
        }
      } catch (_) { /* ignore quarantine errors */ }
    }
    return result;
  }

  // Получение заказов (по кампании)
  async getOrders(params = {}) {
    const cid = params.campaignId || this.campaignId;
    if (!cid) throw new Error('YandexAdapter.getOrders: campaignId is required');
    const queryParams = new URLSearchParams({
      status: params.status || 'PROCESSING',
      substatus: params.substatus || '',
      fromDate: params.fromDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      toDate: params.toDate || new Date().toISOString(),
      page: params.page || 1,
      pageSize: params.pageSize || 50
    });
    return this.enqueue(async () => {
      const response = await this.client.get(`/campaigns/${cid}/orders?${queryParams}`);
      return {
        orders: response.data.orders,
        paging: response.data.paging
      };
    });
  }

  // Обновление статуса заказа
  async updateOrderStatus(orderId, status, substatus = null) {
    try {
      const statusMap = {
        'processing': 'PROCESSING',
        'shipped': 'DELIVERY',
        'delivered': 'DELIVERED',
        'cancelled': 'CANCELLED'
      };

      const payload = {
        order: {
          status: statusMap[status] || status
        }
      };

      if (substatus) {
        payload.order.substatus = substatus;
      }

      const response = await this.client.put(
        `/campaigns/${this.campaignId}/orders/${orderId}/status`,
        payload
      );

      return response.data;
    } catch (error) {
      console.error('Yandex updateOrderStatus error:', error);
      throw new Error(`Failed to update order status on Yandex: ${error.message}`);
    }
  }

  // Получение товаров (устар. кампания) — совместимость
  async getProducts(params = {}) {
    const cid = params.campaignId || this.campaignId;
    if (!cid) throw new Error('YandexAdapter.getProducts: campaignId is required');
    const queryParams = new URLSearchParams({
      page: params.page || 1,
      pageSize: params.pageSize || 200,
      shopSku: params.shopSku || ''
    });
    return this.enqueue(async () => {
      const response = await this.client.get(`/campaigns/${cid}/offer-mappings?${queryParams}`);
      return {
        products: response.data.offerMappings,
        paging: response.data.paging
      };
    });
  }

  // Добавление/обновление товаров (бизнес-уровень)
  async updateProductsBusiness(products) {
    if (!this.businessId) throw new Error('YandexAdapter.updateProductsBusiness: business_id is required');
    const offerMappings = products.map(product => ({
      offer: {
        shopSku: product.offer_id || product.shopSku,
        name: product.name,
        category: product.category,
        manufacturer: product.manufacturer || '',
        vendorCode: product.vendorCode || product.offer_id || product.shopSku,
        description: product.description || '',
        barcode: Array.isArray(product.barcode) ? product.barcode : (product.barcode ? [product.barcode] : []),
        urls: product.images || [],
        weight: {
          value: product.weight || 0.1,
          unit: 'KG'
        },
        dimensions: {
          length: product.length || 10,
          width: product.width || 10,
          height: product.height || 10,
          unit: 'CM'
        }
      },
      mapping: {
        marketSku: product.marketSku || null
      }
    }));
    return this.enqueue(async () => {
      const response = await this.client.post(
        `/businesses/${this.businessId}/offer-mappings/update`,
        { offerMappings }
      );
      return response.data;
    });
  }

  // Скрытие/показ товаров
  async hideProducts(productIds, hide = true) {
    const cid = this.campaignId;
    if (!cid) throw new Error('YandexAdapter.hideProducts: campaignId is required');
    const hiddenOffers = productIds.map(id => ({ offerId: id, hidden: hide }));
    return this.enqueue(async () => {
      const response = await this.client.post(`/campaigns/${cid}/hidden-offers`, { hiddenOffers });
      return response.data;
    });
  }

  // Получение категорий
  async getCategories() {
    try {
      const response = await this.client.get('/categories/tree');
      return response.data.categories;
    } catch (error) {
      console.error('Yandex getCategories error:', error);
      throw new Error(`Failed to fetch categories from Yandex: ${error.message}`);
    }
  }

  // Получение складов
  async getWarehouses() {
    const cid = this.campaignId;
    if (!cid) throw new Error('YandexAdapter.getWarehouses: campaignId is required');
    return this.enqueue(async () => {
      const response = await this.client.get(`/campaigns/${cid}/warehouses`);
      return response.data.warehouses;
    });
  }

  // Получение отчета о продажах
  async getSalesReport(dateFrom, dateTo) {
    try {
      const queryParams = new URLSearchParams({
        dateFrom: dateFrom.toISOString().split('T')[0],
        dateTo: dateTo.toISOString().split('T')[0]
      });

      const response = await this.client.get(
        `/campaigns/${this.campaignId}/stats/orders?${queryParams}`
      );

      return response.data;
    } catch (error) {
      console.error('Yandex getSalesReport error:', error);
      throw new Error(`Failed to fetch sales report from Yandex: ${error.message}`);
    }
  }

  // Тестирование подключения
  async testConnection() {
    // Проверяем как бизнес, так и кампанию при наличии
    try {
      let campaignInfo = null;
      if (this.campaignId) {
        const response = await this.client.get(`/campaigns/${this.campaignId}`);
        campaignInfo = response.data.campaign;
      }
      let campaigns = null;
      if (this.businessId) {
        const res = await this.client.get(`/businesses/${this.businessId}/campaigns`);
        campaigns = res.data?.campaigns || [];
      }
      return {
        success: true,
        message: 'Connection successful',
        campaignInfo,
        campaigns
      };
    } catch (error) {
      const status = error.response?.status;
      const errMsg = error.response?.data?.error?.message || error.message;
      return { success: false, message: errMsg, status };
    }
  }
}

module.exports = YandexAdapter;
