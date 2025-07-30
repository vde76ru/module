// backend/src/routes/sync.js
const express = require('express');
const { authenticate, checkPermission } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

/**
 * POST /sync/stock
 * Запуск синхронизации остатков
 */
router.post('/stock', authenticate, checkPermission('sync.execute'), async (req, res) => {
  try {
    const { product_ids, sync_all } = req.body;
    const tenantId = req.user.tenantId;

    // Записываем в логи синхронизации
    const logResult = await db.query(tenantId, `
      INSERT INTO sync_logs (tenant_id, sync_type, status, details, started_at)
      VALUES ($1, 'stock', 'processing', $2, NOW())
      RETURNING id
    `, [tenantId, JSON.stringify({ product_ids, sync_all })]);

    // Имитируем процесс синхронизации (в реальности здесь будет RabbitMQ)
    setTimeout(async () => {
      try {
        await db.query(tenantId, `
          UPDATE sync_logs SET 
            status = 'completed',
            completed_at = NOW()
          WHERE id = $1
        `, [logResult.rows[0].id]);
      } catch (error) {
        console.error('Failed to update sync log:', error);
      }
    }, 5000);

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
    const tenantId = req.user.tenantId;

    const logResult = await db.query(tenantId, `
      INSERT INTO sync_logs (tenant_id, sync_type, status, details, started_at)
      VALUES ($1, 'orders', 'processing', $2, NOW())
      RETURNING id
    `, [tenantId, JSON.stringify({ marketplace_id, date_from, date_to })]);

    // Имитируем процесс синхронизации
    setTimeout(async () => {
      try {
        await db.query(tenantId, `
          UPDATE sync_logs SET 
            status = 'completed',
            completed_at = NOW()
          WHERE id = $1
        `, [logResult.rows[0].id]);
      } catch (error) {
        console.error('Failed to update sync log:', error);
      }
    }, 8000);

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
    const tenantId = req.user.tenantId;

    const logResult = await db.query(tenantId, `
      INSERT INTO sync_logs (tenant_id, sync_type, status, details, started_at)
      VALUES ($1, 'products', 'processing', $2, NOW())
      RETURNING id
    `, [tenantId, JSON.stringify({ supplier_id })]);

    // Имитируем процесс синхронизации
    setTimeout(async () => {
      try {
        await db.query(tenantId, `
          UPDATE sync_logs SET 
            status = 'completed',
            completed_at = NOW()
          WHERE id = $1
        `, [logResult.rows[0].id]);
      } catch (error) {
        console.error('Failed to update sync log:', error);
      }
    }, 12000);

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
    const tenantId = req.user.tenantId;
    const { limit = 10 } = req.query;

    const syncLogs = await db.query(tenantId, `
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
      WHERE tenant_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `, [tenantId, limit]);

    // Статистика синхронизации
    const statsResult = await db.query(tenantId, `
      SELECT 
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_syncs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_syncs,
        MAX(started_at) as last_sync_at
      FROM sync_logs
      WHERE tenant_id = $1 AND started_at >= NOW() - INTERVAL '24 hours'
    `, [tenantId]);

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
    const tenantId = req.user.tenantId;
    const { 
      limit = 50, 
      offset = 0,
      sync_type,
      status,
      date_from,
      date_to 
    } = req.query;

    let whereConditions = ['tenant_id = $1'];
    const queryParams = [tenantId];
    let paramIndex = 2;

    if (sync_type) {
      whereConditions.push(`sync_type = $${paramIndex}`);
      queryParams.push(sync_type);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (date_from) {
      whereConditions.push(`started_at >= $${paramIndex}`);
      queryParams.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      whereConditions.push(`started_at <= $${paramIndex}`);
      queryParams.push(date_to);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const [historyResult, totalResult] = await Promise.all([
      db.query(tenantId, `
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
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]),

      db.query(tenantId, `
        SELECT COUNT(*) as total
        FROM sync_logs
        WHERE ${whereClause}
      `, queryParams)
    ]);

    const total = parseInt(totalResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: historyResult.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / limit)
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