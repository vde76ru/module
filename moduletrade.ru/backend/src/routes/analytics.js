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
    const companyId = req.user.companyId;

    // Получаем статистику за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [ordersStats, productsStats, syncStats] = await Promise.all([
      // Статистика заказов
      // ✅ ИСПРАВЛЕНО: Удален companyId из вызова db.query
      db.query(`
        SELECT
          COUNT(*) as total_orders,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as avg_order_value,
          COUNT(DISTINCT DATE(order_date)) as active_days
        FROM orders
        WHERE company_id = $1 AND order_date >= $2
      `, [companyId, thirtyDaysAgo.toISOString()]),

      // Статистика товаров
      // ✅ ИСПРАВЛЕНО: Удален companyId из вызова db.query
      db.query(`
        SELECT
          COUNT(*) as total_products,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
          COUNT(DISTINCT brand_id) as total_brands,
          COUNT(DISTINCT category_id) as total_categories
        FROM products
        WHERE company_id = $1
      `, [companyId]),

      // Статистика синхронизации (с проверкой существования таблицы)
      // ✅ ИСПРАВЛЕНО: Удален companyId из вызова db.query
      db.query(`
        SELECT
          COUNT(*) as total_syncs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
          MAX(started_at) as last_sync
        FROM sync_logs
        WHERE company_id = $1 AND started_at >= $2
      `, [companyId, thirtyDaysAgo.toISOString()]).catch((error) => {
        // Если таблица не существует, возвращаем нули
        return { rows: [{ total_syncs: 0, successful_syncs: 0, failed_syncs: 0, last_sync: null }] };
      })
    ]);

    // Статистика по дням (последние 7 дней)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // ✅ ИСПРАВЛЕНО: Удален companyId из вызова db.query
    const dailyStats = await db.query(`
      SELECT
        DATE(order_date) as date,
        COUNT(*) as orders_count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE company_id = $1 AND order_date >= $2
      GROUP BY DATE(order_date)
      ORDER BY date DESC
      LIMIT 7
    `, [companyId, sevenDaysAgo.toISOString()]);

    // Топ товары по продажам
    // ✅ ИСПРАВЛЕНО: Удален companyId из вызова db.query
    const topProducts = await db.query(`
      SELECT
        p.name as product_name,
        p.internal_code,
        COUNT(oi.id) as orders_count,
        SUM(oi.quantity) as total_sold,
        SUM(oi.total_price) as total_revenue
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.company_id = $1 AND o.order_date >= $2
      GROUP BY p.id, p.name, p.internal_code
      ORDER BY total_revenue DESC
      LIMIT 5
    `, [companyId, thirtyDaysAgo.toISOString()]);

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
    const companyId = req.user.companyId;
    const { date_from, date_to, marketplace_id } = req.query;

    let whereConditions = ['o.company_id = $1'];
    const queryParams = [companyId];
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

    // ✅ ИСПРАВЛЕНО: Удален companyId из вызова db.query
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
      WHERE o.company_id = $1 AND ${whereClause}
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
    const companyId = req.user.companyId;
    const { date_from, date_to, marketplace_id } = req.query;

    let whereConditions = ['o.company_id = $1'];
    const queryParams = [companyId];
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

    // ✅ ИСПРАВЛЕНО: Удален companyId из вызова db.query
    const profitData = await db.query(`
      SELECT
        DATE(o.order_date) as date,
        SUM(o.total_amount) as revenue,
        SUM(o.commission_amount) as commission,
        SUM(oi.quantity * ps.original_price) as cost,
        SUM(o.total_amount - o.commission_amount - (oi.quantity * ps.original_price)) as profit,
        COUNT(DISTINCT o.id) as orders_count
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN product_suppliers ps ON oi.product_id = ps.product_id
      WHERE o.company_id = $1 AND ${whereClause}
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
    const companyId = req.user.companyId;
    const { limit = 50, sort = 'revenue:desc' } = req.query;

    const [sortField, sortDirection] = sort.split(':');
    const validSorts = ['revenue', 'orders_count', 'quantity_sold', 'profit', 'margin', 'popularity'];
    const finalSort = validSorts.includes(sortField) ? sortField : 'revenue';
    const finalDirection = sortDirection === 'asc' ? 'ASC' : 'DESC';

    // ✅ ИСПРАВЛЕНО: Удален companyId из вызова db.query
    const productStats = await db.query(`
      SELECT
        p.id,
        p.name,
        p.internal_code,
        b.canonical_name as brand_name,
        c.canonical_name as category_name,
        COUNT(DISTINCT oi.order_id) as orders_count,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total_price) as revenue,
        AVG(oi.unit_price) as avg_price,
        COALESCE(pop.popularity_score, 0) as popularity_score,
        COALESCE(pop.view_count, 0) as view_count,
         COALESCE(pop.sale_count, 0) as order_count,
        COALESCE(SUM(oi.total_price - COALESCE(oi.quantity * ps.original_price, 0)), 0) as profit,
        COALESCE(AVG((oi.unit_price - COALESCE(ps.original_price, 0)) / NULLIF(oi.unit_price, 0) * 100), 0) as margin_percentage
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_popularity pop ON p.id = pop.product_id
      LEFT JOIN product_suppliers ps ON p.id = ps.product_id
      WHERE p.company_id = $1
      GROUP BY p.id, p.name, p.internal_code, b.canonical_name, c.canonical_name, pop.popularity_score, pop.view_count, pop.order_count
      HAVING COUNT(oi.id) > 0
      ORDER BY ${finalSort} ${finalDirection}
      LIMIT $2
    `, [companyId, limit]);

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

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: GET /analytics/popularity
 * Аналитика популярности товаров
 */
router.get('/popularity', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { limit = 50, sort = 'popularity_score:desc' } = req.query;

    const [sortField, sortDirection] = sort.split(':');
    const validSorts = ['popularity_score', 'view_count', 'order_count', 'conversion_rate'];
    const finalSort = validSorts.includes(sortField) ? sortField : 'popularity_score';
    const finalDirection = sortDirection === 'asc' ? 'ASC' : 'DESC';

    const popularityStats = await db.query(`
      SELECT
        p.id,
        p.name,
        p.internal_code,
        b.canonical_name as brand_name,
        c.canonical_name as category_name,
        COALESCE(pop.popularity_score, 0) as popularity_score,
        COALESCE(pop.view_count, 0) as view_count,
         COALESCE(pop.sale_count, 0) as order_count,
        CASE
          WHEN pop.view_count > 0
          THEN (pop.order_count::FLOAT / pop.view_count * 100)
          ELSE 0
        END as conversion_rate,
        pop.last_updated
      FROM products p
      LEFT JOIN product_popularity pop ON p.id = pop.product_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.company_id = $1
      ORDER BY ${finalSort} ${finalDirection}
      LIMIT $2
    `, [companyId, limit]);

    res.json({
      success: true,
      data: popularityStats.rows
    });

  } catch (error) {
    console.error('Popularity analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: GET /analytics/warehouse
 * Аналитика складов
 */
router.get('/warehouse', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { warehouse_id } = req.query;

    let whereConditions = ['ws.company_id = $1'];
    const queryParams = [companyId];
    let paramIndex = 2;

    if (warehouse_id) {
      whereConditions.push(`ws.warehouse_id = $${paramIndex}`);
      queryParams.push(warehouse_id);
      paramIndex++;
    }

    const warehouseStats = await db.query(`
      SELECT
        w.name as warehouse_name,
        w.type as warehouse_type,
        w.city,
        COUNT(DISTINCT ws.product_id) as total_products,
        SUM(ws.quantity) as total_quantity,
        AVG(ws.purchase_price) as avg_purchase_price,
        AVG(ws.retail_price) as avg_retail_price,
        AVG(ws.website_price) as avg_website_price,
        AVG(ws.marketplace_price) as avg_marketplace_price,
        COUNT(CASE WHEN ws.quantity <= 10 THEN 1 END) as low_stock_products,
        0 as expiring_products
      FROM warehouse_product_links ws
      JOIN warehouses w ON ws.warehouse_id = w.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY w.id, w.name, w.type, w.city
      ORDER BY total_products DESC
    `, queryParams);

    res.json({
      success: true,
      data: warehouseStats.rows
    });

  } catch (error) {
    console.error('Warehouse analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: GET /analytics/marketplace
 * Аналитика по маркетплейсам
 */
router.get('/marketplace', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { date_from, date_to } = req.query;

    let whereConditions = ['o.company_id = $1'];
    const queryParams = [companyId];
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

    const marketplaceStats = await db.query(`
      SELECT
        m.name as marketplace_name,
        m.type as marketplace_type,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(o.total_amount) as total_revenue,
        AVG(o.total_amount) as avg_order_value,
        SUM(o.commission_amount) as total_commission,
        COUNT(DISTINCT oi.product_id) as unique_products_sold,
        SUM(oi.quantity) as total_quantity_sold
      FROM orders o
      JOIN marketplaces m ON o.marketplace_id = m.id
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY m.id, m.name, m.type
      ORDER BY total_revenue DESC
    `, queryParams);

    res.json({
      success: true,
      data: marketplaceStats.rows
    });

  } catch (error) {
    console.error('Marketplace analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: GET /analytics/brand
 * Аналитика по брендам
 */
router.get('/brand', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { date_from, date_to } = req.query;

    let whereConditions = ['p.company_id = $1'];
    const queryParams = [companyId];
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

    const brandStats = await db.query(`
      SELECT
        b.name as brand_name,
        b.canonical_name,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total_price) as revenue,
        AVG(oi.unit_price) as avg_price,
        COALESCE(SUM(oi.total_price - COALESCE(oi.quantity * ps.original_price, 0)), 0) as profit,
        COALESCE(AVG((oi.unit_price - COALESCE(ps.original_price, 0)) / NULLIF(oi.unit_price, 0) * 100), 0) as margin_percentage
      FROM brands b
      JOIN products p ON b.id = p.brand_id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      LEFT JOIN product_suppliers ps ON p.id = ps.product_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY b.id, b.name, b.canonical_name
      ORDER BY revenue DESC
    `, queryParams);

    res.json({
      success: true,
      data: brandStats.rows
    });

  } catch (error) {
    console.error('Brand analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: GET /analytics/category
 * Аналитика по категориям
 */
router.get('/category', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { date_from, date_to } = req.query;

    let whereConditions = ['p.company_id = $1'];
    const queryParams = [companyId];
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

    const categoryStats = await db.query(`
      SELECT
        c.name as category_name,
        c.canonical_name,
        c.level,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total_price) as revenue,
        AVG(oi.unit_price) as avg_price,
        COALESCE(SUM(oi.total_price - COALESCE(oi.quantity * ps.original_price, 0)), 0) as profit,
        COALESCE(AVG((oi.unit_price - COALESCE(ps.original_price, 0)) / NULLIF(oi.unit_price, 0) * 100), 0) as margin_percentage
      FROM categories c
      JOIN products p ON c.id = p.category_id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      LEFT JOIN product_suppliers ps ON p.id = ps.product_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY c.id, c.name, c.canonical_name, c.level
      ORDER BY revenue DESC
    `, queryParams);

    res.json({
      success: true,
      data: categoryStats.rows
    });

  } catch (error) {
    console.error('Category analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;

/**
 * GET /analytics/export
 * Экспорт аналитического отчета (CSV/JSON)
 * Параметры: report=sales|products|profit, format=csv|json, date_from, date_to
 */
router.get('/export', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { report = 'sales', format = 'csv', date_from, date_to } = req.query;

    let whereConditions = ['o.company_id = $1'];
    const params = [companyId];
    let idx = 2;

    if (date_from) { whereConditions.push(`o.order_date >= $${idx}`); params.push(date_from); idx++; }
    if (date_to)   { whereConditions.push(`o.order_date <= $${idx}`); params.push(date_to); idx++; }

    const where = whereConditions.join(' AND ');

    let query;
    let columns;
    switch (report) {
      case 'profit':
        query = `
          SELECT
            DATE(o.order_date) as date,
            SUM(o.total_amount) as revenue,
            SUM(o.commission_amount) as commission,
            SUM(oi.quantity * COALESCE(ps.original_price, 0)) as cost,
            SUM(o.total_amount - o.commission_amount - (oi.quantity * COALESCE(ps.original_price, 0))) as profit,
            COUNT(DISTINCT o.id) as orders_count
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          LEFT JOIN product_suppliers ps ON oi.product_id = ps.product_id
          WHERE ${where}
          GROUP BY DATE(o.order_date)
          ORDER BY date DESC`;
        columns = ['date', 'orders_count', 'revenue', 'commission', 'cost', 'profit'];
        break;
      case 'products':
        query = `
          SELECT
            p.id as product_id,
            p.name as product_name,
            p.internal_code,
            SUM(oi.quantity) as quantity_sold,
            SUM(oi.total_price) as revenue,
            AVG(oi.unit_price) as avg_price
          FROM products p
          LEFT JOIN order_items oi ON p.id = oi.product_id
          LEFT JOIN orders o ON oi.order_id = o.id
          WHERE p.company_id = $1 ${whereConditions.length > 1 ? 'AND ' + whereConditions.slice(1).join(' AND ') : ''}
          GROUP BY p.id, p.name, p.internal_code
          HAVING SUM(oi.quantity) IS NOT NULL
          ORDER BY revenue DESC`;
        columns = ['product_id', 'product_name', 'internal_code', 'quantity_sold', 'revenue', 'avg_price'];
        break;
      case 'sales':
      default:
        query = `
          SELECT
            DATE(o.order_date) as date,
            COUNT(DISTINCT o.id) as orders_count,
            SUM(o.total_amount) as revenue,
            SUM(o.commission_amount) as commission,
            AVG(o.total_amount) as avg_order_value
          FROM orders o
          WHERE ${where}
          GROUP BY DATE(o.order_date)
          ORDER BY date DESC`;
        columns = ['date', 'orders_count', 'revenue', 'commission', 'avg_order_value'];
        break;
    }

    const result = await db.query(query, params);
    const rows = result.rows || [];

    if (String(format).toLowerCase() === 'json') {
      return res.json({ success: true, data: rows, report });
    }

    // CSV экспорт
    const csv = require('csv-stringify');
    csv(rows, { header: true, columns }, (err, output) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Failed to generate CSV' });
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${report}.csv"`);
      res.send(output);
    });
  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});