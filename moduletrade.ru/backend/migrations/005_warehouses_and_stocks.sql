-- ================================================================
-- МИГРАЦИЯ 005: Склады и остатки
-- Описание: Создает таблицы для управления складами, остатками и движениями товаров
-- Дата: 2025-01-27
-- Блок: Складской Учет
-- Зависимости: 002 (companies), 003 (products)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Warehouses - Склады
-- ================================================================
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    type VARCHAR(50) DEFAULT 'warehouse',
    description TEXT,
    address JSONB DEFAULT '{}'::jsonb,
    contact_info JSONB DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    capacity DECIMAL(12,3),
    max_weight DECIMAL(12,3),
    settings JSONB DEFAULT '{}'::jsonb,
    priority INTEGER DEFAULT 0,
    external_warehouse_id VARCHAR(255),
    integration_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_warehouses_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE warehouses IS 'Склады компаний';
COMMENT ON COLUMN warehouses.company_id IS 'Компания-владелец склада';
COMMENT ON COLUMN warehouses.name IS 'Название склада';
COMMENT ON COLUMN warehouses.code IS 'Код склада';
COMMENT ON COLUMN warehouses.type IS 'Тип склада: warehouse, store, pickup_point';
COMMENT ON COLUMN warehouses.description IS 'Описание склада';
COMMENT ON COLUMN warehouses.address IS 'Адрес склада в JSON формате';
COMMENT ON COLUMN warehouses.contact_info IS 'Контактная информация склада';
COMMENT ON COLUMN warehouses.is_default IS 'Является ли склад основным';
COMMENT ON COLUMN warehouses.is_active IS 'Активен ли склад';
COMMENT ON COLUMN warehouses.capacity IS 'Вместимость склада в кубических метрах';
COMMENT ON COLUMN warehouses.max_weight IS 'Максимальная нагрузка в килограммах';
COMMENT ON COLUMN warehouses.settings IS 'Настройки склада';
COMMENT ON COLUMN warehouses.priority IS 'Приоритет склада при выборе';
COMMENT ON COLUMN warehouses.external_warehouse_id IS 'ID склада во внешней системе';
COMMENT ON COLUMN warehouses.integration_settings IS 'Настройки интеграции';

ALTER TABLE warehouses ADD CONSTRAINT warehouses_name_unique_per_company
    UNIQUE (company_id, name);
ALTER TABLE warehouses ADD CONSTRAINT warehouses_code_unique_per_company
    UNIQUE (company_id, code);

CREATE INDEX idx_warehouses_company_id ON warehouses (company_id);
CREATE INDEX idx_warehouses_name ON warehouses (name);
CREATE INDEX idx_warehouses_code ON warehouses (code);
CREATE INDEX idx_warehouses_type ON warehouses (type);
CREATE INDEX idx_warehouses_is_default ON warehouses (is_default);
CREATE INDEX idx_warehouses_is_active ON warehouses (is_active);
CREATE INDEX idx_warehouses_priority ON warehouses (priority);
CREATE INDEX idx_warehouses_company_active ON warehouses (company_id, is_active, priority);
CREATE INDEX idx_warehouses_external_id ON warehouses (external_warehouse_id);

-- ================================================================
-- ТАБЛИЦА: Warehouse_Product_Links - Связь товаров со складами
-- ================================================================
CREATE TABLE warehouse_product_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity DECIMAL(12,3) DEFAULT 0,
    reserved_quantity DECIMAL(12,3) DEFAULT 0,
    available_quantity DECIMAL(12,3) DEFAULT 0,
    price DECIMAL(12,2),
    cost_price DECIMAL(12,2),
    min_stock_level DECIMAL(12,3) DEFAULT 0,
    max_stock_level DECIMAL(12,3),
    reorder_point DECIMAL(12,3),
    location_code VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_warehouse_product_links_warehouse_id
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_product_links_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE warehouse_product_links IS 'Связь товаров со складами и их остатки';
COMMENT ON COLUMN warehouse_product_links.warehouse_id IS 'Склад';
COMMENT ON COLUMN warehouse_product_links.product_id IS 'Товар';
COMMENT ON COLUMN warehouse_product_links.quantity IS 'Общее количество товара на складе';
COMMENT ON COLUMN warehouse_product_links.reserved_quantity IS 'Зарезервированное количество';
COMMENT ON COLUMN warehouse_product_links.available_quantity IS 'Доступное количество (quantity - reserved_quantity)';
COMMENT ON COLUMN warehouse_product_links.price IS 'Цена товара на складе';
COMMENT ON COLUMN warehouse_product_links.cost_price IS 'Себестоимость товара';
COMMENT ON COLUMN warehouse_product_links.min_stock_level IS 'Минимальный уровень остатка';
COMMENT ON COLUMN warehouse_product_links.max_stock_level IS 'Максимальный уровень остатка';
COMMENT ON COLUMN warehouse_product_links.reorder_point IS 'Точка перезаказа';
COMMENT ON COLUMN warehouse_product_links.location_code IS 'Код места хранения на складе';
COMMENT ON COLUMN warehouse_product_links.is_active IS 'Активна ли связь';
COMMENT ON COLUMN warehouse_product_links.last_updated_at IS 'Время последнего обновления остатка';

ALTER TABLE warehouse_product_links ADD CONSTRAINT warehouse_product_links_unique
    UNIQUE (warehouse_id, product_id);
ALTER TABLE warehouse_product_links ADD CONSTRAINT warehouse_product_links_quantity_check
    CHECK (quantity >= 0);
ALTER TABLE warehouse_product_links ADD CONSTRAINT warehouse_product_links_reserved_check
    CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity);

CREATE INDEX idx_warehouse_product_links_warehouse_id ON warehouse_product_links (warehouse_id);
CREATE INDEX idx_warehouse_product_links_product_id ON warehouse_product_links (product_id);
CREATE INDEX idx_warehouse_product_links_quantity ON warehouse_product_links (quantity);
CREATE INDEX idx_warehouse_product_links_available_quantity ON warehouse_product_links (available_quantity);
CREATE INDEX idx_warehouse_product_links_is_active ON warehouse_product_links (is_active);
CREATE INDEX idx_warehouse_product_links_low_stock ON warehouse_product_links (warehouse_id, available_quantity, min_stock_level)
    WHERE available_quantity <= min_stock_level;
CREATE INDEX idx_warehouse_product_links_location ON warehouse_product_links (location_code);

-- ================================================================
-- ТАБЛИЦА: Stocks - Детальная информация об остатках
-- ================================================================
CREATE TABLE stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    price DECIMAL(12,2),
    cost_price DECIMAL(12,2),
    min_quantity DECIMAL(12,3) DEFAULT 0,
    max_quantity DECIMAL(12,3),
    reorder_point DECIMAL(12,3),
    batch_number VARCHAR(100),
    expiry_date DATE,
    last_receipt_date DATE,
    last_sale_date DATE,
    location_code VARCHAR(100),
    storage_conditions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_stocks_warehouse_id
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stocks_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE stocks IS 'Детальная информация об остатках товаров на складах';
COMMENT ON COLUMN stocks.warehouse_id IS 'Склад';
COMMENT ON COLUMN stocks.product_id IS 'Товар';
COMMENT ON COLUMN stocks.quantity IS 'Количество товара';
COMMENT ON COLUMN stocks.price IS 'Цена товара';
COMMENT ON COLUMN stocks.cost_price IS 'Себестоимость товара';
COMMENT ON COLUMN stocks.min_quantity IS 'Минимальное количество';
COMMENT ON COLUMN stocks.max_quantity IS 'Максимальное количество';
COMMENT ON COLUMN stocks.reorder_point IS 'Точка перезаказа';
COMMENT ON COLUMN stocks.batch_number IS 'Номер партии';
COMMENT ON COLUMN stocks.expiry_date IS 'Дата истечения срока годности';
COMMENT ON COLUMN stocks.last_receipt_date IS 'Дата последнего поступления';
COMMENT ON COLUMN stocks.last_sale_date IS 'Дата последней продажи';
COMMENT ON COLUMN stocks.location_code IS 'Код места хранения';
COMMENT ON COLUMN stocks.storage_conditions IS 'Условия хранения';
COMMENT ON COLUMN stocks.is_active IS 'Активна ли запись';

CREATE INDEX idx_stocks_warehouse_id ON stocks (warehouse_id);
CREATE INDEX idx_stocks_product_id ON stocks (product_id);
CREATE INDEX idx_stocks_quantity ON stocks (quantity);
CREATE INDEX idx_stocks_batch_number ON stocks (batch_number);
CREATE INDEX idx_stocks_expiry_date ON stocks (expiry_date);
CREATE INDEX idx_stocks_location_code ON stocks (location_code);
CREATE INDEX idx_stocks_is_active ON stocks (is_active);
CREATE INDEX idx_stocks_low_stock ON stocks (warehouse_id, product_id, quantity, min_quantity)
    WHERE quantity <= min_quantity;

-- ================================================================
-- ТАБЛИЦА: Warehouse_Movements - Движения товаров на складах
-- ================================================================
CREATE TABLE warehouse_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL,
    from_warehouse_id UUID,
    to_warehouse_id UUID,
    product_id UUID NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    type VARCHAR(50),
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2),
    total_value DECIMAL(12,2),
    reference_type VARCHAR(50),
    reference_id UUID,
    reason TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    user_id UUID,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_warehouse_movements_warehouse_id
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_movements_from_warehouse_id
        FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_movements_to_warehouse_id
        FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_movements_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_movements_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_movements_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE warehouse_movements IS 'Движения товаров на складах';
COMMENT ON COLUMN warehouse_movements.warehouse_id IS 'Склад (основной)';
COMMENT ON COLUMN warehouse_movements.from_warehouse_id IS 'Склад-источник (для переводов)';
COMMENT ON COLUMN warehouse_movements.to_warehouse_id IS 'Склад-назначение (для переводов)';
COMMENT ON COLUMN warehouse_movements.product_id IS 'Товар';
COMMENT ON COLUMN warehouse_movements.movement_type IS 'Тип движения: receipt, sale, transfer, adjustment, return';
COMMENT ON COLUMN warehouse_movements.type IS 'Альтернативное название типа движения';
COMMENT ON COLUMN warehouse_movements.quantity IS 'Количество товара';
COMMENT ON COLUMN warehouse_movements.unit_price IS 'Цена за единицу';
COMMENT ON COLUMN warehouse_movements.total_value IS 'Общая стоимость';
COMMENT ON COLUMN warehouse_movements.reference_type IS 'Тип связанной сущности: order, invoice, transfer';
COMMENT ON COLUMN warehouse_movements.reference_id IS 'ID связанной сущности';
COMMENT ON COLUMN warehouse_movements.reason IS 'Причина движения';
COMMENT ON COLUMN warehouse_movements.notes IS 'Примечания к движению';
COMMENT ON COLUMN warehouse_movements.metadata IS 'Дополнительные данные';
COMMENT ON COLUMN warehouse_movements.user_id IS 'Пользователь, создавший движение (основное поле)';
COMMENT ON COLUMN warehouse_movements.created_by IS 'Пользователь, создавший движение (альтернативное поле)';

CREATE INDEX idx_warehouse_movements_warehouse_id ON warehouse_movements (warehouse_id);
CREATE INDEX idx_warehouse_movements_from_warehouse_id ON warehouse_movements (from_warehouse_id);
CREATE INDEX idx_warehouse_movements_to_warehouse_id ON warehouse_movements (to_warehouse_id);
CREATE INDEX idx_warehouse_movements_product_id ON warehouse_movements (product_id);
CREATE INDEX idx_warehouse_movements_movement_type ON warehouse_movements (movement_type);
CREATE INDEX idx_warehouse_movements_type ON warehouse_movements (type);
CREATE INDEX idx_warehouse_movements_created_at ON warehouse_movements (created_at DESC);
CREATE INDEX idx_warehouse_movements_reference ON warehouse_movements (reference_type, reference_id);
CREATE INDEX idx_warehouse_movements_user_id ON warehouse_movements (user_id);
CREATE INDEX idx_warehouse_movements_created_by ON warehouse_movements (created_by);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouse_product_links_updated_at
    BEFORE UPDATE ON warehouse_product_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stocks_updated_at
    BEFORE UPDATE ON stocks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouse_movements_updated_at
    BEFORE UPDATE ON warehouse_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ СО СКЛАДАМИ
-- ================================================================

-- Функция для проверки лимита складов
CREATE OR REPLACE FUNCTION check_warehouses_limit(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    -- Считаем активных складов компании
    SELECT COUNT(*)
    INTO v_current_count
    FROM warehouses
    WHERE company_id = p_company_id AND is_active = true;

    -- Проверяем лимит через общую функцию
    RETURN check_company_limits(p_company_id, 'warehouses', v_current_count);
END;
$$ LANGUAGE plpgsql;

-- Функция для резервирования товара на складе
CREATE OR REPLACE FUNCTION reserve_stock(
    p_warehouse_id UUID,
    p_product_id UUID,
    p_quantity DECIMAL,
    p_reservation_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_available_quantity DECIMAL;
    v_current_reserved DECIMAL;
BEGIN
    -- Получаем доступное количество
    SELECT available_quantity, reserved_quantity
    INTO v_available_quantity, v_current_reserved
    FROM warehouse_product_links
    WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id;

    -- Проверяем, достаточно ли товара
    IF v_available_quantity IS NULL OR v_available_quantity < p_quantity THEN
        RETURN FALSE;
    END IF;

    -- Резервируем товар
    UPDATE warehouse_product_links
    SET reserved_quantity = reserved_quantity + p_quantity,
        available_quantity = available_quantity - p_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id;

    -- Создаем запись о движении
    INSERT INTO warehouse_movements (
        warehouse_id,
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes
    ) VALUES (
        p_warehouse_id,
        p_product_id,
        'reservation',
        p_quantity,
        'reservation',
        p_reservation_id,
        'Резервирование товара'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Функция для освобождения резерва
CREATE OR REPLACE FUNCTION release_reservation(
    p_warehouse_id UUID,
    p_product_id UUID,
    p_quantity DECIMAL,
    p_reservation_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Освобождаем резерв
    UPDATE warehouse_product_links
    SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
        available_quantity = available_quantity + p_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id;

    -- Создаем запись о движении
    INSERT INTO warehouse_movements (
        warehouse_id,
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes
    ) VALUES (
        p_warehouse_id,
        p_product_id,
        'release',
        p_quantity,
        'reservation',
        p_reservation_id,
        'Освобождение резерва'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения товаров с низким остатком
CREATE OR REPLACE FUNCTION get_low_stock_products(p_company_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR,
    warehouse_id UUID,
    warehouse_name VARCHAR,
    current_quantity DECIMAL,
    min_stock_level DECIMAL,
    reorder_point DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        w.id,
        w.name,
        wpl.available_quantity,
        wpl.min_stock_level,
        wpl.reorder_point
    FROM warehouse_product_links wpl
    JOIN products p ON wpl.product_id = p.id
    JOIN warehouses w ON wpl.warehouse_id = w.id
    WHERE w.company_id = p_company_id
        AND wpl.is_active = true
        AND w.is_active = true
        AND p.is_active = true
        AND wpl.available_quantity <= wpl.min_stock_level
    ORDER BY wpl.available_quantity ASC;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения остатков товара по всем складам
CREATE OR REPLACE FUNCTION get_product_stock_summary(p_product_id UUID, p_company_id UUID)
RETURNS TABLE (
    warehouse_id UUID,
    warehouse_name VARCHAR,
    total_quantity DECIMAL,
    reserved_quantity DECIMAL,
    available_quantity DECIMAL,
    price DECIMAL,
    cost_price DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.name,
        wpl.quantity,
        wpl.reserved_quantity,
        wpl.available_quantity,
        wpl.price,
        wpl.cost_price
    FROM warehouse_product_links wpl
    JOIN warehouses w ON wpl.warehouse_id = w.id
    WHERE wpl.product_id = p_product_id
        AND w.company_id = p_company_id
        AND wpl.is_active = true
        AND w.is_active = true
    ORDER BY w.priority DESC, w.name;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления остатков при движении
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем остатки в warehouse_product_links
    IF TG_OP = 'INSERT' THEN
        -- Добавляем движение
        UPDATE warehouse_product_links
        SET
            quantity = CASE
                WHEN NEW.movement_type IN ('receipt', 'return') THEN quantity + NEW.quantity
                WHEN NEW.movement_type IN ('sale', 'transfer_out') THEN quantity - NEW.quantity
                ELSE quantity
            END,
            available_quantity = CASE
                WHEN NEW.movement_type IN ('receipt', 'return') THEN available_quantity + NEW.quantity
                WHEN NEW.movement_type IN ('sale', 'transfer_out') THEN available_quantity - NEW.quantity
                ELSE available_quantity
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE warehouse_id = NEW.warehouse_id AND product_id = NEW.product_id;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Обновляем движение (сложная логика)
        UPDATE warehouse_product_links
        SET
            quantity = quantity - OLD.quantity + NEW.quantity,
            available_quantity = available_quantity - OLD.quantity + NEW.quantity,
            updated_at = CURRENT_TIMESTAMP
        WHERE warehouse_id = NEW.warehouse_id AND product_id = NEW.product_id;

    ELSIF TG_OP = 'DELETE' THEN
        -- Отменяем движение
        UPDATE warehouse_product_links
        SET
            quantity = CASE
                WHEN OLD.movement_type IN ('receipt', 'return') THEN quantity - OLD.quantity
                WHEN OLD.movement_type IN ('sale', 'transfer_out') THEN quantity + OLD.quantity
                ELSE quantity
            END,
            available_quantity = CASE
                WHEN OLD.movement_type IN ('receipt', 'return') THEN available_quantity - OLD.quantity
                WHEN OLD.movement_type IN ('sale', 'transfer_out') THEN available_quantity + OLD.quantity
                ELSE available_quantity
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE warehouse_id = OLD.warehouse_id AND product_id = OLD.product_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления остатков
CREATE TRIGGER update_stock_on_movement_trigger
    AFTER INSERT OR UPDATE OR DELETE ON warehouse_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_on_movement();

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 005
-- ================================================================