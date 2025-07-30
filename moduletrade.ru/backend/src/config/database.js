// backend/src/config/database.js
const { Pool } = require('pg');

// ========================================
// DATABASE CONFIGURATION
// ========================================

// Определяем нужен ли SSL
const isProduction = process.env.NODE_ENV === 'production';
const isDockerEnvironment = process.env.DB_HOST === 'postgres' || process.env.DB_HOST === 'localhost';

// SSL конфигурация - отключаем для Docker
const sslConfig = isProduction && !isDockerEnvironment ? {
  rejectUnauthorized: false
} : false;

// Основной пул подключений для public схемы
const mainPoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'saas_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',

  // Настройки пула
  min: 2,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 30000,

  // SSL настройки
  ssl: sslConfig,

  // Дополнительные настройки
  application_name: 'moduletrade-backend',
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};

const mainPool = new Pool(mainPoolConfig);

// ========================================
// POOL EVENT HANDLERS
// ========================================

mainPool.on('connect', (client) => {
  console.log('✅ Новое подключение к PostgreSQL установлено');

  // Устанавливаем search_path для мультитенантности
  client.query('SET search_path TO public', (err) => {
    if (err) {
      console.error('⚠️ Ошибка установки search_path:', err);
    }
  });
});

mainPool.on('error', (err, client) => {
  console.error('❌ Ошибка PostgreSQL пула:', err);
  console.error('Client:', client ? 'present' : 'null');
  // Не падаем при ошибках пула
});

mainPool.on('remove', () => {
  console.log('❌ Клиент удален из пула');
});

// ========================================
// TENANT POOL FACTORY
// ========================================

// Кеш пулов для тенантов
const tenantPools = new Map();

/**
 * Получить или создать пул подключений для конкретного тенанта
 * @param {string} schemaName - Имя схемы тенанта
 * @returns {Pool} Пул подключений
 */
function getTenantPool(schemaName) {
  if (!schemaName || schemaName === 'public') {
    return mainPool;
  }

  if (tenantPools.has(schemaName)) {
    return tenantPools.get(schemaName);
  }

  const tenantPool = new Pool({
    ...mainPoolConfig,
    application_name: `moduletrade-${schemaName}`,
    // Переопределяем search_path для тенанта
    options: `-c search_path=${schemaName},public`
  });

  tenantPool.on('error', (err) => {
    console.error(`❌ Ошибка пула тенанта ${schemaName}:`, err);
  });

  tenantPools.set(schemaName, tenantPool);
  console.log(`✅ Создан пул для тенанта: ${schemaName}`);

  return tenantPool;
}

// ========================================
// TRANSACTION HELPER
// ========================================

/**
 * Выполнить функцию в транзакции
 * @param {Pool} pool - Пул подключений
 * @param {Function} callback - Функция для выполнения
 * @returns {Promise<any>} Результат функции
 */
async function withTransaction(pool, callback) {
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

// ========================================
// QUERY HELPERS
// ========================================

/**
 * Выполнить запрос с повторными попытками
 * @param {Pool} pool - Пул подключений
 * @param {string} text - SQL запрос
 * @param {Array} params - Параметры запроса
 * @param {number} retries - Количество повторных попыток
 * @returns {Promise<object>} Результат запроса
 */
async function queryWithRetry(pool, text, params = [], retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.query(text, params);
    } catch (error) {
      if (i === retries - 1) throw error;

      // Ждем перед повторной попыткой
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// ========================================
// HEALTH CHECK
// ========================================

/**
 * Проверить состояние подключения к БД
 * @returns {Promise<boolean>} Статус подключения
 */
async function checkHealth() {
  try {
    const result = await mainPool.query('SELECT NOW()');
    return !!result.rows[0];
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return false;
  }
}

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

async function gracefulShutdown() {
  console.log('🛑 Закрытие подключений к БД...');

  // Закрываем пулы тенантов
  for (const [schemaName, pool] of tenantPools) {
    try {
      await pool.end();
      console.log(`✅ Закрыт пул тенанта: ${schemaName}`);
    } catch (error) {
      console.error(`❌ Ошибка закрытия пула ${schemaName}:`, error);
    }
  }

  // Закрываем основной пул
  try {
    await mainPool.end();
    console.log('✅ Основной пул закрыт');
  } catch (error) {
    console.error('❌ Ошибка закрытия основного пула:', error);
  }
}

// Обработка сигналов завершения
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ========================================
// EXPORTS
// ========================================

module.exports = {
  mainPool,
  getTenantPool,
  withTransaction,
  queryWithRetry,
  checkHealth,
  gracefulShutdown
};