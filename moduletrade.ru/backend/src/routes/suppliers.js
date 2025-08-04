// backend/src/routes/suppliers.js
const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
// ✅ ДОБАВЛЕН ИМПОРТ: Добавлен отсутствующий импорт db
const db = require('../config/database');
const SupplierFactory = require('../adapters/SupplierFactory');

const supplierFactory = new SupplierFactory();

// Получение списка поставщиков
router.get('/', authenticate, async (req, res) => {
  try {
    // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
    const result = await db.query(`
      SELECT 
        s.*,
        COUNT(DISTINCT ps.product_id) as connected_products
      FROM suppliers s
      LEFT JOIN product_suppliers ps ON s.id = ps.supplier_id
      GROUP BY s.id
      ORDER BY s.priority DESC, s.created_at DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
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
    
    // Если ставим основным, снимаем флаг с других
    if (is_main) {
      // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
      await db.query('UPDATE suppliers SET is_main = false');
    }
    
    // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
    const result = await db.query(`
      INSERT INTO suppliers (
        code, name, api_type, api_config, is_main, priority
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      code,
      name,
      api_type,
      JSON.stringify(api_config),
      is_main || false,
      priority || 0
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
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
    // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
    const result = await db.query(
      'SELECT * FROM suppliers WHERE id = $1',
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
      data: result.rows[0]
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
    
    // Если ставим основным, снимаем флаг с других
    if (is_main) {
      // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
      await db.query('UPDATE suppliers SET is_main = false WHERE id != $1', [req.params.id]);
    }
    
    // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
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
      JSON.stringify(api_config),
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
    
    res.json({
      success: true,
      data: result.rows[0]
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
    // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
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
    
    // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
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
    
    // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
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
      // Получаем адаптер для поставщика
      const adapter = supplierFactory.createAdapter(supplier.api_type, supplier.api_config);
      
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
    const { categories, brands, update_existing } = req.body;
    
    // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
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
      // Получаем адаптер для поставщика
      const adapter = supplierFactory.createAdapter(supplier.api_type, supplier.api_config);
      
      // Запускаем синхронизацию
      const syncResult = await adapter.syncProducts({
        categories,
        brands,
        update_existing: update_existing || false
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
    // ✅ ИСПРАВЛЕНО: Изменен вызов с db.mainPool.query на db.query
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
      // Получаем адаптер для поставщика
      const adapter = supplierFactory.createAdapter(supplier.api_type, supplier.api_config);
      
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