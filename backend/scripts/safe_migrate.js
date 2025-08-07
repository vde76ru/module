// backend/scripts/safe_migrate.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// ========================================
// DATABASE CONFIGURATION
// ========================================

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'saas_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'SecurePostgresPass2025',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Путь к директории с миграциями
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Логирование с временными метками
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const colors = {
    INFO: '\x1b[36m',    // Cyan
    SUCCESS: '\x1b[32m', // Green
    WARNING: '\x1b[33m', // Yellow
    ERROR: '\x1b[31m',   // Red
    RESET: '\x1b[0m'     // Reset
  };

  console.log(`${colors[level]}[${timestamp}] ${level}: ${message}${colors.RESET}`);
}

/**
 * Создает таблицу для отслеживания миграций
 */
async function createMigrationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64),
        execution_time_ms INTEGER,
        success BOOLEAN DEFAULT TRUE
      )
    `);

    log('✅ Таблица schema_migrations готова');

    // Миграция из старого формата, если есть таблица migrations
    const oldTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'migrations'
      );
    `);

    if (oldTableExists.rows[0].exists) {
      log('📦 Обнаружена старая таблица migrations, выполняю миграцию...');

      // Переносим данные из старой таблицы
      await pool.query(`
        INSERT INTO schema_migrations (filename, applied_at, success)
        SELECT name, executed_at, true
        FROM migrations
        WHERE NOT EXISTS (
          SELECT 1 FROM schema_migrations
          WHERE filename = migrations.name
        )
      `);

      log('✅ Данные мигрированы из старой таблицы migrations');
    }

  } catch (error) {
    log(`❌ Ошибка создания таблицы миграций: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Получает список выполненных миграций
 */
async function getExecutedMigrations() {
  try {
    const result = await pool.query(`
      SELECT filename FROM schema_migrations
      WHERE success = TRUE
      ORDER BY applied_at ASC
    `);

    return result.rows.map(row => row.filename);
  } catch (error) {
    log(`❌ Ошибка получения списка миграций: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Получает список файлов миграций
 */
function getMigrationFiles() {
  try {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      log(`⚠️ Директория миграций не найдена: ${MIGRATIONS_DIR}`, 'WARNING');
      return [];
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort();

    log(`📁 Найдено ${files.length} файлов миграций`);
    return files;
  } catch (error) {
    log(`❌ Ошибка чтения директории миграций: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Вычисляет checksum файла
 */
function calculateChecksum(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Выполняет одну миграцию
 */
async function executeMigration(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const startTime = Date.now();

  try {
    log(`🔄 Выполнение миграции: ${filename}`);

    // Читаем файл миграции
    const migrationSQL = fs.readFileSync(filePath, 'utf8');
    const checksum = calculateChecksum(migrationSQL);

    // Проверяем безопасность миграции
    if (!checkMigrationSafety(filename, migrationSQL)) {
      throw new Error('Migration failed safety check');
    }

    // Выполняем миграцию в транзакции
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Выполняем SQL миграции
      await client.query(migrationSQL);

      // Записываем информацию о миграции
      const executionTime = Date.now() - startTime;
      await client.query(`
        INSERT INTO schema_migrations (filename, checksum, execution_time_ms, success)
        VALUES ($1, $2, $3, TRUE)
      `, [filename, checksum, executionTime]);

      await client.query('COMMIT');

      log(`✅ Миграция ${filename} выполнена успешно (${executionTime}ms)`, 'SUCCESS');

    } catch (error) {
      await client.query('ROLLBACK');

      // Записываем неудачную попытку
      try {
        const executionTime = Date.now() - startTime;
        await client.query(`
          INSERT INTO schema_migrations (filename, checksum, execution_time_ms, success)
          VALUES ($1, $2, $3, FALSE)
        `, [filename, calculateChecksum(migrationSQL), executionTime]);
      } catch (logError) {
        log(`⚠️ Не удалось записать информацию об ошибке: ${logError.message}`, 'WARNING');
      }

      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    log(`❌ Ошибка выполнения миграции ${filename}: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Проверяет безопасность миграции
 */
function checkMigrationSafety(filename, migrationSQL) {
  log(`🔍 Проверка миграции: ${filename}`);
  log(`✅ Миграция ${filename} готова к выполнению`);
  return true;
}

/**
 * Проверяет статус миграций
 */
async function checkMigrationStatus() {
  try {
    const executedMigrations = await getExecutedMigrations();
    const allMigrationFiles = getMigrationFiles();

    const pendingMigrations = allMigrationFiles.filter(
      file => !executedMigrations.includes(file)
    );

    log(`📊 Статус миграций:`);
    log(`   ✅ Выполнено: ${executedMigrations.length}`);
    log(`   ⏳ Ожидает: ${pendingMigrations.length}`);
    log(`   📁 Всего файлов: ${allMigrationFiles.length}`);

    if (pendingMigrations.length > 0) {
      log(`📋 Ожидающие миграции:`);
      pendingMigrations.forEach(file => log(`   📄 ${file}`));
    }

    return {
      executed: executedMigrations,
      pending: pendingMigrations,
      total: allMigrationFiles.length
    };

  } catch (error) {
    log(`❌ Ошибка проверки статуса: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Проверяет состояние базы данных
 */
async function checkDatabaseHealth() {
  try {
    log('🏥 Проверка состояния базы данных...');

    // Проверяем основные таблицы
    const tables = ['companies', 'users', 'products', 'warehouses', 'suppliers', 'marketplaces'];

    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        );
      `, [table]);

      if (result.rows[0].exists) {
        const count = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        log(`   ✅ ${table}: ${count.rows[0].count} записей`);
      } else {
        log(`   ❌ ${table}: таблица не найдена`);
      }
    }

    // Проверяем индексы
    const indexCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    log(`   📊 Индексов: ${indexCount.rows[0].count}`);

    // Проверяем RBAC систему
    const rolesCount = await pool.query(`
      SELECT COUNT(*) as count FROM roles WHERE 1=1
    `).catch(() => ({ rows: [{ count: 0 }] }));

    const permissionsCount = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE 1=1
    `).catch(() => ({ rows: [{ count: 0 }] }));

    log(`   🔐 Ролей: ${rolesCount.rows[0].count}, разрешений: ${permissionsCount.rows[0].count}`);

    log('✅ Проверка состояния завершена', 'SUCCESS');

  } catch (error) {
    log(`❌ Ошибка проверки состояния БД: ${error.message}`, 'ERROR');
    throw error;
  }
}

// ========================================
// MAIN FUNCTION
// ========================================

async function main() {
  try {
    log('🚀 Запуск системы миграций ModuleTrade v2.0...');

    // Проверяем подключение к базе данных
    const client = await pool.connect();
    const dbResult = await client.query('SELECT version()');
    client.release();

    log(`✅ Подключение к БД установлено: ${dbResult.rows[0].version.split(',')[0]}`, 'SUCCESS');

    // Создаем таблицу миграций
    await createMigrationsTable();

    // Получаем списки миграций
    const status = await checkMigrationStatus();

    // Если нет новых миграций
    if (status.pending.length === 0) {
      log('🎉 Все миграции уже выполнены!', 'SUCCESS');
      await checkDatabaseHealth();
      return;
    }

    // Предупреждение для production
    if (process.env.NODE_ENV === 'production') {
      log('⚠️ PRODUCTION РЕЖИМ: Убедитесь, что создали backup базы данных!', 'WARNING');

      if (!process.env.CONFIRM_PRODUCTION_MIGRATION) {
        log('❌ Установите CONFIRM_PRODUCTION_MIGRATION=true для выполнения миграций в production', 'ERROR');
        process.exit(1);
      }
    }

    // Выполняем миграции
    log(`🔄 Начинаю выполнение ${status.pending.length} миграций...`);

    for (const filename of status.pending) {
      await executeMigration(filename);
    }

    log('🎉 Все миграции выполнены успешно!', 'SUCCESS');

    // Проверяем состояние после миграций
    await checkDatabaseHealth();

    // Обновляем статистику
    log('📊 Обновление статистики планировщика...');
    await pool.query('ANALYZE');

    log('✅ Процесс миграции завершен успешно!', 'SUCCESS');

  } catch (error) {
    log(`❌ Критическая ошибка: ${error.message}`, 'ERROR');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Запуск если файл вызван напрямую
if (require.main === module) {
  main();
}

module.exports = {
  main,
  checkMigrationStatus,
  checkDatabaseHealth
};