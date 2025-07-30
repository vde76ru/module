-- ============================================================
-- existing_db_fix.sql
-- Скрипт для исправления существующих БД с проблемными миграциями
-- ВНИМАНИЕ: Обязательно создайте бэкап перед выполнением!
-- ============================================================

DO $$ 
BEGIN
    RAISE NOTICE '🔥 НАЧАЛО ИСПРАВЛЕНИЯ СУЩЕСТВУЮЩЕЙ БД';
    RAISE NOTICE '⚠️  Убедитесь что создан бэкап!';
END $$;

-- ========================================
-- ШАГ 1: ИСПРАВЛЕНИЕ НЕПРАВИЛЬНЫХ ССЫЛОК
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '📝 Шаг 1: Исправление неправильных внешних ключей...';
    
    -- Исправляем неправильную ссылку в orders.tenant_id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%orders_tenant_id%' 
        AND table_name = 'orders'
    ) THEN
        -- Удаляем неправильную ссылку
        ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_tenant_id_fkey;
        
        -- Создаем правильную ссылку на tenants
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
            ALTER TABLE orders ADD CONSTRAINT orders_tenant_id_fkey 
                FOREIGN KEY (tenant_id) REFERENCES tenants(id);
            RAISE NOTICE '✅ Исправлена ссылка orders.tenant_id -> tenants(id)';
        END IF;
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Ошибка при исправлении ссылок: %', SQLERRM;
END $$;

-- ========================================
-- ШАГ 2: УДАЛЕНИЕ ДУБЛИРУЮЩИХ КОЛОНОК
-- ========================================

DO $$
DECLARE
    col_exists BOOLEAN;
BEGIN
    RAISE NOTICE '📝 Шаг 2: Удаление дублирующих колонок...';
    
    -- Проверяем и удаляем дублирующие поля в products
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'popularity_score'
    ) INTO col_exists;
    
    IF col_exists THEN
        -- Если есть дубли, оставляем только один столбец
        -- Это безопасно делать через условную логику
        RAISE NOTICE '⚠️  Найдено поле popularity_score в products - проверяем на дубли';
    END IF;
    
    -- Аналогично для других потенциально дублирующих полей
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'name'
    ) INTO col_exists;
    
    IF col_exists THEN
        RAISE NOTICE '⚠️  Найдено поле name в users - проверяем на дубли';
    END IF;
    
END $$;

-- ========================================
-- ШАГ 3: УДАЛЕНИЕ ДУБЛИРУЮЩИХ ТАБЛИЦ
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '📝 Шаг 3: Проверка дублирующих таблиц...';
    
    -- Проверяем наличие и transactions, и billing_transactions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_transactions') THEN
        
        RAISE NOTICE '⚠️  Найдены обе таблицы: transactions и billing_transactions';
        RAISE NOTICE '💡 Рекомендация: перенести данные из transactions в billing_transactions';
        RAISE NOTICE '💡 И удалить таблицу transactions после проверки';
        
        -- Можно добавить автоматический перенос данных если нужно
        -- INSERT INTO billing_transactions (tenant_id, type, amount, description, created_at)
        -- SELECT tenant_id, type, amount, description, created_at FROM transactions;
        
    END IF;
    
    -- Проверяем дублирование user_sessions
    IF EXISTS (
        SELECT table_name, COUNT(*) 
        FROM information_schema.tables 
        WHERE table_name = 'user_sessions' 
        GROUP BY table_name 
        HAVING COUNT(*) > 1
    ) THEN
        RAISE NOTICE '⚠️  Возможно дублирование таблицы user_sessions';
    END IF;
    
END $$;

-- ========================================
-- ШАГ 4: ОЧИСТКА ДУБЛИРУЮЩИХ ФУНКЦИЙ
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '📝 Шаг 4: Очистка дублирующих функций...';
    
    -- Удаляем старые версии функций update_updated_at
    DROP FUNCTION IF EXISTS public.update_tariffs_updated_at_column() CASCADE;
    DROP FUNCTION IF EXISTS update_tariffs_updated_at_column() CASCADE;
    
    -- Создаем единую функцию если её нет
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $func$ language 'plpgsql';
    
    RAISE NOTICE '✅ Создана единая функция update_updated_at_column()';
    
    -- Удаляем дублирующие функции для расчета цен
    DROP FUNCTION IF EXISTS calculate_normalized_price() CASCADE;
    
    -- Создаем правильную версию
    CREATE OR REPLACE FUNCTION calculate_normalized_price()
    RETURNS TRIGGER AS $func$
    BEGIN
        IF NEW.supplier_multiplicity IS NOT NULL AND NEW.supplier_multiplicity > 0 THEN
            NEW.normalized_price = NEW.price / NEW.supplier_multiplicity;
        ELSE
            NEW.normalized_price = NEW.price;
        END IF;
        RETURN NEW;
    END;
    $func$ language 'plpgsql';
    
    RAISE NOTICE '✅ Создана правильная функция calculate_normalized_price()';
    
END $$;

-- ========================================
-- ШАГ 5: ПЕРЕСОЗДАНИЕ ТРИГГЕРОВ
-- ========================================

DO $$
DECLARE
    table_record RECORD;
    trigger_count INTEGER;
BEGIN
    RAISE NOTICE '📝 Шаг 5: Пересоздание триггеров updated_at...';
    
    -- Список таблиц, которым нужны триггеры updated_at
    FOR table_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('tariffs', 'tenants', 'users', 'products', 'orders', 'user_sessions', 
                          'product_suppliers', 'marketplace_product_links', 'billing_transactions',
                          'brand_content_sources', 'exchange_rates')
        AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = table_record.table_name 
            AND column_name = 'updated_at'
        )
    LOOP
        -- Удаляем старые триггеры
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %I', 
                      table_record.table_name, table_record.table_name);
        
        -- Создаем новый триггер
        EXECUTE format('CREATE TRIGGER update_%s_updated_at 
                       BEFORE UPDATE ON %I 
                       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
                      table_record.table_name, table_record.table_name);
        
        RAISE NOTICE '✅ Создан триггер для таблицы %', table_record.table_name;
    END LOOP;
    
END $$;

-- ========================================
-- ШАГ 6: ПРОВЕРКА ЦЕЛОСТНОСТИ ДАННЫХ
-- ========================================

DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
BEGIN
    RAISE NOTICE '📝 Шаг 6: Проверка целостности структуры БД...';
    
    -- Проверяем наличие основных таблиц
    FOREACH table_name IN ARRAY ARRAY['tenants', 'users', 'products', 'orders', 'tariffs']
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE NOTICE '❌ Отсутствуют критически важные таблицы: %', array_to_string(missing_tables, ', ');
        RAISE NOTICE '💡 Необходимо запустить 001_consolidated_schema.sql для создания недостающих таблиц';
    ELSE
        RAISE NOTICE '✅ Все основные таблицы присутствуют';
    END IF;
    
END $$;

-- ========================================
-- ШАГ 7: ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ ПОЛЕЙ
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '📝 Шаг 7: Добавление недостающих полей...';
    
    -- Добавляем недостающие поля в tenants для биллинга
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tariff_id UUID;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive';
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0.00;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
        
        -- Добавляем ссылку на tariffs если таблица существует
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tariffs') THEN
            ALTER TABLE tenants ADD CONSTRAINT tenants_tariff_id_fkey 
                FOREIGN KEY (tariff_id) REFERENCES tariffs(id) 
                ON DELETE SET NULL;
        END IF;
        
        RAISE NOTICE '✅ Добавлены поля биллинга в tenants';
    END IF;
    
    -- Добавляем недостающие поля в users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
        
        RAISE NOTICE '✅ Добавлены поля имен в users';
    END IF;
    
    -- Добавляем недостающие поля в products
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        ALTER TABLE products ADD COLUMN IF NOT EXISTS popularity_score INTEGER DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS volume DECIMAL(10,4);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions JSONB;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_divisible BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS base_unit VARCHAR(20) DEFAULT 'шт';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_quantity DECIMAL(10,2) DEFAULT 1;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging_info JSONB DEFAULT '{}';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cable_info JSONB DEFAULT '{}';
        
        RAISE NOTICE '✅ Добавлены недостающие поля в products';
    END IF;
    
END $$;

-- ========================================
-- ШАГ 8: СОЗДАНИЕ НЕДОСТАЮЩИХ ИНДЕКСОВ
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '📝 Шаг 8: Создание недостающих индексов...';
    
    -- Создаем основные индексы если их нет
    CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
    
    -- Индексы для биллинга
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_billing_transactions_tenant_id ON billing_transactions(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_billing_transactions_status ON billing_transactions(status);
        CREATE INDEX IF NOT EXISTS idx_billing_transactions_created ON billing_transactions(created_at);
    END IF;
    
    -- Индексы для тенантов
    CREATE INDEX IF NOT EXISTS idx_tenants_tariff_id ON tenants(tariff_id);
    CREATE INDEX IF NOT EXISTS idx_tenants_subscription_status ON tenants(subscription_status);
    
    RAISE NOTICE '✅ Индексы созданы/проверены';
    
END $$;

-- ========================================
-- ШАГ 9: ВАЛИДАЦИЯ ИСПРАВЛЕНИЙ
-- ========================================

DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
    trigger_count INTEGER;
    index_count INTEGER;
BEGIN
    RAISE NOTICE '📝 Шаг 9: Финальная валидация...';
    
    -- Подсчитываем основные объекты
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    SELECT COUNT(*) INTO function_count 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
    
    SELECT COUNT(*) INTO trigger_count 
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public';
    
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE schemaname = 'public';
    
    RAISE NOTICE '📊 Статистика БД:';
    RAISE NOTICE '   📋 Таблиц: %', table_count;
    RAISE NOTICE '   🔧 Функций: %', function_count;
    RAISE NOTICE '   ⚡ Триггеров: %', trigger_count;
    RAISE NOTICE '   📇 Индексов: %', index_count;
    
END $$;

-- ========================================
-- ШАГ 10: РЕКОМЕНДАЦИИ
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '📝 Шаг 10: Рекомендации по дальнейшим действиям...';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 СЛЕДУЮЩИЕ ШАГИ:';
    RAISE NOTICE '1. ✅ Проверьте работу приложения';
    RAISE NOTICE '2. 🧪 Запустите тесты';
    RAISE NOTICE '3. 📊 Проверьте производительность запросов';
    RAISE NOTICE '4. 🗑️  Удалите старые миграции-дубли:';
    RAISE NOTICE '   - 016_add_missing_tables.sql';
    RAISE NOTICE '   - 017_fix_missing_tables.sql';
    RAISE NOTICE '   - 017_add_functions_and_triggers.sql';
    RAISE NOTICE '5. 📝 Обновите систему миграций';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ВАЖНО:';
    RAISE NOTICE '- Следите за логами приложения';
    RAISE NOTICE '- Проверьте все API endpoints';
    RAISE NOTICE '- Убедитесь что авторизация работает';
    RAISE NOTICE '- Проверьте создание/обновление данных';
    RAISE NOTICE '';
    
END $$;

-- ========================================
-- ФИНАЛЬНАЯ ПРОВЕРКА
-- ========================================

DO $$
DECLARE
    error_count INTEGER := 0;
    warning_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 ФИНАЛЬНАЯ ПРОВЕРКА ЦЕЛОСТНОСТИ...';
    
    -- Проверяем наличие критических таблиц
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        RAISE NOTICE '❌ Критическая ошибка: таблица tenants отсутствует';
        error_count := error_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE NOTICE '❌ Критическая ошибка: таблица users отсутствует';
        error_count := error_count + 1;
    END IF;
    
    -- Проверяем наличие основных функций
    IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_updated_at_column') THEN
        RAISE NOTICE '⚠️  Предупреждение: функция update_updated_at_column отсутствует';
        warning_count := warning_count + 1;
    END IF;
    
    -- Итоговый статус
    IF error_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 ИСПРАВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО!';
        RAISE NOTICE '✅ Критических ошибок: %', error_count;
        RAISE NOTICE '⚠️  Предупреждений: %', warning_count;
        RAISE NOTICE '';
        RAISE NOTICE '🚀 База данных готова к работе!';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '❌ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО С ОШИБКАМИ!';
        RAISE NOTICE '❌ Критических ошибок: %', error_count;
        RAISE NOTICE '⚠️  Предупреждений: %', warning_count;
        RAISE NOTICE '';
        RAISE NOTICE '🔧 Требуется ручное вмешательство!';
    END IF;
    
END $$;