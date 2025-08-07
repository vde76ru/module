-- ================================================================
-- МИГРАЦИЯ 003: PIM система - товары и атрибуты (ИСПРАВЛЕНА)
-- Описание: Создает таблицы для управления товарами и их атрибутами
-- Дата: 2025-01-27
-- Блок: PIM система
-- Зависимости: 001 (brands, categories), 002 (companies)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Products - Товары
-- ================================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    internal_code VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    brand_id UUID,
    category_id UUID,
    attributes JSONB DEFAULT '{}'::jsonb,
    source_type VARCHAR(50) DEFAULT 'manual',
    main_supplier_id UUID, -- Внешний ключ будет добавлен позже в миграции 004
    base_unit VARCHAR(50) DEFAULT 'шт',
    is_divisible BOOLEAN DEFAULT FALSE,
    min_order_quantity DECIMAL(12,3) DEFAULT 1,
    weight DECIMAL(10,3),
    length DECIMAL(10,3),
    width DECIMAL(10,3),
    height DECIMAL(10,3),
    volume DECIMAL(12,6),
    dimensions JSONB DEFAULT '{}'::jsonb,
    popularity_score INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    short_description TEXT,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    slug VARCHAR(255),
    external_id VARCHAR(100),
    external_data JSONB DEFAULT '{}'::jsonb,
    last_sync TIMESTAMP WITH TIME ZONE,

    status VARCHAR(50) DEFAULT 'active',
    is_visible BOOLEAN DEFAULT TRUE,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_products_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_products_brand_id
        FOREIGN KEY (brand_id) REFERENCES brands(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_products_category_id
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE products IS 'Товары компаний';
COMMENT ON COLUMN products.company_id IS 'Компания-владелец товара';
COMMENT ON COLUMN products.internal_code IS 'Внутренний код товара';
COMMENT ON COLUMN products.name IS 'Название товара';
COMMENT ON COLUMN products.description IS 'Описание товара';
COMMENT ON COLUMN products.brand_id IS 'Бренд товара';
COMMENT ON COLUMN products.category_id IS 'Категория товара';
COMMENT ON COLUMN products.attributes IS 'Атрибуты товара в JSON формате';
COMMENT ON COLUMN products.source_type IS 'Тип источника: manual, import, api';
COMMENT ON COLUMN products.main_supplier_id IS 'Основной поставщик товара (внешний ключ будет добавлен позже)';
COMMENT ON COLUMN products.base_unit IS 'Базовая единица измерения';
COMMENT ON COLUMN products.is_divisible IS 'Делимый ли товар';
COMMENT ON COLUMN products.min_order_quantity IS 'Минимальное количество для заказа';
COMMENT ON COLUMN products.weight IS 'Вес товара в кг';
COMMENT ON COLUMN products.length IS 'Длина товара в см';
COMMENT ON COLUMN products.width IS 'Ширина товара в см';
COMMENT ON COLUMN products.height IS 'Высота товара в см';
COMMENT ON COLUMN products.volume IS 'Объем товара в куб. см';
COMMENT ON COLUMN products.dimensions IS 'Габариты товара в JSON формате';
COMMENT ON COLUMN products.popularity_score IS 'Популярность товара';
COMMENT ON COLUMN products.view_count IS 'Количество просмотров товара';
COMMENT ON COLUMN products.short_description IS 'Краткое описание товара';
COMMENT ON COLUMN products.sku IS 'SKU товара';
COMMENT ON COLUMN products.barcode IS 'Штрих-код товара';
COMMENT ON COLUMN products.slug IS 'URL-слаг товара';
COMMENT ON COLUMN products.external_id IS 'Внешний ID товара';
COMMENT ON COLUMN products.external_data IS 'Внешние данные товара';
COMMENT ON COLUMN products.last_sync IS 'Дата последней синхронизации';

COMMENT ON COLUMN products.status IS 'Статус товара: active, inactive, draft';
COMMENT ON COLUMN products.is_visible IS 'Видим ли товар в каталоге';
COMMENT ON COLUMN products.meta_title IS 'Meta title для SEO';
COMMENT ON COLUMN products.meta_description IS 'Meta description для SEO';
COMMENT ON COLUMN products.meta_keywords IS 'Meta keywords для SEO';
COMMENT ON COLUMN products.is_active IS 'Активен ли товар';

ALTER TABLE products ADD CONSTRAINT products_internal_code_unique_per_company
    UNIQUE (company_id, internal_code);

CREATE INDEX idx_products_company_id ON products (company_id);
CREATE INDEX idx_products_internal_code ON products (internal_code);
CREATE INDEX idx_products_brand_id ON products (brand_id);
CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_source_type ON products (source_type);
CREATE INDEX idx_products_is_active ON products (is_active);
CREATE INDEX idx_products_popularity_score ON products (popularity_score DESC);
CREATE INDEX idx_products_view_count ON products (view_count DESC);
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_products_barcode ON products (barcode);
CREATE INDEX idx_products_slug ON products (slug);
CREATE INDEX idx_products_external_id ON products (external_id);
CREATE INDEX idx_products_last_sync ON products (last_sync);
CREATE INDEX idx_products_main_supplier_id ON products (main_supplier_id);

CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_products_company_active ON products (company_id, is_active);

-- ================================================================
-- ТАБЛИЦА: Product_Images - Изображения товаров
-- ================================================================
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    is_main BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_images_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_images IS 'Изображения товаров';
COMMENT ON COLUMN product_images.product_id IS 'Товар';
COMMENT ON COLUMN product_images.image_url IS 'URL изображения';
COMMENT ON COLUMN product_images.alt_text IS 'Альтернативный текст для изображения';
COMMENT ON COLUMN product_images.sort_order IS 'Порядок сортировки';
COMMENT ON COLUMN product_images.is_main IS 'Главное ли изображение';
COMMENT ON COLUMN product_images.is_active IS 'Активно ли изображение';

CREATE INDEX idx_product_images_product_id ON product_images (product_id);
CREATE INDEX idx_product_images_sort_order ON product_images (sort_order);
CREATE INDEX idx_product_images_is_main ON product_images (is_main);
CREATE INDEX idx_product_images_is_active ON product_images (is_active);

-- ================================================================
-- ТАБЛИЦА: Product_Variants - Варианты товаров
-- ================================================================
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    variant_code VARCHAR(100),
    name VARCHAR(500),
    attributes JSONB DEFAULT '{}'::jsonb,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    weight DECIMAL(10,3),
    dimensions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_variants_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_variants IS 'Варианты товаров';
COMMENT ON COLUMN product_variants.product_id IS 'Основной товар';
COMMENT ON COLUMN product_variants.variant_code IS 'Код варианта';
COMMENT ON COLUMN product_variants.name IS 'Название варианта';
COMMENT ON COLUMN product_variants.attributes IS 'Атрибуты варианта';
COMMENT ON COLUMN product_variants.sku IS 'SKU варианта';
COMMENT ON COLUMN product_variants.barcode IS 'Штрихкод варианта';
COMMENT ON COLUMN product_variants.weight IS 'Вес варианта';
COMMENT ON COLUMN product_variants.dimensions IS 'Габариты варианта';
COMMENT ON COLUMN product_variants.is_active IS 'Активен ли вариант';

ALTER TABLE product_variants ADD CONSTRAINT product_variants_code_unique_per_product
    UNIQUE (product_id, variant_code);

CREATE INDEX idx_product_variants_product_id ON product_variants (product_id);
CREATE INDEX idx_product_variants_variant_code ON product_variants (variant_code);
CREATE INDEX idx_product_variants_sku ON product_variants (sku);
CREATE INDEX idx_product_variants_barcode ON product_variants (barcode);
CREATE INDEX idx_product_variants_is_active ON product_variants (is_active);

-- ================================================================
-- ТАБЛИЦА: Product_Attributes - Атрибуты товаров
-- ================================================================
CREATE TABLE product_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'string',
    description TEXT,
    is_required BOOLEAN DEFAULT FALSE,
    is_filterable BOOLEAN DEFAULT FALSE,
    is_searchable BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    options JSONB DEFAULT '[]'::jsonb,
    validation_rules JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_attributes_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_attributes IS 'Атрибуты товаров';
COMMENT ON COLUMN product_attributes.company_id IS 'Компания-владелец атрибута';
COMMENT ON COLUMN product_attributes.name IS 'Название атрибута';
COMMENT ON COLUMN product_attributes.code IS 'Код атрибута';
COMMENT ON COLUMN product_attributes.type IS 'Тип атрибута: string, number, boolean, select, multiselect';
COMMENT ON COLUMN product_attributes.description IS 'Описание атрибута';
COMMENT ON COLUMN product_attributes.is_required IS 'Обязательный ли атрибут';
COMMENT ON COLUMN product_attributes.is_filterable IS 'Используется ли для фильтрации';
COMMENT ON COLUMN product_attributes.is_searchable IS 'Используется ли для поиска';
COMMENT ON COLUMN product_attributes.sort_order IS 'Порядок сортировки';
COMMENT ON COLUMN product_attributes.options IS 'Варианты значений для select/multiselect';
COMMENT ON COLUMN product_attributes.validation_rules IS 'Правила валидации';
COMMENT ON COLUMN product_attributes.is_active IS 'Активен ли атрибут';

ALTER TABLE product_attributes ADD CONSTRAINT product_attributes_code_unique_per_company
    UNIQUE (company_id, code);

CREATE INDEX idx_product_attributes_company_id ON product_attributes (company_id);
CREATE INDEX idx_product_attributes_code ON product_attributes (code);
CREATE INDEX idx_product_attributes_type ON product_attributes (type);
CREATE INDEX idx_product_attributes_is_filterable ON product_attributes (is_filterable);
CREATE INDEX idx_product_attributes_is_searchable ON product_attributes (is_searchable);
CREATE INDEX idx_product_attributes_sort_order ON product_attributes (sort_order);
CREATE INDEX idx_product_attributes_is_active ON product_attributes (is_active);

-- ================================================================
-- ТАБЛИЦА: Product_Attribute_Values - Значения атрибутов товаров
-- ================================================================
CREATE TABLE product_attribute_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    attribute_id UUID NOT NULL,
    value_text TEXT,
    value_number DECIMAL(15,6),
    value_boolean BOOLEAN,
    value_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_attribute_values_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_attribute_values_attribute_id
        FOREIGN KEY (attribute_id) REFERENCES product_attributes(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_attribute_values IS 'Значения атрибутов товаров';
COMMENT ON COLUMN product_attribute_values.product_id IS 'Товар';
COMMENT ON COLUMN product_attribute_values.attribute_id IS 'Атрибут';
COMMENT ON COLUMN product_attribute_values.value_text IS 'Текстовое значение';
COMMENT ON COLUMN product_attribute_values.value_number IS 'Числовое значение';
COMMENT ON COLUMN product_attribute_values.value_boolean IS 'Булево значение';
COMMENT ON COLUMN product_attribute_values.value_json IS 'JSON значение';

ALTER TABLE product_attribute_values ADD CONSTRAINT product_attribute_values_unique
    UNIQUE (product_id, attribute_id);

CREATE INDEX idx_product_attribute_values_product_id ON product_attribute_values (product_id);
CREATE INDEX idx_product_attribute_values_attribute_id ON product_attribute_values (attribute_id);
CREATE INDEX idx_product_attribute_values_value_text ON product_attribute_values (value_text);
CREATE INDEX idx_product_attribute_values_value_number ON product_attribute_values (value_number);
CREATE INDEX idx_product_attribute_values_value_boolean ON product_attribute_values (value_boolean);

-- ================================================================
-- ТАБЛИЦА: Product_Relations - Связи между товарами
-- ================================================================
CREATE TABLE product_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    related_product_id UUID NOT NULL,
    relation_type VARCHAR(50) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_relations_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_relations_related_product_id
        FOREIGN KEY (related_product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_relations IS 'Связи между товарами';
COMMENT ON COLUMN product_relations.product_id IS 'Основной товар';
COMMENT ON COLUMN product_relations.related_product_id IS 'Связанный товар';
COMMENT ON COLUMN product_relations.relation_type IS 'Тип связи: similar, accessory, replacement, upgrade';
COMMENT ON COLUMN product_relations.sort_order IS 'Порядок сортировки';
COMMENT ON COLUMN product_relations.is_active IS 'Активна ли связь';

ALTER TABLE product_relations ADD CONSTRAINT product_relations_unique
    UNIQUE (product_id, related_product_id, relation_type);

CREATE INDEX idx_product_relations_product_id ON product_relations (product_id);
CREATE INDEX idx_product_relations_related_product_id ON product_relations (related_product_id);
CREATE INDEX idx_product_relations_relation_type ON product_relations (relation_type);
CREATE INDEX idx_product_relations_sort_order ON product_relations (sort_order);
CREATE INDEX idx_product_relations_is_active ON product_relations (is_active);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_images_updated_at
    BEFORE UPDATE ON product_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_attributes_updated_at
    BEFORE UPDATE ON product_attributes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_attribute_values_updated_at
    BEFORE UPDATE ON product_attribute_values
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_relations_updated_at
    BEFORE UPDATE ON product_relations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С ТОВАРАМИ
-- ================================================================

-- Функция для проверки лимита товаров
CREATE OR REPLACE FUNCTION check_products_limit(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    -- Считаем активных товаров компании
    SELECT COUNT(*)
    INTO v_current_count
    FROM products
    WHERE company_id = p_company_id AND is_active = TRUE;

    -- Проверяем лимит через общую функцию
    RETURN check_company_limits(p_company_id, 'products', v_current_count);
END;
$$ LANGUAGE plpgsql;

-- Функция для генерации уникального внутреннего кода товара
CREATE OR REPLACE FUNCTION generate_product_code(p_company_id UUID, p_prefix VARCHAR DEFAULT 'PRD')
RETURNS VARCHAR AS $$
BEGIN
    RETURN generate_unique_code('products', 'internal_code', p_prefix, 8);
END;
$$ LANGUAGE plpgsql;

-- Функция для получения полной информации о товаре
CREATE OR REPLACE FUNCTION get_product_details(p_product_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR,
    product_description TEXT,
    brand_name VARCHAR,
    category_name VARCHAR,
    attributes JSONB,
    images JSONB,
    variants JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.description,
        b.name,
        c.name,
        p.attributes,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'id', pi.id,
                    'url', pi.image_url,
                    'alt_text', pi.alt_text,
                    'is_main', pi.is_main,
                    'sort_order', pi.sort_order
                ) ORDER BY pi.sort_order, pi.is_main DESC
            )
            FROM product_images pi
            WHERE pi.product_id = p.id AND pi.is_active = true),
            '[]'::jsonb
        ) as images,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'id', pv.id,
                    'code', pv.variant_code,
                    'name', pv.name,
                    'attributes', pv.attributes,
                    'sku', pv.sku,
                    'barcode', pv.barcode
                )
            )
            FROM product_variants pv
            WHERE pv.product_id = p.id AND pv.is_active = true),
            '[]'::jsonb
        ) as variants
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для поиска товаров по атрибутам
CREATE OR REPLACE FUNCTION search_products_by_attributes(
    p_company_id UUID,
    p_attributes JSONB,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR,
    match_score INTEGER
) AS $$
DECLARE
    v_attribute_key TEXT;
    v_attribute_value TEXT;
    v_query TEXT := '';
    v_conditions TEXT[] := ARRAY[]::TEXT[];
    v_param_count INTEGER := 1;
    v_params TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Строим условия поиска по атрибутам
    FOR v_attribute_key, v_attribute_value IN
        SELECT * FROM jsonb_each_text(p_attributes)
    LOOP
        v_conditions := array_append(v_conditions,
            format('p.attributes->>%L ILIKE %L', v_attribute_key, '%' || v_attribute_value || '%'));
    END LOOP;

    -- Формируем запрос
    v_query := format('
        SELECT
            p.id,
            p.name,
            COUNT(*) as match_score
        FROM products p
        WHERE p.company_id = %L
            AND p.is_active = true
            %s
        GROUP BY p.id, p.name
        ORDER BY match_score DESC, p.name
        LIMIT %s OFFSET %s
    ',
    p_company_id,
    CASE WHEN array_length(v_conditions, 1) > 0
         THEN 'AND ' || array_to_string(v_conditions, ' AND ')
         ELSE ''
    END,
    p_limit,
    p_offset
    );

    RETURN QUERY EXECUTE v_query;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 003
-- ================================================================