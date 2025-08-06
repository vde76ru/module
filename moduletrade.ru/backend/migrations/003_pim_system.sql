-- ================================================================
-- МИГРАЦИЯ 003: Система управления продуктами (PIM)
-- Описание: Создает таблицы для управления продуктами, категориями, брендами и медиа
-- Дата: 2025-01-27
-- Блок: Управление Продуктами (PIM)
-- Зависимости: 002 (companies)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Categories - Иерархический справочник категорий товаров
-- ================================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    parent_id UUID,
    name VARCHAR(255) NOT NULL,
    canonical_name VARCHAR(255),
    slug VARCHAR(255),
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    image_url VARCHAR(500),
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    products_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_categories_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_categories_parent_id
        FOREIGN KEY (parent_id) REFERENCES categories(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE categories IS 'Иерархический справочник категорий товаров с поддержкой древовидной структуры';
COMMENT ON COLUMN categories.company_id IS 'Компания-владелец категории';
COMMENT ON COLUMN categories.parent_id IS 'Родительская категория для построения дерева (NULL для корневых категорий)';
COMMENT ON COLUMN categories.name IS 'Название категории';
COMMENT ON COLUMN categories.canonical_name IS 'Каноническое название категории для поиска и группировки';
COMMENT ON COLUMN categories.slug IS 'URL-friendly версия названия для SEO';
COMMENT ON COLUMN categories.description IS 'Описание категории';
COMMENT ON COLUMN categories.sort_order IS 'Порядок сортировки среди категорий одного уровня';
COMMENT ON COLUMN categories.is_active IS 'Активна ли категория (отображается в каталоге)';
COMMENT ON COLUMN categories.image_url IS 'URL изображения категории';
COMMENT ON COLUMN categories.meta_title IS 'SEO заголовок страницы категории';
COMMENT ON COLUMN categories.meta_description IS 'SEO описание для поисковых систем';
COMMENT ON COLUMN categories.meta_keywords IS 'SEO ключевые слова';
COMMENT ON COLUMN categories.settings IS 'Дополнительные настройки категории в JSON формате';
COMMENT ON COLUMN categories.products_count IS 'Кэшированное количество товаров в категории (включая подкатегории)';

ALTER TABLE categories ADD CONSTRAINT categories_name_unique_per_parent
    UNIQUE (company_id, parent_id, name);
ALTER TABLE categories ADD CONSTRAINT categories_slug_unique_per_company
    UNIQUE (company_id, slug);
ALTER TABLE categories ADD CONSTRAINT categories_no_self_parent_check
    CHECK (parent_id != id);

CREATE INDEX idx_categories_company_id ON categories (company_id);
CREATE INDEX idx_categories_parent_id ON categories (parent_id);
CREATE INDEX idx_categories_name ON categories (name);
CREATE INDEX idx_categories_slug ON categories (slug);
CREATE INDEX idx_categories_is_active ON categories (is_active);
CREATE INDEX idx_categories_sort_order ON categories (sort_order);
CREATE INDEX idx_categories_company_active ON categories (company_id, is_active, sort_order);
CREATE INDEX idx_categories_search ON categories USING gin (to_tsvector('russian', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_categories_products_count ON categories (products_count);

-- ================================================================
-- ТАБЛИЦА: Brands - Справочник брендов
-- ================================================================
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    canonical_name VARCHAR(255),
    slug VARCHAR(255),
    description TEXT,
    logo_url VARCHAR(500),
    image_url VARCHAR(500),
    website VARCHAR(255),
    contact_info JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    meta_title VARCHAR(255),
    meta_description TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    products_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_brands_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE brands IS 'Справочник брендов для классификации товаров';
COMMENT ON COLUMN brands.company_id IS 'Компания-владелец бренда';
COMMENT ON COLUMN brands.name IS 'Название бренда';
COMMENT ON COLUMN brands.canonical_name IS 'Каноническое название бренда для поиска и группировки';
COMMENT ON COLUMN brands.slug IS 'URL-friendly версия названия';
COMMENT ON COLUMN brands.description IS 'Описание бренда';
COMMENT ON COLUMN brands.logo_url IS 'URL логотипа бренда';
COMMENT ON COLUMN brands.image_url IS 'URL изображения бренда';
COMMENT ON COLUMN brands.website IS 'Официальный сайт бренда';
COMMENT ON COLUMN brands.contact_info IS 'Контактная информация бренда';
COMMENT ON COLUMN brands.is_active IS 'Активен ли бренд';
COMMENT ON COLUMN brands.sort_order IS 'Порядок сортировки брендов';
COMMENT ON COLUMN brands.meta_title IS 'SEO заголовок страницы бренда';
COMMENT ON COLUMN brands.meta_description IS 'SEO описание для поисковых систем';
COMMENT ON COLUMN brands.settings IS 'Дополнительные настройки бренда';
COMMENT ON COLUMN brands.products_count IS 'Кэшированное количество товаров бренда';

ALTER TABLE brands ADD CONSTRAINT brands_name_unique_per_company
    UNIQUE (company_id, name);
ALTER TABLE brands ADD CONSTRAINT brands_slug_unique_per_company
    UNIQUE (company_id, slug);

CREATE INDEX idx_brands_company_id ON brands (company_id);
CREATE INDEX idx_brands_name ON brands (name);
CREATE INDEX idx_brands_slug ON brands (slug);
CREATE INDEX idx_brands_is_active ON brands (is_active);
CREATE INDEX idx_brands_sort_order ON brands (sort_order);
CREATE INDEX idx_brands_company_active ON brands (company_id, is_active, sort_order);
CREATE INDEX idx_brands_search ON brands USING gin (to_tsvector('russian', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_brands_products_count ON brands (products_count);

-- ================================================================
-- ТАБЛИЦА: Products - Товары
-- ================================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    short_description TEXT,
    sku VARCHAR(255),
    barcode VARCHAR(255),
    brand_id UUID,
    category_id UUID,
    weight DECIMAL(10,3),
    length DECIMAL(10,3),
    width DECIMAL(10,3),
    height DECIMAL(10,3),
    status VARCHAR(50) DEFAULT 'active',
    is_visible BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    attributes JSONB DEFAULT '{}'::jsonb,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    slug VARCHAR(255),
    internal_code VARCHAR(255),
    source_type VARCHAR(50) DEFAULT 'manual',
    main_supplier_id UUID,
    base_unit VARCHAR(50) DEFAULT 'шт',
    is_divisible BOOLEAN DEFAULT FALSE,
    min_order_quantity DECIMAL(10,3) DEFAULT 1,
    volume DECIMAL(12,3),
    dimensions JSONB DEFAULT '{}'::jsonb,
    popularity_score INTEGER DEFAULT 0,
    external_id VARCHAR(255),
    external_data JSONB DEFAULT '{}'::jsonb,
    last_sync TIMESTAMP WITH TIME ZONE,
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

COMMENT ON TABLE products IS 'Товары компании';
COMMENT ON COLUMN products.company_id IS 'Компания-владелец товара';
COMMENT ON COLUMN products.name IS 'Название товара';
COMMENT ON COLUMN products.description IS 'Полное описание товара';
COMMENT ON COLUMN products.short_description IS 'Краткое описание товара';
COMMENT ON COLUMN products.sku IS 'Артикул товара (Stock Keeping Unit)';
COMMENT ON COLUMN products.barcode IS 'Штрих-код товара';
COMMENT ON COLUMN products.brand_id IS 'Бренд товара';
COMMENT ON COLUMN products.category_id IS 'Категория товара';
COMMENT ON COLUMN products.weight IS 'Вес товара в килограммах';
COMMENT ON COLUMN products.length IS 'Длина товара в сантиметрах';
COMMENT ON COLUMN products.width IS 'Ширина товара в сантиметрах';
COMMENT ON COLUMN products.height IS 'Высота товара в сантиметрах';
COMMENT ON COLUMN products.status IS 'Статус товара: active, draft, archived';
COMMENT ON COLUMN products.is_visible IS 'Видим ли товар в каталоге';
COMMENT ON COLUMN products.sort_order IS 'Порядок сортировки товара';
COMMENT ON COLUMN products.attributes IS 'Дополнительные атрибуты товара в JSON формате';
COMMENT ON COLUMN products.meta_title IS 'SEO заголовок страницы товара';
COMMENT ON COLUMN products.meta_description IS 'SEO описание для поисковых систем';
COMMENT ON COLUMN products.meta_keywords IS 'SEO ключевые слова';
COMMENT ON COLUMN products.slug IS 'URL-friendly версия названия товара';
COMMENT ON COLUMN products.internal_code IS 'Внутренний код товара';
COMMENT ON COLUMN products.source_type IS 'Источник товара: manual, sync, import';
COMMENT ON COLUMN products.main_supplier_id IS 'Основной поставщик товара';
COMMENT ON COLUMN products.base_unit IS 'Базовая единица измерения';
COMMENT ON COLUMN products.is_divisible IS 'Можно ли делить товар на части';
COMMENT ON COLUMN products.min_order_quantity IS 'Минимальное количество для заказа';
COMMENT ON COLUMN products.volume IS 'Объем товара в кубических сантиметрах';
COMMENT ON COLUMN products.dimensions IS 'Габариты товара в JSON формате';
COMMENT ON COLUMN products.popularity_score IS 'Показатель популярности товара';
COMMENT ON COLUMN products.external_id IS 'Внешний ID товара в системе поставщика';
COMMENT ON COLUMN products.external_data IS 'Дополнительные данные от внешней системы';
COMMENT ON COLUMN products.last_sync IS 'Дата последней синхронизации';
COMMENT ON COLUMN products.is_active IS 'Активен ли товар';

ALTER TABLE products ADD CONSTRAINT products_sku_unique_per_company
    UNIQUE (company_id, sku);
ALTER TABLE products ADD CONSTRAINT products_slug_unique_per_company
    UNIQUE (company_id, slug);
ALTER TABLE products ADD CONSTRAINT products_barcode_unique_per_company
    UNIQUE (company_id, barcode);

CREATE INDEX idx_products_company_id ON products (company_id);
CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_brand_id ON products (brand_id);
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_products_barcode ON products (barcode);
CREATE INDEX idx_products_slug ON products (slug);
CREATE INDEX idx_products_status ON products (status);
CREATE INDEX idx_products_is_visible ON products (is_visible);
CREATE INDEX idx_products_sort_order ON products (sort_order);
CREATE INDEX idx_products_catalog ON products (company_id, status, is_visible, sort_order);
CREATE INDEX idx_products_category_status ON products (category_id, status, is_visible);
CREATE INDEX idx_products_search ON products USING gin (
    to_tsvector('russian', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(sku, ''))
);
CREATE INDEX idx_products_attributes ON products USING gin (attributes);
CREATE INDEX idx_products_internal_code ON products (internal_code);
CREATE INDEX idx_products_source_type ON products (source_type);
CREATE INDEX idx_products_main_supplier_id ON products (main_supplier_id);
CREATE INDEX idx_products_external_id ON products (external_id);
CREATE INDEX idx_products_last_sync ON products (last_sync);
CREATE INDEX idx_products_is_active ON products (is_active);

-- ================================================================
-- ТАБЛИЦА: Media - Медиафайлы товаров
-- ================================================================
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'image'
        CHECK (type IN ('image', 'video', 'document')),
    url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    title VARCHAR(255),
    description TEXT,
    file_size INTEGER,
    mime_type VARCHAR(100),
    width INTEGER,
    height INTEGER,
    duration INTEGER, -- для видео в секундах
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_media_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE media IS 'Медиафайлы товаров (изображения, видео, документы)';
COMMENT ON COLUMN media.product_id IS 'Товар, к которому привязан медиафайл';
COMMENT ON COLUMN media.type IS 'Тип медиафайла: image, video, document';
COMMENT ON COLUMN media.url IS 'URL медиафайла';
COMMENT ON COLUMN media.alt_text IS 'Альтернативный текст для изображений';
COMMENT ON COLUMN media.title IS 'Заголовок медиафайла';
COMMENT ON COLUMN media.description IS 'Описание медиафайла';
COMMENT ON COLUMN media.file_size IS 'Размер файла в байтах';
COMMENT ON COLUMN media.mime_type IS 'MIME-тип файла';
COMMENT ON COLUMN media.width IS 'Ширина изображения/видео в пикселях';
COMMENT ON COLUMN media.height IS 'Высота изображения/видео в пикселях';
COMMENT ON COLUMN media.duration IS 'Длительность видео в секундах';
COMMENT ON COLUMN media.is_primary IS 'Является ли медиафайл основным для товара';
COMMENT ON COLUMN media.sort_order IS 'Порядок сортировки медиафайлов';
COMMENT ON COLUMN media.metadata IS 'Дополнительные метаданные медиафайла';

-- Ограничение: только один основной медиафайл на товар
CREATE UNIQUE INDEX media_one_primary_per_product
    ON media (product_id)
    WHERE is_primary = true;

CREATE INDEX idx_media_product_id ON media (product_id);
CREATE INDEX idx_media_type ON media (type);
CREATE INDEX idx_media_sort_order ON media (sort_order);
CREATE INDEX idx_media_is_primary ON media (is_primary);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brands_updated_at
    BEFORE UPDATE ON brands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_updated_at
    BEFORE UPDATE ON media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ ДЛЯ ГЕНЕРАЦИИ SLUG
-- ================================================================

-- Функция для генерации slug из текста
CREATE OR REPLACE FUNCTION generate_slug(p_text VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(p_text, '[^а-яёa-z0-9\s-]', '', 'gi'),
                    '\s+', '-', 'g'
                ),
                '-+', '-', 'g'
            ),
            '^-|-$', '', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматической генерации slug для категорий
CREATE OR REPLACE FUNCTION categories_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_slug(NEW.name);
    END IF;

    -- Проверяем уникальность slug
    WHILE EXISTS (
        SELECT 1 FROM categories
        WHERE company_id = NEW.company_id
        AND slug = NEW.slug
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    ) LOOP
        NEW.slug := NEW.slug || '-' || floor(random() * 1000)::text;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматической генерации slug для брендов
CREATE OR REPLACE FUNCTION brands_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_slug(NEW.name);
    END IF;

    -- Проверяем уникальность slug
    WHILE EXISTS (
        SELECT 1 FROM brands
        WHERE company_id = NEW.company_id
        AND slug = NEW.slug
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    ) LOOP
        NEW.slug := NEW.slug || '-' || floor(random() * 1000)::text;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматической генерации slug для товаров
CREATE OR REPLACE FUNCTION products_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_slug(NEW.name);
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

-- Триггеры для автоматической генерации slug
CREATE TRIGGER categories_slug_trigger
    BEFORE INSERT OR UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION categories_generate_slug();

CREATE TRIGGER brands_slug_trigger
    BEFORE INSERT OR UPDATE ON brands
    FOR EACH ROW
    EXECUTE FUNCTION brands_generate_slug();

CREATE TRIGGER products_slug_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION products_generate_slug();

-- ================================================================
-- ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ СЧЕТЧИКОВ
-- ================================================================

-- Функция для обновления счетчика товаров в категории
CREATE OR REPLACE FUNCTION update_category_products_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем счетчик для старой категории
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id) THEN
        UPDATE categories
        SET products_count = (
            SELECT COUNT(*)
            FROM products
            WHERE category_id = OLD.category_id AND is_active = true
        )
        WHERE id = OLD.category_id;
    END IF;

    -- Обновляем счетчик для новой категории
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id) THEN
        UPDATE categories
        SET products_count = (
            SELECT COUNT(*)
            FROM products
            WHERE category_id = NEW.category_id AND is_active = true
        )
        WHERE id = NEW.category_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления счетчика товаров в бренде
CREATE OR REPLACE FUNCTION update_brand_products_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем счетчик для старого бренда
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.brand_id IS DISTINCT FROM NEW.brand_id) THEN
        UPDATE brands
        SET products_count = (
            SELECT COUNT(*)
            FROM products
            WHERE brand_id = OLD.brand_id AND is_active = true
        )
        WHERE id = OLD.brand_id;
    END IF;

    -- Обновляем счетчик для нового бренда
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.brand_id IS DISTINCT FROM NEW.brand_id) THEN
        UPDATE brands
        SET products_count = (
            SELECT COUNT(*)
            FROM products
            WHERE brand_id = NEW.brand_id AND is_active = true
        )
        WHERE id = NEW.brand_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Триггеры для автоматического обновления счетчиков
CREATE TRIGGER update_category_products_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_category_products_count();

CREATE TRIGGER update_brand_products_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_brand_products_count();

-- ================================================================
-- ФУНКЦИИ ДЛЯ ПРОВЕРКИ ЛИМИТОВ
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
    WHERE company_id = p_company_id AND is_active = true;

    -- Проверяем лимит через общую функцию
    RETURN check_company_limits(p_company_id, 'products', v_current_count);
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С КАТЕГОРИЯМИ
-- ================================================================

-- Функция для получения всех потомков категории
CREATE OR REPLACE FUNCTION get_category_descendants(p_category_id UUID)
RETURNS TABLE (id UUID, name VARCHAR, level INTEGER) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE category_tree AS (
        -- Базовый случай: сама категория
        SELECT c.id, c.name, 0 as level
        FROM categories c
        WHERE c.id = p_category_id

        UNION ALL

        -- Рекурсивный случай: дочерние категории
        SELECT c.id, c.name, ct.level + 1
        FROM categories c
        JOIN category_tree ct ON c.parent_id = ct.id
    )
    SELECT ct.id, ct.name, ct.level
    FROM category_tree ct
    WHERE ct.id != p_category_id; -- Исключаем саму категорию
END;
$$ LANGUAGE plpgsql;

-- Функция для получения пути к категории
CREATE OR REPLACE FUNCTION get_category_path(p_category_id UUID)
RETURNS TABLE (id UUID, name VARCHAR, level INTEGER) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE category_path AS (
        -- Базовый случай: сама категория
        SELECT c.id, c.name, 0 as level
        FROM categories c
        WHERE c.id = p_category_id

        UNION ALL

        -- Рекурсивный случай: родительские категории
        SELECT c.id, c.name, cp.level + 1
        FROM categories c
        JOIN category_path cp ON c.id = cp.parent_id
    )
    SELECT cp.id, cp.name, cp.level
    FROM category_path cp
    ORDER BY cp.level DESC; -- От корня к листу
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 003
-- ================================================================