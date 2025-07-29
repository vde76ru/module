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
          p.source_type,
          p.is_active,
          p.base_unit,
          p.popularity_score,
          p.weight,
          p.created_at,
          p.updated_at,
          b.canonical_name as brand_name,
          c.canonical_name as category_name,
          COALESCE(stock.total_stock, 0) as total_stock,
          COALESCE(suppliers.suppliers_count, 0) as suppliers_count,
          COALESCE(suppliers.min_price, 0) as min_price
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN (
          SELECT
            product_id,
            SUM(quantity) as total_stock
          FROM warehouse_product_links
          GROUP BY product_id
        ) stock ON p.id = stock.product_id
        LEFT JOIN (
          SELECT
            product_id,
            COUNT(*) as suppliers_count,
            MIN(normalized_price) as min_price
          FROM product_suppliers
          WHERE quantity > 0
          GROUP BY product_id
        ) suppliers ON p.id = suppliers.product_id
        WHERE ${whereClause}
      `;

      // Добавляем фильтр по низким остаткам
      if (low_stock) {
        query += ` AND COALESCE(stock.total_stock, 0) <= 10`;
      }

      query += ` ORDER BY p.updated_at DESC`;

      // Добавляем LIMIT и OFFSET
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, actualOffset);

      const result = await db.query(tenantId, query, queryParams);

      // Запрос для подсчета общего количества
      let countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN (
          SELECT
            product_id,
            SUM(quantity) as total_stock
          FROM warehouse_product_links
          GROUP BY product_id
        ) stock ON p.id = stock.product_id
        WHERE ${whereClause}
      `;

      if (low_stock) {
        countQuery += ` AND COALESCE(stock.total_stock, 0) <= 10`;
      }

      const countResult = await db.query(tenantId, countQuery, queryParams.slice(0, -2));
      const total = parseInt(countResult.rows[0]?.total || 0);

      return {
        data: result.rows,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(actualOffset),
          page: parseInt(page),
          pages: Math.ceil(total / limit)
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

      const result = await db.query(tenantId, query, [productId, tenantId]);

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
        ORDER BY ps.normalized_price ASC
      `;

      const suppliersResult = await db.query(tenantId, suppliersQuery, [productId]);
      product.suppliers = suppliersResult.rows;

      // Получаем информацию о складских остатках
      const stockQuery = `
        SELECT
          wpl.*,
          w.name as warehouse_name
        FROM warehouse_product_links wpl
        JOIN warehouses w ON wpl.warehouse_id = w.id
        WHERE wpl.product_id = $1
        ORDER BY w.priority DESC
      `;

      const stockResult = await db.query(tenantId, stockQuery, [productId]);
      product.stock = stockResult.rows;

      return product;

    } catch (error) {
      logger.error('Error in getProductById:', error);
      throw error;
    }
  }

  /**
   * Создание нового товара
   */
  async createProduct(tenantId, productData, userId) {
    try {
      const productId = uuidv4();

      // Генерируем internal_code если не передан
      const internalCode = productData.internal_code ||
        `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      const query = `
        INSERT INTO products (
          id, tenant_id, internal_code, name, brand_id, category_id,
          attributes, source_type, base_unit, is_divisible,
          min_order_quantity, weight, volume, dimensions,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *
      `;

      const values = [
        productId,
        tenantId,
        internalCode,
        productData.name,
        productData.brand_id || null,
        productData.category_id || null,
        JSON.stringify(productData.attributes || {}),
        productData.source_type || 'manual',
        productData.base_unit || 'шт',
        productData.is_divisible !== false,
        productData.min_order_quantity || 1,
        productData.weight || null,
        productData.volume || null,
        JSON.stringify(productData.dimensions || {})
      ];

      const result = await db.query(tenantId, query, values);

      logger.info(`Product created: ${productId} by user ${userId}`);

      return result.rows[0];

    } catch (error) {
      logger.error('Error in createProduct:', error);
      throw error;
    }
  }

  /**
   * Обновление товара
   */
  async updateProduct(tenantId, productId, productData, userId) {
    try {
      // Собираем поля для обновления
      const updateFields = [];
      const values = [productId, tenantId];
      let paramIndex = 3;

      if (productData.name !== undefined) {
        updateFields.push(`name = $${paramIndex}`);
        values.push(productData.name);
        paramIndex++;
      }

      if (productData.brand_id !== undefined) {
        updateFields.push(`brand_id = $${paramIndex}`);
        values.push(productData.brand_id);
        paramIndex++;
      }

      if (productData.category_id !== undefined) {
        updateFields.push(`category_id = $${paramIndex}`);
        values.push(productData.category_id);
        paramIndex++;
      }

      if (productData.attributes !== undefined) {
        updateFields.push(`attributes = $${paramIndex}`);
        values.push(JSON.stringify(productData.attributes));
        paramIndex++;
      }

      if (productData.base_unit !== undefined) {
        updateFields.push(`base_unit = $${paramIndex}`);
        values.push(productData.base_unit);
        paramIndex++;
      }

      if (productData.is_divisible !== undefined) {
        updateFields.push(`is_divisible = $${paramIndex}`);
        values.push(productData.is_divisible);
        paramIndex++;
      }

      if (productData.min_order_quantity !== undefined) {
        updateFields.push(`min_order_quantity = $${paramIndex}`);
        values.push(productData.min_order_quantity);
        paramIndex++;
      }

      if (productData.weight !== undefined) {
        updateFields.push(`weight = $${paramIndex}`);
        values.push(productData.weight);
        paramIndex++;
      }

      if (productData.volume !== undefined) {
        updateFields.push(`volume = $${paramIndex}`);
        values.push(productData.volume);
        paramIndex++;
      }

      if (productData.dimensions !== undefined) {
        updateFields.push(`dimensions = $${paramIndex}`);
        values.push(JSON.stringify(productData.dimensions));
        paramIndex++;
      }

      if (productData.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        values.push(productData.is_active);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      const query = `
        UPDATE products SET
          ${updateFields.join(',\n          ')}
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `;

      const result = await db.query(tenantId, query, values);

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
   * Удаление товара
   */
  async deleteProduct(tenantId, productId, userId) {
    try {
      const query = `
        DELETE FROM products
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `;

      const result = await db.query(tenantId, query, [productId, tenantId]);

      if (result.rows.length === 0) {
        throw new Error('Product not found');
      }

      logger.info(`Product deleted: ${productId} by user ${userId}`);

      return result.rows[0];

    } catch (error) {
      logger.error('Error in deleteProduct:', error);
      throw error;
    }
  }

  /**
   * Массовое обновление товаров
   */
  async bulkUpdateProducts(tenantId, productIds, updateData, userId) {
    try {
      const updates = [];
      const values = [tenantId];
      let paramIndex = 2;

      if (updateData.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        values.push(updateData.is_active);
        paramIndex++;
      }

      if (updateData.brand_id !== undefined) {
        updates.push(`brand_id = $${paramIndex}`);
        values.push(updateData.brand_id);
        paramIndex++;
      }

      if (updateData.category_id !== undefined) {
        updates.push(`category_id = $${paramIndex}`);
        values.push(updateData.category_id);
        paramIndex++;
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

      const result = await db.query(tenantId, query, values);

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

      const result = await db.query(tenantId, query, [
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