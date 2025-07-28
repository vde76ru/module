const express = require('express');
const router = express.Router();
const PIMService = require('../services/PIMService');
const BillingService = require('../services/BillingService');
const { authenticate, checkPermission } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

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
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const products = await pimService.getProducts(req.user.tenantId, filters);

        res.json({
            success: true,
            data: products
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
        const products = await pimService.getProducts(req.user.tenantId, {
            id: req.params.id,
            limit: 1
        });

        if (products.items.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: products.items[0]
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
        const currentProducts = await pimService.getProducts(req.user.tenantId, {
            source_type: 'internal'
        });

        const limitCheck = await billingService.checkLimit(
            req.user.tenantId,
            'products',
            currentProducts.total + 1
        );

        if (!limitCheck.allowed) {
            return res.status(403).json({
                success: false,
                error: `Product limit reached. Current: ${limitCheck.current}, Limit: ${limitCheck.limit}`
            });
        }

        const product = await pimService.createProduct(req.user.tenantId, req.body);

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
            req.user.tenantId,
            req.params.id,
            req.body
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
            req.user.tenantId,
            req.params.id,
            { is_active: false }
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

        const results = [];

        for (const productId of product_ids) {
            try {
                const product = await pimService.updateProduct(
                    req.user.tenantId,
                    productId,
                    updates
                );
                results.push({ id: productId, success: true });
            } catch (error) {
                results.push({ id: productId, success: false, error: error.message });
            }
        }

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Импорт товаров из файла
router.post('/import', authenticate, checkPermission('products.import'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'File is required'
            });
        }

        // Проверяем возможность импорта в тарифе
        const tenantResult = await db.mainPool.query(
            'SELECT settings FROM tenants WHERE id = $1',
            [req.user.tenantId]
        );

        const features = tenantResult.rows[0].settings.tariff_features || [];

        if (!features.includes('import')) {
            return res.status(403).json({
                success: false,
                error: 'Import feature not available in your tariff'
            });
        }

        const fileType = path.extname(req.file.originalname).toLowerCase().substring(1);
        const result = await pimService.importFromFile(
            req.user.tenantId,
            req.file.path,
            fileType
        );

        res.json({
            success: true,
            data: result
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
        const yml = await syncService.generateYMLFeed(req.user.tenantId);

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

        const pool = await db.getPool(req.user.tenantId);
        const result = await pool.query(`
            INSERT INTO product_marketplace_mappings (
                product_id, marketplace_id, marketplace_product_id,
                mapping_data, is_active
            ) VALUES ($1, $2, $3, $4, true)
            ON CONFLICT (product_id, marketplace_id) 
            DO UPDATE SET 
                marketplace_product_id = EXCLUDED.marketplace_product_id,
                mapping_data = EXCLUDED.mapping_data,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            req.params.id,
            marketplace_id,
            marketplace_product_id,
            JSON.stringify(mapping_data || {})
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
