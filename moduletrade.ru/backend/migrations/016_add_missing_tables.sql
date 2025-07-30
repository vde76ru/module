-- 014_add_missing_tables.sql
-- Добавление недостающих таблиц

-- Таблица сессий пользователей
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id_unique ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (refresh_token);

COMMENT ON TABLE user_sessions IS 'Сессии пользователей для refresh токенов';
COMMENT ON COLUMN user_sessions.id IS 'Уникальный идентификатор сессии';
COMMENT ON COLUMN user_sessions.user_id IS 'ID пользователя';
COMMENT ON COLUMN user_sessions.refresh_token IS 'Refresh токен для обновления access токена';
COMMENT ON COLUMN user_sessions.expires_at IS 'Время истечения токена';
COMMENT ON COLUMN user_sessions.created_at IS 'Время создания сессии';
COMMENT ON COLUMN user_sessions.updated_at IS 'Время последнего обновления сессии';

-- Таблица переопределений закупок
CREATE TABLE IF NOT EXISTS procurement_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    order_item_id UUID NOT NULL,
    reason VARCHAR(100) NOT NULL,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    expires_at TIMESTAMP,
    UNIQUE(tenant_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_procurement_overrides_tenant ON procurement_overrides (tenant_id);
CREATE INDEX IF NOT EXISTS idx_procurement_overrides_expires ON procurement_overrides (expires_at);

COMMENT ON TABLE procurement_overrides IS 'Фиксирует позиции, которые были исключены из закупки';
COMMENT ON COLUMN procurement_overrides.reason IS 'Причина исключения (manual_exclude, out_of_stock, price_too_high и т.д.)';
COMMENT ON COLUMN procurement_overrides.expires_at IS 'Время истечения исключения';

-- Таблица скидок поставщиков по брендам
CREATE TABLE IF NOT EXISTS supplier_brand_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    discount_percent DECIMAL(5,2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
    min_order_amount DECIMAL(12,2) DEFAULT 0,
    valid_from DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_brand_discounts_supplier ON supplier_brand_discounts (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_brand_discounts_brand ON supplier_brand_discounts (brand_id);
CREATE INDEX IF NOT EXISTS idx_supplier_brand_discounts_active ON supplier_brand_discounts (is_active);

-- Таблица конвертации единиц измерения для товаров
CREATE TABLE IF NOT EXISTS product_unit_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    from_unit VARCHAR(50) NOT NULL,
    to_unit VARCHAR(50) NOT NULL,
    conversion_factor DECIMAL(15,6) NOT NULL,
    is_supplier_specific BOOLEAN DEFAULT FALSE,
    supplier_id UUID REFERENCES suppliers(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, from_unit, to_unit, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_unit_conversions_product ON product_unit_conversions (product_id);

-- Таблица складов маркетплейсов
CREATE TABLE IF NOT EXISTS marketplace_warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketplace_id UUID REFERENCES marketplaces(id),
    supplier_id UUID REFERENCES suppliers(id),
    warehouse_code VARCHAR(100) NOT NULL,
    warehouse_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    UNIQUE(marketplace_id, warehouse_code)
);

-- Таблица компонентов мульти-складов (если еще нет)
CREATE TABLE IF NOT EXISTS multi_warehouse_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    multi_warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    source_warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(multi_warehouse_id, source_warehouse_id),
    CHECK (multi_warehouse_id != source_warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_multi_warehouse_parent ON multi_warehouse_components (multi_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_multi_warehouse_source ON multi_warehouse_components (source_warehouse_id);

-- Таблица курсов валют
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_code VARCHAR(3) UNIQUE NOT NULL,
    rate DECIMAL(15,6) NOT NULL,
    base_currency VARCHAR(3) DEFAULT 'RUB',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE exchange_rates IS 'Курсы валют по отношению к базовой валюте';
COMMENT ON COLUMN exchange_rates.currency_code IS 'Код валюты (USD, EUR и т.д.)';
COMMENT ON COLUMN exchange_rates.rate IS 'Курс обмена к базовой валюте';
COMMENT ON COLUMN exchange_rates.base_currency IS 'Базовая валюта (по умолчанию RUB)';

-- Вставка базовых курсов валют
INSERT INTO exchange_rates (currency_code, rate) VALUES
    ('RUB', 1.000000),
    ('USD', 90.500000),
    ('EUR', 98.750000),
    ('CNY', 12.450000)
ON CONFLICT (currency_code) DO UPDATE 
SET rate = EXCLUDED.rate, updated_at = CURRENT_TIMESTAMP;

-- Таблица маппинга заказов и заказов поставщикам
CREATE TABLE IF NOT EXISTS order_supplier_order_mapping (
    order_item_id UUID REFERENCES order_items(id) NOT NULL,
    supplier_order_item_id UUID REFERENCES supplier_order_items(id) NOT NULL,
    PRIMARY KEY (order_item_id, supplier_order_item_id)
);

-- Добавление недостающих полей в существующие таблицы
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS cable_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS popularity_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS volume DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS dimensions JSONB;

COMMENT ON COLUMN products.popularity_score IS 'Рейтинг популярности товара (0-100)';
COMMENT ON COLUMN products.weight IS 'Вес товара в килограммах';
COMMENT ON COLUMN products.volume IS 'Объем товара в кубических метрах';
COMMENT ON COLUMN products.dimensions IS 'Габариты товара {length, width, height} в сантиметрах';

-- Добавление недостающих полей в marketplace_product_links
ALTER TABLE marketplace_product_links
ADD COLUMN IF NOT EXISTS additional_expenses DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'RUB';

COMMENT ON COLUMN marketplace_product_links.additional_expenses IS 'Дополнительные расходы на маркетплейсе';
COMMENT ON COLUMN marketplace_product_links.currency IS 'Валюта для цены на маркетплейсе';

-- Добавление недостающих полей в orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);

-- Добавление недостающих полей в users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

COMMENT ON COLUMN users.name IS 'Полное имя пользователя';