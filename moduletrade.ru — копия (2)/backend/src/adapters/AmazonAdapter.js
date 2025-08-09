// ===================================================
// ФАЙЛ: backend/src/adapters/AmazonAdapter.js
// АДАПТЕР: Amazon Marketplace Integration
// ===================================================

const axios = require('axios');
const logger = require('../utils/logger');

class AmazonAdapter {
  constructor(config = {}) {
    this.config = {
      accessKeyId: config.access_key_id || process.env.AMAZON_ACCESS_KEY_ID,
      secretAccessKey: config.secret_access_key || process.env.AMAZON_SECRET_ACCESS_KEY,
      region: config.region || process.env.AMAZON_REGION || 'us-east-1',
      marketplaceId: config.marketplace_id || process.env.AMAZON_MARKETPLACE_ID,
      sellerId: config.seller_id || process.env.AMAZON_SELLER_ID,
      baseUrl: 'https://sellingpartnerapi-na.amazon.com',
      ...config
    };
    
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-amz-access-token': this.config.accessKeyId,
        'x-amz-date': new Date().toISOString()
      }
    });
  }

  /**
   * Получение списка товаров
   */
  async getProducts(params = {}) {
    try {
      const response = await this.client.get('/catalog/v0/items', {
        params: {
          marketplaceIds: this.config.marketplaceId,
          ...params
        }
      });

      return this.transformProducts(response.data.items);
    } catch (error) {
      logger.error('Amazon getProducts error:', error);
      throw new Error(`Failed to get Amazon products: ${error.message}`);
    }
  }

  /**
   * Получение информации о товаре
   */
  async getProduct(asin) {
    try {
      const response = await this.client.get(`/catalog/v0/items/${asin}`, {
        params: {
          marketplaceIds: this.config.marketplaceId
        }
      });

      return this.transformProduct(response.data);
    } catch (error) {
      logger.error('Amazon getProduct error:', error);
      throw new Error(`Failed to get Amazon product: ${error.message}`);
    }
  }

  /**
   * Получение заказов
   */
  async getOrders(params = {}) {
    try {
      const response = await this.client.get('/orders/v0/orders', {
        params: {
          MarketplaceIds: this.config.marketplaceId,
          ...params
        }
      });

      return this.transformOrders(response.data.Orders);
    } catch (error) {
      logger.error('Amazon getOrders error:', error);
      throw new Error(`Failed to get Amazon orders: ${error.message}`);
    }
  }

  /**
   * Обновление остатков
   */
  async updateStock(asin, quantity) {
    try {
      const response = await this.client.put(`/inventory/v0/inventorySummaries`, {
        marketplaceId: this.config.marketplaceId,
        asin: asin,
        quantity: quantity
      });

      return response.data;
    } catch (error) {
      logger.error('Amazon updateStock error:', error);
      throw new Error(`Failed to update Amazon stock: ${error.message}`);
    }
  }

  /**
   * Обновление цен
   */
  async updatePrice(asin, price) {
    try {
      const response = await this.client.put(`/pricing/v0/priceType/price`, {
        marketplaceId: this.config.marketplaceId,
        asin: asin,
        price: price
      });

      return response.data;
    } catch (error) {
      logger.error('Amazon updatePrice error:', error);
      throw new Error(`Failed to update Amazon price: ${error.message}`);
    }
  }

  /**
   * Получение категорий
   */
  async getCategories() {
    try {
      const response = await this.client.get('/catalog/v0/categories', {
        params: {
          marketplaceIds: this.config.marketplaceId
        }
      });

      return this.transformCategories(response.data.categories);
    } catch (error) {
      logger.error('Amazon getCategories error:', error);
      throw new Error(`Failed to get Amazon categories: ${error.message}`);
    }
  }

  /**
   * Получение атрибутов товара
   */
  async getProductAttributes(asin) {
    try {
      const response = await this.client.get(`/catalog/v0/items/${asin}/attributes`, {
        params: {
          marketplaceIds: this.config.marketplaceId
        }
      });

      return this.transformAttributes(response.data.attributes);
    } catch (error) {
      logger.error('Amazon getProductAttributes error:', error);
      throw new Error(`Failed to get Amazon product attributes: ${error.message}`);
    }
  }

  /**
   * Создание товара
   */
  async createProduct(productData) {
    try {
      const response = await this.client.post('/catalog/v0/items', {
        marketplaceId: this.config.marketplaceId,
        ...productData
      });

      return response.data;
    } catch (error) {
      logger.error('Amazon createProduct error:', error);
      throw new Error(`Failed to create Amazon product: ${error.message}`);
    }
  }

  /**
   * Обновление товара
   */
  async updateProduct(asin, productData) {
    try {
      const response = await this.client.put(`/catalog/v0/items/${asin}`, {
        marketplaceId: this.config.marketplaceId,
        ...productData
      });

      return response.data;
    } catch (error) {
      logger.error('Amazon updateProduct error:', error);
      throw new Error(`Failed to update Amazon product: ${error.message}`);
    }
  }

  /**
   * Удаление товара
   */
  async deleteProduct(asin) {
    try {
      const response = await this.client.delete(`/catalog/v0/items/${asin}`, {
        params: {
          marketplaceId: this.config.marketplaceId
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Amazon deleteProduct error:', error);
      throw new Error(`Failed to delete Amazon product: ${error.message}`);
    }
  }

  /**
   * Получение статистики
   */
  async getStatistics(params = {}) {
    try {
      const response = await this.client.get('/reports/v0/reports', {
        params: {
          marketplaceIds: this.config.marketplaceId,
          ...params
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Amazon getStatistics error:', error);
      throw new Error(`Failed to get Amazon statistics: ${error.message}`);
    }
  }

  /**
   * Получение отзывов
   */
  async getReviews(asin) {
    try {
      const response = await this.client.get(`/reviews/v0/reviews`, {
        params: {
          asin: asin,
          marketplaceIds: this.config.marketplaceId
        }
      });

      return response.data.reviews;
    } catch (error) {
      logger.error('Amazon getReviews error:', error);
      throw new Error(`Failed to get Amazon reviews: ${error.message}`);
    }
  }

  /**
   * Получение рейтингов
   */
  async getRatings(asin) {
    try {
      const response = await this.client.get(`/ratings/v0/ratings`, {
        params: {
          asin: asin,
          marketplaceIds: this.config.marketplaceId
        }
      });

      return response.data.ratings;
    } catch (error) {
      logger.error('Amazon getRatings error:', error);
      throw new Error(`Failed to get Amazon ratings: ${error.message}`);
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
      id: product.asin,
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
      id: data.asin,
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
      id: order.AmazonOrderId,
      marketplace_order_id: order.AmazonOrderId,
      customer_name: order.BuyerInfo?.BuyerName || '',
      customer_email: order.BuyerInfo?.BuyerEmail || '',
      total_amount: parseFloat(order.OrderTotal?.Amount || 0),
      currency: order.OrderTotal?.CurrencyCode || 'USD',
      status: order.OrderStatus,
      created_at: order.PurchaseDate,
      updated_at: order.LastUpdateDate,
      items: order.OrderItems || []
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
      id: category.id,
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
      id: attr.id,
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
      const response = await this.client.get('/catalog/v0/items', {
        params: {
          marketplaceIds: this.config.marketplaceId,
          limit: 1
        }
      });

      return response.status === 200;
    } catch (error) {
      logger.error('Amazon testConnection error:', error);
      return false;
    }
  }
}

module.exports = AmazonAdapter; 