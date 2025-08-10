const db = require('../config/database');

class MarketplaceMappingService {
  static async suggestBrand(companyId, marketplaceId, externalBrandName) {
    const normalized = String(externalBrandName || '').trim().toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' ');
    if (!normalized) return { suggestions: [] };

    // 1) По синонимам
    const direct = await db.query(`
      SELECT b.id as brand_id, b.name as brand_name
      FROM marketplace_brand_mappings mbm
      JOIN brands b ON mbm.brand_id = b.id
      WHERE mbm.company_id = $1 AND mbm.marketplace_id = $2 AND lower(mbm.external_brand_name) = $3 AND mbm.is_active = true
      LIMIT 10
    `, [companyId, marketplaceId, normalized]);
    if (direct.rows.length > 0) {
      return { suggestions: direct.rows.map(r => ({ brand_id: r.brand_id, brand_name: r.brand_name, via: 'mapping' })) };
    }

    // 2) По брендам
    const brands = await db.query(`
      SELECT id as brand_id, name as brand_name
      FROM brands
      WHERE is_active = true AND (
        lower(name) = $1 OR name ILIKE $2
      )
      ORDER BY (lower(name) = $1) DESC, name ASC
      LIMIT 10
    `, [normalized, `%${externalBrandName}%`]);

    return { suggestions: brands.rows.map(r => ({ brand_id: r.brand_id, brand_name: r.brand_name, via: 'brand' })) };
  }

  static async confirmBrandSynonym(clientOrDb, companyId, marketplaceId, brandId, externalBrandName, options = {}) {
    const sql = clientOrDb.query ? clientOrDb : db;
    await sql.query(`
      INSERT INTO marketplace_brand_mappings (
        company_id, marketplace_id, brand_id, external_brand_name,
        external_brand_code, mapping_settings, sync_enabled, is_active,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
      ON CONFLICT (company_id, marketplace_id, brand_id, external_brand_name)
      DO UPDATE SET
        external_brand_code = COALESCE(EXCLUDED.external_brand_code, marketplace_brand_mappings.external_brand_code),
        mapping_settings = COALESCE(EXCLUDED.mapping_settings, marketplace_brand_mappings.mapping_settings),
        sync_enabled = COALESCE(EXCLUDED.sync_enabled, marketplace_brand_mappings.sync_enabled),
        is_active = true,
        updated_at = NOW()
    `, [
      companyId, marketplaceId, brandId, externalBrandName,
      options.external_brand_code || null,
      JSON.stringify(options.settings || {}),
      options.syncEnabled !== false
    ]);
  }

  static async upsertCategoryMapping(companyId, marketplaceId, externalCategory, internalCategoryId, options = {}) {
    await db.query(`
      INSERT INTO marketplace_category_mappings (
        company_id, marketplace_id, external_category_id, external_category_name, external_category_path, internal_category_id, is_auto_mapped, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
      ON CONFLICT (company_id, marketplace_id, external_category_id)
      DO UPDATE SET
        external_category_name = EXCLUDED.external_category_name,
        external_category_path = EXCLUDED.external_category_path,
        internal_category_id = EXCLUDED.internal_category_id,
        is_auto_mapped = EXCLUDED.is_auto_mapped,
        is_active = true,
        updated_at = NOW()
    `, [
      companyId, marketplaceId,
      String(externalCategory.id || externalCategory.external_id || externalCategory.code || ''),
      externalCategory.name || null,
      externalCategory.path || null,
      internalCategoryId,
      options.is_auto_mapped || false
    ]);
  }

  static async autoMapAttributes(companyId, marketplaceId, attributes) {
    const mapped = {};
    for (const [key, value] of Object.entries(attributes || {})) {
      const res = await db.query(`
        SELECT * FROM marketplace_attribute_mappings
        WHERE company_id = $1 AND marketplace_id = $2 AND external_key = $3 AND is_active = true
        LIMIT 1
      `, [companyId, marketplaceId, key]);
      if (res.rows.length > 0) {
        mapped[res.rows[0].internal_name] = { value, original_key: key };
        continue;
      }
      // Простая эвристика: искать похожие по имени
      const similar = await db.query(`
        SELECT name FROM product_attributes
        WHERE company_id = $1 AND (name ILIKE $2 OR display_name ILIKE $2) AND is_active = true
        LIMIT 1
      `, [companyId, `%${key}%`]);
      if (similar.rows.length > 0) {
        await db.query(`
          INSERT INTO marketplace_attribute_mappings (
            company_id, marketplace_id, external_key, internal_name, conversion_rules, is_auto_mapped, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, true, true, NOW(), NOW())
          ON CONFLICT (company_id, marketplace_id, external_key)
          DO UPDATE SET internal_name = EXCLUDED.internal_name, conversion_rules = EXCLUDED.conversion_rules, is_auto_mapped = true, is_active = true, updated_at = NOW()
        `, [companyId, marketplaceId, key, similar.rows[0].name, null]);
        mapped[similar.rows[0].name] = { value, original_key: key, auto_mapped: true };
      } else {
        mapped[`unknown_${key}`] = { value, original_key: key, unmapped: true };
      }
    }
    return mapped;
  }
}

module.exports = MarketplaceMappingService;


