// backend/src/services/SyncService.js
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const NormalizationService = require('./NormalizationService');
const PriceCalculationService = require('./PriceCalculationService');
const AnalyticsService = require('./AnalyticsService');

class SyncService {
  constructor() {
    this.normalizationService = new NormalizationService();
    this.priceCalculationService = new PriceCalculationService();
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Синхронизация товаров от всех активных поставщиков для тенанта
   */
  async syncAllSuppliers(tenantId) {
    logger.info(`Starting sync for all suppliers of tenant ${tenantId}`);
    
    try {
      // Получаем всех активных поставщиков
      const suppliers = await db('suppliers')
        .where({ tenant_id: tenantId, is_active: true })
        .select('*');

      const results = [];
      
      for (const supplier of suppliers) {
        try {
          const result = await this.syncSupplier(tenantId, supplier.id);
          results.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            success: true,
            ...result
          });
        } catch (error) {
          logger.error(`Error syncing supplier ${supplier.id}:`, error);
          results.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            success: false,
            error: error.message
          });
        }
      }

      // Обновляем рейтинги популярности после синхронизации
      await this.analyticsService.updatePopularityScores(tenantId);

      return {
        success: true,
        totalSuppliers: suppliers.length,
        results
      };
    } catch (error) {
      logger.error('Error in syncAllSuppliers:', error);
      throw error;
    }
  }

  /**
   * Синхронизация товаров от конкретного поставщика
   */
  async syncSupplier(tenantId, supplierId) {
    logger.info(`Starting sync for supplier ${supplierId}`);
    
    const trx = await db.transaction();
    
    try {
      // Получаем информацию о поставщике
      const supplier = await trx('suppliers')
        .where({ id: supplierId, tenant_id: tenantId })
        .first();

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Получаем адаптер для поставщика
      const adapter = this.getSupplierAdapter(supplier.type);
      
      // Получаем товары от поставщика
      const supplierProducts = await adapter.getProducts(supplier.config);
      
      // Получаем все бренды, для которых этот поставщик является мастер-источником
      const masterBrands = await trx('brand_content_sources')
        .where({ tenant_id: tenantId, supplier_id: supplierId })
        .pluck('brand_id');

      const stats = {
        total: supplierProducts.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: []
      };

      for (const supplierProduct of supplierProducts) {
        try {
          await this.syncProduct(trx, tenantId, supplierId, supplierProduct, masterBrands);
          stats.updated++;
        } catch (error) {
          logger.error(`Error syncing product ${supplierProduct.sku}:`, error);
          stats.errors.push({
            sku: supplierProduct.sku,
            error: error.message
          });
        }
      }

      // Обновляем время последней синхронизации
      await trx('suppliers')
        .where({ id: supplierId })
        .update({ 
          last_sync: new Date(),
          sync_status: 'completed'
        });

      await trx.commit();
      
      logger.info(`Sync completed for supplier ${supplierId}:`, stats);
      return stats;
      
    } catch (error) {
      await trx.rollback();
      logger.error(`Error syncing supplier ${supplierId}:`, error);
      
      // Обновляем статус синхронизации
      await db('suppliers')
        .where({ id: supplierId })
        .update({ 
          sync_status: 'failed',
          sync_error: error.message
        });
      
      throw error;
    }
  }

  /**
   * Синхронизация одного товара
   */
  async syncProduct(trx, tenantId, supplierId, supplierProduct, masterBrands) {
    // Нормализуем данные товара
    const normalizedProduct = this.normalizationService.normalizeProduct(supplierProduct);
    
    // Проверяем, существует ли товар
    let product = await trx('products')
      .where({ 
        tenant_id: tenantId,
        sku: normalizedProduct.sku 
      })
      .first();

    // Получаем или создаем бренд
    let brand = null;
    if (normalizedProduct.brand) {
      brand = await this.getOrCreateBrand(trx, tenantId, normalizedProduct.brand);
    }

    // Определяем, является ли поставщик мастер-источником для этого бренда
    const isMasterSource = brand && masterBrands.includes(brand.id);

    if (!product) {
      // Создаем новый товар
      const productId = uuidv4();
      
      await trx('products').insert({
        id: productId,
        tenant_id: tenantId,
        sku: normalizedProduct.sku,
        name: normalizedProduct.name,
        description: normalizedProduct.description,
        brand_id: brand?.id,
        category_id: await this.getOrCreateCategory(trx, tenantId, normalizedProduct.category),
        barcode: normalizedProduct.barcode,
        images: JSON.stringify(normalizedProduct.images || []),
        attributes: JSON.stringify(normalizedProduct.attributes || {}),
        weight: normalizedProduct.weight,
        volume: normalizedProduct.volume,
        dimensions: normalizedProduct.dimensions ? JSON.stringify(normalizedProduct.dimensions) : null,
        is_divisible: normalizedProduct.is_divisible !== false,
        popularity_score: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      product = { id: productId };
    } else if (isMasterSource) {
      // Обновляем контент товара только если поставщик является мастер-источником
      await trx('products')
        .where({ id: product.id })
        .update({
          name: normalizedProduct.name,
          description: normalizedProduct.description,
          brand_id: brand?.id,
          category_id: await this.getOrCreateCategory(trx, tenantId, normalizedProduct.category),
          barcode: normalizedProduct.barcode || product.barcode,
          images: JSON.stringify(normalizedProduct.images || []),
          attributes: JSON.stringify({
            ...JSON.parse(product.attributes || '{}'),
            ...normalizedProduct.attributes
          }),
          weight: normalizedProduct.weight || product.weight,
          volume: normalizedProduct.volume || product.volume,
          dimensions: normalizedProduct.dimensions ? JSON.stringify(normalizedProduct.dimensions) : product.dimensions,
          is_divisible: normalizedProduct.is_divisible !== undefined ? normalizedProduct.is_divisible : product.is_divisible,
          updated_at: new Date()
        });
    }

    // Всегда обновляем информацию о цене и остатке от поставщика
    const existingLink = await trx('product_suppliers')
      .where({
        product_id: product.id,
        supplier_id: supplierId
      })
      .first();

    const supplierData = {
      product_id: product.id,
      supplier_id: supplierId,
      supplier_sku: supplierProduct.supplierSku || normalizedProduct.sku,
      original_price: normalizedProduct.price,
      currency: normalizedProduct.currency || 'RUB',
      mrc_price: normalizedProduct.mrcPrice,
      enforce_mrc: normalizedProduct.enforceMrc || false,
      quantity: normalizedProduct.quantity || 0,
      is_available: normalizedProduct.isAvailable !== false,
      updated_at: new Date()
    };

    if (existingLink) {
      await trx('product_suppliers')
        .where({ id: existingLink.id })
        .update(supplierData);
    } else {
      await trx('product_suppliers').insert({
        id: uuidv4(),
        tenant_id: tenantId,
        ...supplierData,
        created_at: new Date()
      });
    }

    // Пересчитываем цены для всех маркетплейсов
    await this.priceCalculationService.recalculatePricesForProduct(trx, tenantId, product.id);
  }

  /**
   * Получить или создать бренд
   */
  async getOrCreateBrand(trx, tenantId, brandName) {
    if (!brandName) return null;

    const normalizedName = this.normalizationService.normalizeBrandName(brandName);
    
    let brand = await trx('brands')
      .where({ 
        tenant_id: tenantId,
        name: normalizedName 
      })
      .first();

    if (!brand) {
      const brandId = uuidv4();
      await trx('brands').insert({
        id: brandId,
        tenant_id: tenantId,
        name: normalizedName,
        created_at: new Date()
      });
      brand = { id: brandId };
    }

    return brand;
  }

  /**
   * Получить или создать категорию
   */
  async getOrCreateCategory(trx, tenantId, categoryPath) {
    if (!categoryPath) return null;

    // Категории могут быть вложенными, разделенными "/"
    const parts = categoryPath.split('/').map(p => p.trim()).filter(p => p);
    if (parts.length === 0) return null;

    let parentId = null;
    let categoryId = null;

    for (const categoryName of parts) {
      let category = await trx('categories')
        .where({ 
          tenant_id: tenantId,
          name: categoryName,
          parent_id: parentId 
        })
        .first();

      if (!category) {
        categoryId = uuidv4();
        await trx('categories').insert({
          id: categoryId,
          tenant_id: tenantId,
          name: categoryName,
          parent_id: parentId,
          created_at: new Date()
        });
      } else {
        categoryId = category.id;
      }

      parentId = categoryId;
    }

    return categoryId;
  }

  /**
   * Получить адаптер для типа поставщика
   */
  getSupplierAdapter(type) {
    // Импортируем адаптеры динамически
    const adapters = {
      etm: require('../adapters/suppliers/ETMAdapter'),
      rs24: require('../adapters/suppliers/RS24Adapter'),
      custom_api: require('../adapters/suppliers/CustomAPIAdapter'),
      // Добавьте другие адаптеры по мере необходимости
    };

    const AdapterClass = adapters[type];
    if (!AdapterClass) {
      throw new Error(`Unknown supplier type: ${type}`);
    }

    return new AdapterClass();
  }

  /**
   * Обновить статусы синхронизации для всех поставщиков
   */
  async updateSyncStatuses(tenantId) {
    const suppliers = await db('suppliers')
      .where({ tenant_id: tenantId })
      .select('id', 'last_sync', 'sync_interval_hours');

    for (const supplier of suppliers) {
      const needsSync = !supplier.last_sync || 
        new Date() - new Date(supplier.last_sync) > supplier.sync_interval_hours * 60 * 60 * 1000;

      if (needsSync) {
        await db('suppliers')
          .where({ id: supplier.id })
          .update({ sync_status: 'pending' });
      }
    }
  }

  /**
   * Проверка и создание алертов для товаров с неполными данными
   */
  async checkIncompleteProducts(tenantId) {
    const incompleteProducts = await db('products')
      .where({ tenant_id: tenantId })
      .where(function() {
        this.whereNull('name')
          .orWhereNull('brand_id')
          .orWhereNull('category_id')
          .orWhere('images', '[]')
          .orWhereNull('weight');
      })
      .select('id', 'sku', 'name');

    for (const product of incompleteProducts) {
      // Проверяем, есть ли уже алерт для этого товара
      const existingAlert = await db('alerts')
        .where({
          tenant_id: tenantId,
          alert_type: 'incomplete_data',
          entity_type: 'product',
          entity_id: product.id,
          status: 'new'
        })
        .first();

      if (!existingAlert) {
        await db('alerts').insert({
          id: uuidv4(),
          tenant_id: tenantId,
          alert_type: 'incomplete_data',
          entity_type: 'product',
          entity_id: product.id,
          message: `Товар "${product.name || product.sku}" имеет неполные данные`,
          severity: 'warning',
          status: 'new',
          metadata: JSON.stringify({ sku: product.sku }),
          created_at: new Date()
        });
      }
    }
  }
}

module.exports = SyncService;
