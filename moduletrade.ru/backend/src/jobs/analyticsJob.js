// ===================================================
// ФАЙЛ: backend/src/jobs/analyticsJob.js
// ЗАДАЧА АНАЛИТИКИ: Генерация отчетов и аналитики
// ===================================================

const db = require('../config/database');
const logger = require('../utils/logger');

class AnalyticsJob {
  /**
   * Генерация ежедневных отчетов
   */
  static async generateDailyReports() {
    try {
      logger.info('Starting daily analytics reports generation...');

      // Получаем все активные компании
      const companies = await this.getActiveCompanies();

      for (const company of companies) {
        try {
          await this.generateCompanyReport(company);
        } catch (error) {
          logger.error(`Error generating report for company ${company.id}:`, error);
        }
      }

      logger.info('Daily analytics reports generation completed');

    } catch (error) {
      logger.error('Error in daily analytics generation:', error);
    }
  }

  /**
   * Получение активных компаний
   */
  static async getActiveCompanies() {
    const result = await db.query(`
      SELECT id, name, subscription_status
      FROM companies
      WHERE is_active = true
        AND subscription_status IN ('active', 'trial')
    `);

    return result.rows;
  }

  /**
   * Генерация отчета для компании
   */
  static async generateCompanyReport(company) {
    logger.info(`Generating daily report for company: ${company.name}`);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Проверяем, не генерировали ли уже отчет за вчера
    const existingReport = await this.checkExistingReport(company.id, yesterdayStr);
    if (existingReport) {
      logger.info(`Report for ${yesterdayStr} already exists for company ${company.name}`);
      return;
    }

    // Собираем данные для отчета
    const reportData = await this.collectReportData(company.id, yesterdayStr);

    // Сохраняем отчет
    await this.saveDailyReport(company.id, yesterdayStr, reportData);

    logger.info(`Daily report generated for company ${company.name}`);
  }

  /**
   * Проверка существующего отчета
   */
  static async checkExistingReport(companyId, date) {
    const result = await db.query(`
      SELECT id FROM daily_reports
      WHERE company_id = $1 AND report_date = $2
    `, [companyId, date]);

    return result.rows.length > 0;
  }

  /**
   * Сбор данных для отчета
   */
  static async collectReportData(companyId, date) {
    const [ordersStats, productsStats, syncStats, topProducts, topCategories] = await Promise.all([
      // Статистика заказов
      this.getOrdersStats(companyId, date),
      
      // Статистика товаров
      this.getProductsStats(companyId, date),
      
      // Статистика синхронизации
      this.getSyncStats(companyId, date),
      
      // Топ товары
      this.getTopProducts(companyId, date),
      
      // Топ категории
      this.getTopCategories(companyId, date)
    ]);

    return {
      orders: ordersStats,
      products: productsStats,
      sync: syncStats,
      top_products: topProducts,
      top_categories: topCategories,
      generated_at: new Date()
    };
  }

  /**
   * Статистика заказов
   */
  static async getOrdersStats(companyId, date) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as avg_order_value,
        COUNT(DISTINCT marketplace_id) as active_marketplaces,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
      FROM orders
      WHERE company_id = $1
        AND DATE(order_date) = $2
    `, [companyId, date]);

    return result.rows[0];
  }

  /**
   * Статистика товаров
   */
  static async getProductsStats(companyId, date) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_products,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
        COUNT(DISTINCT brand_id) as total_brands,
        COUNT(DISTINCT category_id) as total_categories,
        COUNT(CASE WHEN stock_quantity > 0 THEN 1 END) as products_in_stock,
        COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as products_out_of_stock
      FROM products
      WHERE company_id = $1
        AND DATE(updated_at) = $2
    `, [companyId, date]);

    return result.rows[0];
  }

  /**
   * Статистика синхронизации
   */
  static async getSyncStats(companyId, date) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
      FROM sync_logs
      WHERE company_id = $1
        AND DATE(started_at) = $2
    `, [companyId, date]);

    return result.rows[0];
  }

  /**
   * Топ товары по продажам
   */
  static async getTopProducts(companyId, date) {
    const result = await db.query(`
      SELECT
        p.name as product_name,
        p.internal_code,
        COUNT(oi.id) as orders_count,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.price) as total_revenue
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.company_id = $1
        AND DATE(o.order_date) = $2
      GROUP BY p.id, p.name, p.internal_code
      ORDER BY total_revenue DESC
      LIMIT 10
    `, [companyId, date]);

    return result.rows;
  }

  /**
   * Топ категории по продажам
   */
  static async getTopCategories(companyId, date) {
    const result = await db.query(`
      SELECT
        c.name as category_name,
        COUNT(DISTINCT o.id) as orders_count,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.price) as total_revenue
      FROM categories c
      JOIN products p ON c.id = p.category_id
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.company_id = $1
        AND DATE(o.order_date) = $2
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC
      LIMIT 10
    `, [companyId, date]);

    return result.rows;
  }

  /**
   * Сохранение ежедневного отчета
   */
  static async saveDailyReport(companyId, date, reportData) {
    await db.query(`
      INSERT INTO daily_reports (
        company_id, report_date, report_data, created_at
      ) VALUES ($1, $2, $3, NOW())
    `, [companyId, date, JSON.stringify(reportData)]);
  }

  /**
   * Получение отчета за период
   */
  static async getReportForPeriod(companyId, startDate, endDate) {
    const result = await db.query(`
      SELECT report_date, report_data
      FROM daily_reports
      WHERE company_id = $1
        AND report_date BETWEEN $2 AND $3
      ORDER BY report_date DESC
    `, [companyId, startDate, endDate]);

    return result.rows.map(row => ({
      date: row.report_date,
      data: typeof row.report_data === 'string' 
        ? JSON.parse(row.report_data) 
        : row.report_data
    }));
  }

  /**
   * Генерация отчета по требованию
   */
  static async generateOnDemandReport(companyId, date) {
    try {
      logger.info(`Generating on-demand report for company ${companyId}, date ${date}`);

      const company = await this.getCompanyById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      const reportData = await this.collectReportData(companyId, date);
      await this.saveDailyReport(companyId, date, reportData);

      logger.info(`On-demand report generated for company ${companyId}`);

      return reportData;

    } catch (error) {
      logger.error(`Error generating on-demand report for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Получение компании по ID
   */
  static async getCompanyById(companyId) {
    const result = await db.query(`
      SELECT id, name, subscription_status
      FROM companies
      WHERE id = $1 AND is_active = true
    `, [companyId]);

    return result.rows[0] || null;
  }
}

module.exports = AnalyticsJob; 