// ===================================================
// ФАЙЛ: backend/src/jobs/cacheCleanupJob.js
// JOB: Очистка кэша и оптимизация
// ===================================================

const db = require('../config/database');
const logger = require('../utils/logger');
const redis = require('../config/redis');

class CacheCleanupJob {
  constructor() {
    this.jobName = 'cache_cleanup';
    this.isRunning = false;
  }

  /**
   * Запуск задачи
   */
  async run() {
    if (this.isRunning) {
      logger.warn('CacheCleanupJob is already running');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting CacheCleanupJob');

      // Очистка Redis кэша
      await this.cleanupRedisCache();

      // Очистка старых данных из БД
      await this.cleanupOldData();

      // Оптимизация таблиц
      await this.optimizeTables();

      // Обновление статистики
      await this.updateStatistics();

      const duration = Date.now() - startTime;
      logger.info(`CacheCleanupJob completed in ${duration}ms`);

    } catch (error) {
      logger.error('CacheCleanupJob error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Очистка Redis кэша
   */
  async cleanupRedisCache() {
    try {
      logger.info('Cleaning up Redis cache');

      // Получаем все ключи
      const keys = await redis.keys('*');

      let deletedCount = 0;
      for (const key of keys) {
        // Проверяем TTL ключа
        const ttl = await redis.ttl(key);

        // Удаляем ключи с истекшим TTL или старые ключи
        if (ttl === -1 || ttl === -2) {
          await redis.del(key);
          deletedCount++;
        }
      }

      logger.info(`Cleaned up ${deletedCount} Redis keys`);

    } catch (error) {
      logger.error('Error cleaning up Redis cache:', error);
    }
  }

  /**
   * Очистка старых данных из БД
   */
  async cleanupOldData() {
    try {
      logger.info('Cleaning up old data from database');

      // Очистка старых логов API
      const apiLogsResult = await db.query(`
        DELETE FROM api_logs
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);
      logger.info(`Deleted ${apiLogsResult.rowCount} old API logs`);

      // Очистка старых логов синхронизации
      const syncLogsResult = await db.query(`
        DELETE FROM sync_logs
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);
      logger.info(`Deleted ${syncLogsResult.rowCount} old sync logs`);

      // Очистка старых аудит логов
      const auditLogsResult = await db.query(`
        DELETE FROM audit_logs
        WHERE created_at < NOW() - INTERVAL '180 days'
      `);
      logger.info(`Deleted ${auditLogsResult.rowCount} old audit logs`);

      // Очистка старых транзакций биллинга
      const billingTransactionsResult = await db.query(`
        DELETE FROM billing_transactions
        WHERE created_at < NOW() - INTERVAL '365 days'
      `);
      logger.info(`Deleted ${billingTransactionsResult.rowCount} old billing transactions`);

      // Очистка старых просмотров товаров
      const productViewsResult = await db.query(`
        DELETE FROM product_views
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);
      logger.info(`Deleted ${productViewsResult.rowCount} old product views`);

      // Очистка старых отзывов
      const productReviewsResult = await db.query(`
        DELETE FROM product_reviews
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);
      logger.info(`Deleted ${productReviewsResult.rowCount} old product reviews`);

    } catch (error) {
      logger.error('Error cleaning up old data:', error);
    }
  }

  /**
   * Оптимизация таблиц
   */
  async optimizeTables() {
    try {
      logger.info('Optimizing database tables');

      const tables = [
        'products',
        'orders',
        'order_items',
        'warehouse_product_links',
        'api_logs',
        'sync_logs',
        'audit_logs',
        'billing_transactions',
        'product_views',
        'product_reviews',
        'product_popularity'
      ];

      for (const table of tables) {
        try {
          await db.query(`VACUUM ANALYZE ${table}`);
          logger.info(`Optimized table: ${table}`);
        } catch (error) {
          logger.error(`Error optimizing table ${table}:`, error);
        }
      }

    } catch (error) {
      logger.error('Error optimizing tables:', error);
    }
  }

  /**
   * Обновление статистики
   */
  async updateStatistics() {
    try {
      logger.info('Updating database statistics');

      // Обновление статистики по таблицам
      await db.query('ANALYZE');
      logger.info('Updated database statistics');

    } catch (error) {
      logger.error('Error updating statistics:', error);
    }
  }

  /**
   * Очистка кэша для конкретной компании
   */
  async cleanupCompanyCache(companyId) {
    try {
      const patterns = [
        `products:company:${companyId}:*`,
        `orders:company:${companyId}:*`,
        `analytics:company:${companyId}:*`,
        `popularity:company:${companyId}:*`,
        `warehouse:company:${companyId}:*`
      ];

      let deletedCount = 0;
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          deletedCount += keys.length;
        }
      }

      logger.info(`Cleaned up ${deletedCount} cache keys for company ${companyId}`);

    } catch (error) {
      logger.error(`Error cleaning up cache for company ${companyId}:`, error);
    }
  }

  /**
   * Очистка кэша для конкретного товара
   */
  async cleanupProductCache(productId) {
    try {
      const patterns = [
        `product:${productId}:*`,
        `stock:product:${productId}:*`,
        `popularity:product:${productId}:*`
      ];

      let deletedCount = 0;
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          deletedCount += keys.length;
        }
      }

      logger.info(`Cleaned up ${deletedCount} cache keys for product ${productId}`);

    } catch (error) {
      logger.error(`Error cleaning up cache for product ${productId}:`, error);
    }
  }

  /**
   * Получение статистики кэша
   */
  async getCacheStats() {
    try {
      const keys = await redis.keys('*');
      const stats = {
        total_keys: keys.length,
        memory_usage: await redis.memory('USAGE'),
        keys_by_pattern: {}
      };

      // Группировка ключей по паттернам
      const patterns = [
        'products:*',
        'orders:*',
        'analytics:*',
        'popularity:*',
        'warehouse:*',
        'stock:*'
      ];

      for (const pattern of patterns) {
        const patternKeys = await redis.keys(pattern);
        stats.keys_by_pattern[pattern] = patternKeys.length;
      }

      return stats;

    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Очистка всех кэшей
   */
  async clearAllCache() {
    try {
      logger.info('Clearing all cache');
      await redis.flushall();
      logger.info('All cache cleared');

    } catch (error) {
      logger.error('Error clearing all cache:', error);
    }
  }

  /**
   * Проверка здоровья кэша
   */
  async checkCacheHealth() {
    try {
      const stats = await this.getCacheStats();

      if (!stats) {
        return { healthy: false, reason: 'Failed to get cache stats' };
      }

      // Проверяем количество ключей
      if (stats.total_keys > 10000) {
        return {
          healthy: false,
          reason: `Too many cache keys: ${stats.total_keys}`
        };
      }

      // Проверяем использование памяти
      if (stats.memory_usage > 100 * 1024 * 1024) { // 100MB
        return {
          healthy: false,
          reason: `High memory usage: ${Math.round(stats.memory_usage / 1024 / 1024)}MB`
        };
      }

      return { healthy: true, stats };

    } catch (error) {
      logger.error('Error checking cache health:', error);
      return { healthy: false, reason: error.message };
    }
  }
}

module.exports = CacheCleanupJob;