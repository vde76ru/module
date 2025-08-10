-- ================================================================
-- МИГРАЦИЯ 004: PIM система - товары и атрибуты (ОБНОВЛЕНА)
-- Описание: Создает таблицы для управления товарами и их атрибутами
-- Дата: 2025-01-27
-- Блок: PIM система
-- Зависимости: 001 (brands, categories), 002 (companies), 003 (suppliers)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Products - Товары
-- ================================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    internal_code VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    original_name VARCHAR(500), -- Оригинальное название от поставщика
    processed_name VARCHAR(500), -- Обработанное название
    description TEXT,
    brand_id UUID,
    category_id UUID,
    attributes JSONB DEFAULT '{}'::jsonb,
    source_type VARCHAR(50) DEFAULT 'manual',

    -- Информация о товаре
    base_unit VARCHAR(50) DEFAULT 'шт',
    is_divisible BOOLEAN DEFAULT FALSE,
    min_order_quantity DECIMAL(12,3) DEFAULT 1,
    weight DECIMAL(10,3),
    length DECIMAL(10,3),
    width DECIMAL(10,3),
    height DECIMAL(10,3),
    volume DECIMAL(12,6),
    dimensions JSONB DEFAULT '{}'::jsonb,

    -- Популярность и аналитика
    popularity_score INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    last_sale_date TIMESTAMP WITH TIME ZONE,

    -- SEO и метаданные
    short_description TEXT,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    slug VARCHAR(255),
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,

    -- Внешние данные
    external_id VARCHAR(100),
    external_data JSONB DEFAULT '{}'::jsonb,
    supplier_data JSONB DEFAULT '{}'::jsonb, -- Данные от всех поставщиков
    last_sync TIMESTAMP WITH TIME ZONE,

    -- Статус и видимость
    status VARCHAR(50) DEFAULT 'active',
    is_visible BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Настройки обработки
    name_processing_rules JSONB DEFAULT '{}'::jsonb, -- Правила обработки названия
    mapping_settings JSONB DEFAULT '{}'::jsonb, -- Настройки маппинга

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

COMMENT ON TABLE products IS 'Товары компаний с поддержкой импорта от поставщиков';
COMMENT ON COLUMN products.company_id IS 'Компания-владелец товара';
COMMENT ON COLUMN products.internal_code IS 'Внутренний код товара';
COMMENT ON COLUMN products.name IS 'Название товара (обработанное)';
COMMENT ON COLUMN products.original_name IS 'Оригинальное название от поставщика';
COMMENT ON COLUMN products.processed_name IS 'Обработанное название товара';
COMMENT ON COLUMN products.description IS 'Описание товара';
COMMENT ON COLUMN products.brand_id IS 'Бренд товара';
COMMENT ON COLUMN products.category_id IS 'Категория товара';
COMMENT ON COLUMN products.attributes IS 'Атрибуты товара в JSON формате';
COMMENT ON COLUMN products.source_type IS 'Тип источника: manual, import, api';
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
COMMENT ON COLUMN products.sales_count IS 'Количество продаж товара';
COMMENT ON COLUMN products.last_sale_date IS 'Дата последней продажи';
COMMENT ON COLUMN products.short_description IS 'Краткое описание товара';
COMMENT ON COLUMN products.sku IS 'SKU товара';
COMMENT ON COLUMN products.barcode IS 'Штрих-код товара';
COMMENT ON COLUMN products.slug IS 'URL-слаг товара';
COMMENT ON COLUMN products.meta_title IS 'Meta title для SEO';
COMMENT ON COLUMN products.meta_description IS 'Meta description для SEO';
COMMENT ON COLUMN products.meta_keywords IS 'Meta keywords для SEO';
COMMENT ON COLUMN products.external_id IS 'Внешний ID товара';
COMMENT ON COLUMN products.external_data IS 'Внешние данные товара';
COMMENT ON COLUMN products.supplier_data IS 'Данные от всех поставщиков';
COMMENT ON COLUMN products.last_sync IS 'Дата последней синхронизации';
COMMENT ON COLUMN products.status IS 'Статус товара: active, inactive, draft';
COMMENT ON COLUMN products.is_visible IS 'Видим ли товар в каталоге';
COMMENT ON COLUMN products.is_active IS 'Активен ли товар';
COMMENT ON COLUMN products.name_processing_rules IS 'Правила обработки названия';
COMMENT ON COLUMN products.mapping_settings IS 'Настройки маппинга';

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
CREATE INDEX idx_products_sales_count ON products (sales_count DESC);
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_products_barcode ON products (barcode);
CREATE INDEX idx_products_slug ON products (slug);
CREATE INDEX idx_products_external_id ON products (external_id);
CREATE INDEX idx_products_last_sync ON products (last_sync);

CREATE INDEX idx_products_last_sale_date ON products (last_sale_date);

CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_products_original_name_trgm ON products USING gin (original_name gin_trgm_ops);
CREATE INDEX idx_products_company_active ON products (company_id, is_active);
ALTER TABLE products
    ADD CONSTRAINT ck_products_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_company_public_id ON products (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_products_public_id
    BEFORE INSERT ON products
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ДОБАВЛЕНИЕ ПОЛЯ main_supplier_id В products (если не добавлено ранее)
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'main_supplier_id'
  ) THEN
      ALTER TABLE products ADD COLUMN main_supplier_id UUID;
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'products' AND constraint_name = 'fk_products_main_supplier_id'
  ) THEN
      ALTER TABLE products ADD CONSTRAINT fk_products_main_supplier_id
          FOREIGN KEY (main_supplier_id) REFERENCES suppliers(id)
          ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'products' AND indexname = 'idx_products_main_supplier_id'
  ) THEN
      CREATE INDEX idx_products_main_supplier_id ON products (main_supplier_id);
  END IF;

  COMMENT ON COLUMN products.main_supplier_id IS 'Основной поставщик товара';
END $$;

-- ================================================================
-- ТАБЛИЦЫ, ЗАВИСЯЩИЕ ОТ products (перенесено из 003 для корректного порядка)
-- ================================================================

-- Marketplace Settings
CREATE TABLE IF NOT EXISTS marketplace_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    marketplace_id UUID NOT NULL,
    product_id UUID NOT NULL,
    external_product_id VARCHAR(255),
    external_category_id VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    price DECIMAL(12,2),
    sale_price DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'RUB',
    stock_quantity INTEGER,
    api_credentials JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    sync_status VARCHAR(20) DEFAULT 'pending',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,
    marketplace_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_marketplace_settings_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_marketplace_settings_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_marketplace_settings_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE marketplace_settings IS 'Настройки товаров для конкретных маркетплейсов';
COMMENT ON COLUMN marketplace_settings.company_id IS 'Компания';
COMMENT ON COLUMN marketplace_settings.marketplace_id IS 'Маркетплейс';
COMMENT ON COLUMN marketplace_settings.product_id IS 'Товар';

CREATE INDEX IF NOT EXISTS idx_marketplace_settings_company_id ON marketplace_settings (company_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_settings_marketplace_id ON marketplace_settings (marketplace_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_settings_product_id ON marketplace_settings (product_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_settings_external_product_id ON marketplace_settings (external_product_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_settings_is_active ON marketplace_settings (is_active);
CREATE INDEX IF NOT EXISTS idx_marketplace_settings_sync_status ON marketplace_settings (sync_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_settings_last_sync_at ON marketplace_settings (last_sync_at);

-- Гарантируем уникальность записи на продукт в рамках компании и маркетплейса
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_settings_unique'
      AND conrelid = 'public.marketplace_settings'::regclass
  ) THEN
    ALTER TABLE marketplace_settings
      ADD CONSTRAINT marketplace_settings_unique
      UNIQUE (company_id, marketplace_id, product_id);
  END IF;
END $$;

-- Триггер обновления updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_marketplace_settings_updated_at'
      AND tgrelid = 'public.marketplace_settings'::regclass
  ) THEN
    CREATE TRIGGER update_marketplace_settings_updated_at
        BEFORE UPDATE ON marketplace_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Procurement Overrides
CREATE TABLE IF NOT EXISTS procurement_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    product_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    override_type VARCHAR(50) NOT NULL,
    override_value JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_procurement_overrides_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_procurement_overrides_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_procurement_overrides_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE procurement_overrides IS 'Переопределения правил закупок';

CREATE INDEX IF NOT EXISTS idx_procurement_overrides_company_id ON procurement_overrides (company_id);
CREATE INDEX IF NOT EXISTS idx_procurement_overrides_product_id ON procurement_overrides (product_id);
CREATE INDEX IF NOT EXISTS idx_procurement_overrides_supplier_id ON procurement_overrides (supplier_id);
CREATE INDEX IF NOT EXISTS idx_procurement_overrides_type ON procurement_overrides (override_type);
CREATE INDEX IF NOT EXISTS idx_procurement_overrides_is_active ON procurement_overrides (is_active);

-- Триггер обновления updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_procurement_overrides_updated_at'
      AND tgrelid = 'public.procurement_overrides'::regclass
  ) THEN
    CREATE TRIGGER update_procurement_overrides_updated_at
        BEFORE UPDATE ON procurement_overrides
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ================================================================
-- ТАБЛИЦА: Product_Images - Изображения товаров
-- ================================================================
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
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
ALTER TABLE product_images
    ADD CONSTRAINT ck_product_images_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_public_id ON product_images (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_product_images_public_id
    BEFORE INSERT ON product_images
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Product_Variants - Варианты товаров
-- ================================================================
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    product_id UUID NOT NULL,
    variant_code VARCHAR(100) NOT NULL,
    name VARCHAR(255),
    sku VARCHAR(100),
    barcode VARCHAR(100),
    attributes JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_variants_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_variants IS 'Варианты товаров';
COMMENT ON COLUMN product_variants.product_id IS 'Товар';
COMMENT ON COLUMN product_variants.variant_code IS 'Код варианта';
COMMENT ON COLUMN product_variants.name IS 'Название варианта';
COMMENT ON COLUMN product_variants.sku IS 'SKU варианта';
COMMENT ON COLUMN product_variants.barcode IS 'Штрих-код варианта';
COMMENT ON COLUMN product_variants.attributes IS 'Атрибуты варианта';
COMMENT ON COLUMN product_variants.is_active IS 'Активен ли вариант';

ALTER TABLE product_variants ADD CONSTRAINT product_variants_code_unique_per_product
    UNIQUE (product_id, variant_code);

CREATE INDEX idx_product_variants_product_id ON product_variants (product_id);
CREATE INDEX idx_product_variants_variant_code ON product_variants (variant_code);
CREATE INDEX idx_product_variants_sku ON product_variants (sku);
CREATE INDEX idx_product_variants_barcode ON product_variants (barcode);
CREATE INDEX idx_product_variants_is_active ON product_variants (is_active);
ALTER TABLE product_variants
    ADD CONSTRAINT ck_product_variants_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_public_id ON product_variants (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_product_variants_public_id
    BEFORE INSERT ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Product_Attributes - Атрибуты товаров
-- ================================================================
CREATE TABLE product_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    type VARCHAR(50) DEFAULT 'text',
    unit VARCHAR(50),
    is_required BOOLEAN DEFAULT FALSE,
    is_searchable BOOLEAN DEFAULT FALSE,
    is_filterable BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}'::jsonb,
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
COMMENT ON COLUMN product_attributes.display_name IS 'Отображаемое название';
COMMENT ON COLUMN product_attributes.type IS 'Тип атрибута: text, number, boolean, select, multiselect';
COMMENT ON COLUMN product_attributes.unit IS 'Единица измерения';
COMMENT ON COLUMN product_attributes.is_required IS 'Обязательный ли атрибут';
COMMENT ON COLUMN product_attributes.is_searchable IS 'Поисковый ли атрибут';
COMMENT ON COLUMN product_attributes.is_filterable IS 'Фильтруемый ли атрибут';
COMMENT ON COLUMN product_attributes.is_visible IS 'Видимый ли атрибут';
COMMENT ON COLUMN product_attributes.sort_order IS 'Порядок сортировки';
COMMENT ON COLUMN product_attributes.settings IS 'Настройки атрибута';
COMMENT ON COLUMN product_attributes.is_active IS 'Активен ли атрибут';

CREATE INDEX idx_product_attributes_company_id ON product_attributes (company_id);
CREATE INDEX idx_product_attributes_code ON product_attributes (code);
CREATE INDEX idx_product_attributes_type ON product_attributes (type);
CREATE INDEX idx_product_attributes_is_filterable ON product_attributes (is_filterable);
CREATE INDEX idx_product_attributes_is_searchable ON product_attributes (is_searchable);
CREATE INDEX idx_product_attributes_sort_order ON product_attributes (sort_order);
CREATE INDEX idx_product_attributes_is_active ON product_attributes (is_active);
ALTER TABLE product_attributes
    ADD CONSTRAINT ck_product_attributes_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_attributes_company_public_id ON product_attributes (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_product_attributes_public_id
    BEFORE INSERT ON product_attributes
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Product_Attribute_Values - Значения атрибутов товаров
-- ================================================================
CREATE TABLE product_attribute_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    product_id UUID NOT NULL,
    attribute_id UUID NOT NULL,
    value_text TEXT,
    value_number DECIMAL(15,3),
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
ALTER TABLE product_attribute_values
    ADD CONSTRAINT ck_product_attribute_values_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_attribute_values_public_id ON product_attribute_values (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_product_attribute_values_public_id
    BEFORE INSERT ON product_attribute_values
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Product_Relations - Связи между товарами
-- ================================================================
CREATE TABLE product_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
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
COMMENT ON COLUMN product_relations.relation_type IS 'Тип связи: similar, accessory, replacement, etc';
COMMENT ON COLUMN product_relations.sort_order IS 'Порядок сортировки';
COMMENT ON COLUMN product_relations.is_active IS 'Активна ли связь';

ALTER TABLE product_relations ADD CONSTRAINT product_relations_unique
    UNIQUE (product_id, related_product_id, relation_type);

CREATE INDEX idx_product_relations_product_id ON product_relations (product_id);
CREATE INDEX idx_product_relations_related_product_id ON product_relations (related_product_id);
CREATE INDEX idx_product_relations_relation_type ON product_relations (relation_type);
CREATE INDEX idx_product_relations_sort_order ON product_relations (sort_order);
CREATE INDEX idx_product_relations_is_active ON product_relations (is_active);
ALTER TABLE product_relations
    ADD CONSTRAINT ck_product_relations_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_relations_public_id ON product_relations (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_product_relations_public_id
    BEFORE INSERT ON product_relations
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

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
-- ФУНКЦИИ
-- ================================================================

-- Функция для проверки лимитов товаров
CREATE OR REPLACE FUNCTION check_products_limit(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_count INTEGER;
    v_limit INTEGER;
    v_tariff_limits JSONB;
BEGIN
    -- Получаем лимиты тарифа
    SELECT t.limits INTO v_tariff_limits
    FROM companies c
    JOIN tariffs t ON c.tariff_id = t.id
    WHERE c.id = p_company_id;

    -- Получаем лимит товаров
    v_limit := COALESCE((v_tariff_limits->>'products')::INTEGER, -1);

    -- Если лимит -1, значит безлимитно
    IF v_limit = -1 THEN
        RETURN TRUE;
    END IF;

    -- Подсчитываем текущее количество товаров
    SELECT COUNT(*) INTO v_current_count
    FROM products
    WHERE company_id = p_company_id AND is_active = TRUE;

    RETURN v_current_count < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Функция для генерации кода товара
CREATE OR REPLACE FUNCTION generate_product_code(p_company_id UUID, p_prefix VARCHAR DEFAULT 'PRD')
RETURNS VARCHAR AS $$
BEGIN
    RETURN generate_unique_code('products', 'internal_code', p_prefix, 8);
END;
$$ LANGUAGE plpgsql;

-- Функция для получения детальной информации о товаре
CREATE OR REPLACE FUNCTION get_product_details(p_product_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'product', to_jsonb(p.*),
        'brand', to_jsonb(b.*),
        'category', to_jsonb(c.*),
        'images', COALESCE(images.images, '[]'::jsonb),
        'variants', COALESCE(variants.variants, '[]'::jsonb),
        'attributes', COALESCE(attributes.attributes, '[]'::jsonb)
    ) INTO v_result
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN (
        SELECT product_id, jsonb_agg(to_jsonb(pi.*)) as images
        FROM product_images pi
        WHERE pi.is_active = TRUE
        GROUP BY product_id
    ) images ON p.id = images.product_id
    LEFT JOIN (
        SELECT product_id, jsonb_agg(to_jsonb(pv.*)) as variants
        FROM product_variants pv
        WHERE pv.is_active = TRUE
        GROUP BY product_id
    ) variants ON p.id = variants.product_id
    LEFT JOIN (
        SELECT pav.product_id, jsonb_agg(
            jsonb_build_object(
                'attribute', to_jsonb(pa.*),
                'value', CASE
                    WHEN pav.value_text IS NOT NULL THEN pav.value_text
                    WHEN pav.value_number IS NOT NULL THEN pav.value_number::text
                    WHEN pav.value_boolean IS NOT NULL THEN pav.value_boolean::text
                    ELSE pav.value_json::text
                END
            )
        ) as attributes
        FROM product_attribute_values pav
        JOIN product_attributes pa ON pav.attribute_id = pa.id
        WHERE pa.is_active = TRUE
        GROUP BY pav.product_id
    ) attributes ON p.id = attributes.product_id
    WHERE p.id = p_product_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Функция для поиска товаров по атрибутам
CREATE OR REPLACE FUNCTION search_products_by_attributes(
    p_company_id UUID,
    p_attributes JSONB DEFAULT '{}'::jsonb,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    product_id UUID,
    product_name VARCHAR,
    brand_name VARCHAR,
    category_name VARCHAR,
    attributes JSONB,
    relevance_score INTEGER
) AS $$
DECLARE
    v_attr_key TEXT;
    v_attr_value TEXT;
    v_attr_record RECORD;
BEGIN
    -- Создаем временную таблицу для результатов
    CREATE TEMP TABLE temp_search_results (
        product_id UUID,
        product_name VARCHAR,
        brand_name VARCHAR,
        category_name VARCHAR,
        attributes JSONB,
        relevance_score INTEGER DEFAULT 0
    );

    -- Для каждого атрибута в поиске
    FOR v_attr_key, v_attr_value IN SELECT * FROM jsonb_each_text(p_attributes)
    LOOP
        INSERT INTO temp_search_results
        SELECT
            p.id,
            p.name,
            b.name,
            c.name,
            jsonb_agg(
                jsonb_build_object(
                    'attribute_name', pa.name,
                    'attribute_value', CASE
                        WHEN pav.value_text IS NOT NULL THEN pav.value_text
                        WHEN pav.value_number IS NOT NULL THEN pav.value_number::text
                        WHEN pav.value_boolean IS NOT NULL THEN pav.value_boolean::text
                        ELSE pav.value_json::text
                    END
                )
            ),
            CASE
                WHEN pa.name ILIKE '%' || v_attr_key || '%' OR
                     pav.value_text ILIKE '%' || v_attr_value || '%' THEN 10
                ELSE 1
            END
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_attribute_values pav ON p.id = pav.product_id
        LEFT JOIN product_attributes pa ON pav.attribute_id = pa.id
        WHERE p.company_id = p_company_id
          AND p.is_active = TRUE
          AND (pa.name ILIKE '%' || v_attr_key || '%' OR
               pav.value_text ILIKE '%' || v_attr_value || '%')
        GROUP BY p.id, p.name, b.name, c.name
        ON CONFLICT (product_id) DO UPDATE SET
            relevance_score = temp_search_results.relevance_score + EXCLUDED.relevance_score;
    END LOOP;

    -- Возвращаем результаты
    RETURN QUERY
    SELECT
        tsr.product_id,
        tsr.product_name,
        tsr.brand_name,
        tsr.category_name,
        tsr.attributes,
        tsr.relevance_score
    FROM temp_search_results tsr
    ORDER BY tsr.relevance_score DESC, tsr.product_name
    LIMIT p_limit OFFSET p_offset;

    -- Удаляем временную таблицу
    DROP TABLE temp_search_results;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 003
-- ================================================================