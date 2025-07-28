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
      
      // Возвращаем товар с агрегированными данными по складам
      return await this.getProductById(product.id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Ошибка создания товара: ${error.message}`);
    }
  }

  /**
   * Обновление товара
   * @param {number} productId - ID товара
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} Обновленный товар
   */
  async updateProduct(productId, updateData) {
    const transaction = await db.sequelize.transaction();
    
    try {
      const product = await db.Product.findByPk(productId);
      if (!product) {
        throw new Error('Товар не найден');
      }

      // Обновляем основные данные товара
      await product.update({
        name: updateData.name || product.name,
        description: updateData.description || product.description,
        category_id: updateData.category_id || product.category_id,
        brand_id: updateData.brand_id || product.brand_id,
        weight: updateData.weight !== undefined ? updateData.weight : product.weight,
        length: updateData.length !== undefined ? updateData.length : product.length,
        width: updateData.width !== undefined ? updateData.width : product.width,
        height: updateData.height !== undefined ? updateData.height : product.height,
        images: updateData.images || product.images,
        attributes: updateData.attributes || product.attributes,
        barcode: updateData.barcode || product.barcode,
        status: updateData.status || product.status,
        updated_by: updateData.updated_by
      }, { transaction });

      // Если переданы данные по складам, обновляем через WarehouseService
      if (updateData.warehouseData) {
        for (const warehouse of updateData.warehouseData) {
          const normalizedData = await this._normalizeWarehouseData(warehouse);
          
          await WarehouseService.updateProductStock(
            warehouse.warehouse_id,
            productId,
            normalizedData.stock,
            normalizedData.reserved || 0,
            normalizedData.purchase_price,
            transaction
          );
        }
      }

      await transaction.commit();
      return await this.getProductById(productId);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Ошибка обновления товара: ${error.message}`);
    }
  }

  /**
   * Получение товара по ID с агрегированными данными
   * @param {number} productId - ID товара
   * @returns {Promise<Object>} Товар с данными по складам
   */
  async getProductById(productId) {
    try {
      // Получаем основные данные товара
      const product = await db.Product.findByPk(productId, {
        include: [
          { model: db.Category, as: 'category' },
          { model: db.Brand, as: 'brand' }
        ]
      });

      if (!product) {
        throw new Error('Товар не найден');
      }

      // Получаем агрегированные данные по складам из представления
      const [stockData] = await db.sequelize.query(`
        SELECT * FROM v_product_total_stock WHERE product_id = :productId
      `, {
        replacements: { productId },
        type: db.sequelize.QueryTypes.SELECT
      });

      // Получаем детальные данные по каждому складу
      const warehouseDetails = await WarehouseService.getProductStockByWarehouses(productId);

      // Рассчитываем цены через PriceCalculationService
      const priceData = await PriceCalculationService.calculateProductPrices(productId);

      return {
        ...product.toJSON(),
        stockSummary: stockData || {
          total_stock: 0,
          total_reserved: 0,
          total_available: 0,
          warehouses_count: 0
        },
        warehouses: warehouseDetails,
        prices: priceData
      };
    } catch (error) {
      throw new Error(`Ошибка получения товара: ${error.message}`);
    }
  }

  /**
   * Получение списка товаров с фильтрацией и пагинацией
   * @param {Object} params - Параметры запроса
   * @returns {Promise<Object>} Список товаров и метаданные
   */
  async getProducts(params = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        category_id,
        brand_id,
        status = 'active',
        warehouse_id,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = params;

      const offset = (page - 1) * limit;
      const where = { status };

      // Добавляем условия фильтрации
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { sku: { [Op.iLike]: `%${search}%` } },
          { barcode: { [Op.iLike]: `%${search}%` } }
        ];
      }

      if (category_id) where.category_id = category_id;
      if (brand_id) where.brand_id = brand_id;

      // Получаем товары с базовой информацией
      const { count, rows: products } = await db.Product.findAndCountAll({
        where,
        include: [
          { model: db.Category, as: 'category' },
          { model: db.Brand, as: 'brand' }
        ],
        limit,
        offset,
        order: [[sort_by, sort_order]]
      });

      // Получаем агрегированные данные по складам для всех товаров
      const productIds = products.map(p => p.id);
      const stockDataQuery = productIds.length > 0 ? `
        SELECT * FROM v_product_total_stock 
        WHERE product_id IN (:productIds)
        ${warehouse_id ? 'AND warehouse_id = :warehouse_id' : ''}
      ` : null;

      let stockDataMap = {};
      if (stockDataQuery) {
        const stockData = await db.sequelize.query(stockDataQuery, {
          replacements: { 
            productIds,
            ...(warehouse_id && { warehouse_id })
          },
          type: db.sequelize.QueryTypes.SELECT
        });

        stockDataMap = stockData.reduce((acc, item) => {
          acc[item.product_id] = item;
          return acc;
        }, {});
      }

      // Формируем результат с агрегированными данными
      const enrichedProducts = await Promise.all(
        products.map(async (product) => {
          const priceData = await PriceCalculationService.calculateProductPrices(product.id);
          
          return {
            ...product.toJSON(),
            stockSummary: stockDataMap[product.id] || {
              total_stock: 0,
              total_reserved: 0,
              total_available: 0,
              warehouses_count: 0
            },
            prices: priceData
          };
        })
      );

      return {
        products: enrichedProducts,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      throw new Error(`Ошибка получения списка товаров: ${error.message}`);
    }
  }

  /**
   * Импорт товаров из XML
   * @param {string} filePath - Путь к XML файлу
   * @param {number} userId - ID пользователя
   * @returns {Promise<Object>} Результат импорта
   */
  async importFromXML(filePath, userId) {
    const transaction = await db.sequelize.transaction();
    
    try {
      const xmlData = fs.readFileSync(filePath, 'utf8');
      const result = await parseStringPromise(xmlData);
      
      const products = result.products?.product || [];
      const imported = [];
      const errors = [];

      for (const productData of products) {
        try {
          // Извлекаем данные из XML
          const sku = productData.sku?.[0];
          const name = productData.name?.[0];
          const price = parseFloat(productData.price?.[0] || 0);
          const unit = productData.unit?.[0] || 'шт';
          const stock = parseFloat(productData.stock?.[0] || 0);
          const warehouse_id = productData.warehouse_id?.[0] || 1;

          // Нормализуем цену и количество
          const normalizedPrice = await NormalizationService.normalizePriceToBase(
            price,
            unit
          );
          const normalizedStock = await NormalizationService.normalizeQuantityToBase(
            stock,
            unit
          );

          // Проверяем существование товара
          let product = await db.Product.findOne({ where: { sku } });

          if (product) {
            // Обновляем существующий товар
            await this.updateProduct(product.id, {
              name,
              updated_by: userId,
              warehouseData: [{
                warehouse_id,
                stock: normalizedStock,
                purchase_price: normalizedPrice
              }]
            });
          } else {
            // Создаем новый товар
            product = await this.createProduct({
              sku,
              name,
              description: productData.description?.[0] || '',
              weight: parseFloat(productData.weight?.[0] || 0),
              created_by: userId
            }, [{
              warehouse_id,
              stock: normalizedStock,
              purchase_price: normalizedPrice
            }]);
          }

          imported.push({ sku, name, status: 'imported' });
        } catch (error) {
          errors.push({ 
            sku: productData.sku?.[0], 
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
   * @param {number} userId - ID пользователя
   * @returns {Promise<Object>} Результат импорта
   */
  async importFromCSV(filePath, userId) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          const transaction = await db.sequelize.transaction();
          
          try {
            for (const row of results) {
              try {
                const sku = row.sku || row.SKU;
                const name = row.name || row.Name;
                const price = parseFloat(row.price || row.Price || 0);
                const unit = row.unit || row.Unit || 'шт';
                const stock = parseFloat(row.stock || row.Stock || 0);
                const warehouse_id = row.warehouse_id || 1;

                // Нормализуем данные
                const normalizedPrice = await NormalizationService.normalizePriceToBase(
                  price,
                  unit
                );
                const normalizedStock = await NormalizationService.normalizeQuantityToBase(
                  stock,
                  unit
                );

                // Проверяем существование товара
                let product = await db.Product.findOne({ where: { sku } });

                if (product) {
                  await this.updateProduct(product.id, {
                    name,
                    updated_by: userId,
                    warehouseData: [{
                      warehouse_id,
                      stock: normalizedStock,
                      purchase_price: normalizedPrice
                    }]
                  });
                } else {
                  await this.createProduct({
                    sku,
                    name,
                    description: row.description || '',
                    weight: parseFloat(row.weight || 0),
                    created_by: userId
                  }, [{
                    warehouse_id,
                    stock: normalizedStock,
                    purchase_price: normalizedPrice
                  }]);
                }
              } catch (error) {
                errors.push({ 
                  row: row.sku || 'Unknown', 
                  error: error.message 
                });
              }
            }

            await transaction.commit();
            
            resolve({
              total: results.length,
              imported: results.length - errors.length,
              errors: errors.length,
              details: { errors }
            });
          } catch (error) {
            await transaction.rollback();
            reject(new Error(`Ошибка импорта CSV: ${error.message}`));
          }
        })
        .on('error', reject);
    });
  }

  /**
   * Массовое обновление цен
   * @param {Array} priceUpdates - Массив обновлений цен
   * @returns {Promise<Object>} Результат обновления
   */
  async bulkUpdatePrices(priceUpdates) {
    const transaction = await db.sequelize.transaction();
    
    try {
      const results = {
        updated: 0,
        errors: []
      };

      for (const update of priceUpdates) {
        try {
          const { product_id, warehouse_id, new_price, unit = 'шт' } = update;
          
          // Нормализуем новую цену
          const normalizedPrice = await NormalizationService.normalizePriceToBase(
            new_price,
            unit
          );

          // Обновляем цену через WarehouseService
          await WarehouseService.updateProductPrice(
            warehouse_id,
            product_id,
            normalizedPrice,
            transaction
          );

          results.updated++;
        } catch (error) {
          results.errors.push({
            product_id: update.product_id,
            error: error.message
          });
        }
      }

      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Ошибка массового обновления цен: ${error.message}`);
    }
  }

  /**
   * Приватный метод для нормализации данных склада
   * @private
   */
  async _normalizeWarehouseData(warehouseData) {
    const unit = warehouseData.unit || 'шт';
    
    return {
      stock: await NormalizationService.normalizeQuantityToBase(
        warehouseData.stock || 0,
        unit
      ),
      reserved: await NormalizationService.normalizeQuantityToBase(
        warehouseData.reserved || 0,
        unit
      ),
      purchase_price: await NormalizationService.normalizePriceToBase(
        warehouseData.purchase_price || 0,
        unit
      )
    };
  }

  /**
   * Получение товаров с низким остатком
   * @param {number} threshold - Порог минимального остатка
   * @returns {Promise<Array>} Список товаров
   */
  async getLowStockProducts(threshold = 10) {
    try {
      const products = await db.sequelize.query(`
        SELECT 
          p.*,
          v.total_available,
          v.total_stock,
          v.warehouses_count
        FROM products p
        JOIN v_product_total_stock v ON p.id = v.product_id
        WHERE v.total_available <= :threshold
        AND p.status = 'active'
        ORDER BY v.total_available ASC
      `, {
        replacements: { threshold },
        type: db.sequelize.QueryTypes.SELECT
      });

      return products;
    } catch (error) {
      throw new Error(`Ошибка получения товаров с низким остатком: ${error.message}`);
    }
  }
}

module.exports = new PIMService();
