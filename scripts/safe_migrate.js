// backend/scripts/safe_migrate.js
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const db = require('../src/config/database');

// --- Конфигурация ---
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

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
  await db.query(`
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
  const result = await db.query("SELECT filename FROM schema_migrations WHERE success = TRUE ORDER BY filename ASC;");
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
    await client.query(
      `INSERT INTO schema_migrations (filename, success, execution_time_ms)
       VALUES ($1, TRUE, $2)
       ON CONFLICT (filename)
       DO UPDATE SET success = EXCLUDED.success,
                     execution_time_ms = EXCLUDED.execution_time_ms,
                     error_message = NULL,
                     applied_at = CURRENT_TIMESTAMP`,
      [filename, executionTime]
    );
    log(`✅ Успех (${executionTime}ms)`, 'SUCCESS');
    return true;

  } catch (error) {
    await client.query('ROLLBACK');
    const executionTime = Date.now() - startTime;
    log(`❌ ОШИБКА в ${filename}: ${error.message}`, 'ERROR');

    // Записываем провал
    await client.query(
      `INSERT INTO schema_migrations (filename, success, error_message, execution_time_ms)
       VALUES ($1, FALSE, $2, $3)
       ON CONFLICT (filename)
       DO UPDATE SET success = EXCLUDED.success,
                     error_message = EXCLUDED.error_message,
                     execution_time_ms = EXCLUDED.execution_time_ms,
                     applied_at = CURRENT_TIMESTAMP`,
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
  const client = await db.getClient();
  let hadError = false;

  try {
    // Глобальная блокировка миграций, чтобы не запускать параллельно
    const lockKey = BigInt('987654321012345678');
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [lockKey]);
    if (!rows[0] || rows[0].acquired !== true) {
      log('⚠️ Другой процесс уже выполняет миграции. Пропускаю запуск.', 'WARNING');
      return;
    }

    await ensureMigrationsTable();

    // Печатаем текущий статус всех миграций
    const statusRes = await client.query('SELECT filename, success, error_message FROM schema_migrations ORDER BY filename ASC');
    const statusMap = statusRes.rows.reduce((acc, r) => {
      acc[r.filename] = { success: r.success, error: r.error_message };
      return acc;
    }, {});

    const allFiles = getMigrationFiles();
    log(`\nСтатус миграций (${allFiles.length} файлов):`);
    allFiles.forEach((file) => {
      if (statusMap[file]) {
        if (statusMap[file].success) {
          log(`  ✅ [ВЫПОЛНЕНО] ${file}`);
        } else {
          log(`  ❌ [ПРОВАЛЕНО]  ${file}`);
          if (statusMap[file].error) {
            log(`     └─ Причина: ${statusMap[file].error}`);
          }
        }
      } else {
        log(`  ⏳ [ОЖИДАЕТ]    ${file}`);
      }
    });

    const appliedMigrations = Object.keys(statusMap).filter((f) => statusMap[f]?.success);
    const pendingMigrations = allFiles.filter(f => !appliedMigrations.includes(f));

    if (pendingMigrations.length === 0) {
      log('\n🎉 База данных в актуальном состоянии. Новых миграций нет.', 'SUCCESS');
      return;
    }

    log(`\nОбнаружено ${pendingMigrations.length} новых миграций. Начинаю выполнение...`);

    for (const filename of pendingMigrations) {
      const success = await runMigration(client, filename);
      if (!success) {
        hadError = true;
        log('Прерываю выполнение из-за ошибки.', 'ERROR');
        break; // Прерываем цикл при первой ошибке
      }
    }

  } catch (error) {
    hadError = true;
    log(`Критическая ошибка миграции: ${error.message}`, 'ERROR');
  } finally {
    // Снимаем advisory lock (если соединение живо)
    try {
      const lockKey = BigInt('987654321012345678');
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    } catch (_) { /* ignore */ }

    await client.release();
    await db.gracefulShutdown();
    log('Процесс миграции завершен.');

    // ЯВНО завершаем процесс, чтобы не висел таймер логгера
    // Выставляем код завершения по наличию ошибок
    setImmediate(() => process.exit(hadError ? 1 : 0));
  }
}

// --- Запуск ---
migrate();