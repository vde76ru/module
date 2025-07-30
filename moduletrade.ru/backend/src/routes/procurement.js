const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authenticateToken } = require('../middleware/auth');
const orderOrchestrationService = require('../services/OrderOrchestrationService');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Получить черновики заказов поставщикам
router.get('/supplier-orders', authenticateToken, async (req, res) => {
  try {
    const { status = 'draft', supplier_id, batch_id } = req.query;
    
    let query = `
      SELECT 
        so.*,
        s.name as supplier_name,
        s.email as supplier_email,
        COUNT(soi.id) as items_count,
        u.email as created_by_email
      FROM supplier_orders so
      JOIN suppliers s ON s.id = so.supplier_id
      LEFT JOIN supplier_order_items soi ON soi.order_id = so.id
      LEFT JOIN users u ON u.id = so.created_by_user_id
      WHERE so.tenant_id = $1
    `;

    const params = [req.user.tenant_id];
    let paramIndex = 2;

    if (status) {
      query += ` AND so.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (supplier_id) {
      query += ` AND so.supplier_id = $${paramIndex}`;
      params.push(supplier_id);
      paramIndex++;
    }

    if (batch_id) {
      query += ` AND so.aggregation_batch_id = $${paramIndex}`;
      params.push(batch_id);
      paramIndex++;
    }

    query += `
      GROUP BY so.id, s.name, s.email, u.email
      ORDER BY so.created_at DESC
    `;

    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      orders: result.rows
    });
  } catch (error) {
    logger.error('Error fetching supplier orders:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch supplier orders' 
    });
  }
});

// Получить детали заказа поставщику
router.get('/supplier-orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Получаем заказ
    const orderResult = await pool.query(`
      SELECT 
        so.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        s.api_config
      FROM supplier_orders so
      JOIN suppliers s ON s.id = so.supplier_id
      WHERE so.id = $1 AND so.tenant_id = $2
    `, [orderId, req.user.tenant_id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }

    const order = orderResult.rows[0];

    // Получаем позиции заказа
    const itemsResult = await pool.query(`
      SELECT 
        soi.*,
        p.name as product_name,
        p.sku,
        p.barcode,
        ps.availability_status
      FROM supplier_order_items soi
      JOIN products p ON p.id = soi.product_id
      LEFT JOIN product_suppliers ps ON ps.product_id = soi.product_id 
        AND ps.supplier_id = $2
      WHERE soi.order_id = $1
      ORDER BY p.name
    `, [orderId, order.supplier_id]);

    order.items = itemsResult.rows;

    // Получаем связанные клиентские заказы
    const clientOrdersResult = await pool.query(`
      SELECT DISTINCT
        o.id,
        o.external_order_id,
        o.customer_name,
        o.created_at,
        m.name as marketplace_name
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN supplier_order_items soi ON soi.product_id = oi.product_id
      LEFT JOIN marketplaces m ON m.id = o.marketplace_id
      WHERE soi.order_id = $1
        AND oi.procurement_status = 'ordered'
      ORDER BY o.created_at DESC
    `, [orderId]);

    order.client_orders = clientOrdersResult.rows;

    res.json({
      success: true,
      order
    });
  } catch (error) {
    logger.error('Error fetching supplier order details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch order details' 
    });
  }
});

// Обновить позицию в заказе поставщику
router.put('/supplier-orders/:orderId/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid quantity' 
      });
    }

    // Проверяем, что заказ принадлежит тенанту и имеет статус draft
    const checkResult = await pool.query(`
      SELECT so.status 
      FROM supplier_orders so
      JOIN supplier_order_items soi ON soi.order_id = so.id
      WHERE so.id = $1 AND soi.id = $2 AND so.tenant_id = $3
    `, [orderId, itemId, req.user.tenant_id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order item not found' 
      });
    }

    if (checkResult.rows[0].status !== 'draft') {
      return res.status(400).json({ 
        success: false, 
        error: 'Can only edit draft orders' 
      });
    }

    // Обновляем количество
    const updateResult = await pool.query(`
      UPDATE supplier_order_items 
      SET quantity = $1
      WHERE id = $2
      RETURNING *
    `, [quantity, itemId]);

    // Пересчитываем общую сумму заказа
    await pool.query(`
      UPDATE supplier_orders
      SET total_amount = (
        SELECT SUM(quantity * price)
        FROM supplier_order_items
        WHERE order_id = $1
      )
      WHERE id = $1
    `, [orderId]);

    res.json({
      success: true,
      item: updateResult.rows[0]
    });
  } catch (error) {
    logger.error('Error updating order item:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update order item' 
    });
  }
});

// Удалить позицию из заказа поставщику (создать override)
router.delete('/supplier-orders/:orderId/items/:itemId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { orderId, itemId } = req.params;
    const { reason = 'manual_removal', notes } = req.body;

    // Получаем информацию о позиции
    const itemResult = await client.query(`
      SELECT 
        soi.*,
        so.status,
        so.tenant_id
      FROM supplier_order_items soi
      JOIN supplier_orders so ON so.id = soi.order_id
      WHERE soi.id = $1 AND so.id = $2 AND so.tenant_id = $3
    `, [itemId, orderId, req.user.tenant_id]);

    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Order item not found' 
      });
    }

    const item = itemResult.rows[0];

    if (item.status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'Can only remove items from draft orders' 
      });
    }

    // Находим связанные позиции клиентских заказов
    const clientItemsResult = await client.query(`
      SELECT oi.id
      FROM order_items oi
      WHERE oi.product_id = $1
        AND oi.procurement_status = 'pending'
    `, [item.product_id]);

    // Создаем overrides для всех связанных позиций
    for (const clientItem of clientItemsResult.rows) {
      await client.query(`
        INSERT INTO procurement_overrides (
          tenant_id,
          order_item_id,
          reason,
          created_by_user_id,
          notes
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, order_item_id) DO NOTHING
      `, [
        req.user.tenant_id,
        clientItem.id,
        reason,
        req.user.id,
        notes || `Removed from supplier order ${orderId}`
      ]);
    }

    // Удаляем позицию из заказа поставщику
    await client.query(`
      DELETE FROM supplier_order_items
      WHERE id = $1
    `, [itemId]);

    // Пересчитываем сумму заказа
    await client.query(`
      UPDATE supplier_orders
      SET total_amount = (
        SELECT COALESCE(SUM(quantity * price), 0)
        FROM supplier_order_items
        WHERE order_id = $1
      )
      WHERE id = $1
    `, [orderId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Item removed from order',
      overrides_created: clientItemsResult.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error removing order item:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove order item' 
    });
  } finally {
    client.release();
  }
});

// Подтвердить и отправить заказ поставщику
router.post('/supplier-orders/:orderId/confirm', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { orderId } = req.params;

    // Проверяем заказ
    const orderResult = await client.query(`
      SELECT * FROM supplier_orders
      WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
    `, [orderId, req.user.tenant_id]);

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Draft order not found' 
      });
    }

    // Отправляем заказ поставщику
    await orderOrchestrationService.sendOrderToSupplier(client, orderId);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Order confirmed and sent to supplier'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error confirming order:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to confirm order' 
    });
  } finally {
    client.release();
  }
});

// Запустить закупку вручную для канала продаж
router.post('/sales-channels/:channelId/trigger-procurement', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;

    // Проверяем, что канал принадлежит тенанту
    const checkResult = await pool.query(
      'SELECT id FROM sales_channels WHERE id = $1 AND tenant_id = $2',
      [channelId, req.user.tenant_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Sales channel not found' 
      });
    }

    // Запускаем процесс закупки
    await orderOrchestrationService.manualTriggerProcurement(channelId);

    res.json({
      success: true,
      message: 'Procurement process triggered'
    });
  } catch (error) {
    logger.error('Error triggering procurement:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to trigger procurement' 
    });
  }
});

// Получить историю закупок
router.get('/procurement-history', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await pool.query(`
      WITH procurement_stats AS (
        SELECT 
          DATE(so.created_at) as date,
          COUNT(DISTINCT so.id) as orders_count,
          COUNT(DISTINCT so.supplier_id) as suppliers_count,
          SUM(so.total_amount) as total_amount,
          COUNT(DISTINCT soi.product_id) as products_count
        FROM supplier_orders so
        JOIN supplier_order_items soi ON soi.order_id = so.id
        WHERE so.tenant_id = $1
          AND so.created_at >= CURRENT_DATE - INTERVAL '%s days'
        GROUP BY DATE(so.created_at)
      )
      SELECT * FROM procurement_stats
      ORDER BY date DESC
    `, [req.user.tenant_id, parseInt(days)]);

    res.json({
      success: true,
      history: result.rows
    });
  } catch (error) {
    logger.error('Error fetching procurement history:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch procurement history' 
    });
  }
});

module.exports = router;
