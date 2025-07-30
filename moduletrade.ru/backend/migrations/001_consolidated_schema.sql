-- ============================================================
-- 001_consolidated_schema.sql
-- Консолидированная базовая структура базы данных
-- Объединяет логику из 002, 004, 010, 015 без дублирования
-- ============================================================

-- ========================================
-- УСТАНОВКА РАСШИРЕНИЙ
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ========================================
-- БАЗОВЫЕ ФУНКЦИИ
-- ========================================

-- Универсальная функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Функция для расчета нормализованной цены
CREATE OR REPLACE FUNCTION calculate_normalized_price()
RETURNS TRIGGER AS $$
BEGIN
    -- Если есть кратность от поставщика, пересчитываем цену за базовую единицу
    IF NEW.supplier_multiplicity IS NOT NULL AND NEW.supplier_multiplicity > 0 THEN
        NEW.normalized_price = NEW.price / NEW.supplier_multiplicity;
    ELSE
        NEW.normalized_price = NEW.price;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Функция для проверки переопределения цен на маркетплейсах
CREATE OR REPLACE FUNCTION check_manual_price_override()
RETURNS TRIGGER AS $$
BEGIN
    -- Если цена обновилась автоматически, но есть ручное переопределение
    IF NEW.last_auto_price != OLD.last_auto_price AND NEW.manual_price IS NOT NULL THEN
        -- Логируем предупреждение
        INSERT INTO price_override_logs (marketplace_product_link_id, old_auto_price, new_auto_price, manual_price, created_at)
        VALUES (NEW.id, OLD.last_auto_price, NEW.last_auto_price, NEW.manual_price, CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Функция для обновления мульти-складов
CREATE OR REPLACE FUNCTION update_multi_warehouse_stock()
RETURNS TRIGGER AS $$
DECLARE
    multi_warehouse_record RECORD;
BEGIN
    -- Обновляем все мульти-склады, которые включают этот склад
    FOR multi_warehouse_record IN 
        SELECT mw.id as multi_warehouse_id
        FROM warehouses mw
        JOIN multi_warehouse_components mwc ON mw.id = mwc.multi_warehouse_id
        WHERE mwc.source_warehouse_id = NEW.warehouse_id
          AND mw.warehouse_type = 'multi'
    LOOP
        -- Пересчитываем остатки для мульти-склада
        UPDATE warehouse_product_links wpl1
        SET quantity = (
            SELECT COALESCE(SUM(wpl2.quantity), 0)
            FROM warehouse_product_links wpl2
            JOIN multi_warehouse_components mwc ON wpl2.warehouse_id = mwc.source_warehouse_id
            WHERE mwc.multi_warehouse_id = multi_warehouse_record.multi_warehouse_id
              AND wpl2.product_id = NEW.product_id
              AND mwc.is_active = TRUE
        )
        WHERE wpl1.warehouse_id = multi_warehouse_record.multi_warehouse_id
          AND wpl1.product_id = NEW.product_id;
    END LOOP;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ========================================
-- ОСНОВНЫЕ ТАБЛИЦЫ
-- ========================================

-- Таблица тарифных планов
CREATE TABLE tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    limits JSONB NOT NULL, -- {"products": 1000, "marketplaces": 3, etc}
    features JSONB NOT NULL, -- ["api_access", "yml_feed", etc]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица арендаторов (клиентов SaaS)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    plan VARCHAR(50) DEFAULT 'free',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Биллинг поля
    tariff_id UUID REFERENCES tariffs(id),
    subscription_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'inactive',
    subscription_end_date TIMESTAMP,
    balance DECIMAL(10,2) DEFAULT 0.00,
    stripe_customer_id VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица пользователей
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Персональные данные
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    name VARCHAR(255), -- полное имя
    
    -- Роли и доступ
    role VARCHAR(50) DEFAULT 'user', -- admin, manager, user
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица сессий пользователей
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Справочник единиц измерения (ОКЕИ)
CREATE TABLE unit_of_measures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL, -- код ОКЕИ
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(20) NOT NULL,
    unit_type VARCHAR(50) NOT NULL, -- 'count', 'length', 'weight', 'volume', 'area'
    is_base BOOLEAN DEFAULT FALSE,
    base_unit_code VARCHAR(10),
    conversion_factor DECIMAL(15,6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица курсов валют
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_code VARCHAR(3) UNIQUE NOT NULL,
    rate DECIMAL(15,6) NOT NULL,
    base_currency VARCHAR(3) DEFAULT 'RUB',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица брендов
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    website VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- Таблица категорий
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    parent_id UUID REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    attributes_schema JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, parent_id, name)
);

-- Таблица поставщиков
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    contact_info JSONB DEFAULT '{}',
    api_config JSONB DEFAULT '{}',
    sync_settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);

-- Таблица маркетплейсов
CREATE TABLE marketplaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    api_config JSONB DEFAULT '{}',
    sync_settings JSONB DEFAULT '{}',
    commission_rate DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);

-- Таблица складов
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    warehouse_type VARCHAR(50) DEFAULT 'physical', -- physical, virtual, multi
    address JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);

-- Компоненты мульти-складов
CREATE TABLE multi_warehouse_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    multi_warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    source_warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(multi_warehouse_id, source_warehouse_id),
    CHECK (multi_warehouse_id != source_warehouse_id)
);

-- Таблица товаров
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    internal_code VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    brand_id UUID REFERENCES brands(id),
    category_id UUID REFERENCES categories(id),
    
    -- Атрибуты и описание
    attributes JSONB DEFAULT '{}',
    description TEXT,
    
    -- Типы и статус
    source_type VARCHAR(50) NOT NULL, -- 'supplier', 'internal', 'marketplace'
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Основной поставщик
    main_supplier_id UUID REFERENCES suppliers(id),
    
    -- Единицы измерения
    base_unit VARCHAR(20) DEFAULT 'шт' CHECK (base_unit IN ('шт', 'м', 'кг', 'л', 'м2', 'м3', 'упак')),
    is_divisible BOOLEAN DEFAULT TRUE,
    min_order_quantity DECIMAL(10,2) DEFAULT 1,
    packaging_info JSONB DEFAULT '{}',
    
    -- Физические характеристики
    weight DECIMAL(10,3),
    volume DECIMAL(10,4),
    dimensions JSONB, -- {length, width, height} в см
    
    -- Популярность и рейтинг
    popularity_score INTEGER DEFAULT 0,
    
    -- Специальная информация
    cable_info JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, internal_code)
);

-- Конвертация единиц для товаров
CREATE TABLE product_unit_conversions (
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

-- Связь товар-поставщик
CREATE TABLE product_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_code VARCHAR(100) NOT NULL,
    supplier_article VARCHAR(255),
    
    -- Цены и валюта
    price DECIMAL(12,2),
    original_price DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'RUB',
    mrc_price DECIMAL(12,2),
    enforce_mrc BOOLEAN DEFAULT FALSE,
    
    -- Единицы измерения
    supplier_unit VARCHAR(50),
    supplier_multiplicity INTEGER DEFAULT 1,
    normalized_price DECIMAL(12,2),
    unit_conversion_factor DECIMAL(10,4) DEFAULT 1,
    
    -- Остатки и доставка
    quantity INTEGER DEFAULT 0,
    delivery_days INTEGER DEFAULT 0,
    last_sync TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, supplier_code)
);

-- Связь склад-товар
CREATE TABLE warehouse_product_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    price DECIMAL(12,2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, product_id)
);

-- Связь маркетплейс-товар
CREATE TABLE marketplace_product_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketplace_id UUID REFERENCES marketplaces(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    marketplace_sku VARCHAR(255),
    
    -- Цены
    price DECIMAL(12,2),
    manual_price DECIMAL(12,2),
    last_auto_price DECIMAL(12,2),
    additional_expenses DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'RUB',
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    sync_status VARCHAR(50) DEFAULT 'pending',
    last_sync TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(marketplace_id, marketplace_sku)
);

-- Определение "Мастер-источника" контента для бренда
CREATE TABLE brand_content_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    brand_id UUID REFERENCES brands(id) NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, brand_id)
);

-- Таблица заказов
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    order_number VARCHAR(100) NOT NULL,
    marketplace_id UUID REFERENCES marketplaces(id),
    
    -- Информация о клиенте
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Даты и статус
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    
    -- Суммы
    total_amount DECIMAL(12,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, order_number)
);

-- Позиции заказов
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Транзакции биллинга
CREATE TABLE billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    type VARCHAR(50) NOT NULL, -- payment, subscription, api_usage, refund
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    stripe_payment_intent_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Переопределения закупок
CREATE TABLE procurement_overrides (
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

-- Логи переопределения цен
CREATE TABLE price_override_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketplace_product_link_id UUID REFERENCES marketplace_product_links(id),
    old_auto_price DECIMAL(12,2),
    new_auto_price DECIMAL(12,2),
    manual_price DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Логи синхронизации
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    sync_type VARCHAR(50) NOT NULL, -- supplier, marketplace, warehouse
    entity_id UUID, -- ID сущности которая синхронизировалась
    status VARCHAR(50) NOT NULL, -- started, completed, failed
    message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- ========================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ========================================

-- Основные внешние ключи
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_supplier_id ON products(main_supplier_id);

-- Поиск и фильтрация
CREATE INDEX idx_products_source_type ON products(source_type);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_name_gin ON products USING gin(to_tsvector('russian', name));
CREATE INDEX idx_products_attributes ON products USING GIN(attributes);

-- Связи товаров
CREATE INDEX idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);
CREATE INDEX idx_warehouse_product_links_warehouse_id ON warehouse_product_links(warehouse_id);
CREATE INDEX idx_warehouse_product_links_product_id ON warehouse_product_links(product_id);
CREATE INDEX idx_marketplace_product_links_marketplace_id ON marketplace_product_links(marketplace_id);
CREATE INDEX idx_marketplace_product_links_product_id ON marketplace_product_links(product_id);

-- Заказы
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Сессии и авторизация
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_token ON user_sessions(refresh_token);

-- Биллинг
CREATE INDEX idx_billing_transactions_tenant_id ON billing_transactions(tenant_id);
CREATE INDEX idx_billing_transactions_type ON billing_transactions(type);
CREATE INDEX idx_billing_transactions_status ON billing_transactions(status);
CREATE INDEX idx_billing_transactions_created ON billing_transactions(created_at);

-- Тенанты и тарифы
CREATE INDEX idx_tenants_tariff_id ON tenants(tariff_id);
CREATE INDEX idx_tenants_subscription_status ON tenants(subscription_status);
CREATE INDEX idx_tenants_stripe_customer_id ON tenants(stripe_customer_id);

-- Логи и мониторинг
CREATE INDEX idx_sync_logs_tenant_id ON sync_logs(tenant_id);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at);

-- Специальные составные индексы
CREATE INDEX idx_product_suppliers_price ON product_suppliers(product_id, price);
CREATE INDEX idx_warehouse_quantity ON warehouse_product_links(warehouse_id, quantity) WHERE quantity > 0;

-- ========================================
-- ТРИГГЕРЫ
-- ========================================

-- Триггеры для updated_at
CREATE TRIGGER update_tariffs_updated_at 
    BEFORE UPDATE ON tariffs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at 
    BEFORE UPDATE ON tenants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_suppliers_updated_at 
    BEFORE UPDATE ON product_suppliers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_product_links_updated_at 
    BEFORE UPDATE ON marketplace_product_links 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at 
    BEFORE UPDATE ON user_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_content_sources_updated_at 
    BEFORE UPDATE ON brand_content_sources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_rates_updated_at 
    BEFORE UPDATE ON exchange_rates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_transactions_updated_at 
    BEFORE UPDATE ON billing_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Специализированные триггеры
CREATE TRIGGER trigger_calculate_normalized_price 
    BEFORE INSERT OR UPDATE ON product_suppliers 
    FOR EACH ROW EXECUTE FUNCTION calculate_normalized_price();

CREATE TRIGGER trigger_check_manual_price 
    BEFORE UPDATE OF last_auto_price 
    ON marketplace_product_links 
    FOR EACH ROW 
    EXECUTE FUNCTION check_manual_price_override();

CREATE TRIGGER trigger_update_multi_warehouse 
    AFTER INSERT OR UPDATE OF quantity 
    ON warehouse_product_links 
    FOR EACH ROW 
    EXECUTE FUNCTION update_multi_warehouse_stock();

-- ========================================
-- КОММЕНТАРИИ
-- ========================================

COMMENT ON TABLE tariffs IS 'Тарифные планы для SaaS';
COMMENT ON TABLE tenants IS 'Арендаторы (клиенты SaaS)';
COMMENT ON TABLE users IS 'Пользователи системы';
COMMENT ON TABLE user_sessions IS 'Сессии пользователей для refresh токенов';
COMMENT ON TABLE products IS 'Каталог товаров';
COMMENT ON TABLE orders IS 'Заказы от покупателей';
COMMENT ON TABLE billing_transactions IS 'Транзакции биллинговой системы';
COMMENT ON TABLE sync_logs IS 'Логи синхронизации с внешними системами';

-- Финал
SELECT 'Консолидированная схема БД создана успешно!' as status;