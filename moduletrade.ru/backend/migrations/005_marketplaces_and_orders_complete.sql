-- ========================================
-- МИГРАЦИЯ 005: МОДУЛИ МАРКЕТПЛЕЙСОВ И ЗАКАЗОВ (ПОЛНАЯ)
-- Таблицы для настроек маркетплейсов и OMS (Order Management System)
-- Версия: 2.1 (с исправлениями совместимости)
-- ========================================

-- ========================================
-- ГЛОБАЛЬНЫЙ СПРАВОЧНИК МАРКЕТПЛЕЙСОВ
-- ========================================

CREATE TABLE marketplaces (
    id SERIAL PRIMARY KEY,
    
    -- Основная информация
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    
    -- Тип API интеграции
    api_type VARCHAR(50) NOT NULL,
    -- Возможные значения: fbs, fbo, dbs, classified, dropshipping
    
    -- Правила комиссий
    commission_rules JSONB DEFAULT '{}',
    -- Пример: {"type": "percent", "value": 15, "min": 50, "max": 5000}
    
    -- API конфигурация (общие настройки)
    api_config JSONB DEFAULT '{}',
    -- Пример: {"base_url": "https://api.ozon.ru", "version": "v3", "rate_limit": 10}
    
    -- Требования к данным
    data_requirements JSONB DEFAULT '{}',
    -- Пример: {"required_fields": ["barcode", "images"], "max_images": 10}
    
    -- Доступность
    is_public BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Порядок отображения
    sort_order INTEGER DEFAULT 0,
    
    -- Метаданные
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketplaces IS 'Глобальный справочник маркетплейсов';

-- ========================================
-- МОДУЛЬ НАСТРОЕК МАРКЕТПЛЕЙСОВ
-- ========================================

CREATE TABLE marketplace_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Основная информация
    marketplace_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- API конфигурация
    api_keys JSONB DEFAULT '{}',
    -- Пример: {"client_id": "xxx", "client_secret": "yyy", "api_key": "zzz"}

    api_endpoints JSONB DEFAULT '{}',
    -- Пример: {"base_url": "https://api.ozon.ru", "orders": "/v2/posting/fbo/list"}

    -- Правила комиссий и расходов
    commission_rules JSONB DEFAULT '{}',
    -- Пример: {"type": "percent", "value": 15, "min_amount": 50}

    additional_costs JSONB DEFAULT '{}',
    -- Пример: {"logistics": 50, "packaging": 25, "processing": 10}

    -- Правила ценообразования
    pricing_rules JSONB DEFAULT '{}',
    -- Пример: {"markup_percent": 20, "round_to": 1, "min_price": 100}

    -- Настройки синхронизации
    sync_settings JSONB DEFAULT '{}',
    -- Пример: {"auto_sync": true, "frequency": "hourly", "sync_orders": true, "sync_stock": true}

    last_sync TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'never',
    -- Возможные значения: never, in_progress, success, error, partial
    sync_error_message TEXT,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_test_mode BOOLEAN DEFAULT FALSE,

    -- Лимиты и квоты
    rate_limits JSONB DEFAULT '{}',
    -- Пример: {"requests_per_minute": 60, "daily_quota": 10000}

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, marketplace_name)
);

COMMENT ON TABLE marketplace_settings IS 'Настройки интеграции с маркетплейсами';

-- ========================================
-- ПРОФИЛИ ЭКСПОРТА НА МАРКЕТПЛЕЙСЫ
-- ========================================

CREATE TABLE export_profiles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    marketplace_id INTEGER REFERENCES marketplace_settings(id) ON DELETE CASCADE,

    -- Основная информация
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Правила фильтрации товаров
    filter_rules JSONB DEFAULT '{}',
    -- Пример: {"brands": [1,2,3], "categories": [5,6], "min_price": 100, "stock_min": 1}

    -- Формула расчета цен
    price_formula JSONB DEFAULT '{}',
    -- Пример: {"base": "purchase_price", "markup": 30, "commission": 15, "logistics": 50}

    -- Настройки экспорта
    export_settings JSONB DEFAULT '{}',
    -- Пример: {"include_images": true, "max_images": 5, "include_video": false, "seo_optimization": true}

    -- Маппинг атрибутов
    attribute_mapping JSONB DEFAULT '{}',
    -- Пример: {"color": "Цвет", "size": "Размер", "material": "Материал"}

    -- Расписание экспорта
    schedule_settings JSONB DEFAULT '{}',
    -- Пример: {"frequency": "daily", "time": "03:00", "days": ["monday", "wednesday", "friday"]}

    is_auto_export BOOLEAN DEFAULT FALSE,
    last_export TIMESTAMP WITH TIME ZONE,

    -- Статистика экспорта
    total_products_exported INTEGER DEFAULT 0,
    last_export_status VARCHAR(50) DEFAULT 'never',
    -- Возможные значения: never, in_progress, success, error, partial

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, marketplace_id, name)
);

COMMENT ON TABLE export_profiles IS 'Профили экспорта товаров на маркетплейсы';

-- ========================================
-- СОСТОЯНИЕ ТОВАРОВ НА МАРКЕТПЛЕЙСАХ
-- ========================================

CREATE TABLE marketplace_product_status (
    id SERIAL PRIMARY KEY,
    export_profile_id INTEGER REFERENCES export_profiles(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,

    -- Идентификаторы на маркетплейсе
    external_product_id VARCHAR(255),
    external_sku VARCHAR(255),

    -- Статус на маркетплейсе
    status VARCHAR(50) DEFAULT 'not_exported',
    -- Возможные значения: not_exported, pending, published, rejected, archived, error

    -- Ошибки и причины отклонения
    error_message TEXT,
    rejection_reason TEXT,

    -- Экспортированные данные
    exported_data JSONB DEFAULT '{}',
    exported_price DECIMAL(12,2),
    exported_stock INTEGER,

    -- Времена обновлений
    last_export_attempt TIMESTAMP WITH TIME ZONE,
    last_successful_export TIMESTAMP WITH TIME ZONE,
    last_price_update TIMESTAMP WITH TIME ZONE,
    last_stock_update TIMESTAMP WITH TIME ZONE,

    -- Статистика
    views_count INTEGER DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,4) DEFAULT 0,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(export_profile_id, product_id)
);

COMMENT ON TABLE marketplace_product_status IS 'Статус товаров на маркетплейсах';

-- ========================================
-- МОДУЛЬ УПРАВЛЕНИЯ ЗАКАЗАМИ (OMS)
-- ========================================

CREATE TABLE incoming_orders (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    marketplace_id INTEGER REFERENCES marketplace_settings(id) ON DELETE SET NULL,
    sales_channel_id INTEGER, -- для будущего расширения

    -- Внешние идентификаторы
    order_number VARCHAR(255),
    marketplace_order_id VARCHAR(255),

    -- Информация о покупателе
    customer_id INTEGER, -- для будущего CRM модуля
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),

    -- Статусы
    status VARCHAR(50) DEFAULT 'new',
    -- Возможные значения: new, confirmed, processing, packed, shipped, delivered, cancelled, returned

    payment_status VARCHAR(50) DEFAULT 'pending',
    -- Возможные значения: pending, paid, cancelled, refunded, partial_refund

    payment_method VARCHAR(100),

    -- Доставка
    delivery_type VARCHAR(100),
    delivery_service VARCHAR(100),
    delivery_cost DECIMAL(12,2) DEFAULT 0,
    delivery_address JSONB DEFAULT '{}',
    delivery_date DATE,

    -- Финансовая информация
    total_amount DECIMAL(12,2) NOT NULL,
    commission_amount DECIMAL(12,2) DEFAULT 0,
    net_amount DECIMAL(12,2),
    currency CHAR(3) DEFAULT 'RUB',

    -- Заметки
    notes TEXT,

    -- Важные даты
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    processing_started TIMESTAMP WITH TIME ZONE,
    processing_completed TIMESTAMP WITH TIME ZONE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, marketplace_id, marketplace_order_id)
);

COMMENT ON TABLE incoming_orders IS 'Входящие заказы из всех источников продаж';

-- ========================================
-- ТОВАРЫ В ЗАКАЗАХ
-- ========================================

CREATE TABLE incoming_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES incoming_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,

    -- Информация о товаре на момент заказа
    external_product_id VARCHAR(255),
    product_name VARCHAR(500) NOT NULL,
    product_sku VARCHAR(255),
    product_variant VARCHAR(255), -- размер, цвет, etc

    -- Количество и цены
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,

    -- Скидки и доплаты
    discount_amount DECIMAL(12,2) DEFAULT 0,
    commission_amount DECIMAL(12,2) DEFAULT 0,

    -- Статус товара в заказе
    status VARCHAR(50) DEFAULT 'new',
    -- Возможные значения: new, reserved, allocated, picked, packed, shipped, delivered, cancelled, returned

    -- Складские операции
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
    allocated_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
    reserved_quantity DECIMAL(10,2) DEFAULT 0,

    -- Метаданные
    raw_data JSONB DEFAULT '{}',
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE incoming_order_items IS 'Товары в входящих заказах';

-- ========================================
-- МОДУЛЬ ЗАКУПОК (PROCUREMENT)
-- ========================================

CREATE TABLE procurement_orders (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,

    -- Основная информация
    order_number VARCHAR(255) UNIQUE NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Связь с заказами клиентов (если закупка под заказ)
    source_order_ids INTEGER[], -- массив ID заказов клиентов, под которые делается закупка

    -- Финансовая информация
    total_amount DECIMAL(12,2) DEFAULT 0,
    currency CHAR(3) DEFAULT 'RUB',

    -- Условия оплаты
    payment_terms JSONB DEFAULT '{}',
    -- Пример: {"method": "bank_transfer", "days": 30, "prepayment_percent": 50}

    -- Статусы и даты
    status VARCHAR(50) DEFAULT 'draft',
    -- Возможные значения: draft, sent, confirmed, processing, shipped, received, cancelled

    sent_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,

    -- Дополнительная информация
    notes TEXT,
    terms_and_conditions TEXT,

    -- Приоритет
    priority INTEGER DEFAULT 0,
    is_urgent BOOLEAN DEFAULT FALSE,

    -- Связь с пользователями
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE procurement_orders IS 'Заказы на закупку у поставщиков';

-- ========================================
-- ТОВАРЫ В ЗАКАЗАХ НА ЗАКУПКУ
-- ========================================

CREATE TABLE procurement_order_items (
    id SERIAL PRIMARY KEY,
    procurement_order_id INTEGER REFERENCES procurement_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    incoming_order_item_id INTEGER REFERENCES incoming_order_items(id) ON DELETE SET NULL,

    -- Информация о товаре для закупки
    supplier_product_code VARCHAR(255),
    product_name VARCHAR(500) NOT NULL,

    -- Количество и цены
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,

    -- Доставка
    delivery_date DATE,
    expected_delivery_date DATE,

    -- Статус
    status VARCHAR(50) DEFAULT 'ordered',
    -- Возможные значения: ordered, confirmed, shipped, received, cancelled

    -- Связь со складскими операциями
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
    received_quantity DECIMAL(10,2) DEFAULT 0,
    received_at TIMESTAMP WITH TIME ZONE,

    -- Качество товара
    quality_check_status VARCHAR(50) DEFAULT 'pending',
    -- Возможные значения: pending, passed, failed, partial
    quality_notes TEXT,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE procurement_order_items IS 'Товары в заказах на закупку';

-- ========================================
-- ИСТОРИЯ СТАТУСОВ ЗАКАЗОВ
-- ========================================

CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES incoming_orders(id) ON DELETE CASCADE,
    order_item_id INTEGER REFERENCES incoming_order_items(id) ON DELETE SET NULL,

    -- Изменение статуса
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,

    -- Контекст изменения
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    change_reason VARCHAR(255),
    notes TEXT,

    -- Автоматическое или ручное изменение
    is_automatic BOOLEAN DEFAULT FALSE,
    source_system VARCHAR(100), -- system, user, api, marketplace

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE order_status_history IS 'История изменений статусов заказов';

-- ========================================
-- ЛОГИ СИНХРОНИЗАЦИИ МАРКЕТПЛЕЙСОВ
-- ========================================

CREATE TABLE marketplace_sync_logs (
    id SERIAL PRIMARY KEY,
    marketplace_id INTEGER REFERENCES marketplace_settings(id) ON DELETE CASCADE,

    -- Информация о синхронизации
    sync_type VARCHAR(50) NOT NULL,
    -- Возможные значения: orders, products, stock, prices, full

    sync_status VARCHAR(50) NOT NULL,
    -- Возможные значения: started, success, error, partial

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
    -- Пример: {"api_calls": 45, "data_size_mb": 2.3, "new_orders": 12, "updated_products": 156}

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketplace_sync_logs IS 'Логи синхронизации с маркетплейсами';

-- ========================================
-- ТАБЛИЦА SYNC_LOGS ДЛЯ СОВМЕСТИМОСТИ
-- ========================================

CREATE TABLE sync_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Тип синхронизации
    sync_type VARCHAR(50) NOT NULL,
    -- Возможные значения: orders, products, stock, prices, full
    
    -- Статус синхронизации
    status VARCHAR(50) NOT NULL,
    -- Возможные значения: started, success, error, partial, completed, failed

    -- Детали синхронизации
    details JSONB DEFAULT '{}',
    error_message TEXT,
    
    -- Статистика
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,  
    items_failed INTEGER DEFAULT 0,
    
    -- Время выполнения
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Метаданные
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE sync_logs IS 'Логи синхронизации для совместимости';

-- ========================================
-- ТАБЛИЦА API_LOGS ДЛЯ АНАЛИТИКИ  
-- ========================================

CREATE TABLE api_logs (
    id BIGSERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- HTTP запрос
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    url TEXT,
    
    -- Статус ответа
    status_code INTEGER,
    response_time_ms INTEGER,
    
    -- Размеры
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    
    -- IP и User Agent
    ip_address INET,
    user_agent TEXT,
    
    -- Дополнительные данные
    request_id VARCHAR(255),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE api_logs IS 'Логи API запросов для аналитики';

-- ========================================
-- ПРЕДСТАВЛЕНИЯ ДЛЯ СОВМЕСТИМОСТИ С КОДОМ
-- ========================================

-- Алиас orders для incoming_orders
CREATE OR REPLACE VIEW orders AS
SELECT 
    id,
    company_id,
    marketplace_id,
    sales_channel_id,
    order_number,
    marketplace_order_id,
    customer_id,
    customer_name,
    customer_email,  
    customer_phone,
    status,
    payment_status,
    payment_method,
    delivery_type,
    delivery_service,
    delivery_cost,
    delivery_address,
    delivery_date,
    total_amount,
    commission_amount,
    net_amount,
    currency,
    notes,
    order_date,
    processing_started,
    processing_completed,
    metadata,
    created_at,
    updated_at
FROM incoming_orders;

COMMENT ON VIEW orders IS 'Представление для совместимости с incoming_orders';

-- ========================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ========================================

-- Индексы для настроек маркетплейсов
CREATE INDEX idx_marketplace_settings_company ON marketplace_settings(company_id);
CREATE INDEX idx_marketplace_settings_name ON marketplace_settings(marketplace_name);
CREATE INDEX idx_marketplace_settings_active ON marketplace_settings(is_active);
CREATE INDEX idx_marketplace_settings_sync_status ON marketplace_settings(sync_status);
CREATE INDEX idx_marketplace_settings_last_sync ON marketplace_settings(last_sync);

-- Составные индексы для маркетплейсов
CREATE INDEX idx_marketplace_settings_company_active ON marketplace_settings(company_id, is_active);

-- GIN индексы для JSON полей
CREATE INDEX idx_marketplace_settings_api_config ON marketplace_settings USING GIN(api_keys);
CREATE INDEX idx_marketplace_settings_sync_settings ON marketplace_settings USING GIN(sync_settings);

-- Индексы для профилей экспорта
CREATE INDEX idx_export_profiles_company ON export_profiles(company_id);
CREATE INDEX idx_export_profiles_marketplace ON export_profiles(marketplace_id);
CREATE INDEX idx_export_profiles_active ON export_profiles(is_active);
CREATE INDEX idx_export_profiles_auto_export ON export_profiles(is_auto_export);
CREATE INDEX idx_export_profiles_last_export ON export_profiles(last_export);

-- Составные индексы для профилей экспорта
CREATE INDEX idx_export_profiles_marketplace_active ON export_profiles(marketplace_id, is_active);

-- Индексы для статуса товаров на маркетплейсах
CREATE INDEX idx_marketplace_product_status_profile ON marketplace_product_status(export_profile_id);
CREATE INDEX idx_marketplace_product_status_product ON marketplace_product_status(product_id);
CREATE INDEX idx_marketplace_product_status_external_id ON marketplace_product_status(external_product_id);
CREATE INDEX idx_marketplace_product_status_status ON marketplace_product_status(status);
CREATE INDEX idx_marketplace_product_status_last_export ON marketplace_product_status(last_successful_export);

-- Составные индексы для статуса товаров
CREATE INDEX idx_marketplace_product_status_profile_status ON marketplace_product_status(export_profile_id, status);

-- Индексы для входящих заказов
CREATE INDEX idx_incoming_orders_company ON incoming_orders(company_id);
CREATE INDEX idx_incoming_orders_marketplace_order_id ON incoming_orders(marketplace_order_id);
CREATE INDEX idx_incoming_orders_marketplace_id ON incoming_orders(marketplace_id);
CREATE INDEX idx_incoming_orders_status ON incoming_orders(status);
CREATE INDEX idx_incoming_orders_payment_status ON incoming_orders(payment_status);
CREATE INDEX idx_incoming_orders_order_date ON incoming_orders(order_date);

-- Составные индексы для заказов
CREATE INDEX idx_incoming_orders_company_status ON incoming_orders(company_id, status);
CREATE INDEX idx_incoming_orders_company_date ON incoming_orders(company_id, order_date);

-- Полнотекстовый поиск для заказов
CREATE INDEX idx_incoming_orders_order_number ON incoming_orders(order_number);

-- GIN индексы для JSON полей заказов
CREATE INDEX idx_incoming_orders_delivery_address ON incoming_orders USING GIN(delivery_address);

-- Индексы для товаров в заказах
CREATE INDEX idx_incoming_order_items_order ON incoming_order_items(order_id);
CREATE INDEX idx_incoming_order_items_product ON incoming_order_items(product_id);
CREATE INDEX idx_incoming_order_items_status ON incoming_order_items(status);
CREATE INDEX idx_incoming_order_items_warehouse ON incoming_order_items(warehouse_id);
CREATE INDEX idx_incoming_order_items_allocated_warehouse ON incoming_order_items(allocated_warehouse_id);

-- Составные индексы для товаров в заказах
CREATE INDEX idx_incoming_order_items_order_status ON incoming_order_items(order_id, status);
CREATE INDEX idx_incoming_order_items_product_status ON incoming_order_items(product_id, status);

-- Индексы для заказов на закупку
CREATE INDEX idx_procurement_orders_company ON procurement_orders(company_id);
CREATE INDEX idx_procurement_orders_supplier ON procurement_orders(supplier_id);
CREATE INDEX idx_procurement_orders_status ON procurement_orders(status);
CREATE INDEX idx_procurement_orders_priority ON procurement_orders(priority DESC);
CREATE INDEX idx_procurement_orders_is_urgent ON procurement_orders(is_urgent);
CREATE INDEX idx_procurement_orders_created_by ON procurement_orders(created_by);
CREATE INDEX idx_procurement_orders_date ON procurement_orders(order_date);

-- Составные индексы для заказов на закупку
CREATE INDEX idx_procurement_orders_company_status ON procurement_orders(company_id, status);
CREATE INDEX idx_procurement_orders_supplier_status ON procurement_orders(supplier_id, status);

-- GIN индексы для массивов
CREATE INDEX idx_procurement_orders_source_orders ON procurement_orders USING GIN(source_order_ids);

-- Индексы для товаров в заказах на закупку
CREATE INDEX idx_procurement_order_items_order ON procurement_order_items(procurement_order_id);
CREATE INDEX idx_procurement_order_items_product ON procurement_order_items(product_id);
CREATE INDEX idx_procurement_order_items_incoming_item ON procurement_order_items(incoming_order_item_id);
CREATE INDEX idx_procurement_order_items_status ON procurement_order_items(status);
CREATE INDEX idx_procurement_order_items_warehouse ON procurement_order_items(warehouse_id);

-- Составные индексы для товаров в заказах на закупку
CREATE INDEX idx_procurement_order_items_order_status ON procurement_order_items(procurement_order_id, status);

-- Индексы для истории статусов
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_item ON order_status_history(order_item_id);
CREATE INDEX idx_order_status_history_changed_by ON order_status_history(changed_by);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at);
CREATE INDEX idx_order_status_history_new_status ON order_status_history(new_status);

-- Индексы для логов синхронизации маркетплейсов
CREATE INDEX idx_marketplace_sync_logs_marketplace ON marketplace_sync_logs(marketplace_id);
CREATE INDEX idx_marketplace_sync_logs_type ON marketplace_sync_logs(sync_type);
CREATE INDEX idx_marketplace_sync_logs_status ON marketplace_sync_logs(sync_status);
CREATE INDEX idx_marketplace_sync_logs_started_at ON marketplace_sync_logs(started_at);

-- Индексы для sync_logs
CREATE INDEX idx_sync_logs_company_id ON sync_logs(company_id);
CREATE INDEX idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at);

-- Индексы для api_logs
CREATE INDEX idx_api_logs_company_id ON api_logs(company_id);
CREATE INDEX idx_api_logs_endpoint ON api_logs(endpoint);
CREATE INDEX idx_api_logs_status_code ON api_logs(status_code);
CREATE INDEX idx_api_logs_created_at ON api_logs(created_at);
CREATE INDEX idx_api_logs_response_time ON api_logs(response_time_ms);

-- ========================================
-- ТРИГГЕРЫ ДЛЯ АВТОМАТИЗАЦИИ
-- ========================================

-- Триггеры для обновления updated_at
CREATE TRIGGER trigger_update_marketplace_settings_updated_at
    BEFORE UPDATE ON marketplace_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_export_profiles_updated_at
    BEFORE UPDATE ON export_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_marketplace_product_status_updated_at
    BEFORE UPDATE ON marketplace_product_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_incoming_orders_updated_at
    BEFORE UPDATE ON incoming_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_incoming_order_items_updated_at
    BEFORE UPDATE ON incoming_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_procurement_orders_updated_at
    BEFORE UPDATE ON procurement_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_procurement_order_items_updated_at
    BEFORE UPDATE ON procurement_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ФУНКЦИИ ДЛЯ АВТОМАТИЗАЦИИ
-- ========================================

-- Функция для автоматического создания истории статусов
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    user_id_val INTEGER;
BEGIN
    -- Логируем только если статус действительно изменился
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN

        -- Получаем ID пользователя из контекста
        BEGIN
            user_id_val := current_setting('app.current_user_id')::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            user_id_val := NULL;
        END;

        -- Записываем в историю
        INSERT INTO order_status_history (
            order_id, old_status, new_status, changed_by,
            change_reason, is_automatic, source_system
        ) VALUES (
            NEW.id, OLD.status, NEW.status, user_id_val,
            'Status updated', FALSE, 'system'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматического расчета total_amount в заказах на закупку
CREATE OR REPLACE FUNCTION calculate_procurement_total()
RETURNS TRIGGER AS $$
DECLARE
    total_val DECIMAL(12,2);
BEGIN
    -- Рассчитываем общую сумму заказа
    SELECT COALESCE(SUM(total_price), 0)
    INTO total_val
    FROM procurement_order_items
    WHERE procurement_order_id = NEW.procurement_order_id;

    -- Обновляем общую сумму
    UPDATE procurement_orders
    SET total_amount = total_val, updated_at = NOW()
    WHERE id = NEW.procurement_order_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматического номера заказа на закупку
CREATE OR REPLACE FUNCTION generate_procurement_order_number()
RETURNS TRIGGER AS $$
DECLARE
    company_prefix VARCHAR(10);
    next_number INTEGER;
    order_number_val VARCHAR(255);
BEGIN
    -- Если номер уже задан, не генерируем
    IF NEW.order_number IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Получаем префикс компании (первые 2-3 буквы названия)
    SELECT UPPER(LEFT(name, 3)) INTO company_prefix
    FROM companies WHERE id = NEW.company_id;

    -- Получаем следующий номер для компании
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '(\d+)$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM procurement_orders
    WHERE company_id = NEW.company_id
      AND order_number ~ (company_prefix || '-PO-\d+$');

    -- Формируем номер заказа
    order_number_val := company_prefix || '-PO-' || LPAD(next_number::TEXT, 6, '0');

    NEW.order_number := order_number_val;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггеры
CREATE TRIGGER trigger_log_order_status_change
    AFTER UPDATE ON incoming_orders
    FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

CREATE TRIGGER trigger_calculate_procurement_total
    AFTER INSERT OR UPDATE OR DELETE ON procurement_order_items
    FOR EACH ROW EXECUTE FUNCTION calculate_procurement_total();

CREATE TRIGGER trigger_generate_procurement_order_number
    BEFORE INSERT ON procurement_orders
    FOR EACH ROW EXECUTE FUNCTION generate_procurement_order_number();

-- ========================================
-- ПРОВЕРКИ И ОГРАНИЧЕНИЯ
-- ========================================

-- Проверки для настроек маркетплейсов
ALTER TABLE marketplace_settings ADD CONSTRAINT check_sync_status
    CHECK (sync_status IN ('never', 'in_progress', 'success', 'error', 'partial'));

-- Проверки для профилей экспорта
ALTER TABLE export_profiles ADD CONSTRAINT check_export_status
    CHECK (last_export_status IN ('never', 'in_progress', 'success', 'error', 'partial'));

-- Проверки для статуса товаров на маркетплейсах
ALTER TABLE marketplace_product_status ADD CONSTRAINT check_product_status
    CHECK (status IN ('not_exported', 'pending', 'published', 'rejected', 'archived', 'error'));

-- Проверки для входящих заказов
ALTER TABLE incoming_orders ADD CONSTRAINT check_order_status
    CHECK (status IN ('new', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'));

ALTER TABLE incoming_orders ADD CONSTRAINT check_payment_status
    CHECK (payment_status IN ('pending', 'paid', 'cancelled', 'refunded', 'partial_refund'));

ALTER TABLE incoming_orders ADD CONSTRAINT check_total_amount_positive
    CHECK (total_amount >= 0);

-- Проверки для товаров в заказах
ALTER TABLE incoming_order_items ADD CONSTRAINT check_item_status
    CHECK (status IN ('new', 'reserved', 'allocated', 'picked', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'));

ALTER TABLE incoming_order_items ADD CONSTRAINT check_quantity_positive
    CHECK (quantity > 0);

ALTER TABLE incoming_order_items ADD CONSTRAINT check_unit_price_positive
    CHECK (unit_price >= 0);

-- Проверки для заказов на закупку
ALTER TABLE procurement_orders ADD CONSTRAINT check_procurement_status
    CHECK (status IN ('draft', 'sent', 'confirmed', 'processing', 'shipped', 'received', 'cancelled'));

-- Проверки для товаров в заказах на закупку
ALTER TABLE procurement_order_items ADD CONSTRAINT check_procurement_item_status
    CHECK (status IN ('ordered', 'confirmed', 'shipped', 'received', 'cancelled'));

ALTER TABLE procurement_order_items ADD CONSTRAINT check_quality_check_status
    CHECK (quality_check_status IN ('pending', 'passed', 'failed', 'partial'));

-- ========================================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ========================================

-- Представление активных заказов с основной информацией
CREATE VIEW active_orders AS
SELECT
    o.id,
    o.company_id,
    o.marketplace_order_id,
    o.marketplace_id,
    o.order_number,
    o.order_date,
    o.total_amount,
    o.currency,
    o.status,
    o.payment_status,
    o.customer_name,
    o.customer_phone,
    COUNT(oi.id) as items_count,
    SUM(oi.quantity) as total_items,
    o.created_at,
    o.updated_at
FROM incoming_orders o
LEFT JOIN incoming_order_items oi ON o.id = oi.order_id
WHERE o.status NOT IN ('delivered', 'cancelled')
GROUP BY o.id;

COMMENT ON VIEW active_orders IS 'Представление активных заказов с основной информацией';

-- Представление заказов с проблемами
CREATE VIEW problematic_orders AS
SELECT
    o.id,
    o.company_id,
    o.order_number,
    o.marketplace_id,
    o.status,
    o.payment_status,
    o.order_date,
    o.total_amount,

    -- Причины проблем
    CASE
        WHEN o.status = 'new' AND o.created_at < NOW() - INTERVAL '24 hours' THEN 'not_confirmed_24h'
        WHEN o.payment_status = 'pending' AND o.created_at < NOW() - INTERVAL '48 hours' THEN 'payment_delayed'
        WHEN o.status = 'processing' AND o.processing_started < NOW() - INTERVAL '72 hours' THEN 'processing_delayed'
        WHEN EXISTS (
            SELECT 1 FROM incoming_order_items oi
            WHERE oi.order_id = o.id AND oi.product_id IS NULL
        ) THEN 'unknown_products'
        ELSE 'other'
    END as problem_type,

    o.created_at
FROM incoming_orders o
WHERE o.status NOT IN ('delivered', 'cancelled')
  AND (
    (o.status = 'new' AND o.created_at < NOW() - INTERVAL '24 hours') OR
    (o.payment_status = 'pending' AND o.created_at < NOW() - INTERVAL '48 hours') OR
    (o.status = 'processing' AND o.processing_started < NOW() - INTERVAL '72 hours') OR
    EXISTS (
        SELECT 1 FROM incoming_order_items oi
        WHERE oi.order_id = o.id AND oi.product_id IS NULL
    )
  );

COMMENT ON VIEW problematic_orders IS 'Заказы с проблемами, требующие внимания';