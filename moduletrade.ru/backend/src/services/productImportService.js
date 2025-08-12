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

      // Сохраняем товары (по SKU и externalId), создаем маппинги и связи с поставщиком, обновляем складские остатки
      async function ensureSupplierWarehouse(client, companyId, supplierId, externalWarehouseId, name) {
        if (!externalWarehouseId) return null;
        const code = `rs24_${externalWarehouseId}`;
        const existing = await client.query(
          `SELECT id FROM warehouses WHERE company_id = $1 AND code = $2 LIMIT 1`,
          [companyId, code]
        );
        if (existing.rows.length > 0) return existing.rows[0].id;
        const insert = await client.query(
          `INSERT INTO warehouses (company_id, name, code, type, description, settings, is_active)
           VALUES ($1, $2, $3, 'warehouse', $4, $5, true) RETURNING id`,
          [companyId, `RS24 - ${name || externalWarehouseId}`, code, 'Virtual warehouse for RS24', { supplier_id: supplierId, external_warehouse_id: String(externalWarehouseId) }]
        );
        return insert.rows[0].id;
      }

      async function upsertProductSupplier(client, companyId, productId, supplierId, payload) {
        // Try update first
        const upd = await client.query(
          `UPDATE product_suppliers SET
             external_product_id = COALESCE($4, external_product_id),
             original_price = COALESCE($5, original_price),
             currency = COALESCE($6, currency),
             mrc_price = COALESCE($7, mrc_price),
             enforce_mrc = COALESCE($8, enforce_mrc),
             is_available = COALESCE($9, is_available),
             stock_quantity = COALESCE($10, stock_quantity),
             last_updated = NOW()
           WHERE company_id = $1 AND product_id = $2 AND supplier_id = $3`,
          [companyId, productId, supplierId, payload.external_product_id, payload.original_price, payload.currency || 'RUB', payload.mrc_price, payload.enforce_mrc, payload.is_available, payload.stock_quantity]
        );
        if (upd.rowCount > 0) return;
        await client.query(
          `INSERT INTO product_suppliers (company_id, product_id, supplier_id, external_product_id, original_price, currency, mrc_price, enforce_mrc, is_available, stock_quantity, last_updated)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          [companyId, productId, supplierId, payload.external_product_id, payload.original_price || 0, payload.currency || 'RUB', payload.mrc_price || null, payload.enforce_mrc || false, payload.is_available !== false, payload.stock_quantity || 0]
        );
      }

      async function upsertProductMapping(client, companyId, productId, supplierId, externalId, sku, name) {
        // Try update
        const upd = await client.query(
          `UPDATE product_mappings SET external_sku = $6, external_name = $7, last_sync = NOW()
           WHERE company_id = $1 AND product_id = $2 AND system_id = $3 AND external_id = $4`,
          [companyId, productId, supplierId, String(externalId), sku || null, name || null]
        );
        if (upd.rowCount > 0) return;
        // On conflict unique (system_id, external_id) requires product_id to match; we insert and rely on unique to avoid dup by different product
        try {
          await client.query(
            `INSERT INTO product_mappings (company_id, product_id, system_id, external_id, external_sku, external_name, last_sync)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (system_id, external_id)
             DO UPDATE SET product_id = EXCLUDED.product_id, external_sku = EXCLUDED.external_sku, external_name = EXCLUDED.external_name, last_sync = NOW()`,
            [companyId, productId, supplierId, String(externalId), sku || null, name || null]
          );
        } catch (_) { /* ignore */ }
      }
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

            // изображения -> сохраняем записи в product_images
            if (images.length > 0) {
              const normalized = images
                .map((img, idx) => ({
                  image_url: typeof img === 'string' ? img : (img?.url || null),
                  is_main: idx === 0,
                  sort_order: idx,
                  alt_text: null
                }))
                .filter(i => i.image_url);
              for (const row of normalized) {
                await client.query(
                  `INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_main, is_active)
                   VALUES ($1, $2, $3, $4, $5, TRUE)`,
                  [productId, row.image_url, row.alt_text, row.sort_order, row.is_main]
                );
              }
            }

            // связь с поставщиком
            await upsertProductMapping(client, companyId, productId, supplierId, p.externalId, p.sku, p.name);
            await upsertProductSupplier(client, companyId, productId, supplierId, {
              external_product_id: p.externalId,
              original_price: p.price,
              currency: 'RUB',
              mrc_price: p.mrcPrice || p.priceDetails?.mrc || null,
              enforce_mrc: Boolean(p.priceDetails?.availabilityMRC),
              is_available: (p.stock || 0) > 0,
              stock_quantity: p.stock || 0
            });

            // цена (supplier)
            if (p.price) {
              await client.query(
                `INSERT INTO prices (product_id, price_type_id, price_type, value, currency, is_active, created_at, updated_at)
                 SELECT $1, pt.id, 'purchase', $2, 'RUB', true, NOW(), NOW()
                 FROM price_types pt WHERE pt.code = 'purchase'
                 ON CONFLICT (product_id, price_type) DO UPDATE SET value = EXCLUDED.value, price_type_id = EXCLUDED.price_type_id, updated_at = NOW()`,
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

            // связь с поставщиком
            await upsertProductMapping(client, companyId, productId, supplierId, p.externalId, p.sku, p.name);
            await upsertProductSupplier(client, companyId, productId, supplierId, {
              external_product_id: p.externalId,
              original_price: p.price,
              currency: 'RUB',
              mrc_price: p.mrcPrice || p.priceDetails?.mrc || null,
              enforce_mrc: Boolean(p.priceDetails?.availabilityMRC),
              is_available: (p.stock || 0) > 0,
              stock_quantity: p.stock || 0
            });

            // цена
            if (p.price) {
              await client.query(
                `INSERT INTO prices (product_id, price_type_id, price_type, value, currency, is_active, created_at, updated_at)
                 SELECT $1, pt.id, 'purchase', $2, 'RUB', true, NOW(), NOW()
                 FROM price_types pt WHERE pt.code = 'purchase'
                 ON CONFLICT (product_id, price_type) DO UPDATE SET value = EXCLUDED.value, price_type_id = EXCLUDED.price_type_id, updated_at = NOW()`,
                [productId, p.price]
              );
            }
            updated++;
          }

          // Обновляем склад по данным поставщика
          try {
            const whId = await ensureSupplierWarehouse(client, companyId, supplierId, p.sourceWarehouse?.id || p.warehouseId, p.sourceWarehouse?.name || p.warehouseName);
            if (whId) {
              await client.query(
                `INSERT INTO warehouse_product_links (warehouse_id, product_id, quantity, available_quantity, reserved_quantity, price, currency, last_updated, created_at, updated_at)
                 VALUES ($1, $2, $3, $3, 0, $4, 'RUB', NOW(), NOW(), NOW())
                 ON CONFLICT (warehouse_id, product_id)
                 DO UPDATE SET quantity = EXCLUDED.quantity, available_quantity = EXCLUDED.available_quantity, price = EXCLUDED.price, updated_at = NOW(), last_updated = NOW()`,
                [whId, existingRes.rows.length === 0 ? insertRes?.rows?.[0]?.id || null : existingRes.rows[0].id, (p.stock?.quantity || 0), p.price || 0]
              );
            }
          } catch (stockErr) {
            logger.warn('Stock update failed for product', { sku: p.sku, err: stockErr.message });
          }
        } catch (e) {
          logger.error('Product import error:', e);
          errors.push({ sku: p.sku, error: e.message });
        }
      }

      // Обнуление остатков и доступности для товаров, исчезнувших из выгрузки поставщика (по выбранным брендам)
      try {
        const currentExternalIds = new Set(syncResult.products.map(p => String(p.externalId)));
        // Обеспечим наличие виртуальных складов для всех складов RS24
        try {
          const warehouses = await adapter.getWarehouses();
          for (const w of warehouses) {
            await ensureSupplierWarehouse(client, companyId, supplierId, w.id, w.name);
          }
        } catch (_) {}

        const missingRes = await client.query(
          `SELECT pm.external_id, pm.product_id
           FROM product_mappings pm
           JOIN products pr ON pr.id = pm.product_id
           WHERE pm.system_id = $1 AND pr.company_id = $2
             ${brandIds.length > 0 ? 'AND pr.brand_id = ANY($3)' : ''}`,
          brandIds.length > 0 ? [supplierId, companyId, brandIds] : [supplierId, companyId]
        );
        const missingProductIds = [];
        for (const row of missingRes.rows) {
          if (!currentExternalIds.has(String(row.external_id))) missingProductIds.push(row.product_id);
        }
        if (missingProductIds.length > 0) {
          // Снимаем доступность у поставщика
          await client.query(
            `UPDATE product_suppliers SET is_available = false, stock_quantity = 0, last_updated = NOW()
             WHERE company_id = $1 AND supplier_id = $2 AND product_id = ANY($3)`,
            [companyId, supplierId, missingProductIds]
          );
          // Обнуляем остатки на всех виртуальных складах этого поставщика
          await client.query(
            `UPDATE warehouse_product_links SET quantity = 0, available_quantity = 0, updated_at = NOW()
             WHERE product_id = ANY($1)
               AND warehouse_id IN (
                 SELECT id FROM warehouses
                 WHERE company_id = $2 AND (settings->>'supplier_id') = $3
               )`,
            [missingProductIds, companyId, String(supplierId)]
          );
        }
      } catch (reconcileErr) {
        logger.warn('Reconciliation after RS24 import failed:', reconcileErr.message);
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