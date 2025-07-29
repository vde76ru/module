// backend/src/routes/warehouses.js
const express = require('express');
const { authenticate, checkPermission } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

/**
 * GET /warehouses
 * Получение списка складов
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { active_only = false } = req.query;

    let whereConditions = ['tenant_id = $1'];
    const queryParams = [tenantId];

    if (active_only === 'true') {
      whereConditions.push('is_active = true');
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await db.mainPool.query(`
      SELECT
        w.id,
        w.name,
        w.type,
        w.description,
        w.address,
        w.is_active,
        w.priority,
        w.settings,
        w.created_at,
        w.updated_at,
        COUNT(wpl.product_id) as products_count,
        COALESCE(SUM(wpl.quantity), 0) as total_stock
      FROM warehouses w
      LEFT JOIN warehouse_product_links wpl ON w.id = wpl.warehouse_id
      WHERE ${whereClause}
      GROUP BY w.id
      ORDER BY w.priority DESC, w.name ASC
    `, queryParams);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /warehouses/:id
 * Получение детальной информации о складе
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const warehouseId = req.params.id;

    const result = await db.mainPool.query(`
      SELECT
        w.*,
        COUNT(wpl.product_id) as products_count,
        COALESCE(SUM(wpl.quantity), 0) as total_stock,
        COALESCE(SUM(wpl.reserved_quantity), 0) as reserved_stock
      FROM warehouses w
      LEFT JOIN warehouse_product_links wpl ON w.id = wpl.warehouse_id
      WHERE w.id = $1 AND w.tenant_id = $2
      GROUP BY w.id
    `, [warehouseId, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get warehouse error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /warehouses
 * Создание нового склада
 */
router.post('/', authenticate, checkPermission('warehouses.create'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      name,
      type = 'physical',
      description,
      address,
      is_active = true,
      priority = 0,
      settings = {}
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Warehouse name is required'
      });
    }

    const validTypes = ['physical', 'virtual', 'multi'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid warehouse type'
      });
    }

    const result = await db.mainPool.query(`
      INSERT INTO warehouses (
        tenant_id, name, type, description, address,
        is_active, priority, settings, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `, [
      tenantId, name, type, description, address,
      is_active, parseInt(priority), JSON.stringify(settings)
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Create warehouse error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /warehouses/:id
 * Обновление склада
 */
router.put('/:id', authenticate, checkPermission('warehouses.update'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const warehouseId = req.params.id;
    const updateFields = req.body;

    delete updateFields.id;
    delete updateFields.tenant_id;
    delete updateFields.created_at;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    // Валидация типа склада
    if (updateFields.type) {
      const validTypes = ['physical', 'virtual', 'multi'];
      if (!validTypes.includes(updateFields.type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid warehouse type'
        });
      }
    }

    // Преобразуем settings в JSON если передан
    if (updateFields.settings && typeof updateFields.settings === 'object') {
      updateFields.settings = JSON.stringify(updateFields.settings);
    }

    const setClause = Object.keys(updateFields)
      .map((key, index) => `${key} = $${index + 3}`)
      .join(', ');

    const queryParams = [warehouseId, tenantId, ...Object.values(updateFields)];

    const result = await db.mainPool.query(`
      UPDATE warehouses
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update warehouse error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /warehouses/:id
 * Удаление склада
 */
router.delete('/:id', authenticate, checkPermission('warehouses.delete'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const warehouseId = req.params.id;

    // Проверяем что на складе нет товаров
    const stockCheck = await db.mainPool.query(`
      SELECT COUNT(*) as count
      FROM warehouse_product_links
      WHERE warehouse_id = $1 AND quantity > 0
    `, [warehouseId]);

    if (parseInt(stockCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete warehouse with stock. Move products first.'
      });
    }

    const result = await db.mainPool.query(`
      DELETE FROM warehouses
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, name
    `, [warehouseId, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Warehouse deleted successfully',
        deleted_warehouse: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Delete warehouse error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /warehouses/:id/stock
 * Получение остатков по складу
 */
router.get('/:id/stock', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const warehouseId = req.params.id;
    const { limit = 50, offset = 0, search = '' } = req.query;

    let whereConditions = ['wpl.warehouse_id = $1'];
    let queryParams = [warehouseId];
    let paramIndex = 2;

    // Проверяем что склад принадлежит тенанту
    const warehouseCheck = await db.mainPool.query(`
      SELECT id FROM warehouses WHERE id = $1 AND tenant_id = $2
    `, [warehouseId, tenantId]);

    if (warehouseCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found'
      });
    }

    if (search) {
      whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await db.mainPool.query(`
      SELECT
        wpl.id,
        wpl.product_id,
        wpl.quantity,
        wpl.reserved_quantity,
        wpl.price,
        wpl.min_stock,
        wpl.max_stock,
        wpl.last_updated,
        p.name as product_name,
        p.sku as product_sku,
        p.image_url as product_image
      FROM warehouse_product_links wpl
      JOIN products p ON wpl.product_id = p.id
      WHERE ${whereClause}
      ORDER BY p.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get warehouse stock error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /warehouses/transfer
 * Перемещение товаров между складами
 */
router.post('/transfer', authenticate, checkPermission('warehouses.transfer'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      product_id,
      from_warehouse_id,
      to_warehouse_id,
      quantity,
      reason = 'Manual transfer'
    } = req.body;

    if (!product_id || !from_warehouse_id || !to_warehouse_id || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Product ID, source warehouse, target warehouse and quantity are required'
      });
    }

    if (parseInt(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be positive'
      });
    }

    // Проверяем наличие товара на исходном складе
    const stockCheck = await db.mainPool.query(`
      SELECT quantity
      FROM warehouse_product_links
      WHERE warehouse_id = $1 AND product_id = $2
    `, [from_warehouse_id, product_id]);

    if (stockCheck.rows.length === 0 || stockCheck.rows[0].quantity < parseInt(quantity)) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient stock on source warehouse'
      });
    }

    // Выполняем трансфер в транзакции
    await db.mainPool.query('BEGIN');

    try {
      // Уменьшаем остаток на исходном складе
      await db.mainPool.query(`
        UPDATE warehouse_product_links
        SET quantity = quantity - $1, last_updated = NOW()
        WHERE warehouse_id = $2 AND product_id = $3
      `, [parseInt(quantity), from_warehouse_id, product_id]);

      // Увеличиваем остаток на целевом складе
      await db.mainPool.query(`
        INSERT INTO warehouse_product_links (warehouse_id, product_id, quantity, last_updated)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET
          quantity = warehouse_product_links.quantity + $3,
          last_updated = NOW()
      `, [to_warehouse_id, product_id, parseInt(quantity)]);

      // Записываем движение
      await db.mainPool.query(`
        INSERT INTO warehouse_movements (
          tenant_id, product_id, from_warehouse_id, to_warehouse_id,
          quantity, movement_type, reason, user_id, created_at
        )
        VALUES ($1, $2, $3, $4, $5, 'transfer', $6, $7, NOW())
      `, [tenantId, product_id, from_warehouse_id, to_warehouse_id, parseInt(quantity), reason, req.user.userId]);

      await db.mainPool.query('COMMIT');

      res.json({
        success: true,
        data: {
          message: 'Transfer completed successfully',
          transfer: {
            product_id,
            from_warehouse_id,
            to_warehouse_id,
            quantity: parseInt(quantity),
            reason
          }
        }
      });

    } catch (error) {
      await db.mainPool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Warehouse transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;