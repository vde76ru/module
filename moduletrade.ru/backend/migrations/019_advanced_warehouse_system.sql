ALTER TABLE internal_product_stock RENAME TO warehouses_old;

-- Создаем новую таблицу складов с расширенным функционалом
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('physical', 'virtual', 'multi')),
    description TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0, -- приоритет для выбора склада при продаже
    settings JSONB DEFAULT '{}', -- дополнительные настройки склада
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_warehouses_tenant ON warehouses(tenant_id);
CREATE INDEX idx_warehouses_type ON warehouses(type);
CREATE INDEX idx_warehouses_active ON warehouses(is_active);

-- Таблица для хранения цен и остатков по каждому товару на каждом складе
CREATE TABLE warehouse_product_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0, -- зарезервировано под заказы
    price DECIMAL(12,2) NOT NULL,
    min_stock INTEGER DEFAULT 0, -- минимальный остаток для уведомлений
    max_stock INTEGER, -- максимальный остаток для контроля
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, product_id)
);

CREATE INDEX idx_warehouse_product_links_warehouse ON warehouse_product_links(warehouse_id);
CREATE INDEX idx_warehouse_product_links_product ON warehouse_product_links(product_id);
CREATE INDEX idx_warehouse_product_links_quantity ON warehouse_product_links(quantity);

-- Таблица для определения состава "мульти-складов"
CREATE TABLE multi_warehouse_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    multi_warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    source_warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0, -- приоритет использования дочернего склада
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(multi_warehouse_id, source_warehouse_id),
    CHECK (multi_warehouse_id != source_warehouse_id)
);

CREATE INDEX idx_multi_warehouse_parent ON multi_warehouse_components(multi_warehouse_id);
CREATE INDEX idx_multi_warehouse_source ON multi_warehouse_components(source_warehouse_id);

-- Таблица истории движения товаров между складами
CREATE TABLE warehouse_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    product_id UUID REFERENCES products(id),
    from_warehouse_id UUID REFERENCES warehouses(id),
    to_warehouse_id UUID REFERENCES warehouses(id),
    quantity INTEGER NOT NULL,
    movement_type VARCHAR(50) NOT NULL, -- 'transfer', 'sale', 'purchase', 'return', 'adjustment'
    reason TEXT,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_warehouse_movements_product ON warehouse_movements(product_id);
CREATE INDEX idx_warehouse_movements_from ON warehouse_movements(from_warehouse_id);
CREATE INDEX idx_warehouse_movements_to ON warehouse_movements(to_warehouse_id);
CREATE INDEX idx_warehouse_movements_date ON warehouse_movements(created_at);

-- Функция для автоматического пересчета остатков на мульти-складах
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

-- Триггер для автоматического обновления мульти-складов
CREATE TRIGGER trigger_update_multi_warehouse
AFTER INSERT OR UPDATE OF quantity ON warehouse_product_links
FOR EACH ROW
EXECUTE FUNCTION update_multi_warehouse_stock();

-- Мигрируем данные из старой таблицы
INSERT INTO warehouses (id, tenant_id, name, type)
SELECT 
    gen_random_uuid(),
    p.tenant_id,
    COALESCE(ips.warehouse_name, 'Основной склад'),
    'physical'
FROM warehouses_old ips
JOIN products p ON ips.product_id = p.id
GROUP BY p.tenant_id, ips.warehouse_name;

-- Переносим данные о товарах
INSERT INTO warehouse_product_links (warehouse_id, product_id, quantity, price)
SELECT 
    w.id,
    ips.product_id,
    ips.quantity,
    ips.price
FROM warehouses_old ips
JOIN products p ON ips.product_id = p.id
JOIN warehouses w ON w.tenant_id = p.tenant_id 
    AND w.name = COALESCE(ips.warehouse_name, 'Основной склад');

-- Удаляем старую таблицу
DROP TABLE warehouses_old;

-- Добавляем представление для удобного просмотра общих остатков
CREATE OR REPLACE VIEW v_product_total_stock AS
SELECT 
    p.id as product_id,
    p.tenant_id,
    p.internal_code,
    p.name as product_name,
    COALESCE(SUM(wpl.quantity), 0) as total_quantity,
    COALESCE(SUM(wpl.reserved_quantity), 0) as total_reserved,
    COALESCE(SUM(wpl.quantity - wpl.reserved_quantity), 0) as available_quantity,
    COUNT(DISTINCT w.id) as warehouse_count,
    COALESCE(AVG(wpl.price), 0) as avg_price
FROM products p
LEFT JOIN warehouse_product_links wpl ON p.id = wpl.product_id
LEFT JOIN warehouses w ON wpl.warehouse_id = w.id AND w.is_active = TRUE
GROUP BY p.id, p.tenant_id, p.internal_code, p.name;

