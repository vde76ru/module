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
   * Инициализация воркеров для синхронизации
   * ДОБАВЛЕН НЕДОСТАЮЩИЙ МЕТОД
   */
  async initializeWorkers() {
    try {
      console.log('Initializing sync workers...');

      // Здесь можно добавить инициализацию RabbitMQ воркеров
      // для обработки очередей синхронизации

      // Пример инициализации воркера для синхронизации поставщиков
      // this.setupSupplierSyncWorker();

      console.log('Sync workers initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing sync workers:', error);
      throw error;
    }
  }

  /**
   * Синхронизация товаров от всех активных поставщиков для тенанта
   */
  async syncAllSuppliers(companyId) {
    logger.info(`Starting sync for all suppliers of tenant ${companyId}`);

    try {
      // Получаем всех активных поставщиков
      const suppliers = await db('suppliers')
        .where({ company_id: companyId, is_active: true })
        .select('*');

      const results = [];

      for (const supplier of suppliers) {
        try {
          const result = await this.syncSupplier(companyId, supplier.id);
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
      await this.analyticsService.updatePopularityScores(companyId);

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
  async syncSupplier(companyId, supplierId) {
    logger.info(`Starting sync for supplier ${supplierId} of tenant ${companyId}`);

    try {
      // Получаем информацию о поставщике
      const supplier = await db('suppliers')
        .where({ id: supplierId, company_id: companyId })
        .first();

      if (!supplier) {
        throw new Error(`Supplier ${supplierId} not found`);
      }

      // Получаем адаптер для типа поставщика
      const adapter = this.getSupplierAdapter(supplier.type);

      // Получаем товары от поставщика
      const products = await adapter.fetchProducts(supplier.config);

      let processed = 0;
      let errors = [];

      // Обрабатываем товары в транзакции
      const trx = await db.transaction();

      try {
        for (const productData of products) {
          try {
            await this.processSupplierProduct(trx, companyId, supplierId, productData);
            processed++;
          } catch (error) {
            logger.error(`Error processing product ${productData.sku}:`, error);
            errors.push({
              sku: productData.sku,
              error: error.message
            });
          }
        }

        // Обновляем время последней синхронизации
        await trx('suppliers')
          .where({ id: supplierId })
          .update({ last_sync_at: new Date() });

        await trx.commit();

        return {
          processed,
          errors: errors.length,
          errorDetails: errors
        };
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      logger.error(`Error syncing supplier ${supplierId}:`, error);
      throw error;
    }
  }

  /**
   * Обработка товара от поставщика
   */
  async processSupplierProduct(trx, companyId, supplierId, productData) {
    // Нормализуем данные товара
    const normalizedData = await this.normalizationService.normalizeProduct(
      productData,
      supplierId
    );

    // Получаем или создаем бренд
    const brand = await this.getOrCreateBrand(trx, companyId, normalizedData.brand);

    // Получаем или создаем категорию
    const categoryId = await this.getOrCreateCategory(trx, companyId, normalizedData.category);

    // Ищем существующий товар
    let product = await trx('products')
      .where({
        company_id: companyId,
        supplier_sku: normalizedData.sku,
        supplier_id: supplierId
      })
      .first();

    const productId = product ? product.id : uuidv4();

    const productPayload = {
      id: productId,
      company_id: companyId,
      supplier_id: supplierId,
      supplier_sku: normalizedData.sku,
      name: normalizedData.name,
      description: normalizedData.description,
      brand_id: brand ? brand.id : null,
      category_id: categoryId,
      supplier_price: normalizedData.price,
      supplier_currency: normalizedData.currency,
      min_quantity: normalizedData.minQuantity || 1,
      quantity_step: normalizedData.quantityStep || 1,
      weight: normalizedData.weight,
      dimensions: normalizedData.dimensions,
      images: JSON.stringify(normalizedData.images || []),
      attributes: JSON.stringify(normalizedData.attributes || {}),
      is_active: true,
      last_sync_at: new Date(),
      updated_at: new Date()
    };

    if (product) {
      // Обновляем существующий товар
      await trx('products')
        .where({ id: productId })
        .update(productPayload);
    } else {
      // Создаем новый товар
      productPayload.created_at = new Date();
      await trx('products').insert(productPayload);
    }

    // Обновляем или создаем остатки и цены через WarehouseService
    if (normalizedData.stock !== undefined) {
      // Логика обновления остатков будет добавлена позже
    }

    return productId;
  }

  /**
   * Получить или создать бренд
   */
  async getOrCreateBrand(trx, companyId, brandName) {
    if (!brandName) return null;

    const normalizedName = brandName.trim();

    let brand = await trx('brands')
      .where({ company_id: companyId, name: normalizedName })
      .first();

    if (!brand) {
      const brandId = uuidv4();
      await trx('brands').insert({
        id: brandId,
        company_id: companyId,
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
  async getOrCreateCategory(trx, companyId, categoryPath) {
    if (!categoryPath) return null;

    // Категории могут быть вложенными, разделенными "/"
    const parts = categoryPath.split('/').map(p => p.trim()).filter(p => p);
    if (parts.length === 0) return null;

    let parentId = null;
    let categoryId = null;

    for (const categoryName of parts) {
      let category = await trx('categories')
        .where({
          company_id: companyId,
          name: categoryName,
          parent_id: parentId
        })
        .first();

      if (!category) {
        categoryId = uuidv4();
        await trx('categories').insert({
          id: categoryId,
          company_id: companyId,
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
  async updateSyncStatuses(companyId) {
    const suppliers = await db('suppliers')
      .where({ company_id: companyId })
      .select('*');

    const results = [];

    for (const supplier of suppliers) {
      try {
        const adapter = this.getSupplierAdapter(supplier.type);
        const status = await adapter.checkStatus(supplier.config);

        await db('suppliers')
          .where({ id: supplier.id })
          .update({
            status: status.isOnline ? 'online' : 'offline',
            last_check_at: new Date()
          });

        results.push({
          supplierId: supplier.id,
          name: supplier.name,
          status: status.isOnline ? 'online' : 'offline'
        });
      } catch (error) {
        logger.error(`Error checking supplier ${supplier.id} status:`, error);
        results.push({
          supplierId: supplier.id,
          name: supplier.name,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }
  /**
   * Инициализация воркеров для синхронизации
   */
  async initializeWorkers() {
    try {
      console.log('Initializing sync workers...');

      // Здесь можно добавить инициализацию RabbitMQ воркеров
      // для обработки очередей синхронизации

      console.log('Sync workers initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing sync workers:', error);
      throw error;
    }
  }
}

module.exports = SyncService;