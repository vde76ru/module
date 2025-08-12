// Модуль: Backend Service - Управление складами
// Файл: backend/src/services/WarehouseService.js
// Основание: Требования пользователя, система складов

const db = require('../config/database');
const { logger } = require('../utils/logger');

class WarehouseService {
  /**
   * Получение всех складов компании
   */
  async getAllWarehouses(companyId, filters = {}) {
    try {
      let query = `
        SELECT
          w.*,
          (SELECT COUNT(*) FROM warehouse_product_links wpl WHERE wpl.warehouse_id = w.id) AS total_products,
          (SELECT COUNT(*) FROM warehouse_product_links wpl WHERE wpl.warehouse_id = w.id) AS products_count,
          (SELECT COALESCE(SUM(wpl.available_quantity), 0) FROM warehouse_product_links wpl WHERE wpl.warehouse_id = w.id) AS total_stock
        FROM warehouses w
        WHERE w.company_id = $1 AND w.is_active = true
      `;

      const params = [companyId];
      let paramIndex = 2;

      if (filters.type && filters.type !== 'all') {
        query += ` AND w.type = $${paramIndex}`;
        params.push(filters.type);
        paramIndex++;
      }

      if (filters.is_main !== undefined) {
        query += ` AND w.is_main = $${paramIndex}`;
        params.push(filters.is_main);
        paramIndex++;
      }

      if (filters.search) {
        query += ` AND (
          w.name ILIKE $${paramIndex} OR
          w.code ILIKE $${paramIndex} OR
          w.description ILIKE $${paramIndex}
        )`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      query += ` ORDER BY w.is_main DESC, w.name ASC`;

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error in getAllWarehouses:', error);
      throw error;
    }
  }

  /**
   * Получение склада по ID
   */
  async getWarehouseById(companyId, warehouseId) {
    try {
      const result = await db.query(`
        SELECT * FROM warehouses
        WHERE id = $1 AND company_id = $2 AND is_active = true
      `, [warehouseId, companyId]);

      if (result.rows.length === 0) {
        return null;
      }

      const warehouse = result.rows[0];

      // Получаем товары на складе
      const productsResult = await db.query(`
        SELECT
          wpl.id,
          wpl.product_id,
          wpl.quantity,
          wpl.reserved_quantity,
          wpl.available_quantity,
          wpl.location_code,
          wpl.min_quantity,
          wpl.min_stock_level,
          wpl.max_quantity,
          wpl.reorder_point,
          wpl.last_sale_date AS last_movement,
          wpl.price,
          wpl.retail_price,
          wpl.created_at,
          wpl.updated_at,
          p.name AS product_name,
          p.internal_code,
          p.sku,
          p.brand_id,
          p.category_id,
          b.name AS brand_name,
          c.name AS category_name
        FROM warehouse_product_links wpl
        JOIN products p ON wpl.product_id = p.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE wpl.warehouse_id = $1
        ORDER BY p.name ASC
      `, [warehouseId]);
      warehouse.products = productsResult.rows;

      // Получаем статистику по складу
      const statsResult = await db.query(`
        SELECT
          COUNT(*) as total_products,
          COALESCE(SUM(wpl.quantity), 0) as total_quantity,
          COALESCE(SUM(wpl.available_quantity), 0) as total_available,
          COUNT(CASE WHEN wpl.available_quantity <= COALESCE(wpl.min_stock_level, 0) THEN 1 END) as low_stock_count
        FROM warehouse_product_links wpl
        WHERE wpl.warehouse_id = $1
      `, [warehouseId]);
      warehouse.stats = statsResult.rows[0];

      // Компоненты мульти-склада (если есть)
      try {
        const componentsResult = await db.query(`
          SELECT
            mwc.component_warehouse_id as id,
            w.name as name,
            w.type as type,
            mwc.weight,
            mwc.is_active
          FROM multi_warehouse_components mwc
          JOIN warehouses w ON w.id = mwc.component_warehouse_id
          WHERE mwc.multi_warehouse_id = $1
        `, [warehouseId]);
        warehouse.components = componentsResult.rows;
      } catch (e) {
        warehouse.components = [];
      }

      return warehouse;
    } catch (error) {
      logger.error('Error in getWarehouseById:', error);
      throw error;
    }
  }

  /**
   * Создание нового склада
   */
  async createWarehouse(companyId, warehouseData) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      if (warehouseData.name) {
        const existingName = await client.query(
          'SELECT id FROM warehouses WHERE company_id = $1 AND name = $2 AND is_active = true',
          [companyId, warehouseData.name]
        );
        if (existingName.rows.length > 0) {
          throw new Error('Warehouse with this name already exists');
        }
      }

      if (warehouseData.code) {
        const existingCode = await client.query(
          'SELECT id FROM warehouses WHERE company_id = $1 AND code = $2 AND is_active = true',
          [companyId, warehouseData.code]
        );
        if (existingCode.rows.length > 0) {
          throw new Error('Warehouse with this code already exists');
        }
      }

      if (warehouseData.is_main) {
        await client.query(
          'UPDATE warehouses SET is_main = false WHERE company_id = $1 AND is_active = true',
          [companyId]
        );
      }

      const contactInfo = warehouseData.contact_info || {
        contact_person: warehouseData.contact_person || null,
        contact_phone: warehouseData.contact_phone || warehouseData.phone || null,
        email: warehouseData.email || null,
      };

      const isMain = Boolean(warehouseData.is_main || warehouseData.type === 'main');

      let result;
      try {
        result = await client.query(`
          INSERT INTO warehouses (
            company_id, name, code, type, description, address,
            contact_info, settings, is_main, is_active, city
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          ) RETURNING *
        `, [
          companyId,
          warehouseData.name,
          warehouseData.code || null,
          warehouseData.type || 'warehouse',
          warehouseData.description || null,
          warehouseData.address || null,
          JSON.stringify(contactInfo),
          warehouseData.settings ? JSON.stringify(warehouseData.settings) : '{}',
          isMain,
          warehouseData.is_active !== false,
          warehouseData.city || null,
        ]);
      } catch (e) {
        result = await client.query(`
          INSERT INTO warehouses (
            company_id, name, code, type, description, address,
            contact_info, settings, is_main, is_active
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          ) RETURNING *
        `, [
          companyId,
          warehouseData.name,
          warehouseData.code || null,
          warehouseData.type || 'warehouse',
          warehouseData.description || null,
          warehouseData.address || null,
          JSON.stringify(contactInfo),
          warehouseData.settings ? JSON.stringify(warehouseData.settings) : '{}',
          isMain,
          warehouseData.is_active !== false,
        ]);
      }

      const warehouse = result.rows[0];
      await client.query('COMMIT');
      return warehouse;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in createWarehouse:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Обновление склада
   */
  async updateWarehouse(companyId, warehouseId, warehouseData) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const existingWarehouse = await client.query(
        'SELECT * FROM warehouses WHERE id = $1 AND company_id = $2 AND is_active = true',
        [warehouseId, companyId]
      );
      if (existingWarehouse.rows.length === 0) {
        throw new Error('Warehouse not found');
      }

      if (warehouseData.name && warehouseData.name !== existingWarehouse.rows[0].name) {
        const existingName = await client.query(
          'SELECT id FROM warehouses WHERE company_id = $1 AND name = $2 AND id != $3 AND is_active = true',
          [companyId, warehouseData.name, warehouseId]
        );
        if (existingName.rows.length > 0) {
          throw new Error('Warehouse with this name already exists');
        }
      }

      if (warehouseData.code && warehouseData.code !== existingWarehouse.rows[0].code) {
        const existingCode = await client.query(
          'SELECT id FROM warehouses WHERE company_id = $1 AND code = $2 AND id != $3 AND is_active = true',
          [companyId, warehouseData.code, warehouseId]
        );
        if (existingCode.rows.length > 0) {
          throw new Error('Warehouse with this code already exists');
        }
      }

      if (warehouseData.is_main) {
        await client.query(
          'UPDATE warehouses SET is_main = false WHERE company_id = $1 AND id != $2 AND is_active = true',
          [companyId, warehouseId]
        );
      }

      const nextIsMain = (
        typeof warehouseData.is_main === 'boolean' ? warehouseData.is_main : (warehouseData.type === 'main' ? true : null)
      );

      const nextContactInfo = warehouseData.contact_info || (
        (warehouseData.contact_person || warehouseData.contact_phone || warehouseData.email || warehouseData.phone)
          ? {
              contact_person: warehouseData.contact_person || null,
              contact_phone: warehouseData.contact_phone || warehouseData.phone || null,
              email: warehouseData.email || null,
            }
          : null
      );

      let result;
      try {
        result = await client.query(`
          UPDATE warehouses SET
            name = COALESCE($2, name),
            code = COALESCE($3, code),
            type = COALESCE($4, type),
            description = COALESCE($5, description),
            address = COALESCE($6, address),
            contact_info = COALESCE($7, contact_info),
            settings = COALESCE($8, settings),
            is_main = COALESCE($9, is_main),
            is_active = COALESCE($10, is_active),
            city = COALESCE($11, city),
            updated_at = NOW()
          WHERE id = $1 AND company_id = $12
          RETURNING *
        `, [
          warehouseId,
          warehouseData.name,
          warehouseData.code,
          warehouseData.type,
          warehouseData.description,
          warehouseData.address,
          nextContactInfo ? JSON.stringify(nextContactInfo) : null,
          warehouseData.settings ? JSON.stringify(warehouseData.settings) : null,
          nextIsMain,
          typeof warehouseData.is_active === 'boolean' ? warehouseData.is_active : null,
          warehouseData.city || null,
          companyId,
        ]);
      } catch (e) {
        result = await client.query(`
          UPDATE warehouses SET
            name = COALESCE($2, name),
            code = COALESCE($3, code),
            type = COALESCE($4, type),
            description = COALESCE($5, description),
            address = COALESCE($6, address),
            contact_info = COALESCE($7, contact_info),
            settings = COALESCE($8, settings),
            is_main = COALESCE($9, is_main),
            is_active = COALESCE($10, is_active),
            updated_at = NOW()
          WHERE id = $1 AND company_id = $11
          RETURNING *
        `, [
          warehouseId,
          warehouseData.name,
          warehouseData.code,
          warehouseData.type,
          warehouseData.description,
          warehouseData.address,
          nextContactInfo ? JSON.stringify(nextContactInfo) : null,
          warehouseData.settings ? JSON.stringify(warehouseData.settings) : null,
          nextIsMain,
          typeof warehouseData.is_active === 'boolean' ? warehouseData.is_active : null,
          companyId,
        ]);
      }

      const warehouse = result.rows[0];
      await client.query('COMMIT');
      return warehouse;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in updateWarehouse:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Удаление склада (мягкое удаление)
   */
  async deleteWarehouse(companyId, warehouseId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const existingWarehouse = await client.query(
        'SELECT * FROM warehouses WHERE id = $1 AND company_id = $2 AND is_active = true',
        [warehouseId, companyId]
      );
      if (existingWarehouse.rows.length === 0) {
        throw new Error('Warehouse not found');
      }

      const productsCheck = await client.query(
        'SELECT COUNT(*) as count FROM warehouse_product_links WHERE warehouse_id = $1 AND is_active = true',
        [warehouseId]
      );
      if (parseInt(productsCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete warehouse with products');
      }

      await client.query(
        'UPDATE warehouses SET is_active = false, updated_at = NOW() WHERE id = $1',
        [warehouseId]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in deleteWarehouse:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Добавление товара на склад
   */
  async addProductToWarehouse(companyId, warehouseId, productId, stockData) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const warehouseCheck = await client.query(
        'SELECT id FROM warehouses WHERE id = $1 AND company_id = $2 AND is_active = true',
        [warehouseId, companyId]
      );
      if (warehouseCheck.rows.length === 0) {
        throw new Error('Warehouse not found');
      }

      const productCheck = await client.query(
        'SELECT id FROM products WHERE id = $1 AND company_id = $2 AND is_active = true',
        [productId, companyId]
      );
      if (productCheck.rows.length === 0) {
        throw new Error('Product not found');
      }

      const existingLink = await client.query(
        'SELECT id FROM warehouse_product_links WHERE warehouse_id = $1 AND product_id = $2',
        [warehouseId, productId]
      );

      if (existingLink.rows.length > 0) {
        await client.query(`
          UPDATE warehouse_product_links SET
            quantity = COALESCE($3, quantity),
            available_quantity = COALESCE($4, available_quantity),
            min_quantity = COALESCE($5, min_quantity),
            min_stock_level = COALESCE($6, min_stock_level),
            price = COALESCE($7, price),
            location_code = COALESCE($8, location_code),
            updated_at = NOW()
          WHERE warehouse_id = $1 AND product_id = $2
        `, [
          warehouseId,
          productId,
          stockData.quantity || 0,
          stockData.available_quantity || 0,
          stockData.min_quantity || 0,
          stockData.min_stock_level || 0,
          stockData.price || null,
          stockData.location_code || null,
        ]);
      } else {
        await client.query(`
          INSERT INTO warehouse_product_links (
            warehouse_id, product_id, quantity, available_quantity,
            min_quantity, min_stock_level, price, location_code
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          warehouseId,
          productId,
          stockData.quantity || 0,
          stockData.available_quantity || 0,
          stockData.min_quantity || 0,
          stockData.min_stock_level || 0,
          stockData.price || null,
          stockData.location_code || null,
        ]);
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in addProductToWarehouse:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Удаление товара со склада
   */
  async removeProductFromWarehouse(companyId, warehouseId, productId) {
    try {
      const result = await db.query(`
        DELETE FROM warehouse_product_links
        WHERE warehouse_id = $1 AND product_id = $2
      `, [warehouseId, productId]);
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Error in removeProductFromWarehouse:', error);
      throw error;
    }
  }

  /**
   * Обновление остатков товара на складе
   */
  async updateProductStock(companyId, warehouseId, productId, stockData) {
    try {
      const result = await db.query(`
        UPDATE warehouse_product_links SET
          quantity = COALESCE($3, quantity),
          available_quantity = COALESCE($4, available_quantity),
          min_quantity = COALESCE($5, min_quantity),
          min_stock_level = COALESCE($6, min_stock_level),
          price = COALESCE($7, price),
          location_code = COALESCE($8, location_code),
          updated_at = NOW()
        WHERE warehouse_id = $1 AND product_id = $2 AND is_active = true
      `, [
        warehouseId,
        productId,
        stockData.quantity,
        stockData.available_quantity,
        stockData.min_quantity,
        stockData.min_stock_level,
        stockData.price,
        stockData.location_code,
      ]);
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Error in updateProductStock:', error);
      throw error;
    }
  }

  /**
   * Получение остатков по складу
   */
  async getWarehouseStock(companyId, warehouseId, filters = {}) {
    try {
      let query = `
        SELECT
          wpl.*,
          p.name as product_name,
          p.internal_code,
          p.sku,
          p.brand_id,
          p.category_id,
          b.name as brand_name,
          c.name as category_name
        FROM warehouse_product_links wpl
        JOIN products p ON wpl.product_id = p.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE wpl.warehouse_id = $1 AND wpl.is_active = true
      `;

      const params = [warehouseId];
      let paramIndex = 2;

      if (filters.low_stock) {
        query += ` AND wpl.available_quantity <= wpl.min_stock_level`;
      }
      if (filters.out_of_stock) {
        query += ` AND wpl.available_quantity = 0`;
      }
      if (filters.search) {
        query += ` AND (
          p.name ILIKE $${paramIndex} OR
          p.internal_code ILIKE $${paramIndex} OR
          p.sku ILIKE $${paramIndex}
        )`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }
      if (filters.brand_id) {
        query += ` AND p.brand_id = $${paramIndex}`;
        params.push(filters.brand_id);
        paramIndex++;
      }
      if (filters.category_id) {
        query += ` AND p.category_id = $${paramIndex}`;
        params.push(filters.category_id);
        paramIndex++;
      }

      query += ` ORDER BY p.name ASC`;
      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }
      if (filters.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(filters.offset);
      }

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error in getWarehouseStock:', error);
      throw error;
    }
  }

  /**
   * Получение статистики по складам
   */
  async getWarehouseStats(companyId) {
    try {
      const statsResult = await db.query(`
        SELECT
          COUNT(*) as total_warehouses,
          COUNT(CASE WHEN is_main = true THEN 1 END) as main_warehouses,
          COUNT(CASE WHEN type = 'warehouse' THEN 1 END) as regular_warehouses,
          COUNT(CASE WHEN type = 'store' THEN 1 END) as stores,
          COUNT(CASE WHEN type = 'pickup_point' THEN 1 END) as pickup_points
        FROM warehouses
        WHERE company_id = $1 AND is_active = true
      `, [companyId]);

      const stockStatsResult = await db.query(`
        SELECT
          COUNT(DISTINCT wpl.product_id) as total_products,
          COALESCE(SUM(wpl.quantity), 0) as total_quantity,
          COALESCE(SUM(wpl.available_quantity), 0) as total_available,
          COUNT(CASE WHEN wpl.available_quantity <= wpl.min_stock_level THEN 1 END) as low_stock_count
        FROM warehouse_product_links wpl
        JOIN warehouses w ON wpl.warehouse_id = w.id
        WHERE w.company_id = $1 AND wpl.is_active = true AND w.is_active = true
      `, [companyId]);

      const stats = statsResult.rows[0];
      stats.stock = stockStatsResult.rows[0];
      return stats;
    } catch (error) {
      logger.error('Error in getWarehouseStats:', error);
      throw error;
    }
  }

  /**
   * Перемещение товаров между складами
   */
  async transferProducts(companyId, fromWarehouseId, toWarehouseId, transfers) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const warehousesCheck = await client.query(
        'SELECT id FROM warehouses WHERE id = ANY($1) AND company_id = $2 AND is_active = true',
        [[fromWarehouseId, toWarehouseId], companyId]
      );
      if (warehousesCheck.rows.length !== 2) {
        throw new Error('One or both warehouses not found');
      }

      const transferResult = await client.query(`
        INSERT INTO stock_transfers (
          company_id, from_warehouse_id, to_warehouse_id,
          transfer_number, status, transfer_date, created_by
        ) VALUES (
          $1, $2, $3, $4, 'pending', NOW(), $5
        ) RETURNING id
      `, [
        companyId,
        fromWarehouseId,
        toWarehouseId,
        `TR-${Date.now()}`,
        companyId,
      ]);
      const transferId = transferResult.rows[0].id;

      for (const transfer of transfers) {
        const sourceStock = await client.query(
          'SELECT available_quantity FROM warehouse_product_links WHERE warehouse_id = $1 AND product_id = $2 AND is_active = true',
          [fromWarehouseId, transfer.product_id]
        );
        if (sourceStock.rows.length === 0 || sourceStock.rows[0].available_quantity < transfer.quantity) {
          throw new Error(`Insufficient stock for product ${transfer.product_id}`);
        }

        await client.query(`
          INSERT INTO stock_transfer_items (
            transfer_id, product_id, quantity, notes
          ) VALUES ($1, $2, $3, $4)
        `, [
          transferId,
          transfer.product_id,
          transfer.quantity,
          transfer.notes || null,
        ]);

        await client.query(`
          UPDATE warehouse_product_links SET
            available_quantity = available_quantity - $3,
            updated_at = NOW()
          WHERE warehouse_id = $1 AND product_id = $2 AND is_active = true
        `, [fromWarehouseId, transfer.product_id, transfer.quantity]);

        const targetStock = await client.query(
          'SELECT id FROM warehouse_product_links WHERE warehouse_id = $1 AND product_id = $2',
          [toWarehouseId, transfer.product_id]
        );
        if (targetStock.rows.length > 0) {
          await client.query(`
            UPDATE warehouse_product_links SET
              available_quantity = available_quantity + $3,
              updated_at = NOW()
            WHERE warehouse_id = $1 AND product_id = $2 AND is_active = true
          `, [toWarehouseId, transfer.product_id, transfer.quantity]);
        } else {
          await client.query(`
            INSERT INTO warehouse_product_links (
              warehouse_id, product_id, available_quantity, is_active
            ) VALUES ($1, $2, $3, true)
          `, [toWarehouseId, transfer.product_id, transfer.quantity]);
        }

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
          ) VALUES ($1, $2, $3, 'transfer', $4, 'stock_transfer', $5, $6, $7)
        `, [
          fromWarehouseId,
          toWarehouseId,
          transfer.product_id,
          transfer.quantity,
          transferId,
          `Transfer ${fromWarehouseId} -> ${toWarehouseId}`,
          companyId,
        ]);
      }

      await client.query(
        'UPDATE stock_transfers SET status = $1, updated_at = NOW() WHERE id = $2',
        ['completed', transferId]
      );

      await client.query('COMMIT');
      return { transfer_id: transferId, status: 'completed' };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in transferProducts:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Пересчет агрегированных (мульти-) складов компании
   */
  async recalculateAggregatedWarehouses(companyId) {
    try {
      const { rows } = await db.query(`
        SELECT id
        FROM warehouses
        WHERE company_id = $1
          AND is_active = TRUE
          AND (
            warehouse_type = 'multi_warehouse'
            OR (SELECT COALESCE((SELECT TRUE WHERE EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'warehouses' AND column_name = 'is_multi_warehouse'
            )), FALSE))
          )
      `, [companyId]);

      if (!rows || rows.length === 0) {
        return { updated: 0 };
      }

      let updated = 0;
      for (const row of rows) {
        try {
          await db.query('SELECT recalculate_multi_warehouse_stock($1)', [row.id]);
          updated += 1;
        } catch (error) {
          logger.error('Failed to recalculate multi-warehouse stock for', row.id, error);
        }
      }
      return { updated };
    } catch (error) {
      logger.error('Error in recalculateAggregatedWarehouses:', error);
      throw error;
    }
  }
}

module.exports = new WarehouseService();

 