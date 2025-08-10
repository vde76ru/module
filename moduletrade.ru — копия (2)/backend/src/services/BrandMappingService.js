const db = require('../config/database');

class BrandMappingService {
  static async normalizeCandidate(name) {
    if (!name) return null;
    return String(name)
      .trim()
      .replace(/[\s\-_.]+/g, ' ')
      .replace(/[()]/g, '')
      .toLowerCase();
  }

  // Предложить канонический бренд и синонимы по входному названию
  static async suggest(companyId, supplierId, externalBrandName) {
    const normalized = await this.normalizeCandidate(externalBrandName);
    if (!normalized) return { suggestions: [] };

    // 1) Прямые совпадения в brand_supplier_mappings по external_brand_name
    const direct = await db.query(
      `SELECT b.id as brand_id, b.name as brand_name, bsm.external_brand_name
       FROM brand_supplier_mappings bsm
       JOIN brands b ON bsm.brand_id = b.id
       WHERE bsm.company_id = $1 AND bsm.supplier_id = $2
         AND lower(regexp_replace(coalesce(bsm.external_brand_name,''),'[\s\-_.]+',' ','g')) = $3
         AND bsm.is_active = true
       LIMIT 10`,
      [companyId, supplierId, normalized]
    );
    if (direct.rows.length > 0) {
      return { suggestions: direct.rows.map(r => ({ brand_id: r.brand_id, brand_name: r.brand_name, via: 'mapping' })) };
    }

    // 2) Совпадение по брендам: exact/ILIKE
    const brands = await db.query(
      `SELECT id as brand_id, name as brand_name
       FROM brands
       WHERE company_id = $1 AND is_active = true
         AND (
           lower(name) = $2 OR name ILIKE $3
         )
       ORDER BY (lower(name) = $2) DESC, name ASC
       LIMIT 10`,
      [companyId, normalized, `%${externalBrandName}%`]
    );

    return { suggestions: brands.rows.map(r => ({ brand_id: r.brand_id, brand_name: r.brand_name, via: 'brand' })) };
  }

  // Добавить синоним (внешнее имя) к бренду поставщика
  static async addSynonym(clientOrDb, companyId, supplierId, brandId, externalBrandName, options = {}) {
    const sql = clientOrDb.query ? clientOrDb : db;
    await sql.query(
      `INSERT INTO brand_supplier_mappings (
         company_id, supplier_id, brand_id, external_brand_name,
         mapping_settings, sync_enabled, is_active, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (company_id, supplier_id, brand_id, external_brand_name)
       DO UPDATE SET
         mapping_settings = COALESCE(EXCLUDED.mapping_settings, brand_supplier_mappings.mapping_settings),
         sync_enabled = COALESCE(EXCLUDED.sync_enabled, brand_supplier_mappings.sync_enabled),
         is_active = true,
         updated_at = NOW()`,
      [
        companyId,
        supplierId,
        brandId,
        externalBrandName,
        JSON.stringify(options.settings || {}),
        options.syncEnabled !== false
      ]
    );
  }
}

module.exports = BrandMappingService;


