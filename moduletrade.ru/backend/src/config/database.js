// backend/src/config/database.js
const { Pool } = require('pg');
const logger = require('../utils/logger'); // ДОБАВЛЕН ИМПОРТ ЛОГГЕРА

class DatabaseManager {
  constructor() {
    logger.info('Инициализация DatabaseManager...');
    this.pools = new Map();

    try {
      // Конфигурация вынесена для переиспользования
      this.poolConfig = {
        host: process.env.DB_HOST || 'postgres',
        // Убедимся, что порт является числом
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        database: process.env.DB_NAME || 'moduletrade_db',
        user: process.env.DB_USER || 'user',
        password: process.env.DB_PASSWORD || 'password',
        max: 20, // Максимальное количество клиентов в пуле
        idleTimeoutMillis: 30000, // Время в мс, которое клиент может быть неактивен
        connectionTimeoutMillis: 5000, // Время в мс на ожидание подключения
      };

      // Создаем главный пул
      this.mainPool = new Pool(this.poolConfig);

      // Добавляем глобальный обработчик ошибок для пула
      this.mainPool.on('error', (err, client) => {
        logger.error('Критическая ошибка в главном пуле БД', { error: err.message });
        process.exit(-1); // Завершаем процесс, так как состояние неопределенное
      });

      // **ВАЖНО: Проверяем соединение при старте приложения**
      this._testConnection();

    } catch (error) {
      logger.error('КРИТИЧЕСКАЯ ОШИБКА: Не удалось создать главный пул для БД.', { error: error.message });
      process.exit(1);
    }
  }

  /**
   * Приватный метод для проверки соединения с БД при старте.
   */
  async _testConnection() {
    try {
      const client = await this.mainPool.connect();
      logger.info('✅ Главный пул успешно подключен к базе данных.');
      client.release(); // Возвращаем клиент в пул
    } catch (error) {
      logger.error(
        'КРИТИЧЕСКАЯ ОШИБКА: Не удалось подключиться к БД. Проверьте .env файл и доступность базы.',
        { error: error.message }
      );
      process.exit(1); // Завершаем приложение, если БД недоступна
    }
  }

  /**
   * Получает пул для конкретного тенанта.
   * Если пул уже существует, возвращает его. Иначе создает новый.
   */
  async getPool(tenantId) {
    // Если tenantId не передан, используем главный пул
    if (!tenantId) {
      return this.mainPool;
    }

    // Если пул для тенанта уже есть в кэше, возвращаем его
    if (this.pools.has(tenantId)) {
      return this.pools.get(tenantId);
    }

    // Получаем схему тенанта из таблицы tenants в public схеме
    const result = await this.mainPool.query(
      'SELECT db_schema FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Тенант с ID ${tenantId} не найден`);
    }
    const schema = result.rows[0].db_schema;

    // Создаем новый пул для тенанта.
    // Примечание: создание пула на каждого тенанта может быть неэффективным при их большом количестве.
    // Но для начала это рабочая и понятная схема.
    const tenantPool = new Pool({
      ...this.poolConfig,
      // Можно было бы настроить search_path здесь, но лучше делать это для каждой сессии
    });

    // Добавляем обработчик ошибок и для пулов тенантов
    tenantPool.on('error', (err, client) => {
      logger.error(`Критическая ошибка в пуле для тенанта ${tenantId}`, { error: err.message });
    });

    this.pools.set(tenantId, tenantPool);
    logger.info(`Создан и закэширован новый пул для тенанта ${tenantId} (схема: ${schema})`);

    return tenantPool;
  }

  /**
   * Выполняет запрос к базе данных, автоматически управляя схемой тенанта.
   */
  async query(tenantId, text, params) {
    const pool = await this.getPool(tenantId);
    const client = await pool.connect();

    try {
      // Если это запрос для тенанта, безопасно устанавливаем search_path для этой сессии
      if (tenantId) {
        const schemaResult = await this.mainPool.query('SELECT db_schema FROM tenants WHERE id = $1', [tenantId]);
        if (schemaResult.rows.length > 0) {
          // Экранируем имя схемы для безопасности
          const schema = `"${schemaResult.rows[0].db_schema.replace(/"/g, '""')}"`;
          await client.query(`SET search_path TO ${schema}, public`);
        }
      }
      return await client.query(text, params);
    } finally {
      client.release(); // Всегда освобождаем клиент
    }
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