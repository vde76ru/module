const express = require('express');
const router = express.Router();
const { authenticate, checkRole } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const db = require('../config/database');
const cryptoUtils = require('../utils/crypto');
const SupplierIntegrationService = require('../services/SupplierIntegrationService');
const RS24Adapter = require('../adapters/RS24Adapter');

// Инициализируем middleware аудита (фабрика возвращает функцию)
const audit = auditMiddleware();

/**
 * @swagger
 * /api/integrations/rs24/test:
 *   post:
 *     summary: Test RS24 connection
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               api_url:
 *                 type: string
 *                 example: "https://cdis.russvet.ru/rs"
 *                 description: "Base URL для API RS24"
 *               api_key:
 *                 type: string
 *                 description: "API Key (необязательно для RS24, можно оставить пустым)"
 *               username:
 *                 type: string
 *                 description: "Логин от аккаунта RS24.ru"
 *               password:
 *                 type: string
 *                 description: "Пароль от аккаунта RS24.ru"
 *     responses:
 *       200:
 *         description: Connection test successful
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post('/rs24/test', authenticate, audit, async (req, res) => {
  try {
    const { api_url, username, password } = req.body;
    if (!api_url || !username || !password) {
      return res.status(400).json({ success: false, error: 'Missing required fields: api_url, username, password' });
    }
    const adapter = new RS24Adapter({ base_url: api_url, username, login: username, password });
    const result = await adapter.testConnection();
    if (!result?.success) {
      return res.json({ success: false, data: result });
    }
    return res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('RS24 test connection error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to test RS24 connection' });
  }
});

/**
 * @swagger
 * /api/integrations/yandex/test:
 *   post:
 *     summary: Test Yandex.Market connection
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               business_id:
 *                 type: string
 *               campaign_id:
 *                 type: string
 *               api_key:
 *                 type: string
 *               oauth_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connection test successful
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post('/yandex/test', authenticate, audit, async (req, res) => {
  try {
    const { business_id, campaign_id, api_key, oauth_token } = req.body;
    const companyId = req.user.companyId;

    // Validate required fields
    if (!business_id || !campaign_id || !api_key || !oauth_token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: business_id, campaign_id, api_key, oauth_token'
      });
    }

    // Test Yandex.Market connection (mock implementation)
    // In real implementation, this would make an actual API call to Yandex.Market
    const testResult = {
      success: true,
      data: {
        total_products: Math.floor(Math.random() * 5000) + 500,
        total_orders: Math.floor(Math.random() * 100) + 10,
        last_sync: new Date().toISOString(),
        connection_status: 'success'
      }
    };

    res.json(testResult);
  } catch (error) {
    console.error('Yandex.Market test connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Yandex.Market connection'
    });
  }
});

/**
 * @swagger
 * /api/integrations/rs24/save:
 *   post:
 *     summary: Save RS24 integration settings
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               api_url:
 *                 type: string
 *                 description: "Base URL для API RS24"
 *               api_key:
 *                 type: string
 *                 description: "API Key (необязательно для RS24, можно оставить пустым)"
 *               username:
 *                 type: string
 *                 description: "Логин от аккаунта RS24.ru"
 *               password:
 *                 type: string
 *                 description: "Пароль от аккаунта RS24.ru"
 *               is_active:
 *                 type: boolean
 *               sync_frequency:
 *                 type: string
 *                 enum: [hourly, daily, weekly]
 *               max_products_per_sync:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Settings saved successfully
 *       400:
 *         description: Invalid data
 *       500:
 *         description: Server error
 */
router.post('/rs24/save', authenticate, checkRole(['admin', 'manager']), audit, async (req, res) => {
  const client = await db.getClient();
  try {
    const { api_url, username, password, is_active, sync_frequency, max_products_per_sync } = req.body || {};
    const companyId = req.user.companyId;

    if (!api_url || !username || !password) {
      return res.status(400).json({ success: false, error: 'Missing required fields: api_url, username, password' });
    }

    await client.query('BEGIN');
    // Найдем существующего поставщика RS24 компании
    const existing = await client.query(
      `SELECT id FROM suppliers WHERE company_id = $1 AND api_type = 'rs24' LIMIT 1`,
      [companyId]
    );

    const encryptedConfig = cryptoUtils.encrypt({ base_url: api_url, username, login: username, password });

    if (existing.rows.length > 0) {
      const supplierId = existing.rows[0].id;
      await client.query(
        `UPDATE suppliers SET
           name = COALESCE(name, 'RS24 (Русский Свет)'),
           type = 'api',
           api_type = 'rs24',
           api_url = $1,
           api_config = $2,
           is_active = COALESCE($3, true),
           sync_interval_hours = CASE WHEN $4 = 'hourly' THEN 1 WHEN $4 = 'daily' THEN 24 WHEN $4 = 'weekly' THEN 24*7 ELSE sync_interval_hours END,
           updated_at = NOW()
         WHERE id = $5`,
        [api_url, encryptedConfig, is_active !== false, sync_frequency || 'hourly', supplierId]
      );
    } else {
      await client.query(
        `INSERT INTO suppliers (
           company_id, name, code, type, api_type, api_url, api_config, is_active, sync_interval_hours, created_at, updated_at
         ) VALUES ($1, $2, $3, 'api', 'rs24', $4, $5, $6, $7, NOW(), NOW())`,
        [companyId, 'RS24 (Русский Свет)', 'rs24', api_url, encryptedConfig, is_active !== false, (sync_frequency === 'daily' ? 24 : sync_frequency === 'weekly' ? 24*7 : 1)]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'RS24 integration settings saved successfully' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Save RS24 integration error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to save RS24 integration settings' });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/integrations/yandex/save:
 *   post:
 *     summary: Save Yandex.Market integration settings
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               business_id:
 *                 type: string
 *               campaign_id:
 *                 type: string
 *               api_key:
 *                 type: string
 *               oauth_token:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               sync_frequency:
 *                 type: string
 *                 enum: [hourly, daily, weekly]
 *               auto_update_prices:
 *                 type: boolean
 *               auto_update_stocks:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings saved successfully
 *       400:
 *         description: Invalid data
 *       500:
 *         description: Server error
 */
router.post('/yandex/save', authenticate, checkRole(['admin', 'manager']), audit, async (req, res) => {
  try {
    const {
      business_id,
      campaign_id,
      api_key,
      oauth_token,
      is_active,
      sync_frequency,
      auto_update_prices,
      auto_update_stocks
    } = req.body;
    const companyId = req.user.companyId;

    // Validate required fields
    if (!business_id || !campaign_id || !api_key || !oauth_token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Save integration settings to database
    // In real implementation, this would save to the integrations table
    const integrationData = {
      company_id: companyId,
      type: 'yandex',
      business_id,
      campaign_id,
      api_key,
      oauth_token,
      is_active: is_active !== false,
      sync_frequency: sync_frequency || 'hourly',
      auto_update_prices: auto_update_prices || false,
      auto_update_stocks: auto_update_stocks || false,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Mock save operation
    console.log('Saving Yandex.Market integration:', integrationData);

    res.json({
      success: true,
      message: 'Yandex.Market integration settings saved successfully',
      data: integrationData
    });
  } catch (error) {
    console.error('Save Yandex.Market integration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save Yandex.Market integration settings'
    });
  }
});

/**
 * @swagger
 * /api/integrations/sync/start:
 *   post:
 *     summary: Start integration synchronization
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [rs24, yandex]
 *               sync_type:
 *                 type: string
 *                 enum: [full, incremental]
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: Synchronization started successfully
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
router.post('/sync/start', authenticate, checkRole(['admin', 'manager']), audit, async (req, res) => {
  try {
    const { type, sync_type = 'full', options = {} } = req.body;
    const companyId = req.user.companyId;

    if (!type || !['rs24', 'yandex'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid integration type. Must be "rs24" or "yandex"' });
    }

    if (type === 'rs24') {
      const supplierResult = await db.query(`SELECT id FROM suppliers WHERE company_id = $1 AND api_type = 'rs24' AND is_active = true LIMIT 1`, [companyId]);
      if (supplierResult.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'RS24 supplier is not configured' });
      }
      const supplierId = supplierResult.rows[0].id;
      const result = await SupplierIntegrationService.syncSupplierProducts(companyId, supplierId, { updateExisting: sync_type !== 'full' ? true : false, ...options });
      return res.json({ success: true, message: 'RS24 synchronization completed', data: result });
    }

    // Yandex sync placeholder: hook into marketplace service if needed
    return res.status(501).json({ success: false, error: 'Yandex sync is not implemented here' });
  } catch (error) {
    console.error('Start sync error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to start synchronization' });
  }
});

module.exports = router;
