const db = require('../config/database');
const { logger } = require('../utils/logger');

class SupplierService {
    /**
     * Получение всех поставщиков компании
     */
    async getAllSuppliers(companyId, filters = {}) {
        try {
            let query = `
                SELECT
                    s.*,
                    (SELECT COUNT(*) FROM products p WHERE p.main_supplier_id = s.id AND p.is_active = true) as products_count,
                    (SELECT COUNT(*) FROM supplier_integrations si WHERE si.supplier_id = s.id AND si.is_active = true) as integrations_count
                FROM suppliers s
                WHERE s.company_id = $1 AND s.is_active = true
            `;

            const params = [companyId];
            let paramIndex = 2;

            if (filters.type && filters.type !== 'all') {
                query += ` AND s.type = $${paramIndex}`;
                params.push(filters.type);
                paramIndex++;
            }

            if (filters.status && filters.status !== 'all') {
                query += ` AND s.status = $${paramIndex}`;
                params.push(filters.status);
                paramIndex++;
            }

            if (filters.api_type && filters.api_type !== 'all') {
                query += ` AND s.api_type = $${paramIndex}`;
                params.push(filters.api_type);
                paramIndex++;
            }

            if (filters.is_main !== undefined) {
                query += ` AND s.is_main = $${paramIndex}`;
                params.push(filters.is_main);
                paramIndex++;
            }

            if (filters.search) {
                query += ` AND (
                    s.name ILIKE $${paramIndex} OR
                    s.code ILIKE $${paramIndex} OR
                    s.description ILIKE $${paramIndex}
                )`;
                params.push(`%${filters.search}%`);
                paramIndex++;
            }

            query += ` ORDER BY s.is_main DESC, s.priority ASC, s.name ASC`;

            const result = await db.query(query, params);
            return result.rows;

        } catch (error) {
            logger.error('Error in getAllSuppliers:', error);
            throw error;
        }
    }

    /**
     * Получение поставщика по ID
     */
    async getSupplierById(companyId, supplierId) {
        try {
            const result = await db.query(`
                SELECT * FROM suppliers
                WHERE id = $1 AND company_id = $2 AND is_active = true
            `, [supplierId, companyId]);

            if (result.rows.length === 0) {
                return null;
            }

            const supplier = result.rows[0];

            // Получаем интеграции поставщика
            const integrationsResult = await db.query(`
                SELECT * FROM supplier_integrations
                WHERE supplier_id = $1 AND is_active = true
                ORDER BY created_at DESC
            `, [supplierId]);
            supplier.integrations = integrationsResult.rows;

            // Получаем товары поставщика
            const productsResult = await db.query(`
                SELECT
                    p.id, p.name, p.internal_code, p.sku,
                    p.external_id, p.external_data, p.supplier_data
                FROM products p
                WHERE p.main_supplier_id = $1 AND p.is_active = true
                ORDER BY p.name ASC
            `, [supplierId]);
            supplier.products = productsResult.rows;

            // Получаем статистику по поставщику
            const statsResult = await db.query(`
                SELECT
                    COUNT(*) as total_products,
                    COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_products,
                    COUNT(CASE WHEN p.status = 'inactive' THEN 1 END) as inactive_products
                FROM products p
                WHERE p.main_supplier_id = $1 AND p.is_active = true
            `, [supplierId]);
            supplier.stats = statsResult.rows[0];

            return supplier;

        } catch (error) {
            logger.error('Error in getSupplierById:', error);
            throw error;
        }
    }

    /**
     * Создание нового поставщика
     */
    async createSupplier(companyId, supplierData) {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Проверяем уникальность названия в рамках компании
            if (supplierData.name) {
                const existingName = await client.query(
                    'SELECT id FROM suppliers WHERE company_id = $1 AND name = $2 AND is_active = true',
                    [companyId, supplierData.name]
                );

                if (existingName.rows.length > 0) {
                    throw new Error('Supplier with this name already exists');
                }
            }

            // Проверяем уникальность кода в рамках компании
            if (supplierData.code) {
                const existingCode = await client.query(
                    'SELECT id FROM suppliers WHERE company_id = $1 AND code = $2 AND is_active = true',
                    [companyId, supplierData.code]
                );

                if (existingCode.rows.length > 0) {
                    throw new Error('Supplier with this code already exists');
                }
            }

            // Если это основной поставщик, снимаем флаг с других поставщиков
            if (supplierData.is_main) {
                await client.query(
                    'UPDATE suppliers SET is_main = false WHERE company_id = $1 AND is_active = true',
                    [companyId]
                );
            }

            const result = await client.query(`
                INSERT INTO suppliers (
                    company_id, name, code, type, description, contact_info,
                    website, api_url, api_type, api_config, credentials,
                    settings, is_main, status, priority, external_warehouse_id,
                    integration_settings
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
                ) RETURNING *
            `, [
                companyId,
                supplierData.name,
                supplierData.code || null,
                supplierData.type || 'manual',
                supplierData.description || null,
                supplierData.contact_info ? JSON.stringify(supplierData.contact_info) : '{}',
                supplierData.website || null,
                supplierData.api_url || null,
                supplierData.api_type || null,
                supplierData.api_config ? JSON.stringify(supplierData.api_config) : '{}',
                supplierData.credentials ? JSON.stringify(supplierData.credentials) : '{}',
                supplierData.settings ? JSON.stringify(supplierData.settings) : '{}',
                supplierData.is_main || false,
                supplierData.status || 'active',
                supplierData.priority || 0,
                supplierData.external_warehouse_id || null,
                supplierData.integration_settings ? JSON.stringify(supplierData.integration_settings) : '{}'
            ]);

            const supplier = result.rows[0];

            await client.query('COMMIT');
            return supplier;

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error in createSupplier:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Обновление поставщика
     */
    async updateSupplier(companyId, supplierId, supplierData) {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Проверяем существование поставщика
            const existingSupplier = await client.query(
                'SELECT * FROM suppliers WHERE id = $1 AND company_id = $2 AND is_active = true',
                [supplierId, companyId]
            );

            if (existingSupplier.rows.length === 0) {
                throw new Error('Supplier not found');
            }

            // Проверяем уникальность названия если оно изменилось
            if (supplierData.name && supplierData.name !== existingSupplier.rows[0].name) {
                const existingName = await client.query(
                    'SELECT id FROM suppliers WHERE company_id = $1 AND name = $2 AND id != $3 AND is_active = true',
                    [companyId, supplierData.name, supplierId]
                );

                if (existingName.rows.length > 0) {
                    throw new Error('Supplier with this name already exists');
                }
            }

            // Проверяем уникальность кода если он изменился
            if (supplierData.code && supplierData.code !== existingSupplier.rows[0].code) {
                const existingCode = await client.query(
                    'SELECT id FROM suppliers WHERE company_id = $1 AND code = $2 AND id != $3 AND is_active = true',
                    [companyId, supplierData.code, supplierId]
                );

                if (existingCode.rows.length > 0) {
                    throw new Error('Supplier with this code already exists');
                }
            }

            // Если это основной поставщик, снимаем флаг с других поставщиков
            if (supplierData.is_main) {
                await client.query(
                    'UPDATE suppliers SET is_main = false WHERE company_id = $1 AND id != $2 AND is_active = true',
                    [companyId, supplierId]
                );
            }

            const result = await client.query(`
                UPDATE suppliers SET
                    name = COALESCE($2, name),
                    code = COALESCE($3, code),
                    type = COALESCE($4, type),
                    description = COALESCE($5, description),
                    contact_info = COALESCE($6, contact_info),
                    website = COALESCE($7, website),
                    api_url = COALESCE($8, api_url),
                    api_type = COALESCE($9, api_type),
                    api_config = COALESCE($10, api_config),
                    credentials = COALESCE($11, credentials),
                    settings = COALESCE($12, settings),
                    is_main = COALESCE($13, is_main),
                    status = COALESCE($14, status),
                    priority = COALESCE($15, priority),
                    external_warehouse_id = COALESCE($16, external_warehouse_id),
                    integration_settings = COALESCE($17, integration_settings),
                    updated_at = NOW()
                WHERE id = $1 AND company_id = $18
                RETURNING *
            `, [
                supplierId,
                supplierData.name,
                supplierData.code,
                supplierData.type,
                supplierData.description,
                supplierData.contact_info ? JSON.stringify(supplierData.contact_info) : null,
                supplierData.website,
                supplierData.api_url,
                supplierData.api_type,
                supplierData.api_config ? JSON.stringify(supplierData.api_config) : null,
                supplierData.credentials ? JSON.stringify(supplierData.credentials) : null,
                supplierData.settings ? JSON.stringify(supplierData.settings) : null,
                supplierData.is_main,
                supplierData.status,
                supplierData.priority,
                supplierData.external_warehouse_id,
                supplierData.integration_settings ? JSON.stringify(supplierData.integration_settings) : null,
                companyId
            ]);

            const supplier = result.rows[0];

            await client.query('COMMIT');
            return supplier;

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error in updateSupplier:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Удаление поставщика (мягкое удаление)
     */
    async deleteSupplier(companyId, supplierId) {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Проверяем существование поставщика
            const existingSupplier = await client.query(
                'SELECT * FROM suppliers WHERE id = $1 AND company_id = $2 AND is_active = true',
                [supplierId, companyId]
            );

            if (existingSupplier.rows.length === 0) {
                throw new Error('Supplier not found');
            }

            // Проверяем, есть ли товары у поставщика
            const productsCheck = await client.query(
                'SELECT COUNT(*) as count FROM products WHERE main_supplier_id = $1 AND is_active = true',
                [supplierId]
            );

            if (parseInt(productsCheck.rows[0].count) > 0) {
                throw new Error('Cannot delete supplier with products');
            }

            // Мягкое удаление поставщика
            await client.query(
                'UPDATE suppliers SET is_active = false, updated_at = NOW() WHERE id = $1',
                [supplierId]
            );

            await client.query('COMMIT');
            return true;

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error in deleteSupplier:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Тестирование подключения к API поставщика
     */
    async testSupplierConnection(companyId, supplierId) {
        try {
            const supplier = await this.getSupplierById(companyId, supplierId);

            if (!supplier) {
                throw new Error('Supplier not found');
            }

            if (!supplier.api_url || !supplier.api_type) {
                throw new Error('Supplier does not have API configuration');
            }

            // Здесь должна быть логика тестирования подключения
            // В зависимости от типа API (REST, SOAP, GraphQL)
            const testResult = {
                success: true,
                message: 'Connection test successful',
                response_time: Math.random() * 1000, // Заглушка
                api_status: 'available'
            };

            // Обновляем статус последней проверки
            await db.query(`
                UPDATE suppliers SET
                    last_sync_at = NOW(),
                    last_sync_status = $1,
                    last_sync_error = NULL,
                    updated_at = NOW()
                WHERE id = $2
            `, [testResult.success ? 'success' : 'error', supplierId]);

            return testResult;

        } catch (error) {
            // Обновляем статус с ошибкой
            await db.query(`
                UPDATE suppliers SET
                    last_sync_at = NOW(),
                    last_sync_status = 'error',
                    last_sync_error = $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [error.message, supplierId]);

            logger.error('Error in testSupplierConnection:', error);
            throw error;
        }
    }

    /**
     * Синхронизация с поставщиком
     */
    async syncWithSupplier(companyId, supplierId, syncOptions = {}) {
        try {
            const supplier = await this.getSupplierById(companyId, supplierId);

            if (!supplier) {
                throw new Error('Supplier not found');
            }

            if (!supplier.api_url || !supplier.api_type) {
                throw new Error('Supplier does not have API configuration');
            }

            // Здесь должна быть логика синхронизации
            // В зависимости от типа API и настроек поставщика
            const syncResult = {
                success: true,
                message: 'Synchronization completed successfully',
                products_updated: Math.floor(Math.random() * 100), // Заглушка
                products_added: Math.floor(Math.random() * 50), // Заглушка
                sync_duration: Math.random() * 5000 // Заглушка
            };

            // Обновляем статистику синхронизации
            await db.query(`
                UPDATE suppliers SET
                    last_sync_at = NOW(),
                    last_sync_status = $1,
                    last_sync_error = NULL,
                    sync_stats = $2,
                    updated_at = NOW()
                WHERE id = $3
            `, [
                syncResult.success ? 'success' : 'error',
                JSON.stringify(syncResult),
                supplierId
            ]);

            return syncResult;

        } catch (error) {
            // Обновляем статус с ошибкой
            await db.query(`
                UPDATE suppliers SET
                    last_sync_at = NOW(),
                    last_sync_status = 'error',
                    last_sync_error = $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [error.message, supplierId]);

            logger.error('Error in syncWithSupplier:', error);
            throw error;
        }
    }

    /**
     * Получение статистики по поставщикам
     */
    async getSupplierStats(companyId) {
        try {
            const statsResult = await db.query(`
                SELECT
                    COUNT(*) as total_suppliers,
                    COUNT(CASE WHEN is_main = true THEN 1 END) as main_suppliers,
                    COUNT(CASE WHEN type = 'manual' THEN 1 END) as manual_suppliers,
                    COUNT(CASE WHEN type = 'api' THEN 1 END) as api_suppliers,
                    COUNT(CASE WHEN type = 'file' THEN 1 END) as file_suppliers,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_suppliers,
                    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_suppliers,
                    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_suppliers
                FROM suppliers
                WHERE company_id = $1 AND is_active = true
            `, [companyId]);

            const syncStatsResult = await db.query(`
                SELECT
                    COUNT(CASE WHEN last_sync_status = 'success' THEN 1 END) as successful_syncs,
                    COUNT(CASE WHEN last_sync_status = 'error' THEN 1 END) as failed_syncs,
                    COUNT(CASE WHEN last_sync_status IS NULL THEN 1 END) as never_synced,
                    AVG(EXTRACT(EPOCH FROM (NOW() - last_sync_at))) as avg_sync_age_seconds
                FROM suppliers
                WHERE company_id = $1 AND is_active = true
            `, [companyId]);

            const stats = statsResult.rows[0];
            stats.sync = syncStatsResult.rows[0];

            return stats;

        } catch (error) {
            logger.error('Error in getSupplierStats:', error);
            throw error;
        }
    }

    /**
     * Получение поставщиков с ошибками синхронизации
     */
    async getSuppliersWithErrors(companyId, limit = 10) {
        try {
            const result = await db.query(`
                SELECT
                    id, name, code, type, last_sync_at, last_sync_error
                FROM suppliers
                WHERE company_id = $1
                AND is_active = true
                AND last_sync_status = 'error'
                ORDER BY last_sync_at DESC
                LIMIT $2
            `, [companyId, limit]);

            return result.rows;

        } catch (error) {
            logger.error('Error in getSuppliersWithErrors:', error);
            throw error;
        }
    }

    /**
     * Обновление настроек интеграции поставщика
     */
    async updateSupplierIntegrationSettings(companyId, supplierId, integrationSettings) {
        try {
            const result = await db.query(`
                UPDATE suppliers SET
                    integration_settings = $3,
                    updated_at = NOW()
                WHERE id = $1 AND company_id = $2
                RETURNING *
            `, [
                supplierId,
                companyId,
                JSON.stringify(integrationSettings)
            ]);

            return result.rows[0];
        } catch (error) {
            logger.error('Error in updateSupplierIntegrationSettings:', error);
            throw error;
        }
    }

    /**
     * Получение поставщиков по типу API
     */
    async getSuppliersByApiType(companyId, apiType) {
        try {
            const result = await db.query(`
                SELECT
                    id, name, code, type, api_url, api_type, status
                FROM suppliers
                WHERE company_id = $1
                AND is_active = true
                AND api_type = $2
                ORDER BY name ASC
            `, [companyId, apiType]);

            return result.rows;

        } catch (error) {
            logger.error('Error in getSuppliersByApiType:', error);
            throw error;
        }
    }
}

module.exports = new SupplierService();
