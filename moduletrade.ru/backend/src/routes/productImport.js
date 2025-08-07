const express = require('express');
const router = express.Router();
const ProductImportService = require('../services/productImportService');
const AttributeMappingService = require('../services/attributeMappingService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const logger = require('../utils/logger');

// ================================================================
// ИМПОРТ ТОВАРОВ ОТ ПОСТАВЩИКОВ
// ================================================================

/**
 * POST /api/product-import/import-by-brands
 * Импорт товаров от поставщика по брендам
 */
router.post('/import-by-brands', 
  authenticateToken,
  requireRole(['admin', 'manager']),
  validateRequest({
    supplier_id: 'required|uuid',
    brand_ids: 'required|array',
    options: 'object'
  }),
  async (req, res) => {
    try {
      const { supplier_id, brand_ids, options = {} } = req.body;
      const companyId = req.user.company_id;

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
 * GET /api/product-import/supplier-brands/:supplierId
 * Получение доступных брендов поставщика
 */
router.get('/supplier-brands/:supplierId',
  authenticateToken,
  async (req, res) => {
    try {
      const { supplierId } = req.params;
      const companyId = req.user.company_id;

      // Здесь будет логика получения брендов от поставщика
      // Пока заглушка
      const brands = [
        { id: 'brand-1', name: 'IEK' },
        { id: 'brand-2', name: 'EKF' },
        { id: 'brand-3', name: 'Feron' }
      ];

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
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res) => {
    try {
      const companyId = req.user.company_id;

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
  authenticateToken,
  requireRole(['admin', 'manager']),
  validateRequest({
    supplier_id: 'required|uuid',
    attributes: 'required|object'
  }),
  async (req, res) => {
    try {
      const { supplier_id, attributes } = req.body;
      const companyId = req.user.company_id;

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
  authenticateToken,
  async (req, res) => {
    try {
      const { supplierId } = req.params;
      const companyId = req.user.company_id;

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
  authenticateToken,
  requireRole(['admin', 'manager']),
  validateRequest({
    internal_name: 'required|string',
    conversion_rules: 'object'
  }),
  async (req, res) => {
    try {
      const { supplierId, externalKey } = req.params;
      const { internal_name, conversion_rules } = req.body;
      const companyId = req.user.company_id;

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
  authenticateToken,
  requireRole(['admin', 'manager']),
  validateRequest({
    supplier_id: 'required|uuid',
    external_categories: 'required|array'
  }),
  async (req, res) => {
    try {
      const { supplier_id, external_categories } = req.body;
      const companyId = req.user.company_id;

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

// ================================================================
// ПРАВИЛА ОБРАБОТКИ НАЗВАНИЙ
// ================================================================

/**
 * GET /api/product-import/name-rules
 * Получение правил обработки названий
 */
router.get('/name-rules',
  authenticateToken,
  async (req, res) => {
    try {
      const companyId = req.user.company_id;

      const query = `
        SELECT * FROM name_processing_rules 
        WHERE company_id = $1 AND is_active = true
        ORDER BY priority
      `;
      
      const result = await req.app.locals.db.query(query, [companyId]);

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
  authenticateToken,
  requireRole(['admin', 'manager']),
  validateRequest({
    name: 'required|string',
    type: 'required|string',
    priority: 'integer',
    enabled: 'boolean',
    settings: 'object'
  }),
  async (req, res) => {
    try {
      const { name, type, priority = 0, enabled = true, settings = {} } = req.body;
      const companyId = req.user.company_id;

      const query = `
        INSERT INTO name_processing_rules (
          company_id, name, type, priority, enabled, settings, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
      `;
      
      const result = await req.app.locals.db.query(query, [
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
  authenticateToken,
  requireRole(['admin', 'manager']),
  validateRequest({
    name: 'string',
    type: 'string',
    priority: 'integer',
    enabled: 'boolean',
    settings: 'object'
  }),
  async (req, res) => {
    try {
      const { ruleId } = req.params;
      const updates = req.body;
      const companyId = req.user.company_id;

      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');

      const query = `
        UPDATE name_processing_rules 
        SET ${setClause}, updated_at = now()
        WHERE id = $1 AND company_id = $2
        RETURNING *
      `;
      
      const result = await req.app.locals.db.query(query, [
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
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res) => {
    try {
      const { ruleId } = req.params;
      const companyId = req.user.company_id;

      const query = `
        UPDATE name_processing_rules 
        SET is_active = false, updated_at = now()
        WHERE id = $1 AND company_id = $2
      `;
      
      const result = await req.app.locals.db.query(query, [ruleId, companyId]);

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
  authenticateToken,
  async (req, res) => {
    try {
      const companyId = req.user.company_id;

      const query = `
        SELECT 
          COUNT(*) as total_imported,
          COUNT(CASE WHEN source_type = 'supplier' THEN 1 END) as supplier_products,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
          COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_products
        FROM products 
        WHERE company_id = $1
      `;
      
      const result = await req.app.locals.db.query(query, [companyId]);

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

module.exports = router; 