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
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Создание таблицы для отслеживания миграций
async function createMigrationsTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(createTableQuery);
  console.log('✅ Таблица migrations готова');
}

// Получение списка выполненных миграций
async function getExecutedMigrations() {
  const result = await pool.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(row => row.name);
}

// Получение списка файлов миграций
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Папка migrations не найдена');
    console.log('💡 Создайте папку: mkdir -p migrations');
    process.exit(1);
  }

  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
}

// Выполнение одной миграции
async function executeMigration(filename) {
  console.log(`🔄 Выполнение миграции: ${filename}`);
  
  const migrationPath = path.join(__dirname, '..', 'migrations', filename);
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Начинаем транзакцию
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Выполняем SQL миграции
    await client.query(migrationSQL);
    
    // Записываем в таблицу миграций
    await client.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [filename]
    );
    
    await client.query('COMMIT');
    console.log(`✅ Миграция ${filename} выполнена успешно`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Ошибка выполнения миграции ${filename}:`);
    console.error(`   ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

// Проверка безопасности миграции
function checkMigrationSafety(filename) {
  const migrationPath = path.join(__dirname, '..', 'migrations', filename);
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  const dangerousPatterns = [
    /DROP\s+TABLE\s+(?!IF\s+EXISTS)/i,
    /DELETE\s+FROM\s+(?!.*WHERE)/i,
    /TRUNCATE\s+TABLE/i,
    /DROP\s+DATABASE/i,
    /DROP\s+SCHEMA\s+(?!IF\s+EXISTS)/i
  ];
  
  const dangerous = dangerousPatterns.some(pattern => pattern.test(migrationSQL));
  
  if (dangerous) {
    console.warn(`⚠️  ВНИМАНИЕ: Миграция ${filename} содержит потенциально опасные операции!`);
    if (process.env.FORCE_UNSAFE_MIGRATIONS !== 'true') {
      console.error('❌ Установите FORCE_UNSAFE_MIGRATIONS=true для выполнения');
      return false;
    }
  }
  
  return true;
}

// Основная функция
async function main() {
  try {
    console.log('🚀 Запуск системы миграций...\n');
    
    // Проверяем подключение
    const client = await pool.connect();
    console.log('✅ Подключение к базе данных установлено');
    client.release();
    
    // Создаем таблицу миграций
    await createMigrationsTable();
    
    // Получаем списки миграций
    const executedMigrations = await getExecutedMigrations();
    const allMigrationFiles = getMigrationFiles();
    
    // Находим новые миграции
    const pendingMigrations = allMigrationFiles.filter(
      file => !executedMigrations.includes(file)
    );
    
    console.log(`📊 Статус миграций:`);
    console.log(`   ✅ Выполнено: ${executedMigrations.length}`);
    console.log(`   ⏳ Ожидает: ${pendingMigrations.length}`);
    console.log(`   📁 Всего файлов: ${allMigrationFiles.length}\n`);
    
    if (pendingMigrations.length === 0) {
      console.log('🎉 Все миграции уже выполнены!');
      return;
    }
    
    console.log(`📋 Новые миграции для выполнения:`);
    pendingMigrations.forEach(file => console.log(`   📄 ${file}`));
    console.log('');
    
    // Предупреждение для production
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  PRODUCTION РЕЖИМ: Убедитесь, что создали backup!');
      console.log('   Команда: npm run db:backup\n');
    }
    
    // Проверяем безопасность всех миграций
    let allSafe = true;
    for (const migration of pendingMigrations) {
      if (!checkMigrationSafety(migration)) {
        allSafe = false;
      }
    }
    
    if (!allSafe) {
      process.exit(1);
    }
    
    // Выполняем миграции одну за другой
    for (const migration of pendingMigrations) {
      await executeMigration(migration);
    }
    
    console.log('\n🎉 Все миграции выполнены успешно!');
    console.log('💡 Проверьте статус: npm run db:status');
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error.message);
    console.error('🛠️  Проверьте:');
    console.error('   - Подключение к базе данных');
    console.error('   - Синтаксис SQL в файлах миграций');
    console.error('   - Права доступа к базе данных');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Запуск
if (require.main === module) {
  main();
}

module.exports = { main };