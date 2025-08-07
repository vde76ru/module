// Модуль: Backend Service - Управление складами
// Файл: backend/src/services/WarehouseService.js
// Основание: Требования пользователя, система складов из "Внесенные правки 4.pdf"
// Действие: Создание сервиса для управления складами и остатками

const db = require('../config/database');
const logger = require('../utils/logger');
const redis = require('../config/redis');

class WarehouseService {
  /**
   * Создание склада
   */
  static async createWarehouse(companyId, warehouseData) {
    const query = `
      INSERT INTO warehouses (
        company_id, name, type, city, address, contact_person,
        phone, email, is_active, settings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
      RETURNING *
    `;

    const result = await db.query(query, [
      companyId, warehouseData.name, warehouseData.type, warehouseData.city,
      warehouseData.address, warehouseData.contact_person, warehouseData.phone,
      warehouseData.email, warehouseData.is_active || true, warehouseData.settings || {}
    ]);

    return result.rows[0];
  }

  /**
   * Получение всех складов компании
   */
  static async getWarehouses(companyId, filters = {}) {
    let whereConditions = ['company_id = $1'];
    let params = [companyId];
    let paramIndex = 2;

    if (filters.type) {
      whereConditions.push(`type = $${paramIndex}`);
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.city) {
      whereConditions.push(`city ILIKE $${paramIndex}`);
      params.push(`%${filters.city}%`);
      paramIndex++;
    }

    if (filters.is_active !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      params.push(filters.is_active);
      paramIndex++;
    }

    const query = `
      SELECT w.*,
             COUNT(DISTINCT wm.marketplace_id) as connected_marketplaces,
             COUNT(DISTINCT ws.product_id) as total_products
      FROM warehouses w
      LEFT JOIN warehouse_marketplace_connections wm ON w.id = wm.warehouse_id
      LEFT JOIN warehouse_product_links ws ON w.id = ws.warehouse_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY w.id
      ORDER BY w.created_at DESC
    `;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Подключение маркетплейса к складу
   */
  static async connectMarketplace(warehouseId, marketplaceId, settings = {}) {
    const query = `
      INSERT INTO warehouse_marketplace_connections (
        warehouse_id, marketplace_id, settings, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, true, now(), now())
      ON CONFLICT (warehouse_id, marketplace_id)
      DO UPDATE SET
        settings = EXCLUDED.settings,
        is_active = true,
        updated_at = now()
    `;

    await db.query(query, [warehouseId, marketplaceId, settings]);
  }

  /**
   * Отключение маркетплейса от склада
   */
  static async disconnectMarketplace(warehouseId, marketplaceId) {
    const query = `
      UPDATE warehouse_marketplace_connections
      SET is_active = false, updated_at = now()
      WHERE warehouse_id = $1 AND marketplace_id = $2
    `;

    await db.query(query, [warehouseId, marketplaceId]);
  }

  /**
   * Обновление остатков на складе
   */
  static async updateStock(warehouseId, productId, quantity, priceData = {}) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Обновляем остаток
      const stockQuery = `
        INSERT INTO warehouse_product_links (
          warehouse_id, product_id, quantity, price,
          reserved_quantity, available_quantity,
          last_updated, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 0, $3, now(), now(), now())
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET
          quantity = EXCLUDED.quantity,
          price = EXCLUDED.price,
          available_quantity = EXCLUDED.quantity - reserved_quantity,
          last_updated = now(),
          updated_at = now()
      `;

      await client.query(stockQuery, [
        warehouseId, productId, quantity,
        priceData.price || 0
      ]);

      // Обновляем кэш
      await this.updateStockCache(warehouseId, productId);

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Расчет цен для товара
   */
  static async calculatePrices(companyId, productId, warehouseId, basePrice) {
    // Получаем настройки бренда
    const brandSettings = await this.getBrandSettings(companyId, productId);

    // Получаем настройки маркетплейсов
    const marketplaceSettings = await this.getMarketplaceSettings(warehouseId);

    // Получаем настройки ценовой политики
    const pricingSettings = await this.getPricingSettings(companyId);

    const prices = {
      purchase_price: basePrice,
      wholesale_price: this.calculateWholesalePrice(basePrice, brandSettings),
      retail_price: this.calculateRetailPrice(basePrice, brandSettings),
      website_price: this.calculateWebsitePrice(basePrice, brandSettings, pricingSettings),
      marketplace_price: this.calculateMarketplacePrice(basePrice, brandSettings, marketplaceSettings),
      mrp_price: brandSettings.mrp_price || 0,
      rrp_price: brandSettings.rrp_price || 0
    };

    // Проверяем ограничения цен
    prices.website_price = this.applyPriceConstraints(prices.website_price, brandSettings, pricingSettings);
    prices.marketplace_price = this.applyPriceConstraints(prices.marketplace_price, brandSettings, pricingSettings);

    return prices;
  }

  /**
   * Расчет оптовой цены
   */
  static calculateWholesalePrice(basePrice, brandSettings) {
    const markup = brandSettings.wholesale_markup || 0.15; // 15% по умолчанию
    return basePrice * (1 + markup);
  }

  /**
   * Расчет розничной цены
   */
  static calculateRetailPrice(basePrice, brandSettings) {
    const markup = brandSettings.retail_markup || 0.30; // 30% по умолчанию
    return basePrice * (1 + markup);
  }

  /**
   * Расчет цены для сайта
   */
  static calculateWebsitePrice(basePrice, brandSettings, pricingSettings) {
    let websitePrice = this.calculateRetailPrice(basePrice, brandSettings);

    // Применяем динамические правила
    if (pricingSettings.website_price_rules) {
      for (const rule of pricingSettings.website_price_rules) {
        if (this.evaluatePriceRule(websitePrice, rule)) {
          websitePrice = this.applyPriceRule(websitePrice, rule);
        }
      }
    }

    return websitePrice;
  }

  /**
   * Расчет цены для маркетплейса
   */
  static calculateMarketplacePrice(basePrice, brandSettings, marketplaceSettings) {
    let marketplacePrice = this.calculateRetailPrice(basePrice, brandSettings);

    // Применяем комиссии маркетплейсов
    for (const marketplace of marketplaceSettings) {
      const commission = marketplace.commission_rate || 0;
      marketplacePrice = marketplacePrice / (1 - commission);
    }

    return marketplacePrice;
  }

  /**
   * Применение ограничений цен
   */
  static applyPriceConstraints(price, brandSettings, pricingSettings) {
    let constrainedPrice = price;

    // Проверяем МРЦ
    if (brandSettings.enforce_mrp && brandSettings.mrp_price) {
      if (constrainedPrice < brandSettings.mrp_price) {
        constrainedPrice = brandSettings.mrp_price;
      }
    }

    // Проверяем РРЦ
    if (brandSettings.enforce_rrp && brandSettings.rrp_price) {
      if (constrainedPrice > brandSettings.rrp_price) {
        constrainedPrice = brandSettings.rrp_price;
      }
    }

    // Проверяем минимальную цену
    if (pricingSettings.min_price_percentage) {
      const minPrice = brandSettings.purchase_price * (1 + pricingSettings.min_price_percentage);
      if (constrainedPrice < minPrice) {
        constrainedPrice = minPrice;
      }
    }

    return constrainedPrice;
  }

  /**
   * Получение настроек бренда
   */
  static async getBrandSettings(companyId, productId) {
    const query = `
      SELECT b.* FROM brands b
      JOIN products p ON p.brand_id = b.id
      WHERE p.company_id = $1 AND p.id = $2
    `;

    const result = await db.query(query, [companyId, productId]);
    return result.rows[0] || {};
  }

  /**
   * Получение настроек маркетплейсов для склада
   */
  static async getMarketplaceSettings(warehouseId) {
    const query = `
      SELECT m.*, wmc.settings as connection_settings
      FROM marketplaces m
      JOIN warehouse_marketplace_connections wmc ON m.id = wmc.marketplace_id
      WHERE wmc.warehouse_id = $1 AND wmc.is_active = true
    `;

    const result = await db.query(query, [warehouseId]);
    return result.rows;
  }

  /**
   * Получение настроек ценовой политики
   */
  static async getPricingSettings(companyId) {
    const query = `
      SELECT * FROM pricing_settings
      WHERE company_id = $1 AND is_active = true
    `;

    const result = await db.query(query, [companyId]);
    return result.rows[0] || {};
  }

  /**
   * Обновление кэша остатков
   */
  static async updateStockCache(warehouseId, productId) {
    const cacheKey = `stock:${warehouseId}:${productId}`;

    const query = `
      SELECT * FROM warehouse_product_links
      WHERE warehouse_id = $1 AND product_id = $2
    `;

    const result = await db.query(query, [warehouseId, productId]);

    if (result.rows.length > 0) {
      await redis.setex(cacheKey, 3600, JSON.stringify(result.rows[0]));
    }
  }

  /**
   * Получение остатков с кэша
   */
  static async getStockFromCache(warehouseId, productId) {
    const cacheKey = `stock:${warehouseId}:${productId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Если нет в кэше, получаем из БД
    const query = `
      SELECT * FROM warehouse_product_links
      WHERE warehouse_id = $1 AND product_id = $2
    `;

    const result = await db.query(query, [warehouseId, productId]);

    if (result.rows.length > 0) {
      await redis.setex(cacheKey, 3600, JSON.stringify(result.rows[0]));
      return result.rows[0];
    }

    return null;
  }

  /**
   * Массовое обновление остатков
   */
  static async bulkUpdateStocks(warehouseId, stockUpdates) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      for (const update of stockUpdates) {
        await this.updateStock(
          warehouseId,
          update.product_id,
          update.quantity,
          update.prices
        );
      }

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получение аналитики по складу
   */
  static async getWarehouseAnalytics(warehouseId, dateRange = {}) {
    let whereConditions = ['ws.warehouse_id = $1'];
    let params = [warehouseId];
    let paramIndex = 2;

    if (dateRange.start_date) {
      whereConditions.push(`ws.last_updated >= $${paramIndex}`);
      params.push(dateRange.start_date);
      paramIndex++;
    }

    if (dateRange.end_date) {
      whereConditions.push(`ws.last_updated <= $${paramIndex}`);
      params.push(dateRange.end_date);
      paramIndex++;
    }

    const query = `
      SELECT
        COUNT(DISTINCT ws.product_id) as total_products,
        SUM(ws.quantity) as total_quantity,
        AVG(ws.purchase_price) as avg_purchase_price,
        AVG(ws.retail_price) as avg_retail_price,
        AVG(ws.website_price) as avg_website_price,
        AVG(ws.marketplace_price) as avg_marketplace_price
      FROM warehouse_product_links ws
      WHERE ${whereConditions.join(' AND ')}
    `;

    const result = await db.query(query, params);
    return result.rows[0];
  }

  /**
   * Получение товаров с низким остатком
   */
  static async getLowStockProducts(warehouseId, threshold = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      WHERE ws.warehouse_id = $1 AND ws.quantity <= $2
      ORDER BY ws.quantity ASC
    `;

    const result = await db.query(query, [warehouseId, threshold]);
    return result.rows;
  }

  /**
   * Получение товаров с истекающим сроком годности
   */
  static async getExpiringProducts(warehouseId, daysThreshold = 30) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku, ws.expiry_date,
             EXTRACT(DAY FROM ws.expiry_date - NOW()) as days_until_expiry
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      WHERE ws.warehouse_id = $1
        AND ws.expiry_date IS NOT NULL
        AND ws.expiry_date <= NOW() + INTERVAL '${daysThreshold} days'
      ORDER BY ws.expiry_date ASC
    `;

    const result = await db.query(query, [warehouseId]);
    return result.rows;
  }

  /**
   * Получение товаров с высокой популярностью
   */
  static async getPopularProducts(warehouseId, limit = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku,
             COALESCE(pop.popularity_score, 0) as popularity_score,
             COALESCE(pop.view_count, 0) as view_count,
             COALESCE(pop.order_count, 0) as order_count
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN product_popularity pop ON p.id = pop.product_id
      WHERE ws.warehouse_id = $1
      ORDER BY pop.popularity_score DESC NULLS LAST
      LIMIT $2
    `;

    const result = await db.query(query, [warehouseId, limit]);
    return result.rows;
  }

  /**
   * Получение товаров с низкой популярностью
   */
  static async getUnpopularProducts(warehouseId, limit = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku,
             COALESCE(pop.popularity_score, 0) as popularity_score,
             COALESCE(pop.view_count, 0) as view_count,
             COALESCE(pop.order_count, 0) as order_count
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN product_popularity pop ON p.id = pop.product_id
      WHERE ws.warehouse_id = $1
      ORDER BY pop.popularity_score ASC NULLS LAST
      LIMIT $2
    `;

    const result = await db.query(query, [warehouseId, limit]);
    return result.rows;
  }

  /**
   * Получение товаров с высоким оборотом
   */
  static async getHighTurnoverProducts(warehouseId, limit = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku,
             COALESCE(SUM(oi.quantity), 0) as total_sold,
             COALESCE(COUNT(DISTINCT o.id), 0) as orders_count
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE ws.warehouse_id = $1
        AND o.order_date >= NOW() - INTERVAL '30 days'
      GROUP BY ws.id, p.id, p.name, p.sku
      ORDER BY total_sold DESC
      LIMIT $2
    `;

    const result = await db.query(query, [warehouseId, limit]);
    return result.rows;
  }

  /**
   * Получение товаров с низким оборотом
   */
  static async getLowTurnoverProducts(warehouseId, limit = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku,
             COALESCE(SUM(oi.quantity), 0) as total_sold,
             COALESCE(COUNT(DISTINCT o.id), 0) as orders_count
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE ws.warehouse_id = $1
        AND o.order_date >= NOW() - INTERVAL '30 days'
      GROUP BY ws.id, p.id, p.name, p.sku
      ORDER BY total_sold ASC
      LIMIT $2
    `;

    const result = await db.query(query, [warehouseId, limit]);
    return result.rows;
  }

  /**
   * Получение товаров с высокой прибыльностью
   */
  static async getHighProfitProducts(warehouseId, limit = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku,
             COALESCE(SUM(oi.quantity * (oi.unit_price - ws.price)), 0) as total_profit,
             COALESCE(AVG(oi.unit_price - ws.price), 0) as avg_profit_per_unit
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE ws.warehouse_id = $1
        AND o.order_date >= NOW() - INTERVAL '30 days'
      GROUP BY ws.id, p.id, p.name, p.sku
      ORDER BY total_profit DESC
      LIMIT $2
    `;

    const result = await db.query(query, [warehouseId, limit]);
    return result.rows;
  }

  /**
   * Получение товаров с низкой прибыльностью
   */
  static async getLowProfitProducts(warehouseId, limit = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku,
             COALESCE(SUM(oi.quantity * (oi.unit_price - ws.price)), 0) as total_profit,
             COALESCE(AVG(oi.unit_price - ws.price), 0) as avg_profit_per_unit
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE ws.warehouse_id = $1
        AND o.order_date >= NOW() - INTERVAL '30 days'
      GROUP BY ws.id, p.id, p.name, p.sku
      ORDER BY total_profit ASC
      LIMIT $2
    `;

    const result = await db.query(query, [warehouseId, limit]);
    return result.rows;
  }

  /**
   * Получение товаров с высокой маржой
   */
  static async getHighMarginProducts(warehouseId, limit = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku,
             COALESCE(AVG((oi.unit_price - ws.price) / oi.unit_price * 100), 0) as margin_percentage
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE ws.warehouse_id = $1
        AND o.order_date >= NOW() - INTERVAL '30 days'
        AND oi.unit_price > 0
      GROUP BY ws.id, p.id, p.name, p.sku
      ORDER BY margin_percentage DESC
      LIMIT $2
    `;

    const result = await db.query(query, [warehouseId, limit]);
    return result.rows;
  }

  /**
   * Получение товаров с низкой маржой
   */
  static async getLowMarginProducts(warehouseId, limit = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku,
             COALESCE(AVG((oi.unit_price - ws.price) / oi.unit_price * 100), 0) as margin_percentage
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE ws.warehouse_id = $1
        AND o.order_date >= NOW() - INTERVAL '30 days'
        AND oi.unit_price > 0
      GROUP BY ws.id, p.id, p.name, p.sku
      ORDER BY margin_percentage ASC
      LIMIT $2
    `;

    const result = await db.query(query, [warehouseId, limit]);
    return result.rows;
  }

  /**
   * Получение товаров с высокой скоростью продаж
   */
  static async getFastSellingProducts(warehouseId, limit = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku,
             COALESCE(SUM(oi.quantity), 0) as total_sold,
             COALESCE(COUNT(DISTINCT o.id), 0) as orders_count,
             COALESCE(SUM(oi.quantity) / NULLIF(COUNT(DISTINCT o.id), 0), 0) as avg_quantity_per_order
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE ws.warehouse_id = $1
        AND o.order_date >= NOW() - INTERVAL '30 days'
      GROUP BY ws.id, p.id, p.name, p.sku
      ORDER BY avg_quantity_per_order DESC
      LIMIT $2
    `;

    const result = await db.query(query, [warehouseId, limit]);
    return result.rows;
  }

  /**
   * Получение товаров с низкой скоростью продаж
   */
  static async getSlowSellingProducts(warehouseId, limit = 10) {
    const query = `
      SELECT ws.*, p.name as product_name, p.sku,
             COALESCE(SUM(oi.quantity), 0) as total_sold,
             COALESCE(COUNT(DISTINCT o.id), 0) as orders_count,
             COALESCE(SUM(oi.quantity) / NULLIF(COUNT(DISTINCT o.id), 0), 0) as avg_quantity_per_order
      FROM warehouse_product_links ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE ws.warehouse_id = $1
        AND o.order_date >= NOW() - INTERVAL '30 days'
      GROUP BY ws.id, p.id, p.name, p.sku
      ORDER BY avg_quantity_per_order ASC
      LIMIT $2
    `;

    const result = await db.query(query, [warehouseId, limit]);
    return result.rows;
  }
}

module.exports = WarehouseService;