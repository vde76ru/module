// backend/src/services/PIMService.js
const { ProductModel } = require('../models');
const logger = require('../utils/logger');
const NormalizationService = require('./NormalizationService');
const db = require('../config/database');
const cryptoUtils = require('../utils/crypto');

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

      // Используем модель для получения данных
      const products = await ProductModel.findAll(companyId, {
        source_type,
        brand_id,
        category_id,
        is_active,
        search,
        low_stock,
        limit,
        offset
      });

      // Подтягиваем главное изображение для списка одним запросом
      const productIds = products.map(p => p.id);
      let imagesMap = new Map();
      if (productIds.length > 0) {
        const imgRes = await db.query(
          `SELECT DISTINCT ON (product_id) id, product_id, image_url, is_main, sort_order
           FROM product_images
           WHERE product_id = ANY($1)
           ORDER BY product_id, is_main DESC, sort_order ASC, created_at ASC`,
          [productIds]
        );
        const siteBase = process.env.SITE_BASE_URL || 'https://moduletrade.ru';
        for (const row of imgRes.rows) {
          const token = cryptoUtils.encrypt(JSON.stringify({ u: row.image_url, p: row.product_id, i: row.id }));
          imagesMap.set(row.product_id, {
            image_id: row.id,
            image_url: row.image_url,
            proxy_url: `${siteBase}/api/images/proxy/${encodeURIComponent(token)}`
          });
        }
      }

      const productsWithImage = products.map(p => ({
        ...p,
        image_url: imagesMap.get(p.id)?.proxy_url || null,
        image_id: imagesMap.get(p.id)?.image_id || null
      }));

      // Подсчет общего количества записей
      const countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        WHERE p.company_id = $1
      `;
      const countResult = await db.query(countQuery, [companyId]);
      const total = parseInt(countResult.rows[0].total);

      return {
        data: productsWithImage,
        pagination: {
          total,
          page,
          limit,
          offset,
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
  async getProductById(companyId, productId) {
    try {
      const product = await ProductModel.findById(companyId, productId);

      if (!product) {
        return null;
      }

      // Получаем изображения и формируем прокси-ссылки
      const imgRes = await db.query(
        `SELECT id, image_url, alt_text, sort_order, is_main, is_active
         FROM product_images
         WHERE product_id = $1
         ORDER BY is_main DESC, sort_order ASC, created_at ASC`,
        [productId]
      );
      const siteBase = process.env.SITE_BASE_URL || 'https://moduletrade.ru';
      product.images = imgRes.rows.map(row => {
        const token = cryptoUtils.encrypt(JSON.stringify({ u: row.image_url, p: productId, i: row.id }));
        return {
          ...row,
          proxy_url: `${siteBase}/api/images/proxy/${encodeURIComponent(token)}`
        };
      });

      // Получаем поставщиков товара
      const suppliersQuery = `
        SELECT
          ps.id, ps.supplier_code, ps.original_price, ps.mrc_price, ps.enforce_mrc,
          ps.quantity, ps.is_available, ps.last_sync_at, ps.currency,
          s.id as supplier_id, s.name as supplier_name
        FROM product_suppliers ps
        JOIN suppliers s ON ps.supplier_id = s.id
        WHERE ps.product_id = $1
        ORDER BY ps.original_price ASC
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

      const product = await ProductModel.create(companyId, normalizedData);

      logger.info(`Product created: ${product.id} by user ${userId}`);

      return product;

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

      const product = await ProductModel.update(companyId, productId, normalizedData);

      if (!product) {
        throw new Error('Product not found');
      }

      logger.info(`Product updated: ${productId} by user ${userId}`);

      return product;

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