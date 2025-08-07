// ===================================================
// ФАЙЛ: backend/src/services/BillingService.js
// ПОЛНАЯ РЕАЛИЗАЦИЯ: Управление биллингом и подписками
// ===================================================

const { Pool } = require('pg');
const logger = require('../utils/logger');

class BillingService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    // Инициализация Stripe если есть ключ
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
  }

  /**
   * Получение доступных тарифов
   */
  async getTariffs() {
    try {
      const result = await this.pool.query(`
        SELECT id, name, description, price, limits, features, 
               trial_days, is_active, sort_order
        FROM tariffs
        WHERE is_active = true
        ORDER BY sort_order ASC, price ASC
      `);

      return result.rows.map(tariff => ({
        ...tariff,
        limits: typeof tariff.limits === 'string' ? JSON.parse(tariff.limits) : tariff.limits,
        features: typeof tariff.features === 'string' ? JSON.parse(tariff.features) : tariff.features
      }));

    } catch (error) {
      logger.error('Error fetching tariffs:', error);
      throw error;
    }
  }

  /**
   * Получение информации о подписке компании
   */
  async getSubscriptionInfo(companyId) {
    try {
      const result = await this.pool.query(`
        SELECT 
          c.id as company_id,
          c.name as company_name,
          c.subscription_status,
          c.plan,
          c.trial_end_date,
          c.subscription_start_date,
          c.subscription_end_date,
          t.id as tariff_id,
          t.name as tariff_name,
          t.description as tariff_description,
          t.price as tariff_price,
          t.limits as tariff_limits,
          t.features as tariff_features,
          t.trial_days,
          CASE 
            WHEN c.subscription_status = 'trial' AND c.trial_end_date > NOW() 
            THEN EXTRACT(DAY FROM c.trial_end_date - NOW())::INTEGER
            ELSE 0
          END as days_left_in_trial,
          CASE 
            WHEN c.subscription_status = 'active' AND c.subscription_end_date > NOW()
            THEN EXTRACT(DAY FROM c.subscription_end_date - NOW())::INTEGER
            ELSE 0
          END as days_left_in_subscription
        FROM companies c
        LEFT JOIN tariffs t ON c.plan = t.name
        WHERE c.id = $1
      `, [companyId]);

      if (result.rows.length === 0) {
        throw new Error('Company not found');
      }

      const subscription = result.rows[0];

      return {
        ...subscription,
        tariff_limits: typeof subscription.tariff_limits === 'string' 
          ? JSON.parse(subscription.tariff_limits) 
          : subscription.tariff_limits,
        tariff_features: typeof subscription.tariff_features === 'string' 
          ? JSON.parse(subscription.tariff_features) 
          : subscription.tariff_features
      };

    } catch (error) {
      logger.error('Error fetching subscription info:', error);
      throw error;
    }
  }

  /**
   * Получение текущего использования компанией
   */
  async getUsageStats(companyId) {
    try {
      const result = await this.pool.query(`
        SELECT
          (SELECT COUNT(*) FROM products WHERE company_id = $1) as products_count,
          (SELECT COUNT(*) FROM incoming_orders WHERE company_id = $1 AND created_at >= date_trunc('month', NOW())) as orders_this_month,
          (SELECT COUNT(*) FROM users WHERE company_id = $1 AND is_active = true) as active_users,
          (SELECT COUNT(*) FROM warehouses WHERE company_id = $1 AND is_active = true) as warehouses_count,
          (SELECT COUNT(*) FROM marketplace_settings WHERE company_id = $1 AND is_active = true) as marketplaces_count,
          (SELECT COUNT(*) FROM api_requests WHERE company_id = $1 AND created_at >= date_trunc('month', NOW())) as api_requests_this_month
      `, [companyId]);

      return result.rows[0];

    } catch (error) {
      logger.error('Error fetching usage stats:', error);
      throw error;
    }
  }

  /**
   * Проверка лимитов тарифа
   */
  async checkLimits(companyId, action, additionalCount = 1) {
    try {
      const [subscriptionInfo, usageStats] = await Promise.all([
        this.getSubscriptionInfo(companyId),
        this.getUsageStats(companyId)
      ]);

      const limits = subscriptionInfo.tariff_limits || {};
      
      const checks = {
        products: {
          current: parseInt(usageStats.products_count) || 0,
          limit: limits.max_products || Infinity,
          canAdd: additionalCount
        },
        orders: {
          current: parseInt(usageStats.orders_this_month) || 0,
          limit: limits.max_orders_per_month || Infinity,
          canAdd: additionalCount
        },
        users: {
          current: parseInt(usageStats.active_users) || 0,
          limit: limits.max_users || Infinity,
          canAdd: additionalCount
        },
        warehouses: {
          current: parseInt(usageStats.warehouses_count) || 0,
          limit: limits.max_warehouses || Infinity,
          canAdd: additionalCount
        },
        marketplaces: {
          current: parseInt(usageStats.marketplaces_count) || 0,
          limit: limits.max_marketplaces || Infinity,
          canAdd: additionalCount
        },
        api_requests: {
          current: parseInt(usageStats.api_requests_this_month) || 0,
          limit: limits.max_api_requests_per_month || Infinity,
          canAdd: additionalCount
        }
      };

      // Проверяем конкретное действие если указано
      if (action && checks[action]) {
        const check = checks[action];
        const allowed = (check.current + check.canAdd) <= check.limit;
        
        return {
          allowed,
          current: check.current,
          limit: check.limit,
          remaining: Math.max(0, check.limit - check.current),
          action
        };
      }

      // Возвращаем все проверки
      return {
        subscription_status: subscriptionInfo.subscription_status,
        plan: subscriptionInfo.plan,
        limits: checks,
        trial_days_left: subscriptionInfo.days_left_in_trial,
        subscription_days_left: subscriptionInfo.days_left_in_subscription
      };

    } catch (error) {
      logger.error('Error checking limits:', error);
      throw error;
    }
  }

  /**
   * Смена тарифа
   */
  async changeTariff(companyId, tariffName, paymentMethodId = null) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Получаем информацию о тарифе
      const tariffResult = await client.query(
        'SELECT * FROM tariffs WHERE name = $1 AND is_active = true',
        [tariffName]
      );

      if (tariffResult.rows.length === 0) {
        throw new Error('Tariff not found');
      }

      const tariff = tariffResult.rows[0];

      // Получаем текущую подписку
      const currentSubscription = await this.getSubscriptionInfo(companyId);

      // Если тариф платный и есть Stripe
      let paymentIntent = null;
      if (tariff.price > 0 && this.stripe && paymentMethodId) {
        // Создаем платеж
        paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(tariff.price * 100), // в копейках
          currency: 'rub',
          payment_method: paymentMethodId,
          confirm: true,
          metadata: {
            company_id: companyId.toString(),
            tariff_name: tariffName,
            type: 'subscription'
          }
        });

        if (paymentIntent.status !== 'succeeded') {
          throw new Error('Payment failed');
        }
      }

      // Обновляем подписку компании
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1); // +1 месяц

      await client.query(`
        UPDATE companies
        SET plan = $2,
            subscription_status = $3,
            subscription_start_date = NOW(),
            subscription_end_date = $4,
            updated_at = NOW()
        WHERE id = $1
      `, [
        companyId,
        tariffName,
        tariff.price > 0 ? 'active' : 'trial',
        subscriptionEndDate
      ]);

      // Записываем транзакцию
      await client.query(`
        INSERT INTO billing_transactions (
          company_id, type, amount, currency, status,
          tariff_name, payment_intent_id, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `, [
        companyId,
        'subscription',
        tariff.price,
        'RUB',
        paymentIntent ? 'completed' : 'free',
        tariffName,
        paymentIntent?.id || null,
        JSON.stringify({
          previous_plan: currentSubscription.plan,
          payment_method_id: paymentMethodId
        })
      ]);

      await client.query('COMMIT');

      logger.info(`Company ${companyId} changed tariff to ${tariffName}`, {
        previousPlan: currentSubscription.plan,
        newPlan: tariffName,
        amount: tariff.price
      });

      return {
        success: true,
        tariff_name: tariffName,
        amount: tariff.price,
        subscription_end_date: subscriptionEndDate,
        payment_intent_id: paymentIntent?.id
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error changing tariff:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получение истории транзакций
   */
  async getTransactions(companyId, limit = 50, offset = 0) {
    try {
      const result = await this.pool.query(`
        SELECT id, type, amount, currency, status, tariff_name,
               payment_intent_id, metadata, created_at
        FROM billing_transactions
        WHERE company_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [companyId, limit, offset]);

      return result.rows.map(transaction => ({
        ...transaction,
        metadata: typeof transaction.metadata === 'string' 
          ? JSON.parse(transaction.metadata) 
          : transaction.metadata
      }));

    } catch (error) {
      logger.error('Error fetching transactions:', error);
      throw error;
    }
  }

  /**
   * Обработка вебхука Stripe
   */
  async handleStripeWebhook(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handleSubscriptionPayment(event.data.object);
          break;
        default:
          logger.info(`Unhandled Stripe event: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling Stripe webhook:', error);
      throw error;
    }
  }

  /**
   * Обработка успешной оплаты
   */
  async handlePaymentSuccess(paymentIntent) {
    const companyId = parseInt(paymentIntent.metadata.company_id);
    const tariffName = paymentIntent.metadata.tariff_name;

    await this.pool.query(`
      UPDATE billing_transactions
      SET status = 'completed',
          updated_at = NOW()
      WHERE payment_intent_id = $1
    `, [paymentIntent.id]);

    logger.info(`Payment succeeded for company ${companyId}, tariff ${tariffName}`);
  }

  /**
   * Обработка неудачной оплаты
   */
  async handlePaymentFailed(paymentIntent) {
    const companyId = parseInt(paymentIntent.metadata.company_id);

    await this.pool.query(`
      UPDATE billing_transactions
      SET status = 'failed',
          updated_at = NOW()
      WHERE payment_intent_id = $1
    `, [paymentIntent.id]);

    // Можно добавить уведомление пользователю
    logger.warn(`Payment failed for company ${companyId}`);
  }

  /**
   * Проверка истечения подписок (для cron задачи)
   */
  async checkExpiredSubscriptions() {
    try {
      const result = await this.pool.query(`
        SELECT id, name, subscription_end_date, plan
        FROM companies
        WHERE subscription_status = 'active'
          AND subscription_end_date <= NOW()
      `);

      for (const company of result.rows) {
        // Переводим в статус expired
        await this.pool.query(`
          UPDATE companies
          SET subscription_status = 'expired',
              updated_at = NOW()
          WHERE id = $1
        `, [company.id]);

        logger.warn(`Subscription expired for company ${company.name} (${company.id})`);

        // Здесь можно добавить отправку уведомления
      }

      return result.rows.length;

    } catch (error) {
      logger.error('Error checking expired subscriptions:', error);
      throw error;
    }
  }
}

module.exports = BillingService;