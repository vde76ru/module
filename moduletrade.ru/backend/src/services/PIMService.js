// backend/src/services/PIMService.js
const db = require('../config/database');
const logger = require('../utils/logger');
const NormalizationService = require('./NormalizationService');

class PIMService {
  constructor() {
    this.normalizationService = new NormalizationService();
  }

  /**
   * Получение всех товаров с фильтрацией
   */
  async getAllProducts(companyId, filters = {}) {
    try {
      const {
        source_type,
        brand_id,
        category_id,
        is_active,
        search,
        low_stock,
        limit = 50,
        offset = 0,
        page = 1
      } = filters;

      let whereConditions = ['p.company_id = $1'];
      let params = [companyId];
      let paramIndex = 2;

      if (source_type) {
        whereConditions.push(`p.source_type = $${paramIndex}`);
        params.push(source_type);
        paramIndex++;
      }

      if (brand_id) {
        whereConditions.push(`p.brand_id = $${paramIndex}`);
        params.push(brand_id);
        paramIndex++;
      }

      if (category_id) {
        whereConditions.push(`p.category_id = $${paramIndex}`);
        params.push(category_id);
        paramIndex++;
      }

      if (is_active !== undefined) {
        whereConditions.push(`p.is_active = $${paramIndex}`);
        params.push(is_active);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.internal_code ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (low_stock) {
        whereConditions.push(`
          EXISTS (
            SELECT 1 FROM warehouse_product_links wpl
            WHERE wpl.product_id = p.id AND wpl.quantity <= wpl.min_stock_level
          )
        `);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // ✅ ОБНОВЛЕНО: Добавлены новые поля weight, length, width, height в SELECT
      const query = `
        SELECT
          p.id, p.internal_code, p.name, p.description,
          p.brand_id, p.category_id, p.attributes, p.source_type, p.is_active,
          p.main_supplier_id, p.base_unit, p.is_divisible, p.min_order_quantity,
          p.weight, p.length, p.width, p.height, p.volume, p.dimensions,
          p.popularity_score, p.created_at, p.updated_at,
          b.name as brand_name,
          c.name as category_name,
          s.name as main_supplier_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.main_supplier_id = s.id
        ${whereClause}
        ORDER BY p.updated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await db.query(query, params);

      // Подсчет общего количества записей
      const countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        ${whereClause}
      `;

      const countResult = await db.query(countQuery, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].total);

      return {
        data: result.rows,
        pagination: {
          page,
          limit,
          offset,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Error in getAllProducts:', error);
      throw error;
    }
  }

  /**
   * Получение товара по ID
   */
  async getProductById(companyId, productId) {
    try {
      // ✅ ОБНОВЛЕНО: Добавлены новые поля weight, length, width, height в SELECT
      const query = `
        SELECT
          p.id, p.company_id, p.internal_code, p.name, p.description,
          p.brand_id, p.category_id, p.attributes, p.source_type, p.is_active,
          p.main_supplier_id, p.base_unit, p.is_divisible, p.min_order_quantity,
          p.weight, p.length, p.width, p.height, p.volume, p.dimensions,
          p.packaging_info, p.popularity_score, p.cable_info,
          p.created_at, p.updated_at,
          b.name as brand_name,
          c.name as category_name,
          s.name as main_supplier_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.main_supplier_id = s.id
        WHERE p.company_id = $1 AND p.id = $2
      `;

      const result = await db.query(query, [companyId, productId]);

      if (result.rows.length === 0) {
        return null;
      }

      const product = result.rows[0];

      // Получаем поставщиков товара
      const suppliersQuery = `
        SELECT
          ps.id, ps.supplier_code, ps.price, ps.mrc_price, ps.enforce_mrc,
          ps.quantity, ps.is_available, ps.last_sync_at, ps.currency,
          s.id as supplier_id, s.name as supplier_name
        FROM product_suppliers ps
        JOIN suppliers s ON ps.supplier_id = s.id
        WHERE ps.product_id = $1
        ORDER BY ps.price ASC
      `;

      const suppliersResult = await db.query(suppliersQuery, [productId]);
      product.suppliers = suppliersResult.rows;

      return product;

    } catch (error) {
      logger.error('Error in getProductById:', error);
      throw error;
    }
  }

  /**
   * Создание товара
   * ✅ ОБНОВЛЕНО: Добавлена поддержка новых полей weight, length, width, height
   */
  async createProduct(companyId, productData, userId) {
    try {
      // Нормализуем данные перед сохранением
      const normalizedData = this.normalizeProductData(productData);

      const {
        internal_code,
        name,
        description,
        brand_id,
        category_id,
        attributes = {},
        source_type = 'manual',
        main_supplier_id,
        weight,
        length,
        width,
        height,
        base_unit,
        is_divisible,
        min_order_quantity
      } = normalizedData;

      const query = `
        INSERT INTO products (
          company_id, internal_code, name, description,
          brand_id, category_id, attributes, source_type, main_supplier_id,
          weight, length, width, height, base_unit, is_divisible, min_order_quantity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      const result = await db.query(query, [
        companyId,
        internal_code,
        name,
        description || null,
        brand_id || null,
        category_id || null,
        JSON.stringify(attributes),
        source_type,
        main_supplier_id || null,
        weight || null,
        length || null,
        width || null,
        height || null,
        base_unit || 'шт',
        is_divisible !== undefined ? is_divisible : true,
        min_order_quantity || 1
      ]);

      logger.info(`Product created: ${result.rows[0].id} by user ${userId}`);

      return result.rows[0];

    } catch (error) {
      logger.error('Error in createProduct:', error);
      throw error;
    }
  }

  /**
   * Обновление товара
   * ✅ ОБНОВЛЕНО: Добавлена поддержка новых полей weight, length, width, height
   */
  async updateProduct(companyId, productId, updateData, userId) {
    try {
      // Нормализуем данные перед сохранением
      const normalizedData = this.normalizeProductData(updateData);

      const allowedFields = [
        'name', 'description', 'brand_id', 'category_id',
        'attributes', 'is_active', 'main_supplier_id',
        'weight', 'length', 'width', 'height', 'base_unit',
        'is_divisible', 'min_order_quantity'
      ];

      const updates = [];
      const values = [companyId, productId];
      let paramIndex = 3;

      for (const [key, value] of Object.entries(normalizedData)) {
        if (allowedFields.includes(key)) {
          if (key === 'attributes') {
            updates.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            updates.push(`${key} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid update fields provided');
      }

      const query = `
        UPDATE products SET
          ${updates.join(',')},
          updated_at = CURRENT_TIMESTAMP
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Product not found');
      }

      logger.info(`Product updated: ${productId} by user ${userId}`);

      return result.rows[0];

    } catch (error) {
      logger.error('Error in updateProduct:', error);
      throw error;
    }
  }

  /**
   * Нормализация данных товара
   * ✅ НОВЫЙ МЕТОД: Использует NormalizationService для обработки физических характеристик
   */
  normalizeProductData(rawData) {
    const normalized = { ...rawData };

    // Нормализуем вес
    if (rawData.weight !== undefined) {
      normalized.weight = this.normalizationService.normalizeWeight(rawData.weight);
    }

    // Нормализуем габариты
    if (rawData.dimensions !== undefined) {
      const dims = this.normalizationService.normalizeDimensions(rawData.dimensions);
      if (dims) {
        normalized.length = dims.length;
        normalized.width = dims.width;
        normalized.height = dims.height;
      }
    }

    // Нормализуем отдельные поля габаритов
    if (rawData.length !== undefined) {
      const length = parseFloat(rawData.length);
      normalized.length = !isNaN(length) && length > 0 ? length : null;
    }

    if (rawData.width !== undefined) {
      const width = parseFloat(rawData.width);
      normalized.width = !isNaN(width) && width > 0 ? width : null;
    }

    if (rawData.height !== undefined) {
      const height = parseFloat(rawData.height);
      normalized.height = !isNaN(height) && height > 0 ? height : null;
    }

    // Нормализуем булевы значения
    if (rawData.is_divisible !== undefined) {
      normalized.is_divisible = Boolean(rawData.is_divisible);
    }

    // Нормализуем числовые значения
    if (rawData.min_order_quantity !== undefined) {
      const minQty = parseFloat(rawData.min_order_quantity);
      normalized.min_order_quantity = !isNaN(minQty) && minQty > 0 ? minQty : 1;
    }

    return normalized;
  }

  /**
   * Массовое обновление товаров
   */
  async bulkUpdateProducts(companyId, productIds, updateData, userId) {
    try {
      const allowedFields = ['is_active', 'brand_id', 'category_id'];
      const updates = [];
      const values = [companyId];
      let paramIndex = 2;

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        throw new Error('No update fields provided');
      }

      const placeholders = productIds.map((_, index) => `$${paramIndex + index}`).join(',');
      values.push(...productIds);

      const query = `
        UPDATE products SET
          ${updates.join(',')},
          updated_at = CURRENT_TIMESTAMP
        WHERE company_id = $1 AND id IN (${placeholders})
        RETURNING id, name, is_active
      `;

      const result = await db.query(query, values);

      logger.info(`Bulk updated ${result.rows.length} products by user ${userId}`);

      return result.rows;

    } catch (error) {
      logger.error('Error in bulkUpdateProducts:', error);
      throw error;
    }
  }

  /**
   * Получение статистики товаров
   */
  async getProductStats(companyId) {
    try {
      const query = `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE is_active = false) as inactive,
          COUNT(*) FILTER (WHERE source_type = 'manual') as manual,
          COUNT(*) FILTER (WHERE source_type = 'supplier') as from_supplier,
          COUNT(DISTINCT brand_id) as unique_brands,
          COUNT(DISTINCT category_id) as unique_categories
        FROM products
        WHERE company_id = $1
      `;

      const result = await db.query(query, [companyId]);

      return result.rows[0];

    } catch (error) {
      logger.error('Error in getProductStats:', error);
      throw error;
    }
  }

  /**
   * Поиск товаров по тексту
   */
  async searchProducts(companyId, searchTerm, filters = {}, limit = 20) {
    try {
      const {
        brand_id,
        category_id,
        is_active = true
      } = filters;

      let whereConditions = [
        'p.company_id = $1',
        '(p.name ILIKE $2 OR p.internal_code ILIKE $2 OR p.description ILIKE $2)'
      ];
      let params = [companyId, `%${searchTerm}%`];
      let paramIndex = 3;

      if (brand_id) {
        whereConditions.push(`p.brand_id = $${paramIndex}`);
        params.push(brand_id);
        paramIndex++;
      }

      if (category_id) {
        whereConditions.push(`p.category_id = $${paramIndex}`);
        params.push(category_id);
        paramIndex++;
      }

      if (is_active !== null) {
        whereConditions.push(`p.is_active = $${paramIndex}`);
        params.push(is_active);
        paramIndex++;
      }

      params.push(limit);

      const query = `
        SELECT
          p.id, p.internal_code, p.name, p.description,
          p.weight, p.length, p.width, p.height,
          b.name as brand_name,
          c.name as category_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY
          CASE
            WHEN p.name ILIKE $2 THEN 1
            WHEN p.internal_code ILIKE $2 THEN 2
            ELSE 3
          END,
          p.popularity_score DESC,
          p.name ASC
        LIMIT $${paramIndex}
      `;

      const result = await db.query(query, params);

      return result.rows;

    } catch (error) {
      logger.error('Error in searchProducts:', error);
      throw error;
    }
  }
}

module.exports = PIMService;