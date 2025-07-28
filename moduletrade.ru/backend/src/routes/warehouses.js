// Основание: Требования пользователя, Блок 1  
// Действие: API endpoints для управления складами

const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const WarehouseService = require('../services/WarehouseService');
const db = require('../config/database');

// Получение списка складов
router.get('/', authenticate, async (req, res) => {
    try {
        const warehouses = await WarehouseService.getWarehouses(
            req.user.tenantId,
            req.query
        );
        res.json(warehouses);
    } catch (error) {
        console.error('Get warehouses error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получение детальной информации о складе
router.get('/:id', authenticate, async (req, res) => {
    try {
        const warehouse = await WarehouseService.getWarehouseDetails(
            req.user.tenantId,
            req.params.id
        );
        res.json(warehouse);
    } catch (error) {
        console.error('Get warehouse details error:', error);
        res.status(error.message === 'Warehouse not found' ? 404 : 500).json({
            success: false,
            error: error.message
        });
    }
});

// Создание нового склада
router.post('/', authenticate, checkPermission('warehouses.create'), async (req, res) => {
    try {
        const warehouse = await WarehouseService.createWarehouse(
            req.user.tenantId,
            req.body
        );
        res.status(201).json({
            success: true,
            data: warehouse
        });
    } catch (error) {
        console.error('Create warehouse error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Обновление склада
router.put('/:id', authenticate, checkPermission('warehouses.update'), async (req, res) => {
    try {
        const warehouse = await WarehouseService.updateWarehouse(
            req.user.tenantId,
            req.params.id,
            req.body
        );
        res.json({
            success: true,
            data: warehouse
        });
    } catch (error) {
        console.error('Update warehouse error:', error);
        res.status(error.message === 'Warehouse not found' ? 404 : 400).json({
            success: false,
            error: error.message
        });
    }
});

// Удаление склада
router.delete('/:id', authenticate, checkPermission('warehouses.delete'), async (req, res) => {
    try {
        const pool = await db.getPool(req.user.tenantId);
        
        // Проверяем, есть ли товары на складе
        const checkResult = await pool.query(`
            SELECT COUNT(*) as count 
            FROM warehouse_product_links 
            WHERE warehouse_id = $1 AND quantity > 0
        `, [req.params.id]);
        
        if (parseInt(checkResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete warehouse with existing stock'
            });
        }
        
        // Удаляем склад
        await pool.query(`
            DELETE FROM warehouses 
            WHERE id = $1 AND tenant_id = $2
        `, [req.params.id, req.user.tenantId]);
        
        res.json({
            success: true,
            message: 'Warehouse deleted successfully'
        });
    } catch (error) {
        console.error('Delete warehouse error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Добавление компонента в мульти-склад
router.post('/:id/components', authenticate, checkPermission('warehouses.update'), async (req, res) => {
    try {
        const { source_warehouse_id, priority } = req.body;
        
        await WarehouseService.addMultiWarehouseComponent(
            req.user.tenantId,
            req.params.id,
            source_warehouse_id,
            priority
        );
        
        res.json({
            success: true,
            message: 'Component added successfully'
        });
    } catch (error) {
        console.error('Add warehouse component error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Удаление компонента из мульти-склада
router.delete('/:id/components/:componentId', authenticate, checkPermission('warehouses.update'), async (req, res) => {
    try {
        await WarehouseService.removeMultiWarehouseComponent(
            req.user.tenantId,
            req.params.id,
            req.params.componentId
        );
        
        res.json({
            success: true,
            message: 'Component removed successfully'
        });
    } catch (error) {
        console.error('Remove warehouse component error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Перемещение товара между складами
router.post('/transfer', authenticate, checkPermission('warehouses.transfer'), async (req, res) => {
    try {
        const { product_id, from_warehouse_id, to_warehouse_id, quantity, reason } = req.body;
        
        await WarehouseService.moveProduct(
            req.user.tenantId,
            product_id,
            from_warehouse_id,
            to_warehouse_id,
            quantity,
            req.user.id,
            reason
        );
        
        res.json({
            success: true,
            message: 'Product transferred successfully'
        });
    } catch (error) {
        console.error('Product transfer error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Получение остатков товара по складам
router.get('/product/:productId/stock', authenticate, async (req, res) => {
    try {
        const stock = await WarehouseService.getProductStockByWarehouses(
            req.user.tenantId,
            req.params.productId
        );
        res.json(stock);
    } catch (error) {
        console.error('Get product stock error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получение истории движений по складу
router.get('/:id/movements', authenticate, async (req, res) => {
    try {
        const pool = await db.getPool(req.user.tenantId);
        const { limit = 50, offset = 0 } = req.query;
        
        const result = await pool.query(`
            SELECT 
                wm.*,
                p.name as product_name,
                p.internal_code,
                fw.name as from_warehouse_name,
                tw.name as to_warehouse_name,
                u.email as user_email
            FROM warehouse_movements wm
            JOIN products p ON wm.product_id = p.id
            LEFT JOIN warehouses fw ON wm.from_warehouse_id = fw.id
            LEFT JOIN warehouses tw ON wm.to_warehouse_id = tw.id
            LEFT JOIN users u ON wm.user_id = u.id
            WHERE (wm.from_warehouse_id = $1 OR wm.to_warehouse_id = $1)
                AND wm.tenant_id = $2
            ORDER BY wm.created_at DESC
            LIMIT $3 OFFSET $4
        `, [req.params.id, req.user.tenantId, limit, offset]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Get warehouse movements error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Массовая корректировка остатков
router.post('/bulk-adjustment', authenticate, checkPermission('warehouses.adjust'), async (req, res) => {
    try {
        const { adjustments } = req.body; // [{warehouse_id, product_id, quantity, reason}]
        const pool = await db.getPool(req.user.tenantId);
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            for (const adjustment of adjustments) {
                // Получаем текущий остаток
                const currentResult = await client.query(`
                    SELECT quantity FROM warehouse_product_links
                    WHERE warehouse_id = $1 AND product_id = $2
                `, [adjustment.warehouse_id, adjustment.product_id]);
                
                const currentQuantity = currentResult.rows[0]?.quantity || 0;
                const difference = adjustment.quantity - currentQuantity;
                
                // Обновляем остаток
                await client.query(`
                    INSERT INTO warehouse_product_links (
                        warehouse_id, product_id, quantity, price
                    ) VALUES ($1, $2, $3, 0)
                    ON CONFLICT (warehouse_id, product_id) 
                    DO UPDATE SET 
                        quantity = $3,
                        last_updated = CURRENT_TIMESTAMP
                `, [adjustment.warehouse_id, adjustment.product_id, adjustment.quantity]);
                
                // Записываем движение
                if (difference !== 0) {
                    await client.query(`
                        INSERT INTO warehouse_movements (
                            tenant_id, product_id,
                            ${difference > 0 ? 'to_warehouse_id' : 'from_warehouse_id'},
                            quantity, movement_type, reason, user_id
                        ) VALUES ($1, $2, $3, $4, 'adjustment', $5, $6)
                    `, [
                        req.user.tenantId, 
                        adjustment.product_id,
                        adjustment.warehouse_id,
                        Math.abs(difference),
                        adjustment.reason || 'Bulk adjustment',
                        req.user.id
                    ]);
                }
            }
            
            await client.query('COMMIT');
            res.json({
                success: true,
                message: `${adjustments.length} adjustments processed`
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Bulk adjustment error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Экспорт остатков склада
router.get('/:id/export', authenticate, async (req, res) => {
    try {
        const pool = await db.getPool(req.user.tenantId);
        const format = req.query.format || 'csv';
        
        const result = await pool.query(`
            SELECT 
                p.internal_code,
                p.name as product_name,
                b.canonical_name as brand,
                c.canonical_name as category,
                wpl.quantity,
                wpl.reserved_quantity,
                wpl.quantity - wpl.reserved_quantity as available,
                wpl.price,
                wpl.last_updated
            FROM warehouse_product_links wpl
            JOIN products p ON wpl.product_id = p.id
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE wpl.warehouse_id = $1
            ORDER BY p.internal_code
        `, [req.params.id]);
        
        if (format === 'csv') {
            const csv = [
                'Артикул,Название,Бренд,Категория,Остаток,Зарезервировано,Доступно,Цена,Обновлено',
                ...result.rows.map(row => 
                    `"${row.internal_code}","${row.product_name}","${row.brand || ''}","${row.category || ''}",${row.quantity},${row.reserved_quantity},${row.available},${row.price},"${row.last_updated}"`
                )
            ].join('\n');
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="warehouse_stock.csv"');
            res.send('\ufeff' + csv); // BOM для корректного отображения в Excel
        } else {
            res.json(result.rows);
        }
    } catch (error) {
        console.error('Export warehouse stock error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

