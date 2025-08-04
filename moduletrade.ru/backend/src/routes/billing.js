// backend/src/routes/billing.js
const express = require('express');
const { authenticate, checkPermission } = require('../middleware/auth');
const db = require('../config/database');
const BillingService = require('../services/BillingService');

const router = express.Router();
const billingService = new BillingService();

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

    // Получаем количество заказов
    const ordersResult = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue
      FROM orders
      WHERE company_id = $1
        AND created_at >= ${dateFilter}
    `, [req.user.companyId]);

    // Получаем лимиты тарифа
    const tariffResult = await db.query(`
      SELECT t.limits
      FROM companies ten
      JOIN tariffs t ON ten.tariff_id = t.id
      WHERE ten.id = $1
    `, [req.user.companyId]);

    const limits = tariffResult.rows[0]?.limits || {};
    const apiUsage = apiUsageResult.rows[0];
    const productsCount = parseInt(productsResult.rows[0].total_products);
    const ordersData = ordersResult.rows[0];

    res.json({
      success: true,
      data: {
        period,
        api_requests: {
          used: parseInt(apiUsage.total_requests),
          limit: limits.api_requests_per_month || 1000,
          successful: parseInt(apiUsage.successful_requests),
          rate_limited: parseInt(apiUsage.rate_limited_requests)
        },
        products: {
          used: productsCount,
          limit: limits.max_products || 100
        },
        orders: {
          count: parseInt(ordersData.total_orders || 0),
          revenue: parseFloat(ordersData.total_revenue || 0)
        },
        storage: {
          used: 0, // TODO: Реализовать подсчет размера хранилища
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
    const client = await db.getClient(); await client.query('BEGIN');

    try {
      // Обновляем тариф у тенанта
      await db.query(`
        UPDATE companies
        SET tariff_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [tariff_id, req.user.companyId]);

      // Создаем запись о смене тарифа
      await db.query(`
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

      await client.query('COMMIT'); client.release();

      res.json({
        success: true,
        message: 'Tariff changed successfully',
        data: {
          new_tariff: newTariff
        }
      });

    } catch (error) {
      await client.query('ROLLBACK'); client.release();
      throw error;
    }

  } catch (error) {
    console.error('Change tariff error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
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

    // Создаем Payment Intent через Stripe
    const paymentIntent = await billingService.createPaymentIntent({
      amount: Math.round(tariff.price * 100), // Stripe работает с копейками
      currency: 'rub',
      metadata: {
        company_id: req.user.companyId,
        tariff_id: tariff_id,
        tariff_name: tariff.name
      }
    });

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

    // Проверяем подпись webhook
    const event = billingService.verifyWebhookSignature(req.body, signature);

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

  const client = await db.getClient(); await client.query('BEGIN');

  try {
    // Обновляем тариф у тенанта
    await db.query(`
      UPDATE companies
      SET tariff_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [tariff_id, company_id]);

    // Создаем запись о платеже
    await db.query(`
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

    await client.query('COMMIT'); client.release();

  } catch (error) {
    await client.query('ROLLBACK'); client.release();
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