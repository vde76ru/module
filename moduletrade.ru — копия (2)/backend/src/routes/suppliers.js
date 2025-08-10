// backend/src/routes/suppliers.js
const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const db = require('../config/database');
const supplierFactory = require('../adapters/SupplierFactory');
const cryptoUtils = require('../utils/crypto');
const SupplierIntegrationService = require('../services/SupplierIntegrationService');
const BrandMappingService = require('../services/BrandMappingService');

// Получение списка поставщиков
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        s.*,
        COUNT(DISTINCT ps.product_id) as connected_products
      FROM suppliers s
      LEFT JOIN product_suppliers ps ON s.id = ps.supplier_id
      GROUP BY s.id
      ORDER BY s.priority DESC, s.created_at DESC
    `);

    // Дешифруем credentials перед отправкой (только для отображения, без чувствительных данных)
    const suppliers = result.rows.map(supplier => {
      const supplierCopy = { ...supplier };
      if (supplier.api_config && cryptoUtils.isEncrypted(supplier.api_config)) {
        try {
          const decrypted = cryptoUtils.decrypt(supplier.api_config);
          // Скрываем чувствительные данные, оставляем только публичную информацию
          supplierCopy.api_config = {
            ...decrypted,
            api_key: decrypted.api_key ? '***' : undefined,
            password: decrypted.password ? '***' : undefined,
            token: decrypted.token ? '***' : undefined
          };
        } catch (error) {
          console.error('Decryption error for supplier', supplier.id, error);
          supplierCopy.api_config = {};
        }
      }
      return supplierCopy;
    });

    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Добавление поставщика
router.post('/', authenticate, checkPermission('suppliers.create'), async (req, res) => {
  try {
    const { code, name, api_type, api_config, is_main, priority } = req.body;

    // Шифруем api_config перед сохранением
    let encryptedApiConfig = api_config;
    if (api_config && typeof api_config === 'object') {
      encryptedApiConfig = cryptoUtils.encrypt(api_config);
    }

    // Если ставим основным, снимаем флаг с других поставщиков той же компании
    if (is_main) {
      await db.query('UPDATE suppliers SET is_main = false WHERE company_id = $1', [req.user.companyId]);
    }

    const result = await db.query(`
      INSERT INTO suppliers (
        code, name, api_type, api_config, is_main, priority
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      code,
      name,
      api_type,
      encryptedApiConfig,
      is_main || false,
      priority || 0
    ]);

    // Дешифруем для ответа, но скрываем чувствительные данные
    const supplier = { ...result.rows[0] };
    if (supplier.api_config && cryptoUtils.isEncrypted(supplier.api_config)) {
      try {
        const decrypted = cryptoUtils.decrypt(supplier.api_config);
        supplier.api_config = {
          ...decrypted,
          api_key: decrypted.api_key ? '***' : undefined,
          password: decrypted.password ? '***' : undefined,
          token: decrypted.token ? '***' : undefined
        };
      } catch (error) {
        console.error('Decryption error:', error);
        supplier.api_config = {};
      }
    }

    res.status(201).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение информации о поставщике
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    const supplier = { ...result.rows[0] };

    // Дешифруем api_config перед отправкой, но скрываем чувствительные данные
    if (supplier.api_config && cryptoUtils.isEncrypted(supplier.api_config)) {
      try {
        const decrypted = cryptoUtils.decrypt(supplier.api_config);
        supplier.api_config = {
          ...decrypted,
          api_key: decrypted.api_key ? '***' : undefined,
          password: decrypted.password ? '***' : undefined,
          token: decrypted.token ? '***' : undefined
        };
      } catch (error) {
        console.error('Decryption error for supplier', supplier.id, error);
        supplier.api_config = {};
      }
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Обновление поставщика
router.put('/:id', authenticate, checkPermission('suppliers.update'), async (req, res) => {
  try {
    const { code, name, api_type, api_config, is_main, priority } = req.body;

    // Шифруем api_config перед сохранением
    let encryptedApiConfig = api_config;
    if (api_config && typeof api_config === 'object') {
      encryptedApiConfig = cryptoUtils.encrypt(api_config);
    }

    // Если ставим основным, снимаем флаг с других
    if (is_main) {
      await db.query('UPDATE suppliers SET is_main = false WHERE company_id = $1 AND id != $2', [req.user.companyId, req.params.id]);
    }

    const result = await db.query(`
      UPDATE suppliers SET
        code = $1,
        name = $2,
        api_type = $3,
        api_config = $4,
        is_main = $5,
        priority = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [
      code,
      name,
      api_type,
      encryptedApiConfig,
      is_main || false,
      priority || 0,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    // Дешифруем для ответа, но скрываем чувствительные данные
    const supplier = { ...result.rows[0] };
    if (supplier.api_config && cryptoUtils.isEncrypted(supplier.api_config)) {
      try {
        const decrypted = cryptoUtils.decrypt(supplier.api_config);
        supplier.api_config = {
          ...decrypted,
          api_key: decrypted.api_key ? '***' : undefined,
          password: decrypted.password ? '***' : undefined,
          token: decrypted.token ? '***' : undefined
        };
      } catch (error) {
        console.error('Decryption error:', error);
        supplier.api_config = {};
      }
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Удаление поставщика
router.delete('/:id', authenticate, checkPermission('suppliers.delete'), async (req, res) => {
  try {
    // Проверяем, есть ли связанные товары
    const productsCheck = await db.query(
      'SELECT COUNT(*) as count FROM product_suppliers WHERE supplier_id = $1',
      [req.params.id]
    );

    if (parseInt(productsCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete supplier with connected products'
      });
    }

    const result = await db.query(
      'DELETE FROM suppliers WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Поиск товаров у поставщика
router.post('/:id/search', authenticate, async (req, res) => {
  try {
    const { query, options } = req.body;

    const supplierResult = await db.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [req.params.id]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    const supplier = supplierResult.rows[0];

    try {
      // Дешифруем api_config перед использованием в адаптере
      let apiConfig = supplier.api_config;
      if (typeof apiConfig === 'string' && cryptoUtils.isEncrypted(apiConfig)) {
        apiConfig = cryptoUtils.decrypt(apiConfig);
      }

      // Получаем адаптер для поставщика
      const adapter = supplierFactory.createAdapter(supplier.api_type, apiConfig);

      // Выполняем поиск
      const searchResults = await adapter.searchProducts(query, options);

      res.json({
        success: true,
        data: searchResults
      });
    } catch (adapterError) {
      console.error('Supplier adapter error:', adapterError);
      res.status(502).json({
        success: false,
        error: 'Supplier API error: ' + adapterError.message
      });
    }
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Синхронизация товаров с поставщиком
router.post('/:id/sync', authenticate, checkPermission('suppliers.sync'), async (req, res) => {
  try {
    const { categories, brands, update_existing, warehouse_ids } = req.body;

    const supplierResult = await db.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [req.params.id]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    const supplier = supplierResult.rows[0];

    try {
      // Дешифруем api_config перед использованием в адаптере
      let apiConfig = supplier.api_config;
      if (typeof apiConfig === 'string' && cryptoUtils.isEncrypted(apiConfig)) {
        apiConfig = cryptoUtils.decrypt(apiConfig);
      }

      // Получаем адаптер для поставщика
      const adapter = supplierFactory.createAdapter(supplier.api_type, apiConfig);

      // Запускаем синхронизацию
      const syncResult = await adapter.syncProducts({
        categories,
        brands,
        updateExisting: update_existing || false,
        warehouseIds: warehouse_ids || []
      });

      res.json({
        success: true,
        data: syncResult
      });
    } catch (adapterError) {
      console.error('Supplier sync error:', adapterError);
      res.status(502).json({
        success: false,
        error: 'Supplier sync error: ' + adapterError.message
      });
    }
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Тестирование подключения к поставщику
router.post('/:id/test', authenticate, async (req, res) => {
  try {
    const supplierResult = await db.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [req.params.id]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    const supplier = supplierResult.rows[0];

    try {
      // Дешифруем api_config перед использованием в адаптере
      let apiConfig = supplier.api_config;
      if (typeof apiConfig === 'string' && cryptoUtils.isEncrypted(apiConfig)) {
        apiConfig = cryptoUtils.decrypt(apiConfig);
      }

      // Получаем адаптер для поставщика
      const adapter = supplierFactory.createAdapter(supplier.api_type, apiConfig);

      // Тестируем подключение
      const testResult = await adapter.testConnection();

      res.json({
        success: true,
        data: {
          connection_status: testResult.success ? 'connected' : 'failed',
          message: testResult.message,
          response_time: testResult.responseTime
        }
      });
    } catch (adapterError) {
      console.error('Supplier test error:', adapterError);
      res.json({
        success: false,
        data: {
          connection_status: 'failed',
          message: adapterError.message,
          response_time: null
        }
      });
    }
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

// Ограниченное обновление public_id поставщика
router.put('/:id/public-id', authenticate, checkPermission('suppliers.update'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const supplierId = req.params.id;
    const { public_id: newPublicId } = req.body || {};

    const userRole = (req.user.role || '').toLowerCase();
    if (!['владелец', 'owner', 'администратор', 'administrator', 'admin'].includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to change public_id' });
    }

    const parsed = parseInt(newPublicId, 10);
    if (!Number.isInteger(parsed) || parsed < 100000) {
      return res.status(400).json({ success: false, error: 'public_id must be an integer >= 100000' });
    }

    const existing = await db.query('SELECT id FROM suppliers WHERE id = $1 AND company_id = $2', [supplierId, companyId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const dup = await db.query('SELECT 1 FROM suppliers WHERE company_id = $1 AND public_id = $2 AND id != $3', [companyId, parsed, supplierId]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'public_id already in use' });
    }

    const result = await db.query('UPDATE suppliers SET public_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2 RETURNING *', [supplierId, companyId, parsed]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update supplier public_id error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Получение брендов поставщика (RS24 и др.)
router.get('/:id/brands', authenticate, async (req, res) => {
  try {
    const data = await SupplierIntegrationService.getSupplierBrands(req.user.companyId, req.params.id, {});
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get supplier brands error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Получение складов поставщика
router.get('/:id/warehouses', authenticate, async (req, res) => {
  try {
    const data = await SupplierIntegrationService.getSupplierWarehouses(req.user.companyId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get supplier warehouses error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Настройка интеграции поставщика (бренды/склады/расписание)
router.post('/:id/setup-integration', authenticate, checkPermission('suppliers.update'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const supplierId = req.params.id;
    const { selectedBrands = [], selectedWarehouses = [], settings = {}, syncSettings = {} } = req.body || {};

    const integrationData = {
      supplierId,
      apiType: undefined, // возьмется из существующего поставщика в сервисе
      apiConfig: undefined,
      credentials: undefined,
      settings,
      selectedBrands,
      selectedWarehouses,
      syncSettings
    };

    const result = await SupplierIntegrationService.setupIntegration(companyId, integrationData);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Setup supplier integration error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Предложения по маппингу бренда по внешнему названию
router.get('/:id/brand-mapping/suggest', authenticate, async (req, res) => {
  try {
    const supplierId = req.params.id;
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, error: 'Query param q is required' });
    const data = await BrandMappingService.suggest(req.user.companyId, supplierId, q);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Brand mapping suggest error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Подтверждение синонима (внешнего названия) для бренда
router.post('/:id/brand-mapping/confirm', authenticate, checkPermission('suppliers.update'), async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const supplierId = req.params.id;
    const { brand_id, external_brand_name, settings, sync_enabled } = req.body || {};
    if (!brand_id || !external_brand_name) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'brand_id and external_brand_name are required' });
    }
    await (require('../services/BrandMappingService')).addSynonym(
      client,
      req.user.companyId,
      supplierId,
      brand_id,
      external_brand_name,
      { settings: settings || {}, syncEnabled: sync_enabled }
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Brand mapping confirm error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  } finally {
    client.release();
  }
});