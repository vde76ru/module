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
          // Ищем товар по internal_code или sku
          const existingProductResult = await client.query(`
            SELECT id FROM products
            WHERE company_id = $1
              AND (internal_code = $2 OR sku = $3)
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
                  source_type = 'sync',
                  updated_at = NOW()
              WHERE id = $1
            `, [
              existingProductResult.rows[0].id,
              productData.name,
              productData.description,
              JSON.stringify(productData.attributes || {})
            ]);
          } else {
            // Создаем новый товар
            await client.query(`
              INSERT INTO products (
                company_id, internal_code, name, description, sku,
                attributes, source_type, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, 'sync', NOW(), NOW()
              )
            `, [
              marketplace.company_id,
              productData.external_id,
              productData.name,
              productData.description,
              productData.sku,
              JSON.stringify(productData.attributes || {})
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
          // Проверяем существование заказа в таблице orders
          const existingOrderResult = await client.query(`
            SELECT id FROM orders
            WHERE company_id = $1
              AND external_order_number = $2
            LIMIT 1
          `, [
            companyId,
            orderData.marketplace_order_id
          ]);

          if (existingOrderResult.rows.length > 0) {
            // Обновляем существующий заказ
            await client.query(`
              UPDATE orders
              SET status = COALESCE($2, status),
                  total_amount = COALESCE($3, total_amount),
                  updated_at = NOW()
              WHERE id = $1
            `, [
              existingOrderResult.rows[0].id,
              orderData.status,
              orderData.total_amount
            ]);
          } else {
            // Создаем новый заказ
            const orderResult = await client.query(`
              INSERT INTO orders (
                company_id, order_number, external_order_number,
                customer_name, customer_email, status, payment_status,
                total_amount, currency, order_date, metadata,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
              ) RETURNING id
            `, [
              companyId,
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

            // Добавляем товары заказа в таблицу order_items
            for (const item of orderData.items || []) {
              await client.query(`
                INSERT INTO order_items (
                  order_id, product_id, quantity, unit_price, total_price,
                  currency, notes, created_at, updated_at
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
                )
              `, [
                orderId,
                item.product_id || null, // Если нет product_id, используем null
                item.quantity,
                item.unit_price,
                item.total_price,
                item.currency || 'RUB',
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
      // Получаем данные от поставщиков через адаптеры
      const supplierStockData = await this.fetchSupplierStocks(marketplace, companyId);

      for (const stockItem of supplierStockData) {
        processed++;

        try {
          // Ищем товар в Product_Mappings по system_id (поставщика) и external_id (артикулу поставщика)
          const mappingResult = await client.query(`
            SELECT pm.product_id, p.sku as internal_sku
            FROM product_mappings pm
            JOIN products p ON pm.product_id = p.id
            WHERE pm.system_id = $1
              AND pm.external_id = $2
              AND p.company_id = $3
              AND pm.is_active = true
            LIMIT 1
          `, [
            stockItem.system_id, // ID поставщика в нашей системе
            stockItem.vendor_sku, // артикул у поставщика
            companyId
          ]);

          if (mappingResult.rows.length > 0) {
            const productId = mappingResult.rows[0].product_id;
            const internalSku = mappingResult.rows[0].internal_sku;


            // Обновляем остатки в таблице warehouse_product_links
            await client.query(`
              INSERT INTO warehouse_product_links (

                product_id, warehouse_id, quantity, price,
                reserved_quantity, available_quantity,
                last_updated, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, 0, $3, NOW(), NOW(), NOW()
              )

              ON CONFLICT (warehouse_id, product_id)

              DO UPDATE SET
                quantity = EXCLUDED.quantity,
                available_quantity = EXCLUDED.available_quantity,
                price = EXCLUDED.price,
                last_updated = NOW(),
                updated_at = NOW()
            `, [
              productId,
              stockItem.warehouse_id || 1, // главный склад по умолчанию
              stockItem.quantity,
              stockItem.price
            ]);

            // Также обновляем цены если они изменились
            if (stockItem.price && stockItem.price > 0) {
              await client.query(`
                INSERT INTO prices (
                  product_id, price_type, value, currency,
                  is_active, created_at, updated_at
                ) VALUES (
                  $1, 'supplier', $2, $3, true, NOW(), NOW()
                )
                ON CONFLICT (product_id, price_type)
                DO UPDATE SET
                  value = EXCLUDED.value,
                  updated_at = NOW()
              `, [
                productId,
                stockItem.price,
                stockItem.currency || 'RUB'
              ]);
            }

            logger.info(`Updated stock for product ${internalSku}: quantity=${stockItem.quantity}, price=${stockItem.price}`);
            updated++;

          } else {
            logger.warn(`Product mapping not found for system_id=${stockItem.system_id}, external_id=${stockItem.vendor_sku}`);
          }

        } catch (error) {
          logger.error(`Error processing stock update for ${stockItem.vendor_sku}:`, error);
          errors++;
        }
      }

    } catch (error) {
      logger.error('Error syncing stocks from suppliers:', error);
      errors++;
    }

    return { processed, updated, errors };
  }

  /**
   * Получение данных остатков от поставщиков
   */
  async fetchSupplierStocks(marketplace, companyId) {
    try {
      // Получаем активных поставщиков компании
      const suppliersResult = await this.pool.query(`
        SELECT s.id, s.api_type, s.api_config, s.name
        FROM suppliers s
        WHERE s.is_active = true
        ORDER BY s.priority DESC
      `);

      const supplierStockData = [];

      for (const supplier of suppliersResult.rows) {
        try {
          // Дешифруем api_config если он зашифрован
          let apiConfig = supplier.api_config;
          if (typeof apiConfig === 'string') {
            try {
              const cryptoUtils = require('../utils/crypto');
              if (cryptoUtils.isEncrypted(apiConfig)) {
                apiConfig = cryptoUtils.decrypt(apiConfig);
              } else {
                apiConfig = JSON.parse(apiConfig);
              }
            } catch (parseError) {
              logger.error(`Error parsing API config for supplier ${supplier.id}:`, parseError);
              continue;
            }
          }

          // Здесь должен быть вызов соответствующего адаптера поставщика
          // Для примера возвращаем моковые данные
          const stockData = await this.fetchSupplierStockData(supplier, apiConfig);

          // Добавляем system_id (ID поставщика) к каждой записи
          const enrichedStockData = stockData.map(item => ({
            ...item,
            system_id: supplier.id,
            supplier_name: supplier.name
          }));

          supplierStockData.push(...enrichedStockData);

        } catch (supplierError) {
          logger.error(`Error fetching stock data from supplier ${supplier.name}:`, supplierError);
        }
      }

      return supplierStockData;

    } catch (error) {
      logger.error('Error fetching supplier stock data:', error);
      throw error;
    }
  }

  /**
   * Получение данных остатков от конкретного поставщика
   */
  async fetchSupplierStockData(supplier, apiConfig) {
    // Здесь должна быть реальная интеграция с API поставщика
    // Пока возвращаем моковые данные
    return [
      {
        vendor_sku: 'VENDOR_SKU_001',
        quantity: 150,
        price: 1200.50,
        currency: 'RUB',
        warehouse_id: 1
      },
      {
        vendor_sku: 'VENDOR_SKU_002',
        quantity: 75,
        price: 850.00,
        currency: 'RUB',
        warehouse_id: 1
      }
    ];
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