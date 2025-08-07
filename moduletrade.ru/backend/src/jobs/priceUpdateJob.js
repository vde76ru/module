// ===================================================
// ФАЙЛ: backend/src/jobs/priceUpdateJob.js
// ЗАДАЧА ОБНОВЛЕНИЯ ЦЕН: Автоматическое обновление цен товаров
// ===================================================

const db = require('../config/database');
const logger = require('../utils/logger');

class PriceUpdateJob {
  /**
   * Обновление цен для всех активных товаров
   */
  static async updatePrices() {
    try {
      logger.info('Starting price update job...');

      // Получаем все активные компании
      const companies = await this.getActiveCompanies();

      for (const company of companies) {
        try {
          await this.updateCompanyPrices(company);
        } catch (error) {
          logger.error(`Error updating prices for company ${company.id}:`, error);
        }
      }

      logger.info('Price update job completed');

    } catch (error) {
      logger.error('Error in price update job:', error);
    }
  }

  /**
   * Получение активных компаний
   */
  static async getActiveCompanies() {
    const result = await db.query(`
      SELECT id, name, subscription_status
      FROM companies
      WHERE is_active = true
        AND subscription_status IN ('active', 'trial')
    `);

    return result.rows;
  }

  /**
   * Обновление цен для компании
   */
  static async updateCompanyPrices(company) {
    logger.info(`Updating prices for company: ${company.name}`);

    // Получаем товары, требующие обновления цен
    const products = await this.getProductsForPriceUpdate(company.id);

    let updatedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        await this.updateProductPrices(product);
        updatedCount++;
      } catch (error) {
        logger.error(`Error updating prices for product ${product.id}:`, error);
        errorCount++;
      }
    }

    logger.info(`Updated prices for ${updatedCount} products, errors: ${errorCount} for company ${company.name}`);
  }

  /**
   * Получение товаров для обновления цен
   */
  static async getProductsForPriceUpdate(companyId) {
    const result = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.internal_code,
        p.main_supplier_id,
        p.brand_id,
        p.category_id,
        p.mrp_price,
        p.rrp_price,
        wpl.purchase_price,
        wpl.warehouse_id
      FROM products p
      JOIN warehouse_product_links wpl ON p.id = wpl.product_id
      WHERE p.company_id = $1
        AND p.is_active = true
        AND wpl.purchase_price IS NOT NULL
        AND (
          wpl.wholesale_price IS NULL 
          OR wpl.retail_price IS NULL 
          OR wpl.website_price IS NULL 
          OR wpl.marketplace_price IS NULL
          OR p.updated_at > wpl.updated_at
        )
    `, [companyId]);

    return result.rows;
  }

  /**
   * Обновление цен для товара
   */
  static async updateProductPrices(product) {
    // Получаем правила расчета цен
    const priceRules = await this.getPriceCalculationRules(product);

    // Рассчитываем новые цены
    const newPrices = await this.calculatePrices(product, priceRules);

    // Обновляем цены в базе данных
    await this.updateWarehousePrices(product.warehouse_id, product.id, newPrices);

    // Логируем обновление цен
    await this.logPriceUpdate(product, newPrices);
  }

  /**
   * Получение правил расчета цен
   */
  static async getPriceCalculationRules(product) {
    const result = await db.query(`
      SELECT 
        rule_type,
        price_type,
        priority,
        settings
      FROM price_calculation_rules
      WHERE company_id = $1
        AND (warehouse_id IS NULL OR warehouse_id = $2)
        AND (brand_id IS NULL OR brand_id = $3)
        AND (category_id IS NULL OR category_id = $4)
        AND is_active = true
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until >= NOW())
      ORDER BY priority DESC
    `, [product.company_id, product.warehouse_id, product.brand_id, product.category_id]);

    return result.rows;
  }

  /**
   * Расчет цен на основе правил
   */
  static async calculatePrices(product, priceRules) {
    const basePrice = product.purchase_price;
    const prices = {
      wholesale_price: basePrice,
      retail_price: basePrice,
      website_price: basePrice,
      marketplace_price: basePrice
    };

    // Применяем правила расчета цен
    for (const rule of priceRules) {
      const priceType = rule.price_type;
      const settings = typeof rule.settings === 'string' 
        ? JSON.parse(rule.settings) 
        : rule.settings;

      switch (rule.rule_type) {
        case 'markup':
          const markup = settings.markup || 0;
          prices[priceType] = basePrice * (1 + markup / 100);
          break;

        case 'discount':
          const discount = settings.discount || 0;
          prices[priceType] = basePrice * (1 - discount / 100);
          break;

        case 'fixed':
          prices[priceType] = settings.price || basePrice;
          break;

        case 'formula':
          prices[priceType] = this.evaluateFormula(settings.formula, basePrice, product);
          break;
      }
    }

    // Проверяем МРЦ/РРЦ
    if (product.mrp_price && prices.retail_price < product.mrp_price) {
      prices.retail_price = product.mrp_price;
    }

    if (product.rrp_price && prices.retail_price > product.rrp_price) {
      prices.retail_price = product.rrp_price;
    }

    // Округляем цены до 2 знаков
    for (const priceType in prices) {
      prices[priceType] = Math.round(prices[priceType] * 100) / 100;
    }

    return prices;
  }

  /**
   * Вычисление формулы цены
   */
  static evaluateFormula(formula, basePrice, product) {
    // Простая реализация формул
    // В реальном проекте можно использовать более сложный парсер
    try {
      const context = {
        basePrice,
        mrp: product.mrp_price || 0,
        rrp: product.rrp_price || 0,
        brand: product.brand_id,
        category: product.category_id
      };

      // Заменяем переменные в формуле
      let evaluatedFormula = formula;
      for (const [key, value] of Object.entries(context)) {
        evaluatedFormula = evaluatedFormula.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
      }

      // Вычисляем формулу (осторожно!)
      return eval(evaluatedFormula);

    } catch (error) {
      logger.error(`Error evaluating price formula: ${formula}`, error);
      return basePrice;
    }
  }

  /**
   * Обновление цен в базе данных
   */
  static async updateWarehousePrices(warehouseId, productId, prices) {
    await db.query(`
      UPDATE warehouse_product_links
      SET 
        wholesale_price = $1,
        retail_price = $2,
        website_price = $3,
        marketplace_price = $4,
        updated_at = NOW()
      WHERE warehouse_id = $5 AND product_id = $6
    `, [
      prices.wholesale_price,
      prices.retail_price,
      prices.website_price,
      prices.marketplace_price,
      warehouseId,
      productId
    ]);
  }

  /**
   * Логирование обновления цен
   */
  static async logPriceUpdate(product, newPrices) {
    try {
      await db.query(`
        INSERT INTO price_update_logs (
          product_id, warehouse_id, old_prices, new_prices, updated_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [
        product.id,
        product.warehouse_id,
        JSON.stringify({
          wholesale_price: product.wholesale_price,
          retail_price: product.retail_price,
          website_price: product.website_price,
          marketplace_price: product.marketplace_price
        }),
        JSON.stringify(newPrices)
      ]);

    } catch (error) {
      logger.error('Error logging price update:', error);
    }
  }

  /**
   * Принудительное обновление цен для товара
   */
  static async forceUpdateProductPrices(productId) {
    try {
      logger.info(`Force updating prices for product ${productId}`);

      const product = await this.getProductById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      await this.updateProductPrices(product);

      logger.info(`Force price update completed for product ${productId}`);

    } catch (error) {
      logger.error(`Error in force price update for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Получение товара по ID
   */
  static async getProductById(productId) {
    const result = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.internal_code,
        p.main_supplier_id,
        p.brand_id,
        p.category_id,
        p.mrp_price,
        p.rrp_price,
        p.company_id,
        wpl.purchase_price,
        wpl.warehouse_id
      FROM products p
      JOIN warehouse_product_links wpl ON p.id = wpl.product_id
      WHERE p.id = $1 AND p.is_active = true
    `, [productId]);

    return result.rows[0] || null;
  }

  /**
   * Получение истории изменений цен
   */
  static async getPriceHistory(productId, days = 30) {
    const result = await db.query(`
      SELECT 
        old_prices,
        new_prices,
        updated_at
      FROM price_update_logs
      WHERE product_id = $1
        AND updated_at >= NOW() - INTERVAL '${days} days'
      ORDER BY updated_at DESC
    `, [productId]);

    return result.rows.map(row => ({
      old_prices: typeof row.old_prices === 'string' 
        ? JSON.parse(row.old_prices) 
        : row.old_prices,
      new_prices: typeof row.new_prices === 'string' 
        ? JSON.parse(row.new_prices) 
        : row.new_prices,
      updated_at: row.updated_at
    }));
  }
}

module.exports = PriceUpdateJob; 