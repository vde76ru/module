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
    const companyId = req.user.companyId;
    const {
      limit = 50,
      offset = 0,
      sort = 'created_at:desc',
      status,
      marketplace_id,
      date_from,
      date_to
    } = req.query;

    let whereConditions = ['o.company_id = $1'];
    const queryParams = [companyId];
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
      db.query(`
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
      db.query(`
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
    const companyId = req.user.companyId;
    const orderId = req.params.id;

    const orderResult = await db.query(`
      SELECT
        o.*,
        m.name as marketplace_name,
        m.code as marketplace_code,
        sc.name as sales_channel_name
      FROM orders o
      LEFT JOIN marketplaces m ON o.marketplace_id = m.id
      LEFT JOIN sales_channels sc ON o.sales_channel_id = sc.id
      WHERE o.id = $1 AND o.company_id = $2
    `, [orderId, companyId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Получаем позиции заказа
    const itemsResult = await db.query(`
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
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const {
      order_number,
      marketplace_id,
      sales_channel_id,
      customer_name,
      customer_email,
      customer_phone,
      total_amount,
      commission_amount,
      items = []
    } = req.body;

    // Начинаем транзакцию
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Создаем заказ
      const orderResult = await client.query(`
        INSERT INTO orders (
          company_id, order_number, marketplace_id, sales_channel_id,
          customer_name, customer_email, customer_phone,
          total_amount, commission_amount, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        companyId, order_number, marketplace_id, sales_channel_id,
        customer_name, customer_email, customer_phone,
        total_amount, commission_amount || 0, 'new'
      ]);

      const order = orderResult.rows[0];

      // Добавляем позиции заказа
      for (const item of items) {
        await client.query(`
          INSERT INTO order_items (
            order_id, product_id, quantity, price, total_price
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          order.id, item.product_id, item.quantity,
          item.price, item.quantity * item.price
        ]);
      }

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: order
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

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
    const companyId = req.user.companyId;
    const orderId = req.params.id;
    const updateData = req.body;

    // Проверяем существование заказа
    const existingOrder = await db.query(`
      SELECT id FROM orders WHERE id = $1 AND company_id = $2
    `, [orderId, companyId]);

    if (existingOrder.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Подготавливаем поля для обновления
    const updateFields = [];
    const updateValues = [orderId, companyId];
    let valueIndex = 3;

    if (updateData.status !== undefined) {
      updateFields.push(`status = $${valueIndex}`);
      updateValues.push(updateData.status);
      valueIndex++;
    }

    if (updateData.customer_name !== undefined) {
      updateFields.push(`customer_name = $${valueIndex}`);
      updateValues.push(updateData.customer_name);
      valueIndex++;
    }

    if (updateData.customer_email !== undefined) {
      updateFields.push(`customer_email = $${valueIndex}`);
      updateValues.push(updateData.customer_email);
      valueIndex++;
    }

    if (updateData.customer_phone !== undefined) {
      updateFields.push(`customer_phone = $${valueIndex}`);
      updateValues.push(updateData.customer_phone);
      valueIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    // Обновляем заказ
    const result = await db.query(`
      UPDATE orders SET ${updateFields.join(', ')}
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `, updateValues);

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
    const companyId = req.user.companyId;
    const orderId = req.params.id;

    const result = await db.query(`
      DELETE FROM orders
      WHERE id = $1 AND company_id = $2
      RETURNING id
    `, [orderId, companyId]);

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

/**
 * PUT /orders/:id/status
 * Обновление статуса заказа
 */
router.put('/:id/status', authenticate, checkPermission('orders.update'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const orderId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const validStatuses = ['new', 'processing', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const result = await db.query(`
      UPDATE orders SET
        status = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `, [orderId, companyId, status]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /orders/export
 * Экспорт заказов
 */
router.get('/export', authenticate, checkPermission('orders.export'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { format = 'csv', ...filters } = req.query;

    // Строим условия фильтрации (аналогично основному запросу)
    let whereConditions = ['o.company_id = $1'];
    const queryParams = [companyId];
    let paramIndex = 2;

    if (filters.status) {
      whereConditions.push(`o.status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }

    if (filters.marketplace_id) {
      whereConditions.push(`o.marketplace_id = $${paramIndex}`);
      queryParams.push(filters.marketplace_id);
      paramIndex++;
    }

    if (filters.date_from) {
      whereConditions.push(`o.order_date >= $${paramIndex}`);
      queryParams.push(filters.date_from);
      paramIndex++;
    }

    if (filters.date_to) {
      whereConditions.push(`o.order_date <= $${paramIndex}`);
      queryParams.push(filters.date_to);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await db.query(`
      SELECT
        o.order_number,
        o.status,
        o.total_amount,
        o.commission_amount,
        o.order_date,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        m.name as marketplace_name,
        sc.name as sales_channel_name,
        o.created_at
      FROM orders o
      LEFT JOIN marketplaces m ON o.marketplace_id = m.id
      LEFT JOIN sales_channels sc ON o.sales_channel_id = sc.id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT 10000
    `, queryParams);

    if (format === 'json') {
      res.json({
        success: true,
        data: result.rows
      });
    } else {
      // CSV экспорт
      const csv = require('csv-stringify');
      const columns = [
        'order_number', 'status', 'total_amount', 'commission_amount',
        'order_date', 'customer_name', 'customer_email', 'customer_phone',
        'marketplace_name', 'sales_channel_name', 'created_at'
      ];

      csv(result.rows, {
        header: true,
        columns: columns
      }, (err, output) => {
        if (err) {
          throw err;
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
        res.send(output);
      });
    }

  } catch (error) {
    console.error('Export orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;