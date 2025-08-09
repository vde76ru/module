const axios = require('axios');

class ETMAdapter {
  constructor(config) {
    this.username = config.username;
    this.password = config.password;
    this.baseURL = 'https://ipro.etm.ru/api/v1';
    this.sessionKey = null;
    this.sessionExpiry = null;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Интерцептор для автоматической авторизации
    this.client.interceptors.request.use(async (config) => {
      if (!config.url.includes('/user/login') && !this.isSessionValid()) {
        await this.authenticate();
      }
      
      if (this.sessionKey && !config.url.includes('/user/login')) {
        config.headers['Authorization'] = `Basic ${this.sessionKey}`;
      }
      
      return config;
    });
  }

  // Проверка валидности сессии
  isSessionValid() {
    return this.sessionKey && this.sessionExpiry && new Date() < this.sessionExpiry;
  }

  // Авторизация
  async authenticate() {
    try {
      const authString = `${this.username}:${this.password}`;
      const base64Auth = Buffer.from(authString).toString('base64');
      
      const response = await this.client.post('/user/login', null, {
        headers: {
          'Authorization': `Basic ${base64Auth}`
        },
        params: {
          log: this.username,
          pwd: this.password
        }
      });

      if (response.data.status.code === 200) {
        this.sessionKey = response.data.data.session;
        // Сессия действительна 2 часа
        this.sessionExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);
        return true;
      }
      
      throw new Error('Authentication failed');
    } catch (error) {
      console.error('ETM authenticate error:', error);
      throw new Error(`Failed to authenticate with ETM: ${error.message}`);
    }
  }

  // Получение списка складов
  async getWarehouses() {
    try {
      const response = await this.client.get('/goods');
      
      if (response.data.status.code !== 200) {
        throw new Error(response.data.status.message);
      }

      // Извлекаем уникальные склады из ответа
      const warehouses = new Map();
      
      if (response.data.data && response.data.data.rows) {
        response.data.data.rows.forEach(row => {
          if (row.StoreCode && !warehouses.has(row.StoreCode)) {
            warehouses.set(row.StoreCode, {
              code: row.StoreCode,
              name: row.StoreName || row.StoreCode
            });
          }
        });
      }

      return Array.from(warehouses.values());
    } catch (error) {
      console.error('ETM getWarehouses error:', error);
      throw new Error(`Failed to fetch warehouses from ETM: ${error.message}`);
    }
  }

  // Получение товаров с остатками
  async getProducts(params = {}) {
    try {
      const queryParams = {
        id: params.productId || undefined,
        rows: params.limit || 10999 // Максимум согласно документации
      };

      // Убираем undefined параметры
      Object.keys(queryParams).forEach(key => 
        queryParams[key] === undefined && delete queryParams[key]
      );

      const response = await this.client.get('/goods', { params: queryParams });
      
      if (response.data.status.code !== 200) {
        throw new Error(response.data.status.message);
      }

      const products = [];
      
      if (response.data.data && response.data.data.rows) {
        response.data.data.rows.forEach(row => {
          // Группируем по артикулу товара
          const existingProduct = products.find(p => p.article === row.Article);
          
          if (existingProduct) {
            // Добавляем информацию о складе к существующему товару
            existingProduct.warehouses.push({
              code: row.StoreCode,
              quantity: parseInt(row.RemInfo) || 0,
              price: parseFloat(row.RemInfo) || 0 // Цена в зависимости от контекста
            });
            existingProduct.totalQuantity += parseInt(row.RemInfo) || 0;
          } else {
            // Создаем новый товар
            products.push({
              id: row.id,
              article: row.Article,
              name: row.gdsName || '',
              brand: row.gdsTechIntName || '',
              barcode: row.barcodes && row.barcodes.length > 0 ? row.barcodes[0].val : '',
              unit: row.pack || 'шт',
              minPack: parseFloat(row.minPack) || 1,
              price: parseFloat(row.gdsPrice1) || 0,
              priceRetail: parseFloat(row.gdsPrice2) || 0,
              manufacturer: {
                name: row.gdsTechIntName || '',
                description: row.gdsTechDescInt || '',
                url: row.gdsTechIntSrc || ''
              },
              totalQuantity: parseInt(row.RemInfo) || 0,
              warehouses: [{
                code: row.StoreCode,
                quantity: parseInt(row.RemInfo) || 0,
                price: parseFloat(row.RemInfo) || 0
              }]
            });
          }
        });
      }

      return {
        products,
        total: products.length
      };
    } catch (error) {
      console.error('ETM getProducts error:', error);
      throw new Error(`Failed to fetch products from ETM: ${error.message}`);
    }
  }

  // Получение информации о конкретном товаре
  async getProductInfo(productId) {
    try {
      const response = await this.client.get('/goods', {
        params: { id: productId }
      });
      
      if (response.data.status.code !== 200) {
        throw new Error(response.data.status.message);
      }

      if (response.data.data && response.data.data.rows && response.data.data.rows.length > 0) {
        const row = response.data.data.rows[0];
        
        return {
          id: row.id,
          article: row.Article,
          name: row.gdsName || '',
          brand: row.gdsTechIntName || '',
          barcode: row.barcodes && row.barcodes.length > 0 ? row.barcodes[0].val : '',
          unit: row.pack || 'шт',
          minPack: parseFloat(row.minPack) || 1,
          price: parseFloat(row.gdsPrice1) || 0,
          priceRetail: parseFloat(row.gdsPrice2) || 0,
          manufacturer: {
            name: row.gdsTechIntName || '',
            description: row.gdsTechDescInt || '',
            url: row.gdsTechIntSrc || ''
          }
        };
      }

      throw new Error('Product not found');
    } catch (error) {
      console.error('ETM getProductInfo error:', error);
      throw new Error(`Failed to fetch product info from ETM: ${error.message}`);
    }
  }

  // Получение характеристик товара
  async getProductCharacteristics(productId) {
    try {
      const response = await this.client.get('/goods/characteristics', {
        params: { id: productId }
      });
      
      if (response.data.status.code !== 200) {
        throw new Error(response.data.status.message);
      }

      const characteristics = [];
      
      if (response.data.data && response.data.data.rows) {
        response.data.data.rows.forEach(row => {
          Object.keys(row).forEach(key => {
            if (key !== 'id' && key !== 'gdsCode' && row[key]) {
              characteristics.push({
                name: key,
                value: row[key]
              });
            }
          });
        });
      }

      return characteristics;
    } catch (error) {
      console.error('ETM getProductCharacteristics error:', error);
      throw new Error(`Failed to fetch product characteristics from ETM: ${error.message}`);
    }
  }

  // Получение остатков на складе
  async getStockLevels(warehouseCode = null) {
    try {
      const params = { rows: 10999 };
      
      const response = await this.client.get('/goods/remains', { params });
      
      if (response.data.status.code !== 200) {
        throw new Error(response.data.status.message);
      }

      const stockLevels = [];
      
      if (response.data.data && response.data.data.rows) {
        response.data.data.rows.forEach(row => {
          if (!warehouseCode || row.StoreCode === warehouseCode) {
            stockLevels.push({
              productId: row.id,
              article: row.Article,
              warehouseCode: row.StoreCode,
              quantity: parseInt(row.RemInfo) || 0,
              reserved: parseInt(row.Reserved) || 0,
              available: (parseInt(row.RemInfo) || 0) - (parseInt(row.Reserved) || 0)
            });
          }
        });
      }

      return stockLevels;
    } catch (error) {
      console.error('ETM getStockLevels error:', error);
      throw new Error(`Failed to fetch stock levels from ETM: ${error.message}`);
    }
  }

  // Создание заказа
  async createOrder(orderData) {
    try {
      const orderItems = orderData.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        warehouseCode: item.warehouseCode || 'DEFAULT'
      }));

      // ETM API может не поддерживать создание заказов через API
      // Это заглушка для будущей реализации
      console.log('Creating order at ETM:', orderItems);
      
      return {
        orderId: `ETM-${Date.now()}`,
        status: 'pending',
        items: orderItems
      };
    } catch (error) {
      console.error('ETM createOrder error:', error);
      throw new Error(`Failed to create order at ETM: ${error.message}`);
    }
  }

  // Тестирование подключения
  async testConnection() {
    try {
      await this.authenticate();
      
      // Пробуем получить список товаров с лимитом 1
      const response = await this.client.get('/goods', {
        params: { rows: 1 }
      });
      
      if (response.data.status.code === 200) {
        return { 
          success: true, 
          message: 'Connection successful',
          sessionKey: this.sessionKey
        };
      }
      
      return { 
        success: false, 
        message: response.data.status.message || 'Connection failed'
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.status?.message || error.message 
      };
    }
  }

  // Поиск товаров по названию
  async searchProducts(searchTerm) {
    try {
      // ETM API не поддерживает прямой поиск, получаем все товары и фильтруем
      const allProducts = await this.getProducts({ limit: 10999 });
      
      const searchLower = searchTerm.toLowerCase();
      const filteredProducts = allProducts.products.filter(product => 
        product.name.toLowerCase().includes(searchLower) ||
        product.article.toLowerCase().includes(searchLower) ||
        (product.brand && product.brand.toLowerCase().includes(searchLower))
      );

      return {
        products: filteredProducts,
        total: filteredProducts.length
      };
    } catch (error) {
      console.error('ETM searchProducts error:', error);
      throw new Error(`Failed to search products at ETM: ${error.message}`);
    }
  }

  // Получение производителей
  async getManufacturers() {
    try {
      // Получаем все товары и извлекаем уникальных производителей
      const allProducts = await this.getProducts({ limit: 10999 });
      
      const manufacturers = new Map();
      
      allProducts.products.forEach(product => {
        if (product.manufacturer && product.manufacturer.name && !manufacturers.has(product.manufacturer.name)) {
          manufacturers.set(product.manufacturer.name, product.manufacturer);
        }
      });

      return Array.from(manufacturers.values());
    } catch (error) {
      console.error('ETM getManufacturers error:', error);
      throw new Error(`Failed to fetch manufacturers from ETM: ${error.message}`);
    }
  }
}

module.exports = ETMAdapter;
