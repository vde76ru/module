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
  log(`🔍 Проверка безопасности миграции: ${filename}`);

  // Список потенциально опасных операций
  const dangerousPatterns = [
    /DROP\s+TABLE\s+(?!IF\s+EXISTS)/i,
    /DELETE\s+FROM\s+(?!.*WHERE)/i,
    /TRUNCATE\s+TABLE/i,
    /DROP\s+DATABASE/i,
    /DROP\s+SCHEMA\s+(?!IF\s+EXISTS)/i,
    /ALTER\s+TABLE\s+.*\s+DROP\s+COLUMN/i
  ];

  const dangerous = dangerousPatterns.some(pattern => pattern.test(migrationSQL));

  if (dangerous) {
    log(`⚠️ ВНИМАНИЕ: Миграция ${filename} содержит потенциально опасные операции!`, 'WARNING');

    if (process.env.FORCE_UNSAFE_MIGRATIONS !== 'true') {
      log('❌ Установите FORCE_UNSAFE_MIGRATIONS=true для выполнения опасных миграций', 'ERROR');
      return false;
    } else {
      log('⚠️ Выполнение опасной миграции разрешено через FORCE_UNSAFE_MIGRATIONS', 'WARNING');
    }
  }

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

// ========================================
// MAIN FUNCTION
// ========================================

async function main() {
  try {
    log('🚀 Запуск системы миграций ModuleTrade...');

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
      return;
    }

    // Предупреждение для production
    if (process.env.NODE_ENV === 'production') {
      log('⚠️ PRODUCTION РЕЖИМ: Убедитесь, что создали backup базы данных!', 'WARNING');
      log('   Команда: npm run db:backup');

      // В production ждем подтверждения
      if (!process.env.AUTO_MIGRATE) {
        log('❌ Установите AUTO_MIGRATE=true для автоматического выполнения в production', 'ERROR');
        process.exit(1);
      }
    }

    // Проверяем безопасность всех миграций
    let allSafe = true;
    for (const migration of status.pending) {
      const filePath = path.join(MIGRATIONS_DIR, migration);
      const migrationSQL = fs.readFileSync(filePath, 'utf8');

      if (!checkMigrationSafety(migration, migrationSQL)) {
        allSafe = false;
      }
    }

    if (!allSafe) {
      log('❌ Некоторые миграции не прошли проверку безопасности', 'ERROR');
      process.exit(1);
    }

    // Выполняем миграции одну за другой
    log(`🔄 Начинаем выполнение ${status.pending.length} миграций...`);

    for (let i = 0; i < status.pending.length; i++) {
      const migration = status.pending[i];
      log(`📊 Прогресс: ${i + 1}/${status.pending.length}`);

      try {
        await executeMigration(migration);
      } catch (error) {
        log(`❌ Миграция ${migration} завершилась с ошибкой`, 'ERROR');
        log(`💡 Проверьте SQL синтаксис и зависимости`, 'WARNING');
        throw error;
      }
    }

    log('🎉 Все миграции выполнены успешно!', 'SUCCESS');
    log('💡 Проверьте статус: npm run db:status');

  } catch (error) {
    log(`❌ Критическая ошибка миграции: ${error.message}`, 'ERROR');
    log('🛠️ Возможные причины:', 'WARNING');
    log('   - Ошибка подключения к базе данных');
    log('   - Синтаксическая ошибка в SQL');
    log('   - Нарушение ограничений целостности');
    log('   - Недостаточно прав доступа');

    if (error.code) {
      log(`   - PostgreSQL код ошибки: ${error.code}`, 'WARNING');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ========================================
// EXECUTION
// ========================================

// Запуск только если файл выполняется напрямую
if (require.main === module) {
  // Проверяем аргументы командной строки
  const args = process.argv.slice(2);

  if (args.includes('--dry-run')) {
    log('🔍 Режим проверки (dry-run)', 'INFO');

    (async () => {
      try {
        const client = await pool.connect();
        client.release();
        await createMigrationsTable();
        await checkMigrationStatus();
        log('✅ Проверка завершена успешно', 'SUCCESS');
      } catch (error) {
        log(`❌ Ошибка проверки: ${error.message}`, 'ERROR');
        process.exit(1);
      } finally {
        await pool.end();
      }
    })();
  } else {
    main();
  }
}

module.exports = { main, checkMigrationStatus };