const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const MarketplaceFactory = require('../adapters/MarketplaceFactory');

const marketplaceFactory = new MarketplaceFactory();

// Получение списка маркетплейсов
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.mainPool.query(`
      SELECT 
        m.*,
        COUNT(DISTINCT pm.product_id) as connected_products
      FROM marketplaces m
      LEFT JOIN product_marketplace_mappings pm ON m.id = pm.marketplace_id
      WHERE m.tenant_id = $1
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `, [req.user.tenantId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get marketplaces error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Добавление маркетплейса
router.post('/', authenticate, checkPermission('marketplaces.create'), async (req, res) => {
  try {
    const { code, name, api_type, api_config } = req.body;
    
    // Проверяем лимит маркетплейсов
    const countResult = await db.mainPool.query(
      'SELECT COUNT(*) FROM marketplaces WHERE tenant_id = $1',
      [req.user.tenantId]
    );
    
    const limitCheck = await billingService.checkLimit(
      req.user.tenantId,
      'marketplaces',
      parseInt(countResult.rows[0].count) + 1
    );
    
    if (!limitCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: `Marketplace limit reached. Current: ${limitCheck.current}, Limit: ${limitCheck.limit}`
      });
    }
    
    // Проверяем валидность конфигурации
    try {
      const adapter = marketplaceFactory.createAdapter(api_type, api_config);
      // Можно добавить тестовый вызов API для проверки
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid API configuration'
      });
    }
    
    const result = await db.mainPool.query(`
      INSERT INTO marketplaces (
        tenant_id, code, name, api_type, api_config, commission_rules
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      req.user.tenantId,
      code,
      name,
      api_type,
      JSON.stringify(api_config),
      JSON.stringify(req.body.commission_rules || {})
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create marketplace error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Обновление маркетплейса
router.put('/:id', authenticate, checkPermission('marketplaces.update'), async (req, res) => {
  try {
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    if (req.body.name) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(req.body.name);
    }
    
    if (req.body.api_config) {
      updateFields.push(`api_config = $${paramIndex++}`);
      values.push(JSON.stringify(req.body.api_config));
    }
    
    if (req.body.commission_rules) {
      updateFields.push(`commission_rules = $${paramIndex++}`);
      values.push(JSON.stringify(req.body.commission_rules));
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    values.push(req.params.id);
    values.push(req.user.tenantId);
    
    const result = await db.mainPool.query(`
      UPDATE marketplaces 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Marketplace not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update marketplace error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Проверка подключения к маркетплейсу
router.post('/:id/test', authenticate, async (req, res) => {
  try {
    const result = await db.mainPool.query(
      'SELECT * FROM marketplaces WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Marketplace not found'
      });
    }
    
    const marketplace = result.rows[0];
    const adapter = marketplaceFactory.createAdapter(
      marketplace.api_type,
      marketplace.api_config
    );
    
    // Тестовый вызов API
    try {
      await adapter.testConnection();
      res.json({
        success: true,
        message: 'Connection successful'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Connection failed: ' + error.message
      });
    }
  } catch (error) {
    console.error('Test marketplace error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение складов маркетплейса
router.get('/:id/warehouses', authenticate, async (req, res) => {
  try {
    const result = await db.mainPool.query(`
      SELECT mw.*, s.name as supplier_name
      FROM marketplace_warehouses mw
      LEFT JOIN suppliers s ON mw.supplier_id = s.id
      WHERE mw.marketplace_id = $1
      ORDER BY mw.warehouse_name
    `, [req.params.id]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
