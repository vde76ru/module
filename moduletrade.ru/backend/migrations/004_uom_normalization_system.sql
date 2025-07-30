ALTER TABLE product_suppliers
ADD COLUMN supplier_unit VARCHAR(50),
ADD COLUMN supplier_multiplicity INTEGER DEFAULT 1,
ADD COLUMN normalized_price DECIMAL(12,2), -- цена за базовую единицу
ADD COLUMN unit_conversion_factor DECIMAL(10,4) DEFAULT 1; -- коэффициент конвертации

-- Добавляем поля в основную таблицу products
ALTER TABLE products
ADD COLUMN base_unit VARCHAR(20) DEFAULT 'шт' CHECK (base_unit IN ('шт', 'м', 'кг', 'л', 'м2', 'м3', 'упак')),
ADD COLUMN is_divisible BOOLEAN DEFAULT TRUE, -- можно ли продавать дробное количество
ADD COLUMN min_order_quantity DECIMAL(10,2) DEFAULT 1, -- минимальная кратность заказа
ADD COLUMN packaging_info JSONB DEFAULT '{}'; -- информация об упаковке

-- Создаем справочник единиц измерения с кодами ОКЕИ
CREATE TABLE unit_of_measures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL, -- код ОКЕИ
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(20) NOT NULL,
    unit_type VARCHAR(50) NOT NULL, -- 'count', 'length', 'weight', 'volume', 'area'
    is_base BOOLEAN DEFAULT FALSE, -- является ли базовой единицей
    base_unit_code VARCHAR(10), -- код базовой единицы для конвертации
    conversion_factor DECIMAL(15,6), -- коэффициент для перевода в базовую единицу
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Заполняем справочник основными единицами измерения согласно ОКЕИ
INSERT INTO unit_of_measures (code, name, short_name, unit_type, is_base, base_unit_code, conversion_factor) VALUES
-- Единицы количества
('796', 'Штука', 'шт', 'count', true, null, 1),
('778', 'Упаковка', 'упак', 'count', false, '796', null), -- коэффициент зависит от товара

-- Единицы длины  
('006', 'Метр', 'м', 'length', true, null, 1),
('003', 'Миллиметр', 'мм', 'length', false, '006', 0.001),
('004', 'Сантиметр', 'см', 'length', false, '006', 0.01),
('008', 'Километр', 'км', 'length', false, '006', 1000),

-- Единицы массы
('166', 'Килограмм', 'кг', 'weight', true, null, 1),
('163', 'Грамм', 'г', 'weight', false, '166', 0.001),
('168', 'Тонна', 'т', 'weight', false, '166', 1000),

-- Единицы объема
('112', 'Литр', 'л', 'volume', true, null, 1),
('111', 'Кубический сантиметр', 'см3', 'volume', false, '112', 0.001),
('113', 'Кубический метр', 'м3', 'volume', false, '112', 1000),

-- Единицы площади
('055', 'Квадратный метр', 'м2', 'area', true, null, 1),
('050', 'Квадратный сантиметр', 'см2', 'area', false, '055', 0.0001),
('058', 'Квадратный километр', 'км2', 'area', false, '055', 1000000);

-- Создаем таблицу правил конвертации для специфичных товаров
CREATE TABLE product_unit_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    from_unit VARCHAR(50) NOT NULL,
    to_unit VARCHAR(50) NOT NULL,
    conversion_factor DECIMAL(15,6) NOT NULL,
    is_supplier_specific BOOLEAN DEFAULT FALSE,
    supplier_id UUID REFERENCES suppliers(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, from_unit, to_unit, supplier_id)
);

-- Создаем индексы для оптимизации
CREATE INDEX idx_product_suppliers_unit ON product_suppliers(supplier_unit);
CREATE INDEX idx_products_base_unit ON products(base_unit);
CREATE INDEX idx_unit_conversions_product ON product_unit_conversions(product_id);

-- Функция для автоматического пересчета нормализованной цены
CREATE OR REPLACE FUNCTION calculate_normalized_price()
RETURNS TRIGGER AS $$
BEGIN
    -- Если есть кратность от поставщика, пересчитываем цену за базовую единицу
    IF NEW.supplier_multiplicity IS NOT NULL AND NEW.supplier_multiplicity > 0 THEN
        NEW.normalized_price = NEW.price / NEW.supplier_multiplicity;
    ELSE
        NEW.normalized_price = NEW.price;
    END IF;
    
    -- Применяем коэффициент конвертации, если он указан
    IF NEW.unit_conversion_factor IS NOT NULL AND NEW.unit_conversion_factor > 0 THEN
        NEW.normalized_price = NEW.normalized_price * NEW.unit_conversion_factor;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического пересчета при изменении цены или кратности
CREATE TRIGGER trigger_calculate_normalized_price
BEFORE INSERT OR UPDATE OF price, supplier_multiplicity, unit_conversion_factor 
ON product_suppliers
FOR EACH ROW
EXECUTE FUNCTION calculate_normalized_price();

-- Представление для удобного просмотра нормализованных цен
CREATE OR REPLACE VIEW v_product_normalized_prices AS
SELECT 
    p.id as product_id,
    p.tenant_id,
    p.internal_code,
    p.name as product_name,
    p.base_unit,
    p.is_divisible,
    p.min_order_quantity,
    ps.supplier_id,
    s.name as supplier_name,
    ps.supplier_code,
    ps.supplier_unit,
    ps.supplier_multiplicity,
    ps.price as original_price,
    ps.normalized_price,
    ps.unit_conversion_factor,
    CASE 
        WHEN ps.supplier_unit = p.base_unit THEN 'Совпадает'
        WHEN ps.unit_conversion_factor IS NOT NULL THEN 'Сконвертировано'
        ELSE 'Требует маппинга'
    END as conversion_status
FROM products p
JOIN product_suppliers ps ON p.id = ps.product_id
JOIN suppliers s ON ps.supplier_id = s.id
ORDER BY p.internal_code, ps.normalized_price;

-- Добавляем поля для хранения информации о кабельной продукции
ALTER TABLE products
ADD COLUMN cable_info JSONB DEFAULT '{}'; -- {is_cable: boolean, drum_length: number, cut_length: number}

-- Обновляем существующие записи, устанавливая значения по умолчанию
UPDATE product_suppliers SET supplier_multiplicity = 1 WHERE supplier_multiplicity IS NULL;
UPDATE products SET base_unit = 'шт' WHERE base_unit IS NULL;
