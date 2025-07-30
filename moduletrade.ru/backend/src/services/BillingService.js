const db = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class BillingService {
  constructor() {
    this.tariffLimits = new Map();
  }

  // Инициализация тарифов
  async initializeTariffs() {
    const result = await db.mainPool.query('SELECT * FROM tariffs WHERE is_active = true');
    
    for (const tariff of result.rows) {
      this.tariffLimits.set(tariff.code, {
        id: tariff.id,
        name: tariff.name,
        price: tariff.price,
        limits: tariff.limits,
        features: tariff.features
      });
    }
  }

  // Создание подписки
  async createSubscription(tenantId, tariffCode, paymentMethodId) {
    const tariff = this.tariffLimits.get(tariffCode);
    if (!tariff) {
      throw new Error('Invalid tariff code');
    }
    
    const client = await db.mainPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Получаем информацию о клиенте
      const tenantResult = await client.query(
        'SELECT * FROM tenants WHERE id = $1',
        [tenantId]
      );
      
      if (tenantResult.rows.length === 0) {
        throw new Error('Tenant not found');
      }
      
      const tenant = tenantResult.rows[0];
      
      // Создаем клиента в Stripe если нет
      let stripeCustomerId = tenant.stripe_customer_id;
      
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: tenant.email,
          name: tenant.name,
          metadata: {
            tenant_id: tenantId
          }
        });
        
        stripeCustomerId = customer.id;
        
        await client.query(
          'UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2',
          [stripeCustomerId, tenantId]
        );
      }
      
      // Привязываем метод оплаты
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId
      });
      
      // Создаем подписку в Stripe
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{
          price_data: {
            currency: 'rub',
            product_data: {
              name: tariff.name,
              metadata: {
                tariff_code: tariffCode
              }
            },
            unit_amount: tariff.price * 100, // в копейках
            recurring: {
              interval: 'month'
            }
          }
        }],
        default_payment_method: paymentMethodId,
        metadata: {
          tenant_id: tenantId,
          tariff_id: tariff.id
        }
      });
      
      // Сохраняем информацию о подписке
      await client.query(`
        UPDATE tenants 
        SET 
          tariff_id = $1,
          subscription_id = $2,
          subscription_status = $3,
          subscription_end_date = $4,
          settings = jsonb_set(settings, '{tariff_limits}', $5)
        WHERE id = $6
      `, [
        tariff.id,
        subscription.id,
        subscription.status,
        new Date(subscription.current_period_end * 1000),
        JSON.stringify(tariff.limits),
        tenantId
      ]);
      
      // Создаем транзакцию
      await this.createTransaction(client, {
        tenant_id: tenantId,
        type: 'subscription',
        amount: tariff.price,
        description: `Подписка на тариф ${tariff.name}`
      });
      
      await client.query('COMMIT');
      
      return {
        subscription_id: subscription.id,
        status: subscription.status,
        tariff: tariff
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Создание транзакции
  async createTransaction(client, data) {
    // Получаем текущий баланс
    const balanceResult = await client.query(
      'SELECT balance FROM tenants WHERE id = $1',
      [data.tenant_id]
    );
    
    const currentBalance = parseFloat(balanceResult.rows[0].balance || 0);
    const newBalance = data.type === 'payment' 
      ? currentBalance + data.amount 
      : currentBalance - data.amount;
    
    // Создаем транзакцию
    await client.query(`
      INSERT INTO transactions (
        tenant_id, type, amount, 
        balance_before, balance_after, description
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      data.tenant_id,
      data.type,
      data.amount,
      currentBalance,
      newBalance,
      data.description
    ]);
    
    // Обновляем баланс
    await client.query(
      'UPDATE tenants SET balance = $1 WHERE id = $2',
      [newBalance, data.tenant_id]
    );
    
    return newBalance;
  }

  // Проверка лимитов
  async checkLimit(tenantId, limitType, currentValue = 0) {
    const result = await db.mainPool.query(`
      SELECT settings->'tariff_limits' as limits
      FROM tenants 
      WHERE id = $1
    `, [tenantId]);
    
    if (result.rows.length === 0) {
      throw new Error('Tenant not found');
    }
    
    const limits = result.rows[0].limits || {};
    const limit = limits[limitType];
    
    if (limit === undefined || limit === null) {
      return { allowed: true };
    }
    
    const allowed = currentValue < limit;
    
    return {
      allowed,
      limit,
      current: currentValue,
      remaining: Math.max(0, limit - currentValue)
    };
  }

  // Списание за использование API
  async chargeAPIUsage(tenantId, apiCalls) {
    const COST_PER_1000_CALLS = 50; // 50 рублей за 1000 вызовов
    
    if (apiCalls < 1000) return; // Бесплатный лимит
    
    const amount = Math.ceil(apiCalls / 1000) * COST_PER_1000_CALLS;
    
    const client = await db.mainPool.connect();
    
    try {
      await client.query('BEGIN');
      
      await this.createTransaction(client, {
        tenant_id: tenantId,
        type: 'api_usage',
        amount: amount,
        description: `Использование API: ${apiCalls} вызовов`
      });
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Обработка webhook от Stripe
  async handleStripeWebhook(event) {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancelled(event.data.object);
        break;
    }
  }

  async handlePaymentSucceeded(invoice) {
    const tenantId = invoice.metadata.tenant_id;
    const amount = invoice.amount_paid / 100; // из копеек в рубли
    
    const client = await db.mainPool.connect();
    
    try {
      await client.query('BEGIN');
      
      await this.createTransaction(client, {
        tenant_id: tenantId,
        type: 'payment',
        amount: amount,
        description: 'Оплата подписки'
      });
      
      // Продлеваем подписку
      await client.query(`
        UPDATE tenants 
        SET 
          subscription_status = 'active',
          subscription_end_date = $1
        WHERE id = $2
      `, [
        new Date(invoice.lines.data[0].period.end * 1000),
        tenantId
      ]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async handlePaymentFailed(invoice) {
    const tenantId = invoice.metadata.tenant_id;
    
    await db.mainPool.query(`
      UPDATE tenants 
      SET subscription_status = 'past_due'
      WHERE id = $1
    `, [tenantId]);
  }

  async handleSubscriptionCancelled(subscription) {
    const tenantId = subscription.metadata.tenant_id;
    
    await db.mainPool.query(`
      UPDATE tenants 
      SET 
        subscription_status = 'cancelled',
        status = 'suspended'
      WHERE id = $1
    `, [tenantId]);
  }
}

module.exports = BillingService;
