-- ============================================================
-- 002_initial_data.sql
-- Заполнение базы данных начальными данными
-- ============================================================

-- ========================================
-- ТАРИФНЫЕ ПЛАНЫ
-- ========================================

-- Вставка базовых тарифов
INSERT INTO tariffs (name, code, price, limits, features, is_active) VALUES
('Базовый', 'basic', 0.00, 
 '{"products": 100, "marketplaces": 1, "api_calls": 1000, "users": 1}',
 '["basic_sync", "manual_import", "basic_analytics"]', 
 true),
('Стандарт', 'standard', 2900.00,
 '{"products": 1000, "marketplaces": 3, "api_calls": 10000, "users": 3}',
 '["advanced_sync", "auto_import", "analytics", "notifications"]',
 true),
('Профессиональный', 'professional', 9900.00,
 '{"products": 10000, "marketplaces": -1, "api_calls": 100000, "users": 10}',
 '["full_sync", "auto_import", "advanced_analytics", "api_access", "priority_support"]',
 true),
('Корпоративный', 'enterprise', 29900.00,
 '{"products": -1, "marketplaces": -1, "api_calls": -1, "users": -1}',
 '["full_sync", "auto_import", "advanced_analytics", "api_access", "priority_support", "custom_integration", "dedicated_manager"]',
 true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    limits = EXCLUDED.limits,
    features = EXCLUDED.features,
    updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- ЕДИНИЦЫ ИЗМЕРЕНИЯ (ОКЕИ)
-- ========================================

INSERT INTO unit_of_measures (code, name, short_name, unit_type, is_base, base_unit_code, conversion_factor) VALUES
-- Единицы количества
('796', 'Штука', 'шт', 'count', true, null, 1),
('778', 'Упаковка', 'упак', 'count', false, '796', null), -- коэффициент зависит от товара
('780', 'Набор', 'набор', 'count', false, '796', null),
('792', 'Пара', 'пара', 'count', false, '796', 2),

-- Единицы длины
('006', 'Метр', 'м', 'length', true, null, 1),
('003', 'Миллиметр', 'мм', 'length', false, '006', 0.001),
('004', 'Сантиметр', 'см', 'length', false, '006', 0.01),
('005', 'Дециметр', 'дм', 'length', false, '006', 0.1),
('008', 'Километр', 'км', 'length', false, '006', 1000),

-- Единицы массы
('166', 'Килограмм', 'кг', 'weight', true, null, 1),
('163', 'Грамм', 'г', 'weight', false, '166', 0.001),
('168', 'Тонна', 'т', 'weight', false, '166', 1000),
('185', 'Миллиграмм', 'мг', 'weight', false, '166', 0.000001),

-- Единицы объема
('112', 'Литр', 'л', 'volume', true, null, 1),
('111', 'Кубический сантиметр', 'см³', 'volume', false, '112', 0.001),
('113', 'Кубический метр', 'м³', 'volume', false, '112', 1000),
('118', 'Миллилитр', 'мл', 'volume', false, '112', 0.001),

-- Единицы площади
('055', 'Квадратный метр', 'м²', 'area', true, null, 1),
('050', 'Квадратный сантиметр', 'см²', 'area', false, '055', 0.0001),
('058', 'Квадратный километр', 'км²', 'area', false, '055', 1000000),
('053', 'Квадратный дециметр', 'дм²', 'area', false, '055', 0.01),

-- Единицы времени
('355', 'Секунда', 'с', 'time', true, null, 1),
('356', 'Минута', 'мин', 'time', false, '355', 60),
('354', 'Час', 'ч', 'time', false, '355', 3600),
('359', 'День', 'дн', 'time', false, '355', 86400),

-- Единицы энергии
('245', 'Ватт-час', 'Вт·ч', 'energy', true, null, 1),
('246', 'Киловатт-час', 'кВт·ч', 'energy', false, '245', 1000),
('247', 'Мегаватт-час', 'МВт·ч', 'energy', false, '245', 1000000)

ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    short_name = EXCLUDED.short_name,
    unit_type = EXCLUDED.unit_type,
    is_base = EXCLUDED.is_base,
    base_unit_code = EXCLUDED.base_unit_code,
    conversion_factor = EXCLUDED.conversion_factor;

-- ========================================
-- КУРСЫ ВАЛЮТ
-- ========================================

INSERT INTO exchange_rates (currency_code, rate, base_currency) VALUES
    ('RUB', 1.000000, 'RUB'),
    ('USD', 90.500000, 'RUB'),
    ('EUR', 98.750000, 'RUB'),
    ('CNY', 12.450000, 'RUB'),
    ('KZT', 0.200000, 'RUB'),
    ('BYN', 27.500000, 'RUB'),
    ('UAH', 2.180000, 'RUB'),
    ('GBP', 114.250000, 'RUB'),
    ('JPY', 0.615000, 'RUB'),
    ('CHF', 101.300000, 'RUB')
ON CONFLICT (currency_code) DO UPDATE 
SET rate = EXCLUDED.rate, 
    updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- БАЗОВЫЕ КАТЕГОРИИ
-- ========================================

-- Создаем базовый тенант для примера (можно удалить в production)
INSERT INTO tenants (name, domain, plan, is_active, tariff_id) 
SELECT 'Demo Company', 'demo.moduletrade.ru', 'basic', true, id 
FROM tariffs WHERE code = 'basic' LIMIT 1
ON CONFLICT (domain) DO NOTHING;

-- Получаем ID демо-тенанта для создания категорий
DO $$
DECLARE
    demo_tenant_id UUID;
BEGIN
    SELECT id INTO demo_tenant_id FROM tenants WHERE domain = 'demo.moduletrade.ru' LIMIT 1;
    
    IF demo_tenant_id IS NOT NULL THEN
        -- Создаем базовые категории для демо-тенанта
        INSERT INTO categories (tenant_id, name, description, is_active) VALUES
        (demo_tenant_id, 'Электроника', 'Электронные устройства и компоненты', true),
        (demo_tenant_id, 'Одежда', 'Одежда и аксессуары', true),
        (demo_tenant_id, 'Дом и сад', 'Товары для дома и сада', true),
        (demo_tenant_id, 'Спорт', 'Спортивные товары и оборудование', true),
        (demo_tenant_id, 'Автотовары', 'Автомобильные запчасти и аксессуары', true),
        (demo_tenant_id, 'Красота и здоровье', 'Косметика и товары для здоровья', true),
        (demo_tenant_id, 'Книги', 'Книги и печатные издания', true),
        (demo_tenant_id, 'Игрушки', 'Детские товары и игрушки', true)
        ON CONFLICT (tenant_id, parent_id, name) DO NOTHING;
        
        -- Создаем подкатегории для Электроники
        INSERT INTO categories (tenant_id, parent_id, name, description, is_active) 
        SELECT demo_tenant_id, id, 'Смартфоны', 'Мобильные телефоны', true 
        FROM categories WHERE tenant_id = demo_tenant_id AND name = 'Электроника' AND parent_id IS NULL
        ON CONFLICT (tenant_id, parent_id, name) DO NOTHING;
        
        INSERT INTO categories (tenant_id, parent_id, name, description, is_active) 
        SELECT demo_tenant_id, id, 'Ноутбуки', 'Портативные компьютеры', true 
        FROM categories WHERE tenant_id = demo_tenant_id AND name = 'Электроника' AND parent_id IS NULL
        ON CONFLICT (tenant_id, parent_id, name) DO NOTHING;
        
        INSERT INTO categories (tenant_id, parent_id, name, description, is_active) 
        SELECT demo_tenant_id, id, 'Комплектующие', 'Комплектующие для ПК', true 
        FROM categories WHERE tenant_id = demo_tenant_id AND name = 'Электроника' AND parent_id IS NULL
        ON CONFLICT (tenant_id, parent_id, name) DO NOTHING;
    END IF;
END $$;

-- ========================================
-- БАЗОВЫЕ БРЕНДЫ
-- ========================================

DO $$
DECLARE
    demo_tenant_id UUID;
BEGIN
    SELECT id INTO demo_tenant_id FROM tenants WHERE domain = 'demo.moduletrade.ru' LIMIT 1;
    
    IF demo_tenant_id IS NOT NULL THEN
        INSERT INTO brands (tenant_id, name, description, is_active) VALUES
        (demo_tenant_id, 'Apple', 'Американская технологическая компания', true),
        (demo_tenant_id, 'Samsung', 'Южнокорейская технологическая компания', true),
        (demo_tenant_id, 'Xiaomi', 'Китайская технологическая компания', true),
        (demo_tenant_id, 'Sony', 'Японская технологическая компания', true),
        (demo_tenant_id, 'LG', 'Южнокорейская компания электроники', true),
        (demo_tenant_id, 'Huawei', 'Китайская телекоммуникационная компания', true),
        (demo_tenant_id, 'Nike', 'Американская компания спортивной одежды', true),
        (demo_tenant_id, 'Adidas', 'Немецкая компания спортивной одежды', true),
        (demo_tenant_id, 'Без бренда', 'Товары без указания бренда', true)
        ON CONFLICT (tenant_id, name) DO NOTHING;
    END IF;
END $$;

-- ========================================
-- СИСТЕМНЫЕ НАСТРОЙКИ
-- ========================================

-- Обновляем существующих тенантов базовым тарифом если он не назначен
UPDATE tenants 
SET tariff_id = (SELECT id FROM tariffs WHERE code = 'basic' LIMIT 1),
    subscription_status = 'active'
WHERE tariff_id IS NULL;

-- ========================================
-- ПРОВЕРКА РЕЗУЛЬТАТА
-- ========================================

DO $$
DECLARE
    tariff_count INTEGER;
    unit_count INTEGER;
    currency_count INTEGER;
    category_count INTEGER;
    brand_count INTEGER;
BEGIN
    -- Подсчитываем созданные записи
    SELECT COUNT(*) INTO tariff_count FROM tariffs;
    SELECT COUNT(*) INTO unit_count FROM unit_of_measures;
    SELECT COUNT(*) INTO currency_count FROM exchange_rates;
    SELECT COUNT(*) INTO category_count FROM categories;
    SELECT COUNT(*) INTO brand_count FROM brands;
    
    RAISE NOTICE '📊 СТАТИСТИКА НАЧАЛЬНЫХ ДАННЫХ:';
    RAISE NOTICE '   💰 Тарифных планов: %', tariff_count;
    RAISE NOTICE '   📏 Единиц измерения: %', unit_count;
    RAISE NOTICE '   💱 Курсов валют: %', currency_count;
    RAISE NOTICE '   📂 Категорий: %', category_count;
    RAISE NOTICE '   🏷️  Брендов: %', brand_count;
    RAISE NOTICE '';
    
    IF tariff_count >= 4 AND unit_count >= 20 AND currency_count >= 8 THEN
        RAISE NOTICE '✅ Начальные данные успешно загружены!';
    ELSE
        RAISE NOTICE '⚠️  Некоторые данные могли не загрузиться полностью';
    END IF;
    
END $$;