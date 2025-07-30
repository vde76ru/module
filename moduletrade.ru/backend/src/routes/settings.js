// backend/src/routes/settings.js
const express = require('express');
const { authenticate, checkRole } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

/**
 * GET /api/settings
 * Получение настроек тенанта
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const result = await db.mainPool.query(`
      SELECT settings
      FROM tenants
      WHERE id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
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
 * Обновление настроек тенанта
 */
router.put('/', authenticate, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const updates = req.body;

    // Получаем текущие настройки
    const currentResult = await db.mainPool.query(`
      SELECT settings
      FROM tenants
      WHERE id = $1
    `, [tenantId]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    const currentSettings = currentResult.rows[0].settings || {};
    const newSettings = { ...currentSettings, ...updates };

    // Обновляем настройки
    await db.mainPool.query(`
      UPDATE tenants
      SET settings = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(newSettings), tenantId]);

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
    const tenantId = req.user.tenantId;

    const result = await db.mainPool.query(`
      SELECT
        m.id,
        m.name,
        m.type,
        CASE
          WHEN ti.id IS NOT NULL THEN true
          ELSE false
        END as is_connected,
        ti.settings,
        ti.is_active,
        ti.last_sync_at
      FROM marketplaces m
      LEFT JOIN tenant_integrations ti ON m.id = ti.marketplace_id AND ti.tenant_id = $1
      ORDER BY m.name ASC
    `, [tenantId]);

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
    const tenantId = req.user.tenantId;
    const marketplaceId = req.params.marketplaceId;
    const { settings, is_active } = req.body;

    // Проверяем существование маркетплейса
    const marketplaceResult = await db.mainPool.query(`
      SELECT id FROM marketplaces WHERE id = $1
    `, [marketplaceId]);

    if (marketplaceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Marketplace not found'
      });
    }

    // Обновляем или создаем интеграцию
    const result = await db.mainPool.query(`
      INSERT INTO tenant_integrations (tenant_id, marketplace_id, settings, is_active)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, marketplace_id)
      DO UPDATE SET
        settings = EXCLUDED.settings,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [tenantId, marketplaceId, JSON.stringify(settings), is_active]);

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
    const tenantId = req.user.tenantId;

    const result = await db.mainPool.query(`
      SELECT settings
      FROM tenants
      WHERE id = $1
    `, [tenantId]);

    const settings = result.rows[0]?.settings || {};
    const notifications = settings.notifications || {
      email: {
        newOrder: true,
        lowStock: true,
        syncErrors: true,
        dailyReport: false
      },
      push: {
        newOrder: true,
        lowStock: true,
        syncErrors: true
      }
    };

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error('Get notifications error:', error);
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
router.put('/notifications', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const notifications = req.body;

    // Получаем текущие настройки
    const currentResult = await db.mainPool.query(`
      SELECT settings
      FROM tenants
      WHERE id = $1
    `, [tenantId]);

    const currentSettings = currentResult.rows[0]?.settings || {};
    const newSettings = {
      ...currentSettings,
      notifications
    };

    // Обновляем настройки
    await db.mainPool.query(`
      UPDATE tenants
      SET settings = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(newSettings), tenantId]);

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error('Update notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;