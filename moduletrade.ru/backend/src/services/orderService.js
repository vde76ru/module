const db = require('../config/database');
const logger = require('../utils/logger');
const redis = require('../config/redis');

class OrderService {
  /**
   * Обработка входящего заказа с маркетплейса
   */
  static async processIncomingOrder(companyId, orderData) {
    const transaction = await db.query('BEGIN');
    
    try {
      // Создаем заказ
      const order = await this.createOrder(companyId, orderData);
      
      // Обрабатываем товары заказа
      const orderItems = await this.processOrderItems(companyId, order.id, orderData.items);
      
      // Определяем тип заказа и правила обработки
      const orderType = this.determineOrderType(orderData);
      const processingRules = await this.getOrderProcessingRules(companyId, orderType);
      
      // Применяем правила обработки
      await this.applyOrderProcessingRules(order.id, orderType, processingRules);
      
      // Если заказ для бизнеса - ждем оплаты
      if (orderType === 'business') {
        await this.setOrderStatus(order.id, 'waiting_payment');
      } else {
        // Для розничных заказов - резервируем товар
        await this.reserveOrderItems(order.id);
        await this.setOrderStatus(order.id, 'confirmed');
      }
      
      await transaction.query('COMMIT');
      
      return {
        order_id: order.id,
        status: order.status,
        type: orderType,
        total_items: orderItems.length
      };
      
    } catch (error) {
      await transaction.query('ROLLBACK');
      logger.error('Order processing failed:', error);
      throw error;
    }
  }

  /**
   * Создание заказа
   */
  static async createOrder(companyId, orderData) {
    const query = `
      INSERT INTO orders (
        company_id, external_id, marketplace_id, customer_name, customer_email,
        customer_phone, delivery_address, order_type, total_amount, currency,
        payment_method, delivery_method, notes, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
      RETURNING *
    `;
    
    const result = await db.query(query, [
      companyId, orderData.external_id, orderData.marketplace_id,
      orderData.customer_name, orderData.customer_email, orderData.customer_phone,
      orderData.delivery_address, orderData.order_type || 'retail',
      orderData.total_amount, orderData.currency || 'RUB',
      orderData.payment_method, orderData.delivery_method,
      orderData.notes, 'new'
    ]);
    
    return result.rows[0];
  }

  /**
   * Обработка товаров заказа
   */
  static async processOrderItems(companyId, orderId, items) {
    const orderItems = [];
    
    for (const item of items) {
      // Находим товар по артикулу или внешнему ID
      const product = await this.findProduct(companyId, item.sku, item.external_product_id);
      
      if (!product) {
        logger.warn(`Product not found for SKU: ${item.sku}`);
        continue;
      }
      
      // Создаем позицию заказа
      const orderItem = await this.createOrderItem(orderId, product.id, item);
      orderItems.push(orderItem);
    }
    
    return orderItems;
  }

  /**
   * Поиск товара
   */
  static async findProduct(companyId, sku, externalProductId) {
    let query = `
      SELECT p.* FROM products p
      WHERE p.company_id = $1 AND p.is_active = true
    `;
    
    const params = [companyId];
    
    if (sku) {
      params.push(sku);
      query += ` AND p.sku = $${params.length}`;
    } else if (externalProductId) {
      params.push(externalProductId);
      query += ` AND p.external_id = $${params.length}`;
    } else {
      return null;
    }
    
    const result = await db.query(query, params);
    return result.rows[0];
  }

  /**
   * Создание позиции заказа
   */
  static async createOrderItem(orderId, productId, itemData) {
    const query = `
      INSERT INTO order_items (
        order_id, product_id, quantity, unit_price, total_price,
        sku, product_name, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
      RETURNING *
    `;
    
    const result = await db.query(query, [
      orderId, productId, itemData.quantity, itemData.unit_price,
      itemData.quantity * itemData.unit_price, itemData.sku, itemData.product_name
    ]);
    
    return result.rows[0];
  }

  /**
   * Определение типа заказа
   */
  static determineOrderType(orderData) {
    // Проверяем признаки бизнес-заказа
    const businessIndicators = [
      orderData.customer_type === 'business',
      orderData.delivery_address?.includes('ООО') || orderData.delivery_address?.includes('ИП'),
      orderData.customer_name?.includes('ООО') || orderData.customer_name?.includes('ИП'),
      orderData.payment_method === 'invoice',
      orderData.total_amount > 50000 // Заказы на сумму более 50к считаем бизнесом
    ];
    
    const businessScore = businessIndicators.filter(Boolean).length;
    
    return businessScore >= 2 ? 'business' : 'retail';
  }

  /**
   * Получение правил обработки заказов
   */
  static async getOrderProcessingRules(companyId, orderType) {
    const query = `
      SELECT * FROM order_processing_rules 
      WHERE company_id = $1 AND order_type = $2 AND is_active = true
      ORDER BY priority
    `;
    
    const result = await db.query(query, [companyId, orderType]);
    return result.rows;
  }

  /**
   * Применение правил обработки заказа
   */
  static async applyOrderProcessingRules(orderId, orderType, rules) {
    for (const rule of rules) {
      switch (rule.action) {
        case 'auto_confirm':
          await this.setOrderStatus(orderId, 'confirmed');
          break;
          
        case 'wait_payment':
          await this.setOrderStatus(orderId, 'waiting_payment');
          break;
          
        case 'auto_order_supplier':
          await this.createSupplierOrder(orderId);
          break;
          
        case 'assign_warehouse':
          await this.assignWarehouseToOrder(orderId, rule.warehouse_id);
          break;
      }
    }
  }

  /**
   * Резервирование товаров заказа
   */
  static async reserveOrderItems(orderId) {
    const query = `
      SELECT oi.*, p.id as product_id, p.name as product_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `;
    
    const result = await db.query(query, [orderId]);
    const orderItems = result.rows;
    
    for (const item of orderItems) {
      // Находим склад с достаточным количеством
      const warehouse = await this.findAvailableWarehouse(item.product_id, item.quantity);
      
      if (warehouse) {
        // Резервируем товар
        await this.reserveStock(warehouse.id, item.product_id, item.quantity, orderId);
        
        // Связываем позицию заказа со складом
        await this.assignItemToWarehouse(item.id, warehouse.id);
      } else {
        // Если нет остатков - создаем заказ у поставщика
        await this.createSupplierOrder(orderId);
        break;
      }
    }
  }

  /**
   * Поиск доступного склада
   */
  static async findAvailableWarehouse(productId, requiredQuantity) {
    const query = `
      SELECT w.*, ws.quantity
      FROM warehouses w
      JOIN warehouse_stocks ws ON w.id = ws.warehouse_id
      WHERE ws.product_id = $1 
        AND ws.quantity >= $2
        AND w.is_active = true
      ORDER BY w.priority DESC, ws.quantity DESC
      LIMIT 1
    `;
    
    const result = await db.query(query, [productId, requiredQuantity]);
    return result.rows[0];
  }

  /**
   * Резервирование товара
   */
  static async reserveStock(warehouseId, productId, quantity, orderId) {
    const query = `
      UPDATE warehouse_stocks 
      SET reserved_quantity = reserved_quantity + $3,
          updated_at = now()
      WHERE warehouse_id = $1 AND product_id = $2
    `;
    
    await db.query(query, [warehouseId, productId, quantity]);
    
    // Записываем резервирование
    await this.recordStockReservation(warehouseId, productId, quantity, orderId);
  }

  /**
   * Запись резервирования товара
   */
  static async recordStockReservation(warehouseId, productId, quantity, orderId) {
    const query = `
      INSERT INTO stock_reservations (
        warehouse_id, product_id, order_id, quantity, status, created_at
      ) VALUES ($1, $2, $3, $4, 'active', now())
    `;
    
    await db.query(query, [warehouseId, productId, orderId, quantity]);
  }

  /**
   * Создание заказа у поставщика
   */
  static async createSupplierOrder(orderId) {
    const order = await this.getOrder(orderId);
    const orderItems = await this.getOrderItems(orderId);
    
    // Группируем товары по поставщикам
    const supplierGroups = await this.groupItemsBySupplier(order.company_id, orderItems);
    
    for (const [supplierId, items] of Object.entries(supplierGroups)) {
      // Создаем заказ у поставщика
      const supplierOrder = await this.createSupplierOrderRecord(orderId, supplierId, items);
      
      // Отправляем заказ поставщику
      await this.sendOrderToSupplier(supplierOrder.id, supplierId, items);
    }
  }

  /**
   * Группировка товаров по поставщикам
   */
  static async groupItemsBySupplier(companyId, orderItems) {
    const supplierGroups = {};
    
    for (const item of orderItems) {
      // Получаем основного поставщика товара
      const product = await this.getProduct(item.product_id);
      const supplierId = product.main_supplier_id;
      
      if (!supplierGroups[supplierId]) {
        supplierGroups[supplierId] = [];
      }
      
      supplierGroups[supplierId].push(item);
    }
    
    return supplierGroups;
  }

  /**
   * Создание записи заказа у поставщика
   */
  static async createSupplierOrderRecord(orderId, supplierId, items) {
    const query = `
      INSERT INTO supplier_orders (
        order_id, supplier_id, status, total_amount, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, now(), now())
      RETURNING *
    `;
    
    const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
    
    const result = await db.query(query, [
      orderId, supplierId, 'pending', totalAmount
    ]);
    
    return result.rows[0];
  }

  /**
   * Отправка заказа поставщику
   */
  static async sendOrderToSupplier(supplierOrderId, supplierId, items) {
    // Получаем данные поставщика
    const supplier = await this.getSupplier(supplierId);
    
    // Формируем данные заказа для поставщика
    const orderData = {
      supplier_order_id: supplierOrderId,
      items: items.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price
      }))
    };
    
    // Отправляем заказ через API поставщика
    try {
      const response = await this.sendOrderToSupplierAPI(supplier, orderData);
      
      // Обновляем статус заказа
      await this.updateSupplierOrderStatus(supplierOrderId, 'sent', response.external_order_id);
      
    } catch (error) {
      logger.error('Failed to send order to supplier:', error);
      await this.updateSupplierOrderStatus(supplierOrderId, 'failed');
    }
  }

  /**
   * Отправка заказа через API поставщика
   */
  static async sendOrderToSupplierAPI(supplier, orderData) {
    // Здесь будет логика отправки заказа конкретному поставщику
    // Пока заглушка
    return {
      external_order_id: `EXT_${Date.now()}`,
      status: 'accepted'
    };
  }

  /**
   * Обновление статуса заказа у поставщика
   */
  static async updateSupplierOrderStatus(supplierOrderId, status, externalOrderId = null) {
    const query = `
      UPDATE supplier_orders 
      SET status = $2, external_order_id = $3, updated_at = now()
      WHERE id = $1
    `;
    
    await db.query(query, [supplierOrderId, status, externalOrderId]);
  }

  /**
   * Установка статуса заказа
   */
  static async setOrderStatus(orderId, status) {
    const query = `
      UPDATE orders 
      SET status = $2, updated_at = now()
      WHERE id = $1
    `;
    
    await db.query(query, [orderId, status]);
  }

  /**
   * Получение заказа
   */
  static async getOrder(orderId) {
    const query = 'SELECT * FROM orders WHERE id = $1';
    const result = await db.query(query, [orderId]);
    return result.rows[0];
  }

  /**
   * Получение товаров заказа
   */
  static async getOrderItems(orderId) {
    const query = 'SELECT * FROM order_items WHERE order_id = $1';
    const result = await db.query(query, [orderId]);
    return result.rows;
  }

  /**
   * Получение товара
   */
  static async getProduct(productId) {
    const query = 'SELECT * FROM products WHERE id = $1';
    const result = await db.query(query, [productId]);
    return result.rows[0];
  }

  /**
   * Получение поставщика
   */
  static async getSupplier(supplierId) {
    const query = 'SELECT * FROM suppliers WHERE id = $1';
    const result = await db.query(query, [supplierId]);
    return result.rows[0];
  }

  /**
   * Привязка позиции заказа к складу
   */
  static async assignItemToWarehouse(orderItemId, warehouseId) {
    const query = `
      UPDATE order_items 
      SET warehouse_id = $2, updated_at = now()
      WHERE id = $1
    `;
    
    await db.query(query, [orderItemId, warehouseId]);
  }

  /**
   * Привязка склада к заказу
   */
  static async assignWarehouseToOrder(orderId, warehouseId) {
    const query = `
      UPDATE orders 
      SET warehouse_id = $2, updated_at = now()
      WHERE id = $1
    `;
    
    await db.query(query, [orderId, warehouseId]);
  }

  /**
   * Получение заказов для обработки
   */
  static async getOrdersForProcessing(companyId, filters = {}) {
    let whereConditions = ['o.company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (filters.status) {
      whereConditions.push(`o.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.order_type) {
      whereConditions.push(`o.order_type = $${paramIndex}`);
      params.push(filters.order_type);
      paramIndex++;
    }

    if (filters.date_from) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      params.push(filters.date_from);
      paramIndex++;
    }

    if (filters.date_to) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      params.push(filters.date_to);
      paramIndex++;
    }

    const query = `
      SELECT o.*, 
             COUNT(oi.id) as items_count,
             SUM(oi.total_price) as total_amount
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    
    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = OrderService; 