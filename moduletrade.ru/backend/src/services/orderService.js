const db = require('../config/database');
const logger = require('../utils/logger');
const supplierFactory = require('../adapters/SupplierFactory');
const cryptoUtils = require('../utils/crypto');

/**
 * Сервис обработки заказов (создание и отправка заказов поставщикам)
 */
class OrderService {
  static async createOrder(orderData) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const order = await this.createMainOrder(client, orderData);
      const orderItems = await this.createOrderItems(client, order.id, orderData.items);
      await this.reserveProducts(client, orderItems);
      await this.processSupplierOrders(client, order.id, orderItems);
      await this.createProcessingLog(client, order.id, 'created', 'Заказ создан');

      await client.query('COMMIT');
      return { success: true, order };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Order creation failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async createMainOrder(client, orderData) {
    const result = await client.query(
      `
      INSERT INTO orders (
        company_id, external_order_id, internal_order_number,
        marketplace_id, customer_name, customer_email, customer_phone,
        shipping_address, payment_method,
        total_amount, commission_amount, order_date, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING *
      `,
      [
        orderData.companyId,
        orderData.externalOrderId,
        orderData.internalOrderNumber || OrderService.generateOrderNumber(),
        orderData.marketplaceId,
        orderData.customerName,
        orderData.customerEmail,
        orderData.customerPhone,
        JSON.stringify(orderData.deliveryAddress || orderData.shippingAddress || {}),
        orderData.paymentMethod || 'card',
        orderData.totalPrice,
        orderData.commissionAmount || 0,
        orderData.orderDate || new Date(),
        'new'
      ]
    );
    return result.rows[0];
  }

  static async createOrderItems(client, orderId, items) {
    const orderItems = [];
    for (const item of items) {
      const productResult = await client.query(
        `
        SELECT p.*, w.id as default_warehouse_id
        FROM products p
        LEFT JOIN warehouses w ON w.company_id = p.company_id AND w.is_default = true
        WHERE p.id = $1
        `,
        [item.productId]
      );
      if (productResult.rows.length === 0) throw new Error(`Product ${item.productId} not found`);
      const product = productResult.rows[0];
      const itemResult = await client.query(
        `
        INSERT INTO order_items (
          order_id, product_id, quantity, unit_price, total_price,
          cost_price, warehouse_id, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING *
        `,
        [
          orderId,
          item.productId,
          item.quantity,
          item.price,
          item.quantity * item.price,
          item.costPrice || 0,
          item.warehouseId || product.default_warehouse_id,
          'pending'
        ]
      );
      orderItems.push({ ...itemResult.rows[0], product });
    }
    return orderItems;
  }

  static async reserveProducts(client, orderItems) {
    for (const item of orderItems) {
      const stockResult = await client.query(
        `SELECT * FROM warehouse_product_links WHERE warehouse_id = $1 AND product_id = $2`,
        [item.warehouse_id, item.product_id]
      );
      if (stockResult.rows.length > 0) {
        const stock = stockResult.rows[0];
        const availableQuantity = stock.available_quantity || 0;
        if (availableQuantity >= item.quantity) {
          await client.query(
            `
            UPDATE warehouse_product_links
            SET
              reserved_quantity = reserved_quantity + $3,
              available_quantity = available_quantity - $3,
              updated_at = NOW()
            WHERE warehouse_id = $1 AND product_id = $2
            `,
            [item.warehouse_id, item.product_id, item.quantity]
          );
          await client.query(`UPDATE order_items SET status = 'reserved' WHERE id = $1`, [item.id]);
        } else {
          item.needSupplierOrder = true;
          item.missingQuantity = item.quantity - availableQuantity;
        }
      } else {
        item.needSupplierOrder = true;
        item.missingQuantity = item.quantity;
      }
    }
  }

  static async processSupplierOrders(client, orderId, orderItems) {
    const supplierGroups = {};
    for (const item of orderItems) {
      if (item.needSupplierOrder && item.product.main_supplier_id) {
        const supplierId = item.product.main_supplier_id;
        if (!supplierGroups[supplierId]) supplierGroups[supplierId] = [];
        supplierGroups[supplierId].push(item);
      }
    }
    for (const [supplierId, items] of Object.entries(supplierGroups)) {
      await this.createSupplierOrder(client, orderId, supplierId, items);
    }
  }

  static async createSupplierOrder(client, orderId, supplierId, items) {
    try {
      logger.info(`Creating supplier order for supplier ${supplierId}`);
      const supplierResult = await client.query(`SELECT * FROM suppliers WHERE id = $1`, [supplierId]);
      if (supplierResult.rows.length === 0) throw new Error(`Supplier ${supplierId} not found`);
      const supplier = supplierResult.rows[0];
      const supplierOrderResult = await client.query(
        `
        INSERT INTO supplier_orders (
          company_id, order_id, supplier_id, order_number,
          status, total_amount, currency, order_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, NOW()
        ) RETURNING *
        `,
        [
          supplier.company_id,
          orderId,
          supplierId,
          OrderService.generateSupplierOrderNumber(),
          'pending',
          items.reduce((sum, item) => sum + item.missingQuantity * item.unit_price, 0),
          'RUB'
        ]
      );
      const supplierOrder = supplierOrderResult.rows[0];

      const supplierOrderItems = [];
      for (const item of items) {
        const mappingResult = await client.query(
          `SELECT external_product_id, external_sku FROM supplier_product_mappings WHERE product_id = $1 AND supplier_id = $2`,
          [item.product_id, supplierId]
        );
        const mapping = mappingResult.rows[0] || {};
        const supplierItemResult = await client.query(
          `
          INSERT INTO supplier_order_items (
            supplier_order_id, product_id, external_product_id,
            name, quantity, unit_price, total_price, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          ) RETURNING *
          `,
          [
            supplierOrder.id,
            item.product_id,
            mapping.external_product_id || mapping.external_sku,
            item.product.name,
            item.missingQuantity,
            item.unit_price,
            item.missingQuantity * item.unit_price,
            'pending'
          ]
        );
        supplierOrderItems.push({ ...supplierItemResult.rows[0], externalProductId: mapping.external_product_id, externalSku: mapping.external_sku });
      }

      if (supplier.api_config) {
        try {
          let apiConfig = supplier.api_config;
          if (typeof apiConfig === 'string' && cryptoUtils.isEncrypted(apiConfig)) apiConfig = cryptoUtils.decrypt(apiConfig);
          const adapter = supplierFactory.createAdapter(supplier.api_type, apiConfig);
          const orderData = {
            externalOrderId: supplierOrder.order_number,
            warehouseId: supplier.default_warehouse_id,
            items: supplierOrderItems.map((i) => ({ productId: i.externalProductId || i.external_product_id, quantity: i.quantity, price: i.unit_price })),
            deliveryType: 'pickup',
            comment: `Order from ModuleTrade #${orderId}`
          };
          const apiResponse = await adapter.createOrder(orderData);
          if (apiResponse.success) {
            await client.query(`UPDATE supplier_orders SET external_order_number = $2, status = 'sent', updated_at = NOW() WHERE id = $1`, [supplierOrder.id, apiResponse.orderId]);
            logger.info(`Supplier order ${supplierOrder.id} sent successfully. External ID: ${apiResponse.orderId}`);
          } else {
            throw new Error('Failed to send order to supplier');
          }
        } catch (error) {
          logger.error(`Failed to send order to supplier ${supplierId}:`, error);
          await client.query(`UPDATE supplier_orders SET status = 'error', notes = $2, updated_at = NOW() WHERE id = $1`, [supplierOrder.id, error.message]);
        }
      }
      return supplierOrder;
    } catch (error) {
      logger.error(`Failed to create supplier order:`, error);
      throw error;
    }
  }

  static async updateOrderStatus(orderId, status, notes = null) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1`, [orderId, status]);
      await this.createProcessingLog(client, orderId, status, notes);
      switch (status) {
        case 'confirmed':
          await this.confirmOrder(client, orderId);
          break;
        case 'shipped':
          await this.shipOrder(client, orderId);
          break;
        case 'delivered':
          await this.deliverOrder(client, orderId);
          break;
        case 'cancelled':
          await this.cancelOrder(client, orderId, notes);
          break;
      }
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to update order status:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async confirmOrder(client, orderId) {
    await client.query(`UPDATE order_items SET status = 'confirmed' WHERE order_id = $1 AND status = 'reserved'`, [orderId]);
    const supplierOrders = await client.query(`SELECT * FROM supplier_orders WHERE order_id = $1 AND status = 'pending'`, [orderId]);
    for (const supplierOrder of supplierOrders.rows) {
      await client.query(`UPDATE supplier_orders SET status = 'confirmed' WHERE id = $1`, [supplierOrder.id]);
    }
  }

  static async shipOrder(client, orderId) {
    const items = await client.query(`SELECT * FROM order_items WHERE order_id = $1 AND status = 'confirmed'`, [orderId]);
    for (const item of items.rows) {
      await client.query(
        `
        UPDATE warehouse_product_links
        SET
          quantity = quantity - $3,
          reserved_quantity = reserved_quantity - $3,
          updated_at = NOW()
        WHERE warehouse_id = $1 AND product_id = $2
        `,
        [item.warehouse_id, item.product_id, item.quantity]
      );
      await client.query(`UPDATE order_items SET status = 'shipped' WHERE id = $1`, [item.id]);
    }
  }

  static async deliverOrder(client, orderId) {
    await client.query(`UPDATE order_items SET status = 'delivered' WHERE order_id = $1 AND status = 'shipped'`, [orderId]);
    await client.query(`UPDATE orders SET delivery_date = NOW() WHERE id = $1`, [orderId]);
  }

  static async cancelOrder(client, orderId, reason) {
    const items = await client.query(`SELECT * FROM order_items WHERE order_id = $1 AND status IN ('reserved', 'confirmed')`, [orderId]);
    for (const item of items.rows) {
      await client.query(
        `
        UPDATE warehouse_product_links
        SET
          reserved_quantity = reserved_quantity - $3,
          available_quantity = available_quantity + $3,
          updated_at = NOW()
        WHERE warehouse_id = $1 AND product_id = $2
        `,
        [item.warehouse_id, item.product_id, item.quantity]
      );
    }
    await client.query(`UPDATE order_items SET status = 'cancelled' WHERE order_id = $1`, [orderId]);
    const supplierOrders = await client.query(`SELECT * FROM supplier_orders WHERE order_id = $1 AND status IN ('pending', 'sent', 'confirmed')`, [orderId]);
    for (const supplierOrder of supplierOrders.rows) {
      await this.cancelSupplierOrder(client, supplierOrder, reason);
    }
  }

  static async cancelSupplierOrder(client, supplierOrder, reason) {
    try {
      const supplierResult = await client.query(`SELECT * FROM suppliers WHERE id = $1`, [supplierOrder.supplier_id]);
      const supplier = supplierResult.rows[0];
      if (supplier && supplier.api_config && supplierOrder.external_order_number) {
        let apiConfig = supplier.api_config;
        if (typeof apiConfig === 'string' && cryptoUtils.isEncrypted(apiConfig)) apiConfig = cryptoUtils.decrypt(apiConfig);
        const adapter = supplierFactory.createAdapter(supplier.api_type, apiConfig);
        await adapter.cancelOrder(supplierOrder.external_order_number, reason);
      }
      await client.query(`UPDATE supplier_orders SET status = 'cancelled', notes = $2, updated_at = NOW() WHERE id = $1`, [supplierOrder.id, reason]);
    } catch (error) {
      logger.error(`Failed to cancel supplier order ${supplierOrder.id}:`, error);
    }
  }

  static async checkSupplierOrderStatus(supplierOrderId) {
    try {
      const result = await db.query(
        `
        SELECT so.*, s.api_type, s.api_config
        FROM supplier_orders so
        JOIN suppliers s ON so.supplier_id = s.id
        WHERE so.id = $1
        `,
        [supplierOrderId]
      );
      if (result.rows.length === 0) throw new Error('Supplier order not found');
      const supplierOrder = result.rows[0];
      if (!supplierOrder.external_order_number) return { status: supplierOrder.status, message: 'No external order number' };
      let apiConfig = supplierOrder.api_config;
      if (typeof apiConfig === 'string' && cryptoUtils.isEncrypted(apiConfig)) apiConfig = cryptoUtils.decrypt(apiConfig);
      const adapter = supplierFactory.createAdapter(supplierOrder.api_type, apiConfig);
      const apiStatus = await adapter.getOrderStatus(supplierOrder.external_order_number);
      if (apiStatus.status !== supplierOrder.status) {
        await db.query(`UPDATE supplier_orders SET status = $2, updated_at = NOW() WHERE id = $1`, [supplierOrderId, apiStatus.status]);
      }
      return apiStatus;
    } catch (error) {
      logger.error(`Failed to check supplier order status:`, error);
      throw error;
    }
  }

  static async createProcessingLog(client, orderId, action, message) {
    await client.query(
      `
      INSERT INTO order_processing_logs (
        order_id, action, status, message, created_at
      ) VALUES ($1, $2, $2, $3, NOW())
      `,
      [orderId, action, message]
    );
  }

  static generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${year}${month}${day}-${random}`;
  }

  static generateSupplierOrderNumber() {
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SUP-${timestamp}-${random}`;
  }
}

module.exports = OrderService;