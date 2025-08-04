-- ========================================
-- МИГРАЦИЯ 002: МОДУЛЬ PIM (Product Information Management)
-- Таблицы для управления каталогом товаров
-- Версия: 2.0
-- ========================================

-- ========================================
-- ЭТАЛОННЫЕ СПРАВОЧНИКИ БРЕНДОВ
-- ========================================

CREATE TABLE internal_brands (
    id SERIAL PRIMARY KEY,

    -- Основная информация
    name VARCHAR(255) NOT NULL,
    canonical_name VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(regexp_replace(name, '\s+', ' ', 'g')))) STORED,
    description TEXT,

    -- Дополнительная информация
    logo_url VARCHAR(500),
    website VARCHAR(255),
    country VARCHAR(100),

    -- SEO и поиск
    slug VARCHAR(255) UNIQUE,
    meta_title VARCHAR(255),
    meta_description TEXT,

    -- Статус и настройки
    is_active BOOLEAN DEFAULT TRUE,
    popularity_score INTEGER DEFAULT 0,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(canonical_name)
);

COMMENT ON TABLE internal_brands IS 'Эталонный справочник брендов';

-- ========================================
-- ЭТАЛОННЫЕ СПРАВОЧНИКИ КАТЕГОРИЙ
-- ========================================

CREATE TABLE internal_categories (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES internal_categories(id) ON DELETE CASCADE,

    -- Основная информация
    name VARCHAR(255) NOT NULL,
    canonical_name VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(regexp_replace(name, '\s+', ' ', 'g')))) STORED,
    description TEXT,

    -- Иерархия
    path TEXT, -- Полный путь: "root/electronics/smartphones"
    level INTEGER DEFAULT 0,
    full_path TEXT, -- Человекочитаемый: "Электроника > Смартфоны"

    -- SEO и отображение
    slug VARCHAR(255) UNIQUE,
    icon VARCHAR(100), -- CSS класс или имя иконки
    color VARCHAR(20), -- цвет для UI
    image_url VARCHAR(500),

    -- Настройки отображения
    sort_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,

    -- Схема атрибутов для товаров этой категории
    attributes_schema JSONB DEFAULT '{}',

    -- SEO метаданные
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    popularity_score INTEGER DEFAULT 0,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE internal_categories IS 'Эталонный справочник категорий товаров';

-- ========================================
-- АТРИБУТЫ ТОВАРОВ
-- ========================================

CREATE TABLE internal_attributes (
    id SERIAL PRIMARY KEY,

    -- Основная информация
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,

    -- Тип атрибута
    attribute_type VARCHAR(50) NOT NULL, -- text, number, boolean, select, multiselect, date, file
    data_type VARCHAR(50) NOT NULL, -- string, integer, decimal, boolean, json, array

    -- Единица измерения для числовых атрибутов
    unit VARCHAR(50),

    -- Возможные значения для select/multiselect
    possible_values JSONB DEFAULT '[]',

    -- Правила валидации
    validation_rules JSONB DEFAULT '{}',
    -- Пример: {"min": 0, "max": 1000, "pattern": "^[A-Za-z]+$", "required": true}

    -- Настройки отображения
    is_required BOOLEAN DEFAULT FALSE,
    is_filterable BOOLEAN DEFAULT FALSE,
    is_searchable BOOLEAN DEFAULT FALSE,
    is_comparable BOOLEAN DEFAULT FALSE,

    -- Применимость к категориям
    category_ids INTEGER[], -- массив ID категорий, для которых применим
    is_global BOOLEAN DEFAULT FALSE, -- применим ко всем категориям

    -- Группировка и сортировка
    group_name VARCHAR(100),
    sort_order INTEGER DEFAULT 0,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE internal_attributes IS 'Эталонный справочник атрибутов товаров';

-- ========================================
-- ОСНОВНАЯ ТАБЛИЦА ТОВАРОВ
-- ========================================

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Основная информация
    internal_code VARCHAR(100) NOT NULL, -- внутренний артикул
    name VARCHAR(500) NOT NULL,
    description TEXT,
    short_description TEXT,

    -- Связи со справочниками
    brand_id INTEGER REFERENCES internal_brands(id) ON DELETE SET NULL,
    category_id INTEGER REFERENCES internal_categories(id) ON DELETE SET NULL,

    -- Технические характеристики
    specifications TEXT,

    -- Динамические атрибуты товара (JSON)
    attributes JSONB DEFAULT '{}',
    -- Пример: {"color": "red", "size": "XL", "material": "cotton", "weight": 0.5}

    -- Тип источника товара
    source_type VARCHAR(50) NOT NULL DEFAULT 'internal',
    -- Возможные значения: internal, supplier, marketplace, import

    -- Основной поставщик (будет заполнен из модуля поставщиков)
    main_supplier_id INTEGER, -- будет добавлена внешняя связь позже

    -- Габариты и вес
    weight DECIMAL(10,3), -- вес в кг
    length DECIMAL(10,2), -- длина в см
    width DECIMAL(10,2), -- ширина в см
    height DECIMAL(10,2), -- высота в см
    volume DECIMAL(10,4), -- объем в м³ (вычисляется автоматически)

    -- Упаковка
    packaging_info JSONB DEFAULT '{}',
    -- Пример: {"type": "box", "units_per_pack": 10, "pack_weight": 5.5}

    -- Единицы измерения
    unit_of_measure VARCHAR(20) DEFAULT 'pcs',
    min_order_quantity DECIMAL(10,3) DEFAULT 1,
    order_quantity_step DECIMAL(10,3) DEFAULT 1,

    -- Статусы и видимость
    is_active BOOLEAN DEFAULT TRUE,
    is_visible BOOLEAN DEFAULT TRUE,
    moderation_status VARCHAR(50) DEFAULT 'pending',
    -- Возможные значения: pending, approved, rejected, needs_review

    -- SEO
    slug VARCHAR(255),
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,

    -- Теги для поиска
    search_tags TEXT[],

    -- Популярность и рейтинг
    popularity_score INTEGER DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,

    -- Дополнительная информация
    notes TEXT,
    internal_notes TEXT, -- не показывается клиентам

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    -- Отметки времени
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ограничения
    UNIQUE(company_id, internal_code),
    UNIQUE(company_id, slug)
);

COMMENT ON TABLE products IS 'Основная таблица товаров компании';

-- ========================================
-- МЕДИАФАЙЛЫ ТОВАРОВ
-- ========================================

CREATE TABLE product_media (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,

    -- Тип медиа
    media_type VARCHAR(50) NOT NULL,
    -- Возможные значения: image, video, document, 3d_model, audio

    -- URL и файл
    url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255),
    file_size INTEGER, -- размер в байтах

    -- Описание и альтернативный текст
    title VARCHAR(255),
    alt_text VARCHAR(255),
    description TEXT,

    -- Сортировка и отображение
    sort_order INTEGER DEFAULT 0,
    is_main BOOLEAN DEFAULT FALSE, -- главное изображение

    -- Дополнительные версии (для изображений)
    thumbnails JSONB DEFAULT '{}',
    -- Пример: {"small": "url_small", "medium": "url_medium", "large": "url_large"}

    -- Метаданные файла
    metadata JSONB DEFAULT '{}',
    -- Пример: {"width": 1920, "height": 1080, "format": "jpeg", "quality": 95}

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE product_media IS 'Медиафайлы товаров (изображения, видео, документы)';

-- ========================================
-- ЦЕНЫ ТОВАРОВ
-- ========================================

CREATE TABLE product_prices (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,

    -- Тип цены
    price_type VARCHAR(50) NOT NULL, -- purchase, retail, wholesale, special, promo

    -- Финансовая информация
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) DEFAULT 'RUB',

    -- Условия применения цены
    min_quantity DECIMAL(10,3) DEFAULT 1,
    max_quantity DECIMAL(10,3),

    -- Период действия
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,

    -- Источник цены
    source VARCHAR(100), -- supplier, marketplace, manual, auto
    source_id VARCHAR(255), -- ID источника

    -- Дополнительные условия
    conditions JSONB DEFAULT '{}',
    -- Пример: {"customer_type": "wholesale", "region": "moscow", "payment_terms": "prepay"}

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE product_prices IS 'История и текущие цены товаров';

-- ========================================
-- СВЯЗИ ТОВАРОВ
-- ========================================

CREATE TABLE product_relations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    related_product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,

    -- Тип связи
    relation_type VARCHAR(50) NOT NULL,
    -- Возможные значения: similar, accessory, complement, variant, bundle, replacement

    -- Дополнительные параметры связи
    relation_strength DECIMAL(3,2) DEFAULT 1.0, -- сила связи от 0.00 до 1.00
    is_bidirectional BOOLEAN DEFAULT TRUE, -- двунаправленная ли связь

    -- Метаданные связи
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ограничения
    UNIQUE(product_id, related_product_id, relation_type),
    CHECK(product_id != related_product_id)
);

COMMENT ON TABLE product_relations IS 'Связи между товарами (похожие, аксессуары, комплекты)';

-- ========================================
-- ЕДИНИЦЫ ИЗМЕРЕНИЯ И КОНВЕРСИИ
-- ========================================

CREATE TABLE unit_conversions (
    id SERIAL PRIMARY KEY,

    -- Основная информация
    from_unit VARCHAR(50) NOT NULL,
    to_unit VARCHAR(50) NOT NULL,

    -- Коэффициент конверсии
    conversion_factor DECIMAL(15,6) NOT NULL,
    -- Пример: 1 кг = 1000 г, conversion_factor = 1000

    -- Категория единиц
    category VARCHAR(50),
    -- Возможные значения: weight, length, volume, area, pieces

    -- Описание правила
    description TEXT,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(from_unit, to_unit)
);

COMMENT ON TABLE unit_conversions IS 'Правила конверсии единиц измерения';

-- ========================================
-- ИСТОРИЯ ИЗМЕНЕНИЙ ТОВАРОВ
-- ========================================

CREATE TABLE product_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Тип действия
    action VARCHAR(50) NOT NULL,
    -- Возможные значения: create, update, delete, restore, import, export

    -- Источник изменения
    change_source VARCHAR(50) DEFAULT 'manual',
    -- Возможные значения: manual, api, import, sync, system

    -- Детали изменения
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],

    -- Описание изменения
    description TEXT,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE product_history IS 'История изменений товаров для аудита';

-- ========================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ========================================

-- Индексы для брендов
CREATE INDEX idx_internal_brands_name ON internal_brands(name);
CREATE INDEX idx_internal_brands_canonical_name ON internal_brands(canonical_name);
CREATE INDEX idx_internal_brands_is_active ON internal_brands(is_active);
CREATE INDEX idx_internal_brands_slug ON internal_brands(slug);

-- Индексы для категорий
CREATE INDEX idx_internal_categories_parent_id ON internal_categories(parent_id);
CREATE INDEX idx_internal_categories_level ON internal_categories(level);
CREATE INDEX idx_internal_categories_path ON internal_categories(path);
CREATE INDEX idx_internal_categories_is_active ON internal_categories(is_active);
CREATE INDEX idx_internal_categories_is_visible ON internal_categories(is_visible);
CREATE INDEX idx_internal_categories_sort_order ON internal_categories(sort_order);
CREATE INDEX idx_internal_categories_slug ON internal_categories(slug);

-- Индексы для атрибутов
CREATE INDEX idx_internal_attributes_code ON internal_attributes(code);
CREATE INDEX idx_internal_attributes_type ON internal_attributes(attribute_type);
CREATE INDEX idx_internal_attributes_data_type ON internal_attributes(data_type);
CREATE INDEX idx_internal_attributes_is_active ON internal_attributes(is_active);
CREATE INDEX idx_internal_attributes_category_ids ON internal_attributes USING GIN(category_ids);
CREATE INDEX idx_internal_attributes_is_filterable ON internal_attributes(is_filterable);
CREATE INDEX idx_internal_attributes_is_searchable ON internal_attributes(is_searchable);

-- Индексы для товаров
CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_products_internal_code ON products(internal_code);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_source_type ON products(source_type);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_is_visible ON products(is_visible);
CREATE INDEX idx_products_main_supplier_id ON products(main_supplier_id);
CREATE INDEX idx_products_moderation_status ON products(moderation_status);
CREATE INDEX idx_products_published_at ON products(published_at);
CREATE INDEX idx_products_popularity ON products(popularity_score DESC);
CREATE INDEX idx_products_slug ON products(slug);

-- Полнотекстовый поиск для товаров
CREATE INDEX idx_products_name_gin ON products USING GIN(to_tsvector('russian', name));
CREATE INDEX idx_products_description_gin ON products USING GIN(to_tsvector('russian', description));
CREATE INDEX idx_products_search_tags ON products USING GIN(search_tags);

-- GIN индексы для JSON полей
CREATE INDEX idx_products_attributes ON products USING GIN(attributes);
CREATE INDEX idx_products_packaging_info ON products USING GIN(packaging_info);
CREATE INDEX idx_products_metadata ON products USING GIN(metadata);

-- Составные индексы для частых запросов
CREATE INDEX idx_products_company_active_visible ON products(company_id, is_active, is_visible);
CREATE INDEX idx_products_category_active ON products(category_id, is_active);
CREATE INDEX idx_products_brand_active ON products(brand_id, is_active);

-- Индексы для медиафайлов
CREATE INDEX idx_product_media_product_id ON product_media(product_id);
CREATE INDEX idx_product_media_type ON product_media(media_type);
CREATE INDEX idx_product_media_is_main ON product_media(is_main);
CREATE INDEX idx_product_media_is_active ON product_media(is_active);
CREATE INDEX idx_product_media_sort_order ON product_media(sort_order);

-- Индексы для цен
CREATE INDEX idx_product_prices_product_id ON product_prices(product_id);
CREATE INDEX idx_product_prices_type ON product_prices(price_type);
CREATE INDEX idx_product_prices_valid_dates ON product_prices(valid_from, valid_until);
CREATE INDEX idx_product_prices_is_active ON product_prices(is_active);
CREATE INDEX idx_product_prices_amount ON product_prices(amount);
CREATE INDEX idx_product_prices_currency ON product_prices(currency);

-- Составные индексы для цен
CREATE INDEX idx_product_prices_active_current ON product_prices(product_id, is_active, valid_from, valid_until);

-- Индексы для связей товаров
CREATE INDEX idx_product_relations_product_id ON product_relations(product_id);
CREATE INDEX idx_product_relations_related_product_id ON product_relations(related_product_id);
CREATE INDEX idx_product_relations_type ON product_relations(relation_type);
CREATE INDEX idx_product_relations_is_active ON product_relations(is_active);

-- Индексы для конверсии единиц
CREATE INDEX idx_unit_conversions_from_unit ON unit_conversions(from_unit);
CREATE INDEX idx_unit_conversions_to_unit ON unit_conversions(to_unit);
CREATE INDEX idx_unit_conversions_category ON unit_conversions(category);

-- Индексы для истории товаров
CREATE INDEX idx_product_history_product_id ON product_history(product_id);
CREATE INDEX idx_product_history_user_id ON product_history(user_id);
CREATE INDEX idx_product_history_action ON product_history(action);
CREATE INDEX idx_product_history_created_at ON product_history(created_at);

-- ========================================
-- ТРИГГЕРЫ ДЛЯ АВТОМАТИЗАЦИИ
-- ========================================

-- Триггеры для обновления updated_at
CREATE TRIGGER trigger_update_internal_brands_updated_at
    BEFORE UPDATE ON internal_brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_internal_categories_updated_at
    BEFORE UPDATE ON internal_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_internal_attributes_updated_at
    BEFORE UPDATE ON internal_attributes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_product_media_updated_at
    BEFORE UPDATE ON product_media
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_product_prices_updated_at
    BEFORE UPDATE ON product_prices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_product_relations_updated_at
    BEFORE UPDATE ON product_relations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С ТОВАРАМИ
-- ========================================

-- Функция для автоматического расчета объема
CREATE OR REPLACE FUNCTION calculate_product_volume()
RETURNS TRIGGER AS $$
BEGIN
    -- Рассчитываем объем если заданы все три измерения
    IF NEW.length IS NOT NULL AND NEW.width IS NOT NULL AND NEW.height IS NOT NULL THEN
        NEW.volume := (NEW.length * NEW.width * NEW.height) / 1000000; -- см3 в м3
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Исправленная функция для автоматического создания slug
CREATE OR REPLACE FUNCTION generate_product_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
    name_changed BOOLEAN := FALSE;
BEGIN
    -- Проверяем изменилось ли имя для UPDATE операций
    IF TG_OP = 'UPDATE' THEN
        name_changed := OLD.name IS DISTINCT FROM NEW.name;
    END IF;

    -- Генерируем slug только если:
    -- 1. Это INSERT и slug не задан
    -- 2. Это UPDATE и (имя изменилось или slug пустой)
    IF (TG_OP = 'INSERT' AND NEW.slug IS NULL) OR
       (TG_OP = 'UPDATE' AND (name_changed OR NEW.slug IS NULL)) THEN

        -- Создаем базовый slug из названия
        base_slug := LOWER(regexp_replace(trim(NEW.name), '[^a-zA-Z0-9а-яёА-ЯЁ\s-]', '', 'g'));
        base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
        base_slug := regexp_replace(base_slug, '-+', '-', 'g');
        base_slug := trim(base_slug, '-');

        -- Ограничиваем длину
        base_slug := substring(base_slug, 1, 100);

        final_slug := base_slug;

        -- Проверяем уникальность и добавляем счетчик если нужно
        WHILE EXISTS (SELECT 1 FROM products WHERE slug = final_slug AND id != COALESCE(NEW.id, -1)) LOOP
            counter := counter + 1;
            final_slug := base_slug || '-' || counter;
        END LOOP;

        NEW.slug := final_slug;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для логирования изменений товаров
CREATE OR REPLACE FUNCTION log_product_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_id_val INTEGER;
    action_val VARCHAR(50);
BEGIN
    -- Получаем ID пользователя из контекста
    BEGIN
        user_id_val := current_setting('app.current_user_id')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        user_id_val := NULL;
    END;

    -- Определяем действие
    IF TG_OP = 'INSERT' THEN
        action_val := 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        action_val := 'update';
    ELSIF TG_OP = 'DELETE' THEN
        action_val := 'delete';
    END IF;

    -- Записываем в историю
    INSERT INTO product_history (
        product_id, user_id, action, change_source, metadata
    ) VALUES (
        CASE WHEN action_val = 'delete' THEN OLD.id ELSE NEW.id END,
        user_id_val,
        action_val,
        'manual',
        CASE
            WHEN action_val = 'delete' THEN row_to_json(OLD)
            ELSE row_to_json(NEW)
        END
    );

    RETURN CASE WHEN action_val = 'delete' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггеры для автоматизации
CREATE TRIGGER trigger_calculate_product_volume
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION calculate_product_volume();

-- ИСПРАВЛЕННЫЙ единый триггер для генерации slug
CREATE TRIGGER trigger_generate_product_slug
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION generate_product_slug();

CREATE TRIGGER trigger_log_product_changes
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION log_product_changes();

-- ========================================
-- ПРОВЕРКИ И ОГРАНИЧЕНИЯ
-- ========================================

-- Проверки для атрибутов
ALTER TABLE internal_attributes ADD CONSTRAINT check_attribute_type
    CHECK (attribute_type IN ('text', 'number', 'boolean', 'select', 'multiselect', 'date', 'file', 'url', 'email'));

ALTER TABLE internal_attributes ADD CONSTRAINT check_data_type
    CHECK (data_type IN ('string', 'integer', 'decimal', 'boolean', 'json', 'array', 'date', 'datetime'));

-- Проверки для товаров
ALTER TABLE products ADD CONSTRAINT check_source_type
    CHECK (source_type IN ('internal', 'supplier', 'marketplace', 'import', 'manual'));

ALTER TABLE products ADD CONSTRAINT check_moderation_status
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'needs_review'));

-- Проверки для медиафайлов
ALTER TABLE product_media ADD CONSTRAINT check_media_type
    CHECK (media_type IN ('image', 'video', 'document', '3d_model', 'audio'));

-- Проверки для цен
ALTER TABLE product_prices ADD CONSTRAINT check_price_type
    CHECK (price_type IN ('purchase', 'retail', 'wholesale', 'special', 'promo', 'custom'));

ALTER TABLE product_prices ADD CONSTRAINT check_amount_positive
    CHECK (amount >= 0);

ALTER TABLE product_prices ADD CONSTRAINT check_min_quantity_positive
    CHECK (min_quantity > 0);

ALTER TABLE product_prices ADD CONSTRAINT check_quantity_order
    CHECK (max_quantity IS NULL OR max_quantity >= min_quantity);

-- Проверки для связей товаров
ALTER TABLE product_relations ADD CONSTRAINT check_relation_type
    CHECK (relation_type IN ('similar', 'accessory', 'complement', 'variant', 'bundle', 'replacement'));

ALTER TABLE product_relations ADD CONSTRAINT check_relation_strength
    CHECK (relation_strength >= 0 AND relation_strength <= 1);

-- Проверки для конверсии единиц
ALTER TABLE unit_conversions ADD CONSTRAINT check_conversion_factor_positive
    CHECK (conversion_factor > 0);

ALTER TABLE unit_conversions ADD CONSTRAINT check_unit_category
    CHECK (category IN ('weight', 'length', 'volume', 'area', 'pieces', 'time', 'temperature'));

-- Проверки для истории
ALTER TABLE product_history ADD CONSTRAINT check_history_action
    CHECK (action IN ('create', 'update', 'delete', 'restore', 'import', 'export'));

ALTER TABLE product_history ADD CONSTRAINT check_change_source
    CHECK (change_source IN ('manual', 'api', 'import', 'sync', 'system'));

-- ========================================
-- ПЕРВИЧНЫЕ ДАННЫЕ ДЛЯ ЕДИНИЦ ИЗМЕРЕНИЯ
-- ========================================

INSERT INTO unit_conversions (from_unit, to_unit, conversion_factor, category, description) VALUES
-- Вес
('kg', 'g', 1000, 'weight', 'Килограммы в граммы'),
('g', 'kg', 0.001, 'weight', 'Граммы в килограммы'),
('kg', 'mg', 1000000, 'weight', 'Килограммы в миллиграммы'),
('t', 'kg', 1000, 'weight', 'Тонны в килограммы'),

-- Длина
('m', 'cm', 100, 'length', 'Метры в сантиметры'),
('cm', 'm', 0.01, 'length', 'Сантиметры в метры'),
('m', 'mm', 1000, 'length', 'Метры в миллиметры'),
('km', 'm', 1000, 'length', 'Километры в метры'),

-- Объем
('l', 'ml', 1000, 'volume', 'Литры в миллилитры'),
('ml', 'l', 0.001, 'volume', 'Миллилитры в литры'),
('m3', 'l', 1000, 'volume', 'Кубические метры в литры'),

-- Площадь
('m2', 'cm2', 10000, 'area', 'Квадратные метры в квадратные сантиметры'),
('ha', 'm2', 10000, 'area', 'Гектары в квадратные метры'),

-- Штуки и упаковки
('box', 'pcs', 1, 'pieces', 'Коробки в штуки (по умолчанию)'),
('pack', 'pcs', 1, 'pieces', 'Упаковки в штуки (по умолчанию)')
ON CONFLICT (from_unit, to_unit) DO NOTHING;

-- ========================================
-- КОММЕНТАРИИ К ПОЛЯМ
-- ========================================

COMMENT ON COLUMN products.internal_code IS 'Внутренний артикул товара в системе компании';
COMMENT ON COLUMN products.source_type IS 'Источник добавления товара: internal, supplier, marketplace, import';
COMMENT ON COLUMN products.moderation_status IS 'Статус модерации товара: pending, approved, rejected, needs_review';
COMMENT ON COLUMN products.slug IS 'URL-friendly идентификатор для товара';
COMMENT ON COLUMN product_prices.price_type IS 'Тип цены: purchase, retail, wholesale, special, promo';
COMMENT ON COLUMN product_relations.relation_type IS 'Тип связи: similar, accessory, complement, variant, bundle, replacement';

-- ========================================
-- ГРАНТЫ НА ТАБЛИЦЫ (если нужно)
-- ========================================

-- Пример грантов для роли backend_app
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO backend_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO backend_app;