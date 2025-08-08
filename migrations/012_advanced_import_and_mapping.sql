-- ================================================================
-- МИГРАЦИЯ 012: Продвинутая система импорта товаров и маппинга
-- Описание: Создает таблицы для импорта товаров от поставщиков, маппинга и обработки
-- Дата: 2025-01-27
-- Блок: Импорт и маппинг товаров
-- Зависимости: Все предыдущие миграции
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Supplier_Product_Mappings - Маппинг товаров к поставщикам
-- ================================================================
CREATE TABLE IF NOT EXISTS supplier_product_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    product_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    external_product_id VARCHAR(255) NOT NULL,
    external_sku VARCHAR(255),
    external_name VARCHAR(500),
    external_brand VARCHAR(255), -- Бренд от поставщика
    external_article VARCHAR(255), -- Артикул от поставщика
    external_data JSONB DEFAULT '{}'::jsonb,
    is_primary BOOLEAN DEFAULT FALSE, -- Основной поставщик для товара
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_supplier_product_mappings_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_product_mappings_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_product_mappings_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_supplier_product_mappings_unique
        UNIQUE (company_id, supplier_id, external_product_id)
);

COMMENT ON TABLE supplier_product_mappings IS 'Маппинг товаров к поставщикам';
COMMENT ON COLUMN supplier_product_mappings.company_id IS 'Компания';
COMMENT ON COLUMN supplier_product_mappings.product_id IS 'Товар';
COMMENT ON COLUMN supplier_product_mappings.supplier_id IS 'Поставщик';
COMMENT ON COLUMN supplier_product_mappings.external_product_id IS 'Внешний ID товара у поставщика';
COMMENT ON COLUMN supplier_product_mappings.external_sku IS 'Внешний SKU товара';
COMMENT ON COLUMN supplier_product_mappings.external_name IS 'Внешнее название товара';
COMMENT ON COLUMN supplier_product_mappings.external_brand IS 'Бренд от поставщика';
COMMENT ON COLUMN supplier_product_mappings.external_article IS 'Артикул от поставщика';
COMMENT ON COLUMN supplier_product_mappings.external_data IS 'Внешние данные товара';
COMMENT ON COLUMN supplier_product_mappings.is_primary IS 'Основной поставщик для товара';
COMMENT ON COLUMN supplier_product_mappings.is_active IS 'Активен ли маппинг';
COMMENT ON COLUMN supplier_product_mappings.last_sync_at IS 'Дата последней синхронизации';
COMMENT ON COLUMN supplier_product_mappings.sync_status IS 'Статус синхронизации';

-- ================================================================
-- ОБНОВЛЕНИЕ ТАБЛИЦЫ: Brand_Supplier_Mappings - Добавляем новые поля
-- ================================================================
ALTER TABLE brand_supplier_mappings ADD COLUMN IF NOT EXISTS external_brand_id VARCHAR(255);
ALTER TABLE brand_supplier_mappings ADD COLUMN IF NOT EXISTS external_brand_name VARCHAR(255);
ALTER TABLE brand_supplier_mappings ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;
ALTER TABLE brand_supplier_mappings ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN brand_supplier_mappings.external_brand_id IS 'Внешний ID бренда';
COMMENT ON COLUMN brand_supplier_mappings.external_brand_name IS 'Внешнее название бренда';
COMMENT ON COLUMN brand_supplier_mappings.is_primary IS 'Основной поставщик для бренда';
COMMENT ON COLUMN brand_supplier_mappings.is_exclusive IS 'Эксклюзивный поставщик для бренда';

-- ================================================================
-- ТАБЛИЦА: Product_Matching_Rules - Правила сопоставления товаров
-- ================================================================
CREATE TABLE IF NOT EXISTS product_matching_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'brand_article', 'name_similarity', 'barcode', 'custom'
    priority INTEGER DEFAULT 0,
    conditions JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_matching_rules_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_matching_rules IS 'Правила сопоставления товаров при импорте';
COMMENT ON COLUMN product_matching_rules.company_id IS 'Компания';
COMMENT ON COLUMN product_matching_rules.name IS 'Название правила';
COMMENT ON COLUMN product_matching_rules.rule_type IS 'Тип правила сопоставления';
COMMENT ON COLUMN product_matching_rules.priority IS 'Приоритет правила';
COMMENT ON COLUMN product_matching_rules.conditions IS 'Условия применения правила';
COMMENT ON COLUMN product_matching_rules.settings IS 'Настройки правила';
COMMENT ON COLUMN product_matching_rules.is_active IS 'Активно ли правило';

-- ================================================================
-- ОБНОВЛЕНИЕ ТАБЛИЦЫ: Name_Processing_Rules - Добавляем новые поля
-- ================================================================
ALTER TABLE name_processing_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN name_processing_rules.enabled IS 'Включено ли правило';

-- ================================================================
-- ОБНОВЛЕНИЕ ТАБЛИЦЫ: Attribute_Mappings - Добавляем новые поля
-- ================================================================
ALTER TABLE attribute_mappings ADD COLUMN IF NOT EXISTS internal_attribute_id UUID;

COMMENT ON COLUMN attribute_mappings.internal_attribute_id IS 'Внутренний атрибут для маппинга';

-- ================================================================
-- ОБНОВЛЕНИЕ ТАБЛИЦЫ: Category_Mappings - Добавляем новые поля
-- ================================================================
-- Поле internal_category_id уже существует

-- ================================================================
-- ОБНОВЛЕНИЕ ТАБЛИЦЫ: External_Categories - Добавляем новые поля
-- ================================================================
-- Поле level уже существует

-- ================================================================
-- ТАБЛИЦА: Import_Sessions - Сессии импорта
-- ================================================================
CREATE TABLE IF NOT EXISTS import_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    session_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'brands', 'categories'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    success_items INTEGER DEFAULT 0,
    error_items INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_import_sessions_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_import_sessions_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE import_sessions IS 'Сессии импорта товаров от поставщиков';
COMMENT ON COLUMN import_sessions.company_id IS 'Компания';
COMMENT ON COLUMN import_sessions.supplier_id IS 'Поставщик';
COMMENT ON COLUMN import_sessions.session_type IS 'Тип сессии импорта';
COMMENT ON COLUMN import_sessions.status IS 'Статус сессии';
COMMENT ON COLUMN import_sessions.started_at IS 'Время начала импорта';
COMMENT ON COLUMN import_sessions.completed_at IS 'Время завершения импорта';
COMMENT ON COLUMN import_sessions.total_items IS 'Общее количество элементов';
COMMENT ON COLUMN import_sessions.processed_items IS 'Обработанное количество';
COMMENT ON COLUMN import_sessions.success_items IS 'Успешно обработанных';
COMMENT ON COLUMN import_sessions.error_items IS 'Ошибок при обработке';
COMMENT ON COLUMN import_sessions.settings IS 'Настройки импорта';
COMMENT ON COLUMN import_sessions.metadata IS 'Метаданные сессии';

-- ================================================================
-- ТАБЛИЦА: Import_Logs - Логи импорта
-- ================================================================
CREATE TABLE IF NOT EXISTS import_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_session_id UUID NOT NULL,
    level VARCHAR(20) NOT NULL, -- 'info', 'warning', 'error'
    message TEXT NOT NULL,
    external_id VARCHAR(255),
    product_id UUID,
    brand_id UUID,
    category_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_import_logs_import_session_id
        FOREIGN KEY (import_session_id) REFERENCES import_sessions(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_import_logs_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_import_logs_brand_id
        FOREIGN KEY (brand_id) REFERENCES brands(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_import_logs_category_id
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE import_logs IS 'Логи импорта товаров';
COMMENT ON COLUMN import_logs.import_session_id IS 'Сессия импорта';
COMMENT ON COLUMN import_logs.level IS 'Уровень сообщения';
COMMENT ON COLUMN import_logs.message IS 'Сообщение';
COMMENT ON COLUMN import_logs.external_id IS 'Внешний ID элемента';
COMMENT ON COLUMN import_logs.product_id IS 'Товар';
COMMENT ON COLUMN import_logs.brand_id IS 'Бренд';
COMMENT ON COLUMN import_logs.category_id IS 'Категория';
COMMENT ON COLUMN import_logs.details IS 'Детали лога';

-- ================================================================
-- ИНДЕКСЫ
-- ================================================================

-- Индексы для supplier_product_mappings
CREATE INDEX IF NOT EXISTS idx_supplier_product_mappings_company_id ON supplier_product_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_product_mappings_product_id ON supplier_product_mappings (product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_product_mappings_supplier_id ON supplier_product_mappings (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_product_mappings_external_product_id ON supplier_product_mappings (external_product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_product_mappings_external_brand ON supplier_product_mappings (external_brand);
CREATE INDEX IF NOT EXISTS idx_supplier_product_mappings_external_article ON supplier_product_mappings (external_article);
CREATE INDEX IF NOT EXISTS idx_supplier_product_mappings_is_primary ON supplier_product_mappings (is_primary);
CREATE INDEX IF NOT EXISTS idx_supplier_product_mappings_is_active ON supplier_product_mappings (is_active);
CREATE INDEX IF NOT EXISTS idx_supplier_product_mappings_sync_status ON supplier_product_mappings (sync_status);

-- Индексы для обновленных полей brand_supplier_mappings
CREATE INDEX IF NOT EXISTS idx_brand_supplier_mappings_is_primary ON brand_supplier_mappings (is_primary);
CREATE INDEX IF NOT EXISTS idx_brand_supplier_mappings_is_exclusive ON brand_supplier_mappings (is_exclusive);

-- Индексы для product_matching_rules
CREATE INDEX IF NOT EXISTS idx_product_matching_rules_company_id ON product_matching_rules (company_id);
CREATE INDEX IF NOT EXISTS idx_product_matching_rules_rule_type ON product_matching_rules (rule_type);
CREATE INDEX IF NOT EXISTS idx_product_matching_rules_priority ON product_matching_rules (priority);
CREATE INDEX IF NOT EXISTS idx_product_matching_rules_is_active ON product_matching_rules (is_active);

-- Индексы для обновленных полей name_processing_rules
CREATE INDEX IF NOT EXISTS idx_name_processing_rules_enabled ON name_processing_rules (enabled);

-- Индексы для обновленных полей attribute_mappings
CREATE INDEX IF NOT EXISTS idx_attribute_mappings_internal_attribute_id ON attribute_mappings (internal_attribute_id);

-- Индексы для обновленных полей external_categories
CREATE INDEX IF NOT EXISTS idx_external_categories_level ON external_categories (level);

-- Индексы для import_sessions
CREATE INDEX IF NOT EXISTS idx_import_sessions_company_id ON import_sessions (company_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_supplier_id ON import_sessions (supplier_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_session_type ON import_sessions (session_type);
CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions (status);
CREATE INDEX IF NOT EXISTS idx_import_sessions_started_at ON import_sessions (started_at);

-- Индексы для import_logs
CREATE INDEX IF NOT EXISTS idx_import_logs_import_session_id ON import_logs (import_session_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_level ON import_logs (level);
CREATE INDEX IF NOT EXISTS idx_import_logs_external_id ON import_logs (external_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_product_id ON import_logs (product_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_brand_id ON import_logs (brand_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_category_id ON import_logs (category_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_created_at ON import_logs (created_at);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================

CREATE TRIGGER update_supplier_product_mappings_updated_at
    BEFORE UPDATE ON supplier_product_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_matching_rules_updated_at
    BEFORE UPDATE ON product_matching_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_import_sessions_updated_at
    BEFORE UPDATE ON import_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ
-- ================================================================

-- Функция для проверки уникальности бренда у поставщика
CREATE OR REPLACE FUNCTION check_brand_uniqueness(
    p_company_id UUID,
    p_supplier_id UUID,
    p_brand_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Проверяем, что бренд не импортируется от других поставщиков
    SELECT COUNT(*)
    INTO v_count
    FROM brand_supplier_mappings
    WHERE company_id = p_company_id
      AND brand_id = p_brand_id
      AND supplier_id != p_supplier_id
      AND is_active = TRUE;

    RETURN v_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Функция для сопоставления товаров по бренду и артикулу
CREATE OR REPLACE FUNCTION match_products_by_brand_article(
    p_company_id UUID,
    p_external_brand VARCHAR,
    p_external_article VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_product_id UUID;
BEGIN
    -- Ищем товар по бренду и артикулу
    SELECT p.id
    INTO v_product_id
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    WHERE p.company_id = p_company_id
      AND b.name ILIKE p_external_brand
      AND p.internal_code ILIKE p_external_article
      AND p.is_active = TRUE
    LIMIT 1;

    RETURN v_product_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для обработки названия товара
CREATE OR REPLACE FUNCTION process_product_name(
    p_company_id UUID,
    p_original_name VARCHAR,
    p_brand_name VARCHAR DEFAULT NULL,
    p_article VARCHAR DEFAULT NULL
) RETURNS VARCHAR AS $$
DECLARE
    v_processed_name VARCHAR := p_original_name;
    v_rule RECORD;
BEGIN
    -- Применяем правила обработки названий
    FOR v_rule IN
        SELECT * FROM name_processing_rules
        WHERE company_id = p_company_id
          AND enabled = TRUE
          AND is_active = TRUE
        ORDER BY priority DESC
    LOOP
        CASE v_rule.type
            WHEN 'remove_words' THEN
                -- Удаляем указанные слова
                IF v_rule.settings ? 'words' THEN
                    FOR i IN 0..jsonb_array_length(v_rule.settings->'words')-1 LOOP
                        v_processed_name := regexp_replace(
                            v_processed_name,
                            '\m' || (v_rule.settings->'words'->i)::TEXT || '\M',
                            '',
                            'gi'
                        );
                    END LOOP;
                END IF;
                
            WHEN 'remove_symbols' THEN
                -- Удаляем указанные символы
                IF v_rule.settings ? 'symbols' THEN
                    v_processed_name := regexp_replace(
                        v_processed_name,
                        '[' || (v_rule.settings->>'symbols') || ']',
                        '',
                        'g'
                    );
                END IF;
                
            WHEN 'add_brand' THEN
                -- Добавляем бренд в начало названия
                IF p_brand_name IS NOT NULL AND p_brand_name != '' THEN
                    v_processed_name := p_brand_name || ' ' || v_processed_name;
                END IF;
                
            WHEN 'add_sku' THEN
                -- Добавляем артикул в конец названия
                IF p_article IS NOT NULL AND p_article != '' THEN
                    v_processed_name := v_processed_name || ' (' || p_article || ')';
                END IF;
        END CASE;
    END LOOP;

    -- Очищаем лишние пробелы
    v_processed_name := regexp_replace(v_processed_name, '\s+', ' ', 'g');
    v_processed_name := trim(v_processed_name);

    RETURN v_processed_name;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматического маппинга категорий
CREATE OR REPLACE FUNCTION auto_map_categories(
    p_company_id UUID,
    p_supplier_id UUID,
    p_external_category_name VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_category_id UUID;
    v_similarity DECIMAL;
    v_best_match_id UUID;
    v_best_similarity DECIMAL := 0;
BEGIN
    -- Ищем категорию по точному совпадению
    SELECT ec.internal_category_id
    INTO v_category_id
    FROM external_categories ec
    JOIN category_mappings cm ON ec.external_category_id = cm.external_category_id
    WHERE ec.supplier_id = p_supplier_id
      AND ec.name ILIKE p_external_category_name
      AND cm.company_id = p_company_id
      AND cm.is_active = TRUE
    LIMIT 1;

    -- Если точное совпадение не найдено, ищем по сходству
    IF v_category_id IS NULL THEN
        FOR v_category_id, v_similarity IN
            SELECT 
                c.id,
                similarity(c.name, p_external_category_name) as sim
            FROM categories c
            WHERE c.company_id = p_company_id
              AND c.is_active = TRUE
              AND similarity(c.name, p_external_category_name) > 0.3
            ORDER BY sim DESC
        LOOP
            IF v_similarity > v_best_similarity THEN
                v_best_match_id := v_category_id;
                v_best_similarity := v_similarity;
            END IF;
        END LOOP;
        
        v_category_id := v_best_match_id;
    END IF;

    RETURN v_category_id;
END;
$$ LANGUAGE plpgsql; 