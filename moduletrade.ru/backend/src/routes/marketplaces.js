// backend/src/routes/marketplaces.js
const express = require('express');
const router = express.Router();
const db = require('../config/database'); // ✅ ДОБАВЛЕН ИМПОРТ DATABASE MANAGER
const { authenticate, checkPermission } = require('../middleware/auth');

// Получение списка маркетплейсов
router.get('/', authenticate, async (req, res) => {
    try {
        // ✅ ИСПРАВЛЕНО: правильное использование db manager
        const result = await db.mainPool.query(`
            SELECT
                id, code, name, api_type, api_config,
                commission_rules, created_at, updated_at
            FROM marketplaces
            WHERE id IN (
                SELECT DISTINCT marketplace_id
                FROM marketplace_product_links
                WHERE tenant_id = $1
            )
            OR id IN (
                SELECT id FROM marketplaces WHERE api_type = 'public'
            )
            ORDER BY name
        `, [req.user.tenantId]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get marketplaces error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получение одного маркетплейса
router.get('/:id', authenticate, async (req, res) => {
    try {
        const result = await db.mainPool.query(
            'SELECT * FROM marketplaces WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Marketplace not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get marketplace error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Создание маркетплейса (только для админов)
router.post('/', authenticate, checkPermission('marketplaces.create'), async (req, res) => {
    try {
        const { code, name, api_type, api_config, commission_rules } = req.body;

        if (!code || !name || !api_type) {
            return res.status(400).json({
                success: false,
                error: 'Code, name and api_type are required'
            });
        }

        const result = await db.mainPool.query(`
            INSERT INTO marketplaces (code, name, api_type, api_config, commission_rules)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [
            code,
            name,
            api_type,
            JSON.stringify(api_config || {}),
            JSON.stringify(commission_rules || {})
        ]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Create marketplace error:', error);
        if (error.code === '23505') { // Unique violation
            res.status(400).json({
                success: false,
                error: 'Marketplace with this code already exists'
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
});

// Обновление маркетплейса
router.put('/:id', authenticate, checkPermission('marketplaces.update'), async (req, res) => {
    try {
        const updateFields = [];
        const values = [];
        let paramIndex = 1;

        if (req.body.name) {
            updateFields.push(`name = $${paramIndex++}`);
            values.push(req.body.name);
        }

        if (req.body.api_config) {
            updateFields.push(`api_config = $${paramIndex++}`);
            values.push(JSON.stringify(req.body.api_config));
        }

        if (req.body.commission_rules) {
            updateFields.push(`commission_rules = $${paramIndex++}`);
            values.push(JSON.stringify(req.body.commission_rules));
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(req.params.id);

        const result = await db.mainPool.query(`
            UPDATE marketplaces
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Marketplace not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update marketplace error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Удаление маркетплейса
router.delete('/:id', authenticate, checkPermission('marketplaces.delete'), async (req, res) => {
    try {
        // Проверяем, есть ли связанные товары
        const linkedProducts = await db.mainPool.query(
            'SELECT COUNT(*) as count FROM marketplace_product_links WHERE marketplace_id = $1',
            [req.params.id]
        );

        if (parseInt(linkedProducts.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete marketplace with linked products'
            });
        }

        const result = await db.mainPool.query(
            'DELETE FROM marketplaces WHERE id = $1 RETURNING *',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Marketplace not found'
            });
        }

        res.json({
            success: true,
            message: 'Marketplace deleted successfully'
        });
    } catch (error) {
        console.error('Delete marketplace error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Проверка подключения к маркетплейсу
router.post('/:id/test', authenticate, async (req, res) => {
    try {
        const result = await db.mainPool.query(
            'SELECT * FROM marketplaces WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Marketplace not found'
            });
        }

        const marketplace = result.rows[0];

        // Здесь должна быть логика тестирования API маркетплейса
        // const adapter = marketplaceFactory.createAdapter(
        //     marketplace.api_type,
        //     marketplace.api_config
        // );

        // Тестовый вызов API
        try {
            // await adapter.testConnection();
            res.json({
                success: true,
                message: 'Connection test successful (mock)'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Connection failed: ' + error.message
            });
        }
    } catch (error) {
        console.error('Test marketplace error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получение складов маркетплейса
router.get('/:id/warehouses', authenticate, async (req, res) => {
    try {
        const result = await db.mainPool.query(`
            SELECT mw.*, s.name as supplier_name
            FROM marketplace_warehouses mw
            LEFT JOIN suppliers s ON mw.supplier_id = s.id
            WHERE mw.marketplace_id = $1 AND mw.is_active = true
            ORDER BY mw.warehouse_name
        `, [req.params.id]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get warehouses error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получение заказов с маркетплейса
router.get('/:id/orders', authenticate, async (req, res) => {
    try {
        const {
            limit = 50,
            offset = 0,
            status,
            date_from,
            date_to
        } = req.query;

        let whereConditions = ['o.marketplace_id = $1', 'o.tenant_id = $2'];
        const queryParams = [req.params.id, req.user.tenantId];
        let paramIndex = 3;

        if (status) {
            whereConditions.push(`o.status = $${paramIndex}`);
            queryParams.push(status);
            paramIndex++;
        }

        if (date_from) {
            whereConditions.push(`o.order_date >= $${paramIndex}`);
            queryParams.push(date_from);
            paramIndex++;
        }

        if (date_to) {
            whereConditions.push(`o.order_date <= $${paramIndex}`);
            queryParams.push(date_to);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const result = await db.query(req.user.tenantId, `
            SELECT
                o.*,
                COUNT(oi.id) as items_count,
                SUM(oi.quantity) as total_quantity
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE ${whereClause}
            GROUP BY o.id
            ORDER BY o.order_date DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...queryParams, limit, offset]);

        // Подсчет общего количества
        const countResult = await db.query(req.user.tenantId, `
            SELECT COUNT(*) as total
            FROM orders o
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
        console.error('Get marketplace orders error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Синхронизация с маркетплейсом
router.post('/:id/sync', authenticate, checkPermission('sync.execute'), async (req, res) => {
    try {
        const { sync_type = 'full' } = req.body; // full, orders, products, stock

        // Здесь должна быть логика синхронизации
        // const syncResult = await syncService.syncMarketplace(
        //     req.params.id,
        //     req.user.tenantId,
        //     sync_type
        // );

        res.json({
            success: true,
            message: `${sync_type} sync started`,
            data: {
                marketplace_id: req.params.id,
                sync_type: sync_type,
                started_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Sync marketplace error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;