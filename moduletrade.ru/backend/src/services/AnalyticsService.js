// backend/src/services/AnalyticsService.js
const db = require('../config/database');
const logger = require('../utils/logger');
const redis = require('../config/redis');

class AnalyticsService {
  /**
   * Получение аналитики продаж
   */
  static async getSalesAnalytics(companyId, dateRange = {}) {
    const { startDate, endDate, groupBy = 'day' } = dateRange;
    
    let whereConditions = ['o.company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        DATE_TRUNC($${paramIndex}, o.created_at) as period,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(oi.total_price) as total_revenue,
        AVG(oi.total_price) as avg_order_value,
        COUNT(DISTINCT o.customer_email) as unique_customers,
        SUM(oi.quantity) as total_items_sold
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${whereConditions.join(' AND ')}
        AND o.status IN ('completed', 'shipped')
      GROUP BY DATE_TRUNC($${paramIndex}, o.created_at)
      ORDER BY period DESC
    `;
    
    params.push(groupBy);
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Аналитика по каналам продаж
   */
  static async getChannelAnalytics(companyId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    
    let whereConditions = ['o.company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        COALESCE(m.name, 'website') as channel,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(oi.total_price) as total_revenue,
        AVG(oi.total_price) as avg_order_value,
        COUNT(DISTINCT o.customer_email) as unique_customers
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN marketplaces m ON o.marketplace_id = m.id
      WHERE ${whereConditions.join(' AND ')}
        AND o.status IN ('completed', 'shipped')
      GROUP BY COALESCE(m.name, 'website')
      ORDER BY total_revenue DESC
    `;
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Аналитика маржинальности
   */
  static async getMarginAnalytics(companyId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    
    let whereConditions = ['o.company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        oi.product_id,
        p.name as product_name,
        p.sku,
        b.name as brand_name,
        COUNT(oi.id) as sales_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue,
        SUM(oi.quantity * ws.purchase_price) as total_cost,
        (SUM(oi.total_price) - SUM(oi.quantity * ws.purchase_price)) as total_margin,
        CASE 
          WHEN SUM(oi.total_price) > 0 
          THEN ((SUM(oi.total_price) - SUM(oi.quantity * ws.purchase_price)) / SUM(oi.total_price)) * 100
          ELSE 0 
        END as margin_percentage
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN warehouse_stocks ws ON oi.warehouse_id = ws.warehouse_id AND oi.product_id = ws.product_id
      WHERE ${whereConditions.join(' AND ')}
        AND o.status IN ('completed', 'shipped')
      GROUP BY oi.product_id, p.name, p.sku, b.name
      ORDER BY total_margin DESC
    `;
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Аналитика популярности товаров
   */
  static async getProductPopularityAnalytics(companyId, dateRange = {}) {
    const { startDate, endDate, limit = 50 } = dateRange;
    
    let whereConditions = ['o.company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      WITH product_sales AS (
        SELECT 
          oi.product_id,
          p.name as product_name,
          p.sku,
          b.name as brand_name,
          c.name as category_name,
          COUNT(DISTINCT o.id) as orders_count,
          SUM(oi.quantity) as total_quantity,
          SUM(oi.total_price) as total_revenue,
          AVG(oi.unit_price) as avg_price,
          COUNT(DISTINCT DATE(o.created_at)) as active_days,
          MAX(o.created_at) as last_sale_date
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${whereConditions.join(' AND ')}
          AND o.status IN ('completed', 'shipped')
        GROUP BY oi.product_id, p.name, p.sku, b.name, c.name
      ),
      popularity_scores AS (
        SELECT 
          *,
          -- Базовый рейтинг по количеству продаж
          (orders_count * 0.4 + total_quantity * 0.3 + total_revenue * 0.3) as popularity_score,
          -- Рейтинг активности (продажи в разные дни)
          (active_days::float / GREATEST(DATE_PART('day', $${paramIndex}::date - $${paramIndex + 1}::date), 1)) as activity_ratio
        FROM product_sales
      )
      SELECT 
        *,
        ROW_NUMBER() OVER (ORDER BY popularity_score DESC) as popularity_rank,
        CASE 
          WHEN popularity_score >= (SELECT AVG(popularity_score) * 1.5 FROM popularity_scores) THEN 'high'
          WHEN popularity_score >= (SELECT AVG(popularity_score) FROM popularity_scores) THEN 'medium'
          ELSE 'low'
        END as popularity_level
      FROM popularity_scores
      ORDER BY popularity_score DESC
      LIMIT $${paramIndex + 2}
    `;
    
    params.push(endDate || new Date(), startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), limit);
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Аналитика по поставщикам
   */
  static async getSupplierAnalytics(companyId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    
    let whereConditions = ['o.company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        s.name as supplier_name,
        s.id as supplier_id,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue,
        SUM(oi.quantity * ws.purchase_price) as total_cost,
        (SUM(oi.total_price) - SUM(oi.quantity * ws.purchase_price)) as total_margin,
        COUNT(DISTINCT oi.product_id) as unique_products,
        AVG(oi.unit_price) as avg_selling_price,
        AVG(ws.purchase_price) as avg_purchase_price
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN suppliers s ON p.main_supplier_id = s.id
      LEFT JOIN warehouse_stocks ws ON oi.warehouse_id = ws.warehouse_id AND oi.product_id = ws.product_id
      WHERE ${whereConditions.join(' AND ')}
        AND o.status IN ('completed', 'shipped')
      GROUP BY s.id, s.name
      ORDER BY total_revenue DESC
    `;
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Аналитика по брендам
   */
  static async getBrandAnalytics(companyId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    
    let whereConditions = ['o.company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        b.name as brand_name,
        b.id as brand_id,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue,
        SUM(oi.quantity * ws.purchase_price) as total_cost,
        (SUM(oi.total_price) - SUM(oi.quantity * ws.purchase_price)) as total_margin,
        COUNT(DISTINCT oi.product_id) as unique_products,
        AVG(oi.unit_price) as avg_selling_price,
        AVG(ws.purchase_price) as avg_purchase_price,
        CASE 
          WHEN SUM(oi.total_price) > 0 
          THEN ((SUM(oi.total_price) - SUM(oi.quantity * ws.purchase_price)) / SUM(oi.total_price)) * 100
          ELSE 0 
        END as margin_percentage
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN brands b ON p.brand_id = b.id
      LEFT JOIN warehouse_stocks ws ON oi.warehouse_id = ws.warehouse_id AND oi.product_id = ws.product_id
      WHERE ${whereConditions.join(' AND ')}
        AND o.status IN ('completed', 'shipped')
      GROUP BY b.id, b.name
      ORDER BY total_revenue DESC
    `;
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Аналитика по категориям
   */
  static async getCategoryAnalytics(companyId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    
    let whereConditions = ['o.company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        c.name as category_name,
        c.id as category_id,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue,
        SUM(oi.quantity * ws.purchase_price) as total_cost,
        (SUM(oi.total_price) - SUM(oi.quantity * ws.purchase_price)) as total_margin,
        COUNT(DISTINCT oi.product_id) as unique_products,
        AVG(oi.unit_price) as avg_selling_price,
        AVG(ws.purchase_price) as avg_purchase_price,
        CASE 
          WHEN SUM(oi.total_price) > 0 
          THEN ((SUM(oi.total_price) - SUM(oi.quantity * ws.purchase_price)) / SUM(oi.total_price)) * 100
          ELSE 0 
        END as margin_percentage
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN warehouse_stocks ws ON oi.warehouse_id = ws.warehouse_id AND oi.product_id = ws.product_id
      WHERE ${whereConditions.join(' AND ')}
        AND o.status IN ('completed', 'shipped')
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC
    `;
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Аналитика по складам
   */
  static async getWarehouseAnalytics(companyId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    
    let whereConditions = ['o.company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        w.name as warehouse_name,
        w.id as warehouse_id,
        w.city,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue,
        COUNT(DISTINCT oi.product_id) as unique_products,
        AVG(oi.unit_price) as avg_selling_price
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN warehouses w ON oi.warehouse_id = w.id
      WHERE ${whereConditions.join(' AND ')}
        AND o.status IN ('completed', 'shipped')
      GROUP BY w.id, w.name, w.city
      ORDER BY total_revenue DESC
    `;
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Получение сводной аналитики
   */
  static async getDashboardAnalytics(companyId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    
    let whereConditions = ['o.company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        SUM(oi.total_price) as total_revenue,
        AVG(oi.total_price) as avg_order_value,
        COUNT(DISTINCT o.customer_email) as unique_customers,
        SUM(oi.quantity) as total_items_sold,
        COUNT(DISTINCT oi.product_id) as unique_products_sold,
        SUM(oi.quantity * ws.purchase_price) as total_cost,
        (SUM(oi.total_price) - SUM(oi.quantity * ws.purchase_price)) as total_margin,
        CASE 
          WHEN SUM(oi.total_price) > 0 
          THEN ((SUM(oi.total_price) - SUM(oi.quantity * ws.purchase_price)) / SUM(oi.total_price)) * 100
          ELSE 0 
        END as margin_percentage
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN warehouse_stocks ws ON oi.warehouse_id = ws.warehouse_id AND oi.product_id = ws.product_id
      WHERE ${whereConditions.join(' AND ')}
        AND o.status IN ('completed', 'shipped')
    `;
    
    const result = await db.query(query, params);
    return result.rows[0];
  }

  /**
   * Кэширование аналитики
   */
  static async cacheAnalytics(companyId, analyticsType, data, ttl = 3600) {
    const cacheKey = `analytics:${companyId}:${analyticsType}`;
    await redis.setex(cacheKey, ttl, JSON.stringify(data));
  }

  /**
   * Получение кэшированной аналитики
   */
  static async getCachedAnalytics(companyId, analyticsType) {
    const cacheKey = `analytics:${companyId}:${analyticsType}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  }

  /**
   * Обновление популярности товаров
   */
  static async updateProductPopularity(companyId) {
    const query = `
      UPDATE products 
      SET popularity_score = (
        SELECT COALESCE(
          (COUNT(DISTINCT o.id) * 0.4 + 
           SUM(oi.quantity) * 0.3 + 
           SUM(oi.total_price) * 0.3), 0
        )
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE oi.product_id = products.id
          AND o.company_id = $1
          AND o.status IN ('completed', 'shipped')
          AND o.created_at >= NOW() - INTERVAL '30 days'
      )
      WHERE company_id = $1
    `;
    
    await db.query(query, [companyId]);
  }
}

module.exports = AnalyticsService;