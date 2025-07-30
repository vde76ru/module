// Модуль: Backend Service - Управление складами
// Файл: backend/src/services/WarehouseService.js
// Основание: Требования пользователя, система складов из "Внесенные правки 4.pdf"
// Действие: Создание сервиса для управления складами и остатками

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const rabbitmq = require('../config/rabbitmq');

class WarehouseService {
    constructor() {
        this.warehouseCache = new Map();
    }

    /**
     * Создание нового склада
     */
    async createWarehouse(tenantId, warehouseData) {
        const {
            name,
            type = 'physical',
            description,
            address,
            priority = 0,
            settings = {}
        } = warehouseData;

        const pool = await db.getPool(tenantId);
        const warehouseId = uuidv4();

        try {
            await pool.query(`
                INSERT INTO warehouses (
                    id, tenant_id, name, type, description, 
                    address, priority, settings, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                warehouseId, tenantId, name, type, description,
                address, priority, JSON.stringify(settings), true
            ]);

            // Очищаем кеш
            this.warehouseCache.delete(tenantId);

            return warehouseId;
        } catch (error) {
            console.error('Error creating warehouse:', error);
            throw error;
        }
    }

    /**
     * Получение списка складов
     */
    async getWarehouses(tenantId, filters = {}) {
        const cacheKey = `${tenantId}-warehouses`;
        
        if (!filters.skipCache && this.warehouseCache.has(cacheKey)) {
            return this.warehouseCache.get(cacheKey);
        }

        const pool = await db.getPool(tenantId);
        let query = `
            SELECT w.*, 
                   COUNT(DISTINCT wpl.product_id) as product_count,
                   SUM(wpl.quantity * wpl.price) as total_value
            FROM warehouses w
            LEFT JOIN warehouse_product_links wpl ON w.id = wpl.warehouse_id
            WHERE w.tenant_id = $1
        `;

        const params = [tenantId];

        if (filters.type) {
            params.push(filters.type);
            query += ` AND w.type = $${params.length}`;
        }

        if (filters.is_active !== undefined) {
            params.push(filters.is_active);
            query += ` AND w.is_active = $${params.length}`;
        }

        query += ` GROUP BY w.id ORDER BY w.priority DESC, w.name`;

        const result = await pool.query(query, params);
        
        this.warehouseCache.set(cacheKey, result.rows);
        return result.rows;
    }

    /**
     * Получение основного склада
     */
    async getDefaultWarehouse(tenantId) {
        const warehouses = await this.getWarehouses(tenantId, { is_active: true });
        return warehouses.find(w => w.type === 'physical' && w.name === 'Основной склад') || 
               warehouses[0] || null;
    }

    /**
     * Обновление остатков на складе
     */
    async updateStock(tenantId, warehouseId, productId, quantity, price = null) {
        const pool = await db.getPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Проверяем существующую запись
            const existing = await client.query(`
                SELECT quantity, reserved_quantity, price 
                FROM warehouse_product_links
                WHERE warehouse_id = $1 AND product_id = $2
            `, [warehouseId, productId]);

            if (existing.rows.length > 0) {
                // Обновляем существующую запись
                const updatePrice = price !== null ? price : existing.rows[0].price;
                
                await client.query(`
                    UPDATE warehouse_product_links
                    SET quantity = $3, 
                        price = $4,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE warehouse_id = $1 AND product_id = $2
                `, [warehouseId, productId, quantity, updatePrice]);

                // Записываем движение товара
                const difference = quantity - existing.rows[0].quantity;
                if (difference !== 0) {
                    await this.recordMovement(client, {
                        tenantId,
                        productId,
                        warehouseId,
                        quantity: Math.abs(difference),
                        type: difference > 0 ? 'adjustment_plus' : 'adjustment_minus',
                        reason: 'Stock update'
                    });
                }
            } else {
                // Создаем новую запись
                await client.query(`
                    INSERT INTO warehouse_product_links (
                        warehouse_id, product_id, quantity, price, reserved_quantity
                    ) VALUES ($1, $2, $3, $4, 0)
                `, [warehouseId, productId, quantity, price || 0]);

                if (quantity > 0) {
                    await this.recordMovement(client, {
                        tenantId,
                        productId,
                        toWarehouseId: warehouseId,
                        quantity,
                        type: 'initial',
                        reason: 'Initial stock'
                    });
                }
            }

            await client.query('COMMIT');

            // Публикуем событие об изменении остатков
            await rabbitmq.publishMessage(rabbitmq.queues.STOCK_UPDATE, {
                type: 'stock_updated',
                tenantId,
                warehouseId,
                productId,
                quantity,
                price
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error updating stock:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Резервирование товара для заказа
     */
    async reserveStock(tenantId, reservations) {
        const pool = await db.getPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const results = [];

            for (const reservation of reservations) {
                const { productId, quantity, preferredWarehouseId } = reservation;

                // Получаем доступные остатки
                let availableStock = await client.query(`
                    SELECT wpl.*, w.priority, w.type
                    FROM warehouse_product_links wpl
                    JOIN warehouses w ON wpl.warehouse_id = w.id
                    WHERE wpl.product_id = $1 
                      AND w.tenant_id = $2
                      AND w.is_active = TRUE
                      AND (wpl.quantity - wpl.reserved_quantity) >= $3
                    ORDER BY 
                        CASE WHEN wpl.warehouse_id = $4 THEN 0 ELSE 1 END,
                        w.priority DESC,
                        wpl.price ASC
                `, [productId, tenantId, quantity, preferredWarehouseId || '00000000-0000-0000-0000-000000000000']);

                if (availableStock.rows.length === 0) {
                    // Проверяем можно ли собрать с нескольких складов
                    availableStock = await this.findMultiWarehouseStock(
                        client, 
                        tenantId, 
                        productId, 
                        quantity
                    );
                }

                if (availableStock.rows.length > 0) {
                    // Резервируем на первом подходящем складе
                    const stock = availableStock.rows[0];
                    
                    await client.query(`
                        UPDATE warehouse_product_links
                        SET reserved_quantity = reserved_quantity + $3
                        WHERE warehouse_id = $1 AND product_id = $2
                    `, [stock.warehouse_id, productId, quantity]);

                    results.push({
                        productId,
                        warehouseId: stock.warehouse_id,
                        quantity,
                        price: stock.price,
                        success: true
                    });
                } else {
                    results.push({
                        productId,
                        quantity,
                        success: false,
                        error: 'Insufficient stock'
                    });
                }
            }

            await client.query('COMMIT');
            return results;

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error reserving stock:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Снятие резерва
     */
    async releaseReservation(tenantId, warehouseId, productId, quantity) {
        const pool = await db.getPool(tenantId);
        
        await pool.query(`
            UPDATE warehouse_product_links
            SET reserved_quantity = GREATEST(0, reserved_quantity - $3)
            WHERE warehouse_id = $1 AND product_id = $2
        `, [warehouseId, productId, quantity]);
    }

    /**
     * Подтверждение резерва (списание товара)
     */
    async confirmReservation(tenantId, warehouseId, productId, quantity, orderId) {
        const pool = await db.getPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Списываем товар
            await client.query(`
                UPDATE warehouse_product_links
                SET quantity = quantity - $3,
                    reserved_quantity = GREATEST(0, reserved_quantity - $3)
                WHERE warehouse_id = $1 AND product_id = $2
            `, [warehouseId, productId, quantity]);

            // Записываем движение
            await this.recordMovement(client, {
                tenantId,
                productId,
                fromWarehouseId: warehouseId,
                quantity,
                type: 'sale',
                reason: `Order ${orderId}`
            });

            await client.query('COMMIT');

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Перемещение товара между складами
     */
    async moveStock(tenantId, fromWarehouseId, toWarehouseId, productId, quantity, userId, reason) {
        const pool = await db.getPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Проверяем доступность товара
            const sourceStock = await client.query(`
                SELECT quantity, reserved_quantity, price
                FROM warehouse_product_links
                WHERE warehouse_id = $1 AND product_id = $2
            `, [fromWarehouseId, productId]);

            if (sourceStock.rows.length === 0) {
                throw new Error('Product not found on source warehouse');
            }

            const available = sourceStock.rows[0].quantity - sourceStock.rows[0].reserved_quantity;
            if (available < quantity) {
                throw new Error(`Insufficient stock. Available: ${available}, requested: ${quantity}`);
            }

            // Списываем с исходного склада
            await client.query(`
                UPDATE warehouse_product_links
                SET quantity = quantity - $3
                WHERE warehouse_id = $1 AND product_id = $2
            `, [fromWarehouseId, productId, quantity]);

            // Добавляем на целевой склад
            await client.query(`
                INSERT INTO warehouse_product_links (
                    warehouse_id, product_id, quantity, price
                ) VALUES ($1, $2, $3, $4)
                ON CONFLICT (warehouse_id, product_id)
                DO UPDATE SET 
                    quantity = warehouse_product_links.quantity + $3,
                    last_updated = CURRENT_TIMESTAMP
            `, [toWarehouseId, productId, quantity, sourceStock.rows[0].price]);

            // Записываем движение
            await this.recordMovement(client, {
                tenantId,
                productId,
                fromWarehouseId,
                toWarehouseId,
                quantity,
                type: 'transfer',
                reason,
                userId
            });

            await client.query('COMMIT');

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Создание мульти-склада
     */
    async createMultiWarehouse(tenantId, name, componentWarehouseIds, settings = {}) {
        const pool = await db.getPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Создаем мульти-склад
            const multiWarehouseId = await this.createWarehouse(tenantId, {
                name,
                type: 'multi',
                settings
            });

            // Добавляем компоненты
            for (let i = 0; i < componentWarehouseIds.length; i++) {
                await client.query(`
                    INSERT INTO multi_warehouse_components (
                        multi_warehouse_id, source_warehouse_id, priority
                    ) VALUES ($1, $2, $3)
                `, [multiWarehouseId, componentWarehouseIds[i], componentWarehouseIds.length - i]);
            }

            await client.query('COMMIT');

            // Пересчитываем остатки на мульти-складе
            await this.recalculateMultiWarehouseStock(tenantId, multiWarehouseId);

            return multiWarehouseId;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Пересчет остатков мульти-склада
     */
    async recalculateMultiWarehouseStock(tenantId, multiWarehouseId) {
        const pool = await db.getPool(tenantId);
        
        // Вызываем хранимую процедуру пересчета
        await pool.query(`
            SELECT recalculate_multi_warehouse_stock($1)
        `, [multiWarehouseId]);
    }

    /**
     * Получение товаров с остатками
     */
    async getProductsWithStock(tenantId, filters = {}) {
        const pool = await db.getPool(tenantId);
        
        let query = `
            SELECT 
                p.*,
                b.canonical_name as brand_name,
                c.canonical_name as category_name,
                COALESCE(stock.total_quantity, 0) as total_quantity,
                COALESCE(stock.available_quantity, 0) as available_quantity,
                COALESCE(stock.warehouse_count, 0) as warehouse_count,
                COALESCE(stock.avg_price, 0) as avg_price
            FROM products p
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN v_product_total_stock stock ON p.id = stock.product_id
            WHERE p.tenant_id = $1
        `;

        const params = [tenantId];

        // Применяем фильтры
        if (filters.search) {
            params.push(`%${filters.search}%`);
            query += ` AND (p.name ILIKE $${params.length} OR p.internal_code ILIKE $${params.length})`;
        }

        if (filters.brand_id) {
            params.push(filters.brand_id);
            query += ` AND p.brand_id = $${params.length}`;
        }

        if (filters.category_id) {
            params.push(filters.category_id);
            query += ` AND p.category_id = $${params.length}`;
        }

        if (filters.warehouse_id) {
            query += ` AND EXISTS (
                SELECT 1 FROM warehouse_product_links wpl
                WHERE wpl.product_id = p.id 
                  AND wpl.warehouse_id = $${params.length + 1}
                  AND wpl.quantity > 0
            )`;
            params.push(filters.warehouse_id);
        }

        if (filters.in_stock !== undefined) {
            if (filters.in_stock) {
                query += ` AND COALESCE(stock.available_quantity, 0) > 0`;
            } else {
                query += ` AND COALESCE(stock.available_quantity, 0) = 0`;
            }
        }

        // Сортировка
        const sortBy = filters.sort_by || 'created_at';
        const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder}`;

        // Пагинация
        if (filters.limit) {
            params.push(filters.limit);
            query += ` LIMIT $${params.length}`;
        }

        if (filters.offset) {
            params.push(filters.offset);
            query += ` OFFSET $${params.length}`;
        }

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Получение истории движения товара
     */
    async getProductMovements(tenantId, productId, warehouseId = null) {
        const pool = await db.getPool(tenantId);
        
        let query = `
            SELECT 
                wm.*,
                fw.name as from_warehouse_name,
                tw.name as to_warehouse_name,
                u.name as user_name
            FROM warehouse_movements wm
            LEFT JOIN warehouses fw ON wm.from_warehouse_id = fw.id
            LEFT JOIN warehouses tw ON wm.to_warehouse_id = tw.id
            LEFT JOIN users u ON wm.user_id = u.id
            WHERE wm.tenant_id = $1 AND wm.product_id = $2
        `;

        const params = [tenantId, productId];

        if (warehouseId) {
            params.push(warehouseId);
            query += ` AND (wm.from_warehouse_id = $${params.length} OR wm.to_warehouse_id = $${params.length})`;
        }

        query += ` ORDER BY wm.created_at DESC LIMIT 100`;

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Запись движения товара
     */
    async recordMovement(client, movementData) {
        const {
            tenantId,
            productId,
            fromWarehouseId,
            toWarehouseId,
            quantity,
            type,
            reason,
            userId
        } = movementData;

        await client.query(`
            INSERT INTO warehouse_movements (
                tenant_id, product_id, from_warehouse_id, 
                to_warehouse_id, quantity, movement_type, reason, user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            tenantId, productId, fromWarehouseId,
            toWarehouseId, quantity, type, reason, userId
        ]);
    }

    /**
     * Поиск остатков на нескольких складах
     */
    async findMultiWarehouseStock(client, tenantId, productId, requiredQuantity) {
        return await client.query(`
            SELECT 
                wpl.*,
                w.priority,
                w.type,
                SUM(wpl.quantity - wpl.reserved_quantity) OVER (ORDER BY w.priority DESC) as cumulative_available
            FROM warehouse_product_links wpl
            JOIN warehouses w ON wpl.warehouse_id = w.id
            WHERE wpl.product_id = $1 
              AND w.tenant_id = $2
              AND w.is_active = TRUE
              AND (wpl.quantity - wpl.reserved_quantity) > 0
            ORDER BY w.priority DESC, wpl.price ASC
        `, [productId, tenantId]);
    }

    /**
     * Получение сводки по складу
     */
    async getWarehouseSummary(tenantId, warehouseId) {
        const pool = await db.getPool(tenantId);
        
        const result = await pool.query(`
            SELECT 
                COUNT(DISTINCT product_id) as product_count,
                SUM(quantity) as total_items,
                SUM(quantity * price) as total_value,
                SUM(reserved_quantity) as total_reserved,
                COUNT(CASE WHEN quantity <= min_stock THEN 1 END) as low_stock_count
            FROM warehouse_product_links
            WHERE warehouse_id = $1
        `, [warehouseId]);

        return result.rows[0];
    }
}

module.exports = new WarehouseService();
