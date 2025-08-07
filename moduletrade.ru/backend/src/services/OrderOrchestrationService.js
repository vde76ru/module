// ===================================================
// ФАЙЛ: backend/src/services/OrderOrchestrationService.js
// ПОЛНАЯ РЕАЛИЗАЦИЯ: Управление заказами и закупками
// ===================================================

const db = require('../config/database');
const logger = require('../utils/logger');

class OrderOrchestrationService {

  /**
   * Обработка входящего заказа с маркетплейса
   */
  async processIncomingOrder(orderData) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Создаем входящий заказ
      const orderResult = await client.query(`
        INSERT INTO incoming_orders (
          company_id, marketplace_settings_id, order_number, external_order_id,
          customer_data, delivery_address, status, payment_status, payment_method,
          delivery_method, delivery_service, delivery_cost, delivery_data,
          items_total, delivery_total, commission_total, discount_total, total_amount,
          net_amount, currency, order_date, required_ship_date, estimated_delivery_date,
          priority, tags, notes, raw_data, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        ) RETURNING id
      `, [
        orderData.company_id,
        orderData.marketplace_settings_id,
        orderData.order_number,
        orderData.external_order_id,
        JSON.stringify(orderData.customer_data || {}),
        JSON.stringify(orderData.delivery_address || {}),
        orderData.status || 'new',
        orderData.payment_status || 'pending',
        orderData.payment_method,
        orderData.delivery_method,
        orderData.delivery_service,
        orderData.delivery_cost || 0,
        JSON.stringify(orderData.delivery_data || {}),
        orderData.items_total || 0,
        orderData.delivery_total || 0,
        orderData.commission_total || 0,
        orderData.discount_total || 0,
        orderData.total_amount,
        orderData.net_amount,
        orderData.currency || 'RUB',
        orderData.order_date || new Date(),
        orderData.required_ship_date,
        orderData.estimated_delivery_date,
        orderData.priority || 0,
        orderData.tags || [],
        orderData.notes,
        JSON.stringify(orderData.raw_data || {}),
        JSON.stringify(orderData.metadata || {})
      ]);

      const orderId = orderResult.rows[0].id;

      // Добавляем товары в заказ
      const orderItems = orderData.items || [];
      
      for (const item of orderItems) {
        await client.query(`
          INSERT INTO order_items (
            order_id, product_id, external_product_id, product_sku, product_name,
            product_variant, quantity, unit_price, total_price, unit_discount,
            total_discount, commission_rate, commission_amount, status,
            raw_data, notes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
          )
        `, [
          orderId,
          item.product_id,
          item.external_product_id,
          item.product_sku,
          item.product_name,
          item.product_variant,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.unit_discount || 0,
          item.total_discount || 0,
          item.commission_rate || 0,
          item.commission_amount || 0,
          item.status || 'new',
          JSON.stringify(item.raw_data || {}),
          item.notes
        ]);
      }

      await client.query('COMMIT');

      logger.info(`Order processed successfully: ${orderData.order_number}`, {
        orderId,
        companyId: orderData.company_id,
        itemsCount: orderItems.length
      });

      return {
        success: true,
        orderId,
        message: 'Order processed successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Резервирование товаров для заказа
   */
  async reserveOrderItems(orderId, companyId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Получаем товары заказа, которые нужно зарезервировать
      const itemsResult = await client.query(`
        SELECT 
          oi.id as item_id,
          oi.product_id,
          oi.quantity,
          oi.status,
          p.name as product_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1 
          AND oi.status = 'new'
          AND p.company_id = $2
      `, [orderId, companyId]);

      const reservationResults = [];

      for (const item of itemsResult.rows) {
        try {
          // Находим склад с достаточным количеством товара
          const warehouseResult = await client.query(`
            SELECT 
              wpl.warehouse_id,
              wpl.available_quantity,
              w.name as warehouse_name
            FROM warehouse_product_links wpl
            JOIN warehouses w ON wpl.warehouse_id = w.id
            WHERE wpl.product_id = $1 
              AND wpl.available_quantity >= $2
              AND wpl.is_active = TRUE
              AND w.company_id = $3
              AND w.is_active = TRUE
            ORDER BY wpl.available_quantity DESC
            LIMIT 1
          `, [item.product_id, item.quantity, companyId]);

          if (warehouseResult.rows.length === 0) {
            reservationResults.push({
              itemId: item.item_id,
              productId: item.product_id,
              productName: item.product_name,
              requestedQuantity: item.quantity,
              reservedQuantity: 0,
              status: 'insufficient_stock',
              error: 'Insufficient stock available'
            });
            continue;
          }

          const warehouse = warehouseResult.rows[0];

          // Резервируем товар
          await client.query(`
            UPDATE warehouse_product_links
            SET 
              reserved_quantity = reserved_quantity + $1,
              updated_at = NOW()
            WHERE warehouse_id = $2 
              AND product_id = $3
          `, [item.quantity, warehouse.warehouse_id, item.product_id]);

          // Обновляем статус товара в заказе
          await client.query(`
            UPDATE order_items
            SET 
              status = 'reserved',
              warehouse_id = $1,
              reserved_quantity = $2,
              reserved_at = NOW(),
              updated_at = NOW()
            WHERE id = $3
          `, [warehouse.warehouse_id, item.quantity, item.item_id]);

          // Создаем движение товара
          await client.query(`
            INSERT INTO warehouse_movements (
              company_id, warehouse_id, product_id, movement_type,
              quantity, balance_after, document_type, document_id,
              reason, actual_date, metadata
            ) VALUES (
              $1, $2, $3, 'reservation', $4, 
              (SELECT available_quantity FROM warehouse_product_links WHERE warehouse_id = $2 AND product_id = $3),
              'order', $5, 'Order item reservation', CURRENT_DATE, $6
            )
          `, [
            companyId, 
            warehouse.warehouse_id, 
            item.product_id, 
            -item.quantity,
            orderId,
            JSON.stringify({
              order_id: orderId,
              order_item_id: item.item_id,
              reserved_quantity: item.quantity
            })
          ]);

          reservationResults.push({
            itemId: item.item_id,
            productId: item.product_id,
            productName: item.product_name,
            requestedQuantity: item.quantity,
            reservedQuantity: item.quantity,
            warehouseId: warehouse.warehouse_id,
            warehouseName: warehouse.warehouse_name,
            status: 'reserved'
          });

        } catch (itemError) {
          logger.error(`Error reserving item ${item.item_id}:`, itemError);
          reservationResults.push({
            itemId: item.item_id,
            productId: item.product_id,
            productName: item.product_name,
            requestedQuantity: item.quantity,
            reservedQuantity: 0,
            status: 'error',
            error: itemError.message
          });
        }
      }

      // Определяем общий статус заказа
      const allReserved = reservationResults.every(r => r.status === 'reserved');
      const partiallyReserved = reservationResults.some(r => r.status === 'reserved');
      
      let orderStatus = 'new';
      if (allReserved) {
        orderStatus = 'confirmed';
      } else if (partiallyReserved) {
        orderStatus = 'processing';
      }

      // Обновляем статус заказа
      await client.query(`
        UPDATE incoming_orders
        SET 
          status = $1,
          processing_started_at = CASE WHEN $1 != 'new' THEN NOW() ELSE processing_started_at END,
          updated_at = NOW()
        WHERE id = $2
      `, [orderStatus, orderId]);

      await client.query('COMMIT');

      return {
        success: true,
        orderId,
        orderStatus,
        reservationResults,
        summary: {
          totalItems: reservationResults.length,
          reservedItems: reservationResults.filter(r => r.status === 'reserved').length,
          failedItems: reservationResults.filter(r => r.status !== 'reserved').length
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error reserving order items:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Создание заказа на закупку товаров
   */
  async createProcurementOrder(orderData) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Создаем заказ на закупку
      const procurementResult = await client.query(`
        INSERT INTO procurement_orders (
          company_id, supplier_id, supplier_order_number, status,
          subtotal, tax_amount, shipping_cost, total_amount, currency,
          payment_terms, delivery_terms, order_date, expected_delivery_date,
          destination_warehouse_id, notes, terms_and_conditions, source_data
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING id, order_number
      `, [
        orderData.company_id,
        orderData.supplier_id,
        orderData.supplier_order_number,
        orderData.status || 'draft',
        orderData.subtotal || 0,
        orderData.tax_amount || 0,
        orderData.shipping_cost || 0,
        orderData.total_amount || 0,
        orderData.currency || 'RUB',
        orderData.payment_terms,
        orderData.delivery_terms,
        orderData.order_date || new Date(),
        orderData.expected_delivery_date,
        orderData.destination_warehouse_id,
        orderData.notes,
        orderData.terms_and_conditions,
        JSON.stringify(orderData.source_data || {})
      ]);

      const procurementOrderId = procurementResult.rows[0].id;
      const orderNumber = procurementResult.rows[0].order_number;

      // Добавляем товары в заказ на закупку
      const items = orderData.items || [];
      
      for (const item of items) {
        await client.query(`
          INSERT INTO procurement_order_items (
            procurement_order_id, product_id, supplier_offer_id,
            quantity, unit_cost, total_cost, status,
            expected_delivery_date, notes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          )
        `, [
          procurementOrderId,
          item.product_id,
          item.supplier_offer_id,
          item.quantity,
          item.unit_cost,
          item.total_cost,
          item.status || 'ordered',
          item.expected_delivery_date,
          item.notes
        ]);
      }

      await client.query('COMMIT');

      logger.info(`Procurement order created: ${orderNumber}`, {
        procurementOrderId,
        companyId: orderData.company_id,
        supplierId: orderData.supplier_id,
        itemsCount: items.length
      });

      return {
        success: true,
        procurementOrderId,
        orderNumber,
        message: 'Procurement order created successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating procurement order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получение статуса заказа
   */
  async getOrderStatus(orderId, companyId) {
    try {
      const result = await db.query(`
        SELECT 
          o.*,
          ms.display_name as marketplace_name,
          ms.marketplace_code,
          COUNT(oi.id) as items_count,
          COUNT(oi.id) FILTER (WHERE oi.status = 'new') as items_new,
          COUNT(oi.id) FILTER (WHERE oi.status = 'reserved') as items_reserved,
          COUNT(oi.id) FILTER (WHERE oi.status = 'allocated') as items_allocated,
          COUNT(oi.id) FILTER (WHERE oi.status = 'picked') as items_picked,
          COUNT(oi.id) FILTER (WHERE oi.status = 'packed') as items_packed,
          COUNT(oi.id) FILTER (WHERE oi.status = 'shipped') as items_shipped,
          COUNT(oi.id) FILTER (WHERE oi.status = 'delivered') as items_delivered,
          COUNT(oi.id) FILTER (WHERE oi.status = 'cancelled') as items_cancelled,
          COUNT(oi.id) FILTER (WHERE oi.status = 'returned') as items_returned
        FROM incoming_orders o
        LEFT JOIN marketplace_settings ms ON o.marketplace_settings_id = ms.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.id = $1 AND o.company_id = $2
        GROUP BY o.id, ms.display_name, ms.marketplace_code
      `, [orderId, companyId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Error getting order status:', error);
      throw error;
    }
  }

  /**
   * Обновление статуса заказа
   */
  async updateOrderStatus(orderId, companyId, newStatus, userId = null, reason = null) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Получаем текущий статус
      const currentResult = await client.query(`
        SELECT status FROM incoming_orders
        WHERE id = $1 AND company_id = $2
      `, [orderId, companyId]);

      if (currentResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      const oldStatus = currentResult.rows[0].status;

      // Обновляем статус заказа
      const updateFields = ['status = $3', 'updated_at = NOW()'];
      const updateParams = [orderId, companyId, newStatus];
      let paramIndex = 4;

      // Обновляем временные метки в зависимости от статуса
      if (newStatus === 'processing' && oldStatus === 'new') {
        updateFields.push(`processing_started_at = $${paramIndex}`);
        updateParams.push(new Date());
        paramIndex++;
      } else if (newStatus === 'packed' && oldStatus !== 'packed') {
        updateFields.push(`processing_completed_at = $${paramIndex}`);
        updateParams.push(new Date());
        paramIndex++;
      } else if (newStatus === 'shipped' && oldStatus !== 'shipped') {
        updateFields.push(`shipped_at = $${paramIndex}`);
        updateParams.push(new Date());
        paramIndex++;
      } else if (newStatus === 'delivered' && oldStatus !== 'delivered') {
        updateFields.push(`delivered_at = $${paramIndex}`);
        updateParams.push(new Date());
        paramIndex++;
      }

      await client.query(`
        UPDATE incoming_orders
        SET ${updateFields.join(', ')}
        WHERE id = $1 AND company_id = $2
      `, updateParams);

      // Записываем в историю изменений
      await client.query(`
        INSERT INTO order_status_history (
          order_id, old_status, new_status, status_type,
          change_reason, changed_by_user_id, changed_by_system,
          trigger_source, description
        ) VALUES (
          $1, $2, $3, 'order', $4, $5, $6, 'manual', $7
        )
      `, [
        orderId,
        oldStatus,
        newStatus,
        reason || 'Status update',
        userId,
        userId === null,
        reason ? `Status changed: ${reason}` : 'Status updated'
      ]);

      await client.query('COMMIT');

      logger.info(`Order status updated: ${orderId}`, {
        orderId,
        companyId,
        oldStatus,
        newStatus,
        userId,
        reason
      });

      return {
        success: true,
        orderId,
        oldStatus,
        newStatus,
        message: 'Order status updated successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating order status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Отмена заказа
   */
  async cancelOrder(orderId, companyId, reason, userId = null) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Получаем информацию о заказе и зарезервированных товарах
      const orderResult = await client.query(`
        SELECT 
          o.status,
          oi.id as item_id,
          oi.product_id,
          oi.warehouse_id,
          oi.reserved_quantity,
          oi.status as item_status
        FROM incoming_orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.id = $1 AND o.company_id = $2
      `, [orderId, companyId]);

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      const orderData = orderResult.rows[0];

      // Проверяем, можно ли отменить заказ
      if (['shipped', 'delivered', 'cancelled'].includes(orderData.status)) {
        throw new Error(`Cannot cancel order in status: ${orderData.status}`);
      }

      // Освобождаем зарезервированные товары
      for (const item of orderResult.rows) {
        if (item.reserved_quantity > 0 && item.warehouse_id) {
          // Уменьшаем резерв
          await client.query(`
            UPDATE warehouse_product_links
            SET 
              reserved_quantity = reserved_quantity - $1,
              updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3
          `, [item.reserved_quantity, item.warehouse_id, item.product_id]);

          // Создаем движение товара
          await client.query(`
            INSERT INTO warehouse_movements (
              company_id, warehouse_id, product_id, movement_type,
              quantity, balance_after, document_type, document_id,
              reason, actual_date, metadata
            ) VALUES (
              $1, $2, $3, 'reservation_cancel', $4,
              (SELECT available_quantity FROM warehouse_product_links WHERE warehouse_id = $2 AND product_id = $3),
              'order', $5, $6, CURRENT_DATE, $7
            )
          `, [
            companyId,
            item.warehouse_id,
            item.product_id,
            item.reserved_quantity,
            orderId,
            `Order cancellation: ${reason}`,
            JSON.stringify({
              order_id: orderId,
              order_item_id: item.item_id,
              cancelled_quantity: item.reserved_quantity,
              reason: reason
            })
          ]);
        }

        // Обновляем статус товара в заказе
        await client.query(`
          UPDATE order_items
          SET 
            status = 'cancelled',
            cancelled_quantity = quantity,
            updated_at = NOW()
          WHERE id = $1
        `, [item.item_id]);
      }

      // Обновляем статус заказа
      await client.query(`
        UPDATE incoming_orders
        SET 
          status = 'cancelled',
          updated_at = NOW()
        WHERE id = $1 AND company_id = $2
      `, [orderId, companyId]);

      // Записываем в историю
      await client.query(`
        INSERT INTO order_status_history (
          order_id, old_status, new_status, status_type,
          change_reason, changed_by_user_id, changed_by_system,
          trigger_source, description
        ) VALUES (
          $1, $2, 'cancelled', 'order', $3, $4, $5, 'manual', $6
        )
      `, [
        orderId,
        orderData.status,
        'Order cancellation',
        userId,
        userId === null,
        `Order cancelled: ${reason}`
      ]);

      await client.query('COMMIT');

      logger.info(`Order cancelled: ${orderId}`, {
        orderId,
        companyId,
        reason,
        userId
      });

      return {
        success: true,
        orderId,
        message: 'Order cancelled successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error cancelling order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получение списка заказов
   */
  async getOrders(companyId, filters = {}) {
    try {
      let query = `
        SELECT 
          o.*,
          ms.display_name as marketplace_name,
          ms.marketplace_code,
          COUNT(oi.id) as items_count,
          SUM(oi.quantity) as total_quantity,
          COUNT(oi.id) FILTER (WHERE oi.status IN ('new', 'confirmed')) as items_pending
        FROM incoming_orders o
        LEFT JOIN marketplace_settings ms ON o.marketplace_settings_id = ms.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.company_id = $1
      `;

      const params = [companyId];
      let paramIndex = 2;

      // Применяем фильтры
      if (filters.status) {
        query += ` AND o.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.payment_status) {
        query += ` AND o.payment_status = $${paramIndex}`;
        params.push(filters.payment_status);
        paramIndex++;
      }

      if (filters.marketplace_id) {
        query += ` AND o.marketplace_settings_id = $${paramIndex}`;
        params.push(filters.marketplace_id);
        paramIndex++;
      }

      if (filters.date_from) {
        query += ` AND o.order_date >= $${paramIndex}`;
        params.push(filters.date_from);
        paramIndex++;
      }

      if (filters.date_to) {
        query += ` AND o.order_date <= $${paramIndex}`;
        params.push(filters.date_to);
        paramIndex++;
      }

      if (filters.search) {
        query += ` AND (o.order_number ILIKE $${paramIndex} OR o.external_order_id ILIKE $${paramIndex} OR o.customer_data->>'name' ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      query += ` GROUP BY o.id, ms.display_name, ms.marketplace_code`;

      // Сортировка
      const sortBy = filters.sort_by || 'order_date';
      const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY o.${sortBy} ${sortOrder}`;

      // Пагинация
      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }

      if (filters.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(filters.offset);
        paramIndex++;
      }

      const result = await db.query(query, params);

      return result.rows;

    } catch (error) {
      logger.error('Error getting orders:', error);
      throw error;
    }
  }

  /**
   * Закрытие подключения к базе данных
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = OrderOrchestrationService;