// ===================================================
// ФАЙЛ: backend/src/jobs/popularityUpdateJob.js
// JOB: Обновление популярности товаров
// ===================================================

const db = require('../config/database');
const logger = require('../utils/logger');
const redis = require('../config/redis');

class PopularityUpdateJob {
  constructor() {
    this.jobName = 'popularity_update';
    this.isRunning = false;
  }

  /**
   * Запуск задачи
   */
  async run() {
    if (this.isRunning) {
      logger.warn('PopularityUpdateJob is already running');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting PopularityUpdateJob');

      // Получаем все компании
      const companies = await this.getCompanies();

      for (const company of companies) {
        await this.processCompany(company.id);
      }

      const duration = Date.now() - startTime;
      logger.info(`PopularityUpdateJob completed in ${duration}ms`);

    } catch (error) {
      logger.error('PopularityUpdateJob error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Получение всех активных компаний
   */
  async getCompanies() {
    const result = await db.query(`
      SELECT id, name
      FROM companies
      WHERE is_active = true
        AND subscription_status IN ('active', 'trial')
    `);
    return result.rows;
  }

  /**
   * Обработка одной компании
   */
  async processCompany(companyId) {
    try {
      logger.info(`Processing popularity for company ${companyId}`);

      // Получаем все товары компании
      const products = await this.getCompanyProducts(companyId);

      for (const product of products) {
        await this.updateProductPopularity(product);
      }

      // Обновляем кэш популярности
      await this.updatePopularityCache(companyId);

    } catch (error) {
      logger.error(`Error processing company ${companyId}:`, error);
    }
  }

  /**
   * Получение товаров компании
   */
  async getCompanyProducts(companyId) {
    const result = await db.query(`
      SELECT id, name, sku, brand_id, category_id
      FROM products
      WHERE company_id = $1 AND is_active = true
    `, [companyId]);
    return result.rows;
  }

  /**
   * Обновление популярности товара
   */
  async updateProductPopularity(product) {
    try {
      // Получаем статистику просмотров
      const viewStats = await this.getViewStats(product.id);

      // Получаем статистику заказов
      const orderStats = await this.getOrderStats(product.id);

      // Получаем статистику отзывов
      const reviewStats = await this.getReviewStats(product.id);

      // Рассчитываем популярность
      const popularityScore = this.calculatePopularityScore({
        viewStats,
        orderStats,
        reviewStats
      });

      // Обновляем или создаем запись популярности
      await this.upsertPopularity(product.id, {
        popularity_score: popularityScore,
        view_count: viewStats.total_views,
        order_count: orderStats.total_orders,
        review_count: reviewStats.total_reviews,
        avg_rating: reviewStats.avg_rating,
        conversion_rate: this.calculateConversionRate(viewStats.total_views, orderStats.total_orders),
        last_updated: new Date()
      });

    } catch (error) {
      logger.error(`Error updating popularity for product ${product.id}:`, error);
    }
  }

  /**
   * Получение статистики просмотров
   */
  async getViewStats(productId) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_views,
        COUNT(DISTINCT DATE(created_at)) as active_days,
        MAX(created_at) as last_view
      FROM product_views
      WHERE product_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
    `, [productId]);

    return result.rows[0] || {
      total_views: 0,
      active_days: 0,
      last_view: null
    };
  }

  /**
   * Получение статистики заказов
   */
  async getOrderStats(productId) {
      const result = await db.query(`
      SELECT
        COUNT(DISTINCT o.id) as total_orders,
        SUM(oi.quantity) as total_quantity,
          AVG(oi.unit_price) as avg_price,
        MAX(o.created_at) as last_order
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = $1
        AND o.created_at >= NOW() - INTERVAL '30 days'
    `, [productId]);

    return result.rows[0] || {
      total_orders: 0,
      total_quantity: 0,
      avg_price: 0,
      last_order: null
    };
  }

  /**
   * Получение статистики отзывов
   */
  async getReviewStats(productId) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_reviews,
        AVG(rating) as avg_rating,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_reviews,
        MAX(created_at) as last_review
      FROM product_reviews
      WHERE product_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
    `, [productId]);

    return result.rows[0] || {
      total_reviews: 0,
      avg_rating: 0,
      positive_reviews: 0,
      last_review: null
    };
  }

  /**
   * Расчет популярности
   */
  calculatePopularityScore(stats) {
    const { viewStats, orderStats, reviewStats } = stats;

    let score = 0;

    // Вес просмотров: 30%
    const viewScore = Math.min(viewStats.total_views / 100, 1) * 30;
    score += viewScore;

    // Вес заказов: 40%
    const orderScore = Math.min(orderStats.total_orders / 10, 1) * 40;
    score += orderScore;

    // Вес отзывов: 20%
    const reviewScore = Math.min(reviewStats.total_reviews / 5, 1) * 20;
    score += reviewScore;

    // Вес рейтинга: 10%
    const ratingScore = (reviewStats.avg_rating / 5) * 10;
    score += ratingScore;

    return Math.round(score * 100) / 100;
  }

  /**
   * Расчет конверсии
   */
  calculateConversionRate(views, orders) {
    if (views === 0) return 0;
    return Math.round((orders / views) * 100 * 100) / 100;
  }

  /**
   * Обновление или создание записи популярности
   */
  async upsertPopularity(productId, data) {
    const query = `
      INSERT INTO product_popularity (
        product_id, popularity_score, view_count, order_count,
        review_count, avg_rating, conversion_rate, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (product_id)
      DO UPDATE SET
        popularity_score = EXCLUDED.popularity_score,
        view_count = EXCLUDED.view_count,
        order_count = EXCLUDED.order_count,
        review_count = EXCLUDED.review_count,
        avg_rating = EXCLUDED.avg_rating,
        conversion_rate = EXCLUDED.conversion_rate,
        last_updated = EXCLUDED.last_updated
    `;

    await db.query(query, [
      productId,
      data.popularity_score,
      data.view_count,
      data.order_count,
      data.review_count,
      data.avg_rating,
      data.conversion_rate,
      data.last_updated
    ]);
  }

  /**
   * Обновление кэша популярности
   */
  async updatePopularityCache(companyId) {
    try {
      // Получаем топ товаров по популярности
      const topProducts = await db.query(`
        SELECT p.id, p.name, pop.popularity_score
        FROM products p
        JOIN product_popularity pop ON p.id = pop.product_id
        WHERE p.company_id = $1
        ORDER BY pop.popularity_score DESC
        LIMIT 10
      `, [companyId]);

      // Сохраняем в кэш
      const cacheKey = `popularity:company:${companyId}`;
      await redis.setex(cacheKey, 3600, JSON.stringify(topProducts.rows));

    } catch (error) {
      logger.error(`Error updating popularity cache for company ${companyId}:`, error);
    }
  }

  /**
   * Получение популярных товаров из кэша
   */
  async getPopularProductsFromCache(companyId) {
    try {
      const cacheKey = `popularity:company:${companyId}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      return [];
    } catch (error) {
      logger.error(`Error getting popular products from cache for company ${companyId}:`, error);
      return [];
    }
  }

  /**
   * Очистка старых данных
   */
  async cleanupOldData() {
    try {
      // Удаляем старые просмотры (старше 90 дней)
      await db.query(`
        DELETE FROM product_views
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);

      // Удаляем старые отзывы (старше 90 дней)
      await db.query(`
        DELETE FROM product_reviews
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);

      logger.info('Cleaned up old popularity data');
    } catch (error) {
      logger.error('Error cleaning up old popularity data:', error);
    }
  }

  /**
   * Получение статистики популярности
   */
  async getPopularityStats(companyId) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_products,
        AVG(popularity_score) as avg_popularity,
        MAX(popularity_score) as max_popularity,
        MIN(popularity_score) as min_popularity,
        COUNT(CASE WHEN popularity_score >= 70 THEN 1 END) as high_popularity_count,
        COUNT(CASE WHEN popularity_score <= 30 THEN 1 END) as low_popularity_count
      FROM product_popularity pop
      JOIN products p ON pop.product_id = p.id
      WHERE p.company_id = $1
    `, [companyId]);

    return result.rows[0] || {
      total_products: 0,
      avg_popularity: 0,
      max_popularity: 0,
      min_popularity: 0,
      high_popularity_count: 0,
      low_popularity_count: 0
    };
  }
}

module.exports = PopularityUpdateJob;