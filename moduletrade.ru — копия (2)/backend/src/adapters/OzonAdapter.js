const axios = require('axios');

class OzonAdapter {
  constructor(config) {
    this.clientId = config.client_id;
    this.apiKey = config.api_key;
    this.baseURL = 'https://api-seller.ozon.ru';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Client-Id': this.clientId,
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  // Обновление остатков в реальном времени
  async updateStock(productId, quantity) {
    try {
      const response = await this.client.post('/v2/products/stocks', {
        stocks: [{
          offer_id: productId,
          stock: quantity
        }]
      });

      if (response.data.result[0].errors.length > 0) {
        throw new Error(response.data.result[0].errors[0].message);
      }

      return response.data.result[0];
    } catch (error) {
      console.error('Ozon updateStock error:', error);
      throw new Error(`Failed to update stock on Ozon: ${error.message}`);
    }
  }

  // Обновление цен
  async updatePrices(priceUpdates) {
    try {
      const prices = priceUpdates.map(update => ({
        offer_id: update.productId,
        price: update.price.toString(),
        old_price: update.oldPrice ? update.oldPrice.toString() : "0",
        premium_price: update.premiumPrice ? update.premiumPrice.toString() : ""
      }));

      const response = await this.client.post('/v1/product/import/prices', {
        prices
      });

      return response.data.result;
    } catch (error) {
      console.error('Ozon updatePrices error:', error);
      throw new Error(`Failed to update prices on Ozon: ${error.message}`);
    }
  }

  // Получение заказов (с поддержкой постраничной выборки при params.all === true)
  async getOrders(params = {}) {
    try {
      const limit = params.limit || 100;
      let offset = params.offset || 0;
      const base = {
        dir: 'DESC',
        filter: {
          since: params.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          to: params.to || new Date().toISOString(),
          status: params.status || ''
        },
        with: {
          analytics_data: true,
          financial_data: true
        }
      };

      if (!params.all) {
        const response = await this.client.post('/v3/posting/fbs/list', { ...base, limit, offset });
        return {
          orders: response.data.result.postings,
          hasMore: response.data.result.has_next
        };
      }

      const allOrders = [];
      let hasNext = true;
      while (hasNext) {
        const response = await this.client.post('/v3/posting/fbs/list', { ...base, limit, offset });
        const chunk = response.data?.result?.postings || [];
        allOrders.push(...chunk);
        hasNext = Boolean(response.data?.result?.has_next);
        offset += limit;
        if (chunk.length === 0) break;
      }
      return { orders: allOrders, hasMore: false };
    } catch (error) {
      console.error('Ozon getOrders error:', error);
      throw new Error(`Failed to fetch orders from Ozon: ${error.message}`);
    }
  }

  // Получение информации о товарах (при params.all === true — чтение всех страниц через last_id)
  async getProducts(params = {}) {
    try {
      const limit = params.limit || 100;
      const base = {
        filter: { visibility: 'ALL' },
        sort_by: params.sortBy || 'updated_at',
        sort_dir: params.sortDir || 'DESC'
      };

      if (!params.all) {
        const response = await this.client.post('/v2/product/list', { ...base, limit, last_id: params.lastId || '' });
        return {
          products: response.data.result.items,
          total: response.data.result.total,
          lastId: response.data.result.last_id
        };
      }

      const allProducts = [];
      let lastId = '';
      // Первоначальное значение может быть передано извне
      if (params.lastId) lastId = params.lastId;
      while (true) {
        const response = await this.client.post('/v2/product/list', { ...base, limit, last_id: lastId });
        const result = response.data?.result || {};
        const items = result.items || [];
        allProducts.push(...items);
        if (!result.last_id || items.length === 0) break;
        lastId = result.last_id;
      }
      return { products: allProducts, total: allProducts.length, lastId: null };
    } catch (error) {
      console.error('Ozon getProducts error:', error);
      throw new Error(`Failed to fetch products from Ozon: ${error.message}`);
    }
  }

  // Получение детальной информации о товаре
  async getProductInfo(productIds) {
    try {
      const response = await this.client.post('/v2/product/info', {
        offer_id: productIds
      });

      return response.data.result.items;
    } catch (error) {
      console.error('Ozon getProductInfo error:', error);
      throw new Error(`Failed to fetch product info from Ozon: ${error.message}`);
    }
  }

  // Обновление статуса заказа
  async updateOrderStatus(orderId, status) {
    try {
      let endpoint;
      let payload;

      switch (status) {
        case 'shipped':
          endpoint = '/v3/posting/fbs/ship';
          payload = {
            packages: [{
              posting_number: orderId
            }]
          };
          break;
        case 'cancelled':
          endpoint = '/v2/posting/fbs/cancel';
          payload = {
            cancel_reason_id: 352, // Нет товара в наличии
            cancel_reason_message: 'Out of stock',
            posting_number: orderId
          };
          break;
        default:
          throw new Error(`Unsupported status: ${status}`);
      }

      const response = await this.client.post(endpoint, payload);
      return response.data.result;
    } catch (error) {
      console.error('Ozon updateOrderStatus error:', error);
      throw new Error(`Failed to update order status on Ozon: ${error.message}`);
    }
  }

  // Создание или обновление товаров
  async importProducts(products) {
    try {
      const items = products.map(product => ({
        offer_id: product.offer_id,
        name: product.name,
        category_id: product.category_id,
        barcode: product.barcode || '',
        vat: product.vat || '0',
        weight: product.weight || 100,
        width: product.width || 10,
        height: product.height || 10,
        depth: product.depth || 10,
        dimension_unit: 'mm',
        weight_unit: 'g',
        images: product.images || [],
        primary_image: product.primary_image || '',
        attributes: product.attributes || []
      }));

      const response = await this.client.post('/v2/product/import', {
        items
      });

      return response.data.result;
    } catch (error) {
      console.error('Ozon importProducts error:', error);
      throw new Error(`Failed to import products to Ozon: ${error.message}`);
    }
  }

  // Получение складов
  async getWarehouses() {
    try {
      const response = await this.client.post('/v1/warehouse/list');
      return response.data.result;
    } catch (error) {
      console.error('Ozon getWarehouses error:', error);
      throw new Error(`Failed to fetch warehouses from Ozon: ${error.message}`);
    }
  }

  // Получение категорий
  async getCategories() {
    try {
      const response = await this.client.post('/v2/category/tree');
      return response.data.result;
    } catch (error) {
      console.error('Ozon getCategories error:', error);
      throw new Error(`Failed to fetch categories from Ozon: ${error.message}`);
    }
  }

  // Получение атрибутов категории
  async getCategoryAttributes(categoryId) {
    try {
      const response = await this.client.post('/v3/category/attribute/list', {
        category_id: [categoryId]
      });
      return response.data.result[0].attributes;
    } catch (error) {
      console.error('Ozon getCategoryAttributes error:', error);
      throw new Error(`Failed to fetch category attributes from Ozon: ${error.message}`);
    }
  }

  // Тестирование подключения
  async testConnection() {
    try {
      await this.getWarehouses();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = OzonAdapter;

