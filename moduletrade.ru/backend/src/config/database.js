// backend/src/config/database.js
const { Pool } = require('pg');

// ========================================
// DATABASE CONFIGURATION
// ========================================

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

  // SSL настройки для production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,

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
  console.error('Client:', client ? 'Connected' : 'Not connected');
});

mainPool.on('acquire', (client) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔗 Клиент получен из пула');
  }
});

mainPool.on('release', (err, client) => {
  if (err) {
    console.error('⚠️ Ошибка при возврате клиента в пул:', err);
  } else if (process.env.NODE_ENV !== 'production') {
    console.log('🔄 Клиент возвращен в пул');
  }
});

// ========================================
// TENANT POOL CACHE
// ========================================

// Кеш пулов для тенантов
const tenantPools = new Map();

/**
 * Получает пул подключений для конкретного тенанта
 * @param {string} schemaName - Имя схемы тенанта
 * @returns {Pool} - Пул подключений
 */
function getTenantPool(schemaName) {
  if (!schemaName || schemaName === 'public') {
    return mainPool;
  }

  if (tenantPools.has(schemaName)) {
    return tenantPools.get(schemaName);
  }

  // Создаем новый пул для тенанта
  const tenantPoolConfig = {
    ...mainPoolConfig,
    application_name: `moduletrade-tenant-${schemaName}`,
    min: 1,
    max: 10
  };

  const pool = new Pool(tenantPoolConfig);

  // Устанавливаем search_path для тенанта при подключении
  pool.on('connect', (client) => {
    console.log(`✅ Подключение к схеме тенанта: ${schemaName}`);
    client.query(`SET search_path TO ${schemaName}, public`, (err) => {
      if (err) {
        console.error(`⚠️ Ошибка установки search_path для ${schemaName}:`, err);
      }
    });
  });

  tenantPools.set(schemaName, pool);
  return pool;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Тестирует подключение к базе данных
 */
async function testConnection() {
  try {
    const client = await mainPool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    client.release();

    console.log('✅ Подключение к БД успешно:');
    console.log(`   Time: ${result.rows[0].current_time}`);
    console.log(`   Version: ${result.rows[0].db_version.split(',')[0]}`);

    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error.message);
    throw error;
  }
}

/**
 * Выполняет запрос с логированием (для отладки)
 */
async function query(text, params, poolToUse = mainPool) {
  const start = Date.now();

  try {
    const result = await poolToUse.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV !== 'production' && duration > 1000) {
      console.warn(`⚠️ Медленный запрос (${duration}ms): ${text.substring(0, 100)}...`);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ Ошибка запроса (${duration}ms):`, error.message);
    console.error('Query:', text.substring(0, 200));
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Выполняет транзакцию
 */
async function transaction(callback, poolToUse = mainPool) {
  const client = await poolToUse.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');
    return result;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Транзакция отменена:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Закрывает все подключения
 */
async function close() {
  try {
    console.log('🔄 Закрытие подключений к базе данных...');

    // Закрываем основной пул
    await mainPool.end();

    // Закрываем все пулы тенантов
    for (const [schemaName, pool] of tenantPools.entries()) {
      console.log(`🔄 Закрытие пула для схемы: ${schemaName}`);
      await pool.end();
    }

    tenantPools.clear();
    console.log('✅ Все подключения к БД закрыты');

  } catch (error) {
    console.error('❌ Ошибка при закрытии подключений:', error);
    throw error;
  }
}

/**
 * Получает информацию о пулах подключений
 */
function getPoolStats() {
  const mainStats = {
    totalCount: mainPool.totalCount,
    idleCount: mainPool.idleCount,
    waitingCount: mainPool.waitingCount
  };

  const tenantStats = {};
  for (const [schemaName, pool] of tenantPools.entries()) {
    tenantStats[schemaName] = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  }

  return {
    main: mainStats,
    tenants: tenantStats
  };
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  mainPool,
  getTenantPool,
  query,
  transaction,
  close,
  getPoolStats,
  _testConnection: testConnection
};