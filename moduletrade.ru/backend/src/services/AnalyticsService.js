// backend/src/services/AnalyticsService.js
const db = require('../config/database');
const logger = require('../utils/logger');

class AnalyticsService {
  /**
   * Обновление рейтингов популярности товаров
   */
  async updatePopularityScores(tenantId) {
    try {
      logger.info(`Updating popularity scores for tenant ${tenantId}`);

      const result = await db.raw(`
        UPDATE products p
        SET popularity_score = subquery.score
        FROM (
          SELECT
            p.id,
            COALESCE(COUNT(DISTINCT oi.order_id), 0) * 3 +
            COALESCE(SUM(oi.quantity), 0) * 2 +
            COALESCE(AVG(p.view_count), 0) * 1 as score
          FROM products p
          LEFT JOIN order_items oi ON oi.product_id = p.id
          WHERE p.tenant_id = ?
          GROUP BY p.id
        ) AS subquery
        WHERE p.id = subquery.id
          AND p.tenant_id = ?
      `, [tenantId, tenantId]);

      logger.info(`Popularity scores updated for ${result.rowCount} products`);
      return { success: true, updated: result.rowCount };
    } catch (error) {
      logger.error('Error updating popularity scores:', error);
      throw error;
    }
  }

  /**
   * Получение аналитики по продажам
   */
  async getSalesAnalytics(tenantId, dateFrom, dateTo) {
    try {
      const analytics = await db('orders')
        .where({ tenant_id: tenantId })
        .whereBetween('created_at', [dateFrom, dateTo])
        .select(
          db.raw('COUNT(*) as total_orders'),
          db.raw('SUM(total_amount) as total_revenue'),
          db.raw('AVG(total_amount) as avg_order_value'),
          db.raw('COUNT(DISTINCT customer_id) as unique_customers')
        )
        .first();

      return analytics;
    } catch (error) {
      logger.error('Error getting sales analytics:', error);
      throw error;
    }
  }

  /**
   * Получение топ товаров
   */
  async getTopProducts(tenantId, limit = 10) {
    try {
      const products = await db('products')
        .where({ 'products.tenant_id': tenantId })
        .join('order_items', 'products.id', 'order_items.product_id')
        .select(
          'products.id',
          'products.name',
          'products.sku',
          db.raw('COUNT(DISTINCT order_items.order_id) as order_count'),
          db.raw('SUM(order_items.quantity) as total_sold'),
          db.raw('SUM(order_items.quantity * order_items.price) as total_revenue')
        )
        .groupBy('products.id', 'products.name', 'products.sku')
        .orderBy('total_revenue', 'desc')
        .limit(limit);

      return products;
    } catch (error) {
      logger.error('Error getting top products:', error);
      throw error;
    }
  }

  /**
   * Анализ производительности маркетплейсов
   */
  async getMarketplacePerformance(tenantId) {
    try {
      const performance = await db('orders')
        .where({ 'orders.tenant_id': tenantId })
        .join('marketplaces', 'orders.marketplace_id', 'marketplaces.id')
        .select(
          'marketplaces.id',
          'marketplaces.name',
          db.raw('COUNT(*) as order_count'),
          db.raw('SUM(orders.total_amount) as total_revenue'),
          db.raw('AVG(orders.total_amount) as avg_order_value')
        )
        .groupBy('marketplaces.id', 'marketplaces.name');

      return performance;
    } catch (error) {
      logger.error('Error getting marketplace performance:', error);
      throw error;
    }
  }

  /**
   * Получение статистики по складам
   */
  async getWarehouseStats(tenantId) {
    try {
      const stats = await db('warehouse_stock')
        .where({ tenant_id: tenantId })
        .join('warehouses', 'warehouse_stock.warehouse_id', 'warehouses.id')
        .select(
          'warehouses.id',
          'warehouses.name',
          db.raw('COUNT(DISTINCT warehouse_stock.product_id) as unique_products'),
          db.raw('SUM(warehouse_stock.quantity) as total_quantity'),
          db.raw('SUM(warehouse_stock.reserved_quantity) as total_reserved')
        )
        .groupBy('warehouses.id', 'warehouses.name');

      return stats;
    } catch (error) {
      logger.error('Error getting warehouse stats:', error);
      throw error;
    }
  }

  /**
   * Анализ эффективности поставщиков
   */
  async getSupplierPerformance(tenantId) {
    try {
      const performance = await db('supplier_orders')
        .where({ 'supplier_orders.tenant_id': tenantId })
        .join('suppliers', 'supplier_orders.supplier_id', 'suppliers.id')
        .select(
          'suppliers.id',
          'suppliers.name',
          db.raw('COUNT(*) as order_count'),
          db.raw('SUM(supplier_orders.total_amount) as total_spent'),
          db.raw('AVG(supplier_orders.total_amount) as avg_order_value'),
          db.raw('AVG(EXTRACT(EPOCH FROM (supplier_orders.delivered_at - supplier_orders.created_at))/86400) as avg_delivery_days')
        )
        .groupBy('suppliers.id', 'suppliers.name');

      return performance;
    } catch (error) {
      logger.error('Error getting supplier performance:', error);
      throw error;
    }
  }

  /**
   * Получение трендов продаж
   */
  async getSalesTrends(tenantId, period = 'day', days = 30) {
    try {
      let dateFormat;
      switch(period) {
        case 'hour':
          dateFormat = 'YYYY-MM-DD HH24:00:00';
          break;
        case 'day':
          dateFormat = 'YYYY-MM-DD';
          break;
        case 'week':
          dateFormat = 'IYYY-IW';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          break;
        default:
          dateFormat = 'YYYY-MM-DD';
      }

      const trends = await db('orders')
        .where({ tenant_id: tenantId })
        .where('created_at', '>=', db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
        .select(
          db.raw(`TO_CHAR(created_at, '${dateFormat}') as period`),
          db.raw('COUNT(*) as order_count'),
          db.raw('SUM(total_amount) as revenue')
        )
        .groupBy('period')
        .orderBy('period');

      return trends;
    } catch (error) {
      logger.error('Error getting sales trends:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;