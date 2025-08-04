-- ========================================
-- МИГРАЦИЯ 010: НЕДОСТАЮЩИЕ ТАБЛИЦЫ И ПОЛЯ
-- Добавление таблиц и полей, используемых в коде
-- Версия: 2.1 (Исправленная)
-- ========================================

-- ========================================
-- ТАБЛИЦА МАРКЕТПЛЕЙСОВ (Глобальный справочник)
-- ========================================
CREATE TABLE IF NOT EXISTS marketplaces (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    api_type VARCHAR(50) NOT NULL,
    api_config JSONB DEFAULT '{}',
    commission_rules JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketplaces IS 'Глобальный справочник маркетплейсов';


-- ========================================
-- ТАБЛИЦА ЛОГОВ СИНХРОНИЗАЦИИ
-- ========================================

CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    sync_type VARCHAR(50) NOT NULL, -- stock, orders, products, prices
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed

    -- Детали синхронизации
    details JSONB DEFAULT '{}',
    error_message TEXT,

    -- Временные метки
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Статистика
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE sync_logs IS 'Логи синхронизации данных с внешними системами';

-- ========================================
-- ТАБЛИЦА API ЛОГОВ
-- ========================================

CREATE TABLE IF NOT EXISTS api_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Информация о запросе
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status VARCHAR(50) DEFAULT 'success', -- success, error, rate_limited

    -- Детали
    request_body JSONB,
    response_code INTEGER,
    response_time_ms INTEGER,

    -- Метаданные
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE api_logs IS 'Логи API запросов для мониторинга и биллинга';

-- ========================================
-- ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ ПОЛЕЙ
-- ========================================

-- Добавляем поля клиента в таблицу incoming_orders
DO $$
BEGIN
    -- Проверяем существует ли таблица incoming_orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incoming_orders') THEN
        -- Добавляем поле customer_name если не существует
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'incoming_orders' AND column_name = 'customer_name') THEN
            ALTER TABLE incoming_orders ADD COLUMN customer_name VARCHAR(255);
        END IF;

        -- Добавляем поле customer_email если не существует
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'incoming_orders' AND column_name = 'customer_email') THEN
            ALTER TABLE incoming_orders ADD COLUMN customer_email VARCHAR(255);
        END IF;

        -- Добавляем поле customer_phone если не существует
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'incoming_orders' AND column_name = 'customer_phone') THEN
            ALTER TABLE incoming_orders ADD COLUMN customer_phone VARCHAR(50);
        END IF;
    END IF;
END $$;

-- Добавляем поле sku в таблицу products
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        -- Добавляем поле sku если не существует
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'products' AND column_name = 'sku') THEN
            ALTER TABLE products ADD COLUMN sku VARCHAR(255);

            -- Создаем уникальный индекс для company_id + sku
            CREATE UNIQUE INDEX IF NOT EXISTS idx_products_company_sku ON products(company_id, sku);

            -- Заполняем sku из internal_code
            UPDATE products SET sku = internal_code WHERE sku IS NULL;
        END IF;
    END IF;
END $$;

-- ========================================
-- ИСПРАВЛЕНИЕ ТАБЛИЦЫ marketplace_settings
-- ========================================

-- Проверяем, существует ли старая таблица tenant_integrations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_integrations') THEN
        -- Удаляем старую таблицу
        DROP TABLE IF EXISTS tenant_integrations CASCADE;
    END IF;
END $$;

-- ========================================
-- ИНДЕКСЫ ДЛЯ НОВЫХ ТАБЛИЦ
-- ========================================

-- Индексы для sync_logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_company_id ON sync_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_completed_at ON sync_logs(completed_at);

-- Составные индексы для sync_logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_company_type_status ON sync_logs(company_id, sync_type, status);

-- Индексы для api_logs
CREATE INDEX IF NOT EXISTS idx_api_logs_company_id ON api_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_logs_method ON api_logs(method);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs(status);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at);

-- Составные индексы для api_logs
CREATE INDEX IF NOT EXISTS idx_api_logs_company_endpoint ON api_logs(company_id, endpoint);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_endpoint ON api_logs(user_id, endpoint);

-- ========================================
-- ТРИГГЕРЫ ДЛЯ НОВЫХ ТАБЛИЦ
-- ========================================

-- Функция для автоматического обновления статуса sync_logs
CREATE OR REPLACE FUNCTION auto_fail_stuck_sync_logs()
RETURNS void AS $$
BEGIN
    -- Автоматически помечаем как failed синхронизации, которые висят больше часа
    UPDATE sync_logs
    SET
        status = 'failed',
        error_message = 'Sync timeout - automatically failed after 1 hour',
        completed_at = NOW()
    WHERE
        status IN ('pending', 'processing')
        AND started_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ПРОВЕРКИ И ОГРАНИЧЕНИЯ
-- ========================================

-- Проверки для sync_logs
ALTER TABLE sync_logs ADD CONSTRAINT check_sync_type
    CHECK (sync_type IN ('stock', 'orders', 'products', 'prices', 'full'));

ALTER TABLE sync_logs ADD CONSTRAINT check_sync_status
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- Проверки для api_logs
ALTER TABLE api_logs ADD CONSTRAINT check_api_method
    CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'));

ALTER TABLE api_logs ADD CONSTRAINT check_api_status
    CHECK (status IN ('success', 'error', 'rate_limited', 'unauthorized'));

-- ========================================
-- ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ ИНДЕКСОВ В СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ
-- ========================================

-- Добавляем недостающие индексы для products если они не существуют
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        -- Индекс для sku
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_sku') THEN
            CREATE INDEX idx_products_sku ON products(sku);
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incoming_orders') THEN
        -- Индексы для полей клиента
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_incoming_orders_customer_name') THEN
            CREATE INDEX idx_incoming_orders_customer_name ON incoming_orders(customer_name);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_incoming_orders_customer_email') THEN
            CREATE INDEX idx_incoming_orders_customer_email ON incoming_orders(customer_email);
        END IF;
    END IF;
END $$;

-- ========================================
-- КОММЕНТАРИИ К ПОЛЯМ
-- ========================================

COMMENT ON COLUMN sync_logs.sync_type IS 'Тип синхронизации: stock, orders, products, prices, full';
COMMENT ON COLUMN sync_logs.status IS 'Статус синхронизации: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN api_logs.status IS 'Статус API запроса: success, error, rate_limited, unauthorized';

-- Комментарии для полей products
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'products' AND column_name = 'sku') THEN
        COMMENT ON COLUMN products.sku IS 'Stock Keeping Unit - уникальный идентификатор товара в рамках компании';
    END IF;
END $$;