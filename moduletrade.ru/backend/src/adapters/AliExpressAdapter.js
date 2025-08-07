// ===================================================
// ФАЙЛ: backend/src/adapters/AliExpressAdapter.js
// АДАПТЕР: AliExpress Marketplace Integration
// ===================================================

const axios = require('axios');
const logger = require('../utils/logger');

class AliExpressAdapter {
  constructor(config = {}) {
    this.config = {
      appKey: config.app_key || process.env.ALIEXPRESS_APP_KEY,
      appSecret: config.app_secret || process.env.ALIEXPRESS_APP_SECRET,
      accessToken: config.access_token || process.env.ALIEXPRESS_ACCESS_TOKEN,
      baseUrl: 'https://api.aliexpress.com/v2',
      ...config
    };
    
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.accessToken}`
      }
    });
  }

  /**
   * Получение списка товаров
   */
  async getProducts(params = {}) {
    try {
      const response = await this.client.post('/product.list', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken,
        ...params
      });

      return this.transformProducts(response.data.result);
    } catch (error) {
      logger.error('AliExpress getProducts error:', error);
      throw new Error(`Failed to get AliExpress products: ${error.message}`);
    }
  }

  /**
   * Получение информации о товаре
   */
  async getProduct(productId) {
    try {
      const response = await this.client.post('/product.details', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken,
        product_id: productId
      });

      return this.transformProduct(response.data.result);
    } catch (error) {
      logger.error('AliExpress getProduct error:', error);
      throw new Error(`Failed to get AliExpress product: ${error.message}`);
    }
  }

  /**
   * Получение заказов
   */
  async getOrders(params = {}) {
    try {
      const response = await this.client.post('/order.list', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken,
        ...params
      });

      return this.transformOrders(response.data.result);
    } catch (error) {
      logger.error('AliExpress getOrders error:', error);
      throw new Error(`Failed to get AliExpress orders: ${error.message}`);
    }
  }

  /**
   * Обновление остатков
   */
  async updateStock(productId, quantity) {
    try {
      const response = await this.client.post('/product.stock.update', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken,
        product_id: productId,
        quantity: quantity
      });

      return response.data.result;
    } catch (error) {
      logger.error('AliExpress updateStock error:', error);
      throw new Error(`Failed to update AliExpress stock: ${error.message}`);
    }
  }

  /**
   * Обновление цен
   */
  async updatePrice(productId, price) {
    try {
      const response = await this.client.post('/product.price.update', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken,
        product_id: productId,
        price: price
      });

      return response.data.result;
    } catch (error) {
      logger.error('AliExpress updatePrice error:', error);
      throw new Error(`Failed to update AliExpress price: ${error.message}`);
    }
  }

  /**
   * Получение категорий
   */
  async getCategories() {
    try {
      const response = await this.client.post('/category.list', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken
      });

      return this.transformCategories(response.data.result);
    } catch (error) {
      logger.error('AliExpress getCategories error:', error);
      throw new Error(`Failed to get AliExpress categories: ${error.message}`);
    }
  }

  /**
   * Получение атрибутов товара
   */
  async getProductAttributes(productId) {
    try {
      const response = await this.client.post('/product.attributes', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken,
        product_id: productId
      });

      return this.transformAttributes(response.data.result);
    } catch (error) {
      logger.error('AliExpress getProductAttributes error:', error);
      throw new Error(`Failed to get AliExpress product attributes: ${error.message}`);
    }
  }

  /**
   * Создание товара
   */
  async createProduct(productData) {
    try {
      const response = await this.client.post('/product.create', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken,
        ...productData
      });

      return response.data.result;
    } catch (error) {
      logger.error('AliExpress createProduct error:', error);
      throw new Error(`Failed to create AliExpress product: ${error.message}`);
    }
  }

  /**
   * Обновление товара
   */
  async updateProduct(productId, productData) {
    try {
      const response = await this.client.post('/product.update', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken,
        product_id: productId,
        ...productData
      });

      return response.data.result;
    } catch (error) {
      logger.error('AliExpress updateProduct error:', error);
      throw new Error(`Failed to update AliExpress product: ${error.message}`);
    }
  }

  /**
   * Удаление товара
   */
  async deleteProduct(productId) {
    try {
      const response = await this.client.post('/product.delete', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken,
        product_id: productId
      });

      return response.data.result;
    } catch (error) {
      logger.error('AliExpress deleteProduct error:', error);
      throw new Error(`Failed to delete AliExpress product: ${error.message}`);
    }
  }

  /**
   * Получение статистики
   */
  async getStatistics(params = {}) {
    try {
      const response = await this.client.post('/statistics.get', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken,
        ...params
      });

      return response.data.result;
    } catch (error) {
      logger.error('AliExpress getStatistics error:', error);
      throw new Error(`Failed to get AliExpress statistics: ${error.message}`);
    }
  }

  /**
   * Трансформация товаров
   */
  transformProducts(data) {
    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map(product => ({
      id: product.product_id,
      name: product.title,
      description: product.description,
      price: parseFloat(product.price || 0),
      currency: product.currency || 'USD',
      category_id: product.category_id,
      brand: product.brand,
      images: product.images || [],
      attributes: product.attributes || {},
      stock: parseInt(product.stock || 0),
      status: product.status,
      created_at: product.created_at,
      updated_at: product.updated_at
    }));
  }

  /**
   * Трансформация товара
   */
  transformProduct(data) {
    if (!data) {
      return null;
    }

    return {
      id: data.product_id,
      name: data.title,
      description: data.description,
      price: parseFloat(data.price || 0),
      currency: data.currency || 'USD',
      category_id: data.category_id,
      brand: data.brand,
      images: data.images || [],
      attributes: data.attributes || {},
      stock: parseInt(data.stock || 0),
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  /**
   * Трансформация заказов
   */
  transformOrders(data) {
    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map(order => ({
      id: order.order_id,
      marketplace_order_id: order.ali_order_id,
      customer_name: order.buyer_name,
      customer_email: order.buyer_email,
      total_amount: parseFloat(order.total_amount || 0),
      currency: order.currency || 'USD',
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.items || []
    }));
  }

  /**
   * Трансформация категорий
   */
  transformCategories(data) {
    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map(category => ({
      id: category.category_id,
      name: category.name,
      parent_id: category.parent_id,
      level: category.level,
      path: category.path
    }));
  }

  /**
   * Трансформация атрибутов
   */
  transformAttributes(data) {
    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map(attr => ({
      id: attr.attribute_id,
      name: attr.name,
      value: attr.value,
      type: attr.type
    }));
  }

  /**
   * Проверка соединения
   */
  async testConnection() {
    try {
      const response = await this.client.post('/auth.test', {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        access_token: this.config.accessToken
      });

      return response.data.result.success;
    } catch (error) {
      logger.error('AliExpress testConnection error:', error);
      return false;
    }
  }
}

module.exports = AliExpressAdapter; 