#!/usr/bin/env node

/**
 * Скрипт полной синхронизации базы данных
 * Проверяет и исправляет все несоответствия между миграциями и кодом
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { spawnSync } = require('child_process');

// Конфигурация базы данных (синхронизирована с остальным проектом)
const dbConfig = {
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'saas_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'SecurePostgresPass2025'
};

const pool = new Pool(dbConfig);

class DatabaseSynchronizer {
  constructor() {
    this.migrationsPath = path.join(__dirname, '../migrations');
    this.migrations = [];
  }

  /**
   * Загружает все миграции
   */
  async loadMigrations() {
    try {
      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      console.log('📁 Найдены миграции:', files.length);

      for (const file of files) {
        const filePath = path.join(this.migrationsPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        this.migrations.push({
          name: file,
          path: filePath,
          content
        });
      }

      return true;
    } catch (error) {
      console.error('❌ Ошибка загрузки миграций:', error.message);
      return false;
    }
  }

  /**
   * Проверяет структуру таблицы products
   */
  async checkProductsTable() {
    try {
      const query = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'products'
        ORDER BY ordinal_position
      `;

      const result = await pool.query(query);
      const columns = result.rows;

      console.log('\n📋 Структура таблицы products:');
      console.log('='.repeat(80));

      const requiredFields = [
        'id', 'company_id', 'internal_code', 'name', 'description',
        'brand_id', 'category_id', 'attributes', 'source_type', 'is_active',
        'main_supplier_id', 'base_unit', 'is_divisible', 'min_order_quantity',
        'weight', 'length', 'width', 'height', 'volume', 'dimensions',
        'sku', 'created_at', 'updated_at'
      ];

      const existingFields = columns.map(col => col.column_name);
      const missingFields = requiredFields.filter(field => !existingFields.includes(field));

      if (missingFields.length > 0) {
        console.log('❌ Отсутствующие поля:', missingFields);
        return false;
      } else {
        console.log('✅ Все необходимые поля присутствуют');
      }

      // Проверяем индексы
      const indexQuery = `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'products'
      `;
      const indexResult = await pool.query(indexQuery);
      console.log('\n📊 Индексы таблицы products:', indexResult.rows.length);

      return true;
    } catch (error) {
      console.error('❌ Ошибка проверки таблицы products:', error.message);
      return false;
    }
  }

  /**
   * Проверяет наличие всех необходимых таблиц
   */
  async checkRequiredTables() {
    try {
      const requiredTables = [
        'products', 'brands', 'categories', 'suppliers',
        'marketplaces', 'sync_logs', 'api_logs',
        'companies', 'users', 'roles', 'permissions'
      ];

      const query = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `;
      const result = await pool.query(query);
      const existingTables = result.rows.map(row => row.table_name);

      console.log('\n📊 Проверка необходимых таблиц:');
      console.log('='.repeat(50));

      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        console.log('❌ Отсутствующие таблицы:', missingTables);
        return false;
      } else {
        console.log('✅ Все необходимые таблицы присутствуют');
      }

      return true;
    } catch (error) {
      console.error('❌ Ошибка проверки таблиц:', error.message);
      return false;
    }
  }

  /**
   * Проверяет связи между таблицами
   */
  async checkForeignKeys() {
    try {
      const query = `
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name, kcu.column_name
      `;

      const result = await pool.query(query);
      console.log('\n🔗 Внешние ключи:', result.rows.length);

      return true;
    } catch (error) {
      console.error('❌ Ошибка проверки внешних ключей:', error.message);
      return false;
    }
  }

  /**
   * Применяет все миграции по порядку
   */
  async applyAllMigrations() {
    try {
      console.log('\n📝 Запуск безопасного мигратора (scripts/safe_migrate.js)');
      const result = spawnSync(process.execPath, [path.join(__dirname, 'safe_migrate.js')], {
        stdio: 'inherit',
        env: {
          ...process.env,
          DB_HOST: dbConfig.host,
          DB_PORT: String(dbConfig.port),
          DB_NAME: dbConfig.database,
          DB_USER: dbConfig.user,
          DB_PASSWORD: dbConfig.password,
        },
      });

      if (result.status !== 0) {
        console.error('❌ Безопасный мигратор завершился с ошибкой');
        return false;
      }

      console.log('✅ Все миграции применены успешно');
      return true;
    } catch (error) {
      console.error('❌ Ошибка применения миграций:', error.message);
      return false;
    }
  }

  /**
   * Проверяет данные в таблицах
   */
  async checkData() {
    try {
      console.log('\n📊 Проверка данных в таблицах:');
      console.log('='.repeat(50));

      const checks = [
        { table: 'products', query: 'SELECT COUNT(*) as count FROM products' },
        { table: 'marketplaces', query: 'SELECT COUNT(*) as count FROM marketplaces' },
        { table: 'sync_logs', query: 'SELECT COUNT(*) as count FROM sync_logs' },
        { table: 'api_logs', query: 'SELECT COUNT(*) as count FROM api_logs' },
        { table: 'roles', query: 'SELECT COUNT(*) as count FROM roles' },
        { table: 'permissions', query: 'SELECT COUNT(*) as count FROM permissions' }
      ];

      for (const check of checks) {
        try {
          const result = await pool.query(check.query);
          const count = result.rows[0].count;
          console.log(`📋 ${check.table}: ${count} записей`);
        } catch (error) {
          console.log(`❌ ${check.table}: ошибка - ${error.message}`);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Ошибка проверки данных:', error.message);
      return false;
    }
  }

  /**
   * Основной метод синхронизации
   */
  async synchronize() {
    console.log('🚀 Запуск полной синхронизации базы данных...');
    console.log('='.repeat(60));

    try {
      // 1. Загружаем миграции
      if (!(await this.loadMigrations())) {
        return false;
      }

      // 2. Применяем все миграции
      if (!(await this.applyAllMigrations())) {
        return false;
      }

      // 3. Проверяем необходимые таблицы
      if (!(await this.checkRequiredTables())) {
        return false;
      }

      // 4. Проверяем структуру products
      if (!(await this.checkProductsTable())) {
        return false;
      }

      // 5. Проверяем внешние ключи
      if (!(await this.checkForeignKeys())) {
        return false;
      }

      // 6. Проверяем данные
      if (!(await this.checkData())) {
        return false;
      }

      console.log('\n🎉 Синхронизация завершена успешно!');
      console.log('✅ База данных полностью синхронизирована с кодом');
      
      return true;
    } catch (error) {
      console.error('❌ Критическая ошибка синхронизации:', error.message);
      return false;
    } finally {
      await pool.end();
    }
  }
}

// Запуск синхронизации
async function main() {
  const synchronizer = new DatabaseSynchronizer();
  const success = await synchronizer.synchronize();
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Неожиданная ошибка:', error);
    process.exit(1);
  });
}

module.exports = DatabaseSynchronizer; 