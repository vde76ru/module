-- ================================================================
-- МИГРАЦИЯ 011: Система импорта товаров и маппинга
-- Описание: Добавляет таблицы для импорта товаров от поставщиков и маппинга
-- Дата: 2025-01-27
-- Блок: Импорт и маппинг товаров
-- Зависимости: Все предыдущие миграции
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Brand_Supplier_Mappings - Маппинг брендов к поставщикам
-- ================================================================
CREATE TABLE IF NOT EXISTS brand_supplier_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    brand_id UUID NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_brand_supplier_mappings_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_brand_supplier_mappings_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_brand_supplier_mappings_brand_id
        FOREIGN KEY (brand_id) REFERENCES brands(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_brand_supplier_mappings_unique
        UNIQUE (company_id, supplier_id, brand_id)
);

-- ================================================================
-- ТАБЛИЦА: Name_Processing_Rules - Правила обработки названий товаров
-- ================================================================
CREATE TABLE IF NOT EXISTS name_processing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'remove_words', 'remove_symbols', 'add_brand', 'add_sku'
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_name_processing_rules_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ================================================================
-- ТАБЛИЦА: Attribute_Mappings - Маппинг атрибутов
-- ================================================================
CREATE TABLE IF NOT EXISTS attribute_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    external_key VARCHAR(255) NOT NULL,
    internal_name VARCHAR(255) NOT NULL,
    conversion_rules JSONB DEFAULT '{}'::jsonb,
    is_auto_mapped BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_attribute_mappings_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_attribute_mappings_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_attribute_mappings_unique
        UNIQUE (company_id, supplier_id, external_key)
);

-- ================================================================
-- ТАБЛИЦА: Category_Mappings - Маппинг категорий
-- ================================================================
CREATE TABLE IF NOT EXISTS category_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    external_category_id VARCHAR(255) NOT NULL,
    internal_category_id UUID NOT NULL,
    is_auto_mapped BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_category_mappings_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_category_mappings_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_category_mappings_internal_category_id
        FOREIGN KEY (internal_category_id) REFERENCES categories(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_category_mappings_unique
        UNIQUE (company_id, supplier_id, external_category_id)
);

-- ================================================================
-- ТАБЛИЦА: External_Categories - Внешние категории поставщиков
-- ================================================================
CREATE TABLE IF NOT EXISTS external_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id UUID,
    level INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_external_categories_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_external_categories_parent_id
        FOREIGN KEY (parent_id) REFERENCES external_categories(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_external_categories_unique
        UNIQUE (supplier_id, external_id)
);

-- ================================================================
-- ТАБЛИЦА: Attribute_Values - Значения атрибутов
-- ================================================================
CREATE TABLE IF NOT EXISTS attribute_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_id UUID NOT NULL,
    value TEXT NOT NULL,
    display_value VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_attribute_values_attribute_id
        FOREIGN KEY (attribute_id) REFERENCES product_attributes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_attribute_values_unique
        UNIQUE (attribute_id, value)
);

-- ================================================================
-- ТАБЛИЦА: Order_Processing_Rules - Правила обработки заказов
-- ================================================================
CREATE TABLE IF NOT EXISTS order_processing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    order_type VARCHAR(50) NOT NULL, -- 'retail', 'business'
    action VARCHAR(50) NOT NULL, -- 'auto_confirm', 'wait_payment', 'auto_order_supplier', 'assign_warehouse'
    conditions JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_order_processing_rules_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ================================================================
-- ТАБЛИЦА: Pricing_Settings - Настройки ценовой политики
-- ================================================================
CREATE TABLE IF NOT EXISTS pricing_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    website_price_rules JSONB DEFAULT '[]'::jsonb,
    marketplace_price_rules JSONB DEFAULT '[]'::jsonb,
    min_price_percentage DECIMAL(5,2) DEFAULT 0,
    max_price_percentage DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_pricing_settings_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ================================================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ================================================================

-- Индексы для brand_supplier_mappings
CREATE INDEX IF NOT EXISTS idx_brand_supplier_mappings_company_id ON brand_supplier_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_brand_supplier_mappings_supplier_id ON brand_supplier_mappings (supplier_id);
CREATE INDEX IF NOT EXISTS idx_brand_supplier_mappings_brand_id ON brand_supplier_mappings (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_supplier_mappings_is_active ON brand_supplier_mappings (is_active);

-- Индексы для name_processing_rules
CREATE INDEX IF NOT EXISTS idx_name_processing_rules_company_id ON name_processing_rules (company_id);
CREATE INDEX IF NOT EXISTS idx_name_processing_rules_type ON name_processing_rules (type);
CREATE INDEX IF NOT EXISTS idx_name_processing_rules_priority ON name_processing_rules (priority);

-- Индексы для attribute_mappings
CREATE INDEX IF NOT EXISTS idx_attribute_mappings_company_id ON attribute_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_attribute_mappings_supplier_id ON attribute_mappings (supplier_id);
CREATE INDEX IF NOT EXISTS idx_attribute_mappings_external_key ON attribute_mappings (external_key);

-- Индексы для category_mappings
CREATE INDEX IF NOT EXISTS idx_category_mappings_company_id ON category_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_category_mappings_supplier_id ON category_mappings (supplier_id);
CREATE INDEX IF NOT EXISTS idx_category_mappings_external_category_id ON category_mappings (external_category_id);

-- Индексы для external_categories
CREATE INDEX IF NOT EXISTS idx_external_categories_supplier_id ON external_categories (supplier_id);
CREATE INDEX IF NOT EXISTS idx_external_categories_parent_id ON external_categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_external_categories_external_id ON external_categories (external_id);

-- Индексы для attribute_values
CREATE INDEX IF NOT EXISTS idx_attribute_values_attribute_id ON attribute_values (attribute_id);
CREATE INDEX IF NOT EXISTS idx_attribute_values_value ON attribute_values (value);

-- Индексы для order_processing_rules
CREATE INDEX IF NOT EXISTS idx_order_processing_rules_company_id ON order_processing_rules (company_id);
CREATE INDEX IF NOT EXISTS idx_order_processing_rules_order_type ON order_processing_rules (order_type);
CREATE INDEX IF NOT EXISTS idx_order_processing_rules_priority ON order_processing_rules (priority);

-- Индексы для pricing_settings
CREATE INDEX IF NOT EXISTS idx_pricing_settings_company_id ON pricing_settings (company_id);

-- ================================================================
-- ТРИГГЕРЫ ДЛЯ ОБНОВЛЕНИЯ TIMESTAMP
-- ================================================================

-- Триггер для brand_supplier_mappings
CREATE TRIGGER update_brand_supplier_mappings_updated_at
    BEFORE UPDATE ON brand_supplier_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для name_processing_rules
CREATE TRIGGER update_name_processing_rules_updated_at
    BEFORE UPDATE ON name_processing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для attribute_mappings
CREATE TRIGGER update_attribute_mappings_updated_at
    BEFORE UPDATE ON attribute_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для category_mappings
CREATE TRIGGER update_category_mappings_updated_at
    BEFORE UPDATE ON category_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для external_categories
CREATE TRIGGER update_external_categories_updated_at
    BEFORE UPDATE ON external_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для attribute_values
CREATE TRIGGER update_attribute_values_updated_at
    BEFORE UPDATE ON attribute_values
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для order_processing_rules
CREATE TRIGGER update_order_processing_rules_updated_at
    BEFORE UPDATE ON order_processing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для pricing_settings
CREATE TRIGGER update_pricing_settings_updated_at
    BEFORE UPDATE ON pricing_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- КОММЕНТАРИИ К ТАБЛИЦАМ И ПОЛЯМ
-- ================================================================

COMMENT ON TABLE brand_supplier_mappings IS 'Маппинг брендов к поставщикам для контроля импорта';
COMMENT ON TABLE name_processing_rules IS 'Правила обработки названий товаров при импорте';
COMMENT ON TABLE attribute_mappings IS 'Маппинг атрибутов товаров между поставщиками и внутренней системой';
COMMENT ON TABLE category_mappings IS 'Маппинг категорий товаров между поставщиками и внутренней системой';
COMMENT ON TABLE external_categories IS 'Внешние категории поставщиков';
COMMENT ON TABLE attribute_values IS 'Значения атрибутов товаров';
COMMENT ON TABLE order_processing_rules IS 'Правила обработки заказов';
COMMENT ON TABLE pricing_settings IS 'Настройки ценовой политики';