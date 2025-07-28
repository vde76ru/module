const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const SupplierFactory = require('../adapters/SupplierFactory');

const supplierFactory = new SupplierFactory();

// Получение списка поставщиков
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.mainPool.query(`
      SELECT 
        s.*,
        COUNT(DISTINCT ps.product_id) as connected_products
      FROM suppliers s
      LEFT JOIN product_suppliers ps ON s.id = ps.supplier_id
      GROUP BY s.id
      ORDER BY s.priority DESC, s.created_at DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Добавление поставщика
router.post('/', authenticate, checkPermission('suppliers.create'), async (req, res) => {
  try {
    const { code, name, api_type, api_config, is_main, priority } = req.body;
    
    // Если ставим основным, снимаем флаг с других
    if (is_main) {
      await db.mainPool.query('UPDATE suppliers SET is_main = false');
    }
    
    const result = await db.mainPool.query(`
      INSERT INTO suppliers (
        code, name, api_type, api_config, is_main, priority
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      code,
      name,
      api_type,
      JSON.stringify(api_config),
      is_main || false,
      priority || 0
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Поиск товаров у поставщика
router.post('/:id/search', authenticate, async (req, res) => {
  try {
    const { query, options } = req.body;
    
    const supplierResult = await db.mainPool.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [req.params.id]
    );
    
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }
    
    const supplier = supplierResult.rows[0];
    const adapter = supplierFactory.createAdapter(
      supplier.api_type,
      supplier.api_config
    );
    
    const results = await adapter.searchProducts(query, options);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Search supplier products error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение остатков товара у поставщика
router.get('/:id/stock/:productCode', authenticate, async (req, res) => {
  try {
    const supplierResult = await db.mainPool.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [req.params.id]
    );
    
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }
    
    const supplier = supplierResult.rows[0];
    const adapter = supplierFactory.createAdapter(
      supplier.api_type,
      supplier.api_config
    );
    
    const stock = await adapter.getProductStock(req.params.productCode);
    
    res.json({
      success: true,
      data: stock
    });
  } catch (error) {
    console.error('Get supplier stock error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Создание заказа поставщику
router.post('/:id/orders', authenticate, checkPermission('orders.create'), async (req, res) => {
  try {
    const { items, scheduled_date } = req.body;
    
    const client = await db.mainPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Создаем заказ
      const orderResult = await client.query(`
        INSERT INTO supplier_orders (
          supplier_id, order_number, status, 
          total_amount, scheduled_date
        ) VALUES ($1, $2, 'pending', 0, $3)
        RETURNING *
      `, [
        req.params.id,
        `SO-${Date.now()}`,
        scheduled_date || new Date()
      ]);
      
      const order = orderResult.rows[0];
      let totalAmount = 0;
      
      // Добавляем позиции
      for (const item of items) {
        const itemResult = await client.query(`
          INSERT INTO supplier_order_items (
            supplier_order_id, product_supplier_id, 
            quantity, price
          ) VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [
          order.id,
          item.product_supplier_id,
          item.quantity,
          item.price
        ]);
        
        totalAmount += item.quantity * item.price;
      }
      
      // Обновляем общую сумму
      await client.query(
        'UPDATE supplier_orders SET total_amount = $1 WHERE id = $2',
        [totalAmount, order.id]
      );
      
      await client.query('COMMIT');
      
      order.total_amount = totalAmount;
      res.status(201).json({
        success: true,
        data: order
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create supplier order error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
