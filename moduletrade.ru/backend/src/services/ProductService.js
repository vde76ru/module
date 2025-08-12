// backend/src/services/ProductService.js
// Полноценное управление товарами: CRUD, массовые операции, медиа, цены

const db = require('../config/database');
const logger = require('../utils/logger');

class ProductService {
  async createProduct(companyId, payload, userId) {
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
        supplier_data = {}
      } = payload || {};

      if (!name || !internal_code) {
        throw new Error('name and internal_code are required');
      }

      if (internal_code) {
        const dup = await client.query(
          'SELECT 1 FROM products WHERE company_id = $1 AND internal_code = $2',
          [companyId, internal_code]
        );
        if (dup.rows.length > 0) {
          throw new Error('Product with this internal code already exists');
        }
      }

      if (sku) {
        const dup = await client.query(
          'SELECT 1 FROM products WHERE company_id = $1 AND sku = $2',
          [companyId, sku]
        );
        if (dup.rows.length > 0) {
          throw new Error('Product with this SKU already exists');
        }
      }

      let volume = null;
      if (length && width && height) {
        volume = (parseFloat(length) * parseFloat(width) * parseFloat(height)) / 1000000;
      }

      const insert = await client.query(
        `INSERT INTO products (
          company_id, name, description, short_description, internal_code, sku, barcode,
          brand_id, category_id, weight, length, width, height, volume,
          status, is_visible, attributes, meta_title, meta_description,
          meta_keywords, slug, base_unit, is_divisible, min_order_quantity,
          source_type, external_id, external_data, supplier_data,
          created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,NOW(),NOW()
        ) RETURNING *`,
        [
          companyId,
          name,
          description || null,
          short_description || null,
          internal_code,
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
          JSON.stringify(attributes || {}),
          meta_title || null,
          meta_description || null,
          meta_keywords || null,
          slug || null,
          base_unit,
          is_divisible,
          min_order_quantity,
          source_type,
          external_id || null,
          JSON.stringify(external_data || {}),
          JSON.stringify(supplier_data || {})
        ]
      );

      const product = insert.rows[0];

      await client.query('COMMIT');
      return product;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      logger.error('ProductService.createProduct error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProduct(companyId, productId, updates, userId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const exists = await client.query('SELECT * FROM products WHERE id = $1 AND company_id = $2', [productId, companyId]);
      if (exists.rows.length === 0) throw new Error('Product not found');

      if (updates.sku && updates.sku !== exists.rows[0].sku) {
        const dup = await client.query(
          'SELECT 1 FROM products WHERE company_id = $1 AND sku = $2 AND id != $3',
          [companyId, updates.sku, productId]
        );
        if (dup.rows.length > 0) throw new Error('Product with this SKU already exists');
      }

      const fields = [];
      const values = [productId, companyId];
      let idx = 3;
      const apply = (key, val) => { if (val !== undefined) { fields.push(`${key} = $${idx}`); values.push(val); idx++; } };

      apply('name', updates.name);
      apply('description', updates.description);
      apply('short_description', updates.short_description);
      apply('sku', updates.sku);
      apply('barcode', updates.barcode);
      apply('brand_id', updates.brand_id);
      apply('category_id', updates.category_id);
      apply('weight', updates.weight != null ? parseFloat(updates.weight) : undefined);
      apply('length', updates.length != null ? parseFloat(updates.length) : undefined);
      apply('width', updates.width != null ? parseFloat(updates.width) : undefined);
      apply('height', updates.height != null ? parseFloat(updates.height) : undefined);
      apply('status', updates.status);
      apply('is_visible', updates.is_visible);
      apply('attributes', updates.attributes ? JSON.stringify(updates.attributes) : undefined);
      apply('meta_title', updates.meta_title);
      apply('meta_description', updates.meta_description);
      apply('meta_keywords', updates.meta_keywords);
      apply('slug', updates.slug);
      apply('base_unit', updates.base_unit);
      apply('is_divisible', updates.is_divisible);
      apply('min_order_quantity', updates.min_order_quantity);
      apply('external_id', updates.external_id);
      apply('external_data', updates.external_data ? JSON.stringify(updates.external_data) : undefined);
      apply('supplier_data', updates.supplier_data ? JSON.stringify(updates.supplier_data) : undefined);

      if (updates.length && updates.width && updates.height) {
        const volume = (parseFloat(updates.length) * parseFloat(updates.width) * parseFloat(updates.height)) / 1000000;
        apply('volume', volume);
      }

      if (fields.length === 0) {
        await client.query('ROLLBACK');
        return exists.rows[0];
      }

      const sql = `UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 AND company_id = $2 RETURNING *`;
      const result = await client.query(sql, values);
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      logger.error('ProductService.updateProduct error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProduct(companyId, productId, soft = true) {
    if (soft) {
      const res = await db.query('UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2 RETURNING id', [productId, companyId]);
      if (res.rows.length === 0) throw new Error('Product not found');
      return { id: res.rows[0].id, softDeleted: true };
    }
    const res = await db.query('DELETE FROM products WHERE id = $1 AND company_id = $2 RETURNING id', [productId, companyId]);
    if (res.rows.length === 0) throw new Error('Product not found');
    return { id: res.rows[0].id };
  }

  async bulkUpdate(companyId, productIds, updates, userId) {
    if (!Array.isArray(productIds) || productIds.length === 0) return [];
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const placeholders = productIds.map((_, i) => `$${i + 3}`).join(',');
      const fields = [];
      const values = [companyId, userId];
      const add = (key, value) => { if (value !== undefined) { fields.push(`${key} = $${values.length + 3}`); values.push(value); } };
      add('status', updates.status);
      add('is_visible', updates.is_visible);
      add('category_id', updates.category_id);
      add('brand_id', updates.brand_id);
      add('attributes', updates.attributes ? JSON.stringify(updates.attributes) : undefined);
      if (fields.length === 0) {
        await client.query('ROLLBACK');
        return [];
      }
      const sql = `UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE company_id = $1 AND id IN (${placeholders}) RETURNING id`;
      const result = await client.query(sql, [companyId, userId, ...productIds, ...values.slice(2)]);
      await client.query('COMMIT');
      return result.rows.map(r => r.id);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      logger.error('ProductService.bulkUpdate error:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = ProductService;


