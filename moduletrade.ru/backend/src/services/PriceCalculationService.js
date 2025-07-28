// backend/src/services/PriceCalculationService.js
const db = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class PriceCalculationService {
  /**
   * Пересчет цен для всех товаров тенанта
   */
  async recalculateAllPrices(tenantId) {
    logger.info(`Starting price recalculation for tenant ${tenantId}`);
    
    const trx = await db.transaction();
    
    try {
      // Получаем все товары с поставщиками
      const products = await trx('products')
        .where({ 'products.tenant_id': tenantId })
        .select('products.id');

      let updated = 0;
      for (const product of products) {
        await this.recalculatePricesForProduct(trx, tenantId, product.id);
        updated++;
      }

      await trx.commit();
      
      logger.info(`Price recalculation completed. Updated ${updated} products`);
      return { success: true, updated };
      
    } catch (error) {
      await trx.rollback();
      logger.error('Error in price recalculation:', error);
      throw error;
    }
  }

  /**
   * Пересчет цен для конкретного товара
   */
  async recalculatePricesForProduct(trx, tenantId, productId) {
    try {
      // Получаем информацию о товаре
      const product = await trx('products')
        .where({ id: productId, tenant_id: tenantId })
        .first();

      if (!product) {
        throw new Error('Product not found');
      }

      // Получаем все связи товара с маркетплейсами
      const marketplaceLinks = await trx('marketplace_product_links')
        .where({ product_id: productId })
        .join('marketplaces', 'marketplace_product_links.marketplace_id', 'marketplaces.id')
        .select(
          'marketplace_product_links.*',
          'marketplaces.pricing_rules',
          'marketplaces.name as marketplace_name'
        );

      // Получаем курсы валют
      const exchangeRates = await this.getExchangeRates(trx);

      for (const link of marketplaceLinks) {
        const calculatedPrice = await this.calculatePrice(
          trx,
          product,
          link,
          exchangeRates
        );

        // Обновляем цену в базе
        await trx('marketplace_product_links')
          .where({ id: link.id })
          .update({
            price: calculatedPrice.finalPrice,
            price_calculated_at: new Date(),
            price_calculation_log: JSON.stringify(calculatedPrice.calculationLog)
          });

        logger.debug(`Updated price for product ${productId} on ${link.marketplace_name}: ${calculatedPrice.finalPrice}`);
      }

    } catch (error) {
      logger.error(`Error recalculating prices for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Расчет цены для товара на маркетплейсе
   */
  async calculatePrice(trx, product, marketplaceLink, exchangeRates) {
    const calculationLog = [];
    
    // Получаем минимальную цену поставщика с учетом доступности
    const supplierPrices = await trx('product_suppliers')
      .where({ 
        product_id: product.id,
        is_available: true
      })
      .select('*');

    if (supplierPrices.length === 0) {
      calculationLog.push('No available suppliers found');
      return {
        finalPrice: marketplaceLink.price || 0,
        calculationLog
      };
    }

    // Находим минимальную цену с учетом валют
    let minSupplierPrice = Infinity;
    let selectedSupplier = null;
    let mrcPrice = null;

    for (const supplier of supplierPrices) {
      // Конвертируем цену в рубли
      const priceInRub = this.convertToRub(
        supplier.original_price,
        supplier.currency,
        exchangeRates
      );

      calculationLog.push(
        `Supplier ${supplier.supplier_id}: ${supplier.original_price} ${supplier.currency} = ${priceInRub} RUB`
      );

      if (priceInRub < minSupplierPrice) {
        minSupplierPrice = priceInRub;
        selectedSupplier = supplier;
      }

      // Сохраняем максимальную МРЦ
      if (supplier.mrc_price && supplier.enforce_mrc) {
        const mrcInRub = this.convertToRub(
          supplier.mrc_price,
          supplier.currency,
          exchangeRates
        );
        
        if (!mrcPrice || mrcInRub > mrcPrice) {
          mrcPrice = mrcInRub;
        }
      }
    }

    calculationLog.push(`Selected supplier price: ${minSupplierPrice} RUB`);
    
    // Применяем правила ценообразования маркетплейса
    const pricingRules = JSON.parse(marketplaceLink.pricing_rules || '{}');
    let calculatedPrice = minSupplierPrice;

    // Применяем наценку
    if (pricingRules.markup_type === 'percentage') {
      calculatedPrice = minSupplierPrice * (1 + pricingRules.markup_value / 100);
      calculationLog.push(`Applied ${pricingRules.markup_value}% markup: ${calculatedPrice}`);
    } else if (pricingRules.markup_type === 'fixed') {
      calculatedPrice = minSupplierPrice + pricingRules.markup_value;
      calculationLog.push(`Applied ${pricingRules.markup_value} RUB fixed markup: ${calculatedPrice}`);
    }

    // Добавляем дополнительные расходы
    if (marketplaceLink.additional_expenses > 0) {
      calculatedPrice += marketplaceLink.additional_expenses;
      calculationLog.push(`Added additional expenses: ${marketplaceLink.additional_expenses} RUB`);
    }

    // Учитываем комиссию маркетплейса
    if (pricingRules.commission_percentage > 0) {
      calculatedPrice = calculatedPrice / (1 - pricingRules.commission_percentage / 100);
      calculationLog.push(`Adjusted for ${pricingRules.commission_percentage}% commission: ${calculatedPrice}`);
    }

    // Округляем согласно правилам
    calculatedPrice = this.applyRounding(calculatedPrice, pricingRules.rounding_rule);
    calculationLog.push(`Applied rounding (${pricingRules.rounding_rule || 'none'}): ${calculatedPrice}`);

    // Применяем МРЦ, если есть
    if (mrcPrice && calculatedPrice < mrcPrice) {
      calculationLog.push(`Price below MRC (${mrcPrice}), using MRC`);
      calculatedPrice = mrcPrice;
    }

    // Проверяем минимальную и максимальную цену
    if (pricingRules.min_price && calculatedPrice < pricingRules.min_price) {
      calculatedPrice = pricingRules.min_price;
      calculationLog.push(`Applied minimum price: ${pricingRules.min_price}`);
    }

    if (pricingRules.max_price && calculatedPrice > pricingRules.max_price) {
      calculatedPrice = pricingRules.max_price;
      calculationLog.push(`Applied maximum price: ${pricingRules.max_price}`);
    }

    // Конвертируем в валюту маркетплейса, если необходимо
    let finalPrice = calculatedPrice;
    if (marketplaceLink.currency && marketplaceLink.currency !== 'RUB') {
      finalPrice = this.convertFromRub(
        calculatedPrice,
        marketplaceLink.currency,
        exchangeRates
      );
      calculationLog.push(`Converted to ${marketplaceLink.currency}: ${finalPrice}`);
    }

    return {
      finalPrice: Math.round(finalPrice * 100) / 100, // Округляем до копеек
      calculationLog,
      supplierPrice: minSupplierPrice,
      supplierId: selectedSupplier?.supplier_id
    };
  }

  /**
   * Получение курсов валют
   */
  async getExchangeRates(trx) {
    const rates = await trx('exchange_rates').select('*');
    
    const ratesMap = {};
    rates.forEach(rate => {
      ratesMap[rate.currency_code] = rate.rate;
    });

    // Убеждаемся, что рубль есть
    if (!ratesMap['RUB']) {
      ratesMap['RUB'] = 1;
    }

    return ratesMap;
  }

  /**
   * Конвертация в рубли
   */
  convertToRub(amount, currency, exchangeRates) {
    if (!amount || currency === 'RUB') {
      return amount || 0;
    }

    const rate = exchangeRates[currency];
    if (!rate) {
      logger.warn(`Exchange rate not found for currency: ${currency}`);
      return amount; // Возвращаем как есть, если курс не найден
    }

    return amount * rate;
  }

  /**
   * Конвертация из рублей
   */
  convertFromRub(amount, currency, exchangeRates) {
    if (!amount || currency === 'RUB') {
      return amount || 0;
    }

    const rate = exchangeRates[currency];
    if (!rate) {
      logger.warn(`Exchange rate not found for currency: ${currency}`);
      return amount; // Возвращаем как есть, если курс не найден
    }

    return amount / rate;
  }

  /**
   * Применение правил округления
   */
  applyRounding(price, roundingRule) {
    if (!roundingRule || roundingRule === 'none') {
      return price;
    }

    switch (roundingRule) {
      case 'up_10':
        return Math.ceil(price / 10) * 10;
      
      case 'up_50':
        return Math.ceil(price / 50) * 50;
      
      case 'up_100':
        return Math.ceil(price / 100) * 100;
      
      case 'down_10':
        return Math.floor(price / 10) * 10;
      
      case 'down_50':
        return Math.floor(price / 50) * 50;
      
      case 'down_100':
        return Math.floor(price / 100) * 100;
      
      case 'nearest_10':
        return Math.round(price / 10) * 10;
      
      case 'nearest_50':
        return Math.round(price / 50) * 50;
      
      case 'nearest_100':
        return Math.round(price / 100) * 100;
      
      case '99_ending':
        return Math.floor(price / 100) * 100 + 99;
      
      case '90_ending':
        return Math.floor(price / 100) * 100 + 90;
      
      default:
        return price;
    }
  }

  /**
   * Обновление курсов валют
   */
  async updateExchangeRates(rates) {
    const trx = await db.transaction();
    
    try {
      for (const [currency, rate] of Object.entries(rates)) {
        await trx('exchange_rates')
          .insert({
            id: uuidv4(),
            currency_code: currency,
            rate: rate,
            updated_at: new Date()
          })
          .onConflict('currency_code')
          .merge({
            rate: rate,
            updated_at: new Date()
          });
      }

      await trx.commit();
      logger.info('Exchange rates updated successfully');
      
    } catch (error) {
      await trx.rollback();
      logger.error('Error updating exchange rates:', error);
      throw error;
    }
  }

  /**
   * Получение истории расчета цены
   */
  async getPriceHistory(productId, marketplaceId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await db('price_history')
      .where({
        product_id: productId,
        marketplace_id: marketplaceId
      })
      .where('created_at', '>=', startDate)
      .orderBy('created_at', 'desc')
      .select('*');

    return history.map(record => ({
      date: record.created_at,
      price: record.price,
      supplierPrice: record.supplier_price,
      calculationLog: JSON.parse(record.calculation_log || '[]')
    }));
  }

  /**
   * Сохранение истории цены
   */
  async savePriceHistory(productId, marketplaceId, priceData) {
    try {
      await db('price_history').insert({
        id: uuidv4(),
        product_id: productId,
        marketplace_id: marketplaceId,
        price: priceData.finalPrice,
        supplier_price: priceData.supplierPrice,
        supplier_id: priceData.supplierId,
        calculation_log: JSON.stringify(priceData.calculationLog),
        created_at: new Date()
      });
    } catch (error) {
      logger.error('Error saving price history:', error);
      // Не прерываем основной процесс из-за ошибки сохранения истории
    }
  }

  /**
   * Массовое обновление цен с оптимизацией
   */
  async bulkUpdatePrices(tenantId, productIds = null) {
    logger.info(`Starting bulk price update for tenant ${tenantId}`);
    
    const batchSize = 100;
    let offset = 0;
    let totalUpdated = 0;

    // Получаем курсы валют один раз
    const exchangeRates = await this.getExchangeRates(db);

    while (true) {
      // Получаем батч товаров
      let query = db('products')
        .where({ tenant_id: tenantId })
        .limit(batchSize)
        .offset(offset);

      if (productIds && productIds.length > 0) {
        query = query.whereIn('id', productIds);
      }

      const products = await query.select('id');

      if (products.length === 0) {
        break;
      }

      // Обновляем цены для батча
      const trx = await db.transaction();
      
      try {
        for (const product of products) {
          await this.recalculatePricesForProduct(trx, tenantId, product.id);
          totalUpdated++;
        }
        
        await trx.commit();
      } catch (error) {
        await trx.rollback();
        logger.error(`Error updating batch at offset ${offset}:`, error);
      }

      offset += batchSize;
      
      // Небольшая пауза между батчами
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info(`Bulk price update completed. Updated ${totalUpdated} products`);
    return { success: true, updated: totalUpdated };
  }
}

module.exports = PriceCalculationService;
