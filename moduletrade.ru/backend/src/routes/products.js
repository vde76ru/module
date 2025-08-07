// ===================================================
// ФАЙЛ: backend/src/routes/products.js
// ИСПРАВЛЕНИЯ: Добавлена обработка всех полей frontend
// ===================================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, checkPermission } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Безопасная инициализация сервисов
let PIMService, BillingService, pimService, billingService;

try {
  PIMService = require('../services/PIMService');
  pimService = new PIMService();
} catch (error) {
  console.warn('PIMService not available:', error.message);
}

try {
  BillingService = require('../services/BillingService');
  billingService = new BillingService();
} catch (error) {
  console.warn('BillingService not available:', error.message);
}

const fs = require('fs');
if (!fs.existsSync('uploads/imports/')) {
  fs.mkdirSync('uploads/imports/', { recursive: true });
}

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

        const result = await pimService.getAllProducts(req.user.companyId, filters);

        res.json({
            success: true,
            data: result.data || result,
            pagination: result.pagination || {
                total: result.length || 0,
                page: filters.page,
                limit: filters.limit
            }
        });

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch products'
        });
    }
});

// Создание нового товара - ИСПРАВЛЕНО для обработки всех полей
router.post('/', authenticate, checkPermission('products.create'), async (req, res) => {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');

        const {
            name,
            description,
            short_description,
            sku,
            barcode,
            brand_id,
            category_id,
            weight,
            length,
            width,
            height,
            status = 'active',
            is_visible = true,
            attributes = {},
            meta_title,
            meta_description,
            meta_keywords,
            slug
        } = req.body;

        // Расширенная валидация полей
        const validationErrors = this.validateProductData({
            name,
            description,
            short_description,
            sku,
            barcode,
            brand_id,
            category_id,
            weight,
            length,
            width,
            height,
            status,
            is_visible,
            attributes,
            meta_title,
            meta_description,
            meta_keywords,
            slug
        });

        if (validationErrors.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Проверяем уникальность SKU в рамках компании
        if (sku) {
            const existingSku = await client.query(
                'SELECT id FROM products WHERE company_id = $1 AND sku = $2',
                [req.user.companyId, sku]
            );

            if (existingSku.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    error: 'Product with this SKU already exists'
                });
            }
        }

        // Создаем товар
        const productResult = await client.query(`
            INSERT INTO products (
                company_id, name, description, short_description, sku, barcode,
                brand_id, category_id, weight, length, width, height,
                status, is_visible, attributes, meta_title, meta_description, 
                meta_keywords, slug, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW()
            ) RETURNING *
        `, [
            req.user.companyId,
            name,
            description || null,
            short_description || null,
            sku || null,
            barcode || null,
            brand_id || null,
            category_id || null,
            weight ? parseFloat(weight) : null,
            length ? parseFloat(length) : null,
            width ? parseFloat(width) : null,
            height ? parseFloat(height) : null,
            status,
            is_visible,
            JSON.stringify(attributes),
            meta_title || null,
            meta_description || null,
            meta_keywords || null,
            slug || null
        ]);

        const product = productResult.rows[0];

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: product,
            message: 'Product created successfully'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating product:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create product'
        });
    } finally {
        client.release();
    }
});

// Получение конкретного товара
router.get('/:id', authenticate, checkPermission('products.view'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT p.*, 
                   b.name as brand_name,
                   c.name as category_name
            FROM products p
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1 AND p.company_id = $2
        `, [id, req.user.companyId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        const product = result.rows[0];

        res.json({
            success: true,
            data: product
        });

    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product'
        });
    }
});

// Обновление товара - ИСПРАВЛЕНО для обработки всех полей
router.put('/:id', authenticate, checkPermission('products.update'), async (req, res) => {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const {
            name,
            description,
            short_description,
            sku,
            barcode,
            brand_id,
            category_id,
            weight,
            length,
            width,
            height,
            status,
            is_visible,
            attributes = {},
            meta_title,
            meta_description,
            meta_keywords,
            slug
        } = req.body;

        // Проверяем существование товара
        const existingProduct = await client.query(
            'SELECT * FROM products WHERE id = $1 AND company_id = $2',
            [id, req.user.companyId]
        );

        if (existingProduct.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Проверяем уникальность SKU если он изменился
        if (sku && sku !== existingProduct.rows[0].sku) {
            const existingSku = await client.query(
                'SELECT id FROM products WHERE company_id = $1 AND sku = $2 AND id != $3',
                [req.user.companyId, sku, id]
            );

            if (existingSku.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    error: 'Product with this SKU already exists'
                });
            }
        }

        // Обновляем товар
        const updateResult = await client.query(`
            UPDATE products SET
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                short_description = COALESCE($4, short_description),
                sku = COALESCE($5, sku),
                barcode = COALESCE($6, barcode),
                brand_id = COALESCE($7, brand_id),
                category_id = COALESCE($8, category_id),
                weight = COALESCE($9, weight),
                length = COALESCE($10, length),
                width = COALESCE($11, width),
                height = COALESCE($12, height),
                status = COALESCE($13, status),
                is_visible = COALESCE($14, is_visible),
                attributes = COALESCE($15, attributes),
                meta_title = COALESCE($16, meta_title),
                meta_description = COALESCE($17, meta_description),
                meta_keywords = COALESCE($18, meta_keywords),
                slug = COALESCE($19, slug),
                updated_at = NOW()
            WHERE id = $1 AND company_id = $20
            RETURNING *
        `, [
            id,
            name,
            description,
            short_description,
            sku,
            barcode,
            brand_id,
            category_id,
            weight ? parseFloat(weight) : null,
            length ? parseFloat(length) : null,
            width ? parseFloat(width) : null,
            height ? parseFloat(height) : null,
            status,
            is_visible,
            attributes ? JSON.stringify(attributes) : null,
            meta_title,
            meta_description,
            meta_keywords,
            slug,
            req.user.companyId
        ]);

        const product = updateResult.rows[0];

        await client.query('COMMIT');

        res.json({
            success: true,
            data: product,
            message: 'Product updated successfully'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating product:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update product'
        });
    } finally {
        client.release();
    }
});

// Удаление товара
router.delete('/:id', authenticate, checkPermission('products.delete'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM products WHERE id = $1 AND company_id = $2 RETURNING id',
            [id, req.user.companyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete product'
        });
    }
});

// Получение категорий
router.get('/categories/list', authenticate, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, name, parent_id, path, level
            FROM categories
            WHERE company_id = $1 AND is_active = true
            ORDER BY path, sort_order, name
        `, [req.user.companyId]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
});

/**
 * Валидация данных товара
 */
function validateProductData(data) {
  const errors = [];

  // Проверка обязательных полей
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (data.name && data.name.length > 255) {
    errors.push('Product name cannot exceed 255 characters');
  }

  // Проверка SKU
  if (data.sku && data.sku.length > 100) {
    errors.push('SKU cannot exceed 100 characters');
  }

  // Проверка штрихкода
  if (data.barcode && data.barcode.length > 50) {
    errors.push('Barcode cannot exceed 50 characters');
  }

  // Проверка описания
  if (data.description && data.description.length > 5000) {
    errors.push('Description cannot exceed 5000 characters');
  }

  if (data.short_description && data.short_description.length > 500) {
    errors.push('Short description cannot exceed 500 characters');
  }

  // Проверка размеров
  if (data.weight && (isNaN(data.weight) || data.weight < 0)) {
    errors.push('Weight must be a positive number');
  }

  if (data.length && (isNaN(data.length) || data.length < 0)) {
    errors.push('Length must be a positive number');
  }

  if (data.width && (isNaN(data.width) || data.width < 0)) {
    errors.push('Width must be a positive number');
  }

  if (data.height && (isNaN(data.height) || data.height < 0)) {
    errors.push('Height must be a positive number');
  }

  // Проверка статуса
  const validStatuses = ['active', 'inactive', 'draft', 'archived'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push('Invalid status value');
  }

  // Проверка атрибутов
  if (data.attributes && typeof data.attributes !== 'object') {
    errors.push('Attributes must be an object');
  }

  // Проверка мета-полей
  if (data.meta_title && data.meta_title.length > 60) {
    errors.push('Meta title cannot exceed 60 characters');
  }

  if (data.meta_description && data.meta_description.length > 160) {
    errors.push('Meta description cannot exceed 160 characters');
  }

  if (data.meta_keywords && data.meta_keywords.length > 255) {
    errors.push('Meta keywords cannot exceed 255 characters');
  }

  // Проверка slug
  if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
    errors.push('Slug can only contain lowercase letters, numbers, and hyphens');
  }

  return errors;
}

module.exports = router;