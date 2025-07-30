// backend/src/services/PIMService.js
const db = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class PIMService {
  /**
   * Получение всех товаров с фильтрацией
   */
  async getAllProducts(tenantId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        page = 1,
        search = '',
        source_type = 'all',
        low_stock = false,
        category_id = null,
        brand_id = null,
        is_active = null
      } = options;

      // Вычисляем offset если передана страница
      const actualOffset = page > 1 ? (page - 1) * limit : offset;

      let whereConditions = ['p.tenant_id = $1'];
      const queryParams = [tenantId];
      let paramIndex = 2;

      // Поиск по названию или артикулу
      if (search) {
        whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.internal_code ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Фильтр по типу источника
      if (source_type && source_type !== 'all') {
        whereConditions.push(`p.source_type = $${paramIndex}`);
        queryParams.push(source_type);
        paramIndex++;
      }

      // Фильтр по категории
      if (category_id) {
        whereConditions.push(`p.category_id = $${paramIndex}`);
        queryParams.push(category_id);
        paramIndex++;
      }

      // Фильтр по бренду
      if (brand_id) {
        whereConditions.push(`p.brand_id = $${paramIndex}`);
        queryParams.push(brand_id);
        paramIndex++;
      }

      // Фильтр по активности
      if (is_active !== null) {
        whereConditions.push(`p.is_active = $${paramIndex}`);
        queryParams.push(is_active);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Основной запрос
      let query = `
        SELECT
          p.id,
          p.internal_code,
          p.name,
          p.description,
          p.source_type,
          p.is_active,
          p.created_at,
          p.updated_at,
          b.canonical_name as brand_name,
          c.canonical_name as category_name,
          s.name as main_supplier_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.main_supplier_id = s.id
        WHERE ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, actualOffset);

      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
      const result = await db.query(query, queryParams);

      // Подсчет общего количества
      const countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${whereClause}
      `;

      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
      const countResult = await db.query(countQuery, queryParams.slice(0, -2));
      const total = parseInt(countResult.rows[0].total);

      return {
        data: result.rows,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
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
  async getProductById(tenantId, productId) {
    try {
      const query = `
        SELECT
          p.*,
          b.canonical_name as brand_name,
          c.canonical_name as category_name,
          s.name as main_supplier_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.main_supplier_id = s.id
        WHERE p.id = $1 AND p.tenant_id = $2
      `;

      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
      const result = await db.query(query, [productId, tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      const product = result.rows[0];

      // Получаем информацию о поставщиках
      const suppliersQuery = `
        SELECT
          ps.*,
          s.name as supplier_name
        FROM product_suppliers ps
        JOIN suppliers s ON ps.supplier_id = s.id
        WHERE ps.product_id = $1
        ORDER BY ps.price ASC
      `;

      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
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
   */
  async createProduct(tenantId, productData, userId) {
    try {
      const {
        internal_code,
        name,
        description,
        brand_id,
        category_id,
        attributes = {},
        source_type = 'manual',
        main_supplier_id
      } = productData;

      const query = `
        INSERT INTO products (
          tenant_id, internal_code, name, description,
          brand_id, category_id, attributes, source_type, main_supplier_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
      const result = await db.query(query, [
        tenantId,
        internal_code,
        name,
        description || null,
        brand_id || null,
        category_id || null,
        JSON.stringify(attributes),
        source_type,
        main_supplier_id || null
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
   */
  async updateProduct(tenantId, productId, updateData, userId) {
    try {
      const allowedFields = [
        'name', 'description', 'brand_id', 'category_id', 
        'attributes', 'is_active', 'main_supplier_id'
      ];

      const updates = [];
      const values = [tenantId, productId];
      let paramIndex = 3;

      for (const [key, value] of Object.entries(updateData)) {
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
        WHERE tenant_id = $1 AND id = $2
        RETURNING *
      `;

      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
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
   * Массовое обновление товаров
   */
  async bulkUpdateProducts(tenantId, productIds, updateData, userId) {
    try {
      const allowedFields = ['is_active', 'brand_id', 'category_id'];
      const updates = [];
      const values = [tenantId];
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
        WHERE tenant_id = $1 AND id IN (${placeholders})
        RETURNING id, name
      `;

      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
      const result = await db.query(query, values);

      logger.info(`Bulk updated ${result.rows.length} products by user ${userId}`);

      return result.rows;

    } catch (error) {
      logger.error('Error in bulkUpdateProducts:', error);
      throw error;
    }
  }

  /**
   * Поиск товаров
   */
  async searchProducts(tenantId, searchTerm, options = {}) {
    try {
      const { limit = 20 } = options;

      const query = `
        SELECT
          p.id,
          p.internal_code,
          p.name,
          p.source_type,
          b.canonical_name as brand_name,
          c.canonical_name as category_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.tenant_id = $1
          AND p.is_active = true
          AND (
            p.name ILIKE $2
            OR p.internal_code ILIKE $2
            OR b.canonical_name ILIKE $2
          )
        ORDER BY
          CASE
            WHEN p.internal_code ILIKE $2 THEN 1
            WHEN p.name ILIKE $3 THEN 2
            ELSE 3
          END,
          p.name
        LIMIT $4
      `;

      // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
      const result = await db.query(query, [
        tenantId,
        `%${searchTerm}%`,
        `${searchTerm}%`, // Для приоритета результатов, начинающихся с поискового запроса
        limit
      ]);

      return result.rows;

    } catch (error) {
      logger.error('Error in searchProducts:', error);
      throw error;
    }
  }
}

module.exports = PIMService;