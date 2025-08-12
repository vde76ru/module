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
const axios = require('axios');
const sharp = require('sharp');
const cryptoUtils = require('../utils/crypto');

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

// Дополнительный загрузчик для изображений
const imageUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpg|jpeg|png|webp/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /image\/.*/.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Invalid image type'));
  }
});

// ===============================
// Helpers for images
// ===============================
async function getProductImages(companyId, productId) {
  const siteBase = process.env.SITE_BASE_URL || 'https://moduletrade.ru';
  const res = await db.query(
    `SELECT id, image_url, alt_text, sort_order, is_main, is_active
     FROM product_images
     WHERE product_id = $1 AND is_active = TRUE
     ORDER BY sort_order ASC, created_at ASC`,
    [productId]
  );
  const imagesArray = res.rows || [];
  return imagesArray.map((row, idx) => {
    const url = row.image_url;
    if (!url) return row;
    const token = cryptoUtils.encrypt(JSON.stringify({ u: url, c: companyId, p: productId, i: row.id || idx }));
    return { ...row, proxy_url: `${siteBase}/api/images/proxy/${encodeURIComponent(token)}` };
  });
}

function ensureMaxImages(countToAdd, existingCount) {
  const MAX = 10;
  if (existingCount + countToAdd > MAX) {
    const allowed = MAX - existingCount;
    if (allowed <= 0) {
      const err = new Error('Превышен лимит изображений (максимум 10)');
      err.statusCode = 400;
      throw err;
    }
    return allowed;
  }
  return countToAdd;
}

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

const { enforceResourceLimit, apiCallsLimit } = require('../middleware/limits');

// Создание нового товара - ИСПРАВЛЕНО для обработки всех полей
router.post('/', authenticate, apiCallsLimit(), enforceResourceLimit('products'), checkPermission('products.create'), async (req, res) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const {
            name,
            description,
            short_description,
            internal_code,
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
            slug,
            base_unit = 'шт',
            is_divisible = false,
            min_order_quantity = 1,
            source_type = 'manual',
            external_id,
            external_data = {},
            supplier_data = {},
            // Mapping payloads from frontend
            warehouse_mappings = [],
            supplier_mappings = []
        } = req.body;

        // Расширенная валидация полей
        const validationErrors = validateProductData({
            name,
            description,
            short_description,
            internal_code,
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
            slug,
            base_unit,
            min_order_quantity
        });

        if (validationErrors.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Проверяем уникальность internal_code в рамках компании
        if (internal_code) {
            const existingInternalCode = await client.query(
                'SELECT id FROM products WHERE company_id = $1 AND internal_code = $2',
                [req.user.companyId, internal_code]
            );

            if (existingInternalCode.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    error: 'Product with this internal code already exists'
                });
            }
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

        // Вычисляем объем если указаны размеры
        let volume = null;
        if (length && width && height) {
            volume = (parseFloat(length) * parseFloat(width) * parseFloat(height)) / 1000000; // в куб. метрах
        }

        // Создаем товар
        const productResult = await client.query(`
            INSERT INTO products (
                company_id, name, description, short_description, internal_code, sku, barcode,
                brand_id, category_id, weight, length, width, height, volume,
                status, is_visible, attributes, meta_title, meta_description,
                meta_keywords, slug, base_unit, is_divisible, min_order_quantity,
                source_type, external_id, external_data, supplier_data,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW(), NOW()
            ) RETURNING *
        `, [
            req.user.companyId,
            name,
            description || null,
            short_description || null,
            internal_code || null,
            sku || null,
            barcode || null,
            brand_id || null,
            category_id || null,
            weight ? parseFloat(weight) : null,
            length ? parseFloat(length) : null,
            width ? parseFloat(width) : null,
            height ? parseFloat(height) : null,
            volume,
            status,
            is_visible,
            JSON.stringify(attributes),
            meta_title || null,
            meta_description || null,
            meta_keywords || null,
            slug || null,
            base_unit,
            is_divisible,
            min_order_quantity,
            source_type,
            external_id || null,
            JSON.stringify(external_data),
            JSON.stringify(supplier_data)
        ]);

        const product = productResult.rows[0];

        // ===============================
        // Warehouse mappings upsert
        // ===============================
        if (Array.isArray(warehouse_mappings) && warehouse_mappings.length > 0) {
          for (const mapping of warehouse_mappings) {
            if (!mapping || !mapping.warehouse_id) continue;
            const qty = mapping.quantity != null ? parseFloat(mapping.quantity) : 0;
            const reservedQty = mapping.reserved_quantity != null ? parseFloat(mapping.reserved_quantity) : 0;
            const availableQty = mapping.available_quantity != null ? parseFloat(mapping.available_quantity) : (qty - reservedQty);
            const minStockLevel = mapping.min_stock_level != null ? parseFloat(mapping.min_stock_level) : 0;
            const maxQuantity = mapping.max_stock_level != null ? parseFloat(mapping.max_stock_level) : (mapping.max_quantity != null ? parseFloat(mapping.max_quantity) : null);
            const reorderPoint = mapping.reorder_point != null ? parseFloat(mapping.reorder_point) : null;
            const isActive = mapping.is_active === false ? false : true;
            const price = mapping.price != null ? parseFloat(mapping.price) : null;
            const currency = mapping.currency || null;
            const locationCode = mapping.location_code || null;

            await client.query(`
              INSERT INTO warehouse_product_links (
                warehouse_id, product_id, quantity, reserved_quantity, available_quantity,
                min_stock_level, max_quantity, reorder_point, price, currency, location_code,
                is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
              ON CONFLICT (warehouse_id, product_id)
              DO UPDATE SET
                quantity = EXCLUDED.quantity,
                reserved_quantity = COALESCE(EXCLUDED.reserved_quantity, warehouse_product_links.reserved_quantity),
                available_quantity = EXCLUDED.available_quantity,
                min_stock_level = COALESCE(EXCLUDED.min_stock_level, warehouse_product_links.min_stock_level),
                max_quantity = COALESCE(EXCLUDED.max_quantity, warehouse_product_links.max_quantity),
                reorder_point = COALESCE(EXCLUDED.reorder_point, warehouse_product_links.reorder_point),
                price = COALESCE(EXCLUDED.price, warehouse_product_links.price),
                currency = COALESCE(EXCLUDED.currency, warehouse_product_links.currency),
                location_code = COALESCE(EXCLUDED.location_code, warehouse_product_links.location_code),
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            `, [
              mapping.warehouse_id,
              product.id,
              qty,
              reservedQty,
              availableQty,
              minStockLevel,
              maxQuantity,
              reorderPoint,
              price,
              currency,
              locationCode,
              isActive,
            ]);
          }
        }

        // ===============================
        // Supplier mappings upsert
        // ===============================
        if (Array.isArray(supplier_mappings) && supplier_mappings.length > 0) {
          for (const mapping of supplier_mappings) {
            if (!mapping || !mapping.supplier_id) continue;
            const externalProductId = mapping.external_product_id || mapping.supplier_sku || sku || product.id;
            const externalSku = mapping.external_sku || mapping.supplier_sku || null;
            const externalName = mapping.external_name || mapping.supplier_name || name || null;
            const isPrimary = mapping.is_primary || mapping.is_main || false;
            const isActive = mapping.is_active === false ? false : true;

            await client.query(`
              INSERT INTO supplier_product_mappings (
                company_id, product_id, supplier_id, external_product_id, external_sku, external_name,
                is_primary, is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
              ON CONFLICT (company_id, supplier_id, external_product_id)
              DO UPDATE SET
                product_id = EXCLUDED.product_id,
                external_sku = COALESCE(EXCLUDED.external_sku, supplier_product_mappings.external_sku),
                external_name = COALESCE(EXCLUDED.external_name, supplier_product_mappings.external_name),
                is_primary = EXCLUDED.is_primary,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            `, [
              req.user.companyId,
              product.id,
              mapping.supplier_id,
              externalProductId,
              externalSku,
              externalName,
              isPrimary,
              isActive,
            ]);
          }
        }

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

// (Удалено дублирование маршрута экспорта товаров; маршрут определён выше, до '/:id')

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

        // images из таблицы product_images
        product.images = await getProductImages(req.user.companyId, id);

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
            slug,
            base_unit,
            is_divisible,
            min_order_quantity,
            external_id,
            external_data = {},
            supplier_data = {}
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

        // Вычисляем объем если указаны размеры
        let volume = null;
        if (length && width && height) {
            volume = (parseFloat(length) * parseFloat(width) * parseFloat(height)) / 1000000; // в куб. метрах
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
                volume = COALESCE($13, volume),
                status = COALESCE($14, status),
                is_visible = COALESCE($15, is_visible),
                attributes = COALESCE($16, attributes),
                meta_title = COALESCE($17, meta_title),
                meta_description = COALESCE($18, meta_description),
                meta_keywords = COALESCE($19, meta_keywords),
                slug = COALESCE($20, slug),
                base_unit = COALESCE($21, base_unit),
                is_divisible = COALESCE($22, is_divisible),
                min_order_quantity = COALESCE($23, min_order_quantity),
                external_id = COALESCE($24, external_id),
                external_data = COALESCE($25, external_data),
                supplier_data = COALESCE($26, supplier_data),
                updated_at = NOW()
            WHERE id = $1 AND company_id = $27
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
            volume,
            status,
            is_visible,
            attributes ? JSON.stringify(attributes) : null,
            meta_title,
            meta_description,
            meta_keywords,
            slug,
            base_unit,
            is_divisible,
            min_order_quantity,
            external_id,
            external_data ? JSON.stringify(external_data) : null,
            supplier_data ? JSON.stringify(supplier_data) : null,
            req.user.companyId
        ]);

        const product = updateResult.rows[0];

        // Обработка маппингов при обновлении
        const { warehouse_mappings = [], supplier_mappings = [] } = req.body;

        // Warehouse mappings upsert
        if (Array.isArray(warehouse_mappings) && warehouse_mappings.length > 0) {
          for (const mapping of warehouse_mappings) {
            if (!mapping || !mapping.warehouse_id) continue;
            const qty = mapping.quantity != null ? parseFloat(mapping.quantity) : 0;
            const reservedQty = mapping.reserved_quantity != null ? parseFloat(mapping.reserved_quantity) : 0;
            const availableQty = mapping.available_quantity != null ? parseFloat(mapping.available_quantity) : (qty - reservedQty);
            const minStockLevel = mapping.min_stock_level != null ? parseFloat(mapping.min_stock_level) : 0;
            const maxQuantity = mapping.max_stock_level != null ? parseFloat(mapping.max_stock_level) : (mapping.max_quantity != null ? parseFloat(mapping.max_quantity) : null);
            const reorderPoint = mapping.reorder_point != null ? parseFloat(mapping.reorder_point) : null;
            const isActive = mapping.is_active === false ? false : true;
            const price = mapping.price != null ? parseFloat(mapping.price) : null;
            const currency = mapping.currency || null;
            const locationCode = mapping.location_code || null;

            await client.query(`
              INSERT INTO warehouse_product_links (
                warehouse_id, product_id, quantity, reserved_quantity, available_quantity,
                min_stock_level, max_quantity, reorder_point, price, currency, location_code,
                is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
              ON CONFLICT (warehouse_id, product_id)
              DO UPDATE SET
                quantity = EXCLUDED.quantity,
                reserved_quantity = COALESCE(EXCLUDED.reserved_quantity, warehouse_product_links.reserved_quantity),
                available_quantity = EXCLUDED.available_quantity,
                min_stock_level = COALESCE(EXCLUDED.min_stock_level, warehouse_product_links.min_stock_level),
                max_quantity = COALESCE(EXCLUDED.max_quantity, warehouse_product_links.max_quantity),
                reorder_point = COALESCE(EXCLUDED.reorder_point, warehouse_product_links.reorder_point),
                price = COALESCE(EXCLUDED.price, warehouse_product_links.price),
                currency = COALESCE(EXCLUDED.currency, warehouse_product_links.currency),
                location_code = COALESCE(EXCLUDED.location_code, warehouse_product_links.location_code),
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            `, [
              mapping.warehouse_id,
              id,
              qty,
              reservedQty,
              availableQty,
              minStockLevel,
              maxQuantity,
              reorderPoint,
              price,
              currency,
              locationCode,
              isActive,
            ]);
          }
        }

        // Supplier mappings upsert
        if (Array.isArray(supplier_mappings) && supplier_mappings.length > 0) {
          for (const mapping of supplier_mappings) {
            if (!mapping || !mapping.supplier_id) continue;
            const externalProductId = mapping.external_product_id || mapping.supplier_sku || sku || product.external_id || id;
            const externalSku = mapping.external_sku || mapping.supplier_sku || null;
            const externalName = mapping.external_name || mapping.supplier_name || name || product.name || null;
            const isPrimary = mapping.is_primary || mapping.is_main || false;
            const isActive = mapping.is_active === false ? false : true;

            await client.query(`
              INSERT INTO supplier_product_mappings (
                company_id, product_id, supplier_id, external_product_id, external_sku, external_name,
                is_primary, is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
              ON CONFLICT (company_id, supplier_id, external_product_id)
              DO UPDATE SET
                product_id = EXCLUDED.product_id,
                external_sku = COALESCE(EXCLUDED.external_sku, supplier_product_mappings.external_sku),
                external_name = COALESCE(EXCLUDED.external_name, supplier_product_mappings.external_name),
                is_primary = EXCLUDED.is_primary,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            `, [
              req.user.companyId,
              id,
              mapping.supplier_id,
              externalProductId,
              externalSku,
              externalName,
              isPrimary,
              isActive,
            ]);
          }
        }

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

  if (data.name && data.name.length > 500) {
    errors.push('Product name cannot exceed 500 characters');
  }

  // Проверка внутреннего кода
  if (!data.internal_code || data.internal_code.trim().length === 0) {
    errors.push('Internal code is required');
  }

  if (data.internal_code && data.internal_code.length > 100) {
    errors.push('Internal code cannot exceed 100 characters');
  }

  // Проверка SKU
  if (data.sku && data.sku.length > 100) {
    errors.push('SKU cannot exceed 100 characters');
  }

  // Проверка штрихкода
  if (data.barcode && data.barcode.length > 100) {
    errors.push('Barcode cannot exceed 100 characters');
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

  // Проверка единицы измерения
  if (data.base_unit && data.base_unit.length > 50) {
    errors.push('Base unit cannot exceed 50 characters');
  }

  // Проверка минимального количества заказа
  if (data.min_order_quantity && (isNaN(data.min_order_quantity) || data.min_order_quantity <= 0)) {
    errors.push('Minimum order quantity must be a positive number');
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
  if (data.meta_title && data.meta_title.length > 255) {
    errors.push('Meta title cannot exceed 255 characters');
  }

  if (data.meta_description && data.meta_description.length > 500) {
    errors.push('Meta description cannot exceed 500 characters');
  }

  if (data.meta_keywords && data.meta_keywords.length > 500) {
    errors.push('Meta keywords cannot exceed 500 characters');
  }

  // Проверка slug
  if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
    errors.push('Slug can only contain lowercase letters, numbers, and hyphens');
  }

  return errors;
}

// Поиск товаров
router.get('/search', authenticate, async (req, res) => {
    try {
        const { q, category_id, brand_id, status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT p.*, b.name as brand_name, c.name as category_name
            FROM products p
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.company_id = $1
        `;
        const params = [req.user.companyId];
        let paramIndex = 2;

        // Поиск по названию
        if (q) {
            query += ` AND (p.name ILIKE $${paramIndex} OR p.internal_code ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`;
            params.push(`%${q}%`);
            paramIndex++;
        }

        // Фильтр по категории
        if (category_id) {
            query += ` AND p.category_id = $${paramIndex}`;
            params.push(category_id);
            paramIndex++;
        }

        // Фильтр по бренду
        if (brand_id) {
            query += ` AND p.brand_id = $${paramIndex}`;
            params.push(brand_id);
            paramIndex++;
        }

        // Фильтр по статусу
        if (status) {
            query += ` AND p.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: result.rows.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('Search products error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search products'
        });
    }
});

// Массовое обновление товаров
router.post('/bulk-update', authenticate, checkPermission('products.update'), async (req, res) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const { product_ids, updates } = req.body;

        if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Product IDs array is required'
            });
        }

        if (!updates || typeof updates !== 'object') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Updates object is required'
            });
        }

        // Проверяем права на обновление товаров
        const productsCheck = await client.query(
            'SELECT id FROM products WHERE id = ANY($1) AND company_id = $2',
            [product_ids, req.user.companyId]
        );

        if (productsCheck.rows.length !== product_ids.length) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                success: false,
                error: 'Some products not found or access denied'
            });
        }

        // Подготавливаем поля для обновления
        const updateFields = [];
        const updateValues = [];
        let valueIndex = 1;

        Object.keys(updates).forEach(key => {
            if (key !== 'id' && key !== 'company_id' && key !== 'created_at') {
                updateFields.push(`${key} = $${valueIndex}`);
                updateValues.push(updates[key]);
                valueIndex++;
            }
        });

        if (updateFields.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }

        updateFields.push('updated_at = NOW()');

        // Обновляем товары
        const updateQuery = `
            UPDATE products
            SET ${updateFields.join(', ')}
            WHERE id = ANY($${valueIndex}) AND company_id = $${valueIndex + 1}
        `;
        updateValues.push(product_ids, req.user.companyId);

        await client.query(updateQuery, updateValues);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Successfully updated ${product_ids.length} products`,
            updated_count: product_ids.length
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Bulk update products error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update products'
        });
    } finally {
        client.release();
    }
});

// Массовое удаление товаров
router.post('/bulk-delete', authenticate, checkPermission('products.delete'), async (req, res) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const { product_ids } = req.body;

        if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Product IDs array is required'
            });
        }

        // Проверяем права на удаление товаров
        const productsCheck = await client.query(
            'SELECT id FROM products WHERE id = ANY($1) AND company_id = $2',
            [product_ids, req.user.companyId]
        );

        if (productsCheck.rows.length !== product_ids.length) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                success: false,
                error: 'Some products not found or access denied'
            });
        }

        // Удаляем товары (мягкое удаление - устанавливаем is_active = false)
        await client.query(
            'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = ANY($1) AND company_id = $2',
            [product_ids, req.user.companyId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Successfully deleted ${product_ids.length} products`,
            deleted_count: product_ids.length
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Bulk delete products error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete products'
        });
    } finally {
        client.release();
    }
});

// Экспорт товаров
router.get('/export', authenticate, checkPermission('products.export'), async (req, res) => {
    try {
        const { format = 'xlsx', category_id, brand_id, status } = req.query;

        let query = `
            SELECT
                p.internal_code,
                p.name,
                p.description,
                p.sku,
                p.barcode,
                b.name as brand_name,
                c.name as category_name,
                p.weight,
                p.length,
                p.width,
                p.height,
                (
                  SELECT COALESCE(pi.image_url, pi.url)
                  FROM product_images pi
                  WHERE pi.product_id = p.id AND pi.is_active = true
                  ORDER BY pi.sort_order, pi.created_at
                  LIMIT 1
                ) AS supplier_image_url,
                p.status,
                p.is_active,
                p.created_at,
                p.updated_at
            FROM products p
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.company_id = $1
        `;
        const siteBase = process.env.SITE_BASE_URL || 'https://moduletrade.ru';
        const params = [req.user.companyId];
        let paramIndex = 2;

        // Фильтры
        if (category_id) {
            query += ` AND p.category_id = $${paramIndex}`;
            params.push(category_id);
            paramIndex++;
        }

        if (brand_id) {
            query += ` AND p.brand_id = $${paramIndex}`;
            params.push(brand_id);
            paramIndex++;
        }

        if (status) {
            query += ` AND p.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ` ORDER BY p.created_at DESC`;

        // Выполняем запрос
        const result = await db.query(query, params);

        // Пост-обработка: формируем прокси URL на основании supplier_image_url
        const rows = result.rows.map(row => {
          if (row.supplier_image_url) {
            const token = cryptoUtils.encrypt(JSON.stringify({ u: row.supplier_image_url }));
            row.image_url = `${siteBase}/api/images/proxy/${encodeURIComponent(token)}`;
          } else {
            row.image_url = null;
          }
          return row;
        });

        if (format === 'json') {
          return res.json({ success: true, data: rows, format, total: rows.length });
        }

        if (format === 'csv') {
          const stringify = require('csv-stringify').stringify;
          const columns = [
            'internal_code', 'name', 'description', 'sku', 'barcode',
            'brand_name', 'category_name', 'weight', 'length', 'width', 'height',
            'image_url', 'status', 'is_active', 'created_at', 'updated_at'
          ];
          return stringify(rows, { header: true, columns }, (err, output) => {
            if (err) throw err;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
            res.send(output);
          });
        }

        if (format === 'xlsx') {
          const ExcelJS = require('exceljs');
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet('Products');
          sheet.columns = [
            { header: 'Код', key: 'internal_code' },
            { header: 'Название', key: 'name' },
            { header: 'Описание', key: 'description' },
            { header: 'SKU', key: 'sku' },
            { header: 'Штрихкод', key: 'barcode' },
            { header: 'Бренд', key: 'brand_name' },
            { header: 'Категория', key: 'category_name' },
            { header: 'Вес', key: 'weight' },
            { header: 'Длина', key: 'length' },
            { header: 'Ширина', key: 'width' },
            { header: 'Высота', key: 'height' },
            { header: 'Изображение', key: 'image_url' },
            { header: 'Статус', key: 'status' },
            { header: 'Активен', key: 'is_active' },
            { header: 'Создан', key: 'created_at' },
            { header: 'Обновлен', key: 'updated_at' },
          ];
          rows.forEach((r) => sheet.addRow(r));
          res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          await workbook.xlsx.write(res);
          return res.end();
        }

        return res.status(400).json({ success: false, error: 'Unsupported format' });

    } catch (error) {
        console.error('Export products error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export products'
        });
    }
});

// Ограниченное обновление public_id товара
router.put('/:id/public-id', authenticate, checkPermission('products.update'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const productId = req.params.id;
    const { public_id: newPublicId } = req.body || {};

    const userRole = (req.user.role || '').toLowerCase();
    if (!['владелец', 'owner', 'администратор', 'administrator', 'admin'].includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to change public_id' });
    }

    const parsed = parseInt(newPublicId, 10);
    if (!Number.isInteger(parsed) || parsed < 100000) {
      return res.status(400).json({ success: false, error: 'public_id must be an integer >= 100000' });
    }

    const existing = await db.query('SELECT id FROM products WHERE id = $1 AND company_id = $2', [productId, companyId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const dup = await db.query('SELECT 1 FROM products WHERE company_id = $1 AND public_id = $2 AND id != $3', [companyId, parsed, productId]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'public_id already in use' });
    }

    const result = await db.query('UPDATE products SET public_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2 RETURNING *', [productId, companyId, parsed]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update product public_id error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

// Загрузка изображений товара (RESTful: /api/products/:id/images)
router.post('/:id/images', authenticate, checkPermission('products.update'), imageUpload.array('images', 8), async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем принадлежность товара компании
    const productResult = await db.query('SELECT id FROM products WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    // Сколько уже есть изображений
    const existingCountRes = await db.query('SELECT COUNT(*)::int AS cnt FROM product_images WHERE product_id = $1 AND is_active = TRUE', [id]);
    const existingCount = existingCountRes.rows?.[0]?.cnt || 0;

    const files = req.files || [];
    const allowedCount = ensureMaxImages(files.length, existingCount);
    const filesToProcess = files.slice(0, allowedCount);

    // Сжатие и сохранение файлов: поддерживаем локальную загрузку для случаев, когда нет ссылок поставщика
    const saved = [];
    for (const file of filesToProcess) {
      const destPath = path.join('uploads', 'imports', path.basename(file.path));
      // компрессия в webp
      await sharp(file.path).webp({ quality: 82 }).toFile(destPath + '.webp');
      const fileUrl = `/uploads/imports/${path.basename(destPath)}.webp`;
      const nextSort = existingCount + saved.length;
      const ins = await db.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_main, is_active)
         VALUES ($1, $2, NULL, $3, FALSE, TRUE)
         RETURNING id, image_url, alt_text, sort_order, is_main, is_active`,
        [id, fileUrl, nextSort]
      );
      saved.push(ins.rows[0]);
    }

    const images = await getProductImages(req.user.companyId, id);
    return res.json({ success: true, data: { images } });
  } catch (error) {
    console.error('Upload product images error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload images' });
  }
});

// Добавление изображений по URL (без загрузки файлов)
router.post('/:id/image-urls', authenticate, checkPermission('products.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { urls = [], alt = null } = req.body || {};

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ success: false, error: 'Не переданы ссылки изображений' });
    }

    const productResult = await db.query('SELECT id FROM products WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const existingCountRes2 = await db.query('SELECT COUNT(*)::int AS cnt FROM product_images WHERE product_id = $1 AND is_active = TRUE', [id]);
    const existingCount2 = existingCountRes2.rows?.[0]?.cnt || 0;
    const allowedCount = ensureMaxImages(urls.length, existingCount);
    const urlsToInsert = urls.slice(0, allowedCount);

    // вставляем как есть (ссылки поставщика), без скачивания
    for (let i = 0; i < urlsToInsert.length; i++) {
      const imageUrl = urlsToInsert[i];
      const nextSort = existingCount2 + i;
      await db.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_main, is_active)
         VALUES ($1, $2, $3, $4, FALSE, TRUE)`,
        [id, imageUrl, alt || null, nextSort]
      );
    }

    const images = await getProductImages(req.user.companyId, id);
    return res.json({ success: true, data: { images } });
  } catch (error) {
    console.error('Add image URLs error:', error);
    res.status(500).json({ success: false, error: 'Failed to add image URLs' });
  }
});

// Получение изображений товара
router.get('/:id/images', authenticate, checkPermission('products.view'), async (req, res) => {
  try {
    const { id } = req.params;
    const productResult = await db.query('SELECT id FROM products WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    const images = await getProductImages(req.user.companyId, id);
    return res.json({ success: true, data: { images } });
  } catch (error) {
    console.error('Get product images error:', error);
    res.status(500).json({ success: false, error: 'Failed to get images' });
  }
});

// Обновление порядка изображений и отметки главной
router.put('/:id/images/sort', authenticate, checkPermission('products.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { order = [], mainImageId = null } = req.body || {};

    const productResult = await db.query('SELECT id FROM products WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const imgsRes = await db.query('SELECT id FROM product_images WHERE product_id = $1 AND is_active = TRUE ORDER BY sort_order ASC, created_at ASC', [id]);
    const rows = imgsRes.rows || [];
    // Переставляем sort_order согласно order индексов
    if (Array.isArray(order) && order.length === rows.length) {
      for (let newSort = 0; newSort < order.length; newSort++) {
        const idx = order[newSort];
        const imageId = rows[idx].id;
        await db.query('UPDATE product_images SET sort_order = $2 WHERE id = $1', [imageId, newSort]);
      }
    }
    if (mainImageId !== null && mainImageId !== undefined) {
      await db.query('UPDATE product_images SET is_main = FALSE WHERE product_id = $1', [id]);
      await db.query('UPDATE product_images SET is_main = TRUE WHERE product_id = $1 AND id = $2', [id, mainImageId]);
    }

    const newImages = await getProductImages(req.user.companyId, id);
    return res.json({ success: true, data: { images: newImages } });
  } catch (error) {
    console.error('Sort images error:', error);
    res.status(500).json({ success: false, error: 'Failed to update order' });
  }
});

// Удаление изображения
router.delete('/:id/images/:imageId', authenticate, checkPermission('products.update'), async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const productResult = await db.query('SELECT id FROM products WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    await db.query('UPDATE product_images SET is_active = FALSE WHERE product_id = $1 AND id = $2', [id, imageId]);
    const images = await getProductImages(req.user.companyId, id);
    return res.json({ success: true, data: { images } });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete image' });
  }
});

// (image proxy moved to images router)