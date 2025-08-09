// Models index file
const db = require('../config/database');

// Модели для работы с базой данных
class ProductModel {
  static async findById(companyId, productId) {
    // Базовые поля (всегда должны быть)
    const baseFields = [
      'p.id', 'p.internal_code', 'p.name', 'p.description', 
      'p.brand_id', 'p.category_id', 'p.attributes', 'p.source_type', 'p.is_active',
      'p.main_supplier_id', 'p.base_unit', 'p.is_divisible', 'p.min_order_quantity',
      'p.weight', 'p.length', 'p.width', 'p.height', 'p.volume', 'p.dimensions',
      'p.popularity_score', 'p.status', 'p.is_visible', 'p.created_at', 'p.updated_at'
    ];
    
    // Дополнительные поля (могут отсутствовать в ранних миграциях)
    const optionalFields = [
      'p.short_description', 'p.sku', 'p.barcode', 'p.slug', 'p.external_id',
      'p.external_data', 'p.last_sync', 'p.meta_title', 'p.meta_description', 'p.meta_keywords'
    ];
    
    // Проверяем существование дополнительных полей
    const checkFieldsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND table_schema = 'public'
    `;
    const checkResult = await db.query(checkFieldsQuery);
    const existingColumns = checkResult.rows.map(row => row.column_name);
    
    // Используем только существующие поля
    const fieldsToSelect = [
      ...baseFields,
      ...optionalFields.filter(field => {
        const fieldName = field.split('.')[1];
        return existingColumns.includes(fieldName);
      })
    ];

    const query = `
      SELECT ${fieldsToSelect.join(', ')},
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
    const product = result.rows[0];

    if (!product) return null;

    // Подтягиваем изображения и создаем прокси ссылки
    const imagesRes = await db.query(
      `SELECT id, image_url, alt_text, sort_order, is_main, is_active
       FROM product_images
       WHERE product_id = $1
       ORDER BY is_main DESC, sort_order ASC, created_at ASC`,
      [productId]
    );

    product.images = imagesRes.rows;
    return product;
  }

  static async findAll(companyId, filters = {}) {
    const {
      source_type,
      brand_id,
      category_id,
      is_active,
      search,
      low_stock,
      limit = 50,
      offset = 0
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

    // Проверяем существование дополнительных полей
    const checkFieldsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND table_schema = 'public'
    `;
    const checkResult = await db.query(checkFieldsQuery);
    const existingColumns = checkResult.rows.map(row => row.column_name);
    
    // Базовые поля (всегда должны быть)
    const baseFields = [
      'p.id', 'p.internal_code', 'p.name', 'p.description', 
      'p.brand_id', 'p.category_id', 'p.attributes', 'p.source_type', 'p.is_active',
      'p.main_supplier_id', 'p.base_unit', 'p.is_divisible', 'p.min_order_quantity',
      'p.weight', 'p.length', 'p.width', 'p.height', 'p.volume', 'p.dimensions',
      'p.popularity_score', 'p.status', 'p.is_visible', 'p.created_at', 'p.updated_at'
    ];
    
    // Дополнительные поля (могут отсутствовать в ранних миграциях)
    const optionalFields = [
      'p.short_description', 'p.sku', 'p.barcode', 'p.slug', 'p.external_id',
      'p.external_data', 'p.last_sync', 'p.meta_title', 'p.meta_description', 'p.meta_keywords'
    ];
    
    // Используем только существующие поля
    const fieldsToSelect = [
      ...baseFields,
      ...optionalFields.filter(field => {
        const fieldName = field.split('.')[1];
        return existingColumns.includes(fieldName);
      })
    ];

    const query = `
      SELECT ${fieldsToSelect.join(', ')},
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
    return result.rows;
  }

  static async create(companyId, productData) {
    const {
      internal_code, name, description, brand_id, category_id,
      attributes, source_type, main_supplier_id, base_unit,
      is_divisible, min_order_quantity, weight, length, width,
      height, volume, dimensions, is_active = true
    } = productData;

    const query = `
      INSERT INTO products (
        company_id, internal_code, name, description, brand_id, category_id,
        attributes, source_type, main_supplier_id, base_unit, is_divisible,
        min_order_quantity, weight, length, width, height, volume, dimensions, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;

    const values = [
      companyId, internal_code, name, description, brand_id, category_id,
      attributes, source_type, main_supplier_id, base_unit, is_divisible,
      min_order_quantity, weight, length, width, height, volume, dimensions, is_active
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async update(companyId, productId, updateData) {
    const fields = [];
    const values = [companyId, productId];
    let paramIndex = 3;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(updateData[key]);
        paramIndex++;
      }
    });

    if (fields.length === 0) return null;

    fields.push('updated_at = NOW()');

    const query = `
      UPDATE products
      SET ${fields.join(', ')}
      WHERE company_id = $1 AND id = $2
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async delete(companyId, productId) {
    const query = 'DELETE FROM products WHERE company_id = $1 AND id = $2 RETURNING *';
    const result = await db.query(query, [companyId, productId]);
    return result.rows[0];
  }
}

class SyncLogModel {
  static async create(companyId, syncData) {
    const {
      marketplace_id, sync_id, sync_type, status = 'pending',
      details = {}, metadata = {}, started_at = new Date()
    } = syncData;

    const query = `
      INSERT INTO sync_logs (
        company_id, marketplace_id, sync_id, sync_type, status,
        details, metadata, started_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await db.query(query, [
      companyId, marketplace_id, sync_id, sync_type, status,
      details, metadata, started_at
    ]);
    return result.rows[0];
  }

  static async update(id, updateData) {
    const fields = [];
    const values = [id];
    let paramIndex = 2;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(updateData[key]);
        paramIndex++;
      }
    });

    if (fields.length === 0) return null;

    const query = `
      UPDATE sync_logs
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByCompany(companyId, filters = {}) {
    const { sync_type, status, limit = 50, offset = 0 } = filters;

    let whereConditions = ['company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (sync_type) {
      whereConditions.push(`sync_type = $${paramIndex}`);
      params.push(sync_type);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM sync_logs
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await db.query(query, params);
    return result.rows;
  }
}

class ApiLogModel {
  static async create(logData) {
    const {
      company_id, user_id, endpoint, method, status = 'success',
      response_code, response_time_ms, request_body, response_body,
      error_message, ip_address, user_agent, request_id, metadata = {}
    } = logData;

    const query = `
      INSERT INTO api_logs (
        company_id, user_id, endpoint, method, status,
        response_code, response_time_ms, request_body, response_body,
        error_message, ip_address, user_agent, request_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const result = await db.query(query, [
      company_id, user_id, endpoint, method, status,
      response_code, response_time_ms, request_body, response_body,
      error_message, ip_address, user_agent, request_id, metadata
    ]);
    return result.rows[0];
  }

  static async findByCompany(companyId, filters = {}) {
    const { endpoint, method, status, limit = 50, offset = 0 } = filters;

    let whereConditions = ['company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (endpoint) {
      whereConditions.push(`endpoint = $${paramIndex}`);
      params.push(endpoint);
      paramIndex++;
    }

    if (method) {
      whereConditions.push(`method = $${paramIndex}`);
      params.push(method);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM api_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await db.query(query, params);
    return result.rows;
  }
}

class MarketplaceModel {
  static async findAll() {
    const query = 'SELECT * FROM marketplaces WHERE is_public = true ORDER BY name';
    const result = await db.query(query);
    return result.rows;
  }

  static async findByCode(code) {
    const query = 'SELECT * FROM marketplaces WHERE code = $1';
    const result = await db.query(query, [code]);
    return result.rows[0];
  }

  static async create(marketplaceData) {
    const { code, name, api_type, api_config = {}, commission_rules = {} } = marketplaceData;

    const query = `
      INSERT INTO marketplaces (code, name, api_type, api_config, commission_rules)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query(query, [code, name, api_type, api_config, commission_rules]);
    return result.rows[0];
  }
}

module.exports = {
  ProductModel,
  SyncLogModel,
  ApiLogModel,
  MarketplaceModel
};
