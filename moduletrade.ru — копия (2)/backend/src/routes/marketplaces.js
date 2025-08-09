// backend/src/routes/marketplaces.js
const express = require('express');
const router = express.Router();
const db = require('../config/database'); // ✅ ДОБАВЛЕН ИМПОРТ DATABASE MANAGER
const { authenticate, checkPermission } = require('../middleware/auth');
const cryptoUtils = require('../utils/crypto');
const MarketplaceFactory = require('../adapters/MarketplaceFactory');

// Получение списка маркетплейсов
router.get('/', authenticate, async (req, res) => {
    try {
        // ✅ ИСПРАВЛЕНО: правильное использование db manager
        const result = await db.query(`
            SELECT
                id, public_id, name, type, credentials,
                commission_info, status, created_at, updated_at
            FROM marketplaces
            WHERE company_id = $1
            ORDER BY name
        `, [req.user.companyId]);

        // Дешифруем credentials перед отправкой (только для отображения, без чувствительных данных)
        const marketplaces = result.rows.map(marketplace => {
            const marketplaceCopy = { ...marketplace };
            if (marketplace.credentials && typeof marketplace.credentials === 'string' && cryptoUtils.isEncrypted(marketplace.credentials)) {
                try {
                    const decrypted = cryptoUtils.decrypt(marketplace.credentials);
                    // Скрываем чувствительные данные
                    marketplaceCopy.credentials = {
                        ...decrypted,
                        api_key: decrypted.api_key ? '***' : undefined,
                        password: decrypted.password ? '***' : undefined,
                        token: decrypted.token ? '***' : undefined,
                        client_secret: decrypted.client_secret ? '***' : undefined
                    };
                } catch (error) {
                    console.error('Decryption error for marketplace', marketplace.id, error);
                    marketplaceCopy.credentials = {};
                }
            }
            return marketplaceCopy;
        });

        res.json({
            success: true,
            data: marketplaces
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
        const result = await db.query('SELECT * FROM marketplaces WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Marketplace not found'
            });
        }

        const marketplace = { ...result.rows[0] };

        // Дешифруем credentials перед отправкой, но скрываем чувствительные данные
        if (marketplace.credentials && typeof marketplace.credentials === 'string' && cryptoUtils.isEncrypted(marketplace.credentials)) {
            try {
                const decrypted = cryptoUtils.decrypt(marketplace.credentials);
                marketplace.credentials = {
                    ...decrypted,
                    api_key: decrypted.api_key ? '***' : undefined,
                    password: decrypted.password ? '***' : undefined,
                    token: decrypted.token ? '***' : undefined,
                    client_secret: decrypted.client_secret ? '***' : undefined
                };
            } catch (error) {
                console.error('Decryption error for marketplace', marketplace.id, error);
                marketplace.credentials = {};
            }
        }

        res.json({
            success: true,
            data: marketplace
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
        const { name, type, credentials, commission_info } = req.body;

        if (!name || !type) {
            return res.status(400).json({
                success: false,
                error: 'Name and type are required'
            });
        }

        // Шифруем credentials перед сохранением
        let encryptedCredentials = credentials || {};
        if (credentials && typeof credentials === 'object') {
            encryptedCredentials = cryptoUtils.encrypt(credentials);
        }

        const result = await db.query(`
            INSERT INTO marketplaces (company_id, name, type, credentials, commission_info)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [
            req.user.companyId,
            name,
            type,
            encryptedCredentials,
            JSON.stringify(commission_info || {})
        ]);

        // Дешифруем для ответа, но скрываем чувствительные данные
        const marketplace = { ...result.rows[0] };
        if (marketplace.credentials && typeof marketplace.credentials === 'string' && cryptoUtils.isEncrypted(marketplace.credentials)) {
            try {
                const decrypted = cryptoUtils.decrypt(marketplace.credentials);
                marketplace.credentials = {
                    ...decrypted,
                    api_key: decrypted.api_key ? '***' : undefined,
                    password: decrypted.password ? '***' : undefined,
                    token: decrypted.token ? '***' : undefined,
                    client_secret: decrypted.client_secret ? '***' : undefined
                };
            } catch (error) {
                console.error('Decryption error:', error);
                marketplace.credentials = {};
            }
        }

        res.status(201).json({
            success: true,
            data: marketplace
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

        if (req.body.credentials) {
            updateFields.push(`credentials = $${paramIndex++}`);
            // Шифруем credentials перед сохранением
            const encryptedApiConfig = cryptoUtils.encrypt(req.body.credentials);
            values.push(encryptedApiConfig);
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

        const result = await db.query(`
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

        // Дешифруем для ответа, но скрываем чувствительные данные
        const marketplace = { ...result.rows[0] };
        if (marketplace.credentials && typeof marketplace.credentials === 'string' && cryptoUtils.isEncrypted(marketplace.credentials)) {
            try {
                const decrypted = cryptoUtils.decrypt(marketplace.credentials);
                marketplace.credentials = {
                    ...decrypted,
                    api_key: decrypted.api_key ? '***' : undefined,
                    password: decrypted.password ? '***' : undefined,
                    token: decrypted.token ? '***' : undefined,
                    client_secret: decrypted.client_secret ? '***' : undefined
                };
            } catch (error) {
                console.error('Decryption error:', error);
                marketplace.credentials = {};
            }
        }

        res.json({
            success: true,
            data: marketplace
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
        const linkedProducts = await db.query(
            'SELECT COUNT(*) as count FROM marketplace_product_links WHERE marketplace_id = $1',
            [req.params.id]
        );

        if (parseInt(linkedProducts.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete marketplace with linked products'
            });
        }

        const result = await db.query(
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
    const result = await db.query('SELECT id, name, type, credentials FROM marketplaces WHERE id = $1 AND company_id = $2', [req.params.id, req.user.companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Marketplace not found' });
    }

    const marketplace = result.rows[0];

    // Расшифровываем credentials
    let credentials = marketplace.credentials;
    if (credentials && typeof credentials === 'string' && cryptoUtils.isEncrypted(credentials)) {
      try {
        credentials = cryptoUtils.decrypt(credentials);
      } catch (e) {
        return res.status(400).json({ success: false, error: 'Failed to decrypt marketplace credentials' });
      }
    }

    // Создаем адаптер
    try {
      const factory = new MarketplaceFactory();
      const adapter = factory.createAdapter(marketplace.type, credentials || {});
      const testResult = await adapter.testConnection();

      if (testResult?.success) {
        return res.json({ success: true, message: testResult.message || 'Connection successful' });
      }

      return res.status(400).json({ success: false, error: testResult?.message || 'Marketplace connection failed' });
    } catch (adapterError) {
      return res.status(400).json({ success: false, error: adapterError.message || 'Failed to initialize marketplace adapter' });
    }
  } catch (error) {
    console.error('Test marketplace error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получение складов маркетплейса
router.get('/:id/warehouses', authenticate, async (req, res) => {
    try {
        const result = await db.query(`
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

        let whereConditions = ['o.marketplace_id = $1', 'o.company_id = $2'];
        const queryParams = [req.params.id, req.user.companyId];
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

        const result = await db.query(`
            SELECT
                o.*,
                COUNT(oi.id) as items_count,
                SUM(oi.quantity) as total_quantity
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.company_id = $1 AND ${whereClause}
            GROUP BY o.id
            ORDER BY o.order_date DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...queryParams, limit, offset]);

        // Подсчет общего количества
        const countResult = await db.query(`
            SELECT COUNT(*) as total
            FROM orders o
            WHERE o.company_id = $1 AND ${whereClause}
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
        //     req.user.companyId,
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

// Ограниченное обновление public_id маркетплейса
router.put('/:id/public-id', authenticate, checkPermission('marketplaces.update'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const marketplaceId = req.params.id;
    const { public_id: newPublicId } = req.body || {};

    const userRole = (req.user.role || '').toLowerCase();
    if (!['владелец', 'owner', 'администратор', 'administrator', 'admin'].includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to change public_id' });
    }

    const parsed = parseInt(newPublicId, 10);
    if (!Number.isInteger(parsed) || parsed < 100000) {
      return res.status(400).json({ success: false, error: 'public_id must be an integer >= 100000' });
    }

    const existing = await db.query('SELECT id FROM marketplaces WHERE id = $1 AND company_id = $2', [marketplaceId, companyId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Marketplace not found' });
    }

    const dup = await db.query('SELECT 1 FROM marketplaces WHERE company_id = $1 AND public_id = $2 AND id != $3', [companyId, parsed, marketplaceId]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'public_id already in use' });
    }

    const result = await db.query('UPDATE marketplaces SET public_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2 RETURNING *', [marketplaceId, companyId, parsed]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update marketplace public_id error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});