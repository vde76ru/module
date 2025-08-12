// ================================================================
// ФАЙЛ: backend/src/services/SupplierIntegrationService.js
// Сервис управления интеграциями с поставщиками (RS24 и другими)
// ================================================================

const db = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('../utils/crypto');
const DocumentService = require('./DocumentService');
const documentService = new DocumentService();

// Динамический импорт адаптеров
const getSupplierAdapter = (apiType, config) => {
  switch (apiType) {
    case 'rs24':
      const RS24Adapter = require('../adapters/RS24Adapter');
      return new RS24Adapter(config);
    default:
      throw new Error(`Unsupported supplier API type: ${apiType}`);
  }
};

class SupplierIntegrationService {

  // ================================================================
  // НАСТРОЙКА ИНТЕГРАЦИИ
  // ================================================================

  /**
   * Создание/обновление настроек интеграции с поставщиком
   */
  static async setupIntegration(companyId, integrationData) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const {
        supplierId,
        apiType,
        apiConfig,
        credentials,
        settings,
        selectedBrands = [],
        selectedWarehouses = [],
        syncSettings = {}
      } = integrationData;

      // Шифруем конфиденциальные данные
      const encryptedCredentials = credentials ? crypto.encrypt(JSON.stringify(credentials)) : null;
      const encryptedApiConfig = apiConfig ? crypto.encrypt(JSON.stringify(apiConfig)) : null;

      // Обновляем поставщика
      await client.query(
        `UPDATE suppliers SET
         api_type = $1,
         api_config = $2,
         credentials = $3,
         integration_settings = $4,
         auto_sync_enabled = $5,
         sync_interval_hours = $6,
         updated_at = NOW()
         WHERE id = $7 AND company_id = $8`,
        [
          apiType,
          encryptedApiConfig,
          encryptedCredentials,
          JSON.stringify(settings || {}),
          syncSettings.autoSync || false,
          syncSettings.syncIntervalHours || 24,
          supplierId,
          companyId
        ]
      );

      // Сохраняем маппинг брендов
      if (selectedBrands.length > 0) {
        await this.saveBrandMappings(client, companyId, supplierId, selectedBrands);
      }

      // Создаем связи складов с поставщиком
      if (selectedWarehouses.length > 0) {
        await this.createWarehouseSupplierLinks(client, companyId, supplierId, selectedWarehouses);
      }

      await client.query('COMMIT');

      logger.info(`Integration setup completed for supplier ${supplierId}`);
      return { success: true, message: 'Integration configured successfully' };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Integration setup failed:', error);
      throw new Error(`Failed to setup integration: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Сохранение маппинга брендов к поставщику
   */
  static async saveBrandMappings(client, companyId, supplierId, brandMappings) {
    // Переходим на add-only стратегию: не удаляем все маппинги, а добавляем/обновляем
    for (const mapping of brandMappings) {
      let brandId = mapping.brandId;

      if (!brandId && mapping.brandName) {
        const brandResult = await client.query(
          `INSERT INTO brands (company_id, name, code, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (company_id, name) DO UPDATE SET updated_at = NOW()
           RETURNING id`,
          [companyId, mapping.brandName, mapping.brandName.toLowerCase().replace(/\s+/g, '_')]
        );
        brandId = brandResult.rows[0].id;
      }

      if (!brandId) continue;

      const externalName = mapping.externalBrandName || mapping.brandName;

      await client.query(
        `INSERT INTO brand_supplier_mappings (
           company_id, supplier_id, brand_id, external_brand_name,
           external_brand_code, mapping_settings, sync_enabled, is_active,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         ON CONFLICT (company_id, supplier_id, brand_id, external_brand_name)
         DO UPDATE SET
           external_brand_code = EXCLUDED.external_brand_code,
           mapping_settings = EXCLUDED.mapping_settings,
           sync_enabled = EXCLUDED.sync_enabled,
           is_active = true,
           updated_at = NOW()`,
        [
          companyId,
          supplierId,
          brandId,
          externalName,
          mapping.externalBrandCode || null,
          JSON.stringify(mapping.settings || {}),
          mapping.syncEnabled !== false
        ]
      );
    }
  }

  /**
   * Создание связей складов с поставщиком
   */
  static async createWarehouseSupplierLinks(client, companyId, supplierId, warehouseMappings) {
    // Удаляем старые связи
    await client.query(
      'DELETE FROM warehouse_supplier_links WHERE company_id = $1 AND supplier_id = $2',
      [companyId, supplierId]
    );

    for (const mapping of warehouseMappings) {
      await client.query(
        `INSERT INTO warehouse_supplier_links (
          company_id, warehouse_id, supplier_id,
          external_warehouse_id, external_warehouse_name,
          priority, sync_stocks, sync_prices,
          aggregation_settings, is_active,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())`,
        [
          companyId,
          mapping.warehouseId,
          supplierId,
          mapping.externalWarehouseId,
          mapping.externalWarehouseName,
          mapping.priority || 0,
          mapping.syncStocks !== false,
          mapping.syncPrices !== false,
          JSON.stringify(mapping.aggregationSettings || {})
        ]
      );
    }
  }

  // ================================================================
  // СИНХРОНИЗАЦИЯ ТОВАРОВ
  // ================================================================

  /**
   * Полная синхронизация товаров от поставщика
   */
  static async syncSupplierProducts(companyId, supplierId, options = {}) {
    const startTime = Date.now();
    const sessionId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const client = await db.getClient();
    let importSessionId;

    try {
      await client.query('BEGIN');

      // Создаем сессию импорта
      const sessionResult = await client.query(
        `INSERT INTO import_sessions (
          company_id, supplier_id, session_type, status, session_id,
          started_at, settings, metadata
        )
        VALUES ($1, $2, 'full_sync', 'running', $3, NOW(), $4, $5)
        RETURNING id`,
        [
          companyId,
          supplierId,
          sessionId,
          JSON.stringify(options),
          JSON.stringify({ startTime })
        ]
      );
      importSessionId = sessionResult.rows[0].id;

      // Получаем настройки поставщика
      const supplierData = await this.getSupplierWithSettings(client, companyId, supplierId);
      if (!supplierData) {
        throw new Error('Supplier not found or not configured');
      }

      // Создаем адаптер
      const adapter = getSupplierAdapter(supplierData.api_type, supplierData.api_config);

      // Получаем маппинги брендов
      const brandMappings = await this.getBrandMappings(client, companyId, supplierId);
      const selectedBrands = brandMappings.map(m => m.external_brand_name).filter(Boolean);

      // Получаем связи складов
      const warehouseLinks = await this.getWarehouseSupplierLinks(client, companyId, supplierId);

      // Логируем начало синхронизации
      await this.logImport(client, importSessionId, 'info',
        `Starting sync for ${selectedBrands.length} brands across ${warehouseLinks.length} warehouses`);

      // Синхронизируем товары
      const syncResult = await adapter.syncProducts({
        brands: selectedBrands,
        updateExisting: options.updateExisting || false,
        warehouseIds: warehouseLinks.map(w => w.external_warehouse_id).filter(Boolean),
        withPrices: true,
        withStocks: true,
        withSpecs: options.withSpecs || false
      });

      if (!syncResult.success) {
        throw new Error('Supplier sync failed');
      }

      // Обрабатываем полученные товары
      const processingResult = await this.processSupplierProducts(
        client,
        companyId,
        supplierId,
        importSessionId,
        syncResult.products,
        warehouseLinks,
        brandMappings,
        options
      );

      // Обновляем сессию
      await client.query(
        `UPDATE import_sessions SET
         status = 'completed',
         completed_at = NOW(),
         total_items = $2,
         processed_items = $3,
         success_items = $4,
         error_items = $5,
         created_items = $6,
         updated_items = $7,
         metadata = jsonb_set(metadata, '{processing_time}', $8::jsonb)
         WHERE id = $1`,
        [
          importSessionId,
          processingResult.total,
          processingResult.processed,
          processingResult.success,
          processingResult.errors,
          processingResult.created,
          processingResult.updated,
          JSON.stringify(Date.now() - startTime)
        ]
      );

      // Очистка отсутствующих товаров
      if (supplierData.integration_settings?.cleanup_missing_products !== false) {
        await this.cleanupMissingProducts(client, companyId, supplierId, processingResult.processedIds);
      }

      // Обновляем время синхронизации поставщика
      await client.query(
        `UPDATE suppliers SET
         last_sync_at = NOW(),
         next_sync_at = NOW() + INTERVAL '1 hour' * sync_interval_hours
         WHERE id = $1`,
        [supplierId]
      );

      await client.query('COMMIT');

      logger.info(`Supplier sync completed: ${processingResult.success} products processed`);

      return {
        success: true,
        sessionId,
        ...processingResult,
        duration: Date.now() - startTime
      };

    } catch (error) {
      await client.query('ROLLBACK');

      // Обновляем сессию как ошибочную
      if (importSessionId) {
        try {
          await client.query(
            `UPDATE import_sessions SET
             status = 'error',
             completed_at = NOW(),
             error_details = $2
             WHERE id = $1`,
            [importSessionId, JSON.stringify({ error: error.message, stack: error.stack })]
          );
        } catch (_) {}
      }

      logger.error('Supplier sync failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Обработка товаров от поставщика
   */
  static async processSupplierProducts(client, companyId, supplierId, sessionId, products, warehouseLinks, brandMappings, options) {
    let processed = 0;
    let success = 0;
    let errors = 0;
    let updated = 0;
    let created = 0;
    const processedIds = new Set();

    const brandMap = new Map(brandMappings.map(b => [b.external_brand_name?.toLowerCase(), b.brand_id]));
    const warehouseMap = new Map(warehouseLinks.map(w => [w.external_warehouse_id, w.warehouse_id]));

    for (const productData of products) {
      try {
        processed++;

        const {
          externalId,
          sku,
          name,
          brand,
          category,
          description,
          unit,
          unitOKEI,
          multiplicity,
          stock,
          price,
          specs,
          sourceWarehouse
        } = productData;

        processedIds.add(externalId);

        // Находим бренд
        const brandId = brandMap.get(brand?.toLowerCase());
        if (!brandId) {
          await this.logImport(client, sessionId, 'warning',
            `Brand not mapped: ${brand}`, externalId);
          continue;
        }

        // Проверяем существование товара
        let productId;
        const existingProduct = await client.query(
          `SELECT id FROM products
           WHERE company_id = $1 AND (external_id = $2 OR (brand_id = $3 AND sku = $4))
           LIMIT 1`,
          [companyId, externalId, brandId, sku]
        );

        if (existingProduct.rows.length > 0) {
          // Обновляем существующий товар
          productId = existingProduct.rows[0].id;

          if (options.updateExisting) {
            await this.updateProduct(client, productId, productData, supplierId);
            updated++;
          }
        } else {
          // Создаем новый товар
          productId = await this.createProduct(client, companyId, productData, brandId, supplierId);
          created++;
        }

        // Обновляем связь товара с поставщиком
        await this.updateProductSupplierLink(client, companyId, productId, supplierId, productData);

        // Обновляем остатки на складах
        if (stock && sourceWarehouse) {
          const warehouseId = warehouseMap.get(sourceWarehouse.id);
          if (warehouseId) {
            await this.updateWarehouseStock(client, warehouseId, productId, stock);
          }
        }

        // Обновляем цены
        if (price) {
          await this.updateProductPrices(client, companyId, productId, supplierId, price);
        }

        // Синхронизируем документы/сертификаты от поставщика, если они присутствуют в данных
        try {
          const externalDocuments = [];
          if (productData.documents) {
            const { certificates = [], catalogs = [], passports = [] } = productData.documents;
            certificates.forEach(cert => externalDocuments.push({ id: cert.number || cert.CERT_NUM, type: 'certificate', name: cert.number ? `Certificate ${cert.number}` : 'Certificate', url: cert.url || cert.URL }));
            catalogs.forEach(cat => externalDocuments.push({ id: cat.id || undefined, type: 'catalog', name: 'Catalog/Brochure', url: cat.url || cat.URL }));
            passports.forEach(pass => externalDocuments.push({ id: pass.id || undefined, type: 'passport', name: 'Passport', url: pass.url || pass.URL }));
          }
          // Фолбек: если структура документов вложена в specs
          if (externalDocuments.length === 0 && productData.specs && productData.specs.documents) {
            const { certificates = [], catalogs = [], passports = [] } = productData.specs.documents;
            certificates.forEach(cert => externalDocuments.push({ id: cert.number || cert.CERT_NUM, type: 'certificate', name: cert.number ? `Certificate ${cert.number}` : 'Certificate', url: cert.url || cert.URL }));
            catalogs.forEach(cat => externalDocuments.push({ id: cat.id || undefined, type: 'catalog', name: 'Catalog/Brochure', url: cat.url || cat.URL }));
            passports.forEach(pass => externalDocuments.push({ id: pass.id || undefined, type: 'passport', name: 'Passport', url: pass.url || pass.URL }));
          }
          if (externalDocuments.length > 0) {
            await documentService.syncSupplierDocuments(companyId, supplierId, productId, externalDocuments);
          }
        } catch (docError) {
          await this.logImport(client, sessionId, 'warning', `Document sync failed: ${docError.message}`, productData.externalId);
          logger.warn('Document sync failed:', docError);
        }

        // Маппинг категорий на основании RS_CATALOG/ETIM
        try {
          const categories = specs?.info?.categories || specs?.info?.RS_CATALOG || [];
          const AttributeMappingService = require('./attributeMappingService');
          if (Array.isArray(categories) && categories.length > 0) {
            await AttributeMappingService.mapCategories(companyId, supplierId, categories.map((c, idx) => ({
              id: String(c.LEVEL_4_ID || c.LEVEL_3_ID || c.LEVEL_2_ID || idx + 1),
              name: c.LEVEL_4_NAME || c.LEVEL_3_NAME || c.LEVEL_2_NAME || c.name || ''
            })));
          }
        } catch (_) {}

        success++;

      } catch (error) {
        errors++;
        await this.logImport(client, sessionId, 'error',
          `Product processing failed: ${error.message}`, productData.externalId, {
            stack: error.stack,
            productData: productData
          });
        logger.error(`Product processing error:`, error);
      }
    }

    return {
      total: products.length,
      processed,
      success,
      errors,
      created,
      updated,
      processedIds: Array.from(processedIds)
    };
  }

  /**
   * Создание нового товара
   */
  static async createProduct(client, companyId, productData, brandId, supplierId) {
    const {
      externalId,
      sku,
      name,
      description,
      unit,
      unitOKEI,
      multiplicity,
      weight,
      externalData,
      specs
    } = productData;

    // Генерируем внутренний код
    const internalCode = await this.generateInternalCode(client, companyId);

    const result = await client.query(
      `INSERT INTO products (
        company_id,
        internal_code,
        name,
        description,
        brand_id,
        sku,
        external_id,
        external_data,
        supplier_data,
        main_supplier_id,
        base_unit,
        weight,
        multiplicity,
        etim_class,
        etim_class_name,
        source_type,
        status,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'api', 'active', true, NOW(), NOW())
      RETURNING id`,
      [
        companyId,
        internalCode,
        name,
        description,
        brandId,
        sku,
        externalId,
        JSON.stringify(externalData || {}),
        JSON.stringify({ [supplierId]: productData }),
        supplierId,
        unit || 'шт',
        weight,
        multiplicity || 1,
        specs?.info?.etimClass,
        specs?.info?.etimClassName
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Обновление существующего товара
   */
  static async updateProduct(client, productId, productData, supplierId) {
    const {
      name,
      description,
      unit,
      weight,
      multiplicity,
      externalData,
      specs
    } = productData;

    await client.query(
      `UPDATE products SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       base_unit = COALESCE($4, base_unit),
       weight = COALESCE($5, weight),
       multiplicity = COALESCE($6, multiplicity),
       external_data = COALESCE($7, external_data),
       etim_class = COALESCE($8, etim_class),
       etim_class_name = COALESCE($9, etim_class_name),
       supplier_data = jsonb_set(
         COALESCE(supplier_data, '{}'),
         '{${supplierId}}',
         $10::jsonb
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [
        productId,
        name,
        description,
        unit,
        weight,
        multiplicity,
        JSON.stringify(externalData || {}),
        specs?.info?.etimClass,
        specs?.info?.etimClassName,
        JSON.stringify(productData)
      ]
    );
  }

  /**
   * Обновление связи товара с поставщиком
   */
  static async updateProductSupplierLink(client, companyId, productId, supplierId, productData) {
    const { price, stock } = productData;
    const originalPrice = price?.personal ?? price?.retail ?? 0;
    const stockQuantity = Number(stock?.quantity || 0) + Number(stock?.partnerStock?.quantity || 0);
    const isAvailable = stockQuantity > 0;
    const mrcPrice = price?.mrc ?? null;
    const enforceMrc = mrcPrice != null ? true : false;
    const currency = 'RUB';

    await client.query(
      `INSERT INTO product_suppliers (
        company_id,
        product_id,
        supplier_id,
        external_product_id,
        original_price,
        currency,
        mrc_price,
        enforce_mrc,
        is_available,
        stock_quantity,
        metadata,
        last_updated,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())
      ON CONFLICT (company_id, product_id, supplier_id)
      DO UPDATE SET
        external_product_id = EXCLUDED.external_product_id,
        original_price = EXCLUDED.original_price,
        currency = EXCLUDED.currency,
        mrc_price = EXCLUDED.mrc_price,
        enforce_mrc = EXCLUDED.enforce_mrc,
        is_available = EXCLUDED.is_available,
        stock_quantity = EXCLUDED.stock_quantity,
        metadata = EXCLUDED.metadata,
        last_updated = NOW(),
        updated_at = NOW()`,
      [
        companyId,
        productId,
        supplierId,
        productData.externalId || null,
        originalPrice,
        currency,
        mrcPrice,
        enforceMrc,
        isAvailable,
        stockQuantity,
        JSON.stringify({
          category: productData.category,
          unitOKEI: productData.unitOKEI,
          externalData: productData.externalData
        })
      ]
    );
  }

  /**
   * Обновление остатков на складе
   */
  static async updateWarehouseStock(client, warehouseId, productId, stockData) {
    const { quantity, partnerStock } = stockData;
    const totalQuantity = (quantity || 0) + (partnerStock?.quantity || 0);

    await client.query(
      `INSERT INTO warehouse_product_links (
        warehouse_id,
        product_id,
        quantity,
        available_quantity,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $3, NOW(), NOW())
      ON CONFLICT (warehouse_id, product_id)
      DO UPDATE SET
        quantity = EXCLUDED.quantity,
        available_quantity = EXCLUDED.available_quantity,
        updated_at = NOW()`,
      [warehouseId, productId, totalQuantity]
    );
  }

  /**
   * Обновление цен товара
   */
  static async updateProductPrices(client, companyId, productId, supplierId, priceData) {
    const entries = [
      ['purchase', priceData?.personal],
      ['personal', priceData?.personal],
      ['personal_vat', priceData?.personalWithVAT],
      ['retail', priceData?.retail],
      ['retail_vat', priceData?.retailWithVAT],
      ['mrc', priceData?.mrc],
      ['mrc_vat', priceData?.mrcWithVAT]
    ].filter(([, v]) => v != null);

    for (const [code, value] of entries) {
      await client.query(
        `INSERT INTO prices (product_id, price_type_id, price_type, value, currency, is_active, created_at, updated_at)
         SELECT $1, pt.id, $2, $3, 'RUB', true, NOW(), NOW()
         FROM price_types pt WHERE pt.code = $2
         ON CONFLICT (product_id, price_type)
         DO UPDATE SET value = EXCLUDED.value, price_type_id = EXCLUDED.price_type_id, updated_at = NOW()`,
        [productId, code, value]
      );
    }
  }

  /**
   * Очистка отсутствующих товаров
   */
  static async cleanupMissingProducts(client, companyId, supplierId, processedIds) {
    if (processedIds.length === 0) return;

    // Находим товары поставщика, которых нет в текущей выгрузке
    const missingResult = await client.query(
      `SELECT p.id, p.external_id
       FROM products p
       JOIN product_suppliers ps ON p.id = ps.product_id
       WHERE p.company_id = $1
         AND ps.supplier_id = $2
         AND p.external_id IS NOT NULL
         AND NOT (p.external_id = ANY($3))`,
      [companyId, supplierId, processedIds]
    );

    if (missingResult.rows.length > 0) {
      const missingProductIds = missingResult.rows.map(r => r.id);

      // Обнуляем остатки и отключаем доступность
      await client.query(
        `UPDATE product_suppliers SET
         is_available = false,
         stock_quantity = 0,
         partner_stock_quantity = 0,
         last_updated = NOW()
         WHERE company_id = $1 AND supplier_id = $2 AND product_id = ANY($3)`,
        [companyId, supplierId, missingProductIds]
      );

      // Обнуляем остатки на складах
      await client.query(
        `UPDATE warehouse_product_links wpl SET
         quantity = 0,
         available_quantity = 0,
         updated_at = NOW()
         WHERE wpl.product_id = ANY($1)
           AND wpl.warehouse_id IN (
             SELECT wsl.warehouse_id
             FROM warehouse_supplier_links wsl
             WHERE wsl.company_id = $2 AND wsl.supplier_id = $3
           )`,
        [missingProductIds, companyId, supplierId]
      );

      logger.info(`Cleaned up ${missingResult.rows.length} missing products for supplier ${supplierId}`);
    }
  }

  // ================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ================================================================

  /**
   * Получение данных поставщика с настройками
   */
  static async getSupplierWithSettings(client, companyId, supplierId) {
    const result = await client.query(
      `SELECT id, api_type, api_config, credentials, integration_settings
       FROM suppliers
       WHERE id = $1 AND company_id = $2 AND is_active = true`,
      [supplierId, companyId]
    );

    if (result.rows.length === 0) return null;

    const supplier = result.rows[0];

    // Расшифровываем данные
    try {
      if (supplier.api_config && crypto.isEncrypted(supplier.api_config)) {
        supplier.api_config = JSON.parse(crypto.decrypt(supplier.api_config));
      }
      if (supplier.credentials && crypto.isEncrypted(supplier.credentials)) {
        const credentials = JSON.parse(crypto.decrypt(supplier.credentials));
        supplier.api_config = { ...supplier.api_config, ...credentials };
      }
    } catch (error) {
      logger.error('Failed to decrypt supplier credentials:', error);
    }

    return supplier;
  }

  /**
   * Получение маппингов брендов
   */
  static async getBrandMappings(client, companyId, supplierId) {
    const result = await client.query(
      `SELECT bsm.*, b.name as brand_name
       FROM brand_supplier_mappings bsm
       JOIN brands b ON bsm.brand_id = b.id
       WHERE bsm.company_id = $1 AND bsm.supplier_id = $2 AND bsm.is_active = true`,
      [companyId, supplierId]
    );

    return result.rows;
  }

  /**
   * Получение связей складов с поставщиком
   */
  static async getWarehouseSupplierLinks(client, companyId, supplierId) {
    const result = await client.query(
      `SELECT wsl.*, w.name as warehouse_name
       FROM warehouse_supplier_links wsl
       JOIN warehouses w ON wsl.warehouse_id = w.id
       WHERE wsl.company_id = $1 AND wsl.supplier_id = $2 AND wsl.is_active = true`,
      [companyId, supplierId]
    );

    return result.rows;
  }

  /**
   * Генерация внутреннего кода товара
   */
  static async generateInternalCode(client, companyId) {
    const result = await client.query(
      `SELECT MAX(CAST(REGEXP_REPLACE(internal_code, '[^0-9]', '', 'g') AS INTEGER)) as max_code
       FROM products
       WHERE company_id = $1 AND internal_code ~ '^[0-9]+$'`,
      [companyId]
    );

    const maxCode = result.rows[0]?.max_code || 100000;
    return String(maxCode + 1);
  }

  /**
   * Логирование импорта
   */
  static async logImport(client, sessionId, level, message, externalId = null, details = {}) {
    await client.query(
      `INSERT INTO import_logs (import_session_id, level, message, external_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [sessionId, level, message, externalId, JSON.stringify(details)]
    );
  }

  // ================================================================
  // МЕТОДЫ ДЛЯ API
  // ================================================================

  /**
   * Тестирование подключения к поставщику
   */
  static async testSupplierConnection(companyId, supplierId, config = null) {
    const client = await db.getClient();

    try {
      let supplierData;
      if (config) {
        // Тестируем с переданной конфигурацией
        supplierData = { api_type: 'rs24', api_config: config };
      } else {
        supplierData = await this.getSupplierWithSettings(client, companyId, supplierId);
        if (!supplierData) {
          throw new Error('Supplier not found');
        }
      }

      const adapter = getSupplierAdapter(supplierData.api_type, supplierData.api_config);
      return await adapter.testConnection();

    } catch (error) {
      logger.error('Supplier connection test failed:', error);
      return {
        success: false,
        message: error.message
      };
    } finally {
      client.release();
    }
  }

  /**
   * Получение брендов от поставщика
   */
  static async getSupplierBrands(companyId, supplierId, options = {}) {
    const client = await db.getClient();

    try {
      const supplierData = await this.getSupplierWithSettings(client, companyId, supplierId);
      if (!supplierData) {
        throw new Error('Supplier not found');
      }

      const adapter = getSupplierAdapter(supplierData.api_type, supplierData.api_config);
      return await adapter.getBrands(options);

    } catch (error) {
      logger.error('Failed to get supplier brands:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получение складов от поставщика
   */
  static async getSupplierWarehouses(companyId, supplierId) {
    const client = await db.getClient();

    try {
      const supplierData = await this.getSupplierWithSettings(client, companyId, supplierId);
      if (!supplierData) {
        throw new Error('Supplier not found');
      }

      const adapter = getSupplierAdapter(supplierData.api_type, supplierData.api_config);
      return await adapter.getWarehouses();

    } catch (error) {
      logger.error('Failed to get supplier warehouses:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получение истории синхронизации
   */
  static async getSyncHistory(companyId, supplierId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const result = await db.query(
      `SELECT ims.*, s.name as supplier_name
       FROM import_sessions ims
       JOIN suppliers s ON ims.supplier_id = s.id
       WHERE ims.company_id = $1
         AND ($2::uuid IS NULL OR ims.supplier_id = $2)
       ORDER BY ims.started_at DESC
       LIMIT $3 OFFSET $4`,
      [companyId, supplierId || null, limit, offset]
    );

    return result.rows;
  }

  /**
   * Получение логов импорта
   */
  static async getImportLogs(sessionId, options = {}) {
    const { level, limit = 100, offset = 0 } = options;

    let query = `
      SELECT il.*, p.name as product_name, b.name as brand_name
      FROM import_logs il
      LEFT JOIN products p ON il.product_id = p.id
      LEFT JOIN brands b ON il.brand_id = b.id
      WHERE il.import_session_id = $1
    `;

    const params = [sessionId];
    let paramIndex = 2;

    if (level) {
      query += ` AND il.level = $${paramIndex}`;
      params.push(level);
      paramIndex++;
    }

    query += ` ORDER BY il.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = SupplierIntegrationService;