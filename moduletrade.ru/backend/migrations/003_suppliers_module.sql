-- ========================================
-- МИГРАЦИЯ 003: ПОСТАВЩИКИ И ЗАКУПКИ
-- Модуль управления поставщиками и закупочными процессами
-- ========================================

-- ========================================
-- ПОСТАВЩИКИ
-- ========================================

CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Основная информация
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    
    -- Юридические данные
    inn VARCHAR(20),
    kpp VARCHAR(20),
    ogrn VARCHAR(20),
    
    -- Контактная информация
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    
    -- Контактные лица
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    
    -- Адрес
    address JSONB DEFAULT '{}',
    
    -- Банковские реквизиты
    bank_details JSONB DEFAULT '{}',
    
    -- Рейтинг и приоритет
    priority INTEGER DEFAULT 0, -- чем выше, тем приоритетнее
    reliability_score DECIMAL(3,2) DEFAULT 5.00, -- от 0 до 10
    
    -- Условия работы
    payment_terms VARCHAR(255), -- условия оплаты
    delivery_terms VARCHAR(255), -- условия доставки
    min_order_amount DECIMAL(12,2) DEFAULT 0,
    
    -- Настройки синхронизации
    has_api BOOLEAN DEFAULT FALSE,
    api_settings JSONB DEFAULT '{}',
    sync_enabled BOOLEAN DEFAULT FALSE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX idx_suppliers_inn ON suppliers(inn);
CREATE INDEX idx_suppliers_priority ON suppliers(priority);
CREATE INDEX idx_suppliers_reliability_score ON suppliers(reliability_score);
CREATE INDEX idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX idx_suppliers_name_search ON suppliers USING GIN(to_tsvector('russian', name));

-- ========================================
-- ТОВАРЫ ПОСТАВЩИКОВ (КАТАЛОГ)
-- ========================================

CREATE TABLE supplier_products (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    
    -- Код товара у поставщика
    supplier_code VARCHAR(255) NOT NULL,
    supplier_name VARCHAR(500), -- название товара у поставщика
    
    -- Цены
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'RUB',
    
    -- МРЦ (минимальная розничная цена)
    mrc_price DECIMAL(12,2),
    enforce_mrc BOOLEAN DEFAULT FALSE, -- обязательное соблюдение МРЦ
    
    -- Остатки у поставщика
    quantity DECIMAL(10,3) DEFAULT 0,
    reserved_quantity DECIMAL(10,3) DEFAULT 0,
    available_quantity DECIMAL(10,3) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    
    -- Условия заказа
    min_order_quantity DECIMAL(10,3) DEFAULT 1,
    order_step DECIMAL(10,3) DEFAULT 1, -- кратность заказа
    
    -- Сроки поставки
    delivery_time_days INTEGER DEFAULT 0,
    
    -- Статус доступности
    is_available BOOLEAN DEFAULT TRUE,
    availability_status VARCHAR(50) DEFAULT 'in_stock', -- in_stock, out_of_stock, limited, discontinued
    
    -- Дополнительная информация
    description TEXT,
    attributes JSONB DEFAULT '{}',
    
    -- Время последнего обновления
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    price_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stock_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(supplier_id, supplier_code)
);

CREATE INDEX idx_supplier_products_supplier_id ON supplier_products(supplier_id);
CREATE INDEX idx_supplier_products_product_id ON supplier_products(product_id);
CREATE INDEX idx_supplier_products_supplier_code ON supplier_products(supplier_code);
CREATE INDEX idx_supplier_products_price ON supplier_products(price);
CREATE INDEX idx_supplier_products_is_available ON supplier_products(is_available);
CREATE INDEX idx_supplier_products_availability_status ON supplier_products(availability_status);

-- ========================================
-- ЗАКАЗЫ ПОСТАВЩИКАМ (ЗАКУПКИ)
-- ========================================

CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
    
    -- Номер заказа
    order_number VARCHAR(100) NOT NULL,
    
    -- Статус заказа
    status VARCHAR(50) DEFAULT 'draft',
    -- Возможные значения: draft, sent, confirmed, partially_delivered, delivered, cancelled, dispute  
    
    -- Финансовая информация
    total_amount DECIMAL(12,2) DEFAULT 0,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'RUB',
    
    -- Даты
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Условия оплаты и доставки
    payment_terms VARCHAR(255),
    delivery_terms VARCHAR(255),
    delivery_address JSONB DEFAULT '{}',
    
    -- Дополнительная информация
    notes TEXT,
    
    -- Создатель заказа
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, order_number)
);

CREATE INDEX idx_purchase_orders_company_id ON purchase_orders(company_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_order_number ON purchase_orders(order_number);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(order_date);

-- ========================================
-- ПОЗИЦИИ ЗАКАЗОВ ПОСТАВЩИКАМ
-- ========================================

CREATE TABLE purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
    supplier_product_id INTEGER REFERENCES supplier_products(id) ON DELETE SET NULL,
    
    -- Информация о товаре на момент заказа
    product_name VARCHAR(500) NOT NULL,
    supplier_code VARCHAR(255),
    
    -- Количество и цены
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    
    -- Единица измерения
    unit VARCHAR(20) DEFAULT 'pcs',
    
    -- Статус позиции
    status VARCHAR(50) DEFAULT 'ordered',
    -- Возможные значения: ordered, confirmed, partially_delivered, delivered, cancelled
    
    -- Фактические поставки
    delivered_quantity DECIMAL(10,3) DEFAULT 0,
    remaining_quantity DECIMAL(10,3) GENERATED ALWAYS AS (quantity - delivered_quantity) STORED,
    
    -- Даты
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_purchase_order_items_purchase_order_id ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product_id ON purchase_order_items(product_id);
CREATE INDEX idx_purchase_order_items_supplier_product_id ON purchase_order_items(supplier_product_id);
CREATE INDEX idx_purchase_order_items_status ON purchase_order_items(status);

-- ========================================
-- ПОСТУПЛЕНИЯ ТОВАРОВ (ПРИЕМКА)
-- ========================================

CREATE TABLE goods_receipts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    
    -- Номер поступления
    receipt_number VARCHAR(100) NOT NULL,
    
    -- Дата поступления
    receipt_date DATE DEFAULT CURRENT_DATE,
    
    -- Документы поставщика
    supplier_invoice_number VARCHAR(100),
    supplier_delivery_note VARCHAR(100),
    
    -- Статус приемки
    status VARCHAR(50) DEFAULT 'pending',
    -- Возможные значения: pending, in_progress, completed, discrepancy
    
    -- Принял товар
    received_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Общая информация
    total_items_count INTEGER DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    
    -- Примечания
    notes TEXT,
    discrepancy_notes TEXT, -- замечания по расхождениям
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, receipt_number)
);

CREATE INDEX idx_goods_receipts_company_id ON goods_receipts(company_id);
CREATE INDEX idx_goods_receipts_supplier_id ON goods_receipts(supplier_id);
CREATE INDEX idx_goods_receipts_purchase_order_id ON goods_receipts(purchase_order_id);
CREATE INDEX idx_goods_receipts_receipt_date ON goods_receipts(receipt_date);
CREATE INDEX idx_goods_receipts_status ON goods_receipts(status);

-- ========================================
-- ПОЗИЦИИ ПОСТУПЛЕНИЙ
-- ========================================

CREATE TABLE goods_receipt_items (
    id SERIAL PRIMARY KEY,
    goods_receipt_id INTEGER REFERENCES goods_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id INTEGER REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
    product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
    
    -- Информация о товаре
    product_name VARCHAR(500) NOT NULL,
    supplier_code VARCHAR(255),
    
    -- Заказанное и полученное количество
    ordered_quantity DECIMAL(10,3) NOT NULL,
    received_quantity DECIMAL(10,3) NOT NULL,
    accepted_quantity DECIMAL(10,3) NOT NULL, -- принято к учету
    rejected_quantity DECIMAL(10,3) DEFAULT 0, -- отклонено (брак, несоответствие)
    
    -- Единица измерения
    unit VARCHAR(20) DEFAULT 'pcs',
    
    -- Цены
    unit_price DECIMAL(12,2) NOT NULL,
    total_amount DECIMAL(12,2) GENERATED ALWAYS AS (accepted_quantity * unit_price) STORED,
    
    -- Качество товара
    quality_status VARCHAR(50) DEFAULT 'ok', -- ok, damaged, expired, wrong_item
    quality_notes TEXT,
    
    -- Куда поступил товар
    warehouse_id INTEGER, -- будет добавлен FK после создания warehouses
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_goods_receipt_items_goods_receipt_id ON goods_receipt_items(goods_receipt_id);
CREATE INDEX idx_goods_receipt_items_purchase_order_item_id ON goods_receipt_items(purchase_order_item_id);
CREATE INDEX idx_goods_receipt_items_product_id ON goods_receipt_items(product_id);
CREATE INDEX idx_goods_receipt_items_quality_status ON goods_receipt_items(quality_status);

-- ========================================
-- ИСТОРИЯ ЦЕНЫ ПОСТАВЩИКОВ
-- ========================================

CREATE TABLE supplier_price_history (
    id BIGSERIAL PRIMARY KEY,
    supplier_product_id INTEGER REFERENCES supplier_products(id) ON DELETE CASCADE,
    
    -- Старая и новая цена
    old_price DECIMAL(12,2),
    new_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    
    -- Процент изменения
    price_change_percent DECIMAL(8,4) GENERATED ALWAYS AS (
        CASE WHEN old_price > 0 THEN ((new_price - old_price) / old_price) * 100 ELSE NULL END
    ) STORED,
    
    -- Источник изменения цены
    change_source VARCHAR(50) DEFAULT 'manual', -- manual, sync, api, import
    
    -- Время изменения
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_supplier_price_history_supplier_product_id ON supplier_price_history(supplier_product_id);
CREATE INDEX idx_supplier_price_history_changed_at ON supplier_price_history(changed_at);

-- ========================================
-- РЕЙТИНГИ И ОТЗЫВЫ О ПОСТАВЩИКАХ
-- ========================================

CREATE TABLE supplier_ratings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    
    -- Рейтинги по критериям (1-10)
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 10),
    delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 10),
    price_rating INTEGER CHECK (price_rating >= 1 AND price_rating <= 10),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 10),
    
    -- Общий рейтинг
    overall_rating DECIMAL(3,2) GENERATED ALWAYS AS (
        (COALESCE(quality_rating, 0) + COALESCE(delivery_rating, 0) + 
         COALESCE(price_rating, 0) + COALESCE(communication_rating, 0)) / 4.0
    ) STORED,
    
    -- Комментарий
    comment TEXT,
    
    -- Кто поставил рейтинг
    rated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_supplier_ratings_supplier_id ON supplier_ratings(supplier_id);
CREATE INDEX idx_supplier_ratings_overall_rating ON supplier_ratings(overall_rating);

-- ========================================
-- ТРИГГЕРЫ
-- ========================================

-- Триггеры для updated_at
CREATE TRIGGER trigger_update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_supplier_products_updated_at
    BEFORE UPDATE ON supplier_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_purchase_order_items_updated_at
    BEFORE UPDATE ON purchase_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_goods_receipts_updated_at
    BEFORE UPDATE ON goods_receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ФУНКЦИИ ДЛЯ АВТОМАТИЗАЦИИ
-- ========================================

-- Функция для генерации номера заказа поставщику
CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS TRIGGER AS $$
DECLARE
    company_prefix VARCHAR(10);
    next_number INTEGER;
    order_number_val VARCHAR(100);
BEGIN
    -- Если номер заказа уже задан, не генерируем
    IF NEW.order_number IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Получаем префикс компании
    SELECT UPPER(LEFT(name, 3)) INTO company_prefix
    FROM companies WHERE id = NEW.company_id;
    
    -- Получаем следующий номер заказа для текущего года
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '\d+$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM purchase_orders 
    WHERE company_id = NEW.company_id 
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
      AND order_number ~ (company_prefix || '-PO-' || EXTRACT(YEAR FROM NOW()) || '-\d+$');
    
    -- Формируем номер заказа
    order_number_val := company_prefix || '-PO-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(next_number::TEXT, 4, '0');
    
    NEW.order_number := order_number_val;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматической генерации номера заказа
CREATE TRIGGER trigger_generate_purchase_order_number
    BEFORE INSERT ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION generate_purchase_order_number();

-- Функция для генерации номера поступления
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
    company_prefix VARCHAR(10);
    next_number INTEGER;
    receipt_number_val VARCHAR(100);
BEGIN
    -- Если номер поступления уже задан, не генерируем
    IF NEW.receipt_number IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Получаем префикс компании
    SELECT UPPER(LEFT(name, 3)) INTO company_prefix
    FROM companies WHERE id = NEW.company_id;
    
    -- Получаем следующий номер поступления для текущего года
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM '\d+$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM goods_receipts 
    WHERE company_id = NEW.company_id 
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
      AND receipt_number ~ (company_prefix || '-GR-' || EXTRACT(YEAR FROM NOW()) || '-\d+$');
    
    -- Формируем номер поступления
    receipt_number_val := company_prefix || '-GR-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(next_number::TEXT, 4, '0');
    
    NEW.receipt_number := receipt_number_val;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматической генерации номера поступления
CREATE TRIGGER trigger_generate_receipt_number
    BEFORE INSERT ON goods_receipts
    FOR EACH ROW EXECUTE FUNCTION generate_receipt_number();

-- Функция для обновления рейтинга поставщика
CREATE OR REPLACE FUNCTION update_supplier_reliability_score()
RETURNS TRIGGER AS $$
DECLARE
    avg_rating DECIMAL(3,2);
BEGIN
    -- Вычисляем средний рейтинг поставщика за последние 12 месяцев
    SELECT AVG(overall_rating)
    INTO avg_rating
    FROM supplier_ratings sr
    WHERE sr.supplier_id = NEW.supplier_id
      AND sr.created_at >= NOW() - INTERVAL '12 months';
    
    -- Обновляем рейтинг поставщика
    UPDATE suppliers 
    SET reliability_score = COALESCE(avg_rating, 5.00),
        updated_at = NOW()
    WHERE id = NEW.supplier_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления рейтинга поставщика
CREATE TRIGGER trigger_update_supplier_reliability_score
    AFTER INSERT OR UPDATE ON supplier_ratings
    FOR EACH ROW EXECUTE FUNCTION update_supplier_reliability_score();

-- Функция для отслеживания изменений цен поставщиков
CREATE OR REPLACE FUNCTION track_supplier_price_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Отслеживаем изменение цены
    IF OLD.price != NEW.price THEN
        INSERT INTO supplier_price_history (supplier_product_id, old_price, new_price, currency, change_source)
        VALUES (NEW.id, OLD.price, NEW.price, NEW.currency, 'manual');
        
        -- Обновляем время изменения цены
        NEW.price_updated_at := NOW();
    END IF;
    
    -- Отслеживаем изменение остатков
    IF OLD.quantity != NEW.quantity THEN
        NEW.stock_updated_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для отслеживания изменений
CREATE TRIGGER trigger_track_supplier_price_changes
    BEFORE UPDATE ON supplier_products
    FOR EACH ROW EXECUTE FUNCTION track_supplier_price_changes();

-- ========================================
-- ОГРАНИЧЕНИЯ И ПРОВЕРКИ
-- ========================================

-- Проверки для поставщиков
ALTER TABLE suppliers ADD CONSTRAINT check_reliability_score_valid
    CHECK (reliability_score >= 0 AND reliability_score <= 10);

ALTER TABLE suppliers ADD CONSTRAINT check_min_order_amount_non_negative
    CHECK (min_order_amount >= 0);

-- Проверки для товаров поставщиков
ALTER TABLE supplier_products ADD CONSTRAINT check_price_positive
    CHECK (price >= 0 AND COALESCE(mrc_price, 0) >= 0);

ALTER TABLE supplier_products ADD CONSTRAINT check_quantities_non_negative
    CHECK (quantity >= 0 AND reserved_quantity >= 0);

ALTER TABLE supplier_products ADD CONSTRAINT check_order_quantities_positive
    CHECK (min_order_quantity > 0 AND order_step > 0);

-- Проверки для заказов
ALTER TABLE purchase_orders ADD CONSTRAINT check_amounts_non_negative
    CHECK (total_amount >= 0 AND paid_amount >= 0 AND paid_amount <= total_amount);

ALTER TABLE purchase_order_items ADD CONSTRAINT check_quantities_positive
    CHECK (quantity > 0 AND unit_price >= 0 AND delivered_quantity >= 0);

-- Проверки для поступлений
ALTER TABLE goods_receipt_items ADD CONSTRAINT check_receipt_quantities_valid
    CHECK (received_quantity >= 0 AND accepted_quantity >= 0 AND rejected_quantity >= 0 
           AND (accepted_quantity + rejected_quantity) <= received_quantity);

-- ========================================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ========================================

-- Представление лучших цен поставщиков
CREATE VIEW best_supplier_prices AS
SELECT DISTINCT ON (sp.product_id)
    sp.product_id,
    sp.supplier_id,
    s.name as supplier_name,
    sp.supplier_code,
    sp.price,
    sp.currency,
    sp.min_order_quantity,
    sp.delivery_time_days,
    sp.availability_status,
    sp.available_quantity,
    s.reliability_score
FROM supplier_products sp
JOIN suppliers s ON sp.supplier_id = s.id
WHERE sp.is_available = TRUE 
  AND s.is_active = TRUE
  AND sp.available_quantity > 0
ORDER BY sp.product_id, sp.price ASC, s.priority DESC, s.reliability_score DESC;

COMMENT ON VIEW best_supplier_prices IS 'Лучшие цены поставщиков по товарам';