// backend/src/routes/orders.js
const express = require('express');
const { authenticate, checkPermission } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

/**
 * GET /orders
 * Получение списка заказов
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { 
      limit = 50, 
      offset = 0, 
      sort = 'created_at:desc',
      status,
      marketplace_id,
      date_from,
      date_to
    } = req.query;

    let whereConditions = ['o.tenant_id = $1'];
    const queryParams = [tenantId];
    let paramIndex = 2;

    // Фильтр по статусу
    if (status) {
      whereConditions.push(`o.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Фильтр по маркетплейсу
    if (marketplace_id) {
      whereConditions.push(`o.marketplace_id = $${paramIndex}`);
      queryParams.push(marketplace_id);
      paramIndex++;
    }

    // Фильтр по дате
    if (date_from) {
      whereConditions.push(`o.order_date >= $${paramIndex}`);
      queryParams.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      whereConditions.push(`o.order_date <= $${paramIndex}`);
      queryParams.push(date_to);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Парсим сортировку
    const [sortField, sortDirection] = sort.split(':');
    const validSortFields = ['created_at', 'order_date', 'total_amount', 'status'];
    const finalSortField = validSortFields.includes(sortField) ? sortField : 'created_at';
    const finalSortDirection = sortDirection === 'asc' ? 'ASC' : 'DESC';

    const [ordersResult, totalResult] = await Promise.all([
      // Основной запрос заказов
      db.query(tenantId, `
        SELECT 
          o.id,
          o.order_number,
          o.marketplace_order_id,
          o.status,
          o.total_amount,
          o.commission_amount,
          o.order_date,
          o.created_at,
          o.updated_at,
          m.name as marketplace_name,
          m.code as marketplace_code,
          sc.name as sales_channel_name,
          COUNT(oi.id) as items_count
        FROM orders o
        LEFT JOIN marketplaces m ON o.marketplace_id = m.id
        LEFT JOIN sales_channels sc ON o.sales_channel_id = sc.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE ${whereClause}
        GROUP BY o.id, m.name, m.code, sc.name
        ORDER BY o.${finalSortField} ${finalSortDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]),

      // Запрос общего количества
      db.query(tenantId, `
        SELECT COUNT(DISTINCT o.id) as total
        FROM orders o
        LEFT JOIN marketplaces m ON o.marketplace_id = m.id
        LEFT JOIN sales_channels sc ON o.sales_channel_id = sc.id
        WHERE ${whereClause}
      `, queryParams)
    ]);

    const total = parseInt(totalResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: ordersResult.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /orders/:id
 * Получение детальной информации о заказе
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const orderId = req.params.id;

    const orderResult = await db.query(tenantId, `
      SELECT 
        o.*,
        m.name as marketplace_name,
        m.code as marketplace_code,
        sc.name as sales_channel_name
      FROM orders o
      LEFT JOIN marketplaces m ON o.marketplace_id = m.id
      LEFT JOIN sales_channels sc ON o.sales_channel_id = sc.id
      WHERE o.id = $1 AND o.tenant_id = $2
    `, [orderId, tenantId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Получаем позиции заказа
    const itemsResult = await db.query(tenantId, `
      SELECT 
        oi.*,
        p.name as product_name,
        p.internal_code as product_code
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.id
    `, [orderId]);

    order.items = itemsResult.rows;

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /orders
 * Создание нового заказа
 */
router.post('/', authenticate, checkPermission('orders.create'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const orderData = req.body;

    // Здесь будет логика создания заказа
    // Пока возвращаем заглушку
    res.json({
      success: true,
      message: 'Order creation not implemented yet'
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /orders/:id
 * Обновление заказа
 */
router.put('/:id', authenticate, checkPermission('orders.update'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const orderId = req.params.id;
    const updateData = req.body;

    // Проверяем существование заказа
    const existingOrder = await db.query(tenantId, `
      SELECT id FROM orders WHERE id = $1 AND tenant_id = $2
    `, [orderId, tenantId]);

    if (existingOrder.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Обновляем заказ
    const result = await db.query(tenantId, `
      UPDATE orders SET
        status = COALESCE($3, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, [orderId, tenantId, updateData.status]);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /orders/:id
 * Удаление заказа
 */
router.delete('/:id', authenticate, checkPermission('orders.delete'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const orderId = req.params.id;

    const result = await db.query(tenantId, `
      DELETE FROM orders 
      WHERE id = $1 AND tenant_id = $2
      RETURNING id
    `, [orderId, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });

  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;