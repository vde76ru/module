-- ================================================================
-- МИГРАЦИЯ 009: Дополнительные таблицы для логирования и закупок
-- Описание: Создает таблицы для синхронизации, API логов, закупок у поставщиков
-- Дата: 2025-01-27
-- Блок: Логирование и Закупки
-- Зависимости: 002 (companies), 004 (suppliers), 006 (orders)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Sync_Logs - Логи синхронизации
-- ================================================================
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    marketplace_id UUID,
    sync_id VARCHAR(255),
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    results JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    details JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_sync_logs_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sync_logs_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE sync_logs IS 'Логи синхронизации данных';
COMMENT ON COLUMN sync_logs.company_id IS 'Компания';
COMMENT ON COLUMN sync_logs.marketplace_id IS 'Маркетплейс для синхронизации';
COMMENT ON COLUMN sync_logs.sync_id IS 'Уникальный ID синхронизации';
COMMENT ON COLUMN sync_logs.sync_type IS 'Тип синхронизации: products, orders, inventory, marketplaces';
COMMENT ON COLUMN sync_logs.status IS 'Статус: pending, running, completed, failed';
COMMENT ON COLUMN sync_logs.results IS 'Результаты синхронизации';
COMMENT ON COLUMN sync_logs.started_at IS 'Время начала синхронизации';
COMMENT ON COLUMN sync_logs.completed_at IS 'Время завершения синхронизации';
COMMENT ON COLUMN sync_logs.error_message IS 'Сообщение об ошибке';
COMMENT ON COLUMN sync_logs.items_processed IS 'Количество обработанных элементов';
COMMENT ON COLUMN sync_logs.items_succeeded IS 'Количество успешно обработанных элементов';
COMMENT ON COLUMN sync_logs.items_failed IS 'Количество элементов с ошибками';
COMMENT ON COLUMN sync_logs.details IS 'Детали синхронизации в формате JSON';
COMMENT ON COLUMN sync_logs.metadata IS 'Дополнительные метаданные';

CREATE INDEX idx_sync_logs_company_id ON sync_logs (company_id);
CREATE INDEX idx_sync_logs_marketplace_id ON sync_logs (marketplace_id);
CREATE INDEX idx_sync_logs_sync_id ON sync_logs (sync_id);
CREATE INDEX idx_sync_logs_sync_type ON sync_logs (sync_type);
CREATE INDEX idx_sync_logs_status ON sync_logs (status);
CREATE INDEX idx_sync_logs_started_at ON sync_logs (started_at DESC);
CREATE INDEX idx_sync_logs_completed_at ON sync_logs (completed_at DESC);
CREATE INDEX idx_sync_logs_company_type_status ON sync_logs (company_id, sync_type, status);

-- ================================================================
-- ТАБЛИЦА: API_Logs - Логи API запросов
-- ================================================================
CREATE TABLE api_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID,
    user_id UUID,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'success',
    response_code INTEGER,
    response_time_ms INTEGER,
    request_body JSONB,
    response_body JSONB,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_api_logs_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_api_logs_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE api_logs IS 'Логи API запросов';
COMMENT ON COLUMN api_logs.company_id IS 'Компания (если применимо)';
COMMENT ON COLUMN api_logs.user_id IS 'Пользователь, сделавший запрос';
COMMENT ON COLUMN api_logs.endpoint IS 'Endpoint API';
COMMENT ON COLUMN api_logs.method IS 'HTTP метод';
COMMENT ON COLUMN api_logs.status IS 'Статус запроса: success, error, timeout';
COMMENT ON COLUMN api_logs.response_code IS 'HTTP статус код';
COMMENT ON COLUMN api_logs.response_time_ms IS 'Время ответа в миллисекундах';
COMMENT ON COLUMN api_logs.request_body IS 'Тело запроса';
COMMENT ON COLUMN api_logs.response_body IS 'Тело ответа';
COMMENT ON COLUMN api_logs.error_message IS 'Сообщение об ошибке';
COMMENT ON COLUMN api_logs.ip_address IS 'IP адрес клиента';
COMMENT ON COLUMN api_logs.user_agent IS 'User Agent клиента';
COMMENT ON COLUMN api_logs.request_id IS 'Уникальный ID запроса';
COMMENT ON COLUMN api_logs.metadata IS 'Дополнительные данные';

CREATE INDEX idx_api_logs_company_id ON api_logs (company_id);
CREATE INDEX idx_api_logs_user_id ON api_logs (user_id);
CREATE INDEX idx_api_logs_endpoint ON api_logs (endpoint);
CREATE INDEX idx_api_logs_method ON api_logs (method);
CREATE INDEX idx_api_logs_status ON api_logs (status);
CREATE INDEX idx_api_logs_response_code ON api_logs (response_code);
CREATE INDEX idx_api_logs_created_at ON api_logs (created_at DESC);
CREATE INDEX idx_api_logs_request_id ON api_logs (request_id);
CREATE INDEX idx_api_logs_response_time_ms ON api_logs (response_time_ms);

-- ================================================================
-- ТАБЛИЦА: Supplier_Orders - Заказы у поставщиков
-- ================================================================
CREATE TABLE supplier_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    order_number VARCHAR(100) NOT NULL,
    external_order_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'RUB',
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expected_delivery_date TIMESTAMP WITH TIME ZONE,
    actual_delivery_date TIMESTAMP WITH TIME ZONE,
    payment_terms VARCHAR(100),
    payment_status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_supplier_orders_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_orders_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_orders_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE supplier_orders IS 'Заказы у поставщиков';
COMMENT ON COLUMN supplier_orders.company_id IS 'Компания-заказчик';
COMMENT ON COLUMN supplier_orders.supplier_id IS 'Поставщик';
COMMENT ON COLUMN supplier_orders.order_number IS 'Номер заказа';
COMMENT ON COLUMN supplier_orders.external_order_number IS 'Номер заказа в системе поставщика';
COMMENT ON COLUMN supplier_orders.status IS 'Статус заказа: pending, confirmed, shipped, delivered, cancelled';
COMMENT ON COLUMN supplier_orders.total_amount IS 'Общая сумма заказа';
COMMENT ON COLUMN supplier_orders.currency IS 'Валюта заказа';
COMMENT ON COLUMN supplier_orders.order_date IS 'Дата заказа';
COMMENT ON COLUMN supplier_orders.expected_delivery_date IS 'Ожидаемая дата доставки';
COMMENT ON COLUMN supplier_orders.actual_delivery_date IS 'Фактическая дата доставки';
COMMENT ON COLUMN supplier_orders.payment_terms IS 'Условия оплаты';
COMMENT ON COLUMN supplier_orders.payment_status IS 'Статус оплаты: pending, paid, overdue';
COMMENT ON COLUMN supplier_orders.notes IS 'Примечания к заказу';
COMMENT ON COLUMN supplier_orders.metadata IS 'Дополнительные данные';
COMMENT ON COLUMN supplier_orders.created_by IS 'Пользователь, создавший заказ';

ALTER TABLE supplier_orders ADD CONSTRAINT supplier_orders_number_unique_per_company
    UNIQUE (company_id, order_number);

CREATE INDEX idx_supplier_orders_company_id ON supplier_orders (company_id);
CREATE INDEX idx_supplier_orders_supplier_id ON supplier_orders (supplier_id);
CREATE INDEX idx_supplier_orders_order_number ON supplier_orders (order_number);
CREATE INDEX idx_supplier_orders_status ON supplier_orders (status);
CREATE INDEX idx_supplier_orders_order_date ON supplier_orders (order_date DESC);
CREATE INDEX idx_supplier_orders_payment_status ON supplier_orders (payment_status);
CREATE INDEX idx_supplier_orders_expected_delivery ON supplier_orders (expected_delivery_date);
CREATE INDEX idx_supplier_orders_created_by ON supplier_orders (created_by);

-- ================================================================
-- ТАБЛИЦА: Supplier_Order_Items - Позиции заказов у поставщиков
-- ================================================================
CREATE TABLE supplier_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    external_product_id VARCHAR(255),
    name VARCHAR(500),
    quantity DECIMAL(12,3) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    received_quantity DECIMAL(12,3) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_supplier_order_items_order_id
        FOREIGN KEY (order_id) REFERENCES supplier_orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_order_items_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE supplier_order_items IS 'Позиции заказов у поставщиков';
COMMENT ON COLUMN supplier_order_items.order_id IS 'Заказ у поставщика';
COMMENT ON COLUMN supplier_order_items.product_id IS 'Товар';
COMMENT ON COLUMN supplier_order_items.external_product_id IS 'ID товара в системе поставщика';
COMMENT ON COLUMN supplier_order_items.name IS 'Название товара в заказе';
COMMENT ON COLUMN supplier_order_items.quantity IS 'Заказанное количество';
COMMENT ON COLUMN supplier_order_items.price IS 'Цена за единицу';
COMMENT ON COLUMN supplier_order_items.total_price IS 'Общая стоимость позиции';
COMMENT ON COLUMN supplier_order_items.received_quantity IS 'Полученное количество';
COMMENT ON COLUMN supplier_order_items.status IS 'Статус позиции: pending, confirmed, shipped, received, cancelled';
COMMENT ON COLUMN supplier_order_items.notes IS 'Примечания к позиции';
COMMENT ON COLUMN supplier_order_items.metadata IS 'Дополнительные данные';

CREATE INDEX idx_supplier_order_items_order_id ON supplier_order_items (order_id);
CREATE INDEX idx_supplier_order_items_product_id ON supplier_order_items (product_id);
CREATE INDEX idx_supplier_order_items_external_product_id ON supplier_order_items (external_product_id);
CREATE INDEX idx_supplier_order_items_status ON supplier_order_items (status);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_sync_logs_updated_at
    BEFORE UPDATE ON sync_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_orders_updated_at
    BEFORE UPDATE ON supplier_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_order_items_updated_at
    BEFORE UPDATE ON supplier_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С ЗАКУПКАМИ
-- ================================================================

-- Функция для расчета общей суммы заказа у поставщика
CREATE OR REPLACE FUNCTION calculate_supplier_order_total(p_order_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_total DECIMAL;
BEGIN
    SELECT COALESCE(SUM(total_price), 0)
    INTO v_total
    FROM supplier_order_items
    WHERE order_id = p_order_id;

    -- Обновляем общую сумму заказа
    UPDATE supplier_orders
    SET total_amount = v_total,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_order_id;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения статистики синхронизации
CREATE OR REPLACE FUNCTION get_sync_stats(
    p_company_id UUID,
    p_sync_type VARCHAR DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    sync_type VARCHAR,
    total_syncs BIGINT,
    successful_syncs BIGINT,
    failed_syncs BIGINT,
    avg_duration_minutes NUMERIC,
    last_sync_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sl.sync_type,
        COUNT(*) as total_syncs,
        COUNT(*) FILTER (WHERE sl.status = 'completed') as successful_syncs,
        COUNT(*) FILTER (WHERE sl.status = 'failed') as failed_syncs,
        AVG(EXTRACT(EPOCH FROM (sl.completed_at - sl.started_at)) / 60) as avg_duration_minutes,
        MAX(sl.started_at) as last_sync_at
    FROM sync_logs sl
    WHERE sl.company_id = p_company_id
        AND (p_sync_type IS NULL OR sl.sync_type = p_sync_type)
        AND sl.started_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * p_days
    GROUP BY sl.sync_type
    ORDER BY sl.sync_type;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 009
-- ================================================================