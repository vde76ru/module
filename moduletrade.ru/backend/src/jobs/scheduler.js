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

class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Запуск планировщика
   */
  start() {
    if (this.isRunning) {
      logger.warn('Job scheduler is already running');
      return;
    }

    logger.info('Starting job scheduler...');

    // Импорт товаров - каждый час
    this.scheduleJob('product-import', '0 * * * *', () => {
      ProductImportJob.runScheduledImports();
    });

    // Обновление цен - каждые 30 минут
    this.scheduleJob('price-update', '*/30 * * * *', () => {
      PriceUpdateJob.updatePrices();
    });

    // Аналитика - каждый день в 2:00
    this.scheduleJob('analytics', '0 2 * * *', () => {
      AnalyticsJob.generateDailyReports();
    });

    // Проверка подписок - каждый день в 6:00
    this.scheduleJob('subscription-check', '0 6 * * *', () => {
      SubscriptionJob.checkExpiredSubscriptions();
    });

    // Синхронизация с маркетплейсами - каждые 15 минут
    this.scheduleJob('marketplace-sync', '*/15 * * * *', () => {
      SyncJob.syncAllMarketplaces();
    });

    // Очистка старых логов - каждый день в 3:00
    this.scheduleJob('log-cleanup', '0 3 * * *', () => {
      this.cleanupOldLogs();
    });

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