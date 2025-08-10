// ===================================================
// ФАЙЛ: backend/src/jobs/scheduler.js
// ПЛАНИРОВЩИК ЗАДАЧ: Управление фоновыми задачами
// ===================================================

const cron = require('node-cron');
const logger = require('../utils/logger');
const ProductImportJob = require('./productImportJob');
const AnalyticsJob = require('./analyticsJob');
const PriceUpdateJob = require('./priceUpdateJob');
const SubscriptionJob = require('./subscriptionJob');
const SyncJob = require('./syncJob');
const PopularityUpdateJob = require('./popularityUpdateJob');
const CacheCleanupJob = require('./cacheCleanupJob');
const db = require('../config/database');
const ExportJob = require('./exportJob');

class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Запуск планировщика
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Job scheduler is already running');
      return;
    }

    logger.info('Starting job scheduler...');

    // Загружаем расписания из БД
    await this.loadSchedulesFromDatabase();

    this.isRunning = true;
    logger.info('Job scheduler started successfully');
  }

  /**
   * Остановка планировщика
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Job scheduler is not running');
      return;
    }

    logger.info('Stopping job scheduler...');

    for (const [jobName, job] of this.jobs) {
      job.stop();
      logger.info(`Stopped job: ${jobName}`);
    }

    this.jobs.clear();
    this.isRunning = false;
    logger.info('Job scheduler stopped');
  }

  /**
   * Планирование задачи
   */
  scheduleJob(name, schedule, task) {
    try {
      const job = cron.schedule(schedule, async () => {
        try {
          logger.info(`Starting scheduled job: ${name}`);
          await task();
          logger.info(`Completed scheduled job: ${name}`);
        } catch (error) {
          logger.error(`Error in scheduled job ${name}:`, error);
        }
      }, {
        scheduled: false
      });

      this.jobs.set(name, job);
      job.start();
      logger.info(`Scheduled job: ${name} with schedule: ${schedule}`);

    } catch (error) {
      logger.error(`Failed to schedule job ${name}:`, error);
    }
  }

  /**
   * Загрузка расписаний из таблицы sync_schedules
   */
  async loadSchedulesFromDatabase() {
    try {
      const result = await db.query(`
        SELECT id, company_id, schedule_name, schedule_type, cron_expression, is_active, settings
        FROM sync_schedules
        WHERE is_active = true
      `);

      if (result.rows.length === 0) {
        logger.warn('No active schedules found in sync_schedules. Scheduling sensible defaults.');

        // Бэкап по умолчанию, если миграции не создали sync_schedules
        this.scheduleJob('product-import', '0 * * * *', () => ProductImportJob.runScheduledImports());
        this.scheduleJob('price-update', '*/30 * * * *', () => PriceUpdateJob.updatePrices());
        this.scheduleJob('analytics', '0 2 * * *', () => AnalyticsJob.generateDailyReports());
        this.scheduleJob('subscription-check', '0 6 * * *', () => SubscriptionJob.checkExpiredSubscriptions());
        this.scheduleJob('marketplace-sync', '*/15 * * * *', () => SyncJob.syncAllMarketplaces());
        this.scheduleJob('popularity-update', '0 4 * * *', () => { const j = new PopularityUpdateJob(); j.run(); });
        this.scheduleJob('cache-cleanup', '0 5 * * *', () => { const j = new CacheCleanupJob(); j.run(); });
        this.scheduleJob('log-cleanup', '0 3 * * *', () => this.cleanupOldLogs());
        return;
      }

      for (const row of result.rows) {
        const name = this.buildJobKey(row);
        const cronExpr = row.cron_expression;
        const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : (row.settings || {});

        this.scheduleJob(name, cronExpr, async () => {
          await this.executeScheduledTask(row.schedule_type, row.company_id, settings);
        });
      }

      logger.info(`Loaded and scheduled ${result.rows.length} jobs from database`);
    } catch (error) {
      logger.error('Failed to load schedules from database:', error);
    }
  }

  buildJobKey(row) {
    // Уникальный ключ: type[:company]
    return row.company_id ? `${row.schedule_type}:${row.company_id}` : row.schedule_type;
  }

  async executeScheduledTask(scheduleType, companyId, settings) {
    switch (scheduleType) {
      case 'import':
        if (companyId) {
          // Поддержка импорта по поставщику/брендам из settings
          const supplierId = settings?.supplier_id || settings?.supplierId;
          const brandIds = settings?.brand_ids || settings?.brandIds;
          if (supplierId) {
            return ProductImportJob.importSupplierForCompany(companyId, supplierId, brandIds);
          }
          return ProductImportJob.forceImportForCompany(companyId);
        }
        return ProductImportJob.runScheduledImports();
      case 'prices':
        if (companyId && typeof PriceUpdateJob.updatePricesForCompany === 'function') {
          return PriceUpdateJob.updatePricesForCompany(companyId);
        }
        return PriceUpdateJob.updatePrices();
      case 'analytics':
        return AnalyticsJob.generateDailyReports();
      case 'subscriptions':
        return SubscriptionJob.checkExpiredSubscriptions();
      case 'marketplaces':
        if (companyId && settings?.marketplace_id) {
          // Точечная синхронизация конкретного МП для компании
          return SyncJob.forceSyncMarketplace(companyId, settings.marketplace_id);
        }
        return SyncJob.syncAllMarketplaces();
      case 'supplier-prices':
        // Обновление цен от поставщика
        if (companyId && settings?.supplier_id) {
          const ProductImportService = require('../services/productImportService');
          return ProductImportService.syncPricesFromSupplier(companyId, settings.supplier_id, settings?.product_ids || []);
        }
        return null;
      case 'supplier-stocks':
        // Обновление остатков от поставщика
        if (companyId && settings?.supplier_id) {
          const ProductImportService = require('../services/productImportService');
          return ProductImportService.syncStocksFromSupplier(companyId, settings.supplier_id, settings?.product_ids || [], { warehouseId: settings?.warehouse_id });
        }
        return null;
      case 'aggregate-warehouses':
        if (companyId) {
          const WarehouseService = require('../services/WarehouseService');
          return WarehouseService.recalculateAggregatedWarehouses(companyId);
        }
        return null;
      case 'popularity':
        return (new PopularityUpdateJob()).run();
      case 'cache-cleanup':
        return (new CacheCleanupJob()).run();
      case 'log-cleanup':
        // Каждый 5-й запуск — расширенная очистка импорт-логов
        try {
          const key = `job_counter:log-cleanup:${companyId || 'global'}`;
          const { get, set } = require('../config/redis');
          let counter = parseInt((await get(key)) || '0', 10) + 1;
          await set(key, String(counter), 60 * 60 * 24 * 30);
          if (counter % 5 === 0) {
            // Очистка логов импорта старше 30 дней (в БД есть функция)
            try { await require('../config/database').query('SELECT cleanup_old_import_logs()'); } catch (_) {}
          }
        } catch (_) {}
        return this.cleanupOldLogs();
      case 'export':
        if (companyId) {
          return ExportJob.runExport(companyId, settings || {});
        }
        return null;
      default:
        logger.warn(`Unknown schedule type: ${scheduleType}`);
        return null;
    }
  }

  /**
   * Перепланировать все задания (вызывается после изменения в БД)
   */
  async rescheduleAll() {
    this.stop();
    await this.start();
  }

  /**
   * Запуск задачи немедленно
   */
  async runJobImmediately(jobName) {
    try {
      logger.info(`Running job immediately: ${jobName}`);

      switch (jobName) {
        case 'product-import':
          await ProductImportJob.runScheduledImports();
          break;
        case 'price-update':
          await PriceUpdateJob.updatePrices();
          break;
        case 'analytics':
          await AnalyticsJob.generateDailyReports();
          break;
        case 'subscription-check':
          await SubscriptionJob.checkExpiredSubscriptions();
          break;
        case 'marketplace-sync':
          await SyncJob.syncAllMarketplaces();
          break;
        case 'popularity-update':
          const popularityJob = new PopularityUpdateJob();
          await popularityJob.run();
          break;
        case 'cache-cleanup':
          const cacheJob = new CacheCleanupJob();
          await cacheJob.run();
          break;
        case 'log-cleanup':
          await this.cleanupOldLogs();
          break;
        default:
          throw new Error(`Unknown job: ${jobName}`);
      }

      logger.info(`Completed immediate job: ${jobName}`);

    } catch (error) {
      logger.error(`Error in immediate job ${jobName}:`, error);
      throw error;
    }
  }

  /**
   * Получение статуса задач
   */
  getJobStatus() {
    const status = {
      isRunning: this.isRunning,
      jobs: []
    };

    for (const [name, job] of this.jobs) {
      status.jobs.push({
        name,
        isRunning: job.running,
        nextRun: job.nextDate()
      });
    }

    return status;
  }

  /**
   * Очистка старых логов
   */
  async cleanupOldLogs() {
    try {
      const db = require('../config/database');
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Очищаем старые логи синхронизации
      await db.query(`
        DELETE FROM sync_logs
        WHERE started_at < $1
      `, [thirtyDaysAgo]);

      // Очищаем старые логи аудита
      await db.query(`
        DELETE FROM audit_logs
        WHERE created_at < $1
      `, [thirtyDaysAgo]);

      // Очищаем старые транзакции биллинга
      await db.query(`
        DELETE FROM billing_transactions
        WHERE created_at < $1 AND status IN ('completed', 'failed')
      `, [thirtyDaysAgo]);

      logger.info('Old logs cleanup completed');

    } catch (error) {
      logger.error('Error during logs cleanup:', error);
    }
  }
}

// Создаем единственный экземпляр планировщика
const scheduler = new JobScheduler();

module.exports = scheduler;