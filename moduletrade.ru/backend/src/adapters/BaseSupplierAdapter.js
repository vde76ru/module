const logger = require('../utils/logger');

class BaseSupplierAdapter {
  constructor(config) {
    this.config = config || {};
    this.name = config.name || 'Unknown Supplier';
    this.type = config.type || 'unknown';
    this.isActive = config.is_active !== false;
  }

  async authenticate() { throw new Error('Method authenticate() must be implemented'); }
  async getProducts() { throw new Error('Method getProducts() must be implemented'); }
  async getProductDetails() { throw new Error('Method getProductDetails() must be implemented'); }
  async getPrices() { throw new Error('Method getPrices() must be implemented'); }
  async getStockLevels() { throw new Error('Method getStockLevels() must be implemented'); }
  async createOrder() { throw new Error('Method createOrder() must be implemented'); }
  async getOrderStatus() { throw new Error('Method getOrderStatus() must be implemented'); }
  async cancelOrder() { throw new Error('Method cancelOrder() must be implemented'); }
  async syncProducts() { throw new Error('Method syncProducts() must be implemented'); }
  async searchProducts() { throw new Error('Method searchProducts() must be implemented'); }
  async testConnection() { throw new Error('Method testConnection() must be implemented'); }
  async getWarehouses() { return []; }
  async getCategories() { return []; }
  async getBrands() { return []; }

  async executeWithRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try { return await fn(); } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt} failed:`, error.message);
        if (attempt < maxRetries) await this.sleep(delay * attempt);
      }
    }
    throw lastError;
  }

  sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  normalizeProduct(product) {
    return {
      externalId: product.id || product.external_id,
      sku: product.sku || product.article || product.code,
      name: product.name || product.title,
      brand: product.brand || product.manufacturer,
      category: product.category,
      description: product.description || '',
      price: parseFloat(product.price) || 0,
      stock: parseInt(product.stock || product.quantity) || 0,
      images: this.normalizeImages(product.images),
      attributes: product.attributes || product.properties || {},
      weight: parseFloat(product.weight) || null,
      dimensions: {
        length: parseFloat(product.length) || null,
        width: parseFloat(product.width) || null,
        height: parseFloat(product.height) || null
      },
      barcode: product.barcode || product.ean || product.gtin,
      unit: product.unit || 'шт',
      minOrderQuantity: product.min_order_quantity || 1
    };
  }

  normalizeImages(images) {
    if (!images) return [];
    if (typeof images === 'string') return images.split(',').map((u) => u.trim()).filter(Boolean);
    if (Array.isArray(images)) {
      return images.map((img) => (typeof img === 'string' ? img : img.url || img.src || img.image)).filter(Boolean);
    }
    return [];
  }

  validateConfig() {
    const required = this.getRequiredConfigFields();
    const missing = [];
    for (const field of required) { if (!this.config[field]) missing.push(field); }
    if (missing.length > 0) { throw new Error(`Missing required config fields: ${missing.join(', ')}`); }
    return true;
  }

  getRequiredConfigFields() { return []; }

  log(level, message, data = {}) { logger[level](`[${this.name}] ${message}`, data); }

  handleApiError(error) {
    const info = { supplier: this.name, type: this.type, message: error.message, status: error.response?.status, data: error.response?.data };
    logger.error('Supplier API error:', info);
    if (error.response?.status === 401) throw new Error('Authentication failed. Please check credentials.');
    if (error.response?.status === 403) throw new Error('Access denied. Please check permissions.');
    if (error.response?.status === 404) throw new Error('Resource not found.');
    if (error.response?.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (error.response?.status >= 500) throw new Error('Supplier server error. Please try again later.');
    throw new Error(`Supplier API error: ${error.message}`);
  }

  formatDate(date) { if (!date) return null; const d = new Date(date); return d.toISOString(); }

  parsePrice(price) {
    if (!price) return 0;
    if (typeof price === 'number') return price;
    const clean = price.toString().replace(/[^\d.,]/g, '');
    return parseFloat(clean.replace(',', '.')) || 0;
  }

  parseQuantity(quantity) {
    if (!quantity && quantity !== 0) return 0;
    if (typeof quantity === 'number') return Math.floor(quantity);
    const parsed = parseInt(quantity, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
}

module.exports = BaseSupplierAdapter;


