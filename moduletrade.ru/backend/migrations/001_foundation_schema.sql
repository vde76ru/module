-- ========================================
-- БАЗА ДАННЫХ MODULETRADE SAAS PLATFORM
-- Миграция: 001_foundation_schema.sql
-- Версия: 2.0 (ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ)
-- ========================================

-- Активируем необходимые расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ========================================
-- БАЗОВЫЕ ТАБЛИЦЫ
-- ========================================

-- Таблица тарифных планов
CREATE TABLE IF NOT EXISTS tariffs (
    id SERIAL PRIMARY KEY,

    -- Основная информация
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Стоимость
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'RUB',
    billing_period VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
    trial_days INTEGER DEFAULT 0,

    -- Ограничения тарифа
    limits JSONB DEFAULT '{}',
    features JSONB DEFAULT '[]',

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_popular BOOLEAN DEFAULT FALSE,

    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN tariffs.trial_days IS 'Количество дней триального периода';
COMMENT ON TABLE tariffs IS 'Тарифные планы для SaaS';

-- Таблица компаний (мультитенантность)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,

    -- Основная информация
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(50),
    domain VARCHAR(100) UNIQUE,

    -- Тарификация
    tariff_id INTEGER REFERENCES tariffs(id),
    subscription_status VARCHAR(20) DEFAULT 'trial',
    plan VARCHAR(50) DEFAULT 'free',

    -- Подписка
    subscription_start_date DATE DEFAULT NOW(),
    subscription_end_date DATE,
    trial_end_date DATE DEFAULT (NOW() + INTERVAL '14 days'),

    -- Интеграции
    stripe_customer_id VARCHAR(255),

    -- Настройки
    settings JSONB DEFAULT '{}',

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE companies IS 'Компании (тенанты) системы';

-- Таблица ролей (RBAC)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,

    -- Основная информация
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Права
    permissions JSONB DEFAULT '[]',

    -- Иерархия
    level INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,

    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'Роли пользователей для RBAC';

-- Таблица разрешений
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,

    -- Основная информация
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Контекст разрешения
    resource VARCHAR(100) NOT NULL, -- products, orders, users, etc
    action VARCHAR(100) NOT NULL,   -- create, read, update, delete, list
    category VARCHAR(100) DEFAULT 'general',

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE permissions IS 'Разрешения для RBAC системы';

-- Связка ролей и разрешений
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(role_id, permission_id)
);

COMMENT ON TABLE role_permissions IS 'Связка ролей и разрешений';

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Основная информация
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    name VARCHAR(512),
    phone VARCHAR(20),

    -- Роли (старая и новая система)
    role VARCHAR(50) DEFAULT 'admin',
    role_id INTEGER REFERENCES roles(id),

    -- Настройки
    settings JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',

    -- Аутентификация
    email_verified BOOLEAN DEFAULT TRUE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,

    -- Активность
    last_login TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, email)
);

COMMENT ON COLUMN users.name IS 'Полное имя пользователя, собранное из first_name и last_name';

-- ========================================
-- ТАБЛИЦА ЛОГОВ (ЕДИНСТВЕННАЯ ПРАВИЛЬНАЯ ВЕРСИЯ)
-- ========================================

CREATE TABLE IF NOT EXISTS logs (
    id BIGSERIAL PRIMARY KEY,

    -- Контекст тенанта
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Уровень и сообщение
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,

    -- Контекст
    module VARCHAR(100), -- auth, products, orders, sync, etc
    action VARCHAR(100), -- login, create_product, sync_orders, etc
    resource_type VARCHAR(100), -- product, order, user, etc
    resource_id VARCHAR(100), -- ID ресурса

    -- Метаданные
    meta JSONB DEFAULT '{}',

    -- HTTP контекст
    request_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,

    -- Время
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE logs IS 'Системные логи для мониторинга и отладки';

-- ========================================
-- УНИВЕРСАЛЬНЫЕ СПРАВОЧНИКИ
-- ========================================

CREATE TABLE IF NOT EXISTS dictionaries (
    id SERIAL PRIMARY KEY,

    -- Тип справочника
    type VARCHAR(50) NOT NULL, -- units, currencies, countries, order_statuses, etc

    -- Код и название
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Иерархия (для древовидных справочников)
    parent_id INTEGER REFERENCES dictionaries(id) ON DELETE CASCADE,
    parent_code VARCHAR(100), -- для быстрого поиска
    level INTEGER DEFAULT 0,

    -- Сортировка и группировка
    sort_order INTEGER DEFAULT 0,
    group_name VARCHAR(100),

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    -- Локализация
    locale_data JSONB DEFAULT '{}', -- переводы для разных языков

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE, -- системная запись (нельзя удалять)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(type, code)
);

COMMENT ON TABLE dictionaries IS 'Универсальный справочник для различных типов данных';

-- ========================================
-- ТАБЛИЦА НАСТРОЕК КОМПАНИЙ
-- ========================================

CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Ключ настройки
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, json

    -- Метаданные настройки
    category VARCHAR(100) DEFAULT 'general',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- доступна ли настройка через API

    -- Версионирование
    version INTEGER DEFAULT 1,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, setting_key)
);

COMMENT ON TABLE company_settings IS 'Настройки компаний';

-- ========================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ========================================

-- Индексы для тарифов
CREATE INDEX IF NOT EXISTS idx_tariffs_code ON tariffs(code);
CREATE INDEX IF NOT EXISTS idx_tariffs_is_active ON tariffs(is_active);
CREATE INDEX IF NOT EXISTS idx_tariffs_price ON tariffs(price);

-- Индексы для компаний
CREATE INDEX IF NOT EXISTS idx_companies_tariff_id ON companies(tariff_id);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer_id ON companies(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_end_date ON companies(subscription_end_date);

-- Индексы для ролей и разрешений
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_is_active ON roles(is_active);
CREATE INDEX IF NOT EXISTS idx_roles_priority ON roles(priority);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_is_active ON permissions(is_active);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Индексы для пользователей
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);

-- Индексы для логов
CREATE INDEX IF NOT EXISTS idx_logs_company_id ON logs(company_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_module ON logs(module);
CREATE INDEX IF NOT EXISTS idx_logs_action ON logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_resource ON logs(resource_type, resource_id);

-- Индексы для справочников
CREATE INDEX IF NOT EXISTS idx_dictionaries_type ON dictionaries(type);
CREATE INDEX IF NOT EXISTS idx_dictionaries_code ON dictionaries(code);
CREATE INDEX IF NOT EXISTS idx_dictionaries_parent_id ON dictionaries(parent_id);
CREATE INDEX IF NOT EXISTS idx_dictionaries_parent_code ON dictionaries(parent_code);
CREATE INDEX IF NOT EXISTS idx_dictionaries_is_active ON dictionaries(is_active);
CREATE INDEX IF NOT EXISTS idx_dictionaries_sort_order ON dictionaries(sort_order);

-- Индексы для настроек компаний
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_key ON company_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_company_settings_category ON company_settings(category);

-- ========================================
-- ФУНКЦИИ И ТРИГГЕРЫ
-- ========================================

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция-триггер для автоматического обновления полного имени
CREATE OR REPLACE FUNCTION update_user_full_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.name := TRIM(BOTH ' ' FROM CONCAT_WS(' ', NEW.first_name, NEW.last_name));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для таблицы users
DROP TRIGGER IF EXISTS trigger_update_user_full_name ON users;
CREATE TRIGGER trigger_update_user_full_name
    BEFORE INSERT OR UPDATE OF first_name, last_name ON users
    FOR EACH ROW EXECUTE FUNCTION update_user_full_name();


-- Триггеры для автоматического обновления updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_tariffs_updated_at') THEN
        CREATE TRIGGER trigger_update_tariffs_updated_at
            BEFORE UPDATE ON tariffs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_companies_updated_at') THEN
        CREATE TRIGGER trigger_update_companies_updated_at
            BEFORE UPDATE ON companies
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_roles_updated_at') THEN
        CREATE TRIGGER trigger_update_roles_updated_at
            BEFORE UPDATE ON roles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_users_updated_at') THEN
        CREATE TRIGGER trigger_update_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_dictionaries_updated_at') THEN
        CREATE TRIGGER trigger_update_dictionaries_updated_at
            BEFORE UPDATE ON dictionaries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_company_settings_updated_at') THEN
        CREATE TRIGGER trigger_update_company_settings_updated_at
            BEFORE UPDATE ON company_settings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Функция для логирования изменений
CREATE OR REPLACE FUNCTION log_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
    company_id_val INTEGER;
    user_id_val INTEGER;
    action_val VARCHAR(20);
    table_name_val VARCHAR(100);
    record_id_val INTEGER;
    record_json JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_val := 'CREATE';
        record_id_val := NEW.id;
        record_json := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        action_val := 'UPDATE';
        record_id_val := NEW.id;
        record_json := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        action_val := 'DELETE';
        record_id_val := OLD.id;
        record_json := to_jsonb(OLD);
    END IF;

    table_name_val := TG_TABLE_NAME;

    IF table_name_val = 'companies' THEN
        company_id_val := record_id_val;
    ELSE
        BEGIN
            IF record_json ? 'company_id' THEN
                company_id_val := (record_json->>'company_id')::INTEGER;
            ELSE
                company_id_val := NULL;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            company_id_val := NULL;
        END;
    END IF;

    BEGIN
        user_id_val := current_setting('app.current_user_id')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        user_id_val := NULL;
    END;

    INSERT INTO logs (
        company_id, user_id, level, message, module, action,
        resource_type, resource_id, meta, timestamp
    ) VALUES (
        company_id_val,
        user_id_val,
        'info',
        format('%s %s %s', action_val, table_name_val, record_id_val),
        'system',
        LOWER(action_val),
        table_name_val,
        record_id_val::TEXT,
        record_json,
        NOW()
    );

    RETURN CASE WHEN action_val = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to log entity changes for table %: %', table_name_val, SQLERRM;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для логирования
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_log_companies_changes') THEN
        CREATE TRIGGER trigger_log_companies_changes
            AFTER INSERT OR UPDATE OR DELETE ON companies
            FOR EACH ROW EXECUTE FUNCTION log_entity_changes();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_log_users_changes') THEN
        CREATE TRIGGER trigger_log_users_changes
            AFTER INSERT OR UPDATE OR DELETE ON users
            FOR EACH ROW EXECUTE FUNCTION log_entity_changes();
    END IF;
END
$$;

-- ========================================
-- ОГРАНИЧЕНИЯ И ПРОВЕРКИ
-- ========================================

ALTER TABLE companies ADD CONSTRAINT check_subscription_status
    CHECK (subscription_status IN ('inactive', 'trial', 'active', 'past_due', 'canceled', 'unpaid'));

ALTER TABLE companies ADD CONSTRAINT check_plan
    CHECK (plan IN ('free', 'starter', 'business', 'premium', 'enterprise'));

ALTER TABLE users ADD CONSTRAINT check_role
    CHECK (role IN ('admin', 'manager', 'user', 'operator', 'viewer'));

ALTER TABLE logs ADD CONSTRAINT check_log_level
    CHECK (level IN ('error', 'warn', 'info', 'debug'));

ALTER TABLE company_settings ADD CONSTRAINT check_setting_type
    CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'array'));

-- ========================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ
-- ========================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 001_foundation_schema.sql completed successfully';
END $$;