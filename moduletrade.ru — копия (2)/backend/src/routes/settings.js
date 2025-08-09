// backend/src/routes/settings.js
const express = require('express');
const { authenticate, checkRole } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

/**
 * GET /api/settings
 * Получение настроек компании
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const result = await db.query(`
      SELECT settings
      FROM companies
      WHERE id = $1
    `, [companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const settings = result.rows[0].settings || {};

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/settings
 * Обновление настроек компании
 */
router.put('/', authenticate, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const updates = req.body;

    // Получаем текущие настройки
    const currentResult = await db.query(`
      SELECT settings
      FROM companies
      WHERE id = $1
    `, [companyId]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const currentSettings = currentResult.rows[0].settings || {};
    const newSettings = { ...currentSettings, ...updates };

    // Обновляем настройки
    await db.query(`
      UPDATE companies
      SET settings = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(newSettings), companyId]);

    res.json({
      success: true,
      data: newSettings
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/settings/integrations
 * Получение настроек интеграций
 */
router.get('/integrations', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    // ✅ ИСПРАВЛЕНО: используем marketplace_integration_settings
    const result = await db.query(`
      SELECT
        m.id,
        m.name,
        m.type,
        CASE
          WHEN mis.id IS NOT NULL THEN true
          ELSE false
        END as is_connected,
        mis.api_credentials as settings,
        mis.is_active,
        mis.last_sync_at
      FROM marketplaces m
      LEFT JOIN marketplace_integration_settings mis ON m.id = mis.marketplace_id AND mis.company_id = $1
      ORDER BY m.name ASC
    `, [companyId]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/settings/integrations/:marketplaceId
 * Обновление настроек интеграции
 */
router.put('/integrations/:marketplaceId', authenticate, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const marketplaceId = req.params.marketplaceId;
    const { settings, is_active } = req.body;

    // Проверяем существование маркетплейса
    const marketplaceResult = await db.query(`
      SELECT id FROM marketplaces WHERE id = $1
    `, [marketplaceId]);

    if (marketplaceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Marketplace not found'
      });
    }

    // ✅ ИСПРАВЛЕНО: используем marketplace_integration_settings
    const result = await db.query(`
      INSERT INTO marketplace_integration_settings (company_id, marketplace_id, api_credentials, is_active)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (company_id, marketplace_id)
      DO UPDATE SET
        api_credentials = EXCLUDED.api_credentials,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [companyId, marketplaceId, JSON.stringify(settings), is_active]);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update integration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/settings/notifications
 * Получение настроек уведомлений
 */
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const result = await db.query(`
      SELECT settings
      FROM companies
      WHERE id = $1
    `, [companyId]);

    const settings = result.rows[0]?.settings || {};
    const notificationSettings = settings.notifications || {
      email: {
        order_created: true,
        order_status_changed: true,
        stock_low: true,
        sync_completed: true,
        sync_failed: true
      },
      sms: {
        order_created: false,
        order_status_changed: false
      },
      push: {
        order_created: true,
        order_status_changed: true,
        stock_low: true
      }
    };

    res.json({
      success: true,
      data: notificationSettings
    });

  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/settings/notifications
 * Обновление настроек уведомлений
 */
router.put('/notifications', authenticate, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const notificationSettings = req.body;

    // Получаем текущие настройки
    const currentResult = await db.query(`
      SELECT settings
      FROM companies
      WHERE id = $1
    `, [companyId]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const currentSettings = currentResult.rows[0].settings || {};
    currentSettings.notifications = notificationSettings;

    // Обновляем настройки
    await db.query(`
      UPDATE companies
      SET settings = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(currentSettings), companyId]);

    res.json({
      success: true,
      data: notificationSettings
    });

  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/settings/api-keys
 * Получение API ключей
 */
router.get('/api-keys', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const companyId = req.user.companyId;

    // В будущем здесь будет логика работы с API ключами
    // Пока возвращаем заглушку
    res.json({
      success: true,
      data: {
        keys: [],
        webhooks: []
      }
    });

  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;