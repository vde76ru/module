const axios = require('axios');

class WildberriesAdapter {
  constructor(config) {
    this.apiKey = config.api_key;
    this.baseURL = 'https://suppliers-api.wildberries.ru';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  // Обновление остатков
  async updateStock(stockUpdates) {
    try {
      const stocks = stockUpdates.map(update => ({
        barcode: update.barcode,
        stock: update.quantity,
        warehouseId: update.warehouseId || 507 // Коледино по умолчанию
      }));

      const response = await this.client.put('/api/v3/stocks', {
        stocks
      });

      return response.data;
    } catch (error) {
      console.error('Wildberries updateStock error:', error);
      throw new Error(`Failed to update stock on Wildberries: ${error.message}`);
    }
  }

  // Обновление цен
  async updatePrices(priceUpdates) {
    try {
      const prices = priceUpdates.map(update => ({
        nmId: parseInt(update.productId),
        price: Math.round(update.price),
        discount: update.discount || 0,
        promoCode: update.promoCode || ''
      }));

      const response = await this.client.post('/public/api/v1/prices', prices);
      return response.data;
    } catch (error) {
      console.error('Wildberries updatePrices error:', error);
      throw new Error(`Failed to update prices on Wildberries: ${error.message}`);
    }
  }

  // Получение заказов
  async getOrders(params = {}) {
    try {
      const dateFrom = params.dateFrom || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dateTo = params.dateTo || new Date();
      
      const queryParams = new URLSearchParams({
        dateFrom: Math.floor(dateFrom.getTime() / 1000),
        dateTo: Math.floor(dateTo.getTime() / 1000),
        status: params.status || 0, // 0 - все статусы
        take: params.limit || 1000,
        skip: params.skip || 0
      });

      const response = await this.client.get(`/api/v3/orders?${queryParams}`);
      
      return {
        orders: response.data.orders || [],
        total: response.data.total || 0
      };
    } catch (error) {
      console.error('Wildberries getOrders error:', error);
      throw new Error(`Failed to fetch orders from Wildberries: ${error.message}`);
    }
  }

  // Получение новых заказов
  async getNewOrders() {
    try {
      const response = await this.client.get('/api/v3/orders/new');
      return response.data.orders || [];
    } catch (error) {
      console.error('Wildberries getNewOrders error:', error);
      throw new Error(`Failed to fetch new orders from Wildberries: ${error.message}`);
    }
  }

  // Обновление статуса заказа
  async updateOrderStatus(orderId, status) {
    try {
      const statusMap = {
        'confirm': '/api/v3/orders/confirm', // Принять в работу
        'assemble': '/api/v3/orders/assemble', // Передать на сборку
        'cancel': '/api/v3/orders/cancel', // Отменить
        'deliver': '/api/v3/supplies/orders/deliver' // Передать курьеру
      };

      const endpoint = statusMap[status];
      if (!endpoint) {
        throw new Error(`Unsupported status: ${status}`);
      }

      const response = await this.client.patch(endpoint, {
        orders: [orderId]
      });

      return response.data;
    } catch (error) {
      console.error('Wildberries updateOrderStatus error:', error);
      throw new Error(`Failed to update order status on Wildberries: ${error.message}`);
    }
  }

  // Получение товаров
  async getProducts(params = {}) {
    try {
      const response = await this.client.post('/content/v1/cards/cursor/list', {
        sort: {
          cursor: {
            limit: params.limit || 100
          },
          filter: {
            withPhoto: params.withPhoto || -1
          }
        }
      });

      return {
        products: response.data.data.cards || [],
        cursor: response.data.data.cursor
      };
    } catch (error) {
      console.error('Wildberries getProducts error:', error);
      throw new Error(`Failed to fetch products from Wildberries: ${error.message}`);
    }
  }

  // Создание карточек товаров
  async createProducts(products) {
    try {
      const cards = products.map(product => ({
        vendorCode: product.offer_id,
        variants: [{
          barcode: product.barcode,
          chrtId: 0 // Будет присвоен системой
        }],
        characteristics: product.characteristics || [],
        sizes: product.sizes || []
      }));

      const response = await this.client.post('/content/v1/cards/upload', cards);
      return response.data;
    } catch (error) {
      console.error('Wildberries createProducts error:', error);
      throw new Error(`Failed to create products on Wildberries: ${error.message}`);
    }
  }

  // Обновление карточек товаров
  async updateProducts(products) {
    try {
      const cards = products.map(product => ({
        imtId: product.imtId,
        vendorCode: product.offer_id,
        characteristics: product.characteristics || []
      }));

      const response = await this.client.post('/content/v1/cards/update', cards);
      return response.data;
    } catch (error) {
      console.error('Wildberries updateProducts error:', error);
      throw new Error(`Failed to update products on Wildberries: ${error.message}`);
    }
  }

  // Получение складов
  async getWarehouses() {
    try {
      const response = await this.client.get('/api/v3/warehouses');
      return response.data;
    } catch (error) {
      console.error('Wildberries getWarehouses error:', error);
      throw new Error(`Failed to fetch warehouses from Wildberries: ${error.message}`);
    }
  }

  // Получение категорий
  async getCategories() {
    try {
      const response = await this.client.get('/content/v1/directory/categories');
      return response.data.data;
    } catch (error) {
      console.error('Wildberries getCategories error:', error);
      throw new Error(`Failed to fetch categories from Wildberries: ${error.message}`);
    }
  }

  // Получение характеристик категории
  async getCategoryCharacteristics(categoryName) {
    try {
      const response = await this.client.get(`/content/v1/directory/${categoryName}/characteristics`);
      return response.data.data;
    } catch (error) {
      console.error('Wildberries getCategoryCharacteristics error:', error);
      throw new Error(`Failed to fetch category characteristics from Wildberries: ${error.message}`);
    }
  }

  // Получение отчета о продажах
  async getSalesReport(dateFrom, dateTo) {
    try {
      const queryParams = new URLSearchParams({
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString()
      });

      const response = await this.client.get(`/api/v1/supplier/reportDetailByPeriod?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Wildberries getSalesReport error:', error);
      throw new Error(`Failed to fetch sales report from Wildberries: ${error.message}`);
    }
  }

  // Получение информации о комиссиях
  async getCommissions() {
    try {
      const response = await this.client.get('/api/v1/tariffs/commission');
      return response.data.report;
    } catch (error) {
      console.error('Wildberries getCommissions error:', error);
      throw new Error(`Failed to fetch commissions from Wildberries: ${error.message}`);
    }
  }

  // Создание поставки
  async createSupply(name) {
    try {
      const response = await this.client.post('/api/v3/supplies', {
        name
      });
      return response.data;
    } catch (error) {
      console.error('Wildberries createSupply error:', error);
      throw new Error(`Failed to create supply on Wildberries: ${error.message}`);
    }
  }

  // Добавление заказов в поставку
  async addOrdersToSupply(supplyId, orderIds) {
    try {
      const response = await this.client.patch(`/api/v3/supplies/${supplyId}/orders`, {
        orders: orderIds
      });
      return response.data;
    } catch (error) {
      console.error('Wildberries addOrdersToSupply error:', error);
      throw new Error(`Failed to add orders to supply on Wildberries: ${error.message}`);
    }
  }

  // Тестирование подключения
  async testConnection() {
    try {
      const response = await this.client.get('/api/v3/warehouses');
      return { 
        success: true, 
        message: 'Connection successful',
        warehouses: response.data
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.error || error.message 
      };
    }
  }
}

module.exports = WildberriesAdapter;
