// ===================================================
// ФАЙЛ: backend/src/services/OrderOrchestrationService.js
// ПОЛНАЯ РЕАЛИЗАЦИЯ: Управление заказами и закупками
// ===================================================

const { Pool } = require('pg');
const logger = require('../utils/logger');

class OrderOrchestrationService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Обработка входящего заказа с маркетплейса
   */
  async processIncomingOrder(orderData) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Создаем входящий заказ
      const orderResult = await client.query(`
        INSERT INTO incoming_orders (
          company_id, marketplace_id, order_number, marketplace_order_id,
          customer_name, customer_email, customer_phone,
          status, payment_status, payment_method,
          delivery_type, delivery_service, delivery_cost,
          delivery_address, total_amount, commission_amount,
          net_amount, currency, order_date, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING id
      `, [
        orderData.company_id,
        orderData.marketplace_id,
        orderData.order_number,
        orderData.marketplace_order_id,
        orderData.customer_name,
        orderData.customer_email,
        orderData.customer_phone,
        orderData.status || 'new',
        orderData.payment_status || 'pending',
        orderData.payment_method,
        orderData.delivery_type,
        orderData.delivery_service,
        orderData.delivery_cost || 0,
        JSON.stringify(orderData.delivery_address || {}),
        orderData.total_amount,
        orderData.commission_amount || 0,
        orderData.net_amount,
        orderData.currency || 'RUB',
        orderData.order_date || new Date(),
        JSON.stringify(orderData.metadata || {})
      ]);

      const orderId = orderResult.rows[0].id;

      // Добавляем товары в заказ
      const orderItems = [];
      for (const item of orderData.items) {
        const itemResult = await client.query(`
          INSERT INTO incoming_order_items (
            order_id, product_id, external_product_id,
            product_name, product_sku, product_variant,
            quantity, unit_price, total_price,
            discount_amount, commission_amount, status,
            raw_data
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          ) RETURNING id
        `, [
          orderId,
          item.product_id,
          item.external_product_id,
          item.product_name,
          item.product_sku,
          item.product_variant,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.discount_amount || 0,
          item.commission_amount || 0,
          'new',
          JSON.stringify(item.raw_data || {})
        ]);

        orderItems.push({ ...item, id: itemResult.rows[0].id });
      }

      // Запускаем процесс резервирования товаров
      await this.reserveOrderItems(client, orderId, orderItems);

      // Проверяем необходимость закупки
      await this.checkProcurementNeeds(client, orderData.company_id, orderItems);

      await client.query('COMMIT');

      logger.info(`Processed incoming order ${orderData.order_number}`, { orderId });

      return {
        success: true,
        orderId,
        message: 'Order processed successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing incoming order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Резервирование товаров для заказа
   */
  async reserveOrderItems(client, orderId, orderItems) {
    for (const item of orderItems) {
      if (!item.product_id) continue;

      // Находим склады с доступными остатками
      const stockResult = await client.query(`
        SELECT wpl.warehouse_id, wpl.available_quantity, w.priority
        FROM warehouse_product_links wpl
        JOIN warehouses w ON wpl.warehouse_id = w.id
        WHERE wpl.product_id = $1 AND wpl.available_quantity >= $2
        ORDER BY w.priority DESC, wpl.available_quantity DESC
        LIMIT 1
      `, [item.product_id, item.quantity]);

      if (stockResult.rows.length > 0) {
        const warehouse = stockResult.rows[0];

        // Резервируем товар
        await client.query(`
          UPDATE warehouse_product_links
          SET reserved_quantity = reserved_quantity + $3,
              available_quantity = quantity - reserved_quantity - $3
          WHERE warehouse_id = $1 AND product_id = $2
        `, [warehouse.warehouse_id, item.product_id, item.quantity]);

        // Обновляем статус позиции заказа
        await client.query(`
          UPDATE incoming_order_items
          SET status = 'reserved',
              warehouse_id = $2,
              reserved_quantity = $3
          WHERE id = $1
        `, [item.id, warehouse.warehouse_id, item.quantity]);

        logger.info(`Reserved ${item.quantity} units of product ${item.product_id} from warehouse ${warehouse.warehouse_id}`);
      } else {
        // Товара нет в наличии - нужна закупка
        await client.query(`
          UPDATE incoming_order_items
          SET status = 'awaiting_procurement'
          WHERE id = $1
        `, [item.id]);

        logger.warn(`Product ${item.product_id} not available in stock, procurement needed`);
      }
    }
  }

  /**
   * Проверка потребности в закупке
   */
  async checkProcurementNeeds(client, companyId, orderItems) {
    const procurementNeeds = [];

    for (const item of orderItems) {
      if (!item.product_id) continue;

      // Проверяем текущие остатки и заказы в пути
      const stockAnalysis = await client.query(`
        SELECT 
          COALESCE(SUM(wpl.available_quantity), 0) as available_stock,
          COALESCE(SUM(poi.quantity - poi.received_quantity), 0) as ordered_stock,
          p.min_order_quantity,
          spo.supplier_id,
          spo.min_order_quantity as supplier_min_qty,
          spo.purchase_price
        FROM products p
        LEFT JOIN warehouse_product_links wpl ON p.id = wpl.product_id AND wpl.is_active = true
        LEFT JOIN supplier_product_offers spo ON p.id = spo.product_id AND spo.is_available = true
        LEFT JOIN procurement_order_items poi ON p.id = poi.product_id AND poi.status IN ('ordered', 'confirmed', 'shipped')
        WHERE p.id = $1 AND p.company_id = $2
        GROUP BY p.id, p.min_order_quantity, spo.supplier_id, spo.min_order_quantity, spo.purchase_price
        ORDER BY spo.purchase_price ASC
        LIMIT 1
      `, [item.product_id, companyId]);

      if (stockAnalysis.rows.length > 0) {
        const analysis = stockAnalysis.rows[0];
        const totalAvailable = parseFloat(analysis.available_stock) + parseFloat(analysis.ordered_stock);

        // Если нужно больше товара чем есть в наличии + в заказе
        if (item.quantity > totalAvailable) {
          const needToOrder = item.quantity - totalAvailable;

          procurementNeeds.push({
            product_id: item.product_id,
            supplier_id: analysis.supplier_id,
            quantity: Math.max(needToOrder, analysis.supplier_min_qty || 1),
            unit_price: analysis.purchase_price,
            order_item_id: item.id,
            priority: 'high'
          });
        }
      }
    }

    // Создаем заказы поставщикам если есть потребности
    if (procurementNeeds.length > 0) {
      await this.createProcurementOrders(client, companyId, procurementNeeds);
    }
  }

  /**
   * Создание заказов поставщикам
   */
  async createProcurementOrders(client, companyId, procurementNeeds) {
    // Группируем по поставщикам
    const supplierGroups = procurementNeeds.reduce((groups, need) => {
      if (!groups[need.supplier_id]) {
        groups[need.supplier_id] = [];
      }
      groups[need.supplier_id].push(need);
      return groups;
    }, {});

    for (const [supplierId, items] of Object.entries(supplierGroups)) {
      if (!supplierId || supplierId === 'null') continue;

      const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

      // Создаем заказ поставщику
      const orderResult = await client.query(`
        INSERT INTO procurement_orders (
          company_id, supplier_id, order_number,
          status, total_amount, currency, priority, is_urgent
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING id
      `, [
        companyId,
        supplierId,
        `PO-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        'draft',
        totalAmount,
        'RUB',
        1,
        true
      ]);

      const procurementOrderId = orderResult.rows[0].id;

      // Добавляем позиции
      for (const item of items) {
        await client.query(`
          INSERT INTO procurement_order_items (
            procurement_order_id, product_id, incoming_order_item_id,
            product_name, quantity, unit_price, total_price, status
          ) VALUES (
            $1, $2, $3, (SELECT name FROM products WHERE id = $2), $4, $5, $6, $7
          )
        `, [
          procurementOrderId,
          item.product_id,
          item.order_item_id,
          item.quantity,
          item.unit_price,
          item.quantity * item.unit_price,
          'ordered'
        ]);
      }

      logger.info(`Created procurement order ${procurementOrderId} for supplier ${supplierId} with ${items.length} items`);
    }
  }

  /**
   * Обновление статуса заказа
   */
  async updateOrderStatus(orderId, status, comment = null) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(`
        UPDATE incoming_orders
        SET status = $2,
            processing_started = CASE WHEN $2 = 'processing' THEN NOW() ELSE processing_started END,
            processing_completed = CASE WHEN $2 IN ('shipped', 'delivered') THEN NOW() ELSE processing_completed END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [orderId, status]);

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      // Логируем изменение статуса
      if (comment) {
        await client.query(`
          INSERT INTO order_status_history (
            order_id, status, comment, created_at
          ) VALUES ($1, $2, $3, NOW())
        `, [orderId, status, comment]);
      }

      await client.query('COMMIT');

      logger.info(`Order ${orderId} status updated to ${status}`);

      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating order status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получение статистики заказов
   */
  async getOrdersStats(companyId, period = '7d') {
    try {
      const dateFilter = this.getDateFilter(period);

      const result = await this.pool.query(`
        SELECT
          COUNT(*) as total_orders,
          COUNT(*) FILTER (WHERE status = 'new') as new_orders,
          COUNT(*) FILTER (WHERE status = 'processing') as processing_orders,
          COUNT(*) FILTER (WHERE status = 'shipped') as shipped_orders,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(SUM(net_amount), 0) as net_revenue,
          COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM incoming_orders
        WHERE company_id = $1 AND created_at >= $2
      `, [companyId, dateFilter]);

      return result.rows[0];

    } catch (error) {
      logger.error('Error getting orders stats:', error);
      throw error;
    }
  }

  /**
   * Получение фильтра даты для статистики
   */
  getDateFilter(period) {
    const now = new Date();
    switch (period) {
      case '1d':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }
}

module.exports = new OrderOrchestrationService();