const axios = require('axios');

class YandexAdapter {
  constructor(config) {
    this.campaignId = config.campaign_id;
    this.oauthToken = config.oauth_token;
    this.baseURL = 'https://api.partner.market.yandex.ru/v2';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `OAuth ${this.oauthToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  // Обновление остатков
  async updateStock(stockUpdates) {
    try {
      const skus = stockUpdates.map(update => ({
        sku: update.productId,
        warehouseId: update.warehouseId || 1,
        items: [{
          type: 'FIT',
          count: update.quantity,
          updatedAt: new Date().toISOString()
        }]
      }));

      const response = await this.client.put(
        `/campaigns/${this.campaignId}/offers/stocks`,
        { skus }
      );

      return response.data;
    } catch (error) {
      console.error('Yandex updateStock error:', error);
      throw new Error(`Failed to update stock on Yandex: ${error.message}`);
    }
  }

  // Обновление цен
  async updatePrices(priceUpdates) {
    try {
      const offers = priceUpdates.map(update => ({
        offerId: update.productId,
        price: {
          value: update.price,
          currencyId: 'RUR',
          discountBase: update.oldPrice
        }
      }));

      const response = await this.client.post(
        `/campaigns/${this.campaignId}/offer-prices/updates`,
        { offers }
      );

      return response.data;
    } catch (error) {
      console.error('Yandex updatePrices error:', error);
      throw new Error(`Failed to update prices on Yandex: ${error.message}`);
    }
  }

  // Получение заказов
  async getOrders(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        status: params.status || 'PROCESSING',
        substatus: params.substatus || '',
        fromDate: params.fromDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        toDate: params.toDate || new Date().toISOString(),
        page: params.page || 1,
        pageSize: params.pageSize || 50
      });

      const response = await this.client.get(
        `/campaigns/${this.campaignId}/orders?${queryParams}`
      );

      return {
        orders: response.data.orders,
        paging: response.data.paging
      };
    } catch (error) {
      console.error('Yandex getOrders error:', error);
      throw new Error(`Failed to fetch orders from Yandex: ${error.message}`);
    }
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

  // Получение товаров
  async getProducts(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        pageSize: params.pageSize || 200,
        shopSku: params.shopSku || ''
      });

      const response = await this.client.get(
        `/campaigns/${this.campaignId}/offer-mappings?${queryParams}`
      );

      return {
        products: response.data.offerMappings,
        paging: response.data.paging
      };
    } catch (error) {
      console.error('Yandex getProducts error:', error);
      throw new Error(`Failed to fetch products from Yandex: ${error.message}`);
    }
  }

  // Добавление/обновление товаров
  async updateProducts(products) {
    try {
      const offerMappings = products.map(product => ({
        offer: {
          shopSku: product.offer_id,
          name: product.name,
          category: product.category,
          manufacturer: product.manufacturer || '',
          vendorCode: product.vendorCode || product.offer_id,
          description: product.description || '',
          barcode: product.barcode || [],
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

      const response = await this.client.post(
        `/campaigns/${this.campaignId}/offer-mappings/update`,
        { offerMappings }
      );

      return response.data;
    } catch (error) {
      console.error('Yandex updateProducts error:', error);
      throw new Error(`Failed to update products on Yandex: ${error.message}`);
    }
  }

  // Скрытие/показ товаров
  async hideProducts(productIds, hide = true) {
    try {
      const hiddenOffers = productIds.map(id => ({
        offerId: id,
        hidden: hide
      }));

      const response = await this.client.post(
        `/campaigns/${this.campaignId}/hidden-offers`,
        { hiddenOffers }
      );

      return response.data;
    } catch (error) {
      console.error('Yandex hideProducts error:', error);
      throw new Error(`Failed to hide/show products on Yandex: ${error.message}`);
    }
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
    try {
      const response = await this.client.get(
        `/campaigns/${this.campaignId}/warehouses`
      );
      return response.data.warehouses;
    } catch (error) {
      console.error('Yandex getWarehouses error:', error);
      throw new Error(`Failed to fetch warehouses from Yandex: ${error.message}`);
    }
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
    try {
      const response = await this.client.get(`/campaigns/${this.campaignId}`);
      return { 
        success: true, 
        message: 'Connection successful',
        campaignInfo: response.data.campaign
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.error?.message || error.message 
      };
    }
  }
}

module.exports = YandexAdapter;
