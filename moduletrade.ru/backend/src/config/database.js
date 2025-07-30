// backend/src/config/database.js
// ИСПРАВЛЕНО: Добавлена корректная обработка параметров запросов
const { Pool } = require('pg');

// ========================================
// DATABASE CONFIGURATION
// ========================================

// ИСПРАВЛЕНИЕ: Упрощаем логику SSL - отключаем для Docker окружения
const isProduction = process.env.NODE_ENV === 'production';
const isDockerEnvironment = process.env.DB_HOST === 'postgres'; // Имя контейнера в docker-compose

// SSL конфигурация - ВСЕГДА отключаем для Docker PostgreSQL
const sslConfig = false; // PostgreSQL в Docker не настроен с SSL

console.log('Database configuration:', {
  host: process.env.DB_HOST,
  isProduction,
  isDockerEnvironment,
  ssl: sslConfig
});

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

  // SSL настройки - ОТКЛЮЧЕНЫ
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
  console.error('Client info:', client ? 'connected' : 'no client');
});

mainPool.on('remove', (client) => {
  console.log('🔌 Подключение к PostgreSQL закрыто');
});

// ========================================
// DATABASE HELPER FUNCTIONS - ИСПРАВЛЕНО
// ========================================

/**
 * ИСПРАВЛЕНО: Корректная функция выполнения запроса к базе данных
 * @param {string} text - SQL запрос
 * @param {Array} params - Параметры запроса (ОБЯЗАТЕЛЬНО МАССИВ!)
 * @returns {Promise<Object>} Результат запроса
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Всегда передаем params как массив
    if (!Array.isArray(params)) {
      console.error('❌ ОШИБКА: Параметры запроса должны быть массивом!', { text, params });
      throw new Error('Query values must be an array');
    }

    const res = await mainPool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Database query error:', {
      error: error.message,
      query: text,
      params: params,
      duration: duration
    });
    throw error;
  }
}

/**
 * ИСПРАВЛЕНО: Мультитенантная функция запроса с tenantId
 * @param {string} tenantId - ID тенанта
 * @param {string} text - SQL запрос
 * @param {Array} params - Параметры запроса
 * @returns {Promise<Object>} Результат запроса
 */
async function queryWithTenant(tenantId, text, params = []) {
  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Обеспечиваем, что params всегда массив
  const safeParams = Array.isArray(params) ? params : [];
  
  // Логирование для отладки
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('Query with tenant:', { tenantId, text, params: safeParams });
  }
  
  return await query(text, safeParams);
}

/**
 * Получение клиента из пула для транзакций
 * @returns {Promise<Object>} Клиент базы данных
 */
async function getClient() {
  try {
    const client = await mainPool.connect();
    return client;
  } catch (error) {
    console.error('Error getting database client:', error);
    throw error;
  }
}

/**
 * Проверка подключения к базе данных
 * @returns {Promise<boolean>} Статус подключения
 */
async function checkConnection() {
  try {
    const result = await mainPool.query('SELECT NOW()');
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown() {
  console.log('🛑 Closing database connections...');
  try {
    await mainPool.end();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
}

// ========================================
// MODULE EXPORTS
// ========================================

module.exports = {
  mainPool,
  query,
  queryWithTenant,
  getClient,
  checkConnection,
  gracefulShutdown
};