-- ================================================================
-- МИГРАЦИЯ 010: Дополнительные поля и таблицы
-- Описание: Добавляет недостающие поля и таблицы для полной совместимости с кодом
-- Дата: 2025-01-27
-- Блок: Финальные исправления
-- Зависимости: Все предыдущие миграции
-- ================================================================

-- ================================================================
-- ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ ПОЛЕЙ В СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ
-- ================================================================

-- Добавляем недостающие поля в таблицу products
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS external_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP WITH TIME ZONE;

-- Добавляем комментарии к новым полям
COMMENT ON COLUMN products.sku IS 'Артикул товара (Stock Keeping Unit)';
COMMENT ON COLUMN products.barcode IS 'Штрих-код товара';
COMMENT ON COLUMN products.slug IS 'URL-friendly версия названия товара';
COMMENT ON COLUMN products.external_id IS 'Внешний ID товара в системе поставщика';
COMMENT ON COLUMN products.external_data IS 'Дополнительные данные от внешней системы';
COMMENT ON COLUMN products.last_sync IS 'Дата последней синхронизации';

-- Добавляем индексы для новых полей
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);
CREATE INDEX IF NOT EXISTS idx_products_external_id ON products (external_id);
CREATE INDEX IF NOT EXISTS idx_products_last_sync ON products (last_sync);

-- Добавляем уникальные ограничения (ИСПРАВЛЕНО: убрано "IF NOT EXISTS")
ALTER TABLE products ADD CONSTRAINT products_sku_unique_per_company
    UNIQUE (company_id, sku);
ALTER TABLE products ADD CONSTRAINT products_barcode_unique_per_company
    UNIQUE (company_id, barcode);
ALTER TABLE products ADD CONSTRAINT products_slug_unique_per_company
    UNIQUE (company_id, slug);

-- ================================================================
-- ТАБЛИЦА: User_Sessions - Сессии пользователей (если не создана)
-- ================================================================
-- Эта таблица уже должна быть создана в миграции 007, но на всякий случай
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_user_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ================================================================
-- ТАБЛИЦА: Billing_Transactions - Транзакции биллинга (если не создана)
-- ================================================================
-- Эта таблица уже должна быть создана в миграции 002, но на всякий случай
CREATE TABLE IF NOT EXISTS billing_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_account_id UUID NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    status VARCHAR(20) DEFAULT 'pending',
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_billing_transactions_billing_account_id
        FOREIGN KEY (billing_account_id) REFERENCES billing_accounts(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С НОВЫМИ ПОЛЯМИ
-- ================================================================

-- Функция для генерации slug из названия товара
CREATE OR REPLACE FUNCTION generate_product_slug(p_name VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(p_name, '[^а-яёa-z0-9\s-]', '', 'gi'),
                    '\s+', '-', 'g'
                ),
                '-+', '-', 'g'
            ),
            '^-|-$', '', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматической генерации slug для товаров
CREATE OR REPLACE FUNCTION products_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_product_slug(NEW.name);
    END IF;

    -- Проверяем уникальность slug
    WHILE EXISTS (
        SELECT 1 FROM products
        WHERE company_id = NEW.company_id
        AND slug = NEW.slug
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    ) LOOP
        NEW.slug := NEW.slug || '-' || floor(random() * 1000)::text;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматической генерации slug
DROP TRIGGER IF EXISTS products_slug_trigger ON products;
CREATE TRIGGER products_slug_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION products_generate_slug();

-- Функция для обновления поля volume на основе размеров
CREATE OR REPLACE FUNCTION update_product_volume()
RETURNS TRIGGER AS $$
BEGIN
    -- Рассчитываем объем на основе размеров (в куб. см)
    IF NEW.length IS NOT NULL AND NEW.width IS NOT NULL AND NEW.height IS NOT NULL THEN
        NEW.volume := NEW.length * NEW.width * NEW.height;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического расчета объема
DROP TRIGGER IF EXISTS update_product_volume_trigger ON products;
CREATE TRIGGER update_product_volume_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_volume();

-- Функция для обновления поля dimensions на основе размеров
CREATE OR REPLACE FUNCTION update_product_dimensions()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем поле dimensions на основе отдельных полей
    IF NEW.length IS NOT NULL OR NEW.width IS NOT NULL OR NEW.height IS NOT NULL THEN
        NEW.dimensions := jsonb_build_object(
            'length', NEW.length,
            'width', NEW.width,
            'height', NEW.height
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления dimensions
DROP TRIGGER IF EXISTS update_product_dimensions_trigger ON products;
CREATE TRIGGER update_product_dimensions_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_dimensions();

-- ================================================================
-- ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ ФУНКЦИЙ
-- ================================================================

-- Обновляем функцию create() в ProductModel для включения всех полей
CREATE OR REPLACE FUNCTION create_product_with_all_fields(
    p_company_id UUID,
    p_internal_code VARCHAR,
    p_name VARCHAR,
    p_description TEXT DEFAULT NULL,
    p_brand_id UUID DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_attributes JSONB DEFAULT '{}'::jsonb,
    p_source_type VARCHAR DEFAULT 'manual',
    p_main_supplier_id UUID DEFAULT NULL,
    p_base_unit VARCHAR DEFAULT 'шт',
    p_is_divisible BOOLEAN DEFAULT FALSE,
    p_min_order_quantity DECIMAL DEFAULT 1,
    p_weight DECIMAL DEFAULT NULL,
    p_length DECIMAL DEFAULT NULL,
    p_width DECIMAL DEFAULT NULL,
    p_height DECIMAL DEFAULT NULL,
    p_volume DECIMAL DEFAULT NULL,
    p_sku VARCHAR DEFAULT NULL,
    p_barcode VARCHAR DEFAULT NULL,
    p_external_id VARCHAR DEFAULT NULL,
    p_external_data JSONB DEFAULT '{}'::jsonb,
    p_is_active BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
    v_product_id UUID;
BEGIN
    INSERT INTO products (
        company_id,
        internal_code,
        name,
        description,
        brand_id,
        category_id,
        attributes,
        source_type,
        main_supplier_id,
        base_unit,
        is_divisible,
        min_order_quantity,
        weight,
        length,
        width,
        height,
        volume,
        sku,
        barcode,
        external_id,
        external_data,
        is_active
    ) VALUES (
        p_company_id,
        p_internal_code,
        p_name,
        p_description,
        p_brand_id,
        p_category_id,
        p_attributes,
        p_source_type,
        p_main_supplier_id,
        p_base_unit,
        p_is_divisible,
        p_min_order_quantity,
        p_weight,
        p_length,
        p_width,
        p_height,
        p_volume,
        p_sku,
        p_barcode,
        p_external_id,
        p_external_data,
        p_is_active
    ) RETURNING id INTO v_product_id;

    RETURN v_product_id;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ДОПОЛНИТЕЛЬНЫЕ ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ================================================================

-- Индексы для поиска по тексту
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING gin (to_tsvector('russian', name));
CREATE INDEX IF NOT EXISTS idx_products_description_search ON products USING gin (to_tsvector('russian', description));

-- Составные индексы для часто используемых запросов
CREATE INDEX IF NOT EXISTS idx_products_company_brand_category ON products (company_id, brand_id, category_id);
CREATE INDEX IF NOT EXISTS idx_products_company_source_type ON products (company_id, source_type);
CREATE INDEX IF NOT EXISTS idx_products_company_is_active ON products (company_id, is_active);

-- Индексы для API логов
CREATE INDEX IF NOT EXISTS idx_api_logs_company_user_time ON api_logs (company_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint_method ON api_logs (endpoint, method);

-- Индексы для аудита
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_user_time ON audit_logs (company_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_time ON audit_logs (entity_type, entity_id, created_at DESC);

-- ================================================================
-- ПРОВЕРКИ ЦЕЛОСТНОСТИ ДАННЫХ
-- ================================================================

-- Функция для проверки целостности данных
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE (
    table_name VARCHAR,
    issue_type VARCHAR,
    issue_description TEXT,
    record_count BIGINT
) AS $$
BEGIN
    -- Проверяем товары без внутреннего кода
    RETURN QUERY
    SELECT
        'products'::VARCHAR,
        'missing_internal_code'::VARCHAR,
        'Товары без внутреннего кода'::TEXT,
        COUNT(*)
    FROM products
    WHERE internal_code IS NULL OR internal_code = '';

    -- Проверяем товары с отрицательными количествами
    RETURN QUERY
    SELECT
        'warehouse_product_links'::VARCHAR,
        'negative_quantity'::VARCHAR,
        'Отрицательные остатки товаров'::TEXT,
        COUNT(*)
    FROM warehouse_product_links
    WHERE quantity < 0;

    -- Проверяем заказы без позиций
    RETURN QUERY
    SELECT
        'orders'::VARCHAR,
        'empty_orders'::VARCHAR,
        'Заказы без позиций'::TEXT,
        COUNT(*)
    FROM orders o
    WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id);

    -- Проверяем пользователей без роли
    RETURN QUERY
    SELECT
        'users'::VARCHAR,
        'missing_role'::VARCHAR,
        'Пользователи без роли'::TEXT,
        COUNT(*)
    FROM users
    WHERE role_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ТАБЛИЦА: Product_Mappings - Связи товаров с внешними системами
-- ================================================================
CREATE TABLE IF NOT EXISTS product_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    product_id UUID NOT NULL,
    system_id UUID NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    external_sku VARCHAR(255),
    external_name VARCHAR(500),
    external_data JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_mappings_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_mappings_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_mappings_system_id
        FOREIGN KEY (system_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_mappings IS 'Связи товаров с внешними системами (поставщиками, маркетплейсами)';
COMMENT ON COLUMN product_mappings.company_id IS 'Компания';
COMMENT ON COLUMN product_mappings.product_id IS 'Внутренний товар';
COMMENT ON COLUMN product_mappings.system_id IS 'Внешняя система (поставщик/маркетплейс)';
COMMENT ON COLUMN product_mappings.external_id IS 'ID товара во внешней системе';
COMMENT ON COLUMN product_mappings.external_sku IS 'SKU товара во внешней системе';
COMMENT ON COLUMN product_mappings.external_name IS 'Название товара во внешней системе';
COMMENT ON COLUMN product_mappings.external_data IS 'Дополнительные данные от внешней системы';
COMMENT ON COLUMN product_mappings.is_active IS 'Активна ли связь';
COMMENT ON COLUMN product_mappings.last_sync IS 'Дата последней синхронизации';

-- Уникальное ограничение (ИСПРАВЛЕНО: убрано "IF NOT EXISTS")
ALTER TABLE product_mappings ADD CONSTRAINT product_mappings_unique
    UNIQUE (system_id, external_id);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_product_mappings_company_id ON product_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_product_id ON product_mappings (product_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_system_id ON product_mappings (system_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_external_id ON product_mappings (external_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_external_sku ON product_mappings (external_sku);
CREATE INDEX IF NOT EXISTS idx_product_mappings_is_active ON product_mappings (is_active);
CREATE INDEX IF NOT EXISTS idx_product_mappings_last_sync ON product_mappings (last_sync);

-- Триггер для обновления updated_at
CREATE TRIGGER update_product_mappings_updated_at
    BEFORE UPDATE ON product_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 010
-- ================================================================