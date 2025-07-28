-- Таблица скидок поставщиков по брендам
CREATE TABLE supplier_brand_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    discount_percent DECIMAL(5,2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
    min_order_amount DECIMAL(12,2) DEFAULT 0, -- минимальная сумма заказа для применения скидки
    valid_from DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, brand_id)
);

CREATE INDEX idx_supplier_brand_discounts_supplier ON supplier_brand_discounts(supplier_id);
CREATE INDEX idx_supplier_brand_discounts_brand ON supplier_brand_discounts(brand_id);
CREATE INDEX idx_supplier_brand_discounts_active ON supplier_brand_discounts(is_active);

-- Таблица для маппинга товаров на маркетплейсы с ценообразованием
CREATE TABLE marketplace_product_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    marketplace_id UUID REFERENCES marketplaces(id) ON DELETE CASCADE,
    marketplace_sku VARCHAR(255) NOT NULL, -- SKU товара на маркетплейсе
    marketplace_product_id VARCHAR(255), -- ID товара в системе маркетплейса
    
    -- Поля для управления ценой
    manual_price DECIMAL(12,2), -- ручная цена
    is_manual_price_active BOOLEAN DEFAULT FALSE, -- флаг фиксации цены
    fixed_markup_percent DECIMAL(5,2), -- постоянная наценка в процентах
    last_auto_price DECIMAL(12,2), -- последняя автоматически рассчитанная цена
    last_price_update TIMESTAMP,
    
    -- Статус и синхронизация
    is_active BOOLEAN DEFAULT TRUE,
    sync_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'synced', 'error'
    last_sync_at TIMESTAMP,
    sync_error TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, marketplace_id)
);

CREATE INDEX idx_marketplace_product_links_tenant ON marketplace_product_links(tenant_id);
CREATE INDEX idx_marketplace_product_links_product ON marketplace_product_links(product_id);
CREATE INDEX idx_marketplace_product_links_marketplace ON marketplace_product_links(marketplace_id);
CREATE INDEX idx_marketplace_product_links_sku ON marketplace_product_links(marketplace_sku);
CREATE INDEX idx_marketplace_product_links_active ON marketplace_product_links(is_active);

-- Добавляем поля для расчета прибыльности в order_items
ALTER TABLE order_items
ADD COLUMN purchase_price DECIMAL(12,2), -- закупочная цена на момент заказа
ADD COLUMN profit_amount DECIMAL(12,2), -- прибыль в рублях
ADD COLUMN profit_percent DECIMAL(5,2); -- прибыль в процентах

-- Создаем функцию для автоматического расчета прибыли
CREATE OR REPLACE FUNCTION calculate_order_item_profit()
RETURNS TRIGGER AS $$
BEGIN
    -- Рассчитываем прибыль если есть закупочная цена
    IF NEW.purchase_price IS NOT NULL AND NEW.purchase_price > 0 THEN
        -- Прибыль = (Цена продажи - Комиссия) - Закупочная цена
        NEW.profit_amount = (NEW.price * (1 - COALESCE(NEW.commission_rate, 0) / 100)) - NEW.purchase_price;
        -- Прибыль в процентах = (Прибыль / Закупочная цена) * 100
        NEW.profit_percent = (NEW.profit_amount / NEW.purchase_price) * 100;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического расчета прибыли
CREATE TRIGGER trigger_calculate_order_profit
BEFORE INSERT OR UPDATE OF price, purchase_price, commission_rate
ON order_items
FOR EACH ROW
EXECUTE FUNCTION calculate_order_item_profit();

-- Функция для автоматического сброса ручной цены если авто-цена выше
CREATE OR REPLACE FUNCTION check_manual_price_override()
RETURNS TRIGGER AS $$
BEGIN
    -- Если установлена ручная цена и новая авто-цена выше неё
    IF NEW.is_manual_price_active = TRUE 
       AND NEW.last_auto_price IS NOT NULL 
       AND NEW.manual_price IS NOT NULL
       AND NEW.last_auto_price > NEW.manual_price THEN
        -- Сбрасываем флаг ручной цены
        NEW.is_manual_price_active = FALSE;
        -- Можно добавить запись в лог
        RAISE NOTICE 'Manual price override disabled for product % on marketplace % due to higher auto price', 
                     NEW.product_id, NEW.marketplace_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для проверки ручной цены
CREATE TRIGGER trigger_check_manual_price
BEFORE UPDATE OF last_auto_price
ON marketplace_product_links
FOR EACH ROW
EXECUTE FUNCTION check_manual_price_override();

-- Представление для удобного просмотра скидок
CREATE OR REPLACE VIEW v_active_supplier_discounts AS
SELECT 
    s.id as supplier_id,
    s.name as supplier_name,
    b.id as brand_id,
    b.canonical_name as brand_name,
    sbd.discount_percent,
    sbd.min_order_amount,
    sbd.valid_from,
    sbd.valid_until,
    sbd.notes
FROM supplier_brand_discounts sbd
JOIN suppliers s ON sbd.supplier_id = s.id
JOIN brands b ON sbd.brand_id = b.id
WHERE sbd.is_active = TRUE
  AND (sbd.valid_from IS NULL OR sbd.valid_from <= CURRENT_DATE)
  AND (sbd.valid_until IS NULL OR sbd.valid_until >= CURRENT_DATE)
ORDER BY s.name, b.canonical_name;

-- Представление для анализа прибыльности
CREATE OR REPLACE VIEW v_order_profitability AS
SELECT 
    o.id as order_id,
    o.order_number,
    o.marketplace_id,
    m.name as marketplace_name,
    o.order_date,
    o.status,
    SUM(oi.quantity * oi.price) as total_revenue,
    SUM(oi.quantity * oi.purchase_price) as total_cost,
    SUM(oi.quantity * oi.price * oi.commission_rate / 100) as total_commission,
    SUM(oi.quantity * oi.profit_amount) as total_profit,
    AVG(oi.profit_percent) as avg_profit_percent
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN marketplaces m ON o.marketplace_id = m.id
GROUP BY o.id, o.order_number, o.marketplace_id, m.name, o.order_date, o.status;

-- Добавляем индексы для оптимизации запросов прибыльности
CREATE INDEX idx_order_items_profit ON order_items(profit_amount, profit_percent);
CREATE INDEX idx_orders_date_status ON orders(order_date, status);
