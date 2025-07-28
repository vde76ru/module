const { Pool } = require('pg');

class DatabaseManager {
  constructor() {
    this.pools = new Map();
    this.mainPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'saas_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async getPool(tenantId) {
    if (!tenantId) return this.mainPool;
    
    if (this.pools.has(tenantId)) {
      return this.pools.get(tenantId);
    }

    // Получаем схему тенанта
    const result = await this.mainPool.query(
      'SELECT db_schema FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const schema = result.rows[0].db_schema;

    // Создаем новый пул с search_path для схемы тенанта
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'saas_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      // Устанавливаем search_path для схемы тенанта
      options: `-c search_path=${schema},public`
    });

    // Сохраняем пул для повторного использования
    this.pools.set(tenantId, pool);
    
    return pool;
  }

  async query(tenantId, text, params) {
    const pool = await this.getPool(tenantId);
    return pool.query(text, params);
  }

  async transaction(tenantId, callback) {
    const pool = await this.getPool(tenantId);
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    // Закрываем все пулы тенантов
    for (const [tenantId, pool] of this.pools) {
      await pool.end();
    }
    this.pools.clear();
    
    // Закрываем главный пул
    await this.mainPool.end();
  }

  // Создание схемы для нового тенанта
  async createTenantSchema(tenantId, schemaName) {
    const client = await this.mainPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Создаем схему
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
      
      // Создаем таблицы в схеме тенанта
      await client.query(`SET search_path TO ${schemaName}`);
      
      // Копируем структуру таблиц из публичной схемы
      const tables = [
        'suppliers', 'marketplaces', 'products', 'brands', 'categories',
        'product_suppliers', 'product_marketplaces', 'orders', 'order_items',
        'supplier_orders', 'supplier_order_items', 'sync_logs'
      ];
      
      for (const table of tables) {
        await client.query(`
          CREATE TABLE ${schemaName}.${table} 
          (LIKE public.${table} INCLUDING ALL)
        `);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new DatabaseManager();
