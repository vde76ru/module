// backend/scripts/check_db_health.js
require('dotenv').config();
const db = require('../src/config/database');

// --- Конфигурация ---
// Используем общий пул/конфиг из backend/src/config/database.js

// --- Утилиты ---
const log = (message) => console.log(message);
const colors = {
  green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m'
};

let issuesFound = 0;

/**
 * Проверяет наличие таблицы и выводит результат.
 */
async function checkTable(tableName) {
  try {
    const res = await db.query(`SELECT to_regclass('public.${tableName}')`);
    if (res.rows[0].to_regclass) {
      const countRes = await db.query(`SELECT COUNT(*) FROM ${tableName};`);
      log(`  ${colors.green}✅ ${tableName.padEnd(30)} | Записей: ${countRes.rows[0].count}${colors.reset}`);
    } else {
      log(`  ${colors.red}❌ ${tableName.padEnd(30)} | Таблица не найдена!${colors.reset}`);
      issuesFound++;
    }
  } catch (e) {
    log(`  ${colors.red}❌ ${tableName.padEnd(30)} | Ошибка проверки: ${e.message}${colors.reset}`);
    issuesFound++;
  }
}

/**
 * Главная функция
 */
async function checkHealth() {
  log(colors.cyan + '--- Проверка целостности базы данных ---' + colors.reset);
  
  const coreTables = [
    'roles', 'tariffs', 'companies', 'users', 'categories', 'brands', 'products',
    'suppliers', 'marketplaces', 'warehouses', 'orders', 'payments'
  ];
  
  const logTables = ['audit_logs', 'sync_logs', 'api_logs', 'system_logs'];

  try {
    log('\nПроверка основных таблиц...');
    for (const table of coreTables) {
      await checkTable(table);
    }

    log('\nПроверка таблиц логов и аудита...');
    for (const table of logTables) {
      await checkTable(table);
    }
    
    // Дополнительные важные проверки можно добавить сюда
    // Например, проверка внешних ключей, индексов и т.д.

    log('\n' + '-'.repeat(40));
    if (issuesFound > 0) {
      log(colors.red + `\nОбнаружено проблем: ${issuesFound}. Требуется внимание!` + colors.reset);
    } else {
      log(colors.green + '\n🎉 Проверка завершена. Критических проблем не обнаружено.' + colors.reset);
    }

  } catch (error) {
    log(colors.red + `\nКритическая ошибка: ${error.message}` + colors.reset);
  } finally {
    await db.gracefulShutdown();
  }
}

checkHealth();