// backend/src/routes/products.js
const express = require('express');
const router = express.Router();
const db = require('../config/database'); // ✅ ДОБАВЛЕН ИМПОРТ DB
const PIMService = require('../services/PIMService');
const BillingService = require('../services/BillingService');
const { authenticate, checkPermission } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// ✅ ПРАВИЛЬНО СОЗДАЕМ ЭКЗЕМПЛЯРЫ КЛАССОВ
const pimService = new PIMService();
const billingService = new BillingService();

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/imports/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /xml|yml|csv|xls|xlsx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Получение списка товаров
router.get('/', authenticate, async (req, res) => {
    try {
        const filters = {
            source_type: req.query.source_type,
            brand_id: req.query.brand_id,
            category_id: req.query.category_id,
            is_active: req.query.is_active,
            search: req.query.search,
            low_stock: req.query.low_stock === 'true',
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0,
            page: parseInt(req.query.page) || 1
        };

        // ✅ ИСПРАВЛЕН ВЫЗОВ МЕТОДА СЕРВИСА
        const result = await pimService.getAllProducts(req.user.companyId, filters);

        res.json({
            success: true,
            data: result.data || result,
            pagination: result.pagination || null
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получение одного товара
router.get('/:id', authenticate, async (req, res) => {
    try {
        // ✅ ИСПРАВЛЕН ВЫЗОВ МЕТОДА для получения товара по ID
        const product = await pimService.getProductById(req.user.companyId, req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Создание товара (только внутренние)
router.post('/', authenticate, checkPermission('products.create'), async (req, res) => {
    try {
        // Проверяем лимит тарифа
        const currentProductsResult = await pimService.getAllProducts(req.user.companyId, {
            source_type: 'manual',
            limit: 1
        });

        const currentCount = currentProductsResult.pagination ? currentProductsResult.pagination.total : 0;

        const limitCheck = await billingService.checkLimit(
            req.user.companyId,
            'products',
            currentCount + 1
        );

        if (!limitCheck.allowed) {
            return res.status(403).json({
                success: false,
                error: `Product limit reached. Current: ${limitCheck.current}, Limit: ${limitCheck.limit}`
            });
        }

        // ✅ ИСПРАВЛЕН ВЫЗОВ СОЗДАНИЯ ТОВАРА
        const product = await pimService.createProduct(req.user.companyId, req.body, req.user.id);

        res.status(201).json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Обновление товара
router.put('/:id', authenticate, checkPermission('products.update'), async (req, res) => {
    try {
        const product = await pimService.updateProduct(
            req.user.companyId,
            req.params.id,
            req.body,
            req.user.id
        );

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Удаление товара (деактивация)
router.delete('/:id', authenticate, checkPermission('products.delete'), async (req, res) => {
    try {
        await pimService.updateProduct(
            req.user.companyId,
            req.params.id,
            { is_active: false },
            req.user.id
        );

        res.json({
            success: true,
            message: 'Product deactivated'
        });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Массовое обновление товаров
router.post('/bulk-update', authenticate, checkPermission('products.update'), async (req, res) => {
    try {
        const { product_ids, updates } = req.body;

        if (!Array.isArray(product_ids) || product_ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Product IDs array is required'
            });
        }

        const result = await pimService.bulkUpdateProducts(
            req.user.companyId,
            product_ids,
            updates,
            req.user.id
        );

        res.json({
            success: true,
            data: result,
            message: `Updated ${result.length} products`
        });
    } catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Массовое удаление товаров
router.post('/bulk-delete', authenticate, checkPermission('products.delete'), async (req, res) => {
    try {
        const { product_ids } = req.body;

        if (!Array.isArray(product_ids) || product_ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Product IDs array is required'
            });
        }

        const result = await pimService.bulkUpdateProducts(
            req.user.companyId,
            product_ids,
            { is_active: false },
            req.user.id
        );

        res.json({
            success: true,
            data: result,
            message: `Deactivated ${result.length} products`
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Импорт товаров
router.post('/import', authenticate, checkPermission('products.import'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'File is required'
            });
        }

        // Здесь должна быть логика импорта
        // const result = await pimService.importProducts(req.user.companyId, req.file.path, req.user.id);

        res.json({
            success: true,
            message: 'Import completed',
            data: {
                file: req.file.filename,
                // Добавьте результаты импорта
            }
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Экспорт товаров в YML
router.get('/export/yml', authenticate, async (req, res) => {
    try {
        // Получаем товары для экспорта
        const products = await pimService.getAllProducts(req.user.companyId, {
            is_active: true,
            limit: 10000 // Большой лимит для экспорта
        });

        // Генерируем YML (здесь должна быть логика генерации YML)
        const yml = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${new Date().toISOString()}">
  <shop>
    <name>ModuleTrade</name>
    <company>ModuleTrade Company</company>
    <url>https://moduletrade.ru</url>
    <currencies>
      <currency id="RUR" rate="1"/>
    </currencies>
    <categories>
      <!-- Категории -->
    </categories>
    <offers>
      <!-- Товары -->
    </offers>
  </shop>
</yml_catalog>`;

        res.set('Content-Type', 'application/xml');
        res.set('Content-Disposition', 'attachment; filename="products.yml"');
        res.send(yml);
    } catch (error) {
        console.error('Export YML error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Привязка товара к маркетплейсу
router.post('/:id/marketplace-mapping', authenticate, checkPermission('products.update'), async (req, res) => {
    try {
        const { marketplace_id, marketplace_product_id, mapping_data } = req.body;

        const pool = await db.getPool(req.user.companyId);
        const result = await pool.query(`
            INSERT INTO marketplace_product_links (
                product_id, marketplace_id, marketplace_sku,
                marketplace_product_id, company_id, is_active
            ) VALUES ($1, $2, $3, $4, $5, true)
            ON CONFLICT (product_id, marketplace_id)
            DO UPDATE SET
                marketplace_product_id = EXCLUDED.marketplace_product_id,
                marketplace_sku = EXCLUDED.marketplace_sku,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            req.params.id,
            marketplace_id,
            marketplace_product_id || req.params.id, // Используем ID товара как SKU по умолчанию
            marketplace_product_id,
            req.user.companyId
        ]);

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Marketplace mapping error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;