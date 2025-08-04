#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'saas_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function checkMigrationStatus() {
  try {
    console.log('📊 Статус миграций базы данных ModuleTrade v2.0\n');

    // Информация о подключении
    const connInfo = await pool.query('SELECT current_database(), current_user, version()');
    console.log(`🔗 База данных: ${connInfo.rows[0].current_database}`);
    console.log(`👤 Пользователь: ${connInfo.rows[0].current_user}`);
    console.log(`📝 PostgreSQL: ${connInfo.rows[0].version.split(' ').slice(0,2).join(' ')}\n`);

    // Проверяем, существует ли новая таблица миграций
    const newTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'schema_migrations'
      );
    `);

    // Проверяем старую таблицу
    const oldTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'migrations'
      );
    `);

    let executedMigrations = [];

    if (newTableExists.rows[0].exists) {
      // Используем новую таблицу
      const executedResult = await pool.query(`
        SELECT filename, applied_at, success, execution_time_ms
        FROM schema_migrations
        ORDER BY applied_at
      `);
      executedMigrations = executedResult.rows.map(row => row.filename);

      console.log(`✅ Выполненные миграции (${executedResult.rows.length}):`);
      if (executedResult.rows.length === 0) {
        console.log('   Нет выполненных миграций');
      } else {
        executedResult.rows.forEach(row => {
          const status = row.success ? '✓' : '❌';
          const time = row.execution_time_ms ? ` (${row.execution_time_ms}ms)` : '';
          console.log(`   ${status} ${row.filename}${time} - ${row.applied_at.toISOString().slice(0,19).replace('T', ' ')}`);
        });
      }

    } else if (oldTableExists.rows[0].exists) {
      // Используем старую таблицу
      console.log('⚠️ Используется старая таблица migrations, рекомендуется запустить миграцию');
      const executedResult = await pool.query(`
        SELECT name, executed_at
        FROM migrations
        ORDER BY id
      `);
      executedMigrations = executedResult.rows.map(row => row.name);

      console.log(`✅ Выполненные миграции (${executedResult.rows.length}):`);
      executedResult.rows.forEach(row => {
        console.log(`   ✓ ${row.name} (${row.executed_at.toISOString().slice(0,19).replace('T', ' ')})`);
      });

    } else {
      console.log('❌ Таблица миграций не существует');
      console.log('   Будет создана при первом запуске npm run migrate\n');
    }

    // Получаем все файлы миграций
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    let allFiles = [];

    if (fs.existsSync(migrationsDir)) {
      allFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
    }

    const pendingMigrations = allFiles.filter(file => !executedMigrations.includes(file));

    // Выводим ожидающие миграции
    console.log(`\n⏳ Ожидающие выполнения (${pendingMigrations.length}):`);
    if (pendingMigrations.length === 0) {
      console.log('   Все миграции выполнены ✨');
    } else {
      pendingMigrations.forEach(file => {
        console.log(`   ⏳ ${file}`);
      });
      console.log(`\n💡 Для выполнения: npm run migrate`);
    }

    // Показываем файлы миграций
    console.log(`\n📁 Найдено файлов миграций: ${allFiles.length}`);
    allFiles.forEach(file => {
      const status = executedMigrations.includes(file) ? '✅' : '⏳';
      console.log(`   ${status} ${file}`);
    });

    await showTables();
    await showDatabaseStats();

  } catch (error) {
    console.error('❌ Ошибка проверки статуса:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function showTables() {
  try {
    const tables = await pool.query(`
      SELECT tablename, schemaname
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log(`\n📋 Таблицы в базе данных (${tables.rows.length}):`);
    if (tables.rows.length === 0) {
      console.log('   Нет таблиц в схеме public');
    } else {
      // Группируем по типам таблиц
      const coreTabels = tables.rows.filter(t =>
        ['companies', 'users', 'products', 'warehouses', 'suppliers', 'marketplaces'].includes(t.tablename)
      );
      const systemTables = tables.rows.filter(t =>
        ['schema_migrations', 'migrations', 'logs', 'roles', 'permissions'].includes(t.tablename)
      );
      const analyticsTables = tables.rows.filter(t =>
        t.tablename.includes('analytics') || t.tablename.includes('kpi')
      );
      const otherTables = tables.rows.filter(t =>
        !coreTabels.includes(t) && !systemTables.includes(t) && !analyticsTables.includes(t)
      );

      if (coreTabels.length > 0) {
        console.log('\n   🏢 Основные таблицы:');
        coreTabels.forEach(row => console.log(`      📁 ${row.tablename}`));
      }

      if (systemTables.length > 0) {
        console.log('\n   ⚙️ Системные таблицы:');
        systemTables.forEach(row => console.log(`      📁 ${row.tablename}`));
      }

      if (analyticsTables.length > 0) {
        console.log('\n   📊 Аналитические таблицы:');
        analyticsTables.forEach(row => console.log(`      📁 ${row.tablename}`));
      }

      if (otherTables.length > 0) {
        console.log('\n   📦 Прочие таблицы:');
        otherTables.slice(0, 15).forEach(row => console.log(`      📁 ${row.tablename}`));
        if (otherTables.length > 15) {
          console.log(`      ... и еще ${otherTables.length - 15} таблиц`);
        }
      }
    }
  } catch (error) {
    console.log('\n❌ Не удалось получить список таблиц:', error.message);
  }
}

async function showDatabaseStats() {
  try {
    console.log('\n📈 Статистика базы данных:');

    // Статистика основных таблиц
    const mainTables = ['companies', 'users', 'products', 'warehouses', 'suppliers', 'marketplaces'];

    for (const table of mainTables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   📊 ${table}: ${result.rows[0].count} записей`);
      } catch (err) {
        console.log(`   ❌ ${table}: таблица не найдена`);
      }
    }

    // Проверяем RBAC систему
    try {
      const rolesCount = await pool.query('SELECT COUNT(*) as count FROM roles');
      const permissionsCount = await pool.query('SELECT COUNT(*) as count FROM permissions');
      const rolePermissionsCount = await pool.query('SELECT COUNT(*) as count FROM role_permissions');

      console.log(`\n   🔐 RBAC система:`);
      console.log(`      👥 Ролей: ${rolesCount.rows[0].count}`);
      console.log(`      🔑 Разрешений: ${permissionsCount.rows[0].count}`);
      console.log(`      🔗 Связей роль-разрешение: ${rolePermissionsCount.rows[0].count}`);
    } catch (err) {
      console.log('\n   ⚠️ RBAC система не настроена');
    }

    // Проверяем аналитические таблицы
    try {
      const salesCount = await pool.query('SELECT COUNT(*) as count FROM sales_analytics');
      console.log(`\n   📊 Аналитика:`);
      console.log(`      💰 Записей продаж: ${salesCount.rows[0].count}`);
    } catch (err) {
      console.log('\n   ⚠️ Аналитические таблицы не созданы');
    }

    // Размер базы данных
    const dbSize = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`\n   💾 Размер БД: ${dbSize.rows[0].size}`);

    // Количество индексов
    const indexCount = await pool.query(`
      SELECT COUNT(*) as count FROM pg_indexes WHERE schemaname = 'public'
    `);
    console.log(`   🗂️ Индексов: ${indexCount.rows[0].count}`);

  } catch (error) {
    console.log('\n❌ Ошибка получения статистики:', error.message);
  }
}

if (require.main === module) {
  checkMigrationStatus();
}

module.exports = { checkMigrationStatus };