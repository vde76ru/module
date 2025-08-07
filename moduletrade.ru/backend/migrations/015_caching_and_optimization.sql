-- ================================================================
-- МИГРАЦИЯ 015: Система кэширования и оптимизации производительности
-- Описание: Создает систему кэширования и оптимизации для высокой производительности
-- Дата: 2025-01-27
-- Блок: Кэширование и оптимизация
-- Зависимости: Все предыдущие миграции
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Cache_Keys - Ключи кэширования
-- ================================================================
CREATE TABLE IF NOT EXISTS cache_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    cache_type VARCHAR(50) NOT NULL, -- 'products', 'prices', 'analytics', 'import'
    entity_type VARCHAR(50), -- 'product', 'brand', 'category', 'supplier'
    entity_id UUID,
    data_hash VARCHAR(64), -- Хеш данных для проверки изменений
    expires_at TIMESTAMP WITH TIME ZONE,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE cache_keys IS 'Ключи кэширования для оптимизации производительности';
COMMENT ON COLUMN cache_keys.cache_key IS 'Ключ кэша';
COMMENT ON COLUMN cache_keys.cache_type IS 'Тип кэша';
COMMENT ON COLUMN cache_keys.entity_type IS 'Тип сущности';
COMMENT ON COLUMN cache_keys.entity_id IS 'ID сущности';
COMMENT ON COLUMN cache_keys.data_hash IS 'Хеш данных для проверки изменений';
COMMENT ON COLUMN cache_keys.expires_at IS 'Время истечения кэша';
COMMENT ON COLUMN cache_keys.last_accessed IS 'Время последнего обращения';
COMMENT ON COLUMN cache_keys.access_count IS 'Количество обращений';
COMMENT ON COLUMN cache_keys.is_active IS 'Активен ли кэш';

-- ================================================================
-- ТАБЛИЦА: Cache_Invalidation_Rules - Правила инвалидации кэша
-- ================================================================
CREATE TABLE IF NOT EXISTS cache_invalidation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name VARCHAR(255) NOT NULL,
    cache_type VARCHAR(50) NOT NULL,
    trigger_table VARCHAR(100) NOT NULL,
    trigger_operation VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    conditions JSONB DEFAULT '{}'::jsonb,
    invalidation_pattern VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE cache_invalidation_rules IS 'Правила инвалидации кэша';
COMMENT ON COLUMN cache_invalidation_rules.rule_name IS 'Название правила';
COMMENT ON COLUMN cache_invalidation_rules.cache_type IS 'Тип кэша для инвалидации';
COMMENT ON COLUMN cache_invalidation_rules.trigger_table IS 'Таблица-триггер';
COMMENT ON COLUMN cache_invalidation_rules.trigger_operation IS 'Операция-триггер';
COMMENT ON COLUMN cache_invalidation_rules.conditions IS 'Условия применения правила';
COMMENT ON COLUMN cache_invalidation_rules.invalidation_pattern IS 'Паттерн инвалидации';
COMMENT ON COLUMN cache_invalidation_rules.is_active IS 'Активно ли правило';

-- ================================================================
-- ТАБЛИЦА: Performance_Metrics - Метрики производительности
-- ================================================================
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID,
    metric_type VARCHAR(50) NOT NULL, -- 'api_response_time', 'query_execution_time', 'cache_hit_rate'
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(20), -- 'ms', 'seconds', 'percentage'
    context JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE performance_metrics IS 'Метрики производительности системы';
COMMENT ON COLUMN performance_metrics.company_id IS 'Компания (NULL для системных метрик)';
COMMENT ON COLUMN performance_metrics.metric_type IS 'Тип метрики';
COMMENT ON COLUMN performance_metrics.metric_name IS 'Название метрики';
COMMENT ON COLUMN performance_metrics.metric_value IS 'Значение метрики';
COMMENT ON COLUMN performance_metrics.metric_unit IS 'Единица измерения';
COMMENT ON COLUMN performance_metrics.context IS 'Контекст метрики';
COMMENT ON COLUMN performance_metrics.recorded_at IS 'Время записи метрики';

-- ================================================================
-- ТАБЛИЦА: Sync_Schedules - Расписания синхронизации
-- ================================================================
CREATE TABLE IF NOT EXISTS sync_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    schedule_name VARCHAR(255) NOT NULL,
    schedule_type VARCHAR(50) NOT NULL, -- 'import', 'prices', 'stocks', 'orders'
    cron_expression VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_sync_schedules_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE sync_schedules IS 'Расписания синхронизации данных';
COMMENT ON COLUMN sync_schedules.company_id IS 'Компания';
COMMENT ON COLUMN sync_schedules.schedule_name IS 'Название расписания';
COMMENT ON COLUMN sync_schedules.schedule_type IS 'Тип расписания';
COMMENT ON COLUMN sync_schedules.cron_expression IS 'Cron выражение';
COMMENT ON COLUMN sync_schedules.is_active IS 'Активно ли расписание';
COMMENT ON COLUMN sync_schedules.last_run IS 'Время последнего запуска';
COMMENT ON COLUMN sync_schedules.next_run IS 'Время следующего запуска';
COMMENT ON COLUMN sync_schedules.settings IS 'Настройки расписания';

-- ================================================================
-- ТАБЛИЦА: Data_Change_Logs - Логи изменений данных
-- ================================================================
CREATE TABLE IF NOT EXISTS data_change_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    operation VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    changed_fields JSONB,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_data_change_logs_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_data_change_logs_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE data_change_logs IS 'Логи изменений данных для инвалидации кэша';
COMMENT ON COLUMN data_change_logs.company_id IS 'Компания';
COMMENT ON COLUMN data_change_logs.table_name IS 'Название таблицы';
COMMENT ON COLUMN data_change_logs.record_id IS 'ID записи';
COMMENT ON COLUMN data_change_logs.operation IS 'Операция';
COMMENT ON COLUMN data_change_logs.old_data IS 'Старые данные';
COMMENT ON COLUMN data_change_logs.new_data IS 'Новые данные';
COMMENT ON COLUMN data_change_logs.changed_fields IS 'Измененные поля';
COMMENT ON COLUMN data_change_logs.user_id IS 'Пользователь';
COMMENT ON COLUMN data_change_logs.ip_address IS 'IP адрес';
COMMENT ON COLUMN data_change_logs.user_agent IS 'User Agent';

-- ================================================================
-- ИНДЕКСЫ
-- ================================================================

-- Индексы для cache_keys
CREATE INDEX IF NOT EXISTS idx_cache_keys_cache_key ON cache_keys (cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_keys_cache_type ON cache_keys (cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_keys_entity_type ON cache_keys (entity_type);
CREATE INDEX IF NOT EXISTS idx_cache_keys_entity_id ON cache_keys (entity_id);
CREATE INDEX IF NOT EXISTS idx_cache_keys_expires_at ON cache_keys (expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_keys_last_accessed ON cache_keys (last_accessed);
CREATE INDEX IF NOT EXISTS idx_cache_keys_is_active ON cache_keys (is_active);

-- Индексы для cache_invalidation_rules
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_rules_cache_type ON cache_invalidation_rules (cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_rules_trigger_table ON cache_invalidation_rules (trigger_table);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_rules_trigger_operation ON cache_invalidation_rules (trigger_operation);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_rules_is_active ON cache_invalidation_rules (is_active);

-- Индексы для performance_metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_company_id ON performance_metrics (company_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_type ON performance_metrics (metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_name ON performance_metrics (metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics (recorded_at);

-- Индексы для sync_schedules
CREATE INDEX IF NOT EXISTS idx_sync_schedules_company_id ON sync_schedules (company_id);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_schedule_type ON sync_schedules (schedule_type);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_is_active ON sync_schedules (is_active);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_next_run ON sync_schedules (next_run);

-- Индексы для data_change_logs
CREATE INDEX IF NOT EXISTS idx_data_change_logs_company_id ON data_change_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_data_change_logs_table_name ON data_change_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_data_change_logs_record_id ON data_change_logs (record_id);
CREATE INDEX IF NOT EXISTS idx_data_change_logs_operation ON data_change_logs (operation);
CREATE INDEX IF NOT EXISTS idx_data_change_logs_created_at ON data_change_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_data_change_logs_user_id ON data_change_logs (user_id);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_cache_keys_updated_at
    BEFORE UPDATE ON cache_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_invalidation_rules_updated_at
    BEFORE UPDATE ON cache_invalidation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_schedules_updated_at
    BEFORE UPDATE ON sync_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ
-- ================================================================

-- Функция для генерации ключа кэша
CREATE OR REPLACE FUNCTION generate_cache_key(
    p_cache_type VARCHAR(50),
    p_entity_type VARCHAR(50) DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_additional_params JSONB DEFAULT '{}'::jsonb
) RETURNS VARCHAR(255) AS $$
DECLARE
    v_cache_key VARCHAR(255);
    v_params_hash VARCHAR(64);
BEGIN
    -- Формируем базовый ключ
    v_cache_key := p_cache_type;

    -- Добавляем тип сущности
    IF p_entity_type IS NOT NULL THEN
        v_cache_key := v_cache_key || ':' || p_entity_type;
    END IF;

    -- Добавляем ID сущности
    IF p_entity_id IS NOT NULL THEN
        v_cache_key := v_cache_key || ':' || p_entity_id::TEXT;
    END IF;

    -- Добавляем хеш дополнительных параметров
    IF p_additional_params IS NOT NULL AND p_additional_params != '{}'::jsonb THEN
        v_params_hash := encode(sha256(p_additional_params::TEXT::BYTEA), 'hex');
        v_cache_key := v_cache_key || ':' || substring(v_params_hash from 1 for 8);
    END IF;

    RETURN v_cache_key;
END;
$$ LANGUAGE plpgsql;

-- Функция для проверки актуальности кэша
CREATE OR REPLACE FUNCTION is_cache_valid(
    p_cache_key VARCHAR(255),
    p_current_hash VARCHAR(64) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_cache_record RECORD;
BEGIN
    -- Получаем запись кэша
    SELECT * INTO v_cache_record
    FROM cache_keys
    WHERE cache_key = p_cache_key
      AND is_active = TRUE;

    -- Если кэш не найден
    IF v_cache_record.id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Проверяем время истечения
    IF v_cache_record.expires_at IS NOT NULL AND v_cache_record.expires_at < CURRENT_TIMESTAMP THEN
        RETURN FALSE;
    END IF;

    -- Проверяем хеш данных
    IF p_current_hash IS NOT NULL AND v_cache_record.data_hash IS NOT NULL THEN
        IF v_cache_record.data_hash != p_current_hash THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Обновляем время последнего обращения
    UPDATE cache_keys
    SET
        last_accessed = CURRENT_TIMESTAMP,
        access_count = access_count + 1
    WHERE id = v_cache_record.id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Функция для инвалидации кэша
CREATE OR REPLACE FUNCTION invalidate_cache(
    p_cache_type VARCHAR(50),
    p_entity_type VARCHAR(50) DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_invalidated_count INTEGER := 0;
    v_pattern VARCHAR(255);
BEGIN
    -- Формируем паттерн для поиска
    v_pattern := p_cache_type;
    IF p_entity_type IS NOT NULL THEN
        v_pattern := v_pattern || ':' || p_entity_type;
    END IF;
    IF p_entity_id IS NOT NULL THEN
        v_pattern := v_pattern || ':' || p_entity_id::TEXT;
    END IF;

    -- Инвалидируем кэш
    UPDATE cache_keys
    SET is_active = FALSE
    WHERE cache_key LIKE v_pattern || '%'
      AND is_active = TRUE;

    GET DIAGNOSTICS v_invalidated_count = ROW_COUNT;

    RETURN v_invalidated_count;
END;
$$ LANGUAGE plpgsql;

-- Функция для очистки устаревшего кэша
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    v_cleaned_count INTEGER := 0;
BEGIN
    -- Удаляем истекший кэш
    DELETE FROM cache_keys
    WHERE expires_at IS NOT NULL
      AND expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;

    -- Деактивируем кэш, к которому не обращались более 24 часов
    UPDATE cache_keys
    SET is_active = FALSE
    WHERE last_accessed < CURRENT_TIMESTAMP - INTERVAL '24 hours'
      AND is_active = TRUE;

    RETURN v_cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Функция для записи метрики производительности
CREATE OR REPLACE FUNCTION record_performance_metric(
    p_company_id UUID,
    p_metric_type VARCHAR(50),
    p_metric_name VARCHAR(100),
    p_metric_value DECIMAL(15,6),
    p_metric_unit VARCHAR(20) DEFAULT 'ms',
    p_context JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO performance_metrics (
        company_id, metric_type, metric_name, metric_value,
        metric_unit, context, recorded_at
    ) VALUES (
        p_company_id, p_metric_type, p_metric_name, p_metric_value,
        p_metric_unit, p_context, CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- Функция для получения средних метрик производительности
CREATE OR REPLACE FUNCTION get_performance_metrics(
    p_company_id UUID DEFAULT NULL,
    p_metric_type VARCHAR(50) DEFAULT NULL,
    p_hours INTEGER DEFAULT 24
) RETURNS TABLE(
    metric_type VARCHAR(50),
    metric_name VARCHAR(100),
    avg_value DECIMAL(15,6),
    min_value DECIMAL(15,6),
    max_value DECIMAL(15,6),
    count_records BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pm.metric_type,
        pm.metric_name,
        AVG(pm.metric_value) as avg_value,
        MIN(pm.metric_value) as min_value,
        MAX(pm.metric_value) as max_value,
        COUNT(*) as count_records
    FROM performance_metrics pm
    WHERE (p_company_id IS NULL OR pm.company_id = p_company_id)
      AND (p_metric_type IS NULL OR pm.metric_type = p_metric_type)
      AND pm.recorded_at >= CURRENT_TIMESTAMP - (p_hours || ' hours')::INTERVAL
    GROUP BY pm.metric_type, pm.metric_name
    ORDER BY pm.metric_type, pm.metric_name;
END;
$$ LANGUAGE plpgsql;

-- Функция для планирования следующего запуска синхронизации
CREATE OR REPLACE FUNCTION schedule_next_sync(
    p_schedule_id UUID
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    v_schedule RECORD;
    v_next_run TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Получаем расписание
    SELECT * INTO v_schedule
    FROM sync_schedules
    WHERE id = p_schedule_id;

    -- Здесь должна быть логика парсинга cron выражения
    -- Для простоты используем базовую логику
    v_next_run := CURRENT_TIMESTAMP + INTERVAL '1 hour';

    -- Обновляем расписание
    UPDATE sync_schedules
    SET
        last_run = CURRENT_TIMESTAMP,
        next_run = v_next_run
    WHERE id = p_schedule_id;

    RETURN v_next_run;
END;
$$ LANGUAGE plpgsql;

-- Функция для логирования изменений данных
CREATE OR REPLACE FUNCTION log_data_change(
    p_table_name VARCHAR(100),
    p_record_id UUID,
    p_operation VARCHAR(20),
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_company_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_changed_fields JSONB := '{}'::jsonb;
    v_key TEXT;
BEGIN
    -- Определяем измененные поля
    IF p_old_data IS NOT NULL AND p_new_data IS NOT NULL THEN
        FOR v_key IN SELECT jsonb_object_keys(p_new_data)
        LOOP
            IF p_old_data->>v_key IS DISTINCT FROM p_new_data->>v_key THEN
                v_changed_fields := v_changed_fields || jsonb_build_object(v_key, true);
            END IF;
        END LOOP;
    END IF;

    -- Записываем лог
    INSERT INTO data_change_logs (
        company_id, table_name, record_id, operation,
        old_data, new_data, changed_fields, user_id
    ) VALUES (
        p_company_id, p_table_name, p_record_id, p_operation,
        p_old_data, p_new_data, v_changed_fields, p_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ТРИГГЕРЫ ДЛЯ ИНВАЛИДАЦИИ КЭША
-- ================================================================

-- Триггер для инвалидации кэша товаров
CREATE OR REPLACE FUNCTION invalidate_products_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Инвалидируем кэш товаров
    PERFORM invalidate_cache('products', 'product', NEW.id);

    -- Инвалидируем кэш категорий
    IF TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id THEN
        PERFORM invalidate_cache('categories', 'category', OLD.category_id);
        PERFORM invalidate_cache('categories', 'category', NEW.category_id);
    END IF;

    -- Инвалидируем кэш брендов
    IF TG_OP = 'UPDATE' AND OLD.brand_id IS DISTINCT FROM NEW.brand_id THEN
        PERFORM invalidate_cache('brands', 'brand', OLD.brand_id);
        PERFORM invalidate_cache('brands', 'brand', NEW.brand_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invalidate_products_cache
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION invalidate_products_cache();

-- Триггер для инвалидации кэша цен
CREATE OR REPLACE FUNCTION invalidate_prices_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Инвалидируем кэш цен
    PERFORM invalidate_cache('prices', 'product', NEW.product_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invalidate_prices_cache
    AFTER INSERT OR UPDATE OR DELETE ON prices
    FOR EACH ROW
    EXECUTE FUNCTION invalidate_prices_cache();

-- Триггер для инвалидации кэша остатков
CREATE OR REPLACE FUNCTION invalidate_stocks_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Инвалидируем кэш остатков
    PERFORM invalidate_cache('stocks', 'product', NEW.product_id);
    PERFORM invalidate_cache('stocks', 'warehouse', NEW.warehouse_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invalidate_stocks_cache
    AFTER INSERT OR UPDATE OR DELETE ON warehouse_product_links
    FOR EACH ROW
    EXECUTE FUNCTION invalidate_stocks_cache();

-- ================================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ
-- ================================================================

-- Создаем базовые правила инвалидации кэша
INSERT INTO cache_invalidation_rules (rule_name, cache_type, trigger_table, trigger_operation, invalidation_pattern) VALUES
('Products cache invalidation', 'products', 'products', 'UPDATE', 'products:product:*'),
('Prices cache invalidation', 'prices', 'prices', 'UPDATE', 'prices:product:*'),
    ('Stocks cache invalidation', 'stocks', 'warehouse_product_links', 'UPDATE', 'stocks:product:*'),
('Categories cache invalidation', 'categories', 'categories', 'UPDATE', 'categories:category:*'),
('Brands cache invalidation', 'brands', 'brands', 'UPDATE', 'brands:brand:*');

-- Создаем базовые расписания синхронизации
INSERT INTO sync_schedules (company_id, schedule_name, schedule_type, cron_expression, settings) VALUES
('00000000-0000-0000-0000-000000000000', 'Daily prices sync', 'prices', '0 2 * * *', '{"sync_type": "full"}'),
('00000000-0000-0000-0000-000000000000', 'Hourly stocks sync', 'stocks', '0 * * * *', '{"sync_type": "incremental"}'),
('00000000-0000-0000-0000-000000000000', 'Weekly products sync', 'import', '0 3 * * 0', '{"sync_type": "full"}'),
('00000000-0000-0000-0000-000000000000', 'Daily orders sync', 'orders', '0 1 * * *', '{"sync_type": "incremental"}');

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 015
-- ================================================================