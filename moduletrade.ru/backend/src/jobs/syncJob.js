// ===================================================
// ФАЙЛ: backend/src/jobs/syncJob.js
// ЗАДАЧА СИНХРОНИЗАЦИИ: Синхронизация с маркетплейсами
// ===================================================

const db = require('../config/database');
const logger = require('../utils/logger');
const SyncService = require('../services/SyncService');

class SyncJob {
  /**
   * Синхронизация всех маркетплейсов
   */
  static async syncAllMarketplaces() {
    try {
      logger.info('Starting marketplace sync job...');

      // Получаем все активные интеграции маркетплейсов
      const marketplaceSettings = await this.getActiveMarketplaceSettings();

      for (const setting of marketplaceSettings) {
        try {
          await this.syncMarketplace(setting);
        } catch (error) {
          logger.error(`Error syncing marketplace ${setting.marketplace_name} for company ${setting.company_id}:`, error);
        }
      }

      logger.info('Marketplace sync job completed');

    } catch (error) {
      logger.error('Error in marketplace sync job:', error);
    }
  }

  /**
   * Получение активных настроек маркетплейсов
   */
  static async getActiveMarketplaceSettings() {
    const result = await db.query(`
      SELECT
        mis.id,
        mis.company_id,
        mis.marketplace_id,
        COALESCE((mis.settings->>'sync_interval')::int, mi.sync_interval_minutes, 15) AS sync_interval,
        mis.last_sync_at,
        m.name as marketplace_name,
        m.type as marketplace_type,
        c.name as company_name
      FROM marketplace_integration_settings mis
      JOIN marketplaces m ON mis.marketplace_id = m.id
      JOIN companies c ON mis.company_id = c.id
      LEFT JOIN marketplace_integrations mi ON mi.marketplace_id = m.id
      WHERE mis.is_active = true
        AND c.subscription_status IN ('active', 'trial')
        AND c.is_active = true
    `);

    return result.rows;
  }

  /**
   * Синхронизация конкретного маркетплейса
   */
  static async syncMarketplace(setting) {
    logger.info(`Syncing marketplace ${setting.marketplace_name} for company ${setting.company_name}`);

    // Проверяем, нужно ли синхронизировать
    if (!this.shouldSync(setting)) {
      logger.info(`Skipping sync for ${setting.marketplace_name} - too soon`);
      return;
    }

    try {
      const syncService = new SyncService();

      // Запускаем полную синхронизацию
      await syncService.fullSync(setting.company_id, setting.marketplace_id);

      // Обновляем время последней синхронизации
      await this.updateLastSyncTime(setting.id);

      logger.info(`Successfully synced marketplace ${setting.marketplace_name}`);

    } catch (error) {
      logger.error(`Failed to sync marketplace ${setting.marketplace_name}:`, error);

      // Логируем ошибку синхронизации
      await this.logSyncError(setting, error);

      throw error;
    }
  }

  /**
   * Проверка, нужно ли синхронизировать
   */
  static shouldSync(setting) {
    if (!setting.last_sync_at) {
      return true;
    }

    const lastSync = new Date(setting.last_sync_at);
    const now = new Date();
    const intervalMinutes = setting.sync_interval || 15;

    const timeSinceLastSync = (now - lastSync) / (1000 * 60);

    return timeSinceLastSync >= intervalMinutes;
  }

  /**
   * Обновление времени последней синхронизации
   */
  static async updateLastSyncTime(settingId) {
    await db.query(`
      UPDATE marketplace_integration_settings
      SET last_sync_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [settingId]);
  }

  /**
   * Логирование ошибки синхронизации
   */
  static async logSyncError(setting, error) {
    try {
      await db.query(`
        INSERT INTO sync_logs (
          company_id, marketplace_id, sync_type, status,
          error_message, started_at, completed_at
        ) VALUES (
          $1, $2, 'scheduled', 'failed', $3, NOW(), NOW()
        )
      `, [
        setting.company_id,
        setting.marketplace_id,
        error.message
      ]);

    } catch (logError) {
      logger.error('Error logging sync error:', logError);
    }
  }

  /**
   * Принудительная синхронизация для конкретного маркетплейса
   */
  static async forceSyncMarketplace(companyId, marketplaceId) {
    try {
      logger.info(`Force syncing marketplace ${marketplaceId} for company ${companyId}`);

      const setting = await this.getMarketplaceSetting(companyId, marketplaceId);
      if (!setting) {
        throw new Error('Marketplace setting not found');
      }

      await this.syncMarketplace(setting);

      logger.info(`Force sync completed for marketplace ${marketplaceId}`);

    } catch (error) {
      logger.error(`Error in force sync for marketplace ${marketplaceId}:`, error);
      throw error;
    }
  }

  /**
   * Получение настройки маркетплейса
   */
  static async getMarketplaceSetting(companyId, marketplaceId) {
    const result = await db.query(`
      SELECT
        mis.id,
        mis.company_id,
        mis.marketplace_id,
        COALESCE((mis.settings->>'sync_interval')::int, mi.sync_interval_minutes, 15) AS sync_interval,
        mis.last_sync_at,
        m.name as marketplace_name,
        m.type as marketplace_type,
        c.name as company_name,
        mis.api_credentials,
        mis.settings
      FROM marketplace_integration_settings mis
      JOIN marketplaces m ON mis.marketplace_id = m.id
      JOIN companies c ON mis.company_id = c.id
      LEFT JOIN marketplace_integrations mi ON mi.marketplace_id = m.id
      WHERE mis.company_id = $1
        AND mis.marketplace_id = $2
        AND mis.is_active = true
    `, [companyId, marketplaceId]);

    return result.rows[0] || null;
  }

  /**
   * Синхронизация только товаров
   */
  static async syncProductsOnly(companyId, marketplaceId) {
    try {
      logger.info(`Syncing products for marketplace ${marketplaceId}, company ${companyId}`);

      const setting = await this.getMarketplaceSetting(companyId, marketplaceId);
      if (!setting) {
        throw new Error('Marketplace setting not found');
      }

      const syncService = new SyncService();
      const client = await db.getClient();

      try {
        await client.query('BEGIN');

        // Получаем маркетплейс
        const marketplaceResult = await client.query(`
          SELECT m.*, m.name as marketplace_name
          FROM marketplaces m
          WHERE m.id = $1 AND m.company_id = $2 AND m.is_active = true
        `, [marketplaceId, companyId]);

        if (marketplaceResult.rows.length === 0) {
          throw new Error('Marketplace settings not found');
        }

        const marketplace = marketplaceResult.rows[0];

        // Синхронизируем только товары
        await syncService.syncProducts(client, marketplace, companyId);

        await client.query('COMMIT');

        // Обновляем время последней синхронизации
        await this.updateLastSyncTime(setting.id);

        logger.info(`Products sync completed for marketplace ${marketplaceId}`);

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error(`Error in products sync for marketplace ${marketplaceId}:`, error);
      throw error;
    }
  }

  /**
   * Синхронизация только заказов
   */
  static async syncOrdersOnly(companyId, marketplaceId) {
    try {
      logger.info(`Syncing orders for marketplace ${marketplaceId}, company ${companyId}`);

      const setting = await this.getMarketplaceSetting(companyId, marketplaceId);
      if (!setting) {
        throw new Error('Marketplace setting not found');
      }

      const syncService = new SyncService();
      const client = await db.getClient();

      try {
        await client.query('BEGIN');

        // Получаем маркетплейс
        const marketplaceResult = await client.query(`
          SELECT m.*, m.name as marketplace_name
          FROM marketplaces m
          WHERE m.id = $1 AND m.company_id = $2 AND m.is_active = true
        `, [marketplaceId, companyId]);

        if (marketplaceResult.rows.length === 0) {
          throw new Error('Marketplace settings not found');
        }

        const marketplace = marketplaceResult.rows[0];

        // Синхронизируем только заказы
        await syncService.syncOrders(client, marketplace, companyId);

        await client.query('COMMIT');

        // Обновляем время последней синхронизации
        await this.updateLastSyncTime(setting.id);

        logger.info(`Orders sync completed for marketplace ${marketplaceId}`);

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error(`Error in orders sync for marketplace ${marketplaceId}:`, error);
      throw error;
    }
  }

  /**
   * Получение статистики синхронизации
   */
  static async getSyncStats(companyId, days = 30) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
        MAX(started_at) as last_sync
      FROM sync_logs
      WHERE company_id = $1
        AND started_at >= NOW() - INTERVAL '${days} days'
    `, [companyId]);

    return result.rows[0];
  }

  /**
   * Получение истории синхронизации
   */
  static async getSyncHistory(companyId, marketplaceId = null, limit = 50) {
    let query = `
      SELECT
        sl.id,
        sl.sync_type,
        sl.status,
        sl.started_at,
        sl.completed_at,
        sl.error_message,
        m.name as marketplace_name
      FROM sync_logs sl
      JOIN marketplaces m ON sl.marketplace_id = m.id
      WHERE sl.company_id = $1
    `;

    const params = [companyId];
    let paramIndex = 2;

    if (marketplaceId) {
      query += ` AND sl.marketplace_id = $${paramIndex}`;
      params.push(marketplaceId);
      paramIndex++;
    }

    query += ` ORDER BY sl.started_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await db.query(query, params);

    return result.rows;
  }
}

module.exports = SyncJob;