/* ============================================================
Файл: backend/scripts/check-status.js
Описание: Скрипт для проверки статуса миграций.
============================================================
*/

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'saas_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function checkMigrationStatus() {
  console.log('📊 Статус миграций базы данных\n');
  let client;

  try {
    client = await pool.connect();
    const connInfo = await client.query('SELECT current_database(), current_user, version()');
    console.log(`🔗 База данных: ${connInfo.rows[0].current_database}`);
    console.log(`👤 Пользователь: ${connInfo.rows[0].current_user}`);
    console.log(`📝 PostgreSQL: ${connInfo.rows[0].version.split(' ').slice(0, 2).join(' ')}\n`);

    const tableExistsRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      );
    `);

    const allFiles = fs.existsSync(MIGRATIONS_DIR)
      ? fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
      : [];

    if (!tableExistsRes.rows[0].exists) {
      console.log('❌ Таблица schema_migrations не найдена. Будет создана при запуске миграций.');
      console.log(`\n⏳ Найдено ${allFiles.length} файлов миграций для применения:`);
      allFiles.forEach(file => console.log(`   📄 ${file}`));
      return;
    }

    const executedResult = await client.query('SELECT filename, applied_at, success FROM schema_migrations ORDER BY id');
    const executedFiles = executedResult.rows.map(row => row.filename);
    const pendingFiles = allFiles.filter(file => !executedFiles.includes(file));

    console.log(`✅ Выполненные миграции (${executedResult.rows.length}):`);
    if (executedResult.rows.length === 0) {
      console.log('   Нет выполненных миграций.');
    } else {
      executedResult.rows.forEach(row => {
        const status = row.success ? '✓' : '✗';
        const date = new Date(row.applied_at).toISOString().slice(0, 19).replace('T', ' ');
        console.log(`   ${status} ${row.filename} (${date})`);
      });
    }

    console.log(`\n⏳ Ожидающие выполнения (${pendingFiles.length}):`);
    if (pendingFiles.length === 0) {
      console.log('   ✨ Все миграции выполнены!');
    } else {
      pendingFiles.forEach(file => console.log(`   📄 ${file}`));
      console.log(`\n💡 Для выполнения: npm run migrate`);
    }

  } catch (error) {
    console.error('❌ Ошибка проверки статуса:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  checkMigrationStatus();
}
