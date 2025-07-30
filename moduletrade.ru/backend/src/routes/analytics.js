// backend/src/routes/analytics.js
const express = require('express');
const { authenticate, checkPermission } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

/**
 * GET /analytics/dashboard
 * Получение данных для главной панели
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Получаем статистику за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [ordersStats, productsStats, syncStats] = await Promise.all([
      // Статистика заказов
      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
      db.query(`
        SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as avg_order_value,
          COUNT(DISTINCT DATE(order_date)) as active_days
        FROM orders 
        WHERE tenant_id = $1 AND order_date >= $2
      `, [tenantId, thirtyDaysAgo.toISOString()]),

      // Статистика товаров
      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
      db.query(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
          COUNT(DISTINCT brand_id) as total_brands,
          COUNT(DISTINCT category_id) as total_categories
        FROM products 
        WHERE tenant_id = $1
      `, [tenantId]),

      // Статистика синхронизации (с проверкой существования таблицы)
      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
      db.query(`
        SELECT 
          COUNT(*) as total_syncs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
          MAX(started_at) as last_sync
        FROM sync_logs 
        WHERE tenant_id = $1 AND started_at >= $2
      `, [tenantId, thirtyDaysAgo.toISOString()]).catch((error) => {
        // Если таблица не существует, возвращаем нули
        return { rows: [{ total_syncs: 0, successful_syncs: 0, failed_syncs: 0, last_sync: null }] };
      })
    ]);

    // Статистика по дням (последние 7 дней)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
    const dailyStats = await db.query(`
      SELECT 
        DATE(order_date) as date,
        COUNT(*) as orders_count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders 
      WHERE tenant_id = $1 AND order_date >= $2
      GROUP BY DATE(order_date)
      ORDER BY date DESC
      LIMIT 7
    `, [tenantId, sevenDaysAgo.toISOString()]);

    // Топ товары по продажам
    // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
    const topProducts = await db.query(`
      SELECT 
        p.name as product_name,
        p.internal_code,
        COUNT(oi.id) as orders_count,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.price) as total_revenue
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.tenant_id = $1 AND o.order_date >= $2
      GROUP BY p.id, p.name, p.internal_code
      ORDER BY total_revenue DESC
      LIMIT 5
    `, [tenantId, thirtyDaysAgo.toISOString()]);

    res.json({
      success: true,
      data: {
        summary: {
          orders: ordersStats.rows[0],
          products: productsStats.rows[0],
          sync: syncStats.rows[0]
        },
        daily_stats: dailyStats.rows,
        top_products: topProducts.rows
      }
    });

  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /analytics/sales
 * Аналитика продаж
 */
router.get('/sales', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { date_from, date_to, marketplace_id } = req.query;

    let whereConditions = ['o.tenant_id = $1'];
    const queryParams = [tenantId];
    let paramIndex = 2;

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

    if (marketplace_id) {
      whereConditions.push(`o.marketplace_id = $${paramIndex}`);
      queryParams.push(marketplace_id);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
    const salesData = await db.query(`
      SELECT 
        DATE(o.order_date) as date,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(o.total_amount) as revenue,
        SUM(o.commission_amount) as commission,
        AVG(o.total_amount) as avg_order_value,
        m.name as marketplace_name
      FROM orders o
      LEFT JOIN marketplaces m ON o.marketplace_id = m.id
      WHERE ${whereClause}
      GROUP BY DATE(o.order_date), m.name
      ORDER BY date DESC
    `, queryParams);

    res.json({
      success: true,
      data: salesData.rows
    });

  } catch (error) {
    console.error('Sales analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: GET /analytics/profit
 * Аналитика прибыльности
 */
router.get('/profit', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { date_from, date_to, marketplace_id } = req.query;

    let whereConditions = ['o.tenant_id = $1'];
    const queryParams = [tenantId];
    let paramIndex = 2;

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

    if (marketplace_id) {
      whereConditions.push(`o.marketplace_id = $${paramIndex}`);
      queryParams.push(marketplace_id);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
    const profitData = await db.query(`
      SELECT 
        DATE(o.order_date) as date,
        SUM(o.total_amount) as revenue,
        SUM(o.commission_amount) as commission,
        SUM(oi.quantity * ps.price) as cost,
        SUM(o.total_amount - o.commission_amount - (oi.quantity * ps.price)) as profit,
        COUNT(DISTINCT o.id) as orders_count
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN product_suppliers ps ON oi.product_id = ps.product_id
      WHERE ${whereClause}
      GROUP BY DATE(o.order_date)
      ORDER BY date DESC
    `, queryParams);

    res.json({
      success: true,
      data: profitData.rows
    });

  } catch (error) {
    console.error('Profit analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /analytics/products
 * Аналитика товаров
 */
router.get('/products', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { limit = 50, sort = 'revenue:desc' } = req.query;

    const [sortField, sortDirection] = sort.split(':');
    const validSorts = ['revenue', 'orders_count', 'quantity_sold'];
    const finalSort = validSorts.includes(sortField) ? sortField : 'revenue';
    const finalDirection = sortDirection === 'asc' ? 'ASC' : 'DESC';

    // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
    const productStats = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.internal_code,
        b.canonical_name as brand_name,
        c.canonical_name as category_name,
        COUNT(DISTINCT oi.order_id) as orders_count,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.quantity * oi.price) as revenue,
        AVG(oi.price) as avg_price
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.tenant_id = $1
      GROUP BY p.id, p.name, p.internal_code, b.canonical_name, c.canonical_name
      HAVING COUNT(oi.id) > 0
      ORDER BY ${finalSort} ${finalDirection}
      LIMIT $2
    `, [tenantId, limit]);

    res.json({
      success: true,
      data: productStats.rows
    });

  } catch (error) {
    console.error('Products analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;