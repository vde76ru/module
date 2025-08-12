// ===================================================
// ФАЙЛ: backend/src/routes/warehouses.js
// ДОПОЛНЕНИЕ: API для управления остатками на складах
// ===================================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, checkPermission } = require('../middleware/auth');

// Безопасная инициализация сервисов
let WarehouseService;
try {
  WarehouseService = require('../services/WarehouseService');
} catch (error) {
  console.warn('WarehouseService not available:', error.message);
}

// Получение списка складов
router.get('/', authenticate, checkPermission('warehouses.view'), async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      is_active: req.query.is_active,
      is_main: req.query.is_main,
      search: req.query.search
    };

    const warehouses = await WarehouseService.getAllWarehouses(req.user.companyId, filters);

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

// Получение склада по ID
router.get('/:id', authenticate, checkPermission('warehouses.view'), async (req, res) => {
  try {
    const { id } = req.params;
    const warehouse = await WarehouseService.getWarehouseById(req.user.companyId, id);
    if (!warehouse) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }
    res.json({ success: true, data: warehouse });
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch warehouse' });
  }
});

// Создание склада (поддерживает is_active и плоские contact_* поля)
router.post('/', authenticate, checkPermission('warehouses.create'), async (req, res) => {
  try {
    const created = await WarehouseService.createWarehouse(req.user.companyId, req.body || {});
    res.json({ success: true, data: created });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to create warehouse' });
  }
});

// Обновление склада (поддерживает изменение is_active, contact_info, city)
router.put('/:id', authenticate, checkPermission('warehouses.update'), async (req, res) => {
  try {
    const updated = await WarehouseService.updateWarehouse(req.user.companyId, req.params.id, req.body || {});
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    const status = /not found/i.test(error.message) ? 404 : 400;
    res.status(status).json({ success: false, error: error.message || 'Failed to update warehouse' });
  }
});

// ===== Компоненты мульти-склада (минимальный набор) =====
router.get('/:id/components', authenticate, checkPermission('warehouses.view'), async (req, res) => {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT id FROM warehouses WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: 'Warehouse not found' });

    const { rows } = await db.query(`
      SELECT mwc.component_warehouse_id as id, w.name, w.type, mwc.weight, mwc.is_active
      FROM multi_warehouse_components mwc
      JOIN warehouses w ON w.id = mwc.component_warehouse_id
      WHERE mwc.multi_warehouse_id = $1
    `, [id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Fetch multi-warehouse components error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/:id/components', authenticate, checkPermission('warehouses.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { source_warehouse_id, weight = 1 } = req.body || {};
    if (!source_warehouse_id) return res.status(400).json({ success: false, error: 'source_warehouse_id is required' });

    const check = await db.query('SELECT id FROM warehouses WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: 'Warehouse not found' });

    await db.query(`
      INSERT INTO multi_warehouse_components (multi_warehouse_id, component_warehouse_id, weight)
      VALUES ($1, $2, $3)
      ON CONFLICT (multi_warehouse_id, component_warehouse_id)
      DO UPDATE SET weight = EXCLUDED.weight, is_active = TRUE, updated_at = NOW()
    `, [id, source_warehouse_id, weight]);

    return res.json({ success: true });
  } catch (error) {
    console.error('Add multi-warehouse component error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/:id/components/:componentId', authenticate, checkPermission('warehouses.update'), async (req, res) => {
  try {
    const { id, componentId } = req.params;
    const check = await db.query('SELECT id FROM warehouses WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: 'Warehouse not found' });

    await db.query(`
      DELETE FROM multi_warehouse_components
      WHERE multi_warehouse_id = $1 AND component_warehouse_id = $2
    `, [id, componentId]);

    return res.json({ success: true });
  } catch (error) {
    console.error('Remove multi-warehouse component error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Удаление склада
router.delete('/:id', authenticate, checkPermission('warehouses.delete'), async (req, res) => {
  try {
    const ok = await WarehouseService.deleteWarehouse(req.user.companyId, req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to delete warehouse' });
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
        COALESCE(s.price, s.retail_price) as price,
        s.retail_price,
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
      FROM warehouse_product_links s
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
      FROM warehouse_product_links s
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
      SELECT quantity, reserved_quantity,
             price, retail_price,
             purchase_price, wholesale_price, website_price, marketplace_price
      FROM warehouse_product_links
      WHERE warehouse_id = $1 AND product_id = $2
    `, [warehouse_id, product_id]);

    let currentQuantity = 0;
    let currentPrice = price || null;

    if (currentStockResult.rows.length > 0) {
      currentQuantity = parseFloat(currentStockResult.rows[0].quantity) || 0;
      // при отсутствии прямого price сохраняем только retail_price
      if (!price) {
        currentPrice = null;
      }
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
        UPDATE warehouse_product_links
        SET quantity = $3,
            available_quantity = $3 - reserved_quantity,
            price = COALESCE($4, price),
            retail_price = COALESCE($4, retail_price),
            last_sale_date = NOW(),
            updated_at = NOW()
        WHERE warehouse_id = $1 AND product_id = $2
      `, [warehouse_id, product_id, newQuantity, currentPrice]);
    } else {
      await client.query(`
        INSERT INTO warehouse_product_links (
          warehouse_id, product_id, quantity, available_quantity,
          reserved_quantity, price, retail_price, created_at, updated_at
        ) VALUES ($1, $2, $3, $3, 0, $4, $4, NOW(), NOW())
      `, [warehouse_id, product_id, newQuantity, currentPrice]);
    }

    // Записываем движение товара (согласовано с миграцией 005)
    const delta = newQuantity - currentQuantity;
    if (delta !== 0) {
      const isPositive = delta > 0;
      await client.query(`
        INSERT INTO warehouse_movements (
          from_warehouse_id,
          to_warehouse_id,
          product_id,
          movement_type,
          quantity,
          reference_type,
          reference_id,
          description,
          user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        isPositive ? null : warehouse_id,
        isPositive ? warehouse_id : null,
        product_id,
        'adjustment',
        isPositive ? Math.abs(delta) : -Math.abs(delta),
        'adjustment',
        null,
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
      SELECT available_quantity, price, retail_price
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
            retail_price = COALESCE($4, retail_price),
            updated_at = NOW()
        WHERE warehouse_id = $1 AND product_id = $2
      `, [to_warehouse_id, product_id, quantity, (sourceStock.price || sourceStock.retail_price || null)]);
    } else {
      // Создаем новую запись
      await client.query(`
        INSERT INTO warehouse_product_links (
          warehouse_id, product_id, quantity, available_quantity,
          reserved_quantity, price, retail_price, created_at, updated_at
        ) VALUES ($1, $2, $3, $3, 0, $4, $4, NOW(), NOW())
      `, [to_warehouse_id, product_id, quantity, (sourceStock.price || sourceStock.retail_price || null)]);
    }

    // Записываем движение товара (однообразно, с from/to)
    await client.query(`
      INSERT INTO warehouse_movements (
        from_warehouse_id,
        to_warehouse_id,
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        description,
        user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      from_warehouse_id,
      to_warehouse_id,
      product_id,
      'transfer',
      parseFloat(quantity),
      'transfer',
      null,
      `Transfer ${validation.from_warehouse_name} -> ${validation.to_warehouse_name}: ${reason}`,
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
        wm.id,
        wm.movement_type,
        wm.quantity,
        wm.reference_type,
        wm.reference_id,
        wm.description,
        wm.unit_cost,
        wm.currency,
        wm.movement_date,
        wm.created_at,
        wm.updated_at,
        p.name as product_name,
        p.sku,
        fw.name as from_warehouse_name,
        tw.name as to_warehouse_name,
        u.name as user_name
      FROM warehouse_movements wm
      LEFT JOIN products p ON wm.product_id = p.id
      LEFT JOIN warehouses fw ON wm.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON wm.to_warehouse_id = tw.id
      LEFT JOIN users u ON wm.user_id = u.id
      WHERE ($1::uuid IS NULL OR wm.from_warehouse_id = $1 OR wm.to_warehouse_id = $1)
        AND (fw.company_id = $2 OR tw.company_id = $2)
    `;

    const params = [id, req.user.companyId];
    let paramIndex = 3;

    if (filters.product_id) {
      query += ` AND wm.product_id = $${paramIndex}`;
      params.push(filters.product_id);
      paramIndex++;
    }

    if (filters.type) {
      query += ` AND wm.movement_type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.date_from) {
      query += ` AND wm.movement_date >= $${paramIndex}`;
      params.push(filters.date_from);
      paramIndex++;
    }

    if (filters.date_to) {
      query += ` AND wm.movement_date <= $${paramIndex}`;
      params.push(filters.date_to);
      paramIndex++;
    }

    query += ` ORDER BY wm.movement_date DESC, wm.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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

// Ограниченное обновление public_id склада
router.put('/:id/public-id', authenticate, checkPermission('warehouses.update'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const warehouseId = req.params.id;
    const { public_id: newPublicId } = req.body || {};

    const userRole = (req.user.role || '').toLowerCase();
    if (!['владелец', 'owner', 'администратор', 'administrator', 'admin'].includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to change public_id' });
    }

    const parsed = parseInt(newPublicId, 10);
    if (!Number.isInteger(parsed) || parsed < 100000) {
      return res.status(400).json({ success: false, error: 'public_id must be an integer >= 100000' });
    }

    const existing = await db.query('SELECT id FROM warehouses WHERE id = $1 AND company_id = $2', [warehouseId, companyId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }

    const dup = await db.query('SELECT 1 FROM warehouses WHERE company_id = $1 AND public_id = $2 AND id != $3', [companyId, parsed, warehouseId]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'public_id already in use' });
    }

    const result = await db.query('UPDATE warehouses SET public_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2 RETURNING *', [warehouseId, companyId, parsed]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update warehouse public_id error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Управление интеграцией склада с поставщиком (привязка виртуальных складов поставщиков)
router.post('/:id/suppliers/:supplierId', authenticate, checkPermission('warehouses.update'), async (req, res) => {
  try {
    const { id, supplierId } = req.params;
    const { external_warehouse_id, is_active = true, settings = {} } = req.body || {};
    // Проверим доступ
    const check = await db.query('SELECT id FROM warehouses WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: 'Warehouse not found' });
    if (!external_warehouse_id) return res.status(400).json({ success: false, error: 'external_warehouse_id is required' });

    // Сохраним связку в settings склада (массив источников)
    const wh = await db.query('SELECT settings FROM warehouses WHERE id = $1', [id]);
    const current = wh.rows[0]?.settings || {};
    const sources = Array.isArray(current.supplier_sources) ? current.supplier_sources : [];
    const filtered = sources.filter(s => !(s && s.supplier_id === supplierId && s.external_warehouse_id === String(external_warehouse_id)));
    filtered.push({ supplier_id: supplierId, external_warehouse_id: String(external_warehouse_id), is_active, settings });
    current.supplier_sources = filtered;
    await db.query('UPDATE warehouses SET settings = $2, updated_at = NOW() WHERE id = $1', [id, current]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Warehouse-supplier link error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Экспорт склада: JSON/XML (простая версия)
router.get('/:id/export', authenticate, checkPermission('warehouses.view'), async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;
    const check = await db.query('SELECT id, name FROM warehouses WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: 'Warehouse not found' });

    const dataRes = await db.query(`
      SELECT p.sku, p.name, COALESCE(wpl.available_quantity, 0) as available_quantity, COALESCE(wpl.price, wpl.retail_price, 0) as price, wpl.currency
      FROM warehouse_product_links wpl
      JOIN products p ON p.id = wpl.product_id
      WHERE wpl.warehouse_id = $1
      ORDER BY p.name
    `, [id]);
    const rows = dataRes.rows;

    if (format === 'xml') {
      const items = rows.map(r => `  <item>\n    <sku>${r.sku || ''}</sku>\n    <name>${(r.name || '').replace(/&/g,'&amp;')}</name>\n    <qty>${r.available_quantity}</qty>\n    <price>${r.price}</price>\n    <currency>${r.currency || 'RUB'}</currency>\n  </item>`).join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<warehouse id="${id}">\n${items}\n</warehouse>`;
      res.set('Content-Type', 'application/xml');
      return res.send(xml);
    }
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Export warehouse error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});