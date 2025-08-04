-- ========================================
-- МИГРАЦИЯ 003: МОДУЛЬ ПОСТАВЩИКОВ
-- Таблицы для управления поставщиками и их предложениями
-- Версия: 2.0
-- ========================================

-- ========================================
-- ОСНОВНАЯ ТАБЛИЦА ПОСТАВЩИКОВ
-- ========================================

CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Основная информация
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL, -- уникальный код поставщика в рамках компании
    legal_name VARCHAR(500), -- полное юридическое название

    -- Контактная информация (JSON для гибкости)
    contact_info JSONB DEFAULT '{}',
    -- Пример: {"email": "sales@supplier.com", "phone": "+7123456789", "contact_person": "Иван Иванов"}

    -- Адрес
    address JSONB DEFAULT '{}',
    -- Пример: {"country": "RU", "city": "Москва", "street": "ул. Примерная, 123", "postal_code": "123456"}

    -- Банковские реквизиты
    banking_info JSONB DEFAULT '{}',
    -- Пример: {"bank_name": "Сбербанк", "bik": "044525225", "account": "40702810123456789012"}

    -- API и интеграция
    api_type VARCHAR(100), -- rest_api, soap, ftp, email, xml_feed, csv_feed, manual
    api_config JSONB DEFAULT '{}',
    -- Пример: {"base_url": "https://api.supplier.com", "auth_type": "bearer", "endpoints": {...}}

    -- Настройки синхронизации
    sync_settings JSONB DEFAULT '{}',
    -- Пример: {"auto_sync": true, "sync_frequency": "hourly", "sync_products": true, "sync_prices": true, "sync_stock": true}

    -- Статус и приоритет
    is_main BOOLEAN DEFAULT FALSE, -- основной поставщик компании
    priority INTEGER DEFAULT 0, -- приоритет при выборе между поставщиками
    trust_level INTEGER DEFAULT 1, -- уровень доверия (1-5)

    -- Условия работы
    payment_terms JSONB DEFAULT '{}',
    -- Пример: {"payment_method": "bank_transfer", "payment_days": 30, "prepayment_percent": 0}

    delivery_terms JSONB DEFAULT '{}',
    -- Пример: {"delivery_days_min": 3, "delivery_days_max": 7, "free_delivery_threshold": 10000}

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE, -- прошел ли поставщик верификацию

    -- Синхронизация
    last_sync TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'never',
    -- Возможные значения: never, in_progress, success, error, partial
    sync_error_message TEXT,
    sync_attempts INTEGER DEFAULT 0,

    -- Статистика
    total_products INTEGER DEFAULT 0,
    active_products INTEGER DEFAULT 0,
    avg_delivery_time DECIMAL(5,2), -- среднее время доставки в днях
    reliability_score DECIMAL(3,2) DEFAULT 5.0, -- оценка надежности (1.0-5.0)

    -- Метаданные
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, code)
);

COMMENT ON TABLE suppliers IS 'Поставщики товаров';

-- ========================================
-- ПРЕДЛОЖЕНИЯ ТОВАРОВ ОТ ПОСТАВЩИКОВ
-- ========================================

CREATE TABLE supplier_product_offers (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,

    -- Коды и идентификаторы поставщика
    supplier_code VARCHAR(100) NOT NULL, -- артикул у поставщика
    supplier_sku VARCHAR(100), -- дополнительный SKU
    supplier_name VARCHAR(500) NOT NULL, -- название у поставщика
    supplier_description TEXT,

    -- Классификация у поставщика
    supplier_brand VARCHAR(255),
    supplier_category VARCHAR(255),
    supplier_category_path TEXT,

    -- Цены и условия
    purchase_price DECIMAL(12,2) NOT NULL,
    currency CHAR(3) DEFAULT 'RUB',

    -- Количественные ограничения
    min_order_quantity DECIMAL(10,3) DEFAULT 1,
    max_order_quantity DECIMAL(10,3),
    order_step DECIMAL(10,3) DEFAULT 1, -- кратность заказа

    -- Единицы измерения поставщика
    supplier_unit VARCHAR(50) DEFAULT 'шт',
    unit_conversion_factor DECIMAL(15,6) DEFAULT 1, -- коэффициент пересчета к базовой единице

    -- Логистика
    delivery_time_days INTEGER, -- время доставки в днях
    delivery_cost DECIMAL(10,2), -- стоимость доставки

    -- Дополнительные расходы
    additional_costs JSONB DEFAULT '{}',
    -- Пример: {"packaging": 50, "handling": 25, "insurance": 100}

    -- Статус и доступность
    is_available BOOLEAN DEFAULT TRUE,
    availability_status VARCHAR(50) DEFAULT 'in_stock',
    -- Возможные значения: in_stock, low_stock, out_of_stock, discontinued, pre_order

    -- Обновления
    last_price_update TIMESTAMP WITH TIME ZONE,
    last_availability_update TIMESTAMP WITH TIME ZONE,

    -- Атрибуты от поставщика (сырые данные)
    supplier_attributes JSONB DEFAULT '{}',

    -- Качественные характеристики
    quality_score DECIMAL(3,2) DEFAULT 5.0, -- оценка качества товара (1.0-5.0)

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(supplier_id, supplier_code)
);

COMMENT ON TABLE supplier_product_offers IS 'Предложения товаров от поставщиков';

-- ========================================
-- ОСТАТКИ ПОСТАВЩИКОВ
-- ========================================

CREATE TABLE supplier_stocks (
    id SERIAL PRIMARY KEY,
    supplier_offer_id INTEGER REFERENCES supplier_product_offers(id) ON DELETE CASCADE,

    -- Информация о складе поставщика
    warehouse_name VARCHAR(255) NOT NULL,
    warehouse_code VARCHAR(100),

    -- Остатки
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(10,3) DEFAULT 0,
    available_quantity DECIMAL(10,3) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,

    -- Пороговые значения
    min_stock_level DECIMAL(10,3) DEFAULT 0,
    max_stock_level DECIMAL(10,3),

    -- Обновления
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_source VARCHAR(100), -- api, manual, import, estimation

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(supplier_offer_id, warehouse_name)
);

COMMENT ON TABLE supplier_stocks IS 'Остатки товаров поставщиков по складам';

-- ========================================
-- ПРИОРИТЕТЫ БРЕНДОВ У ПОСТАВЩИКОВ
-- ========================================

CREATE TABLE supplier_brand_priority (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    brand_id INTEGER REFERENCES internal_brands(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,

    -- Приоритет (чем больше число, тем выше приоритет)
    priority INTEGER NOT NULL DEFAULT 0,

    -- Дополнительные условия
    conditions JSONB DEFAULT '{}',
    -- Пример: {"min_order_amount": 5000, "delivery_region": ["moscow", "spb"]}

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, brand_id, supplier_id)
);

COMMENT ON TABLE supplier_brand_priority IS 'Приоритеты поставщиков по брендам для каждой компании';

-- ========================================
-- СИСТЕМА СКИДОК ПОСТАВЩИКОВ
-- ========================================

CREATE TABLE supplier_discounts (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,

    -- Название и описание скидки
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Тип скидки
    discount_type VARCHAR(50) NOT NULL, -- percent, fixed_amount, bulk, loyalty, seasonal

    -- Условия применения
    brand_id INTEGER REFERENCES internal_brands(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES internal_categories(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,

    -- Параметры скидки
    discount_value DECIMAL(12,2) NOT NULL, -- процент или сумма
    min_quantity DECIMAL(10,3) DEFAULT 1,
    min_amount DECIMAL(12,2) DEFAULT 0,

    -- Период действия
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,

    -- Дополнительные условия
    conditions JSONB DEFAULT '{}',
    -- Пример: {"customer_type": "wholesale", "payment_method": "prepay", "region": ["moscow"]}

    -- Лимиты использования
    usage_limit INTEGER, -- максимальное количество использований
    current_usage INTEGER DEFAULT 0,

    -- Приоритет (при пересечении скидок)
    priority INTEGER DEFAULT 0,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_combinable BOOLEAN DEFAULT FALSE, -- можно ли комбинировать с другими скидками

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE supplier_discounts IS 'Система скидок и акций от поставщиков';

-- ========================================
-- ИСТОРИЯ ЦЕН ПОСТАВЩИКОВ
-- ========================================

CREATE TABLE supplier_price_history (
    id SERIAL PRIMARY KEY,
    supplier_offer_id INTEGER REFERENCES supplier_product_offers(id) ON DELETE CASCADE,

    -- Историческая цена
    price DECIMAL(12,2) NOT NULL,
    currency CHAR(3) DEFAULT 'RUB',

    -- Дата изменения
    price_date DATE NOT NULL,

    -- Причина изменения
    change_reason VARCHAR(100), -- sync, manual, import, market_adjustment

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(supplier_offer_id, price_date)
);

COMMENT ON TABLE supplier_price_history IS 'История изменения цен поставщиков';

-- ========================================
-- ЛОГИ СИНХРОНИЗАЦИИ
-- ========================================

CREATE TABLE supplier_sync_logs (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,

    -- Информация о синхронизации
    sync_type VARCHAR(50) NOT NULL, -- full, incremental, products, prices, stock
    sync_status VARCHAR(50) NOT NULL, -- started, success, error, partial

    -- Статистика
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,

    -- Время выполнения
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    -- Ошибки и сообщения
    error_message TEXT,
    error_details JSONB DEFAULT '{}',

    -- Дополнительная информация
    sync_details JSONB DEFAULT '{}',
    -- Пример: {"api_calls": 45, "data_size_mb": 2.3, "new_products": 12}

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE supplier_sync_logs IS 'Логи синхронизации с поставщиками';

-- ========================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ========================================

-- Индексы для поставщиков
CREATE INDEX idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX idx_suppliers_is_main ON suppliers(is_main);
CREATE INDEX idx_suppliers_priority ON suppliers(priority DESC);
CREATE INDEX idx_suppliers_api_type ON suppliers(api_type);
CREATE INDEX idx_suppliers_sync_status ON suppliers(sync_status);
CREATE INDEX idx_suppliers_last_sync ON suppliers(last_sync);
CREATE INDEX idx_suppliers_reliability_score ON suppliers(reliability_score DESC);

-- Составные индексы для поставщиков
CREATE INDEX idx_suppliers_company_active ON suppliers(company_id, is_active);
CREATE INDEX idx_suppliers_company_main ON suppliers(company_id, is_main);

-- Индексы для предложений поставщиков
CREATE INDEX idx_supplier_offers_supplier_id ON supplier_product_offers(supplier_id);
CREATE INDEX idx_supplier_offers_product_id ON supplier_product_offers(product_id);
CREATE INDEX idx_supplier_offers_supplier_code ON supplier_product_offers(supplier_code);
CREATE INDEX idx_supplier_offers_is_available ON supplier_product_offers(is_available);
CREATE INDEX idx_supplier_offers_availability_status ON supplier_product_offers(availability_status);
CREATE INDEX idx_supplier_offers_purchase_price ON supplier_product_offers(purchase_price);
CREATE INDEX idx_supplier_offers_last_price_update ON supplier_product_offers(last_price_update);

-- Составные индексы для предложений
CREATE INDEX idx_supplier_offers_supplier_available ON supplier_product_offers(supplier_id, is_available);
CREATE INDEX idx_supplier_offers_product_available ON supplier_product_offers(product_id, is_available);

-- GIN индексы для JSON полей
CREATE INDEX idx_supplier_offers_supplier_attributes ON supplier_product_offers USING GIN(supplier_attributes);
CREATE INDEX idx_suppliers_contact_info ON suppliers USING GIN(contact_info);
CREATE INDEX idx_suppliers_api_config ON suppliers USING GIN(api_config);

-- Индексы для остатков
CREATE INDEX idx_supplier_stocks_offer_id ON supplier_stocks(supplier_offer_id);
CREATE INDEX idx_supplier_stocks_warehouse_name ON supplier_stocks(warehouse_name);
CREATE INDEX idx_supplier_stocks_quantity ON supplier_stocks(quantity);
CREATE INDEX idx_supplier_stocks_available_quantity ON supplier_stocks(available_quantity);
CREATE INDEX idx_supplier_stocks_last_sync ON supplier_stocks(last_sync);
CREATE INDEX idx_supplier_stocks_is_active ON supplier_stocks(is_active);

-- Индексы для приоритетов брендов
CREATE INDEX idx_supplier_brand_priority_company ON supplier_brand_priority(company_id);
CREATE INDEX idx_supplier_brand_priority_brand ON supplier_brand_priority(brand_id);
CREATE INDEX idx_supplier_brand_priority_supplier ON supplier_brand_priority(supplier_id);
CREATE INDEX idx_supplier_brand_priority_priority ON supplier_brand_priority(priority DESC);
CREATE INDEX idx_supplier_brand_priority_is_active ON supplier_brand_priority(is_active);

-- Составные индексы для приоритетов
CREATE INDEX idx_supplier_brand_priority_company_brand ON supplier_brand_priority(company_id, brand_id, priority DESC);

-- Индексы для скидок
CREATE INDEX idx_supplier_discounts_supplier_id ON supplier_discounts(supplier_id);
CREATE INDEX idx_supplier_discounts_type ON supplier_discounts(discount_type);
CREATE INDEX idx_supplier_discounts_brand_id ON supplier_discounts(brand_id);
CREATE INDEX idx_supplier_discounts_category_id ON supplier_discounts(category_id);
CREATE INDEX idx_supplier_discounts_product_id ON supplier_discounts(product_id);
CREATE INDEX idx_supplier_discounts_is_active ON supplier_discounts(is_active);
CREATE INDEX idx_supplier_discounts_valid_dates ON supplier_discounts(valid_from, valid_until);
CREATE INDEX idx_supplier_discounts_priority ON supplier_discounts(priority DESC);

-- Индексы для истории цен
CREATE INDEX idx_supplier_price_history_offer_id ON supplier_price_history(supplier_offer_id);
CREATE INDEX idx_supplier_price_history_date ON supplier_price_history(price_date);
CREATE INDEX idx_supplier_price_history_price ON supplier_price_history(price);

-- Индексы для логов синхронизации
CREATE INDEX idx_supplier_sync_logs_supplier_id ON supplier_sync_logs(supplier_id);
CREATE INDEX idx_supplier_sync_logs_sync_type ON supplier_sync_logs(sync_type);
CREATE INDEX idx_supplier_sync_logs_sync_status ON supplier_sync_logs(sync_status);
CREATE INDEX idx_supplier_sync_logs_started_at ON supplier_sync_logs(started_at);

-- ========================================
-- ТРИГГЕРЫ ДЛЯ АВТОМАТИЗАЦИИ
-- ========================================

-- Триггеры для обновления updated_at
CREATE TRIGGER trigger_update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_supplier_offers_updated_at
    BEFORE UPDATE ON supplier_product_offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_supplier_stocks_updated_at
    BEFORE UPDATE ON supplier_stocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_supplier_brand_priority_updated_at
    BEFORE UPDATE ON supplier_brand_priority
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_supplier_discounts_updated_at
    BEFORE UPDATE ON supplier_discounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С ПОСТАВЩИКАМИ
-- ========================================

-- Функция для обновления статистики поставщика
CREATE OR REPLACE FUNCTION update_supplier_stats()
RETURNS TRIGGER AS $$
DECLARE
    supplier_id_val INTEGER;
    stats RECORD;
BEGIN
    -- Определяем ID поставщика
    IF TG_OP = 'DELETE' THEN
        supplier_id_val := OLD.supplier_id;
    ELSE
        supplier_id_val := NEW.supplier_id;
    END IF;

    -- Считаем статистику
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_available = TRUE) as active,
        AVG(delivery_time_days) as avg_delivery
    INTO stats
    FROM supplier_product_offers
    WHERE supplier_id = supplier_id_val;

    -- Обновляем статистику поставщика
    UPDATE suppliers
    SET
        total_products = COALESCE(stats.total, 0),
        active_products = COALESCE(stats.active, 0),
        avg_delivery_time = stats.avg_delivery,
        updated_at = NOW()
    WHERE id = supplier_id_val;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Функция для логирования изменений цен
CREATE OR REPLACE FUNCTION log_supplier_price_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Логируем изменение цены
    IF TG_OP = 'UPDATE' AND OLD.purchase_price != NEW.purchase_price THEN
        INSERT INTO supplier_price_history (
            supplier_offer_id, price, currency, price_date, change_reason
        ) VALUES (
            NEW.id, NEW.purchase_price, NEW.currency, CURRENT_DATE, 'update'
        ) ON CONFLICT (supplier_offer_id, price_date) DO UPDATE
        SET price = EXCLUDED.price, currency = EXCLUDED.currency;

        -- Обновляем время последнего изменения цены
        NEW.last_price_update := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматического обновления доступности
CREATE OR REPLACE FUNCTION update_availability_status()
RETURNS TRIGGER AS $$
DECLARE
    total_available DECIMAL(10,3);
BEGIN
    -- Считаем общий доступный остаток
    SELECT COALESCE(SUM(available_quantity), 0)
    INTO total_available
    FROM supplier_stocks
    WHERE supplier_offer_id = NEW.supplier_offer_id AND is_active = TRUE;

    -- Обновляем статус доступности предложения
    UPDATE supplier_product_offers
    SET
        availability_status = CASE
            WHEN total_available <= 0 THEN 'out_of_stock'
            WHEN total_available <= 5 THEN 'low_stock'
            ELSE 'in_stock'
        END,
        last_availability_update = NOW()
    WHERE id = NEW.supplier_offer_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггеры
CREATE TRIGGER trigger_update_supplier_stats
    AFTER INSERT OR UPDATE OR DELETE ON supplier_product_offers
    FOR EACH ROW EXECUTE FUNCTION update_supplier_stats();

CREATE TRIGGER trigger_log_supplier_price_changes
    BEFORE UPDATE ON supplier_product_offers
    FOR EACH ROW EXECUTE FUNCTION log_supplier_price_changes();

CREATE TRIGGER trigger_update_availability_status
    AFTER INSERT OR UPDATE ON supplier_stocks
    FOR EACH ROW EXECUTE FUNCTION update_availability_status();

-- ========================================
-- ПРОВЕРКИ И ОГРАНИЧЕНИЯ
-- ========================================

-- Проверки для поставщиков
ALTER TABLE suppliers ADD CONSTRAINT check_api_type
    CHECK (api_type IN ('rest_api', 'soap', 'ftp', 'email', 'xml_feed', 'csv_feed', 'manual', 'webhook'));

ALTER TABLE suppliers ADD CONSTRAINT check_sync_status
    CHECK (sync_status IN ('never', 'in_progress', 'success', 'error', 'partial'));

ALTER TABLE suppliers ADD CONSTRAINT check_trust_level
    CHECK (trust_level BETWEEN 1 AND 5);

ALTER TABLE suppliers ADD CONSTRAINT check_reliability_score
    CHECK (reliability_score BETWEEN 1.0 AND 5.0);

-- Проверки для предложений
ALTER TABLE supplier_product_offers ADD CONSTRAINT check_availability_status
    CHECK (availability_status IN ('in_stock', 'low_stock', 'out_of_stock', 'discontinued', 'pre_order'));

ALTER TABLE supplier_product_offers ADD CONSTRAINT check_purchase_price_positive
    CHECK (purchase_price >= 0);

ALTER TABLE supplier_product_offers ADD CONSTRAINT check_min_order_quantity_positive
    CHECK (min_order_quantity > 0);

ALTER TABLE supplier_product_offers ADD CONSTRAINT check_quality_score
    CHECK (quality_score BETWEEN 1.0 AND 5.0);

-- Проверки для остатков
ALTER TABLE supplier_stocks ADD CONSTRAINT check_quantity_non_negative
    CHECK (quantity >= 0);

ALTER TABLE supplier_stocks ADD CONSTRAINT check_reserved_quantity_non_negative
    CHECK (reserved_quantity >= 0);

-- Проверки для скидок
ALTER TABLE supplier_discounts ADD CONSTRAINT check_discount_type
    CHECK (discount_type IN ('percent', 'fixed_amount', 'bulk', 'loyalty', 'seasonal', 'volume'));

ALTER TABLE supplier_discounts ADD CONSTRAINT check_discount_value_positive
    CHECK (discount_value >= 0);

-- ========================================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ========================================

-- Представление доступных предложений поставщиков
CREATE VIEW available_supplier_offers AS
SELECT
    spo.id,
    spo.supplier_id,
    spo.product_id,
    s.name as supplier_name,
    s.priority as supplier_priority,
    s.reliability_score,
    p.name as product_name,
    p.internal_code,
    spo.supplier_code,
    spo.supplier_name as supplier_product_name,
    spo.purchase_price,
    spo.currency,
    spo.min_order_quantity,
    spo.delivery_time_days,
    spo.availability_status,
    COALESCE(SUM(ss.available_quantity), 0) as total_available_stock,
    spo.last_price_update,
    spo.created_at,
    spo.updated_at
FROM supplier_product_offers spo
JOIN suppliers s ON spo.supplier_id = s.id
JOIN products p ON spo.product_id = p.id
LEFT JOIN supplier_stocks ss ON spo.id = ss.supplier_offer_id AND ss.is_active = TRUE
WHERE spo.is_available = TRUE
  AND s.is_active = TRUE
  AND p.is_active = TRUE
GROUP BY spo.id, s.id, p.id;

COMMENT ON VIEW available_supplier_offers IS 'Представление доступных предложений поставщиков с остатками';

-- Представление лучших цен по товарам
CREATE VIEW best_supplier_prices AS
SELECT DISTINCT ON (product_id)
    product_id,
    supplier_id,
    supplier_code,
    purchase_price,
    currency,
    min_order_quantity,
    delivery_time_days,
    availability_status
FROM available_supplier_offers
ORDER BY product_id, purchase_price ASC, supplier_priority DESC;

COMMENT ON VIEW best_supplier_prices IS 'Лучшие цены поставщиков по товарам';

-- ========================================
-- ВНЕШНИЕ КЛЮЧИ (ДОБАВЛЯЮТСЯ ПОСЛЕ СОЗДАНИЯ ТАБЛИЦЫ PRODUCTS)
-- ========================================

-- Добавим внешнюю связь на поставщиков в таблицу товаров
-- Это делается отдельно, так как таблица products создается в миграции 002
DO $$
BEGIN
    -- Добавляем внешний ключ main_supplier_id в таблицу products
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_products_main_supplier'
        AND table_name = 'products'
    ) THEN
        ALTER TABLE products
        ADD CONSTRAINT fk_products_main_supplier
        FOREIGN KEY (main_supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Индекс для нового внешнего ключа
CREATE INDEX IF NOT EXISTS idx_products_main_supplier_id ON products(main_supplier_id);