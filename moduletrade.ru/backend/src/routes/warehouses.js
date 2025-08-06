// ===================================================
// ФАЙЛ: backend/src/routes/warehouses.js
// ДОПОЛНЕНИЕ: API для управления остатками на складах
// ===================================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, checkPermission } = require('../middleware/auth');

// Безопасная инициализация сервисов
let warehouseService;
try {
  warehouseService = require('../services/WarehouseService');
} catch (error) {
  console.warn('WarehouseService not available:', error.message);
}

// Получение списка складов
router.get('/', authenticate, checkPermission('warehouses.view'), async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      is_active: req.query.is_active
    };

    const warehouses = await warehouseService.getWarehouses(req.user.companyId, filters);

    res.json({
      success: true,
      data: warehouses
    });

  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch warehouses'
    });
  }
});

// Получение остатков по складу
router.get('/:id/stock', authenticate, checkPermission('warehouses.view'), async (req, res) => {
  try {
    const { id } = req.params;
    const filters = {
      search: req.query.search,
      category_id: req.query.category_id,
      low_stock: req.query.low_stock === 'true',
      out_of_stock: req.query.out_of_stock === 'true',
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    // Проверяем принадлежность склада компании
    const warehouseCheck = await db.query(
      'SELECT id FROM warehouses WHERE id = $1 AND company_id = $2',
      [id, req.user.companyId]
    );

    if (warehouseCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found'
      });
    }

    // Получаем остатки
    let query = `
      SELECT 
        s.product_id,
        p.name as product_name,
        p.sku,
        s.quantity,
        s.reserved_quantity,
        s.available_quantity,
        s.price,
        s.location_code,
        s.min_quantity as min_stock_level,
        s.reorder_point,
        s.last_sale_date as last_movement,
        s.updated_at,
        CASE
          WHEN s.available_quantity <= 0 THEN 'out_of_stock'
          WHEN s.available_quantity <= COALESCE(s.min_quantity, 0) THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status,
        c.name as category_name
      FROM stocks s
      JOIN products p ON s.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE s.warehouse_id = $1
    `;

    const params = [id];
    let paramIndex = 2;

    if (filters.search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.category_id) {
      query += ` AND p.category_id = $${paramIndex}`;
      params.push(filters.category_id);
      paramIndex++;
    }

    if (filters.low_stock) {
      query += ` AND s.available_quantity <= COALESCE(s.min_quantity, 0)`;
    }

    if (filters.out_of_stock) {
      query += ` AND s.available_quantity <= 0`;
    }

    query += ` ORDER BY p.name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(filters.limit, filters.offset);

    const result = await db.query(query, params);

    // Получаем общее количество для пагинации
    let countQuery = `
      SELECT COUNT(*) as total
      FROM stocks s
      JOIN products p ON s.product_id = p.id
      WHERE s.warehouse_id = $1
    `;

    const countParams = [id];
    let countParamIndex = 2;

    if (filters.search) {
      countQuery += ` AND (p.name ILIKE $${countParamIndex} OR p.sku ILIKE $${countParamIndex})`;
      countParams.push(`%${filters.search}%`);
      countParamIndex++;
    }

    if (filters.category_id) {
      countQuery += ` AND p.category_id = $${countParamIndex}`;
      countParams.push(filters.category_id);
      countParamIndex++;
    }

    if (filters.low_stock) {
      countQuery += ` AND s.available_quantity <= COALESCE(s.min_quantity, 0)`;
    }

    if (filters.out_of_stock) {
      countQuery += ` AND s.available_quantity <= 0`;
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: filters.limit,
        offset: filters.offset,
        page: Math.floor(filters.offset / filters.limit) + 1
      }
    });

  } catch (error) {
    console.error('Error fetching warehouse stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch warehouse stock'
    });
  }
});

// Обновление остатков товара на складе
router.post('/stock', authenticate, checkPermission('warehouses.update'), async (req, res) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const {
      warehouse_id,
      product_id,
      quantity,
      price,
      operation = 'set', // set, add, subtract
      reason = 'Manual adjustment'
    } = req.body;

    // Валидация
    if (!warehouse_id || !product_id || quantity === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: warehouse_id, product_id, quantity'
      });
    }

    // Проверяем принадлежность склада и товара компании
    const validationResult = await client.query(`
      SELECT w.id as warehouse_id, p.id as product_id, p.name as product_name
      FROM warehouses w
      CROSS JOIN products p
      WHERE w.id = $1 AND p.id = $2 
        AND w.company_id = $3 AND p.company_id = $3
    `, [warehouse_id, product_id, req.user.companyId]);

    if (validationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Warehouse or product not found'
      });
    }

    const validation = validationResult.rows[0];

    // Получаем текущие остатки
    const currentStockResult = await client.query(`
      SELECT quantity, reserved_quantity, price
      FROM stocks
      WHERE warehouse_id = $1 AND product_id = $2
    `, [warehouse_id, product_id]);

    let currentQuantity = 0;
    let currentPrice = price || 0;

    if (currentStockResult.rows.length > 0) {
      currentQuantity = parseFloat(currentStockResult.rows[0].quantity) || 0;
      currentPrice = price || parseFloat(currentStockResult.rows[0].price) || 0;
    }

    // Вычисляем новое количество
    let newQuantity;
    switch (operation) {
      case 'add':
        newQuantity = currentQuantity + parseFloat(quantity);
        break;
      case 'subtract':
        newQuantity = Math.max(0, currentQuantity - parseFloat(quantity));
        break;
      case 'set':
      default:
        newQuantity = parseFloat(quantity);
        break;
    }

    // Обновляем или создаем запись остатков
    if (currentStockResult.rows.length > 0) {
      await client.query(`
        UPDATE stocks
        SET quantity = $3,
            available_quantity = $3 - reserved_quantity,
            price = $4,
            last_sale_date = NOW(),
            updated_at = NOW()
        WHERE warehouse_id = $1 AND product_id = $2
      `, [warehouse_id, product_id, newQuantity, currentPrice]);
    } else {
      await client.query(`
        INSERT INTO stocks (
          warehouse_id, product_id, quantity, available_quantity,
          reserved_quantity, price, created_at, updated_at
        ) VALUES ($1, $2, $3, $3, 0, $4, NOW(), NOW())
      `, [warehouse_id, product_id, newQuantity, currentPrice]);
    }

    // Записываем движение товара
    const movementType = newQuantity > currentQuantity ? 'adjustment_plus' : 
                        newQuantity < currentQuantity ? 'adjustment_minus' : 'adjustment';
    
    const movementQuantity = Math.abs(newQuantity - currentQuantity);

    if (movementQuantity > 0) {
      await client.query(`
        INSERT INTO warehouse_movements (
          company_id, warehouse_id, product_id, type, quantity,
          from_location, to_location, reason, user_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        req.user.companyId,
        warehouse_id,
        product_id,
        movementType,
        movementQuantity,
        movementType === 'adjustment_minus' ? 'STOCK' : null,
        movementType === 'adjustment_plus' ? 'STOCK' : null,
        reason,
        req.user.id
      ]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        warehouse_id,
        product_id,
        product_name: validation.product_name,
        previous_quantity: currentQuantity,
        new_quantity: newQuantity,
        operation,
        reason
      },
      message: 'Stock updated successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update stock'
    });
  } finally {
    client.release();
  }
});

// Перемещение товара между складами
router.post('/transfer', authenticate, checkPermission('warehouses.transfer'), async (req, res) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const {
      from_warehouse_id,
      to_warehouse_id,
      product_id,
      quantity,
      reason = 'Manual transfer'
    } = req.body;

    // Валидация
    if (!from_warehouse_id || !to_warehouse_id || !product_id || !quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    if (from_warehouse_id === to_warehouse_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Source and destination warehouses cannot be the same'
      });
    }

    // Проверяем принадлежность складов и товара компании
    const validationResult = await client.query(`
      SELECT 
        w1.name as from_warehouse_name,
        w2.name as to_warehouse_name,
        p.name as product_name
      FROM warehouses w1
      CROSS JOIN warehouses w2
      CROSS JOIN products p
      WHERE w1.id = $1 AND w2.id = $2 AND p.id = $3
        AND w1.company_id = $4 AND w2.company_id = $4 AND p.company_id = $4
    `, [from_warehouse_id, to_warehouse_id, product_id, req.user.companyId]);

    if (validationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Warehouses or product not found'
      });
    }

    const validation = validationResult.rows[0];

    // Проверяем наличие товара на исходном складе
    const sourceStockResult = await client.query(`
      SELECT available_quantity, price
      FROM warehouse_product_links
      WHERE warehouse_id = $1 AND product_id = $2
    `, [from_warehouse_id, product_id]);

    if (sourceStockResult.rows.length === 0 || 
        parseFloat(sourceStockResult.rows[0].available_quantity) < parseFloat(quantity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Insufficient stock in source warehouse'
      });
    }

    const sourceStock = sourceStockResult.rows[0];

    // Уменьшаем остатки на исходном складе
    await client.query(`
      UPDATE warehouse_product_links
      SET quantity = quantity - $3,
          available_quantity = available_quantity - $3,
          updated_at = NOW()
      WHERE warehouse_id = $1 AND product_id = $2
    `, [from_warehouse_id, product_id, quantity]);

    // Увеличиваем остатки на целевом складе
    const targetStockResult = await client.query(`
      SELECT id FROM warehouse_product_links
      WHERE warehouse_id = $1 AND product_id = $2
    `, [to_warehouse_id, product_id]);

    if (targetStockResult.rows.length > 0) {
      // Обновляем существующую запись
      await client.query(`
        UPDATE warehouse_product_links
        SET quantity = quantity + $3,
            available_quantity = available_quantity + $3,
            price = COALESCE($4, price),
            updated_at = NOW()
        WHERE warehouse_id = $1 AND product_id = $2
      `, [to_warehouse_id, product_id, quantity, sourceStock.price]);
    } else {
      // Создаем новую запись
      await client.query(`
        INSERT INTO warehouse_product_links (
          warehouse_id, product_id, quantity, available_quantity,
          reserved_quantity, price, created_at, updated_at
        ) VALUES ($1, $2, $3, $3, 0, $4, NOW(), NOW())
      `, [to_warehouse_id, product_id, quantity, sourceStock.price]);
    }

    // Записываем движение товара
    await client.query(`
      INSERT INTO warehouse_movements (
        company_id, from_warehouse_id, to_warehouse_id, product_id,
        type, quantity, reason, user_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      req.user.companyId,
      from_warehouse_id,
      to_warehouse_id,
      product_id,
      'transfer',
      quantity,
      reason,
      req.user.id
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        from_warehouse: validation.from_warehouse_name,
        to_warehouse: validation.to_warehouse_name,
        product_name: validation.product_name,
        quantity: parseFloat(quantity),
        reason
      },
      message: 'Stock transferred successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error transferring stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transfer stock'
    });
  } finally {
    client.release();
  }
});

// Получение движений товаров по складу
router.get('/:id/movements', authenticate, checkPermission('warehouses.view'), async (req, res) => {
  try {
    const { id } = req.params;
    const filters = {
      product_id: req.query.product_id,
      type: req.query.type,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    // Проверяем принадлежность склада компании
    const warehouseCheck = await db.query(
      'SELECT id FROM warehouses WHERE id = $1 AND company_id = $2',
      [id, req.user.companyId]
    );

    if (warehouseCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found'
      });
    }

    let query = `
      SELECT 
        wm.*,
        p.name as product_name,
        p.sku,
        wf.name as from_warehouse_name,
        wt.name as to_warehouse_name,
        u.name as user_name
      FROM warehouse_movements wm
      LEFT JOIN products p ON wm.product_id = p.id
      LEFT JOIN warehouses wf ON wm.from_warehouse_id = wf.id
      LEFT JOIN warehouses wt ON wm.to_warehouse_id = wt.id
      LEFT JOIN users u ON wm.user_id = u.id
      WHERE (wm.warehouse_id = $1 OR wm.from_warehouse_id = $1 OR wm.to_warehouse_id = $1)
        AND wm.company_id = $2
    `;

    const params = [id, req.user.companyId];
    let paramIndex = 3;

    if (filters.product_id) {
      query += ` AND wm.product_id = $${paramIndex}`;
      params.push(filters.product_id);
      paramIndex++;
    }

    if (filters.type) {
      query += ` AND wm.type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.date_from) {
      query += ` AND wm.created_at >= $${paramIndex}`;
      params.push(filters.date_from);
      paramIndex++;
    }

    if (filters.date_to) {
      query += ` AND wm.created_at <= $${paramIndex}`;
      params.push(filters.date_to);
      paramIndex++;
    }

    query += ` ORDER BY wm.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(filters.limit, filters.offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching warehouse movements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch warehouse movements'
    });
  }
});

module.exports = router;