const axios = require('axios');
const logger = require('../utils/logger');
const BaseSupplierAdapter = require('./BaseSupplierAdapter');

/**
 * Адаптер для работы с API Русский Свет (RS24) по документации cdis.russvet.ru/rs
 */
class RS24Adapter extends BaseSupplierAdapter {
  constructor(config) {
    super(config);

    this.baseURL = config.base_url || 'https://cdis.russvet.ru/rs';
    this.login = config.login || config.username;
    this.password = config.password;
    this.basicToken = Buffer.from(`${this.login}:${this.password}`).toString('base64');

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ModuleTrade/1.0',
        Authorization: `Basic ${this.basicToken}`
      }
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  async authenticate() {
    // Basic auth is static; test by fetching stocks
    const response = await this.client.get('/stocks');
    if (response.status === 200) return true;
    throw new Error('Authentication failed');
  }

  async getWarehouses() {
    try {
      const response = await this.client.get('/stocks');
      const stocks = response.data?.Stocks || [];
      return stocks.map((s) => ({ id: s.ORGANIZATION_ID, code: String(s.ORGANIZATION_ID), name: s.NAME, isActive: true }));
    } catch (error) {
      logger.error('RS24 getWarehouses error:', error);
      throw new Error(`Failed to fetch warehouses: ${error.message}`);
    }
  }

  async getProducts(params = {}) {
    try {
      const warehouseId = params.warehouseId;
      const category = params.category || 'instock'; // instock|custom|partnerwhstock|all|custcode
      const page = params.page || 1;
      const rows = params.rows || Math.min(params.limit || 1000, 1000);
      if (!warehouseId) throw new Error('warehouseId is required');
      const response = await this.client.get(`/position/${warehouseId}/${category}`, { params: { page, rows } });
      const items = response.data?.items || [];
      return this.transformProducts(items);
    } catch (error) {
      logger.error('RS24 getProducts error:', error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  async getProductDetails(productCode /* RSCode */) {
    try {
      const response = await this.client.get(`/specs/${productCode}`);
      // specs structure is extensive; map core fields
      const info = (response.data?.INFO || [])[0] || {};
      const images = response.data?.IMG?.map((i) => ({ url: i.URL })) || [];
      return this.transformProduct({
        CODE: productCode,
        NAME: info.DESCRIPTION,
        BRAND: info.BRAND,
        VENDOR_CODE: info.VENDOR_CODE,
        UOM: info.PRIMARY_UOM,
        UOM_OKEI: info.UOM_OKEI,
        MULTIPLICITY: info.MULTIPLICITY,
        IMG: images
      });
    } catch (error) {
      logger.error('RS24 getProductDetails error:', error);
      throw new Error(`Failed to fetch product details: ${error.message}`);
    }
  }

  async getPrices(productCodes = []) {
    try {
      if (!Array.isArray(productCodes)) productCodes = [productCodes];
      const chunks = (arr, size) => arr.reduce((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
      const results = [];
      for (const group of chunks(productCodes, 50)) {
        const response = await this.client.post('/massprice', { items: group });
        for (const item of response.data || []) {
          const priceObj = item.Price || {};
          results.push({
            productId: item.RSCode,
            externalProductId: item.RSCode,
            price: this.parsePrice(priceObj.Personal ?? priceObj.Retail),
            oldPrice: null,
            currency: 'RUB',
            minQuantity: 1,
            discounts: []
          });
        }
      }
      return results;
    } catch (error) {
      logger.error('RS24 getPrices error:', error);
      throw new Error(`Failed to fetch prices: ${error.message}`);
    }
  }

  async getStockLevels(productCodes = [], warehouseId) {
    try {
      if (!warehouseId) throw new Error('warehouseId is required for stock levels');
      if (!Array.isArray(productCodes)) productCodes = [productCodes];
      const results = [];
      for (const code of productCodes) {
        const response = await this.client.get(`/residue/${warehouseId}/${code}`);
        const body = response.data || {};
        results.push({
          productId: code,
          externalProductId: code,
          warehouseId,
          quantity: this.parseQuantity(body.Residue),
          reserved: 0,
          available: this.parseQuantity(body.Residue),
          inTransit: 0,
          partnerQuantity: body.partnerQuantityInfo?.partnerQuantity || 0,
          estimatedArrivalDate: body.partnerQuantityInfo?.estimatedArrivalDate || null
        });
        // To respect rate limits: slight delay
        await this.sleep(50);
      }
      return results;
    } catch (error) {
      logger.error('RS24 getStockLevels error:', error);
      throw new Error(`Failed to fetch stock levels: ${error.message}`);
    }
  }

  // Массовая выгрузка остатков: /residue/all/{warehouseId}
  async getAllStocks(warehouseId, options = {}) {
    const { page = 1, rows = 200, category = 'skl', partnerstock = 'N' } = options;
    const response = await this.client.get(`/residue/all/${warehouseId}`, { params: { page, rows, category, partnerstock } });
    const residues = response.data?.residues || [];
    return residues.map((r) => ({
      productId: r.CODE,
      externalProductId: r.CODE,
      warehouseId,
      quantity: this.parseQuantity(r.RESIDUE),
      available: this.parseQuantity(r.RESIDUE),
      unit: r.UOM,
      unitOkei: r.UOM_OKEI,
      category: r.CATEGORY,
      partnerQuantityInfo: r.partnerQuantityInfo || null
    }));
  }

  // Массовая выгрузка остатков производителя: /partnerwhstock/all/{warehouseId}
  async getAllPartnerWarehouseStock(warehouseId, options = {}) {
    const { page = 1, rows = 500, availability = 'instock' } = options;
    const response = await this.client.get(`/partnerwhstock/all/${warehouseId}`, { params: { page, rows, availability } });
    const items = response.data?.partnerWarehouseStock || [];
    const meta = response.data?.meta || {};
    return {
      items: items.map((i) => ({
        productId: i.RSCode,
        partnerQuantity: this.parseQuantity(i.partnerQuantity),
        partnerUOM: i.partnerUOM,
        partnerUOMOKEI: i.partnerUOMOKEI,
        estimatedArrivalDate: i.estimatedArrivalDate,
        partnerQuantityDate: i.partnerQuantityDate
      })),
      meta
    };
  }

  async createOrder(orderData) {
    try {
      const order = {
        external_order_id: orderData.externalOrderId,
        warehouse_id: orderData.warehouseId,
        delivery_type: orderData.deliveryType || 'pickup',
        delivery_address: orderData.deliveryAddress,
        comment: orderData.comment,
        items: orderData.items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price
        }))
      };
      const response = await this.client.post('/orders', order);
      return {
        success: true,
        orderId: response.data.order.id,
        externalOrderId: response.data.order.external_id,
        status: response.data.order.status,
        totalAmount: response.data.order.total_amount,
        items: response.data.order.items
      };
    } catch (error) {
      logger.error('RS24 createOrder error:', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  async getOrderStatus(orderId) {
    try {
      const response = await this.client.get(`/orders/${orderId}`);
      return {
        orderId: response.data.order.id,
        externalOrderId: response.data.order.external_id,
        status: response.data.order.status,
        statusText: this.mapOrderStatus(response.data.order.status),
        totalAmount: response.data.order.total_amount,
        createdAt: response.data.order.created_at,
        updatedAt: response.data.order.updated_at,
        items: response.data.order.items
      };
    } catch (error) {
      logger.error('RS24 getOrderStatus error:', error);
      throw new Error(`Failed to get order status: ${error.message}`);
    }
  }

  async cancelOrder(orderId, reason = '') {
    try {
      const response = await this.client.post(`/orders/${orderId}/cancel`, { reason });
      return { success: true, message: 'Order cancelled successfully', order: response.data.order };
    } catch (error) {
      logger.error('RS24 cancelOrder error:', error);
      throw new Error(`Failed to cancel order: ${error.message}`);
    }
  }

  async syncProducts(options = {}) {
    try {
      logger.info('Starting RS24 product sync', options);
      const { brands = [], categories = [], updateExisting = false } = options;
      const warehouses = await this.getWarehouses();
      const activeWarehouses = warehouses.filter((w) => w.isActive);
      const allProducts = [];

      for (const warehouse of activeWarehouses) {
        const products = await this.getProducts({
          warehouseId: warehouse.id,
          brands,
          inStock: true,
          limit: 5000
        });

        if (products.length > 0) {
          const productIds = products.map((p) => p.externalId);
          const [prices, stocks] = await Promise.all([
            this.getPrices(productIds, warehouse.id),
            this.getStockLevels(productIds, warehouse.id)
          ]);

          products.forEach((product) => {
            const price = prices.find((p) => p.externalProductId === product.externalId);
            const stock = stocks.find((s) => s.externalProductId === product.externalId);
            product.price = price?.price || 0;
            product.oldPrice = price?.oldPrice;
            product.stock = stock?.available || 0;
            product.warehouseId = warehouse.id;
            product.warehouseName = warehouse.name;
          });
        }

        allProducts.push(...products);
      }

      logger.info(`Synced ${allProducts.length} products from RS24`);
      return { success: true, totalProducts: allProducts.length, products: allProducts, warehouses: activeWarehouses };
    } catch (error) {
      logger.error('RS24 syncProducts error:', error);
      throw new Error(`Product sync failed: ${error.message}`);
    }
  }

  async searchProducts(query, options = {}) {
    try {
      const response = await this.client.post('/finditem', { vendorCode: query });
      const items = response.data?.items || [];
      // Map to product structure
      const mapped = items.map((i) => ({
        CODE: i.code,
        NAME: i.name,
        BRAND: i.brand,
        VENDOR_CODE: i.vendorCode,
        UOM: i.uom,
        UOM_OKEI: i.uomOkei
      }));
      return this.transformProducts(mapped);
    } catch (error) {
      logger.error('RS24 searchProducts error:', error);
      throw new Error(`Product search failed: ${error.message}`);
    }
  }

  transformProduct(data) {
    return {
      externalId: data.CODE || data.id || data.external_id,
      sku: data.VENDOR_CODE || data.article || data.sku,
      name: data.NAME || data.name,
      brand: data.BRAND || data.brand,
      category: data.CATEGORY || data.category,
      description: data.description || '',
      barcode: data.barcode,
      weight: data.weight ? parseFloat(data.weight) : null,
      length: data.length ? parseFloat(data.length) : null,
      width: data.width ? parseFloat(data.width) : null,
      height: data.height ? parseFloat(data.height) : null,
      volume: data.volume ? parseFloat(data.volume) : null,
      images: this.extractImages(data.IMG || data.images),
      attributes: data.properties || {},
      manufacturer: data.manufacturer,
      countryOfOrigin: data.ORIGIN_COUNTRY || data.country_of_origin,
      minOrderQuantity: data.MIN_ORDER_QUANTITY || 1,
      multiplicity: data.MULTIPLICITY || 1,
      unit: data.UOM || data.unit || 'шт'
    };
  }

  transformProducts(products) {
    return products.map((product) => this.transformProduct(product));
  }

  extractImages(images) {
    if (!images) return [];
    if (Array.isArray(images)) {
      return images.map((img) => ({ url: img.url || img, type: img.type || 'main', position: img.position || 0 }));
    }
    if (typeof images === 'string') {
      return images.split(',').map((url) => ({ url: url.trim(), type: 'main', position: 0 }));
    }
    return [];
  }

  mapOrderStatus(status) {
    const statusMap = {
      new: 'Новый',
      confirmed: 'Подтвержден',
      processing: 'В обработке',
      ready: 'Готов к выдаче',
      shipped: 'Отгружен',
      delivered: 'Доставлен',
      cancelled: 'Отменен',
      returned: 'Возвращен'
    };
    return statusMap[status] || status;
  }

  async testConnection() {
    try {
      const startTime = Date.now();
      await this.authenticate();
      const warehouses = await this.getWarehouses();
      const responseTime = Date.now() - startTime;
      return {
        success: true,
        message: 'Connection successful',
        responseTime,
        data: { warehousesCount: warehouses.length, warehouses: warehouses.map((w) => ({ id: w.id, name: w.name })) }
      };
    } catch (error) {
      logger.error('RS24 connection test failed:', error);
      return { success: false, message: error.message, responseTime: null };
    }
  }
}

module.exports = RS24Adapter;
