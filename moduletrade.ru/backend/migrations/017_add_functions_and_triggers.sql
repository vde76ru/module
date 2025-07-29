-- 015_add_functions_and_triggers.sql
-- Добавление функций и триггеров

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для расчета нормализованной цены
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

-- Функция для расчета прибыли по позициям заказа
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

-- Функция для проверки ручного переопределения цены
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

-- Функция для обновления остатков мульти-склада
CREATE OR REPLACE FUNCTION update_multi_warehouse_stock()
RETURNS TRIGGER AS $$
DECLARE
    parent_warehouse RECORD;
    total_quantity INTEGER;
BEGIN
    -- Проверяем, является ли измененный склад компонентом мульти-склада
    FOR parent_warehouse IN 
        SELECT mwc.multi_warehouse_id 
        FROM multi_warehouse_components mwc
        WHERE mwc.source_warehouse_id = NEW.warehouse_id 
        AND mwc.is_active = TRUE
    LOOP
        -- Вычисляем суммарный остаток по всем дочерним складам
        SELECT COALESCE(SUM(wpl.quantity), 0) INTO total_quantity
        FROM warehouse_product_links wpl
        INNER JOIN multi_warehouse_components mwc 
            ON wpl.warehouse_id = mwc.source_warehouse_id
        WHERE mwc.multi_warehouse_id = parent_warehouse.multi_warehouse_id
        AND mwc.is_active = TRUE
        AND wpl.product_id = NEW.product_id;
        
        -- Обновляем или создаем запись для мульти-склада
        INSERT INTO warehouse_product_links (
            warehouse_id, product_id, quantity, price, last_updated
        ) VALUES (
            parent_warehouse.multi_warehouse_id, 
            NEW.product_id, 
            total_quantity, 
            NEW.price,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (warehouse_id, product_id) 
        DO UPDATE SET 
            quantity = total_quantity,
            last_updated = CURRENT_TIMESTAMP;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создание триггеров

-- Триггер для расчета нормализованной цены
DROP TRIGGER IF EXISTS trigger_calculate_normalized_price ON product_suppliers;
CREATE TRIGGER trigger_calculate_normalized_price 
    BEFORE INSERT OR UPDATE OF price, supplier_multiplicity, unit_conversion_factor 
    ON product_suppliers 
    FOR EACH ROW 
    EXECUTE FUNCTION calculate_normalized_price();

-- Триггер для расчета прибыли по заказам
DROP TRIGGER IF EXISTS trigger_calculate_order_profit ON order_items;
CREATE TRIGGER trigger_calculate_order_profit 
    BEFORE INSERT OR UPDATE OF price, purchase_price, commission_rate 
    ON order_items 
    FOR EACH ROW 
    EXECUTE FUNCTION calculate_order_item_profit();

-- Триггер для проверки ручной цены
DROP TRIGGER IF EXISTS trigger_check_manual_price ON marketplace_product_links;
CREATE TRIGGER trigger_check_manual_price 
    BEFORE UPDATE OF last_auto_price 
    ON marketplace_product_links 
    FOR EACH ROW 
    EXECUTE FUNCTION check_manual_price_override();

-- Триггер для обновления мульти-складов
DROP TRIGGER IF EXISTS trigger_update_multi_warehouse ON warehouse_product_links;
CREATE TRIGGER trigger_update_multi_warehouse 
    AFTER INSERT OR UPDATE OF quantity 
    ON warehouse_product_links 
    FOR EACH ROW 
    EXECUTE FUNCTION update_multi_warehouse_stock();

-- Триггеры для updated_at

-- Для brand_content_sources
DROP TRIGGER IF EXISTS update_brand_content_sources_updated_at ON brand_content_sources;
CREATE TRIGGER update_brand_content_sources_updated_at 
    BEFORE UPDATE ON brand_content_sources 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Для exchange_rates
DROP TRIGGER IF EXISTS update_exchange_rates_updated_at ON exchange_rates;
CREATE TRIGGER update_exchange_rates_updated_at 
    BEFORE UPDATE ON exchange_rates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Для sales_channels
DROP TRIGGER IF EXISTS update_sales_channels_updated_at ON sales_channels;
CREATE TRIGGER update_sales_channels_updated_at 
    BEFORE UPDATE ON sales_channels 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Для user_sessions
DROP TRIGGER IF EXISTS update_user_sessions_updated_at ON user_sessions;
CREATE TRIGGER update_user_sessions_updated_at 
    BEFORE UPDATE ON user_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();