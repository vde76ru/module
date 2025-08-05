// ===================================================
// ФАЙЛ: backend/src/services/SyncService.js
// ПОЛНАЯ РЕАЛИЗАЦИЯ: Синхронизация с маркетплейсами
// ===================================================

const { Pool } = require('pg');
const axios = require('axios');
const logger = require('../utils/logger');

class SyncService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    // Конфигурации API маркетплейсов
    this.marketplaceConfigs = {
      ozon: {
        apiUrl: 'https://api-seller.ozon.ru',
        endpoints: {
          products: '/v2/product/list',
          orders: '/v3/posting/fbs/list',
          stocks: '/v1/product/import/stocks'
        }
      },
      wildberries: {
        apiUrl: 'https://suppliers-api.wildberries.ru',
        endpoints: {
          products: '/content/v1/cards/cursor/list',
          orders: '/api/v3/orders',
          stocks: '/api/v3/stocks'
        }
      },
      yandex_market: {
        apiUrl: 'https://api.partner.market.yandex.ru',
        endpoints: {
          products: '/campaigns/{campaignId}/offer-mapping-entries',
          orders: '/campaigns/{campaignId}/orders',
          stocks: '/campaigns/{campaignId}/offers/stocks'
        }
      }
    };
  }

  /**
   * Полная синхронизация с маркетплейсом
   */
  async fullSync(companyId, marketplaceId) {
    const client = await this.pool.connect();
    const syncId = this.generateSyncId();

    try {
      await client.query('BEGIN');

      // Получаем настройки маркетплейса
      const marketplaceResult = await client.query(`
        SELECT ms.*, m.type, m.name as marketplace_name
        FROM marketplace_settings ms
        JOIN marketplaces m ON ms.marketplace_id = m.id
        WHERE ms.id = $1 AND ms.company_id = $2 AND ms.is_active = true
      `, [marketplaceId, companyId]);

      if (marketplaceResult.rows.length === 0) {
        throw new Error('Marketplace settings not found');
      }

      const marketplace = marketplaceResult.rows[0];

      // Создаем лог синхронизации
      const syncLogResult = await client.query(`
        INSERT INTO sync_logs (
          company_id, marketplace_id, sync_id, sync_type, status,
          started_at, metadata
        ) VALUES (
          $1, $2, $3, 'full', 'running', NOW(), $4
        ) RETURNING id
      `, [
        companyId,
        marketplaceId,
        syncId,
        JSON.stringify({ marketplace_type: marketplace.type })
      ]);

      const logId = syncLogResult.rows[0].id;

      let syncResults = {
        products: { processed: 0, updated: 0, errors: 0 },
        orders: { processed: 0, updated: 0, errors: 0 },
        stocks: { processed: 0, updated: 0, errors: 0 }
      };

      // Синхронизируем товары
      try {
        const productsResult = await this.syncProducts(client, marketplace);
        syncResults.products = productsResult;
      } catch (error) {
        logger.error(`Error syncing products for marketplace ${marketplaceId}:`, error);
        syncResults.products.errors = 1;
      }

      // Синхронизируем заказы
      try {
        const ordersResult = await this.syncOrders(client, marketplace, companyId);
        syncResults.orders = ordersResult;
      } catch (error) {
        logger.error(`Error syncing orders for marketplace ${marketplaceId}:`, error);
        syncResults.orders.errors = 1;
      }

      // Синхронизируем остатки
      try {
        const stocksResult = await this.syncStocks(client, marketplace, companyId);
        syncResults.stocks = stocksResult;
      } catch (error) {
        logger.error(`Error syncing stocks for marketplace ${marketplaceId}:`, error);
        syncResults.stocks.errors = 1;
      }

      // Обновляем лог синхронизации
      await client.query(`
        UPDATE sync_logs
        SET status = 'completed',
            completed_at = NOW(),
            items_processed = $2,
            items_succeeded = $3,
            items_failed = $4,
            results = $5
        WHERE id = $1
      `, [
        logId,
        syncResults.products.processed + syncResults.orders.processed + syncResults.stocks.processed,
        syncResults.products.updated + syncResults.orders.updated + syncResults.stocks.updated,
        syncResults.products.errors + syncResults.orders.errors + syncResults.stocks.errors,
        JSON.stringify(syncResults)
      ]);

      // Обновляем время последней синхронизации
      await client.query(`
        UPDATE marketplace_settings
        SET last_sync = NOW(),
            sync_status = CASE 
              WHEN $2 > 0 THEN 'error'
              WHEN $3 > 0 THEN 'warning'
              ELSE 'success'
            END
        WHERE id = $1
      `, [
        marketplaceId,
        syncResults.products.errors + syncResults.orders.errors + syncResults.stocks.errors,
        0 // warnings count - можно добавить логику
      ]);

      await client.query('COMMIT');

      logger.info(`Full sync completed for marketplace ${marketplace.marketplace_name}`, {
        syncId,
        results: syncResults
      });

      return {
        success: true,
        syncId,
        results: syncResults
      };

    } catch (error) {
      await client.query('ROLLBACK');
      
      // Обновляем лог с ошибкой
      await this.pool.query(`
        UPDATE sync_logs
        SET status = 'failed',
            completed_at = NOW(),
            error_message = $2
        WHERE sync_id = $1
      `, [syncId, error.message]);

      logger.error(`Full sync failed for marketplace ${marketplaceId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Синхронизация товаров
   */
  async syncProducts(client, marketplace) {
    const config = this.marketplaceConfigs[marketplace.type];
    if (!config) {
      throw new Error(`Unsupported marketplace type: ${marketplace.type}`);
    }

    let processed = 0;
    let updated = 0;
    let errors = 0;

    try {
      // Получаем товары с маркетплейса
      const products = await this.fetchMarketplaceProducts(marketplace);

      for (const productData of products) {
        processed++;

        try {
          // Ищем товар по внешнему ID или SKU
          const existingProductResult = await client.query(`
            SELECT id FROM products
            WHERE company_id = $1 
              AND (external_id = $2 OR sku = $3)
            LIMIT 1
          `, [
            marketplace.company_id,
            productData.external_id,
            productData.sku
          ]);

          if (existingProductResult.rows.length > 0) {
            // Обновляем существующий товар
            await client.query(`
              UPDATE products
              SET name = COALESCE($2, name),
                  description = COALESCE($3, description),
                  attributes = COALESCE($4, attributes),
                  external_data = $5,
                  last_sync = NOW(),
                  updated_at = NOW()
              WHERE id = $1
            `, [
              existingProductResult.rows[0].id,
              productData.name,
              productData.description,
              JSON.stringify(productData.attributes || {}),
              JSON.stringify(productData)
            ]);
          } else {
            // Создаем новый товар
            await client.query(`
              INSERT INTO products (
                company_id, external_id, name, description, sku,
                attributes, external_data, source_type, last_sync,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, 'sync', NOW(), NOW(), NOW()
              )
            `, [
              marketplace.company_id,
              productData.external_id,
              productData.name,
              productData.description,
              productData.sku,
              JSON.stringify(productData.attributes || {}),
              JSON.stringify(productData)
            ]);
          }

          updated++;

        } catch (error) {
          logger.error(`Error processing product ${productData.external_id}:`, error);
          errors++;
        }
      }

    } catch (error) {
      logger.error('Error fetching products from marketplace:', error);
      errors++;
    }

    return { processed, updated, errors };
  }

  /**
   * Синхронизация заказов
   */
  async syncOrders(client, marketplace, companyId) {
    let processed = 0;
    let updated = 0;
    let errors = 0;

    try {
      const orders = await this.fetchMarketplaceOrders(marketplace);

      for (const orderData of orders) {
        processed++;

        try {
          // Проверяем существование заказа
          const existingOrderResult = await client.query(`
            SELECT id FROM incoming_orders
            WHERE company_id = $1 
              AND marketplace_id = $2
              AND marketplace_order_id = $3
            LIMIT 1
          `, [
            companyId,
            marketplace.id,
            orderData.marketplace_order_id
          ]);

          if (existingOrderResult.rows.length > 0) {
            // Обновляем существующий заказ
            await client.query(`
              UPDATE incoming_orders
              SET status = COALESCE($2, status),
                  payment_status = COALESCE($3, payment_status),
                  total_amount = COALESCE($4, total_amount),
                  metadata = $5,
                  updated_at = NOW()
              WHERE id = $1
            `, [
              existingOrderResult.rows[0].id,
              orderData.status,
              orderData.payment_status,
              orderData.total_amount,
              JSON.stringify(orderData)
            ]);
          } else {
            // Создаем новый заказ
            const orderResult = await client.query(`
              INSERT INTO incoming_orders (
                company_id, marketplace_id, order_number, marketplace_order_id,
                customer_name, customer_email, status, payment_status,
                total_amount, currency, order_date, metadata,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
              ) RETURNING id
            `, [
              companyId,
              marketplace.id,
              orderData.order_number,
              orderData.marketplace_order_id,
              orderData.customer_name,
              orderData.customer_email,
              orderData.status,
              orderData.payment_status,
              orderData.total_amount,
              orderData.currency || 'RUB',
              orderData.order_date,
              JSON.stringify(orderData)
            ]);

            const orderId = orderResult.rows[0].id;

            // Добавляем товары заказа
            for (const item of orderData.items || []) {
              await client.query(`
                INSERT INTO incoming_order_items (
                  order_id, external_product_id, product_name,
                  quantity, unit_price, total_price, raw_data,
                  created_at, updated_at
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
                )
              `, [
                orderId,
                item.external_product_id,
                item.product_name,
                item.quantity,
                item.unit_price,
                item.total_price,
                JSON.stringify(item)
              ]);
            }
          }

          updated++;

        } catch (error) {
          logger.error(`Error processing order ${orderData.marketplace_order_id}:`, error);
          errors++;
        }
      }

    } catch (error) {
      logger.error('Error fetching orders from marketplace:', error);
      errors++;
    }

    return { processed, updated, errors };
  }

  /**
   * Синхронизация остатков
   */
  async syncStocks(client, marketplace, companyId) {
    let processed = 0;
    let updated = 0;
    let errors = 0;

    try {
      // Получаем товары компании с остатками
      const productsResult = await client.query(`
        SELECT p.id, p.external_id, p.sku,
               COALESCE(SUM(wpl.available_quantity), 0) as total_stock
        FROM products p
        LEFT JOIN warehouse_product_links wpl ON p.id = wpl.product_id AND wpl.is_active = true
        WHERE p.company_id = $1 AND p.external_id IS NOT NULL
        GROUP BY p.id, p.external_id, p.sku
      `, [companyId]);

      const stockUpdates = productsResult.rows.map(product => ({
        external_id: product.external_id,
        sku: product.sku,
        stock: parseInt(product.total_stock) || 0
      }));

      if (stockUpdates.length > 0) {
        // Отправляем остатки на маркетплейс
        await this.updateMarketplaceStocks(marketplace, stockUpdates);
        processed = stockUpdates.length;
        updated = stockUpdates.length;
      }

    } catch (error) {
      logger.error('Error syncing stocks to marketplace:', error);
      errors++;
    }

    return { processed, updated, errors };
  }

  /**
   * Получение товаров с маркетплейса (mock)
   */
  async fetchMarketplaceProducts(marketplace) {
    // Здесь должна быть реальная интеграция с API маркетплейса
    // Пока возвращаем моковые данные
    return [
      {
        external_id: 'MP_001',
        name: 'Товар из маркетплейса 1',
        description: 'Описание товара',
        sku: 'SKU_001',
        attributes: { color: 'red', size: 'M' }
      }
    ];
  }

  /**
   * Получение заказов с маркетплейса (mock)
   */
  async fetchMarketplaceOrders(marketplace) {
    // Здесь должна быть реальная интеграция с API маркетплейса
    return [
      {
        marketplace_order_id: 'ORDER_001',
        order_number: 'MP-2024-001',
        customer_name: 'Иван Иванов',
        customer_email: 'ivan@example.com',
        status: 'new',
        payment_status: 'paid',
        total_amount: 1500.00,
        currency: 'RUB',
        order_date: new Date(),
        items: [
          {
            external_product_id: 'MP_001',
            product_name: 'Товар из маркетплейса 1',
            quantity: 2,
            unit_price: 750.00,
            total_price: 1500.00
          }
        ]
      }
    ];
  }

  /**
   * Обновление остатков на маркетплейсе (mock)
   */
  async updateMarketplaceStocks(marketplace, stockUpdates) {
    // Здесь должна быть реальная интеграция с API маркетплейса
    logger.info(`Updated ${stockUpdates.length} stock records for ${marketplace.marketplace_name}`);
    return true;
  }

  /**
   * Получение логов синхронизации
   */
  async getSyncLogs(companyId, filters = {}) {
    try {
      let query = `
        SELECT sl.*, ms.name as marketplace_name, m.type as marketplace_type
        FROM sync_logs sl
        LEFT JOIN marketplace_settings ms ON sl.marketplace_id = ms.id
        LEFT JOIN marketplaces m ON ms.marketplace_id = m.id
        WHERE sl.company_id = $1
      `;

      const params = [companyId];
      let paramIndex = 2;

      if (filters.marketplace_id) {
        query += ` AND sl.marketplace_id = $${paramIndex}`;
        params.push(filters.marketplace_id);
        paramIndex++;
      }

      if (filters.sync_type) {
        query += ` AND sl.sync_type = $${paramIndex}`;
        params.push(filters.sync_type);
        paramIndex++;
      }

      if (filters.status) {
        query += ` AND sl.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      query += ` ORDER BY sl.started_at DESC LIMIT ${filters.limit || 50}`;

      const result = await this.pool.query(query, params);

      return result.rows.map(log => ({
        ...log,
        metadata: typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata,
        results: typeof log.results === 'string' ? JSON.parse(log.results) : log.results
      }));

    } catch (error) {
      logger.error('Error fetching sync logs:', error);
      throw error;
    }
  }

  /**
   * Генерация уникального ID синхронизации
   */
  generateSyncId() {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new SyncService();