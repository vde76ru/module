// ===================================================
// ФАЙЛ: backend/src/jobs/subscriptionJob.js
// ЗАДАЧА ПРОВЕРКИ ПОДПИСОК: Управление подписками и тарифами
// ===================================================

const db = require('../config/database');
const logger = require('../utils/logger');

class SubscriptionJob {
  /**
   * Проверка истечения подписок
   */
  static async checkExpiredSubscriptions() {
    try {
      logger.info('Starting subscription check job...');

      // Проверяем истекшие подписки
      const expiredSubscriptions = await this.getExpiredSubscriptions();
      
      for (const subscription of expiredSubscriptions) {
        try {
          await this.handleExpiredSubscription(subscription);
        } catch (error) {
          logger.error(`Error handling expired subscription for company ${subscription.id}:`, error);
        }
      }

      // Проверяем подписки с истекающим пробным периодом
      const expiringTrials = await this.getExpiringTrials();
      
      for (const trial of expiringTrials) {
        try {
          await this.handleExpiringTrial(trial);
        } catch (error) {
          logger.error(`Error handling expiring trial for company ${trial.id}:`, error);
        }
      }

      // Проверяем превышение лимитов
      const overLimitCompanies = await this.getOverLimitCompanies();
      
      for (const company of overLimitCompanies) {
        try {
          await this.handleOverLimitCompany(company);
        } catch (error) {
          logger.error(`Error handling over limit company ${company.id}:`, error);
        }
      }

      logger.info('Subscription check job completed');

    } catch (error) {
      logger.error('Error in subscription check job:', error);
    }
  }

  /**
   * Получение истекших подписок
   */
  static async getExpiredSubscriptions() {
    const result = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.subscription_status,
        c.subscription_end_date,
        c.plan,
        t.name as tariff_name,
        t.limits as tariff_limits
      FROM companies c
      LEFT JOIN tariffs t ON c.tariff_id = t.id
      WHERE c.subscription_status = 'active'
        AND c.subscription_end_date <= NOW()
        AND c.is_active = true
    `);

    return result.rows;
  }

  /**
   * Обработка истекшей подписки
   */
  static async handleExpiredSubscription(subscription) {
    logger.info(`Handling expired subscription for company: ${subscription.name}`);

    // Обновляем статус подписки
    await db.query(`
      UPDATE companies
      SET subscription_status = 'expired',
          updated_at = NOW()
      WHERE id = $1
    `, [subscription.id]);

    // Деактивируем товары компании
    await db.query(`
      UPDATE products
      SET is_active = false,
          updated_at = NOW()
      WHERE company_id = $1
    `, [subscription.id]);

    // Логируем событие
    await this.logSubscriptionEvent(subscription.id, 'subscription_expired', {
      old_status: subscription.subscription_status,
      new_status: 'expired',
      tariff_name: subscription.tariff_name
    });

    logger.info(`Subscription expired for company ${subscription.name}`);
  }

  /**
   * Получение компаний с истекающим пробным периодом
   */
  static async getExpiringTrials() {
    const result = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.subscription_status,
        c.trial_end_date,
        c.plan,
        t.name as tariff_name,
        t.trial_days
      FROM companies c
      LEFT JOIN tariffs t ON c.tariff_id = t.id
      WHERE c.subscription_status = 'trial'
        AND c.trial_end_date <= NOW() + INTERVAL '3 days'
        AND c.is_active = true
    `);

    return result.rows;
  }

  /**
   * Обработка истекающего пробного периода
   */
  static async handleExpiringTrial(trial) {
    const daysLeft = Math.ceil((new Date(trial.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      // Пробный период истек
      await db.query(`
        UPDATE companies
        SET subscription_status = 'expired',
            updated_at = NOW()
        WHERE id = $1
      `, [trial.id]);

      await this.logSubscriptionEvent(trial.id, 'trial_expired', {
        old_status: trial.subscription_status,
        new_status: 'expired',
        tariff_name: trial.tariff_name
      });

      logger.info(`Trial expired for company ${trial.name}`);

    } else {
      // Предупреждение о скором истечении
      await this.logSubscriptionEvent(trial.id, 'trial_expiring_soon', {
        days_left: daysLeft,
        tariff_name: trial.tariff_name
      });

      logger.info(`Trial expiring soon for company ${trial.name} (${daysLeft} days left)`);
    }
  }

  /**
   * Получение компаний, превысивших лимиты
   */
  static async getOverLimitCompanies() {
    const result = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.subscription_status,
        c.plan,
        t.name as tariff_name,
        t.limits as tariff_limits,
        (
          SELECT COUNT(*) FROM products WHERE company_id = c.id
        ) as products_count,
        (
          SELECT COUNT(*) FROM orders WHERE company_id = c.id AND order_date >= NOW() - INTERVAL '30 days'
        ) as orders_count
      FROM companies c
      LEFT JOIN tariffs t ON c.tariff_id = t.id
      WHERE c.subscription_status IN ('active', 'trial')
        AND c.is_active = true
    `);

    return result.rows.filter(company => {
      const limits = typeof company.tariff_limits === 'string' 
        ? JSON.parse(company.tariff_limits) 
        : company.tariff_limits;

      return (
        (limits.products && company.products_count > limits.products) ||
        (limits.orders_per_month && company.orders_count > limits.orders_per_month)
      );
    });
  }

  /**
   * Обработка компании, превысившей лимиты
   */
  static async handleOverLimitCompany(company) {
    logger.info(`Handling over limit company: ${company.name}`);

    const limits = typeof company.tariff_limits === 'string' 
      ? JSON.parse(company.tariff_limits) 
      : company.tariff_limits;

    const violations = [];

    if (limits.products && company.products_count > limits.products) {
      violations.push(`Products limit exceeded: ${company.products_count}/${limits.products}`);
    }

    if (limits.orders_per_month && company.orders_count > limits.orders_per_month) {
      violations.push(`Orders limit exceeded: ${company.orders_count}/${limits.orders_per_month}`);
    }

    // Логируем нарушение лимитов
    await this.logSubscriptionEvent(company.id, 'limits_exceeded', {
      violations,
      tariff_name: company.tariff_name,
      current_usage: {
        products: company.products_count,
        orders: company.orders_count
      },
      limits
    });

    // Отправляем уведомление (можно добавить интеграцию с email/sms)
    await this.sendLimitViolationNotification(company, violations);

    logger.info(`Limit violation logged for company ${company.name}`);
  }

  /**
   * Логирование события подписки
   */
  static async logSubscriptionEvent(companyId, eventType, metadata) {
    try {
      await db.query(`
        INSERT INTO subscription_events (
          company_id, event_type, metadata, created_at
        ) VALUES ($1, $2, $3, NOW())
      `, [companyId, eventType, JSON.stringify(metadata)]);

    } catch (error) {
      logger.error('Error logging subscription event:', error);
    }
  }

  /**
   * Отправка уведомления о нарушении лимитов
   */
  static async sendLimitViolationNotification(company, violations) {
    try {
      // Получаем email администратора компании
      const adminResult = await db.query(`
        SELECT email FROM users
        WHERE company_id = $1 AND role = 'admin'
        LIMIT 1
      `, [company.id]);

      if (adminResult.rows.length > 0) {
        const adminEmail = adminResult.rows[0].email;
        
        // Здесь можно добавить отправку email
        logger.info(`Should send limit violation notification to ${adminEmail} for company ${company.name}`);
        
        // Пока просто логируем
        await this.logSubscriptionEvent(company.id, 'notification_sent', {
          recipient: adminEmail,
          violations
        });
      }

    } catch (error) {
      logger.error('Error sending limit violation notification:', error);
    }
  }

  /**
   * Обновление статуса подписки
   */
  static async updateSubscriptionStatus(companyId, newStatus, metadata = {}) {
    try {
      await db.query(`
        UPDATE companies
        SET subscription_status = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [newStatus, companyId]);

      await this.logSubscriptionEvent(companyId, 'status_updated', {
        new_status: newStatus,
        ...metadata
      });

      logger.info(`Subscription status updated to ${newStatus} for company ${companyId}`);

    } catch (error) {
      logger.error(`Error updating subscription status for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Получение статистики подписок
   */
  static async getSubscriptionStats() {
    const result = await db.query(`
      SELECT
        subscription_status,
        COUNT(*) as companies_count,
        COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN subscription_status = 'trial' THEN 1 END) as trial_count,
        COUNT(CASE WHEN subscription_status = 'expired' THEN 1 END) as expired_count
      FROM companies
      WHERE is_active = true
      GROUP BY subscription_status
    `);

    return result.rows;
  }

  /**
   * Получение истории событий подписки
   */
  static async getSubscriptionHistory(companyId, days = 30) {
    const result = await db.query(`
      SELECT 
        event_type,
        metadata,
        created_at
      FROM subscription_events
      WHERE company_id = $1
        AND created_at >= NOW() - INTERVAL '${days} days'
      ORDER BY created_at DESC
    `, [companyId]);

    return result.rows.map(row => ({
      event_type: row.event_type,
      metadata: typeof row.metadata === 'string' 
        ? JSON.parse(row.metadata) 
        : row.metadata,
      created_at: row.created_at
    }));
  }
}

module.exports = SubscriptionJob; 