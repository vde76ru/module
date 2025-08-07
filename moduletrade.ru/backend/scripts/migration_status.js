// backend/scripts/migration_status.js
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
const log = (message) => console.log(message);
const colors = {
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m'
};

/**
 * Главная функция
 */
async function checkStatus() {
  log(colors.cyan + '--- Статус миграций базы данных ---' + colors.reset);

  try {
    // Проверяем наличие таблицы миграций
    const tableExists = await pool.query("SELECT to_regclass('public.schema_migrations');");
    if (!tableExists.rows[0].to_regclass) {
      log(colors.yellow + '⚠️ Таблица `schema_migrations` не найдена. Запустите миграцию (`npm run migrate`) для ее создания.' + colors.reset);
      return;
    }
    
    const allFiles = fs.readdirSync(MIGRATIONS_DIR).filter(file => file.endsWith('.sql')).sort();
    const dbMigrationsResult = await pool.query('SELECT filename, success, error_message FROM schema_migrations ORDER BY filename ASC;');
    const dbMigrations = dbMigrationsResult.rows.reduce((acc, row) => {
      acc[row.filename] = { success: row.success, error: row.error_message };
      return acc;
    }, {});

    log(`\n📁 Найдено ${allFiles.length} файлов миграций. Статус в БД:\n`);

    let pendingCount = 0;

    allFiles.forEach(file => {
      if (dbMigrations[file]) {
        if (dbMigrations[file].success) {
          log(`${colors.green}  ✅  [ВЫПОЛНЕНО] ${file}${colors.reset}`);
        } else {
          log(`${colors.red}  ❌  [ПРОВАЛЕНО]  ${file}${colors.reset}`);
          log(`      └─ Ошибка: ${dbMigrations[file].error}`);
        }
      } else {
        log(`${colors.yellow}  ⏳  [ОЖИДАЕТ]    ${file}${colors.reset}`);
        pendingCount++;
      }
    });

    log('\n' + '-'.repeat(35));
    if (pendingCount > 0) {
      log(colors.yellow + `\n💡 Найдено ${pendingCount} ожидающих миграций. Для выполнения запустите 'npm run migrate'.` + colors.reset);
    } else {
      log(colors.green + '\n🎉 Все миграции выполнены. База данных в актуальном состоянии.' + colors.reset);
    }

  } catch (error) {
    log(colors.red + `\n❌ Не удалось получить статус: ${error.message}` + colors.reset);
  } finally {
    await pool.end();
  }
}

// --- Запуск ---
checkStatus();