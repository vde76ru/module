const express = require('express');
const router = express.Router();
const ProductImportService = require('../services/productImportService');
const AttributeMappingService = require('../services/attributeMappingService');
const SmartMappingService = require('../services/SmartMappingService');
const { authenticate, checkPermission, checkRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parse: csvParse } = require('csv-parse');
const ExcelJS = require('exceljs');

// ================================================================
// ИМПОРТ ТОВАРОВ ОТ ПОСТАВЩИКОВ
// ================================================================

/**
 * POST /api/product-import/import-by-brands
 * Импорт товаров от поставщика по брендам
 */
router.post('/import-by-brands',
  authenticate,
  checkPermission('products.import'),
  async (req, res) => {
    try {
      const { supplier_id, brand_ids, options = {} } = req.body;
      const companyId = req.user.companyId;

      const result = await ProductImportService.importProductsByBrands(
        companyId,
        supplier_id,
        brand_ids,
        options
      );

      res.json({
        success: true,
        data: result,
        message: `Успешно импортировано ${result.imported} товаров`
      });

    } catch (error) {
      logger.error('Product import failed:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/product-import/mapping/suggest/attribute?supplier_id=...&external_key=...&limit=5
 * Предложения по атрибуту (интеллектуальный маппинг)
 */
router.get('/mapping/suggest/attribute', authenticate, async (req, res) => {
  try {
    const { external_key, limit = 5 } = req.query;
    const companyId = req.user.companyId;
    if (!external_key) {
      return res.status(400).json({ success: false, error: 'external_key is required' });
    }
    const suggestions = await SmartMappingService.suggestAttribute(companyId, external_key, parseInt(limit, 10));
    res.json({ success: true, data: suggestions });
  } catch (error) {
    logger.error('Suggest attribute mapping failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/product-import/mapping/suggest/category?supplier_id=...&external_name=...&limit=5
 * Предложения по категории (интеллектуальный маппинг)
 */
router.get('/mapping/suggest/category', authenticate, async (req, res) => {
  try {
    const { external_name, limit = 5 } = req.query;
    const companyId = req.user.companyId;
    if (!external_name) {
      return res.status(400).json({ success: false, error: 'external_name is required' });
    }
    const suggestions = await SmartMappingService.suggestCategory(companyId, external_name, parseInt(limit, 10));
    res.json({ success: true, data: suggestions });
  } catch (error) {
    logger.error('Suggest category mapping failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/product-import/supplier-categories/:supplierId
 * Получение дерева/списка внешних категорий поставщика
 */
router.get('/supplier-categories/:supplierId',
  authenticate,
  async (req, res) => {
    try {
      const { supplierId } = req.params;
      const companyId = req.user.companyId;

      const result = await db.query(`
        SELECT id, supplier_id, external_id, name, parent_id, level
        FROM external_categories
        WHERE supplier_id = $1
        ORDER BY COALESCE(parent_id, 0), name
      `, [supplierId]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Failed to get supplier categories:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/product-import/supplier-brands/:supplierId
 * Получение доступных брендов поставщика
 */
router.get('/supplier-brands/:supplierId',
  authenticate,
  async (req, res) => {
    try {
      const { supplierId } = req.params;
      const companyId = req.user.companyId;

      // Получаем бренды от поставщика через адаптер
      const supplierResult = await db.query(
        'SELECT id, api_type, api_config FROM suppliers WHERE id = $1',
        [supplierId]
      );

      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Supplier not found' });
      }

      const supplier = supplierResult.rows[0];
      let apiConfig = supplier.api_config;
      try {
        if (typeof apiConfig === 'string') {
          const cryptoUtils = require('../utils/crypto');
          if (cryptoUtils.isEncrypted(apiConfig)) {
            apiConfig = cryptoUtils.decrypt(apiConfig);
          } else {
            apiConfig = JSON.parse(apiConfig);
          }
        }
      } catch (_) {}

      const supplierFactory = require('../adapters/SupplierFactory');
      const adapter = supplierFactory.createAdapter(supplier.api_type, apiConfig);
      if (typeof adapter.getBrands !== 'function') {
        return res.json({ success: true, data: [] });
      }
      const brands = await adapter.getBrands();

      res.json({
        success: true,
        data: brands
      });

    } catch (error) {
      logger.error('Failed to get supplier brands:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/product-import/match-products
 * Сопоставление товаров по бренду + артикул
 */
router.post('/match-products',
  authenticate,
  checkPermission('products.manage'),
  async (req, res) => {
    try {
      const companyId = req.user.companyId;

      const matches = await ProductImportService.matchProductsByBrandAndSku(companyId);

      res.json({
        success: true,
        data: matches,
        message: `Найдено ${matches.length} групп совпадающих товаров`
      });

    } catch (error) {
      logger.error('Product matching failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ================================================================
// МАППИНГ АТРИБУТОВ И КАТЕГОРИЙ
// ================================================================

/**
 * POST /api/product-import/auto-map-attributes
 * Автоматический маппинг атрибутов
 */
router.post('/auto-map-attributes',
  authenticate,
  checkPermission('products.manage'),
  async (req, res) => {
    try {
      const { supplier_id, attributes } = req.body;
      const companyId = req.user.companyId;

      const mappedAttributes = await AttributeMappingService.autoMapAttributes(
        companyId,
        supplier_id,
        attributes
      );

      res.json({
        success: true,
        data: mappedAttributes,
        message: 'Атрибуты успешно сопоставлены'
      });

    } catch (error) {
      logger.error('Attribute mapping failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/product-import/supplier-mappings/:supplierId
 * Получение маппингов поставщика
 */
router.get('/supplier-mappings/:supplierId',
  authenticate,
  async (req, res) => {
    try {
      const { supplierId } = req.params;
      const companyId = req.user.companyId;

      const mappings = await AttributeMappingService.getSupplierMappings(companyId, supplierId);

      res.json({
        success: true,
        data: mappings
      });

    } catch (error) {
      logger.error('Failed to get supplier mappings:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/product-import/attribute-mapping/:supplierId/:externalKey
 * Обновление маппинга атрибута
 */
router.put('/attribute-mapping/:supplierId/:externalKey',
  authenticate,
  checkPermission('products.manage'),
  async (req, res) => {
    try {
      const { supplierId, externalKey } = req.params;
      const { internal_name, conversion_rules } = req.body;
      const companyId = req.user.companyId;

      await AttributeMappingService.updateAttributeMapping(
        companyId,
        supplierId,
        externalKey,
        { internal_name, conversion_rules }
      );

      res.json({
        success: true,
        message: 'Маппинг атрибута обновлен'
      });

    } catch (error) {
      logger.error('Failed to update attribute mapping:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/product-import/map-categories
 * Маппинг категорий
 */
router.post('/map-categories',
  authenticate,
  checkPermission('products.manage'),
  async (req, res) => {
    try {
      const { supplier_id, external_categories } = req.body;
      const companyId = req.user.companyId;

      const mappedCategories = await AttributeMappingService.mapCategories(
        companyId,
        supplier_id,
        external_categories
      );

      res.json({
        success: true,
        data: mappedCategories,
        message: 'Категории успешно сопоставлены'
      });

    } catch (error) {
      logger.error('Category mapping failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/product-import/mapping/categories?supplier_id=...
 * Получение маппингов категорий для поставщика
 */
router.get('/mapping/categories',
  authenticate,
  async (req, res) => {
    try {
      const { supplier_id } = req.query;
      if (!supplier_id) {
        return res.status(400).json({ success: false, error: 'supplier_id is required' });
      }

      const companyId = req.user.companyId;
      const result = await db.query(`
        SELECT external_category_id, internal_category_id
        FROM category_mappings
        WHERE company_id = $1 AND supplier_id = $2 AND is_active = true
      `, [companyId, supplier_id]);

      const data = result.rows.map(r => ({
        supplier_category_id: r.external_category_id,
        system_category_id: r.internal_category_id
      }));

      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to get category mappings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/product-import/mapping/categories
 * Создание/обновление маппинга категории поставщика к системной категории
 */
router.post('/mapping/categories',
  authenticate,
  checkPermission('products.manage'),
  async (req, res) => {
    try {
      const { supplier_id, external_category_id, internal_category_id } = req.body || {};
      if (!supplier_id || !external_category_id || !internal_category_id) {
        return res.status(400).json({ success: false, error: 'supplier_id, external_category_id and internal_category_id are required' });
      }

      const companyId = req.user.companyId;
      await AttributeMappingService.updateCategoryMapping(companyId, supplier_id, external_category_id, internal_category_id);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to upsert category mapping:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/product-import/mapping/categories/:externalCategoryId?supplier_id=...
 * Удаление маппинга категории
 */
router.delete('/mapping/categories/:externalCategoryId',
  authenticate,
  checkPermission('products.manage'),
  async (req, res) => {
    try {
      const { externalCategoryId } = req.params;
      const { supplier_id } = req.query;
      if (!supplier_id) {
        return res.status(400).json({ success: false, error: 'supplier_id is required' });
      }

      const companyId = req.user.companyId;
      await db.query(`
        DELETE FROM category_mappings
        WHERE company_id = $1 AND supplier_id = $2 AND external_category_id = $3
      `, [companyId, supplier_id, externalCategoryId]);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete category mapping:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ================================================================
// ПРАВИЛА ОБРАБОТКИ НАЗВАНИЙ
// ================================================================

/**
 * GET /api/product-import/name-rules
 * Получение правил обработки названий
 */
router.get('/name-rules',
  authenticate,
  async (req, res) => {
    try {
      const companyId = req.user.companyId;

      const query = `
        SELECT * FROM name_processing_rules
        WHERE company_id = $1 AND is_active = true
        ORDER BY priority
      `;

      const result = await db.query(query, [companyId]);

      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      logger.error('Failed to get name rules:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/product-import/name-rules
 * Создание правила обработки названий
 */
router.post('/name-rules',
  authenticate,
  checkPermission('products.manage'),
  async (req, res) => {
    try {
      const { name, type, priority = 0, enabled = true, settings = {} } = req.body;
      const companyId = req.user.companyId;

      const query = `
        INSERT INTO name_processing_rules (
          company_id, name, type, priority, enabled, settings, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
      `;

      const result = await db.query(query, [
        companyId, name, type, priority, enabled, settings
      ]);

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Правило обработки названий создано'
      });

    } catch (error) {
      logger.error('Failed to create name rule:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/product-import/name-rules/:ruleId
 * Обновление правила обработки названий
 */
router.put('/name-rules/:ruleId',
  authenticate,
  checkPermission('products.manage'),
  async (req, res) => {
    try {
      const { ruleId } = req.params;
      const updates = req.body;
      const companyId = req.user.companyId;

      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');

      const query = `
        UPDATE name_processing_rules
        SET ${setClause}, updated_at = now()
        WHERE id = $1 AND company_id = $2
        RETURNING *
      `;

      const result = await db.query(query, [
        ruleId, companyId, ...Object.values(updates)
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Правило не найдено'
        });
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Правило обработки названий обновлено'
      });

    } catch (error) {
      logger.error('Failed to update name rule:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/product-import/name-rules/:ruleId
 * Удаление правила обработки названий
 */
router.delete('/name-rules/:ruleId',
  authenticate,
  checkPermission('products.manage'),
  async (req, res) => {
    try {
      const { ruleId } = req.params;
      const companyId = req.user.companyId;

      const query = `
        UPDATE name_processing_rules
        SET is_active = false, updated_at = now()
        WHERE id = $1 AND company_id = $2
      `;

      const result = await db.query(query, [ruleId, companyId]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Правило не найдено'
        });
      }

      res.json({
        success: true,
        message: 'Правило обработки названий удалено'
      });

    } catch (error) {
      logger.error('Failed to delete name rule:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ================================================================
// СТАТИСТИКА ИМПОРТА
// ================================================================

/**
 * GET /api/product-import/stats
 * Получение статистики импорта
 */
router.get('/stats',
  authenticate,
  async (req, res) => {
    try {
      const companyId = req.user.companyId;

      const query = `
        SELECT
          COUNT(*) as total_imported,
          COUNT(CASE WHEN source_type = 'supplier' THEN 1 END) as supplier_products,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
          COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_products
        FROM products
        WHERE company_id = $1
      `;

      const result = await db.query(query, [companyId]);

      res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      logger.error('Failed to get import stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/product-import/status/:sessionId
 * Получение статуса импорта
 */
router.get('/status/:sessionId',
  authenticate,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const companyId = req.user.companyId;

      const status = await ProductImportService.getImportStatus(sessionId);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Failed to get import status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/product-import/logs/:sessionId
 * Получение логов импорта
 */
router.get('/logs/:sessionId',
  authenticate,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { limit = 100 } = req.query;

      const logs = await ProductImportService.getImportLogs(sessionId, parseInt(limit));

      res.json({
        success: true,
        data: logs
      });

    } catch (error) {
      logger.error('Failed to get import logs:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/product-import/statistics
 * Получение статистики импорта
 */
router.get('/statistics',
  authenticate,
  async (req, res) => {
    try {
      const companyId = req.user.companyId;
      const { days = 30 } = req.query;

      const statistics = await ProductImportService.getImportStatistics(companyId, parseInt(days));

      res.json({
        success: true,
        data: statistics
      });

    } catch (error) {
      logger.error('Failed to get import statistics:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/product-import/cancel/:sessionId
 * Отмена активного импорта
 */
router.post('/cancel/:sessionId',
  authenticate,
  checkPermission('products.manage'),
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      const result = await ProductImportService.cancelImport(sessionId);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Failed to cancel import:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/product-import/active
 * Получение активных импортов
 */
router.get('/active',
  authenticate,
  async (req, res) => {
    try {
      const activeImports = ProductImportService.getActiveImports();

      res.json({
        success: true,
        data: activeImports
      });

    } catch (error) {
      logger.error('Failed to get active imports:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/product-import/brand-mappings
 * Получение маппингов брендов к поставщикам
 */
router.get('/brand-mappings',
  authenticate,
  async (req, res) => {
    try {
      const companyId = req.user.companyId;
      const { supplier_id, brand_id } = req.query;

      let whereConditions = ['company_id = $1'];
      let params = [companyId];
      let paramIndex = 2;

      if (supplier_id) {
        whereConditions.push(`supplier_id = $${paramIndex}`);
        params.push(supplier_id);
        paramIndex++;
      }

      if (brand_id) {
        whereConditions.push(`brand_id = $${paramIndex}`);
        params.push(brand_id);
        paramIndex++;
      }

      const query = `
        SELECT bsm.*,
               s.name as supplier_name,
               b.name as brand_name
        FROM brand_supplier_mappings bsm
        JOIN suppliers s ON bsm.supplier_id = s.id
        JOIN brands b ON bsm.brand_id = b.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY bsm.created_at DESC
      `;

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      logger.error('Failed to get brand mappings:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/product-import/brand-mappings
 * Создание/обновление маппинга бренда поставщика к нашему бренду
 * body: { supplier_id, brand_id, supplier_brand_name }
 */
router.post('/brand-mappings',
  authenticate,
  checkRole(['Владелец','Администратор','Менеджер']),
  async (req, res) => {
    try {
      const { supplier_id, brand_id, supplier_brand_name } = req.body || {};
      const companyId = req.user.companyId;
      if (!supplier_id || !brand_id || !supplier_brand_name) {
        return res.status(400).json({ success: false, error: 'supplier_id, brand_id, supplier_brand_name are required' });
      }

      await db.query(`
        INSERT INTO brand_supplier_mappings (company_id, brand_id, supplier_id, supplier_brand_name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, true, NOW(), NOW())
        ON CONFLICT (company_id, brand_id, supplier_id)
        DO UPDATE SET supplier_brand_name = EXCLUDED.supplier_brand_name, is_active = true, updated_at = NOW()
      `, [companyId, brand_id, supplier_id, supplier_brand_name]);

      res.json({ success: true });
    } catch (error) {
      logger.error('Upsert brand mapping failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/product-import/brand-mappings/:brandId/:supplierId
 * Удаление маппинга бренда к поставщику
 */
router.delete('/brand-mappings/:brandId/:supplierId',
  authenticate,
  checkRole(['Владелец','Администратор','Менеджер']),
  async (req, res) => {
    try {
      const { brandId, supplierId } = req.params;
      const companyId = req.user.companyId;

      const query = `
        DELETE FROM brand_supplier_mappings
        WHERE company_id = $1 AND brand_id = $2 AND supplier_id = $3
      `;

      await db.query(query, [companyId, brandId, supplierId]);

      res.json({
        success: true,
        message: 'Маппинг бренда к поставщику удален'
      });

    } catch (error) {
      logger.error('Failed to delete brand mapping:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/product-import/product-links
 * Получение связей товаров с поставщиками
 */
router.get('/product-links',
  authenticate,
  async (req, res) => {
    try {
      const companyId = req.user.companyId;
      const { product_id, supplier_id } = req.query;

      let whereConditions = ['company_id = $1'];
      let params = [companyId];
      let paramIndex = 2;

      if (product_id) {
        whereConditions.push(`product_id = $${paramIndex}`);
        params.push(product_id);
        paramIndex++;
      }

      if (supplier_id) {
        whereConditions.push(`supplier_id = $${paramIndex}`);
        params.push(supplier_id);
        paramIndex++;
      }

      const query = `
        SELECT psl.*,
               s.name as supplier_name,
               p.name as product_name,
               p.sku as product_sku
        FROM product_supplier_links psl
        JOIN suppliers s ON psl.supplier_id = s.id
        JOIN products p ON psl.product_id = p.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY psl.created_at DESC
      `;

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      logger.error('Failed to get product links:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/product-import/sync-prices
 * Синхронизация цен от поставщиков
 */
router.post('/sync-prices',
  authenticate,
  checkRole(['Владелец','Администратор','Менеджер']),
  async (req, res) => {
    try {
      const { supplier_id, product_ids } = req.body;
      const companyId = req.user.companyId;

      const result = await ProductImportService.syncPricesFromSupplier(
        companyId,
        supplier_id,
        product_ids
      );

      res.json({
        success: true,
        data: result,
        message: `Синхронизировано цен для ${result.synced} товаров`
      });

    } catch (error) {
      logger.error('Price sync failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/product-import/sync-stocks
 * Синхронизация остатков от поставщиков
 */
router.post('/sync-stocks',
  authenticate,
  checkRole(['Владелец','Администратор','Менеджер']),
  async (req, res) => {
    try {
      const { supplier_id, product_ids } = req.body;
      const companyId = req.user.companyId;

      const result = await ProductImportService.syncStocksFromSupplier(
        companyId,
        supplier_id,
        product_ids
      );

      res.json({
        success: true,
        data: result,
        message: `Синхронизировано остатков для ${result.synced} товаров`
      });

    } catch (error) {
      logger.error('Stock sync failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

module.exports = router;

// ===============================
// Загрузка файлов импорта товаров
// POST /api/product-import
// Поддерживаем: csv, xls, xlsx
// Поля формы: file, supplier_id?, mapping? (JSON), updateExisting?, createCategories?, validatePrices?, skipErrors?
// Возвращает: { success, processed, created, updated, errors, errorDetails? }
// ===============================

// Гарантируем наличие каталога загрузок
const uploadsDir = path.join(process.cwd(), 'uploads', 'imports');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /csv|xls|xlsx/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) return cb(null, true);
    return cb(new Error('Invalid file type'));
  },
});

router.post('/', authenticate, checkPermission('products.import'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'File is required' });
    }

    const companyId = req.user.companyId;
    const supplierId = req.body.supplier_id || null;
    let mapping = {};
    try {
      mapping = req.body.mapping ? JSON.parse(req.body.mapping) : {};
    } catch (_) {
      mapping = {};
    }

    const options = {
      updateExisting: req.body.updateExisting === 'true' || req.body.updateExisting === true,
      createCategories: req.body.createCategories !== 'false',
      validatePrices: req.body.validatePrices !== 'false',
      skipErrors: req.body.skipErrors === 'true' || req.body.skipErrors === true,
      mapping,
      supplier_id: supplierId,
    };

    const ext = path.extname(req.file.originalname).toLowerCase();

    // Простейший парсинг файла в массив объектов
    async function parseFile(filePath, extension) {
      if (extension === '.csv') {
        return new Promise((resolve, reject) => {
          const rows = [];
          fs.createReadStream(filePath)
            .pipe(csvParse({ columns: true, skip_empty_lines: true, trim: true }))
            .on('data', (r) => rows.push(r))
            .on('end', () => resolve(rows))
            .on('error', reject);
        });
      }
      if (extension === '.xlsx' || extension === '.xls') {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath).catch(async (e) => {
          if (extension === '.xls') {
            // Пытаемся прочесть старый формат как xlsx (часто помогает если по факту современный файл)
            return workbook.xlsx.readFile(filePath);
          }
          throw e;
        });
        const sheet = workbook.worksheets[0];
        if (!sheet) return [];
        const headers = [];
        sheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber - 1] = String(cell.value || '').trim();
        });
        const data = [];
        for (let i = 2; i <= sheet.rowCount; i++) {
          const row = sheet.getRow(i);
          const obj = {};
          headers.forEach((h, idx) => {
            obj[h] = row.getCell(idx + 1).value ?? '';
          });
          const isEmpty = Object.values(obj).every((v) => v === '' || v === null || v === undefined);
          if (!isEmpty) data.push(obj);
        }
        return data;
      }
      return [];
    }

    const rows = await parseFile(req.file.path, ext);
    let processed = 0;
    let created = 0;
    let updated = 0;
    const errors = [];

    // Маппинг полей из файла к внутренним на основе переданного mapping
    function mapRow(raw) {
      const name = raw[mapping.name] || raw.name || raw['Название'] || raw['title'] || null;
      const sku = raw[mapping.sku] || raw.sku || raw['SKU'] || raw['Артикул'] || null;
      const priceStr = raw[mapping.price] || raw.price || raw['Цена'] || null;
      const price = priceStr != null && priceStr !== '' ? parseFloat(String(priceStr).toString().replace(',', '.')) : null;
      const quantityStr = raw[mapping.quantity] || raw.quantity || raw['Количество'] || null;
      const quantity = quantityStr != null && quantityStr !== '' ? parseFloat(String(quantityStr).toString().replace(',', '.')) : 0;
      const categoryPath = raw[mapping.category_path] || raw.category_path || raw['Категория'] || null;
      const description = raw[mapping.description] || raw.description || raw['Описание'] || null;
      const brand = raw[mapping.brand] || raw.brand || raw['Бренд'] || null;
      const barcode = raw[mapping.barcode] || raw.barcode || raw['Штрихкод'] || null;
      return { name, sku, price, quantity, categoryPath, description, brand, barcode, raw };
    }

    // Определяем главный склад компании для записи остатков (если есть)
    let mainWarehouseId = null;
    try {
      const mw = await db.query(
        'SELECT id FROM warehouses WHERE company_id = $1 AND is_main = TRUE LIMIT 1',
        [companyId]
      );
      mainWarehouseId = mw.rows[0]?.id || null;
    } catch (_) {}

    // Транзакционно создаем/обновляем товары
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      for (const raw of rows) {
        processed++;
        const r = mapRow(raw);
        try {
          if (!r.name || !r.sku) throw new Error('Missing required fields: name/sku');

          // Находим бренд
          let brandId = null;
          if (r.brand) {
            const bres = await client.query('SELECT id FROM brands WHERE name = $1 LIMIT 1', [r.brand]);
            if (bres.rows.length > 0) brandId = bres.rows[0].id;
          }

          // Пытаемся найти существующий товар по SKU
          const existing = await client.query(
            'SELECT id FROM products WHERE company_id = $1 AND sku = $2 LIMIT 1',
            [companyId, r.sku]
          );

          if (existing.rows.length === 0) {
            // Создаем
            const ins = await client.query(
              `INSERT INTO products (company_id, name, sku, barcode, brand_id, description, source_type, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'import', TRUE, NOW(), NOW())
               RETURNING id`,
              [companyId, r.name, r.sku, r.barcode || null, brandId, r.description || null]
            );
            const productId = ins.rows[0].id;
            // Количество/цена: пишем в главный склад, если он существует
            if (mainWarehouseId && (r.quantity != null || r.price != null)) {
              await client.query(
                `INSERT INTO warehouse_product_links (warehouse_id, product_id, quantity, available_quantity, price, currency, is_active, created_at, updated_at)
                 VALUES ($1, $2, $3, $3, $4, 'RUB', TRUE, NOW(), NOW())
                 ON CONFLICT (warehouse_id, product_id)
                 DO UPDATE SET quantity = EXCLUDED.quantity, available_quantity = EXCLUDED.available_quantity, price = EXCLUDED.price, updated_at = NOW()`,
                [mainWarehouseId, productId, r.quantity || 0, r.price || 0]
              );
            }
            created++;
          } else {
            const productId = existing.rows[0].id;
            if (options.updateExisting) {
              await client.query(
                `UPDATE products SET name = COALESCE($3, name), description = COALESCE($4, description), brand_id = COALESCE($5, brand_id), updated_at = NOW()
                 WHERE company_id = $1 AND id = $2`,
                [companyId, productId, r.name, r.description || null, brandId]
              );
              if (mainWarehouseId && (r.quantity != null || r.price != null)) {
                await client.query(
                  `INSERT INTO warehouse_product_links (warehouse_id, product_id, quantity, available_quantity, price, currency, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $3, $4, 'RUB', TRUE, NOW(), NOW())
                   ON CONFLICT (warehouse_id, product_id)
                   DO UPDATE SET quantity = EXCLUDED.quantity, available_quantity = EXCLUDED.available_quantity, price = EXCLUDED.price, updated_at = NOW()`,
                  [mainWarehouseId, productId, r.quantity || 0, r.price || 0]
                );
              }
              updated++;
            }
          }
        } catch (e) {
          errors.push({ row: processed, error: e.message });
          if (!options.skipErrors) throw e;
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true, processed, created, updated, errors: errors.length, errorDetails: errors });
  } catch (error) {
    logger.error('File import failed:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch (_) {}
  }
});

// Совместимость: список маппингов атрибутов для UI
// GET /api/product-import/mapping/attributes?supplier_id=
router.get('/mapping/attributes', authenticate, async (req, res) => {
  try {
    const { supplier_id } = req.query;
    const companyId = req.user.companyId;
    if (!supplier_id) {
      return res.status(400).json({ success: false, error: 'supplier_id is required' });
    }
    const result = await db.query(
      `SELECT id, external_key, internal_name, conversion_rules, is_auto_mapped, updated_at
       FROM attribute_mappings
       WHERE company_id = $1 AND supplier_id = $2 AND is_active = TRUE
       ORDER BY external_key ASC`,
      [companyId, supplier_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to get attribute mappings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});