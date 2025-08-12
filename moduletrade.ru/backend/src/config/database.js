const { Pool } = require('pg');
const logger = require('../utils/logger');

// ========================================
// DATABASE CONFIGURATION
// ========================================

// Конфигурация полностью управляется переменными окружения из .env файла.
// Это "единственный источник правды", что устраняет ошибки подключения.
const config = {
    // Для Docker используется имя сервиса ('postgres'), для локального запуска - 'localhost'.
    host: process.env.DB_HOST || 'postgres',
    // Важно: используем переменные, определенные в docker-compose.yml для сервиса backend
    user: process.env.DB_USER || 'postgres',
    // Не задаем небезопасный пароль по умолчанию — пусть падает явно, если не задан
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'saas_platform',
    port: parseInt(process.env.DB_PORT || '5432', 10),

    // Настройки пула соединений
    min: 2,
    max: 20,
    idleTimeoutMillis: 300000,
    connectionTimeoutMillis: 10000,
};

logger.info({
    message: 'Инициализация конфигурации базы данных',
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user ? '******' : 'NOT SET', // Не логируем имя пользователя в продакшене
});


// Создаем основной пул соединений
const pool = new Pool(config);

// ========================================
// POOL EVENT HANDLERS
// ========================================

pool.on('connect', (client) => {
    logger.info('✅ Установлено новое соединение с PostgreSQL.');
    // Устанавливаем search_path по умолчанию для всех новых соединений.
    client.query('SET search_path TO public').catch(err => {
        logger.error('⚠️ Не удалось установить search_path для нового соединения.', err);
    });
});

pool.on('error', (err) => {
    logger.error('❌ Неожиданная ошибка в пуле соединений PostgreSQL.', err);
});

pool.on('remove', () => {
    logger.debug('🔌 Соединение с PostgreSQL закрыто (idle timeout).');
});

// ========================================
// DATABASE HELPER FUNCTIONS
// ========================================

/**
 * Выполняет SQL-запрос к базе данных с логированием и обработкой ошибок.
 * @param {string} text - Текст SQL-запроса с плейсхолдерами ($1, $2, ...).
 * @param {Array} params - Массив параметров для запроса.
 * @returns {Promise<import('pg').QueryResult>} Результат запроса.
 */
async function query(text, params = []) {
    if (!Array.isArray(params)) {
        logger.error('❌ ОШИБКА: Параметры запроса должны быть массивом!', { text, params });
        throw new Error('Query values must be an array');
    }

    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug({ message: 'Запрос выполнен успешно', text, duration, rowCount: res.rowCount });
        return res;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error({
            message: '❌ Ошибка выполнения запроса к БД',
            error: { message: error.message },
            query: text,
            params: params,
            duration: duration
        });
        throw error;
    }
}

/**
 * ВОССТАНОВЛЕНО: Мультитенантная функция-обертка.
 * В будущем здесь можно будет добавить логику переключения схем (SET search_path).
 * @param {string} companyId - ID тенанта (пока не используется, но зарезервирован).
 * @param {string} text - SQL запрос.
 * @param {Array} params - Параметры запроса.
 * @returns {Promise<import('pg').QueryResult>} Результат запроса.
 */
async function queryWithTenant(companyId, text, params = []) {
    // На данный момент эта функция является оберткой.
    // В будущем ее можно расширить для установки search_path для конкретного тенанта.
    logger.debug(`Выполнение запроса в контексте тенанта ${companyId}`);
    return query(text, params);
}


/**
 * Получает клиент из пула. Необходимо для выполнения транзакций.
 * Не забывайте вызывать client.release() после завершения работы.
 * @returns {Promise<import('pg').PoolClient>} Клиент для выполнения транзакций.
 */
async function getClient() {
    try {
        const client = await pool.connect();
        return client;
    } catch (error) {
        logger.error('❌ Не удалось получить клиента из пула.', error);
        throw error;
    }
}

/**
 * ВОССТАНОВЛЕНО: Функция для проверки соединения с базой данных.
 * Полезна для эндпоинта /health.
 * @returns {Promise<boolean>} Возвращает true, если соединение успешно.
 */
async function checkConnection() {
    let client;
    try {
        client = await pool.connect();
        await client.query('SELECT NOW()');
        logger.info('✅ Проверка соединения с базой данных прошла успешно.');
        return true;
    } catch (error) {
        logger.error('❌ Проверка соединения с базой данных провалилась.', error);
        return false;
    } finally {
        if (client) {
            client.release();
        }
    }
}

/**
 * Корректное завершение работы с базой данных при остановке приложения.
 */
async function gracefulShutdown() {
    logger.info('🛑 Закрытие пула соединений с базой данных...');
    try {
        await pool.end();
        logger.info('✅ Пул соединений с базой данных успешно закрыт.');
    } catch (error) {
        logger.error('❌ Ошибка при закрытии пула соединений.', error);
    }
}

// ========================================
// MODULE EXPORTS
// ========================================

module.exports = {
    // Функции для работы с БД
    query,
    queryWithTenant, // <--- ВОССТАНОВЛЕНО
    getClient,
    checkConnection, // <--- ВОССТАНОВЛЕНО
    gracefulShutdown,
    // Экспортируем сам пул и конфиг для специфических случаев (например, скриптов)
    pool,
    config,
};
