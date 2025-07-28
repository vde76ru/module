const axios = require('axios');

class RS24Adapter {
  constructor(config) {
    this.apiKey = config.api_key;
    this.baseURL = 'https://api.rs24.ru/v1';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  // Получение списка складов
  async getWarehouses() {
    try {
      const response = await this.client.get('/warehouses');
      
      return response.data.warehouses.map(warehouse => ({
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        address: warehouse.address,
        isActive: warehouse.is_active
      }));
    } catch (error) {
      console.error('RS24 getWarehouses error:', error);
      throw new Error(`Failed to fetch warehouses from RS24: ${error.message}`);
    }
  }

  // Получение товаров с остатками
  async getProducts(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        per_page: params.limit || 100,
        warehouse_id: params.warehouseId || '',
        category_id: params.categoryId || '',
        brand_id: params.brandId || ''
      });

      const response = await this.client.get(`/products?${queryParams}`);
      
      const products = response.data.products.map(product => ({
        id: product.id,
        article: product.vendor_code,
        name: product.name,
        description: product.description,
        brand: product.brand?.name || '',
        brandId: product.brand?.id || null,
        category: product.category?.name || '',
        categoryId: product.category?.id || null,
        barcode: product.barcode,
        unit: product.unit || 'шт',
        minOrderQuantity: product.min_order_quantity || 1,
        multiplicity: product.multiplicity || 1,
        price: parseFloat(product.price) || 0,
        priceRetail: parseFloat(product.price_retail) || 0,
        vat: product.vat || 20,
        images: product.images || [],
        weight: product.weight || 0,
        volume: product.volume || 0,
        warehouses: product.warehouses?.map(w => ({
          id: w.warehouse_id,
          quantity: w.quantity,
          reserved: w.reserved || 0,
          available: w.quantity - (w.reserved || 0)
        })) || [],
        totalQuantity: product.warehouses?.reduce((sum, w) => sum + w.quantity, 0) || 0
      }));

      return {
        products,
        total: response.data.total,
        page: response.data.page,
        perPage: response.data.per_page,
        totalPages: response.data.total_pages
      };
    } catch (error) {
      console.error('RS24 getProducts error:', error);
      throw new Error(`Failed to fetch products from RS24: ${error.message}`);
    }
  }

  // Получение информации о конкретном товаре
  async getProductInfo(productId) {
    try {
      const response = await this.client.get(`/products/${productId}`);
      const product = response.data.product;
      
      return {
        id: product.id,
        article: product.vendor_code,
        name: product.name,
        description: product.description,
        brand: product.brand?.name || '',
        brandId: product.brand?.id || null,
        category: product.category?.name || '',
        categoryId: product.category?.id || null,
        barcode: product.barcode,
        unit: product.unit || 'шт',
        minOrderQuantity: product.min_order_quantity || 1,
        multiplicity: product.multiplicity || 1,
        price: parseFloat(product.price) || 0,
        priceRetail: parseFloat(product.price_retail) || 0,
        vat: product.vat || 20,
        images: product.images || [],
        weight: product.weight || 0,
        volume: product.volume || 0,
        characteristics: product.characteristics || [],
        documents: product.documents || []
      };
    } catch (error) {
      console.error('RS24 getProductInfo error:', error);
      throw new Error(`Failed to fetch product info from RS24: ${error.message}`);
    }
  }

  // Получение категорий
  async getCategories() {
    try {
      const response = await this.client.get('/categories');
      
      const buildCategoryTree = (categories, parentId = null) => {
        return categories
          .filter(cat => cat.parent_id === parentId)
          .map(cat => ({
            id: cat.id,
            name: cat.name,
            parentId: cat.parent_id,
            children: buildCategoryTree(categories, cat.id)
          }));
      };

      return buildCategoryTree(response.data.categories);
    } catch (error) {
      console.error('RS24 getCategories error:', error);
      throw new Error(`Failed to fetch categories from RS24: ${error.message}`);
    }
  }

  // Получение брендов
  async getBrands() {
    try {
      const response = await this.client.get('/brands');
      
      return response.data.brands.map(brand => ({
        id: brand.id,
        name: brand.name,
        logo: brand.logo_url
      }));
    } catch (error) {
      console.error('RS24 getBrands error:', error);
      throw new Error(`Failed to fetch brands from RS24: ${error.message}`);
    }
  }

  // Поиск товаров
  async searchProducts(searchTerm, params = {}) {
    try {
      const queryParams = new URLSearchParams({
        q: searchTerm,
        page: params.page || 1,
        per_page: params.limit || 100
      });

      const response = await this.client.get(`/products/search?${queryParams}`);
      
      const products = response.data.products.map(product => ({
        id: product.id,
        article: product.vendor_code,
        name: product.name,
        brand: product.brand?.name || '',
        price: parseFloat(product.price) || 0,
        available: product.total_quantity > 0
      }));

      return {
        products,
        total: response.data.total
      };
    } catch (error) {
      console.error('RS24 searchProducts error:', error);
      throw new Error(`Failed to search products at RS24: ${error.message}`);
    }
  }

  // Создание заказа
  async createOrder(orderData) {
    try {
      const orderPayload = {
        external_id: orderData.externalId,
        warehouse_id: orderData.warehouseId,
        delivery_type: orderData.deliveryType || 'pickup',
        delivery_address: orderData.deliveryAddress || '',
        comment: orderData.comment || '',
        items: orderData.items.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price
        }))
      };

      const response = await this.client.post('/orders', orderPayload);
      
      return {
        orderId: response.data.order.id,
        externalId: response.data.order.external_id,
        status: response.data.order.status,
        total: response.data.order.total,
        createdAt: response.data.order.created_at
      };
    } catch (error) {
      console.error('RS24 createOrder error:', error);
      throw new Error(`Failed to create order at RS24: ${error.message}`);
    }
  }

  // Получение информации о заказе
  async getOrder(orderId) {
    try {
      const response = await this.client.get(`/orders/${orderId}`);
      const order = response.data.order;
      
      return {
        id: order.id,
        externalId: order.external_id,
        status: order.status,
        warehouseId: order.warehouse_id,
        deliveryType: order.delivery_type,
        deliveryAddress: order.delivery_address,
        total: order.total,
        items: order.items.map(item => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: item.price,
          sum: item.sum
        })),
        createdAt: order.created_at,
        updatedAt: order.updated_at
      };
    } catch (error) {
      console.error('RS24 getOrder error:', error);
      throw new Error(`Failed to fetch order from RS24: ${error.message}`);
    }
  }

  // Получение списка заказов
  async getOrders(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        per_page: params.limit || 50,
        status: params.status || '',
        date_from: params.dateFrom || '',
        date_to: params.dateTo || ''
      });

      const response = await this.client.get(`/orders?${queryParams}`);
      
      return {
        orders: response.data.orders,
        total: response.data.total,
        page: response.data.page,
        perPage: response.data.per_page,
        totalPages: response.data.total_pages
      };
    } catch (error) {
      console.error('RS24 getOrders error:', error);
      throw new Error(`Failed to fetch orders from RS24: ${error.message}`);
    }
  }

  // Отмена заказа
  async cancelOrder(orderId, reason = '') {
    try {
      const response = await this.client.post(`/orders/${orderId}/cancel`, {
        reason
      });
      
      return {
        success: true,
        order: response.data.order
      };
    } catch (error) {
      console.error('RS24 cancelOrder error:', error);
      throw new Error(`Failed to cancel order at RS24: ${error.message}`);
    }
  }

  // Получение остатков на складах
  async getStockLevels(productIds = []) {
    try {
      const queryParams = new URLSearchParams();
      productIds.forEach(id => queryParams.append('product_ids[]', id));

      const response = await this.client.get(`/stock?${queryParams}`);
      
      return response.data.stock.map(item => ({
        productId: item.product_id,
        warehouseId: item.warehouse_id,
        quantity: item.quantity,
        reserved: item.reserved || 0,
        available: item.quantity - (item.reserved || 0)
      }));
    } catch (error) {
      console.error('RS24 getStockLevels error:', error);
      throw new Error(`Failed to fetch stock levels from RS24: ${error.message}`);
    }
  }

  // Получение прайс-листа
  async getPriceList(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        format: params.format || 'json',
        warehouse_id: params.warehouseId || '',
        category_id: params.categoryId || ''
      });

      const response = await this.client.get(`/price-list?${queryParams}`);
      
      if (params.format === 'json') {
        return response.data;
      } else {
        // Для других форматов (xlsx, csv) возвращаем ссылку на скачивание
        return {
          downloadUrl: response.data.download_url,
          expiresAt: response.data.expires_at
        };
      }
    } catch (error) {
      console.error('RS24 getPriceList error:', error);
      throw new Error(`Failed to fetch price list from RS24: ${error.message}`);
    }
  }

  // Тестирование подключения
  async testConnection() {
    try {
      const response = await this.client.get('/warehouses');
      return { 
        success: true, 
        message: 'Connection successful',
        warehouses: response.data.warehouses?.length || 0
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }
}

module.exports = RS24Adapter;
