-- ========================================
-- МИГРАЦИЯ 002: ТОВАРЫ И КАТЕГОРИИ  
-- Модуль управления товарами (PIM)
-- ========================================

-- ========================================
-- КАТЕГОРИИ ТОВАРОВ
-- ========================================

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Иерархия категорий
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Основная информация
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code VARCHAR(100), -- уникальный код в рамках компании
    
    -- Путь в дереве (для быстрого поиска)
    path VARCHAR(1000), -- например: "1.15.23"
    level INTEGER DEFAULT 0,
    
    -- Изображение категории
    image_url VARCHAR(500),
    
    -- Метаданные
    metadata JSONB DEFAULT '{}',
    
    -- Порядок сортировки
    sort_order INTEGER DEFAULT 0,
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

CREATE INDEX idx_categories_company_id ON categories(company_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_path ON categories(path);
CREATE INDEX idx_categories_level ON categories(level);
CREATE INDEX idx_categories_is_active ON categories(is_active);

-- ========================================
-- БРЕНДЫ
-- ========================================

CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Основная информация
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Логотип бренда
    logo_url VARCHAR(500),
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, name)
);

CREATE INDEX idx_brands_company_id ON brands(company_id);
CREATE INDEX idx_brands_is_active ON brands(is_active);

-- ========================================
-- ЕДИНИЦЫ ИЗМЕРЕНИЯ И КОНВЕРСИИ
-- ========================================

CREATE TABLE unit_conversions (
    id SERIAL PRIMARY KEY,
    
    from_unit VARCHAR(20) NOT NULL,
    to_unit VARCHAR(20) NOT NULL,
    conversion_factor DECIMAL(15,6) NOT NULL,
    
    -- Категория конверсии
    category VARCHAR(50), -- weight, length, volume, area, pieces, etc
    
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(from_unit, to_unit)
);

CREATE INDEX idx_unit_conversions_from_unit ON unit_conversions(from_unit);
CREATE INDEX idx_unit_conversions_to_unit ON unit_conversions(to_unit);
CREATE INDEX idx_unit_conversions_category ON unit_conversions(category);

-- ========================================
-- ТОВАРЫ (ОСНОВНАЯ ТАБЛИЦА)
-- ========================================

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Основная информация
    name VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Коды и артикулы - ✅ ИСПРАВЛЕНО: Добавлено поле sku
    internal_code VARCHAR(100), -- внутренний код компании
    sku VARCHAR(100), -- ✅ Stock Keeping Unit - складской код
    barcode VARCHAR(100), -- штрихкод (EAN, UPC, etc)
    
    -- Связи
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, -- ✅ ИСПРАВЛЕНО
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    
    -- Единицы измерения - ✅ ИСПРАВЛЕНО: Добавлены поля
    base_unit VARCHAR(20) DEFAULT 'pcs', -- базовая единица измерения
    is_divisible BOOLEAN DEFAULT FALSE, -- можно ли дробить товар
    
    -- Размеры и вес - ✅ ИСПРАВЛЕНО: Добавлены поля weight, dimensions
    weight DECIMAL(10,3), -- вес в килограммах
    length DECIMAL(10,3), -- длина в сантиметрах  
    width DECIMAL(10,3), -- ширина в сантиметрах
    height DECIMAL(10,3), -- высота в сантиметрах
    volume DECIMAL(10,3), -- объем в литрах (вычисляемое или заданное)
    
    -- Цены и финансы
    purchase_price DECIMAL(12,2) DEFAULT 0,
    base_price DECIMAL(12,2) DEFAULT 0, -- базовая цена продажи
    min_price DECIMAL(12,2), -- минимальная цена
    recommended_price DECIMAL(12,2), -- рекомендованная цена
    currency VARCHAR(3) DEFAULT 'RUB',
    
    -- НДС
    vat_rate DECIMAL(5,2) DEFAULT 20.00,
    
    -- Остатки и лимиты
    current_stock DECIMAL(10,3) DEFAULT 0,
    reserved_stock DECIMAL(10,3) DEFAULT 0,
    available_stock DECIMAL(10,3) GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
    
    -- Лимиты остатков
    min_stock_level DECIMAL(10,3) DEFAULT 0, -- минимальный остаток
    max_stock_level DECIMAL(10,3), -- максимальный остаток
    reorder_point DECIMAL(10,3), -- точка перезаказа
    
    -- Упаковка
    package_items_count INTEGER DEFAULT 1, -- количество в упаковке
    package_weight DECIMAL(10,3), -- вес упаковки
    
    -- Источник товара
    source_type VARCHAR(50) DEFAULT 'manual', -- manual, import, sync, api
    source_id VARCHAR(255), -- ID в источнике
    
    -- Поставщик по умолчанию
    main_supplier_id INTEGER, -- будет добавлен FK после создания suppliers
    
    -- Изображения
    images JSONB DEFAULT '[]',
    main_image_url VARCHAR(500),
    
    -- SEO и описания
    seo_title VARCHAR(255),
    seo_description TEXT,
    seo_keywords TEXT,
    
    -- Характеристики товара
    attributes JSONB DEFAULT '{}',
    
    -- Статусы
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, discontinued, out_of_stock
    is_active BOOLEAN DEFAULT TRUE,
    is_published BOOLEAN DEFAULT FALSE, -- опубликован на сайте/маркетплейсах
    
    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ограничения
    UNIQUE(company_id, internal_code),
    UNIQUE(company_id, sku) -- ✅ ИСПРАВЛЕНО: уникальность SKU
);

-- Индексы для таблицы products
CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_internal_code ON products(internal_code);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_is_published ON products(is_published);
CREATE INDEX idx_products_current_stock ON products(current_stock);
CREATE INDEX idx_products_available_stock ON products(available_stock);
CREATE INDEX idx_products_name_search ON products USING GIN(to_tsvector('russian', name));

-- ========================================
-- ИСТОРИЯ ИЗМЕНЕНИЙ ТОВАРОВ
-- ========================================

CREATE TABLE product_history (
    id BIGSERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Кто и когда изменил
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Тип изменения
    action VARCHAR(50) NOT NULL, -- create, update, delete, restore, import, export
    
    -- Что изменилось
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    
    -- Источник изменения
    change_source VARCHAR(50) DEFAULT 'manual', -- manual, api, import, sync, system
    
    -- Дополнительная информация
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_product_history_product_id ON product_history(product_id);
CREATE INDEX idx_product_history_user_id ON product_history(user_id);
CREATE INDEX idx_product_history_action ON product_history(action);
CREATE INDEX idx_product_history_created_at ON product_history(created_at);

-- ========================================
-- ХАРАКТЕРИСТИКИ ТОВАРОВ (АТРИБУТЫ)
-- ========================================

CREATE TABLE product_attributes (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Основная информация
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Тип атрибута
    attribute_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, date, select, multiselect
    
    -- Возможные значения (для select/multiselect)
    possible_values JSONB DEFAULT '[]',
    
    -- Единица измерения (для числовых атрибутов)
    unit VARCHAR(20),
    
    -- Настройки отображения
    is_required BOOLEAN DEFAULT FALSE,
    is_filterable BOOLEAN DEFAULT FALSE,
    is_searchable BOOLEAN DEFAULT FALSE,
    
    -- Порядок сортировки
    sort_order INTEGER DEFAULT 0,
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

CREATE INDEX idx_product_attributes_company_id ON product_attributes(company_id);
CREATE INDEX idx_product_attributes_code ON product_attributes(code);
CREATE INDEX idx_product_attributes_is_active ON product_attributes(is_active);

-- ========================================
-- ЗНАЧЕНИЯ ХАРАКТЕРИСТИК
-- ========================================

CREATE TABLE product_attribute_values (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    attribute_id INTEGER REFERENCES product_attributes(id) ON DELETE CASCADE,
    
    -- Значение атрибута
    value TEXT,
    numeric_value DECIMAL(15,6), -- для числовых значений
    boolean_value BOOLEAN, -- для булевых значений
    date_value DATE, -- для дат
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(product_id, attribute_id)
);

CREATE INDEX idx_product_attribute_values_product_id ON product_attribute_values(product_id);
CREATE INDEX idx_product_attribute_values_attribute_id ON product_attribute_values(attribute_id);
CREATE INDEX idx_product_attribute_values_numeric ON product_attribute_values(numeric_value);
CREATE INDEX idx_product_attribute_values_boolean ON product_attribute_values(boolean_value);

-- ========================================
-- ТРИГГЕРЫ
-- ========================================

-- Триггеры для updated_at
CREATE TRIGGER trigger_update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_brands_updated_at
    BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_product_attributes_updated_at
    BEFORE UPDATE ON product_attributes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_product_attribute_values_updated_at
    BEFORE UPDATE ON product_attribute_values
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ФУНКЦИИ
-- ========================================

-- Функция для обновления пути категории
CREATE OR REPLACE FUNCTION update_category_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path VARCHAR(1000);
    parent_level INTEGER;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path := NEW.id::VARCHAR;
        NEW.level := 0;
    ELSE
        SELECT path, level INTO parent_path, parent_level
        FROM categories WHERE id = NEW.parent_id;
        
        NEW.path := parent_path || '.' || NEW.id::VARCHAR;
        NEW.level := parent_level + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления пути категории
CREATE TRIGGER trigger_update_category_path
    BEFORE INSERT OR UPDATE OF parent_id ON categories
    FOR EACH ROW EXECUTE FUNCTION update_category_path();

-- Функция для логирования изменений товаров
CREATE OR REPLACE FUNCTION log_product_changes()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id INTEGER;
BEGIN
    -- Получаем текущий user_id из контекста сессии
    current_user_id := NULLIF(current_setting('app.current_user_id', true), '')::INTEGER;
    
    IF TG_OP = 'INSERT' THEN
        INSERT INTO product_history (product_id, company_id, user_id, action, description)
        VALUES (NEW.id, NEW.company_id, current_user_id, 'create', 'Product created');
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Логируем изменения основных полей
        IF OLD.name != NEW.name THEN
            INSERT INTO product_history (product_id, company_id, user_id, action, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.company_id, current_user_id, 'update', 'name', OLD.name, NEW.name);
        END IF;
        
        IF OLD.base_price != NEW.base_price THEN
            INSERT INTO product_history (product_id, company_id, user_id, action, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.company_id, current_user_id, 'update', 'base_price', OLD.base_price::TEXT, NEW.base_price::TEXT);
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO product_history (product_id, company_id, user_id, action, description)
        VALUES (OLD.id, OLD.company_id, current_user_id, 'delete', 'Product deleted');
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Триггер для логирования изменений товаров
CREATE TRIGGER trigger_log_product_changes
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION log_product_changes();

-- ========================================
-- ОГРАНИЧЕНИЯ И ПРОВЕРКИ
-- ========================================

-- Проверки для товаров
ALTER TABLE products ADD CONSTRAINT check_prices_positive
    CHECK (purchase_price >= 0 AND base_price >= 0 AND COALESCE(min_price, 0) >= 0);

ALTER TABLE products ADD CONSTRAINT check_dimensions_positive
    CHECK (COALESCE(weight, 0) >= 0 AND COALESCE(length, 0) >= 0 AND 
           COALESCE(width, 0) >= 0 AND COALESCE(height, 0) >= 0);

ALTER TABLE products ADD CONSTRAINT check_stock_non_negative
    CHECK (current_stock >= 0 AND reserved_stock >= 0);

ALTER TABLE products ADD CONSTRAINT check_vat_rate_valid
    CHECK (vat_rate >= 0 AND vat_rate <= 100);

-- Проверки для единиц измерения
ALTER TABLE unit_conversions ADD CONSTRAINT check_conversion_factor_positive
    CHECK (conversion_factor > 0);

-- Проверки для атрибутов
ALTER TABLE product_attributes ADD CONSTRAINT check_attribute_type_valid
    CHECK (attribute_type IN ('string', 'number', 'boolean', 'date', 'select', 'multiselect'));

ALTER TABLE product_history ADD CONSTRAINT check_history_action_valid
    CHECK (action IN ('create', 'update', 'delete', 'restore', 'import', 'export'));

-- ========================================
-- НАЧАЛЬНЫЕ ДАННЫЕ
-- ========================================

-- Стандартные единицы измерения
INSERT INTO dictionaries (type, code, name, sort_order) VALUES
('units', 'pcs', 'Штуки', 10),
('units', 'kg', 'Килограммы', 20),
('units', 'g', 'Граммы', 30),
('units', 'l', 'Литры', 40),
('units', 'ml', 'Миллилитры', 50),
('units', 'm', 'Метры', 60),
('units', 'cm', 'Сантиметры', 70),
('units', 'mm', 'Миллиметры', 80),
('units', 'pack', 'Упаковки', 90),
('units', 'box', 'Коробки', 100)
ON CONFLICT (type, code) DO NOTHING;

-- Конверсии единиц измерения
INSERT INTO unit_conversions (from_unit, to_unit, conversion_factor, category, description) VALUES
-- Вес
('kg', 'g', 1000, 'weight', 'Килограммы в граммы'),
('g', 'kg', 0.001, 'weight', 'Граммы в килограммы'),
-- Длина
('m', 'cm', 100, 'length', 'Метры в сантиметры'),
('cm', 'm', 0.01, 'length', 'Сантиметры в метры'),
('m', 'mm', 1000, 'length', 'Метры в миллиметры'),
('cm', 'mm', 10, 'length', 'Сантиметры в миллиметры'),
-- Объем  
('l', 'ml', 1000, 'volume', 'Литры в миллилитры'),
('ml', 'l', 0.001, 'volume', 'Миллилитры в литры')
ON CONFLICT (from_unit, to_unit) DO NOTHING;