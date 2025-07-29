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
    console.log('📊 Статус миграций базы данных\n');
    
    // Информация о подключении
    const connInfo = await pool.query('SELECT current_database(), current_user, version()');
    console.log(`🔗 База данных: ${connInfo.rows[0].current_database}`);
    console.log(`👤 Пользователь: ${connInfo.rows[0].current_user}`);
    console.log(`📝 PostgreSQL: ${connInfo.rows[0].version.split(' ').slice(0,2).join(' ')}\n`);
    
    // Проверяем, существует ли таблица миграций
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Таблица migrations не существует');
      console.log('   Будет создана при первом запуске npm run migrate\n');
      
      // Показываем файлы миграций
      const migrationsDir = path.join(__dirname, '..', 'migrations');
      if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
        console.log(`📁 Найдено файлов миграций: ${files.length}`);
        files.forEach(file => console.log(`   📄 ${file}`));
      } else {
        console.log('📁 Папка migrations не найдена');
      }
      
      await showTables();
      return;
    }
    
    // Получаем выполненные миграции
    const executedResult = await pool.query(`
      SELECT name, executed_at 
      FROM migrations 
      ORDER BY id
    `);
    
    // Получаем все файлы миграций
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    let allFiles = [];
    
    if (fs.existsSync(migrationsDir)) {
      allFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
    }
    
    const executedMigrations = executedResult.rows.map(row => row.name);
    const pendingMigrations = allFiles.filter(file => !executedMigrations.includes(file));
    
    // Выводим результаты
    console.log(`✅ Выполненные миграции (${executedMigrations.length}):`);
    if (executedMigrations.length === 0) {
      console.log('   Нет выполненных миграций');
    } else {
      executedResult.rows.forEach(row => {
        console.log(`   ✓ ${row.name} (${row.executed_at.toISOString().slice(0,19).replace('T', ' ')})`);
      });
    }
    
    console.log(`\n⏳ Ожидающие выполнения (${pendingMigrations.length}):`);
    if (pendingMigrations.length === 0) {
      console.log('   Все миграции выполнены ✨');
    } else {
      pendingMigrations.forEach(file => {
        console.log(`   ⏳ ${file}`);
      });
      console.log(`\n💡 Для выполнения: npm run migrate`);
    }
    
    await showTables();
    
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
      SELECT tablename
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    console.log(`\n📋 Таблицы в базе данных (${tables.rows.length}):`);
    if (tables.rows.length === 0) {
      console.log('   Нет таблиц в схеме public');
    } else {
      tables.rows.slice(0, 20).forEach(row => {
        console.log(`   📁 ${row.tablename}`);
      });
      if (tables.rows.length > 20) {
        console.log(`   ... и еще ${tables.rows.length - 20} таблиц`);
      }
    }
  } catch (error) {
    console.log('\n❌ Не удалось получить список таблиц:', error.message);
  }
}

if (require.main === module) {
  checkMigrationStatus();
}

module.exports = { checkMigrationStatus };