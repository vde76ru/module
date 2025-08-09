// backend/src/routes/sync.js
const express = require('express');
const { authenticate, checkPermission } = require('../middleware/auth');
const db = require('../config/database');
const rabbitmq = require('../config/rabbitmq');
const { QUEUES } = require('../jobs/syncWorkers');

const router = express.Router();

/**
 * POST /sync/stock
 * Запуск синхронизации остатков
 */
router.post('/stock', authenticate, checkPermission('sync.execute'), async (req, res) => {
  try {
    const { product_ids, sync_all } = req.body;
    const companyId = req.user.companyId;

    // Записываем в логи синхронизации
    const logResult = await db.query(`
      INSERT INTO sync_logs (company_id, sync_type, status, details, started_at)
      VALUES ($1, 'stock', 'processing', $2, NOW())
      RETURNING id
    `, [companyId, JSON.stringify({ product_ids, sync_all })]);

    // Кладём задачу в очередь
    await rabbitmq.sendToQueue(QUEUES.STOCK, {
      companyId,
      product_ids: product_ids || null,
      sync_all: sync_all !== false,
      logId: logResult.rows[0].id,
    });

    res.json({
      success: true,
      data: {
        sync_id: logResult.rows[0].id,
        message: 'Stock synchronization started'
      }
    });

  } catch (error) {
    console.error('Stock sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start stock synchronization'
    });
  }
});

/**
 * POST /sync/orders
 * Синхронизация заказов
 */
router.post('/orders', authenticate, checkPermission('sync.execute'), async (req, res) => {
  try {
    const { marketplace_id, date_from, date_to } = req.body;
    const companyId = req.user.companyId;

    const logResult = await db.query(`
      INSERT INTO sync_logs (company_id, sync_type, status, details, started_at)
      VALUES ($1, 'orders', 'processing', $2, NOW())
      RETURNING id
    `, [companyId, JSON.stringify({ marketplace_id, date_from, date_to })]);

    await rabbitmq.sendToQueue(QUEUES.ORDERS, {
      companyId,
      marketplace_id,
      date_from: date_from || null,
      date_to: date_to || null,
      logId: logResult.rows[0].id,
    });

    res.json({
      success: true,
      data: {
        sync_id: logResult.rows[0].id,
        message: 'Orders synchronization started'
      }
    });

  } catch (error) {
    console.error('Orders sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start orders synchronization'
    });
  }
});

/**
 * POST /sync/products
 * Синхронизация товаров
 */
router.post('/products', authenticate, checkPermission('sync.execute'), async (req, res) => {
  try {
    const { supplier_id } = req.body;
    const companyId = req.user.companyId;

    const logResult = await db.query(`
      INSERT INTO sync_logs (company_id, sync_type, status, details, started_at)
      VALUES ($1, 'products', 'processing', $2, NOW())
      RETURNING id
    `, [companyId, JSON.stringify({ supplier_id })]);

    await rabbitmq.sendToQueue(QUEUES.PRODUCTS, {
      companyId,
      supplier_id,
      logId: logResult.rows[0].id,
    });

    res.json({
      success: true,
      data: {
        sync_id: logResult.rows[0].id,
        message: 'Products synchronization started'
      }
    });

  } catch (error) {
    console.error('Products sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start products synchronization'
    });
  }
});

/**
 * GET /sync/status
 * Получение статуса синхронизации
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { limit = 10 } = req.query;

    const syncLogs = await db.query(`
      SELECT
        id,
        sync_type,
        status,
        details,
        error_message,
        started_at,
        completed_at,
        CASE
          WHEN completed_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (completed_at - started_at))
          ELSE
            EXTRACT(EPOCH FROM (NOW() - started_at))
        END as duration_seconds
      FROM sync_logs
      WHERE company_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `, [companyId, limit]);

    // Статистика синхронизации
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_syncs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_syncs,
        MAX(started_at) as last_sync_at
      FROM sync_logs
      WHERE company_id = $1 AND started_at >= NOW() - INTERVAL '24 hours'
    `, [companyId]);

    res.json({
      success: true,
      data: {
        recent_syncs: syncLogs.rows,
        stats: statsResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status'
    });
  }
});

/**
 * GET /sync/history
 * История синхронизации
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const {
      limit = 50,
      offset = 0,
      sync_type,
      status,
      date_from,
      date_to
    } = req.query;

    let whereConditions = ['company_id = $1'];
    let queryParams = [companyId];
    let paramIndex = 1;

    if (sync_type) {
      paramIndex++;
      whereConditions.push(`sync_type = $${paramIndex}`);
      queryParams.push(sync_type);
    }

    if (status) {
      paramIndex++;
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(status);
    }

    if (date_from) {
      paramIndex++;
      whereConditions.push(`started_at >= $${paramIndex}`);
      queryParams.push(date_from);
    }

    if (date_to) {
      paramIndex++;
      whereConditions.push(`started_at <= $${paramIndex}`);
      queryParams.push(date_to);
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await db.query(`
      SELECT
        id,
        sync_type,
        status,
        details,
        error_message,
        started_at,
        completed_at,
        CASE
          WHEN completed_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (completed_at - started_at))
          ELSE NULL
        END as duration_seconds
      FROM sync_logs
      WHERE ${whereClause}
      ORDER BY started_at DESC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `, [...queryParams, limit, offset]);

    // Подсчет общего количества
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM sync_logs
      WHERE ${whereClause}
    `, queryParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get sync history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync history'
    });
  }
});

module.exports = router;