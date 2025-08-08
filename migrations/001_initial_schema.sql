-- ================================================================
-- МИГРАЦИЯ 001: Базовая структура системы ModuleTrade
-- Описание: Создает базовые таблицы и функции для системы
-- Дата: 2025-01-27
-- Блок: Базовая структура
-- Зависимости: Нет
-- ================================================================

-- Включаем необходимые расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- ТАБЛИЦА: Roles - Роли пользователей
-- ================================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}'::jsonb,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE roles IS 'Роли пользователей в системе';
COMMENT ON COLUMN roles.name IS 'Название роли';
COMMENT ON COLUMN roles.code IS 'Код роли';
COMMENT ON COLUMN roles.description IS 'Описание роли';
COMMENT ON COLUMN roles.permissions IS 'Разрешения роли в JSON формате';
COMMENT ON COLUMN roles.is_system IS 'Системная ли роль';
COMMENT ON COLUMN roles.is_active IS 'Активна ли роль';

CREATE INDEX idx_roles_code ON roles (code);
CREATE INDEX idx_roles_is_system ON roles (is_system);
CREATE INDEX idx_roles_is_active ON roles (is_active);

-- ================================================================
-- ТАБЛИЦА: Tariffs - Тарифные планы
-- ================================================================
CREATE TABLE tariffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    period_type VARCHAR(20) DEFAULT 'monthly'
        CHECK (period_type IN ('monthly', 'yearly', 'trial')),
    limits JSONB DEFAULT '{}'::jsonb,
    features JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    is_popular BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE tariffs IS 'Тарифные планы для компаний';
COMMENT ON COLUMN tariffs.name IS 'Название тарифа';
COMMENT ON COLUMN tariffs.code IS 'Код тарифа';
COMMENT ON COLUMN tariffs.description IS 'Описание тарифа';
COMMENT ON COLUMN tariffs.price IS 'Цена тарифа';
COMMENT ON COLUMN tariffs.currency IS 'Валюта тарифа';
COMMENT ON COLUMN tariffs.period_type IS 'Тип периода: monthly, yearly, trial';
COMMENT ON COLUMN tariffs.limits IS 'Лимиты тарифа в JSON формате';
COMMENT ON COLUMN tariffs.features IS 'Возможности тарифа в JSON формате';
COMMENT ON COLUMN tariffs.is_active IS 'Активен ли тариф';
COMMENT ON COLUMN tariffs.is_popular IS 'Популярный ли тариф';
COMMENT ON COLUMN tariffs.sort_order IS 'Порядок сортировки';

CREATE INDEX idx_tariffs_code ON tariffs (code);
CREATE INDEX idx_tariffs_is_active ON tariffs (is_active);
CREATE INDEX idx_tariffs_is_popular ON tariffs (is_popular);
CREATE INDEX idx_tariffs_sort_order ON tariffs (sort_order);

-- ================================================================
-- ТАБЛИЦА: Brands - Бренды товаров с ценовой политикой
-- ================================================================
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    description TEXT,
    logo_url VARCHAR(500),
    website VARCHAR(255),
    
    -- Ценовая политика бренда
    mrp_price DECIMAL(12,2), -- Минимальная розничная цена
    rrp_price DECIMAL(12,2), -- Рекомендуемая розничная цена
    enforce_mrp BOOLEAN DEFAULT FALSE, -- Обязательно соблюдать МРЦ
    enforce_rrp BOOLEAN DEFAULT FALSE, -- Обязательно соблюдать РРЦ
    wholesale_markup DECIMAL(5,2), -- Наценка для оптовой цены (%)
    retail_markup DECIMAL(5,2), -- Наценка для розничной цены (%)
    website_markup DECIMAL(5,2), -- Наценка для сайта (%)
    marketplace_markup DECIMAL(5,2), -- Наценка для маркетплейсов (%)
    
    -- Дополнительные настройки
    price_policy JSONB DEFAULT '{}'::jsonb, -- Дополнительные правила ценообразования
    supplier_discounts JSONB DEFAULT '{}'::jsonb, -- Скидки от поставщиков для бренда
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE brands IS 'Бренды товаров с настройками ценовой политики';
COMMENT ON COLUMN brands.company_id IS 'Компания-владелец бренда';
COMMENT ON COLUMN brands.name IS 'Название бренда';
COMMENT ON COLUMN brands.code IS 'Код бренда';
COMMENT ON COLUMN brands.description IS 'Описание бренда';
COMMENT ON COLUMN brands.logo_url IS 'URL логотипа бренда';
COMMENT ON COLUMN brands.website IS 'Веб-сайт бренда';
COMMENT ON COLUMN brands.mrp_price IS 'Минимальная розничная цена';
COMMENT ON COLUMN brands.rrp_price IS 'Рекомендуемая розничная цена';
COMMENT ON COLUMN brands.enforce_mrp IS 'Обязательно соблюдать МРЦ';
COMMENT ON COLUMN brands.enforce_rrp IS 'Обязательно соблюдать РРЦ';
COMMENT ON COLUMN brands.wholesale_markup IS 'Наценка для оптовой цены (%)';
COMMENT ON COLUMN brands.retail_markup IS 'Наценка для розничной цены (%)';
COMMENT ON COLUMN brands.website_markup IS 'Наценка для сайта (%)';
COMMENT ON COLUMN brands.marketplace_markup IS 'Наценка для маркетплейсов (%)';
COMMENT ON COLUMN brands.price_policy IS 'Дополнительные правила ценообразования';
COMMENT ON COLUMN brands.supplier_discounts IS 'Скидки от поставщиков для бренда';
COMMENT ON COLUMN brands.is_active IS 'Активен ли бренд';

ALTER TABLE brands ADD CONSTRAINT brands_name_unique_per_company
    UNIQUE (company_id, name);
ALTER TABLE brands ADD CONSTRAINT brands_code_unique_per_company
    UNIQUE (company_id, code);

CREATE INDEX idx_brands_company_id ON brands (company_id);
CREATE INDEX idx_brands_name ON brands (name);
CREATE INDEX idx_brands_code ON brands (code);
CREATE INDEX idx_brands_is_active ON brands (is_active);
CREATE INDEX idx_brands_mrp_price ON brands (mrp_price);
CREATE INDEX idx_brands_rrp_price ON brands (rrp_price);

-- ================================================================
-- ТАБЛИЦА: Categories - Категории товаров
-- ================================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    description TEXT,
    parent_id UUID,
    level INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_categories_parent_id
        FOREIGN KEY (parent_id) REFERENCES categories(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE categories IS 'Категории товаров';
COMMENT ON COLUMN categories.company_id IS 'Компания-владелец категории';
COMMENT ON COLUMN categories.name IS 'Название категории';
COMMENT ON COLUMN categories.code IS 'Код категории';
COMMENT ON COLUMN categories.description IS 'Описание категории';
COMMENT ON COLUMN categories.parent_id IS 'Родительская категория';
COMMENT ON COLUMN categories.level IS 'Уровень вложенности';
COMMENT ON COLUMN categories.sort_order IS 'Порядок сортировки';
COMMENT ON COLUMN categories.is_active IS 'Активна ли категория';

ALTER TABLE categories ADD CONSTRAINT categories_name_unique_per_company
    UNIQUE (company_id, name);
ALTER TABLE categories ADD CONSTRAINT categories_code_unique_per_company
    UNIQUE (company_id, code);

CREATE INDEX idx_categories_company_id ON categories (company_id);
CREATE INDEX idx_categories_parent_id ON categories (parent_id);
CREATE INDEX idx_categories_level ON categories (level);
CREATE INDEX idx_categories_sort_order ON categories (sort_order);
CREATE INDEX idx_categories_is_active ON categories (is_active);

-- ================================================================
-- ФУНКЦИИ
-- ================================================================

-- Функция для обновления поля updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для генерации уникального кода
CREATE OR REPLACE FUNCTION generate_unique_code(
    p_table_name VARCHAR,
    p_code_column VARCHAR,
    p_prefix VARCHAR DEFAULT '',
    p_length INTEGER DEFAULT 8
) RETURNS VARCHAR AS $$
DECLARE
    v_code VARCHAR;
    v_counter INTEGER := 0;
    v_max_attempts INTEGER := 100;
BEGIN
    LOOP
        -- Генерируем код
        v_code := p_prefix || upper(substring(md5(random()::text) from 1 for p_length));

        -- Проверяем уникальность
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE %I = $1', p_table_name, p_code_column)
        INTO v_counter
        USING v_code;

        -- Если код уникален, возвращаем его
        IF v_counter = 0 THEN
            RETURN v_code;
        END IF;

        -- Защита от бесконечного цикла
        v_counter := v_counter + 1;
        IF v_counter > v_max_attempts THEN
            RAISE EXCEPTION 'Не удалось сгенерировать уникальный код после % попыток', v_max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tariffs_updated_at
    BEFORE UPDATE ON tariffs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brands_updated_at
    BEFORE UPDATE ON brands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ
-- ================================================================

-- Создаем системные роли
INSERT INTO roles (name, code, description, permissions, is_system) VALUES
('Владелец', 'owner', 'Полный доступ ко всем функциям системы', '{"*": "*"}', true),
('Администратор', 'admin', 'Администратор системы', '{"*": ["read", "write"]}', true),
('Менеджер', 'manager', 'Менеджер с расширенными правами', '{"products": "*", "orders": "*", "warehouses": "*"}', true),
('Оператор', 'operator', 'Оператор с базовыми правами', '{"products": ["read", "write"], "orders": ["read", "write"]}', true),
('Аналитик', 'analyst', 'Аналитик с правами на просмотр', '{"*": ["read"]}', true);

-- Создаем базовые тарифы
INSERT INTO tariffs (name, code, description, price, period_type, limits, features, is_popular, sort_order) VALUES
('Старт', 'start', 'Базовый тариф для небольших компаний', 0.00, 'monthly',
 '{"users": 3, "products": 100, "suppliers": 2, "marketplaces": 1}',
 '{"basic_features": true, "support": "email"}', false, 1),
('Бизнес', 'business', 'Тариф для растущего бизнеса', 2990.00, 'monthly',
 '{"users": 10, "products": 1000, "suppliers": 5, "marketplaces": 3}',
 '{"basic_features": true, "advanced_features": true, "support": "email_phone"}', true, 2),
('Профессионал', 'professional', 'Тариф для крупных компаний', 5990.00, 'monthly',
 '{"users": 50, "products": 10000, "suppliers": 20, "marketplaces": 10}',
 '{"basic_features": true, "advanced_features": true, "premium_features": true, "support": "priority"}', false, 3),
('Корпоративный', 'enterprise', 'Индивидуальные решения', 0.00, 'monthly',
 '{"users": -1, "products": -1, "suppliers": -1, "marketplaces": -1}',
 '{"basic_features": true, "advanced_features": true, "premium_features": true, "custom_features": true, "support": "dedicated"}', false, 4);

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 001
-- ================================================================