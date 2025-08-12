// backend/src/jobs/syncWorkers.js
const db = require('../config/database');
const logger = require('../utils/logger');
const rabbitmq = require('../config/rabbitmq');
const SyncService = require('../services/SyncService');
const cryptoUtils = require('../utils/crypto');
const supplierFactory = require('../adapters/SupplierFactory');

const QUEUES = {
  STOCK: 'sync.stock',
  ORDERS: 'sync.orders',
  PRODUCTS: 'sync.products',
};

const MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES || '5', 10);

async function ensureQueues() {
  await rabbitmq.createQueue(QUEUES.STOCK);
  await rabbitmq.createQueue(QUEUES.ORDERS);
  await rabbitmq.createQueue(QUEUES.PRODUCTS);
}

function getRetryCount(msg) {
  try {
    const headers = (msg && msg.properties && msg.properties.headers) || {};
    return parseInt(headers['x-retry'] || '0', 10);
  } catch (_) {
    return 0;
  }
}

async function requeueWithBackoff(queueName, payload, currentRetry) {
  const nextRetry = currentRetry + 1;
  const delayMs = Math.min(1000 * Math.pow(2, currentRetry), 30000); // экспонента до 30с
  logger.warn(`Requeue message for ${queueName} in ${delayMs}ms (retry ${nextRetry}/${MAX_RETRIES})`);
  await new Promise(r => setTimeout(r, delayMs));
  await rabbitmq.sendToQueue(queueName, payload, { headers: { 'x-retry': nextRetry } });
}

async function markLogStatus(logId, status, fields = {}) {
  const set = [ 'status = $2' ];
  const values = [ logId, status ];
  let idx = 3;
  for (const [k, v] of Object.entries(fields)) {
    set.push(`${k} = $${idx}`);
    values.push(v);
    idx++;
  }
  await db.query(`UPDATE sync_logs SET ${set.join(', ')}, updated_at = NOW() WHERE id = $1`, values);
}

async function processStockMessage(payload, msg) {
  const retry = getRetryCount(msg);
  const { companyId, product_ids = null, sync_all = true, logId = null } = payload || {};
  const syncService = new SyncService();
  try {
    if (logId) await markLogStatus(logId, 'processing', { started_at: new Date() });

    // Получаем остатки от всех активных поставщиков и обновляем локальные склады/цены
    const supplierStockData = await syncService.fetchSupplierStocks({}, companyId);

    let processed = 0, updated = 0, errors = 0;
    for (const stockItem of supplierStockData) {
      try {
        // Ищем маппинг внешнего артикула на наш продукт
        const mappingResult = await db.query(`
          SELECT pm.product_id, p.sku AS internal_sku
          FROM product_mappings pm
          JOIN products p ON pm.product_id = p.id
          WHERE pm.system_id = $1 AND pm.external_id = $2 AND p.company_id = $3 AND pm.is_active = true
          LIMIT 1
        `, [stockItem.system_id, stockItem.vendor_sku, companyId]);

        processed++;
        if (mappingResult.rows.length === 0) {
          continue;
        }
        const productId = mappingResult.rows[0].product_id;

        await db.query(`
          INSERT INTO warehouse_product_links (
            product_id, warehouse_id, quantity, price,
            reserved_quantity, available_quantity,
            last_updated, created_at, updated_at
          ) VALUES ($1, COALESCE($2, 1), $3, $4, 0, $3, NOW(), NOW(), NOW())
          ON CONFLICT (warehouse_id, product_id)
          DO UPDATE SET
            quantity = EXCLUDED.quantity,
            available_quantity = EXCLUDED.available_quantity,
            price = EXCLUDED.price,
            last_updated = NOW(),
            updated_at = NOW()
        `, [productId, stockItem.warehouse_id, stockItem.quantity, stockItem.price]);

        if (stockItem.price && stockItem.price > 0) {
          await db.query(`
            INSERT INTO prices (
              product_id, price_type, value, currency,
              is_active, created_at, updated_at
            ) VALUES ($1, 'supplier', $2, $3, true, NOW(), NOW())
            ON CONFLICT (product_id, price_type)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
          `, [productId, stockItem.price, stockItem.currency || 'RUB']);
        }
        updated++;
      } catch (e) {
        errors++;
        logger.error('Stock update error:', e);
      }
    }

    if (logId) await markLogStatus(logId, 'completed', {
      completed_at: new Date(),
      items_processed: processed,
      items_succeeded: updated,
      items_failed: errors,
      results: JSON.stringify({ processed, updated, errors })
    });
  } catch (error) {
    logger.error('Stock sync worker error:', error);
    if (retry < MAX_RETRIES) {
      await requeueWithBackoff(QUEUES.STOCK, payload, retry);
    }
    if (logId) await markLogStatus(logId, 'failed', { completed_at: new Date(), error_message: error.message });
    throw error;
  }
}

async function processOrdersMessage(payload, msg) {
  const retry = getRetryCount(msg);
  const { companyId, marketplace_id, date_from, date_to, logId = null } = payload || {};
  const syncService = new SyncService();
  const client = await db.getClient();
  try {
    if (logId) await markLogStatus(logId, 'processing', { started_at: new Date() });
    await client.query('BEGIN');

    const mpRes = await client.query('SELECT * FROM marketplaces WHERE id = $1 AND company_id = $2 AND is_active = true', [marketplace_id, companyId]);
    if (mpRes.rows.length === 0) throw new Error('Marketplace not found or inactive');
    const marketplace = mpRes.rows[0];

    const res = await syncService.syncOrders(client, marketplace, companyId);

    await client.query('COMMIT');
    if (logId) await markLogStatus(logId, 'completed', {
      completed_at: new Date(),
      items_processed: res.processed,
      items_succeeded: res.updated,
      items_failed: res.errors,
      results: JSON.stringify(res)
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    logger.error('Orders sync worker error:', error);
    if (retry < MAX_RETRIES) {
      await requeueWithBackoff(QUEUES.ORDERS, payload, retry);
    }
    if (logId) await markLogStatus(logId, 'failed', { completed_at: new Date(), error_message: error.message });
    throw error;
  } finally {
    client.release();
  }
}

async function processProductsMessage(payload, msg) {
  const retry = getRetryCount(msg);
  const { companyId, supplier_id, logId = null } = payload || {};
  try {
    if (logId) await markLogStatus(logId, 'processing', { started_at: new Date() });

    const supRes = await db.query('SELECT * FROM suppliers WHERE id = $1', [supplier_id]);
    if (supRes.rows.length === 0) throw new Error('Supplier not found');
    let apiConfig = supRes.rows[0].api_config;
    if (typeof apiConfig === 'string') {
      try {
        if (cryptoUtils.isEncrypted(apiConfig)) apiConfig = cryptoUtils.decrypt(apiConfig);
        else apiConfig = JSON.parse(apiConfig);
      } catch (_) {}
    }
    const adapter = supplierFactory.createAdapter(supRes.rows[0].api_type, apiConfig);
    if (typeof adapter.syncProducts !== 'function') throw new Error('Supplier adapter does not support syncProducts');

    const syncResult = await adapter.syncProducts({ companyId });

    if (logId) await markLogStatus(logId, 'completed', {
      completed_at: new Date(),
      items_processed: syncResult?.processed || 0,
      items_succeeded: syncResult?.updated || syncResult?.created || 0,
      items_failed: syncResult?.errors || 0,
      results: JSON.stringify(syncResult)
    });
  } catch (error) {
    logger.error('Products sync worker error:', error);
    if (retry < MAX_RETRIES) {
      await requeueWithBackoff(QUEUES.PRODUCTS, payload, retry);
    }
    if (logId) await markLogStatus(logId, 'failed', { completed_at: new Date(), error_message: error.message });
    throw error;
  }
}

async function start() {
  await ensureQueues();
  await rabbitmq.consumeQueue(QUEUES.STOCK, async (content, msg) => {
    await processStockMessage(content, msg);
  }, { prefetch: 2 });

  await rabbitmq.consumeQueue(QUEUES.ORDERS, async (content, msg) => {
    await processOrdersMessage(content, msg);
  }, { prefetch: 1 });

  await rabbitmq.consumeQueue(QUEUES.PRODUCTS, async (content, msg) => {
    await processProductsMessage(content, msg);
  }, { prefetch: 1 });

  logger.info('✅ Sync workers started for queues: sync.stock, sync.orders, sync.products');
}

module.exports = { start, QUEUES };


