-- ================================================================
-- МИГРАЦИЯ 001: Базовая схема системы
-- Описание: Создает базовую структуру с расширениями, ролями и тарифами
-- Дата: 2025-01-27
-- Блок: Базовая система
-- ================================================================

-- Включаем необходимые расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ================================================================
-- ТАБЛИЦА: Roles - Справочник ролей пользователей
-- ================================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    permissions JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE roles IS 'Справочник ролей пользователей для управления правами доступа';
COMMENT ON COLUMN roles.name IS 'Название роли (например, "Администратор", "Менеджер")';
COMMENT ON COLUMN roles.permissions IS 'JSON-объект с правами доступа для данной роли';
COMMENT ON COLUMN roles.description IS 'Подробное описание роли и её полномочий';
COMMENT ON COLUMN roles.is_system IS 'Системная роль - нельзя удалить или изменить основные права';

CREATE INDEX idx_roles_name ON roles (name);
CREATE INDEX idx_roles_is_system ON roles (is_system);

-- ================================================================
-- ТАБЛИЦА: Tariffs - Справочник тарифных планов
-- ================================================================
CREATE TABLE tariffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) DEFAULT 0.00,
    price_yearly DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'RUB',
    billing_period VARCHAR(20) DEFAULT 'monthly',
    limits JSONB NOT NULL DEFAULT '{}',
    features JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE tariffs IS 'Справочник тарифных планов для SaaS-платформы';
COMMENT ON COLUMN tariffs.name IS 'Название тарифа (например, "Базовый", "Продвинутый")';
COMMENT ON COLUMN tariffs.description IS 'Описание тарифа и его возможностей';
COMMENT ON COLUMN tariffs.price_monthly IS 'Цена за месяц в рублях';
COMMENT ON COLUMN tariffs.price_yearly IS 'Цена за год в рублях (обычно со скидкой)';
COMMENT ON COLUMN tariffs.currency IS 'Валюта тарифа';
COMMENT ON COLUMN tariffs.billing_period IS 'Период биллинга';
COMMENT ON COLUMN tariffs.limits IS 'Ограничения тарифа: количество товаров, пользователей, интеграций и т.д.';
COMMENT ON COLUMN tariffs.features IS 'Возможности тарифа';
COMMENT ON COLUMN tariffs.is_active IS 'Активен ли тариф для выбора новыми клиентами';
COMMENT ON COLUMN tariffs.sort_order IS 'Порядок сортировки тарифов в списке (меньше = выше)';

CREATE INDEX idx_tariffs_name ON tariffs (name);
CREATE INDEX idx_tariffs_is_active ON tariffs (is_active);
CREATE INDEX idx_tariffs_sort_order ON tariffs (sort_order);
CREATE INDEX idx_tariffs_price_monthly ON tariffs (price_monthly);

-- ================================================================
-- ФУНКЦИЯ для автоматического обновления updated_at
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автообновления updated_at
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tariffs_updated_at
    BEFORE UPDATE ON tariffs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- БАЗОВЫЕ РОЛИ СИСТЕМЫ
-- ================================================================
INSERT INTO roles (id, name, description, permissions, is_system, created_at, updated_at) VALUES

-- Владелец - полные права
('00000000-0000-0000-0000-000000000001',
 'Владелец',
 'Владелец компании с полными правами доступа ко всем функциям системы',
 '{"all": true}'::jsonb,
 true,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Администратор - почти все права
('00000000-0000-0000-0000-000000000002',
 'Администратор',
 'Администратор с правами управления пользователями и основными функциями',
 '{
   "users": ["read", "write", "delete"],
   "products": ["read", "write", "delete"],
   "orders": ["read", "write", "update_status"],
   "warehouses": ["read", "write"],
   "integrations": ["read", "write"],
   "reports": ["read", "export"],
   "settings": ["read", "write"]
 }'::jsonb,
 true,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Менеджер контента - управление товарами и категориями
('00000000-0000-0000-0000-000000000003',
 'Менеджер контента',
 'Специалист по управлению товарами, категориями и контентом',
 '{
   "products": ["read", "write", "delete"],
   "categories": ["read", "write", "delete"],
   "brands": ["read", "write", "delete"],
   "media": ["read", "write", "delete"],
   "suppliers": ["read"],
   "reports": ["read"]
 }'::jsonb,
 true,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Менеджер склада - управление остатками и заказами
('00000000-0000-0000-0000-000000000004',
 'Менеджер склада',
 'Специалист по управлению складскими операциями и обработке заказов',
 '{
   "products": ["read"],
   "warehouses": ["read", "write"],
   "stocks": ["read", "write"],
   "orders": ["read", "write", "update_status"],
   "order_items": ["read", "write"],
   "reports": ["read"]
 }'::jsonb,
 true,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Менеджер продаж - работа с заказами и клиентами
('00000000-0000-0000-0000-000000000005',
 'Менеджер продаж',
 'Специалист по работе с заказами и взаимодействию с клиентами',
 '{
   "products": ["read"],
   "orders": ["read", "write", "update_status"],
   "order_items": ["read"],
   "customers": ["read", "write"],
   "reports": ["read"],
   "marketplaces": ["read"]
 }'::jsonb,
 true,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Оператор - базовые права просмотра и обработки заказов
('00000000-0000-0000-0000-000000000006',
 'Оператор',
 'Оператор с базовыми правами для обработки заказов',
 '{
   "products": ["read"],
   "orders": ["read", "update_status"],
   "order_items": ["read"],
   "warehouses": ["read"],
   "stocks": ["read"]
 }'::jsonb,
 true,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Только просмотр - права только на чтение
('00000000-0000-0000-0000-000000000007',
 'Только просмотр',
 'Роль с правами только на просмотр данных без возможности изменений',
 '{
   "products": ["read"],
   "orders": ["read"],
   "warehouses": ["read"],
   "stocks": ["read"],
   "reports": ["read"]
 }'::jsonb,
 true,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- БАЗОВЫЕ ТАРИФНЫЕ ПЛАНЫ
-- ================================================================
INSERT INTO tariffs (id, name, description, price_monthly, price_yearly, limits, is_active, sort_order) VALUES

-- Пробный тариф
(uuid_generate_v4(),
 'Пробный',
 'Бесплатный тариф для знакомства с системой на 14 дней',
 0.00,
 0.00,
 '{
   "products": 50,
   "users": 1,
   "warehouses": 1,
   "marketplaces": 1,
   "suppliers": 2,
   "orders_per_month": 100,
   "api_calls_per_day": 1000,
   "storage_gb": 1,
   "support": "email"
 }'::jsonb,
 true,
 1),

-- Стартер
(uuid_generate_v4(),
 'Стартер',
 'Оптимальный тариф для малого бизнеса до 1000 товаров',
 2990.00,
 29900.00,
 '{
   "products": 1000,
   "users": 3,
   "warehouses": 3,
   "marketplaces": 3,
   "suppliers": 5,
   "orders_per_month": 500,
   "api_calls_per_day": 5000,
   "storage_gb": 5,
   "support": "email"
 }'::jsonb,
 true,
 2),

-- Бизнес
(uuid_generate_v4(),
 'Бизнес',
 'Профессиональный тариф для растущего бизнеса до 5000 товаров',
 5990.00,
 59900.00,
 '{
   "products": 5000,
   "users": 10,
   "warehouses": 10,
   "marketplaces": 10,
   "suppliers": 15,
   "orders_per_month": 2000,
   "api_calls_per_day": 20000,
   "storage_gb": 20,
   "support": "email+chat"
 }'::jsonb,
 true,
 3),

-- Профессионал
(uuid_generate_v4(),
 'Профессионал',
 'Расширенный тариф для крупного бизнеса до 25000 товаров',
 12990.00,
 129900.00,
 '{
   "products": 25000,
   "users": 25,
   "warehouses": 25,
   "marketplaces": 25,
   "suppliers": 50,
   "orders_per_month": 10000,
   "api_calls_per_day": 100000,
   "storage_gb": 100,
   "support": "priority"
 }'::jsonb,
 true,
 4),

-- Энтерпрайз
(uuid_generate_v4(),
 'Энтерпрайз',
 'Максимальный тариф для крупных компаний с неограниченными возможностями',
 29990.00,
 299900.00,
 '{
   "products": 100000,
   "users": 100,
   "warehouses": 100,
   "marketplaces": 100,
   "suppliers": 200,
   "orders_per_month": 50000,
   "api_calls_per_day": 1000000,
   "storage_gb": 1000,
   "support": "dedicated",
   "custom_integrations": true,
   "dedicated_support": true
 }'::jsonb,
 true,
 5);

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 001
-- ================================================================