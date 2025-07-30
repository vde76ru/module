-- Таблица для определения "Мастер-источника" контента для бренда
CREATE TABLE brand_content_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    brand_id UUID REFERENCES brands(id) NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, brand_id)
);

COMMENT ON TABLE brand_content_sources IS 'Определяет, от какого поставщика брать эталонный контент для бренда';
COMMENT ON COLUMN brand_content_sources.tenant_id IS 'ID арендатора';
COMMENT ON COLUMN brand_content_sources.brand_id IS 'ID бренда';
COMMENT ON COLUMN brand_content_sources.supplier_id IS 'ID поставщика-мастера контента';

-- Модификация таблицы product_suppliers
ALTER TABLE product_suppliers
ADD COLUMN IF NOT EXISTS original_price DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'RUB',
ADD COLUMN IF NOT EXISTS mrc_price DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS enforce_mrc BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN product_suppliers.original_price IS 'Оригинальная цена от поставщика';
COMMENT ON COLUMN product_suppliers.currency IS 'Валюта цены (RUB, USD, EUR и т.д.)';
COMMENT ON COLUMN product_suppliers.mrc_price IS 'Минимальная рекомендованная цена (МРЦ)';
COMMENT ON COLUMN product_suppliers.enforce_mrc IS 'Флаг обязательного соблюдения МРЦ';

-- Модификация таблицы products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS popularity_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3),
ADD COLUMN IF NOT EXISTS volume DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS dimensions JSONB,
ADD COLUMN IF NOT EXISTS is_divisible BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN products.popularity_score IS 'Рейтинг популярности товара (0-100)';
COMMENT ON COLUMN products.weight IS 'Вес товара в килограммах';
COMMENT ON COLUMN products.volume IS 'Объем товара в кубических метрах';
COMMENT ON COLUMN products.dimensions IS 'Габариты товара {length, width, height} в сантиметрах';
COMMENT ON COLUMN products.is_divisible IS 'Можно ли продавать дробное количество';

-- Модификация таблицы marketplace_product_links
ALTER TABLE marketplace_product_links
ADD COLUMN IF NOT EXISTS additional_expenses DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'RUB';

COMMENT ON COLUMN marketplace_product_links.additional_expenses IS 'Дополнительные расходы на маркетплейсе';
COMMENT ON COLUMN marketplace_product_links.currency IS 'Валюта для цены на маркетплейсе';

-- Таблица для хранения курсов валют
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_code VARCHAR(3) UNIQUE NOT NULL,
    rate DECIMAL(15, 6) NOT NULL,
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

-- Таблица для системы сигналов (алертов)
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    status VARCHAR(20) DEFAULT 'new',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    viewed_at TIMESTAMP,
    archived_at TIMESTAMP
);

CREATE INDEX idx_alerts_tenant_status ON alerts (tenant_id, status);
CREATE INDEX idx_alerts_entity ON alerts (entity_type, entity_id);
CREATE INDEX idx_alerts_created ON alerts (created_at DESC);

COMMENT ON TABLE alerts IS 'Системные уведомления и алерты';
COMMENT ON COLUMN alerts.alert_type IS 'Тип алерта (low_stock_high_demand, incomplete_data и т.д.)';
COMMENT ON COLUMN alerts.entity_type IS 'Тип сущности (product, order, supplier и т.д.)';
COMMENT ON COLUMN alerts.severity IS 'Важность (info, warning, critical)';
COMMENT ON COLUMN alerts.status IS 'Статус (new, viewed, archived)';

-- Таблица для Каналов Продаж
CREATE TABLE sales_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('marketplace', 'website', 'offline_store', 'other')),
    source_id UUID,
    default_warehouse_id UUID REFERENCES warehouses(id),
    is_active BOOLEAN DEFAULT TRUE,
    procurement_schedule JSONB DEFAULT '{}',
    auto_confirm_orders BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_sales_channels_tenant ON sales_channels (tenant_id);
CREATE INDEX idx_sales_channels_source ON sales_channels (source_id);

COMMENT ON TABLE sales_channels IS 'Каналы продаж для маршрутизации и автоматизации заказов';
COMMENT ON COLUMN sales_channels.type IS 'Тип канала продаж';
COMMENT ON COLUMN sales_channels.source_id IS 'ID источника (marketplace_id для маркетплейсов)';
COMMENT ON COLUMN sales_channels.default_warehouse_id IS 'Склад по умолчанию для канала';
COMMENT ON COLUMN sales_channels.procurement_schedule IS 'Расписание автоматических закупок';
COMMENT ON COLUMN sales_channels.auto_confirm_orders IS 'Автоматическое подтверждение заказов';

-- Модификация таблицы orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS sales_channel_id UUID REFERENCES sales_channels(id);

CREATE INDEX IF NOT EXISTS idx_orders_sales_channel ON orders (sales_channel_id);

COMMENT ON COLUMN orders.sales_channel_id IS 'ID канала продаж';

-- Модификация таблицы supplier_orders
ALTER TABLE supplier_orders
ADD COLUMN IF NOT EXISTS aggregation_batch_id UUID,
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS procurement_type VARCHAR(50) DEFAULT 'manual';

COMMENT ON COLUMN supplier_orders.aggregation_batch_id IS 'ID пакета агрегации заказов';
COMMENT ON COLUMN supplier_orders.created_by_user_id IS 'Пользователь, создавший заказ';
COMMENT ON COLUMN supplier_orders.delivery_address IS 'Адрес доставки';
COMMENT ON COLUMN supplier_orders.procurement_type IS 'Тип закупки (manual, scheduled, auto)';

-- Модификация таблицы order_items
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS procurement_status VARCHAR(50) DEFAULT 'pending' 
    CHECK (procurement_status IN ('pending', 'ordered', 'failed', 'cancelled', 'excluded'));

CREATE INDEX IF NOT EXISTS idx_order_items_procurement_status ON order_items (procurement_status);

COMMENT ON COLUMN order_items.procurement_status IS 'Статус закупки позиции';

-- Новая таблица для фиксации ручных исключений из закупки
CREATE TABLE procurement_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    order_item_id UUID REFERENCES order_items(id) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    expires_at TIMESTAMP,
    UNIQUE (tenant_id, order_item_id)
);

CREATE INDEX idx_procurement_overrides_tenant ON procurement_overrides (tenant_id);
CREATE INDEX idx_procurement_overrides_expires ON procurement_overrides (expires_at);

COMMENT ON TABLE procurement_overrides IS 'Фиксирует позиции, которые были исключены из закупки';
COMMENT ON COLUMN procurement_overrides.reason IS 'Причина исключения (manual_exclude, out_of_stock, price_too_high и т.д.)';
COMMENT ON COLUMN procurement_overrides.expires_at IS 'Время истечения исключения';

-- Создание триггера для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Применение триггера к новым таблицам
CREATE TRIGGER update_brand_content_sources_updated_at BEFORE UPDATE ON brand_content_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_rates_updated_at BEFORE UPDATE ON exchange_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_channels_updated_at BEFORE UPDATE ON sales_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Индексы для оптимизации производительности
CREATE INDEX IF NOT EXISTS idx_products_popularity ON products (popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_currency ON product_suppliers (currency);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_batch ON supplier_orders (aggregation_batch_id);

-- Обновление комментариев для существующих таблиц
COMMENT ON TABLE products IS 'Каталог товаров с расширенной информацией';
COMMENT ON TABLE product_suppliers IS 'Связь товаров с поставщиками и их цены';
COMMENT ON TABLE marketplace_product_links IS 'Связь товаров с маркетплейсами и настройки цен';
COMMENT ON TABLE orders IS 'Заказы от покупателей с поддержкой каналов продаж';
COMMENT ON TABLE supplier_orders IS 'Заказы поставщикам с расширенной логикой';
COMMENT ON TABLE order_items IS 'Позиции заказов с статусом закупки';
