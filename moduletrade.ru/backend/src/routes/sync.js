const express = require('express');
const router = express.Router();
const SyncService = require('../services/SyncService');
const { authenticate, checkPermission } = require('../middleware/auth');

const syncService = new SyncService();

// Запуск синхронизации остатков
router.post('/stock', authenticate, checkPermission('sync.execute'), async (req, res) => {
  try {
    const { product_ids, sync_all } = req.body;
    
    if (sync_all) {
      // Синхронизация всех товаров
      await rabbitmq.publishMessage(rabbitmq.queues.STOCK_UPDATE, {
        type: 'FULL_SYNC',
        tenantId: req.user.tenantId,
        timestamp: new Date()
      });
    } else if (product_ids && product_ids.length > 0) {
      // Синхронизация выбранных товаров
      for (const productId of product_ids) {
        await rabbitmq.publishMessage(rabbitmq.queues.STOCK_UPDATE, {
          type: 'PRODUCT_SYNC',
          tenantId: req.user.tenantId,
          productId,
          timestamp: new Date()
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Product IDs or sync_all flag required'
      });
    }
    
    res.json({
      success: true,
      message: 'Synchronization started'
    });
  } catch (error) {
    console.error('Stock sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Синхронизация заказов
router.post('/orders', authenticate, checkPermission('sync.execute'), async (req, res) => {
  try {
    const { marketplace_id, date_from, date_to } = req.body;
    
    await rabbitmq.publishMessage(rabbitmq.queues.ORDER_SYNC, {
      type: 'ORDER_SYNC',
      tenantId: req.user.tenantId,
      marketplaceId: marketplace_id,
      dateFrom: date_from || new Date(Date.now() - 24 * 60 * 60 * 1000),
      dateTo: date_to || new Date()
    });
    
    res.json({
      success: true,
      message: 'Order synchronization started'
    });
  } catch (error) {
    console.error('Order sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// История синхронизаций
router.get('/logs', authenticate, async (req, res) => {
  try {
    const pool = await db.getPool(req.user.tenantId);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const sync_type = req.query.sync_type;
    
    let query = `
      SELECT 
        sl.*,
        m.name as marketplace_name
      FROM sync_logs sl
      LEFT JOIN marketplaces m ON sl.marketplace_id = m.id
      WHERE sl.tenant_id = $1
    `;
    
    const values = [req.user.tenantId];
    let paramIndex = 2;
    
    if (sync_type) {
      query += ` AND sl.sync_type = $${paramIndex++}`;
      values.push(sync_type);
    }
    
    query += ` ORDER BY sl.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: {
        items: result.rows,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Get sync logs error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Статус синхронизации
router.get('/status', authenticate, async (req, res) => {
  try {
    const pool = await db.getPool(req.user.tenantId);
    
    // Последние синхронизации по типам
    const result = await pool.query(`
      SELECT DISTINCT ON (sync_type) 
        sync_type,
        status,
        created_at,
        details
      FROM sync_logs
      WHERE tenant_id = $1
      ORDER BY sync_type, created_at DESC
    `, [req.user.tenantId]);
    
    const status = {};
    for (const row of result.rows) {
      status[row.sync_type] = {
        last_sync: row.created_at,
        status: row.status,
        details: row.details
      };
    }
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
