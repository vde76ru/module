// backend/scripts/safe_migrate.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// --- Конфигурация ---
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'saas_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'SecurePostgresPass2025',
});

// --- Утилиты ---
const log = (message, level = 'INFO') => {
  const colors = {
    INFO: '\x1b[36m', SUCCESS: '\x1b[32m', WARNING: '\x1b[33m', ERROR: '\x1b[31m', RESET: '\x1b[0m'
  };
  console.log(`${colors[level] || colors.RESET}[${new Date().toISOString()}] ${level}: ${message}${colors.RESET}`);
};

// --- Основные функции ---

/**
 * Гарантирует наличие таблицы для хранения версий миграций.
 */
async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN NOT NULL,
      error_message TEXT,
      execution_time_ms INTEGER
    );
  `);
}

/**
 * Получает список уже выполненных миграций из БД.
 */
async function getAppliedMigrations() {
  const result = await pool.query("SELECT filename FROM schema_migrations WHERE success = TRUE ORDER BY filename ASC;");
  return result.rows.map(row => row.filename);
}

/**
 * Получает отсортированный список всех файлов миграций из папки.
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    log(`Директория миграций не найдена: ${MIGRATIONS_DIR}`, 'ERROR');
    return [];
  }
  return fs.readdirSync(MIGRATIONS_DIR).filter(file => file.endsWith('.sql')).sort();
}

/**
 * Выполняет одну миграцию в транзакции.
 * @param {pg.PoolClient} client - Клиент подключения к БД.
 * @param {string} filename - Имя файла миграции.
 */
async function runMigration(client, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  const startTime = Date.now();

  log(`--- 🚀 Выполнение: ${filename} ---`);

  try {
    // Выполняем весь файл в одной транзакции
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    const executionTime = Date.now() - startTime;
    // Записываем успех
    await pool.query(
      'INSERT INTO schema_migrations (filename, success, execution_time_ms) VALUES ($1, TRUE, $2)',
      [filename, executionTime]
    );
    log(`✅ Успех (${executionTime}ms)`, 'SUCCESS');
    return true;

  } catch (error) {
    await client.query('ROLLBACK');
    const executionTime = Date.now() - startTime;
    log(`❌ ОШИБКА в ${filename}: ${error.message}`, 'ERROR');

    // Записываем провал
    await pool.query(
      'INSERT INTO schema_migrations (filename, success, error_message, execution_time_ms) VALUES ($1, FALSE, $2, $3)',
      [filename, error.message, executionTime]
    );
    return false;
  }
}

/**
 * Главная функция
 */
async function migrate() {
  log('Запуск системы миграций...');
  const client = await pool.connect();

  try {
    await ensureMigrationsTable();

    const appliedMigrations = await getAppliedMigrations();
    const allFiles = getMigrationFiles();
    const pendingMigrations = allFiles.filter(f => !appliedMigrations.includes(f));

    if (pendingMigrations.length === 0) {
      log('🎉 База данных в актуальном состоянии. Новых миграций нет.', 'SUCCESS');
      return;
    }

    log(`Обнаружено ${pendingMigrations.length} новых миграций. Начинаю выполнение...`);

    for (const filename of pendingMigrations) {
      const success = await runMigration(client, filename);
      if (!success) {
        log('Прерываю выполнение из-за ошибки.', 'ERROR');
        break; // Прерываем цикл при первой ошибке
      }
    }

  } catch (error) {
    log(`Критическая ошибка миграции: ${error.message}`, 'ERROR');
  } finally {
    await client.release();
    await pool.end();
    log('Процесс миграции завершен.');
  }
}

// --- Запуск ---
migrate();