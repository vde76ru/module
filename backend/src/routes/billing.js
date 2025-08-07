// backend/src/routes/billing.js
const express = require('express');
const { authenticate, checkPermission } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Безопасная инициализация BillingService
let BillingService, billingService;
try {
  BillingService = require('../services/BillingService');
  billingService = new BillingService();
} catch (error) {
  console.warn('BillingService not available:', error.message);
  billingService = null;
}

// Инициализация Stripe, если есть ключ
if (process.env.STRIPE_SECRET_KEY) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  billingService.stripe = stripe;
}

/**
 * GET /api/billing/tariffs
 * Получение списка доступных тарифов
 */
router.get('/tariffs', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, description, price, limits, features, active
      FROM tariffs
      WHERE active = true
      ORDER BY price ASC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get tariffs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


/**
 * GET /api/billing/subscription-info
 * Получение подробной информации о подписке включая дни до окончания пробного периода
 */
router.get('/subscription-info', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        c.id as company_id,
        c.name as company_name,
        c.subscription_status,
        c.plan,
        c.trial_end_date,
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
      WHERE c.id = $1 AND c.is_active = true
    `, [req.user.companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const company = result.rows[0];

    res.json({
      success: true,
      data: {
        company: {
          id: company.company_id,
          name: company.company_name,
          subscription_status: company.subscription_status,
          tariff_id: company.tariff_id,
          trial_ends_at: company.trial_end_date,
          subscription_end_date: company.subscription_end_date,
          days_left_in_trial: company.days_left_in_trial,
          days_left_in_subscription: company.days_left_in_subscription
        },
        tariff: company.tariff_id ? {
          id: company.tariff_id,
          name: company.tariff_name,
          description: company.tariff_description,
          price: company.tariff_price,
          limits: company.tariff_limits,
          features: company.tariff_features,
          trial_days: company.trial_days
        } : null
      }
    });

  } catch (error) {
    console.error('Get subscription info error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/billing/current-tariff
 * Получение текущего тарифа пользователя
 */
router.get('/current-tariff', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.id, t.name, t.description, t.price, t.limits, t.features,
             ten.created_at as subscription_start
      FROM companies ten
      JOIN tariffs t ON ten.tariff_id = t.id
      WHERE ten.id = $1
    `, [req.user.companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tariff not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get current tariff error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/billing/usage
 * Получение статистики использования
 */
router.get('/usage', authenticate, async (req, res) => {
  try {
    const { period = 'current_month' } = req.query;

    let dateFilter = '';
    switch (period) {
      case 'current_month':
        dateFilter = "DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'last_month':
        dateFilter = "DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')";
        break;
      case 'current_year':
        dateFilter = "DATE_TRUNC('year', CURRENT_DATE)";
        break;
      default:
        dateFilter = "DATE_TRUNC('month', CURRENT_DATE)";
    }

    // Получаем использование API
    const apiUsageResult = await db.query(`
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status = 'rate_limited' THEN 1 END) as rate_limited_requests
      FROM api_logs
      WHERE company_id = $1
        AND created_at >= ${dateFilter}
    `, [req.user.companyId]);

    // Получаем количество товаров
    const productsResult = await db.query(`
      SELECT COUNT(*) as total_products
      FROM products
      WHERE company_id = $1
    `, [req.user.companyId]);

    // Получаем количество пользователей
    const usersResult = await db.query(`
      SELECT COUNT(*) as total_users
      FROM users
      WHERE company_id = $1
    `, [req.user.companyId]);

    // Получаем текущий тариф с лимитами
    const tariffResult = await db.query(`
      SELECT t.limits
      FROM companies ten
      JOIN tariffs t ON ten.tariff_id = t.id
      WHERE ten.id = $1
    `, [req.user.companyId]);

    const limits = tariffResult.rows[0]?.limits || {};

    res.json({
      success: true,
      data: {
        api: {
          total_requests: parseInt(apiUsageResult.rows[0].total_requests),
          successful_requests: parseInt(apiUsageResult.rows[0].successful_requests),
          rate_limited_requests: parseInt(apiUsageResult.rows[0].rate_limited_requests),
          limit: limits.api_calls || null
        },
        products: {
          count: parseInt(productsResult.rows[0].total_products),
          limit: limits.products || null
        },
        users: {
          count: parseInt(usersResult.rows[0].total_users),
          limit: limits.users || null
        },
        storage: {
          used: 0, // TODO: Implement storage calculation
          limit: limits.storage_gb ? limits.storage_gb * 1024 * 1024 * 1024 : 1024 * 1024 * 1024
        }
      }
    });

  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/billing/transactions
 * Получение истории транзакций
 */
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT
        id, type, amount, description, status,
        created_at, updated_at,
        metadata
      FROM billing_transactions
      WHERE company_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.companyId, limit, offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM billing_transactions
      WHERE company_id = $1
    `, [req.user.companyId]);

    res.json({
      success: true,
      data: {
        items: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total)
        }
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/billing/change-tariff
 * Смена тарифного плана
 */
router.post('/change-tariff', authenticate, checkPermission('billing.manage'), async (req, res) => {
  let client;
  try {
    const { tariff_id } = req.body;

    if (!tariff_id) {
      return res.status(400).json({
        success: false,
        error: 'Tariff ID is required'
      });
    }

    // Проверяем, существует ли тариф
    const tariffResult = await db.query(`
      SELECT id, name, price, limits
      FROM tariffs
      WHERE id = $1 AND active = true
    `, [tariff_id]);

    if (tariffResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tariff not found'
      });
    }

    const newTariff = tariffResult.rows[0];

    // Получаем текущий тариф
    const currentTariffResult = await db.query(`
      SELECT t.id, t.name, t.price
      FROM companies ten
      JOIN tariffs t ON ten.tariff_id = t.id
      WHERE ten.id = $1
    `, [req.user.companyId]);

    const currentTariff = currentTariffResult.rows[0];

    // Если тариф тот же самый
    if (currentTariff.id === parseInt(tariff_id)) {
      return res.status(400).json({
        success: false,
        error: 'This tariff is already active'
      });
    }

    // Начинаем транзакцию
    client = await db.pool.connect();
    await client.query('BEGIN');

    try {
      // Обновляем тариф у тенанта
      await client.query(`
        UPDATE companies
        SET tariff_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [tariff_id, req.user.companyId]);

      // Создаем запись о смене тарифа
      await client.query(`
        INSERT INTO billing_transactions (
          company_id, type, amount, description, status, created_at,
          metadata
        )
        VALUES ($1, 'tariff_change', $2, $3, 'completed', NOW(), $4)
      `, [
        req.user.companyId,
        newTariff.price,
        `Смена тарифа с "${currentTariff.name}" на "${newTariff.name}"`,
        JSON.stringify({
          old_tariff_id: currentTariff.id,
          new_tariff_id: tariff_id,
          old_tariff_name: currentTariff.name,
          new_tariff_name: newTariff.name
        })
      ]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Tariff changed successfully',
        data: {
          new_tariff: newTariff
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Change tariff error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

/**
 * POST /api/billing/create-payment-intent
 * Создание платежного намерения для Stripe
 */
router.post('/create-payment-intent', authenticate, async (req, res) => {
  try {
    const { tariff_id } = req.body;

    if (!tariff_id) {
      return res.status(400).json({
        success: false,
        error: 'Tariff ID is required'
      });
    }

    // Получаем информацию о тарифе
    const tariffResult = await db.query(`
      SELECT id, name, price
      FROM tariffs
      WHERE id = $1 AND active = true
    `, [tariff_id]);

    if (tariffResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tariff not found'
      });
    }

    const tariff = tariffResult.rows[0];

    // Создаем Payment Intent через Stripe (если подключен)
    let paymentIntent = null;
    if (billingService.stripe) {
      paymentIntent = await billingService.stripe.paymentIntents.create({
        amount: Math.round(tariff.price * 100), // Stripe работает с копейками
        currency: 'rub',
        metadata: {
          company_id: req.user.companyId,
          tariff_id: tariff_id,
          tariff_name: tariff.name
        }
      });
    } else {
      // Если Stripe не настроен, возвращаем mock данные
      paymentIntent = {
        client_secret: 'mock_secret_' + Date.now(),
        id: 'mock_intent_' + Date.now()
      };
    }

    res.json({
      success: true,
      data: {
        client_secret: paymentIntent.client_secret,
        amount: tariff.price,
        tariff: tariff
      }
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/billing/webhook
 * Webhook для обработки событий от Stripe
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    let event;

    // Проверяем подпись webhook если Stripe настроен
    if (billingService.stripe && process.env.STRIPE_WEBHOOK_SECRET) {
      event = billingService.stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // Если Stripe не настроен, парсим body как обычный JSON
      event = JSON.parse(req.body.toString());
    }

    // Обрабатываем событие
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: 'Webhook signature verification failed'
    });
  }
});

/**
 * Обработка успешного платежа
 */
async function handlePaymentSuccess(paymentIntent) {
  const { company_id, tariff_id, tariff_name } = paymentIntent.metadata;

  const client = await db.pool.connect();
  await client.query('BEGIN');

  try {
    // Обновляем тариф у тенанта
    await client.query(`
      UPDATE companies
      SET tariff_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [tariff_id, company_id]);

    // Создаем запись о платеже
    await client.query(`
      INSERT INTO billing_transactions (
        company_id, type, amount, description, status, created_at,
        metadata
      )
      VALUES ($1, 'payment', $2, $3, 'completed', NOW(), $4)
    `, [
      company_id,
      paymentIntent.amount / 100,
      `Оплата тарифа "${tariff_name}"`,
      JSON.stringify({
        stripe_payment_intent_id: paymentIntent.id,
        tariff_id: tariff_id,
        tariff_name: tariff_name
      })
    ]);

    await client.query('COMMIT');
    client.release();

  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    throw error;
  }
}

/**
 * Обработка неудачного платежа
 */
async function handlePaymentFailed(paymentIntent) {
  const { company_id, tariff_name } = paymentIntent.metadata;

  // Логируем неудачный платеж
  await db.query(`
    INSERT INTO billing_transactions (
      company_id, type, amount, description, status, created_at,
      metadata
    )
    VALUES ($1, 'payment', $2, $3, 'failed', NOW(), $4)
  `, [
    company_id,
    paymentIntent.amount / 100,
    `Неудачная оплата тарифа "${tariff_name}"`,
    JSON.stringify({
      stripe_payment_intent_id: paymentIntent.id,
      error: paymentIntent.last_payment_error
    })
  ]);
}

module.exports = router;