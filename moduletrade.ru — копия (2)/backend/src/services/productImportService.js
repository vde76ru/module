const db = require('../config/database');
const logger = require('../utils/logger');
const supplierFactory = require('../adapters/SupplierFactory');
const AttributeMappingService = require('../services/attributeMappingService');
const PIMService = require('../services/PIMService');

/**
 * Сервис импорта товаров от поставщиков
 */
class ProductImportService {
  static async importProductsByBrands(companyId, supplierId, brandIds = [], options = {}) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Получаем инфо о поставщике
      const supplierRes = await client.query(
        'SELECT id, api_type, api_config, is_active FROM suppliers WHERE id = $1 AND is_active = true',
        [supplierId]
      );
      if (supplierRes.rows.length === 0) {
        throw new Error('Supplier not found or inactive');
      }
      let apiConfig = supplierRes.rows[0].api_config;
      try {
        const cryptoUtils = require('../utils/crypto');
        if (typeof apiConfig === 'string' && cryptoUtils.isEncrypted(apiConfig)) {
          apiConfig = cryptoUtils.decrypt(apiConfig);
        }
      } catch (_) {}

      // Получаем названия брендов
      const brandsRes = await client.query(
        'SELECT id, name FROM brands WHERE id = ANY($1)',
        [brandIds]
      );
      const brandNames = brandsRes.rows.map((b) => b.name);

      // Создаем адаптер
      const adapter = supplierFactory.createAdapter(supplierRes.rows[0].api_type, apiConfig || {});

      // Синхронизация
      const syncResult = await adapter.syncProducts({ brands: brandNames, updateExisting: options.forceUpdate });

      if (!syncResult.success || !Array.isArray(syncResult.products) || syncResult.products.length === 0) {
        await client.query('COMMIT');
        return { imported: 0, updated: 0, errors: [], options };
      }

      let imported = 0;
      let updated = 0;
      const errors = [];

      // Сохраняем товары (упрощенно: по SKU и externalId)
      for (const p of syncResult.products) {
        try {
          // Найдем бренд из переданных
          const brandRow = brandsRes.rows.find((b) => b.name === p.brand);
          const brandId = brandRow ? brandRow.id : null;

          // Попытка найти товар
          const existingRes = await client.query(
            `SELECT id FROM products WHERE company_id = $1 AND (sku = $2 OR external_id = $3) LIMIT 1`,
            [companyId, p.sku, p.externalId]
          );

          const attributes = p.attributes || {};
          const images = p.images || [];

          if (existingRes.rows.length === 0) {
            // Создаем
            const insertRes = await client.query(
              `INSERT INTO products (
                company_id, name, sku, barcode, brand_id, description, attributes, external_id, source_type, is_active
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'supplier', true) RETURNING id`,
              [companyId, p.name, p.sku, p.barcode || null, brandId, p.description || '', attributes, p.externalId]
            );
            const productId = insertRes.rows[0].id;

            // изображения
            for (let i = 0; i < images.length; i++) {
              const url = typeof images[i] === 'string' ? images[i] : images[i]?.url;
              if (!url) continue;
              await client.query(
                `INSERT INTO product_images (product_id, image_url, is_main, sort_order) VALUES ($1, $2, $3, $4)`,
                [productId, url, i === 0, i]
              );
            }

            // цена (supplier)
            if (p.price) {
              await client.query(
                `INSERT INTO prices (product_id, price_type, value, currency, is_active) VALUES ($1, 'supplier', $2, 'RUB', true)
                 ON CONFLICT (product_id, price_type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [productId, p.price]
              );
            }

            imported++;
          } else {
            const productId = existingRes.rows[0].id;
            await client.query(
              `UPDATE products SET name = $2, description = $3, attributes = $4, updated_at = NOW() WHERE id = $1`,
              [productId, p.name, p.description || '', attributes]
            );

            // цена
            if (p.price) {
              await client.query(
                `INSERT INTO prices (product_id, price_type, value, currency, is_active) VALUES ($1, 'supplier', $2, 'RUB', true)
                 ON CONFLICT (product_id, price_type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [productId, p.price]
              );
            }
            updated++;
          }
        } catch (e) {
          logger.error('Product import error:', e);
          errors.push({ sku: p.sku, error: e.message });
        }
      }

      await client.query('COMMIT');
      return { imported, updated, errors, options };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Import failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Обновление цен для уже существующих товаров от поставщика (без импорта новых)
  static async syncPricesFromSupplier(companyId, supplierId, productIds = []) {
    const client = await db.getClient();
    try {
      // Получаем конфиг поставщика
      const supplierRes = await client.query('SELECT api_type, api_config FROM suppliers WHERE id = $1', [supplierId]);
      if (supplierRes.rows.length === 0) return { synced: 0 };
      let apiConfig = supplierRes.rows[0].api_config;
      try {
        const cryptoUtils = require('../utils/crypto');
        if (typeof apiConfig === 'string' && cryptoUtils.isEncrypted(apiConfig)) apiConfig = cryptoUtils.decrypt(apiConfig);
      } catch (_) {}
      const adapter = supplierFactory.createAdapter(supplierRes.rows[0].api_type, apiConfig || {});

      // Выбираем список существующих продуктов для обновления
      let codes = [];
      if (productIds.length > 0) {
        const res = await client.query(`SELECT external_id FROM products WHERE company_id = $1 AND id = ANY($2) AND external_id IS NOT NULL`, [companyId, productIds]);
        codes = res.rows.map((r) => r.external_id);
      } else {
        const res = await client.query(
          `SELECT external_id FROM products WHERE company_id = $1 AND main_supplier_id = $2 AND external_id IS NOT NULL LIMIT 5000`,
          [companyId, supplierId]
        );
        codes = res.rows.map((r) => r.external_id);
      }
      if (codes.length === 0) return { synced: 0 };

      const prices = await adapter.getPrices(codes);
      let updated = 0;
      for (const p of prices) {
        await client.query(
          `UPDATE prices SET value = $2, updated_at = NOW() WHERE product_id IN (SELECT id FROM products WHERE company_id = $3 AND external_id = $1) AND price_type = 'supplier'`,
          [p.productId, p.price, companyId]
        );
        updated++;
      }
      return { synced: updated };
    } finally {
      client.release();
    }
  }

  // Обновление остатков для уже существующих товаров от поставщика (без импорта новых)
  static async syncStocksFromSupplier(companyId, supplierId, productIds = [], options = {}) {
    const client = await db.getClient();
    try {
      const supplierRes = await client.query('SELECT api_type, api_config, default_warehouse_id FROM suppliers WHERE id = $1', [supplierId]);
      if (supplierRes.rows.length === 0) return { synced: 0 };
      const supplier = supplierRes.rows[0];
      let apiConfig = supplier.api_config;
      try {
        const cryptoUtils = require('../utils/crypto');
        if (typeof apiConfig === 'string' && cryptoUtils.isEncrypted(apiConfig)) apiConfig = cryptoUtils.decrypt(apiConfig);
      } catch (_) {}
      const adapter = supplierFactory.createAdapter(supplier.api_type, apiConfig || {});

      let pairs = [];
      if (productIds.length > 0) {
        const res = await client.query(`SELECT id, external_id FROM products WHERE company_id = $1 AND id = ANY($2) AND external_id IS NOT NULL`, [companyId, productIds]);
        pairs = res.rows;
      } else {
        const res = await client.query(
          `SELECT id, external_id FROM products WHERE company_id = $1 AND main_supplier_id = $2 AND external_id IS NOT NULL LIMIT 5000`,
          [companyId, supplierId]
        );
        pairs = res.rows;
      }
      if (pairs.length === 0) return { synced: 0 };

      const warehouseId = options.warehouseId || supplier.default_warehouse_id;
      let updated = 0;
      for (const chunk of Array.from({ length: Math.ceil(pairs.length / 50) }, (_, i) => pairs.slice(i * 50, i * 50 + 50))) {
        const codes = chunk.map((r) => r.external_id);
        const stocks = await adapter.getStockLevels(codes, warehouseId);
        for (const s of stocks) {
          await client.query(
            `UPDATE warehouse_product_links SET quantity = $3, available_quantity = $3, updated_at = NOW()
             WHERE product_id IN (SELECT id FROM products WHERE company_id = $1 AND external_id = $2)
               AND warehouse_id = $4`,
            [companyId, s.productId, s.available, warehouseId]
          );
          updated++;
        }
      }
      return { synced: updated };
    } finally {
      client.release();
    }
  }
}

module.exports = ProductImportService;