const axios = require('axios');
const BaseSupplierAdapter = require('./BaseSupplierAdapter');
const logger = require('../utils/logger');

class RestSupplierAdapter extends BaseSupplierAdapter {
  constructor(config) {
    super(config);
    this.baseURL = config.base_url || config.endpoint;
    this.authType = config.auth_type || 'none';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.timeout || 30000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...config.headers }
    });
    this.setupAuthentication();
    this.setupInterceptors();
    this.endpoints = {
      products: config.endpoints?.products || '/products',
      product_details: config.endpoints?.product_details || '/products/{id}',
      prices: config.endpoints?.prices || '/prices',
      stock: config.endpoints?.stock || '/stock',
      orders: config.endpoints?.orders || '/orders',
      order_status: config.endpoints?.order_status || '/orders/{id}',
      categories: config.endpoints?.categories || '/categories',
      brands: config.endpoints?.brands || '/brands',
      warehouses: config.endpoints?.warehouses || '/warehouses'
    };
    this.fieldMapping = config.field_mapping || {};
  }

  setupAuthentication() {
    switch (this.authType) {
      case 'basic':
        if (this.config.username && this.config.password) {
          const token = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
          this.client.defaults.headers.common['Authorization'] = `Basic ${token}`;
        }
        break;
      case 'bearer':
        if (this.config.token) {
          this.client.defaults.headers.common['Authorization'] = `Bearer ${this.config.token}`;
        }
        break;
      case 'api_key':
        if (this.config.api_key) {
          const keyHeader = this.config.api_key_header || 'X-API-Key';
          this.client.defaults.headers.common[keyHeader] = this.config.api_key;
        }
        break;
    }
  }

  setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`REST API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  async authenticate() {
    if (this.config.auth_endpoint) {
      const response = await this.client.post(this.config.auth_endpoint, {
        username: this.config.username,
        password: this.config.password,
        api_key: this.config.api_key
      });
      if (response.data.token) {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
    }
    return true;
  }

  async getProducts(params = {}) {
    const queryParams = this.buildQueryParams(params);
    const response = await this.client.get(this.endpoints.products, { params: queryParams });
    const products = this.extractData(response.data, 'products');
    return products.map((p) => this.transformProduct(p));
  }

  async getProductDetails(productId, warehouseId = null) {
    const url = this.endpoints.product_details.replace('{id}', productId);
    const params = warehouseId ? { warehouse_id: warehouseId } : {};
    const response = await this.client.get(url, { params });
    const product = this.extractData(response.data, 'product');
    return this.transformProduct(product);
  }

  async getPrices(productIds = [], warehouseId = null) {
    const params = { product_ids: productIds.join(','), warehouse_id: warehouseId };
    const response = await this.client.get(this.endpoints.prices, { params });
    const prices = this.extractData(response.data, 'prices');
    return prices.map((price) => ({
      productId: this.getFieldValue(price, 'product_id'),
      price: this.parsePrice(this.getFieldValue(price, 'price')),
      oldPrice: this.parsePrice(this.getFieldValue(price, 'old_price')),
      currency: this.getFieldValue(price, 'currency') || 'RUB',
      minQuantity: this.getFieldValue(price, 'min_quantity') || 1
    }));
  }

  async getStockLevels(productIds = [], warehouseId = null) {
    const params = { product_ids: productIds.join(','), warehouse_id: warehouseId };
    const response = await this.client.get(this.endpoints.stock, { params });
    const stocks = this.extractData(response.data, 'stock');
    return stocks.map((stock) => ({
      productId: this.getFieldValue(stock, 'product_id'),
      warehouseId: this.getFieldValue(stock, 'warehouse_id'),
      quantity: this.parseQuantity(this.getFieldValue(stock, 'quantity')),
      reserved: this.parseQuantity(this.getFieldValue(stock, 'reserved')),
      available: this.parseQuantity(this.getFieldValue(stock, 'available'))
    }));
  }

  async createOrder(orderData) {
    const order = this.transformOrderForApi(orderData);
    const response = await this.client.post(this.endpoints.orders, order);
    return this.transformOrderResponse(response.data);
  }

  async getOrderStatus(orderId) {
    const url = this.endpoints.order_status.replace('{id}', orderId);
    const response = await this.client.get(url);
    return this.transformOrderResponse(response.data);
  }

  async cancelOrder(orderId, reason = '') {
    const url = `${this.endpoints.orders}/${orderId}/cancel`;
    const response = await this.client.post(url, { reason });
    return { success: true, message: 'Order cancelled', order: this.transformOrderResponse(response.data) };
  }

  async syncProducts(options = {}) {
    const { brands = [], categories = [], limit = 1000, offset = 0 } = options;
    const params = { brands: brands.join(','), categories: categories.join(','), limit, offset };
    const products = await this.getProducts(params);
    if (products.length > 0) {
      const ids = products.map((p) => p.externalId);
      const [prices, stocks] = await Promise.all([this.getPrices(ids), this.getStockLevels(ids)]);
      products.forEach((product) => {
        const price = prices.find((p) => p.productId === product.externalId);
        const stock = stocks.find((s) => s.productId === product.externalId);
        if (price) { product.price = price.price; product.oldPrice = price.oldPrice; }
        if (stock) { product.stock = stock.available; }
      });
    }
    return { success: true, totalProducts: products.length, products };
  }

  async searchProducts(query, options = {}) {
    const params = { search: query, ...options };
    const products = await this.getProducts(params);
    return products;
  }

  async getWarehouses() {
    try {
      const response = await this.client.get(this.endpoints.warehouses);
      const warehouses = this.extractData(response.data, 'warehouses');
      return warehouses.map((w) => ({
        id: this.getFieldValue(w, 'id'),
        code: this.getFieldValue(w, 'code'),
        name: this.getFieldValue(w, 'name'),
        city: this.getFieldValue(w, 'city'),
        address: this.getFieldValue(w, 'address'),
        isActive: this.getFieldValue(w, 'is_active') !== false
      }));
    } catch (error) {
      logger.error('Failed to get warehouses:', error);
      return [];
    }
  }

  async getCategories() {
    try {
      const response = await this.client.get(this.endpoints.categories);
      const categories = this.extractData(response.data, 'categories');
      return categories.map((c) => ({ id: this.getFieldValue(c, 'id'), name: this.getFieldValue(c, 'name'), parentId: this.getFieldValue(c, 'parent_id'), level: this.getFieldValue(c, 'level') }));
    } catch (error) {
      logger.error('Failed to get categories:', error);
      return [];
    }
  }

  async getBrands() {
    try {
      const response = await this.client.get(this.endpoints.brands);
      const brands = this.extractData(response.data, 'brands');
      return brands.map((b) => ({ id: this.getFieldValue(b, 'id'), name: this.getFieldValue(b, 'name'), code: this.getFieldValue(b, 'code') }));
    } catch (error) {
      logger.error('Failed to get brands:', error);
      return [];
    }
  }

  async testConnection() {
    try {
      const start = Date.now();
      await this.authenticate();
      await this.client.get(this.endpoints.products, { params: { limit: 1 } });
      return { success: true, message: 'Connection successful', responseTime: Date.now() - start, data: { endpoint: this.baseURL, authType: this.authType } };
    } catch (error) {
      return { success: false, message: error.message, responseTime: null };
    }
  }

  buildQueryParams(params) {
    const queryParams = {};
    const paramMapping = { brands: 'brand', categories: 'category', warehouseId: 'warehouse_id', limit: 'limit', offset: 'offset', search: 'q', ...(this.config.param_mapping || {}) };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        const mappedKey = paramMapping[key] || key;
        queryParams[mappedKey] = value;
      }
    }
    return queryParams;
  }

  extractData(response, dataKey) {
    if (response[dataKey]) return response[dataKey];
    const alternative = ['data', 'result', 'items', 'rows', 'records', 'response'];
    for (const path of alternative) {
      if (response[path]) {
        if (Array.isArray(response[path])) return response[path];
        if (response[path][dataKey]) return response[path][dataKey];
      }
    }
    if (Array.isArray(response)) return response;
    return [];
  }

  getFieldValue(obj, fieldName) {
    if (!obj) return null;
    const mappedField = this.fieldMapping[fieldName] || fieldName;
    const parts = mappedField.split('.');
    let value = obj;
    for (const part of parts) value = value?.[part];
    return value;
  }

  transformProduct(data) {
    const pf = (v) => {
      if (!v && v !== 0) return null; const n = parseFloat(v); return Number.isNaN(n) ? null : n;
    };
    const pq = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 0 : n; };
    return {
      externalId: this.getFieldValue(data, 'id'),
      sku: this.getFieldValue(data, 'sku') || this.getFieldValue(data, 'article'),
      name: this.getFieldValue(data, 'name') || this.getFieldValue(data, 'title'),
      brand: this.getFieldValue(data, 'brand') || this.getFieldValue(data, 'manufacturer'),
      category: this.getFieldValue(data, 'category'),
      description: this.getFieldValue(data, 'description') || '',
      barcode: this.getFieldValue(data, 'barcode'),
      weight: pf(this.getFieldValue(data, 'weight')),
      length: pf(this.getFieldValue(data, 'length')),
      width: pf(this.getFieldValue(data, 'width')),
      height: pf(this.getFieldValue(data, 'height')),
      images: this.normalizeImages(this.getFieldValue(data, 'images')),
      attributes: this.getFieldValue(data, 'attributes') || {},
      price: this.parsePrice(this.getFieldValue(data, 'price')),
      stock: pq(this.getFieldValue(data, 'stock')),
      unit: this.getFieldValue(data, 'unit') || 'шт',
      minOrderQuantity: this.getFieldValue(data, 'min_order_quantity') || 1
    };
  }

  transformOrderForApi(orderData) {
    return {
      external_order_id: orderData.externalOrderId,
      warehouse_id: orderData.warehouseId,
      items: orderData.items.map((item) => ({ product_id: item.productId, quantity: item.quantity, price: item.price })),
      delivery_address: orderData.deliveryAddress,
      comment: orderData.comment
    };
  }

  transformOrderResponse(data) {
    const order = this.extractData(data, 'order') || data;
    return {
      orderId: this.getFieldValue(order, 'id'),
      externalOrderId: this.getFieldValue(order, 'external_order_id'),
      status: this.getFieldValue(order, 'status'),
      totalAmount: this.parsePrice(this.getFieldValue(order, 'total_amount')),
      createdAt: this.getFieldValue(order, 'created_at'),
      updatedAt: this.getFieldValue(order, 'updated_at'),
      items: this.getFieldValue(order, 'items') || []
    };
  }
}

module.exports = RestSupplierAdapter;


