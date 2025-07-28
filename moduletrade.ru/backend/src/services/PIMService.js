// backend/src/services/PIMService.js
const db = require('../models');
const { Op, Sequelize } = require('sequelize');
const WarehouseService = require('./WarehouseService');
const NormalizationService = require('./NormalizationService');
const PriceCalculationService = require('./PriceCalculationService');
const { parseStringPromise } = require('xml2js');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

/**
 * PIMService - Сервис управления товарами
 * Полностью переработан для работы с новой архитектурой складов и цен
 * Все операции со складами делегируются в WarehouseService
 */
class PIMService {
  
  /**
   * Обработка очереди импорта товаров
   * ДОБАВЛЕН НЕДОСТАЮЩИЙ МЕТОД
   */
  async processImportQueue() {
    try {
      console.log('Starting import queue processor...');
      
      // Здесь можно добавить обработчик очереди импорта
      // для асинхронной обработки загруженных файлов
      
      // Пример инициализации обработчика очереди
      // this.setupImportQueueWorker();
      
      console.log('Import queue processor started successfully');
      return true;
    } catch (error) {
      console.error('Error starting import queue processor:', error);
      throw error;
    }
  }
  /**
   * Обработка очереди импорта товаров
   */
  async processImportQueue() {
    try {
      console.log('Starting import queue processor...');
      
      // Здесь можно добавить обработчик очереди импорта
      // для асинхронной обработки загруженных файлов
      
      console.log('Import queue processor started successfully');
      return true;
    } catch (error) {
      console.error('Error starting import queue processor:', error);
      throw error;
    }
  }

  /**
   * Настройка воркера для обработки очереди импорта
   * Дополнительный метод для будущего расширения
   */
  async setupImportQueueWorker() {
    // Будущая реализация RabbitMQ воркера для обработки импорта
    console.log('Setting up import queue worker...');
  }

  /**
   * Создание нового товара
   * @param {Object} productData - Данные товара
   * @param {Object} warehouseData - Данные для складов (остатки и цены)
   * @returns {Promise<Object>} Созданный товар
   */
  async createProduct(productData, warehouseData = []) {
    const transaction = await db.sequelize.transaction();
    
    try {
      // Создаем основную запись товара
      const product = await db.Product.create({
        sku: productData.sku,
        name: productData.name,
        description: productData.description,
        category_id: productData.category_id,
        brand_id: productData.brand_id,
        weight: productData.weight,
        length: productData.length,
        width: productData.width,
        height: productData.height,
        images: productData.images || [],
        attributes: productData.attributes || {},
        barcode: productData.barcode,
        status: productData.status || 'active',
        created_by: productData.created_by
      }, { transaction });

      // Если переданы данные по складам, создаем связи через WarehouseService
      if (warehouseData && warehouseData.length > 0) {
        for (const warehouse of warehouseData) {
          // Нормализуем данные перед сохранением
          const normalizedData = await this._normalizeWarehouseData(warehouse);
          
          await WarehouseService.updateProductStock(
            warehouse.warehouse_id,
            product.id,
            normalizedData.stock,
            normalizedData.reserved || 0,
            normalizedData.purchase_price,
            transaction
          );
        }
      }

      await transaction.commit();
      return product;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Получение списка товаров с фильтрацией
   * @param {string} tenantId - ID тенанта
   * @param {Object} filters - Фильтры
   * @returns {Promise<Object>} Список товаров
   */
  async getProducts(tenantId, filters = {}) {
    const where = { tenant_id: tenantId };
    const include = [];

    // Применяем фильтры
    if (filters.source_type) {
      where.source_type = filters.source_type;
    }

    if (filters.brand_id) {
      where.brand_id = filters.brand_id;
    }

    if (filters.category_id) {
      where.category_id = filters.category_id;
    }

    if (filters.is_active !== undefined) {
      where.is_active = filters.is_active;
    }

    if (filters.search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${filters.search}%` } },
        { sku: { [Op.iLike]: `%${filters.search}%` } },
        { description: { [Op.iLike]: `%${filters.search}%` } }
      ];
    }

    // Добавляем связанные данные
    include.push(
      { model: db.Brand, as: 'brand' },
      { model: db.Category, as: 'category' }
    );

    const { count, rows } = await db.Product.findAndCountAll({
      where,
      include,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      order: [['created_at', 'DESC']]
    });

    return {
      items: rows,
      total: count,
      limit: filters.limit || 50,
      offset: filters.offset || 0
    };
  }

  /**
   * Обновление товара
   * @param {string} tenantId - ID тенанта
   * @param {string} productId - ID товара
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} Обновленный товар
   */
  async updateProduct(tenantId, productId, updateData) {
    const transaction = await db.sequelize.transaction();
    
    try {
      const product = await db.Product.findOne({
        where: { id: productId, tenant_id: tenantId },
        transaction
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Обновляем основные данные товара
      await product.update(updateData, { transaction });

      // Если есть данные по складам, обновляем их
      if (updateData.warehouse_data) {
        for (const warehouseData of updateData.warehouse_data) {
          const normalizedData = await this._normalizeWarehouseData(warehouseData);
          
          await WarehouseService.updateProductStock(
            warehouseData.warehouse_id,
            productId,
            normalizedData.stock,
            normalizedData.reserved || 0,
            normalizedData.purchase_price,
            transaction
          );
        }
      }

      await transaction.commit();
      return product;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Удаление товара
   * @param {string} tenantId - ID тенанта
   * @param {string} productId - ID товара
   * @returns {Promise<boolean>} Результат удаления
   */
  async deleteProduct(tenantId, productId) {
    const transaction = await db.sequelize.transaction();
    
    try {
      const product = await db.Product.findOne({
        where: { id: productId, tenant_id: tenantId },
        transaction
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Удаляем связанные данные со складов
      await WarehouseService.deleteProductFromAllWarehouses(productId, transaction);

      // Мягкое удаление товара
      await product.update({ is_active: false, deleted_at: new Date() }, { transaction });

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Импорт товаров из файла
   * @param {string} tenantId - ID тенанта
   * @param {string} filePath - Путь к файлу
   * @param {string} fileType - Тип файла (csv, xml, xlsx)
   * @returns {Promise<Object>} Результат импорта
   */
  async importFromFile(tenantId, filePath, fileType) {
    switch (fileType.toLowerCase()) {
      case 'csv':
        return await this.importFromCSV(filePath, tenantId);
      case 'xml':
      case 'yml':
        return await this.importFromXML(filePath, tenantId);
      case 'xlsx':
      case 'xls':
        return await this.importFromExcel(filePath, tenantId);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Импорт товаров из XML
   * @param {string} filePath - Путь к XML файлу
   * @param {string} tenantId - ID тенанта
   * @returns {Promise<Object>} Результат импорта
   */
  async importFromXML(filePath, tenantId) {
    const transaction = await db.sequelize.transaction();
    
    try {
      const xmlData = fs.readFileSync(filePath, 'utf8');
      const result = await parseStringPromise(xmlData);
      
      const products = result.yml_catalog?.shop?.[0]?.offers?.[0]?.offer || [];
      
      const imported = [];
      const errors = [];

      for (const productData of products) {
        try {
          const sku = productData.$.id;
          const name = productData.name?.[0] || '';
          const price = parseFloat(productData.price?.[0] || 0);
          const categoryId = productData.categoryId?.[0];

          // Нормализуем данные
          const normalizedPrice = await NormalizationService.normalizePriceToBase(price, 'RUB');
          const normalizedStock = parseInt(productData.stock?.[0] || 0);

          // Создаем товар
          const product = await this.createProduct({
            tenant_id: tenantId,
            sku,
            name,
            description: productData.description?.[0] || '',
            weight: parseFloat(productData.weight?.[0] || 0),
            created_by: tenantId
          }, [{
            warehouse_id: 1, // Основной склад
            stock: normalizedStock,
            purchase_price: normalizedPrice
          }]);

          imported.push({ sku, name, status: 'imported' });
        } catch (error) {
          errors.push({ 
            sku: productData.$.id, 
            error: error.message 
          });
        }
      }

      await transaction.commit();
      
      return {
        total: products.length,
        imported: imported.length,
        errors: errors.length,
        details: { imported, errors }
      };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Ошибка импорта XML: ${error.message}`);
    }
  }

  /**
   * Импорт товаров из CSV
   * @param {string} filePath - Путь к CSV файлу
   * @param {string} tenantId - ID тенанта
   * @returns {Promise<Object>} Результат импорта
   */
  async importFromCSV(filePath, tenantId) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          const transaction = await db.sequelize.transaction();
          
          try {
            const imported = [];
            
            for (const row of results) {
              try {
                const sku = row.sku || row.SKU;
                const name = row.name || row.Name;
                const price = parseFloat(row.price || row.Price || 0);
                const unit = row.unit || row.Unit || 'шт';
                const stock = parseFloat(row.stock || row.Stock || 0);

                // Нормализуем данные
                const normalizedPrice = await NormalizationService.normalizePriceToBase(price, unit);
                const normalizedStock = await NormalizationService.normalizeQuantityToBase(stock, unit);

                // Создаем товар
                const product = await this.createProduct({
                  tenant_id: tenantId,
                  sku,
                  name,
                  description: row.description || row.Description || '',
                  weight: parseFloat(row.weight || row.Weight || 0),
                  created_by: tenantId
                }, [{
                  warehouse_id: 1, // Основной склад
                  stock: normalizedStock,
                  purchase_price: normalizedPrice
                }]);

                imported.push({ sku, name, status: 'imported' });
              } catch (error) {
                errors.push({ 
                  sku: row.sku || row.SKU, 
                  error: error.message 
                });
              }
            }

            await transaction.commit();
            
            resolve({
              total: results.length,
              imported: imported.length,
              errors: errors.length,
              details: { imported, errors }
            });
          } catch (error) {
            await transaction.rollback();
            reject(new Error(`Ошибка импорта CSV: ${error.message}`));
          }
        })
        .on('error', (error) => {
          reject(new Error(`Ошибка чтения CSV файла: ${error.message}`));
        });
    });
  }

  /**
   * Импорт товаров из Excel
   * @param {string} filePath - Путь к Excel файлу
   * @param {string} tenantId - ID тенанта
   * @returns {Promise<Object>} Результат импорта
   */
  async importFromExcel(filePath, tenantId) {
    // Будущая реализация импорта из Excel
    throw new Error('Excel import not implemented yet');
  }

  /**
   * Экспорт товаров
   * @param {string} tenantId - ID тенанта
   * @param {string} format - Формат экспорта (csv, xml, xlsx)
   * @param {Object} filters - Фильтры для экспорта
   * @returns {Promise<string>} Путь к файлу экспорта
   */
  async exportProducts(tenantId, format, filters = {}) {
    const products = await this.getProducts(tenantId, filters);
    
    switch (format.toLowerCase()) {
      case 'csv':
        return await this._exportToCSV(products.items);
      case 'xml':
        return await this._exportToXML(products.items);
      case 'xlsx':
        return await this._exportToExcel(products.items);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Нормализация данных склада
   * @private
   */
  async _normalizeWarehouseData(warehouseData) {
    const normalizedData = { ...warehouseData };
    
    // Нормализуем количество
    if (normalizedData.stock) {
      normalizedData.stock = await NormalizationService.normalizeQuantityToBase(
        normalizedData.stock,
        normalizedData.unit || 'шт'
      );
    }
    
    // Нормализуем цену
    if (normalizedData.purchase_price) {
      normalizedData.purchase_price = await NormalizationService.normalizePriceToBase(
        normalizedData.purchase_price,
        normalizedData.currency || 'RUB'
      );
    }
    
    return normalizedData;
  }

  /**
   * Экспорт в CSV
   * @private
   */
  async _exportToCSV(products) {
    // Будущая реализация экспорта в CSV
    throw new Error('CSV export not implemented yet');
  }

  /**
   * Экспорт в XML
   * @private
   */
  async _exportToXML(products) {
    // Будущая реализация экспорта в XML
    throw new Error('XML export not implemented yet');
  }

  /**
   * Экспорт в Excel
   * @private
   */
  async _exportToExcel(products) {
    // Будущая реализация экспорта в Excel
    throw new Error('Excel export not implemented yet');
  }
}

module.exports = PIMService;