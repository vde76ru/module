-- 016_create_views.sql
-- Создание представлений для аналитики

-- Представление для скидок поставщиков
CREATE OR REPLACE VIEW v_active_supplier_discounts AS
SELECT 
    s.id AS supplier_id,
    s.name AS supplier_name,
    b.id AS brand_id,
    b.canonical_name AS brand_name,
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

-- Представление для прибыльности заказов
CREATE OR REPLACE VIEW v_order_profitability AS
SELECT 
    o.id AS order_id,
    o.order_number,
    o.marketplace_id,
    m.name AS marketplace_name,
    o.order_date,
    o.status,
    SUM(oi.quantity::DECIMAL * oi.price) AS total_revenue,
    SUM(oi.quantity::DECIMAL * oi.purchase_price) AS total_cost,
    SUM(oi.quantity::DECIMAL * oi.price * oi.commission_rate / 100) AS total_commission,
    SUM(oi.quantity::DECIMAL * oi.profit_amount) AS total_profit,
    AVG(oi.profit_percent) AS avg_profit_percent
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN marketplaces m ON o.marketplace_id = m.id
GROUP BY o.id, o.order_number, o.marketplace_id, m.name, o.order_date, o.status;

-- Представление для нормализованных цен товаров
CREATE OR REPLACE VIEW v_product_normalized_prices AS
SELECT 
    p.id AS product_id,
    p.tenant_id,
    p.internal_code,
    p.name AS product_name,
    p.base_unit,
    p.is_divisible,
    p.min_order_quantity,
    ps.supplier_id,
    s.name AS supplier_name,
    ps.supplier_code,
    ps.supplier_unit,
    ps.supplier_multiplicity,
    ps.price AS original_price,
    ps.normalized_price,
    ps.unit_conversion_factor,
    CASE 
        WHEN ps.supplier_unit = p.base_unit THEN 'Совпадает'
        WHEN ps.unit_conversion_factor IS NOT NULL THEN 'Сконвертировано'
        ELSE 'Требует маппинга'
    END AS conversion_status
FROM products p
JOIN product_suppliers ps ON p.id = ps.product_id
JOIN suppliers s ON ps.supplier_id = s.id
ORDER BY p.internal_code, ps.normalized_price;

-- Представление для общих остатков товаров
CREATE OR REPLACE VIEW v_product_total_stock AS
SELECT 
    p.id AS product_id,
    p.tenant_id,
    p.internal_code,
    p.name AS product_name,
    COALESCE(SUM(wpl.quantity), 0) AS total_quantity,
    COALESCE(SUM(wpl.reserved_quantity), 0) AS total_reserved,
    COALESCE(SUM(wpl.quantity - wpl.reserved_quantity), 0) AS available_quantity,
    COUNT(DISTINCT w.id) AS warehouse_count,
    COALESCE(AVG(wpl.price), 0) AS avg_price
FROM products p
LEFT JOIN warehouse_product_links wpl ON p.id = wpl.product_id
LEFT JOIN warehouses w ON wpl.warehouse_id = w.id AND w.is_active = TRUE
GROUP BY p.id, p.tenant_id, p.internal_code, p.name;