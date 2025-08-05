-- ========================================
-- МИГРАЦИЯ 001: БАЗОВАЯ СХЕМА
-- Компании, пользователи, роли, права доступа
-- ========================================

-- Включение необходимых расширений PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ========================================
-- СЛУЖЕБНАЯ ТАБЛИЦА ДЛЯ МИГРАЦИЙ
-- ========================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    checksum VARCHAR(32),
    execution_time_ms INTEGER,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations(filename);

-- ========================================
-- ФУНКЦИЯ ДЛЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ updated_at
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ТАРИФНЫЕ ПЛАНЫ
-- ========================================

CREATE TABLE tariffs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'RUB',
    
    -- Лимиты тарифа
    limits JSONB DEFAULT '{
        "products": null,
        "orders_per_month": null,
        "users": null,
        "warehouses": null,
        "api_calls_per_day": null
    }',
    
    -- Возможности тарифа
    features JSONB DEFAULT '[]',
    
    -- Пробный период
    trial_days INTEGER DEFAULT 14,
    
    -- Статус и порядок
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tariffs_active ON tariffs(active);
CREATE INDEX idx_tariffs_sort_order ON tariffs(sort_order);

-- ========================================
-- КОМПАНИИ (МУЛЬТИТЕНАНТНОСТЬ)
-- ========================================

CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    
    -- Основная информация
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    inn VARCHAR(20),
    kpp VARCHAR(20),
    ogrn VARCHAR(20),
    
    -- Контактная информация
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    
    -- Адрес
    address JSONB DEFAULT '{}',
    
    -- Подписка
    plan VARCHAR(100) DEFAULT 'trial',
    tariff_id INTEGER REFERENCES tariffs(id) ON DELETE SET NULL,
    subscription_status VARCHAR(50) DEFAULT 'trial',
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    trial_end_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
    
    -- Настройки компании
    settings JSONB DEFAULT '{
        "currency": "RUB",
        "timezone": "Europe/Moscow",
        "date_format": "DD.MM.YYYY",
        "number_format": "ru"
    }',
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_companies_inn ON companies(inn);
CREATE INDEX idx_companies_is_active ON companies(is_active);
CREATE INDEX idx_companies_subscription_status ON companies(subscription_status);

-- ========================================
-- РОЛИ ПОЛЬЗОВАТЕЛЕЙ
-- ========================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Системная роль (нельзя удалить)
    is_system BOOLEAN DEFAULT FALSE,
    
    -- Приоритет роли (для разрешения конфликтов)
    priority INTEGER DEFAULT 0,
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_is_active ON roles(is_active);

-- ========================================
-- РАЗРЕШЕНИЯ (PERMISSIONS)
-- ========================================

CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Группировка разрешений
    resource VARCHAR(50), -- products, orders, etc
    action VARCHAR(50), -- view, create, update, delete
    category VARCHAR(50), -- general, admin, etc
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX idx_permissions_category ON permissions(category);

-- ========================================
-- СВЯЗИ РОЛЕЙ И РАЗРЕШЕНИЙ
-- ========================================

CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- ========================================
-- ПОЛЬЗОВАТЕЛИ
-- ========================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    
    -- Привязка к компании
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Основная информация
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Персональные данные
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    name VARCHAR(200) GENERATED ALWAYS AS (
        CASE 
            WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
            THEN CONCAT(first_name, ' ', last_name)
            WHEN first_name IS NOT NULL THEN first_name
            WHEN last_name IS NOT NULL THEN last_name
            ELSE email
        END
    ) STORED,
    phone VARCHAR(50), -- ✅ ИСПРАВЛЕНО: Добавлено поле phone
    
    -- Роль и права - ИСПРАВЛЕННАЯ RBAC СИСТЕМА
    role VARCHAR(50) DEFAULT 'user', -- Поле для обратной совместимости
    role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL, -- ✅ ИСПРАВЛЕНО: Правильная связь с ролями
    
    -- Настройки пользователя
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

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_last_activity ON users(last_activity);

-- ========================================
-- СИСТЕМНЫЕ ЛОГИ
-- ========================================

CREATE TABLE logs (
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

CREATE INDEX idx_logs_company_id ON logs(company_id);
CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_module_action ON logs(module, action);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_resource ON logs(resource_type, resource_id);

-- ========================================
-- УНИВЕРСАЛЬНЫЕ СПРАВОЧНИКИ
-- ========================================

CREATE TABLE dictionaries (
    id SERIAL PRIMARY KEY,
    
    -- Тип справочника
    type VARCHAR(50) NOT NULL, -- units, currencies, countries, etc
    
    -- Значение
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Дополнительные данные
    metadata JSONB DEFAULT '{}',
    
    -- Порядок сортировки
    sort_order INTEGER DEFAULT 0,
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(type, code)
);

CREATE INDEX idx_dictionaries_type ON dictionaries(type);
CREATE INDEX idx_dictionaries_type_active ON dictionaries(type, is_active);
CREATE INDEX idx_dictionaries_sort_order ON dictionaries(type, sort_order);

-- ========================================
-- НАСТРОЙКИ КОМПАНИЙ
-- ========================================

CREATE TABLE company_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, json
    
    -- Категория настройки
    category VARCHAR(100) DEFAULT 'general',
    
    -- Описание
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, setting_key)
);

CREATE INDEX idx_company_settings_company ON company_settings(company_id);
CREATE INDEX idx_company_settings_category ON company_settings(category);

-- ========================================
-- ТРИГГЕРЫ ДЛЯ updated_at
-- ========================================

CREATE TRIGGER trigger_update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_tariffs_updated_at
    BEFORE UPDATE ON tariffs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();