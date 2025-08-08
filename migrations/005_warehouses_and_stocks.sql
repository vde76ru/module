-- ================================================================
-- МИГРАЦИЯ 005: Склады и остатки (ИСПРАВЛЕНА)
-- Описание: Создает таблицы для управления складами и остатками товаров
-- Дата: 2025-01-27
-- Блок: Склады и Остатки
-- Зависимости: 002 (companies), 003 (suppliers), 004 (products)
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
    address TEXT,
    contact_info JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    is_main BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
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
COMMENT ON COLUMN warehouses.address IS 'Адрес склада';
COMMENT ON COLUMN warehouses.contact_info IS 'Контактная информация склада';
COMMENT ON COLUMN warehouses.settings IS 'Настройки склада';
COMMENT ON COLUMN warehouses.is_main IS 'Является ли склад основным';
COMMENT ON COLUMN warehouses.is_active IS 'Активен ли склад';

ALTER TABLE warehouses ADD CONSTRAINT warehouses_name_unique_per_company
    UNIQUE (company_id, name);
ALTER TABLE warehouses ADD CONSTRAINT warehouses_code_unique_per_company
    UNIQUE (company_id, code);

CREATE INDEX idx_warehouses_company_id ON warehouses (company_id);
CREATE INDEX idx_warehouses_name ON warehouses (name);
CREATE INDEX idx_warehouses_code ON warehouses (code);
CREATE INDEX idx_warehouses_type ON warehouses (type);
CREATE INDEX idx_warehouses_is_main ON warehouses (is_main);
CREATE INDEX idx_warehouses_is_active ON warehouses (is_active);

-- ================================================================
-- ТАБЛИЦА: Multi_Warehouse_Components - Компоненты мульти-складов
-- ================================================================
CREATE TABLE multi_warehouse_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    multi_warehouse_id UUID NOT NULL,
    component_warehouse_id UUID NOT NULL,
    weight DECIMAL(5,2) DEFAULT 1.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_multi_warehouse_components_multi_warehouse_id
        FOREIGN KEY (multi_warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_multi_warehouse_components_component_warehouse_id
        FOREIGN KEY (component_warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE multi_warehouse_components IS 'Компоненты мульти-складов';
COMMENT ON COLUMN multi_warehouse_components.multi_warehouse_id IS 'Мульти-склад';
COMMENT ON COLUMN multi_warehouse_components.component_warehouse_id IS 'Компонентный склад';
COMMENT ON COLUMN multi_warehouse_components.weight IS 'Вес компонента';
COMMENT ON COLUMN multi_warehouse_components.is_active IS 'Активен ли компонент';

ALTER TABLE multi_warehouse_components ADD CONSTRAINT multi_warehouse_components_unique
    UNIQUE (multi_warehouse_id, component_warehouse_id);

CREATE INDEX idx_multi_warehouse_components_multi_warehouse_id ON multi_warehouse_components (multi_warehouse_id);
CREATE INDEX idx_multi_warehouse_components_component_warehouse_id ON multi_warehouse_components (component_warehouse_id);
CREATE INDEX idx_multi_warehouse_components_is_active ON multi_warehouse_components (is_active);

-- ================================================================
-- ТАБЛИЦА: Warehouse_Product_Links - Остатки товаров на складах
-- ================================================================
CREATE TABLE warehouse_product_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity DECIMAL(12,3) DEFAULT 0,
    reserved_quantity DECIMAL(12,3) DEFAULT 0,
    available_quantity DECIMAL(12,3) DEFAULT 0,
    min_quantity DECIMAL(12,3) DEFAULT 0,
    max_quantity DECIMAL(12,3),
    min_stock_level DECIMAL(12,3) DEFAULT 0,
    reorder_point DECIMAL(12,3),
    unit_cost DECIMAL(12,2),
    price DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'RUB',
    location_code VARCHAR(100),
    last_sale_date TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_warehouse_product_links_warehouse_id
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_product_links_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE warehouse_product_links IS 'Остатки товаров на складах';
COMMENT ON COLUMN warehouse_product_links.warehouse_id IS 'Склад';
COMMENT ON COLUMN warehouse_product_links.product_id IS 'Товар';
COMMENT ON COLUMN warehouse_product_links.quantity IS 'Общее количество товара на складе';
COMMENT ON COLUMN warehouse_product_links.reserved_quantity IS 'Зарезервированное количество';
COMMENT ON COLUMN warehouse_product_links.available_quantity IS 'Доступное количество (quantity - reserved_quantity)';
COMMENT ON COLUMN warehouse_product_links.min_quantity IS 'Минимальный уровень остатка';
COMMENT ON COLUMN warehouse_product_links.max_quantity IS 'Максимальный уровень остатка';
COMMENT ON COLUMN warehouse_product_links.min_stock_level IS 'Минимальный уровень остатка (используется в коде)';
COMMENT ON COLUMN warehouse_product_links.reorder_point IS 'Точка перезаказа';
COMMENT ON COLUMN warehouse_product_links.unit_cost IS 'Себестоимость единицы товара';
COMMENT ON COLUMN warehouse_product_links.price IS 'Цена товара';
COMMENT ON COLUMN warehouse_product_links.currency IS 'Валюта цены';
COMMENT ON COLUMN warehouse_product_links.location_code IS 'Код местоположения на складе';
COMMENT ON COLUMN warehouse_product_links.last_sale_date IS 'Дата последней продажи';
COMMENT ON COLUMN warehouse_product_links.last_updated IS 'Дата последнего обновления остатка';
COMMENT ON COLUMN warehouse_product_links.is_active IS 'Активен ли остаток';

ALTER TABLE warehouse_product_links ADD CONSTRAINT warehouse_product_links_unique
    UNIQUE (warehouse_id, product_id);

CREATE INDEX idx_warehouse_product_links_warehouse_id ON warehouse_product_links (warehouse_id);
CREATE INDEX idx_warehouse_product_links_product_id ON warehouse_product_links (product_id);
CREATE INDEX idx_warehouse_product_links_quantity ON warehouse_product_links (quantity);
CREATE INDEX idx_warehouse_product_links_available_quantity ON warehouse_product_links (available_quantity);
CREATE INDEX idx_warehouse_product_links_min_quantity ON warehouse_product_links (min_quantity);
CREATE INDEX idx_warehouse_product_links_min_stock_level ON warehouse_product_links (min_stock_level);
CREATE INDEX idx_warehouse_product_links_price ON warehouse_product_links (price);
CREATE INDEX idx_warehouse_product_links_location_code ON warehouse_product_links (location_code);
CREATE INDEX idx_warehouse_product_links_last_sale_date ON warehouse_product_links (last_sale_date);
CREATE INDEX idx_warehouse_product_links_last_updated ON warehouse_product_links (last_updated);
CREATE INDEX idx_warehouse_product_links_is_active ON warehouse_product_links (is_active);
CREATE INDEX idx_warehouse_product_links_low_stock ON warehouse_product_links (warehouse_id, available_quantity, min_stock_level)
    WHERE available_quantity <= min_stock_level;

-- ================================================================
-- ТАБЛИЦА: Warehouse_Movements - Движения товаров по складам
-- ================================================================
CREATE TABLE warehouse_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_warehouse_id UUID,
    to_warehouse_id UUID,
    product_id UUID NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    unit_cost DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'RUB',
    movement_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_warehouse_movements_from_warehouse_id
        FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_movements_to_warehouse_id
        FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_movements_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_movements_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE warehouse_movements IS 'Движения товаров по складам';
COMMENT ON COLUMN warehouse_movements.from_warehouse_id IS 'Склад-отправитель';
COMMENT ON COLUMN warehouse_movements.to_warehouse_id IS 'Склад-получатель';
COMMENT ON COLUMN warehouse_movements.product_id IS 'Товар';
COMMENT ON COLUMN warehouse_movements.movement_type IS 'Тип движения: receipt, issue, transfer, adjustment, return';
COMMENT ON COLUMN warehouse_movements.quantity IS 'Количество товара (положительное для прихода, отрицательное для расхода)';
COMMENT ON COLUMN warehouse_movements.reference_type IS 'Тип связанной сущности: order, supplier_order, transfer, adjustment';
COMMENT ON COLUMN warehouse_movements.reference_id IS 'ID связанной сущности';
COMMENT ON COLUMN warehouse_movements.description IS 'Описание движения';
COMMENT ON COLUMN warehouse_movements.unit_cost IS 'Себестоимость единицы товара';
COMMENT ON COLUMN warehouse_movements.currency IS 'Валюта себестоимости';
COMMENT ON COLUMN warehouse_movements.movement_date IS 'Дата движения';
COMMENT ON COLUMN warehouse_movements.user_id IS 'Пользователь, создавший движение';
COMMENT ON COLUMN warehouse_movements.metadata IS 'Дополнительные данные';

CREATE INDEX idx_warehouse_movements_from_warehouse_id ON warehouse_movements (from_warehouse_id);
CREATE INDEX idx_warehouse_movements_to_warehouse_id ON warehouse_movements (to_warehouse_id);
CREATE INDEX idx_warehouse_movements_product_id ON warehouse_movements (product_id);
CREATE INDEX idx_warehouse_movements_movement_type ON warehouse_movements (movement_type);
CREATE INDEX idx_warehouse_movements_movement_date ON warehouse_movements (movement_date DESC);
CREATE INDEX idx_warehouse_movements_reference ON warehouse_movements (reference_type, reference_id);
CREATE INDEX idx_warehouse_movements_user_id ON warehouse_movements (user_id);

-- ================================================================
-- ТАБЛИЦА: Stock_Reservations - Резервирование товаров
-- ================================================================
CREATE TABLE stock_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    reservation_type VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_stock_reservations_warehouse_id
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stock_reservations_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stock_reservations_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE stock_reservations IS 'Резервирование товаров';
COMMENT ON COLUMN stock_reservations.warehouse_id IS 'Склад';
COMMENT ON COLUMN stock_reservations.product_id IS 'Товар';
COMMENT ON COLUMN stock_reservations.quantity IS 'Зарезервированное количество';
COMMENT ON COLUMN stock_reservations.reservation_type IS 'Тип резервирования: order, transfer, manual';
COMMENT ON COLUMN stock_reservations.reference_type IS 'Тип связанной сущности';
COMMENT ON COLUMN stock_reservations.reference_id IS 'ID связанной сущности';
COMMENT ON COLUMN stock_reservations.expires_at IS 'Дата истечения резервирования';
COMMENT ON COLUMN stock_reservations.status IS 'Статус резервирования: active, released, expired';
COMMENT ON COLUMN stock_reservations.created_by IS 'Пользователь, создавший резервирование';

CREATE INDEX idx_stock_reservations_warehouse_id ON stock_reservations (warehouse_id);
CREATE INDEX idx_stock_reservations_product_id ON stock_reservations (product_id);
CREATE INDEX idx_stock_reservations_reservation_type ON stock_reservations (reservation_type);
CREATE INDEX idx_stock_reservations_status ON stock_reservations (status);
CREATE INDEX idx_stock_reservations_expires_at ON stock_reservations (expires_at);
CREATE INDEX idx_stock_reservations_reference ON stock_reservations (reference_type, reference_id);
CREATE INDEX idx_stock_reservations_created_by ON stock_reservations (created_by);

-- ================================================================
-- ТАБЛИЦА: Stock_Transfers - Перемещения между складами
-- ================================================================
CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    from_warehouse_id UUID NOT NULL,
    to_warehouse_id UUID NOT NULL,
    transfer_number VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    transfer_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expected_delivery_date TIMESTAMP WITH TIME ZONE,
    actual_delivery_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_stock_transfers_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stock_transfers_from_warehouse_id
        FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stock_transfers_to_warehouse_id
        FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stock_transfers_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_stock_transfers_approved_by
        FOREIGN KEY (approved_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE stock_transfers IS 'Перемещения товаров между складами';
COMMENT ON COLUMN stock_transfers.company_id IS 'Компания';
COMMENT ON COLUMN stock_transfers.from_warehouse_id IS 'Склад-отправитель';
COMMENT ON COLUMN stock_transfers.to_warehouse_id IS 'Склад-получатель';
COMMENT ON COLUMN stock_transfers.transfer_number IS 'Номер перемещения';
COMMENT ON COLUMN stock_transfers.status IS 'Статус перемещения: pending, approved, in_transit, completed, cancelled';
COMMENT ON COLUMN stock_transfers.transfer_date IS 'Дата создания перемещения';
COMMENT ON COLUMN stock_transfers.expected_delivery_date IS 'Ожидаемая дата доставки';
COMMENT ON COLUMN stock_transfers.actual_delivery_date IS 'Фактическая дата доставки';
COMMENT ON COLUMN stock_transfers.notes IS 'Примечания к перемещению';
COMMENT ON COLUMN stock_transfers.created_by IS 'Пользователь, создавший перемещение';
COMMENT ON COLUMN stock_transfers.approved_by IS 'Пользователь, утвердивший перемещение';
COMMENT ON COLUMN stock_transfers.approved_at IS 'Дата утверждения';

ALTER TABLE stock_transfers ADD CONSTRAINT stock_transfers_number_unique_per_company
    UNIQUE (company_id, transfer_number);

CREATE INDEX idx_stock_transfers_company_id ON stock_transfers (company_id);
CREATE INDEX idx_stock_transfers_from_warehouse_id ON stock_transfers (from_warehouse_id);
CREATE INDEX idx_stock_transfers_to_warehouse_id ON stock_transfers (to_warehouse_id);
CREATE INDEX idx_stock_transfers_transfer_number ON stock_transfers (transfer_number);
CREATE INDEX idx_stock_transfers_status ON stock_transfers (status);
CREATE INDEX idx_stock_transfers_transfer_date ON stock_transfers (transfer_date DESC);
CREATE INDEX idx_stock_transfers_created_by ON stock_transfers (created_by);

-- ================================================================
-- ТАБЛИЦА: Stock_Transfer_Items - Позиции перемещений
-- ================================================================
CREATE TABLE stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    transferred_quantity DECIMAL(12,3) DEFAULT 0,
    unit_cost DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'RUB',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_stock_transfer_items_transfer_id
        FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stock_transfer_items_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE stock_transfer_items IS 'Позиции перемещений товаров';
COMMENT ON COLUMN stock_transfer_items.transfer_id IS 'Перемещение';
COMMENT ON COLUMN stock_transfer_items.product_id IS 'Товар';
COMMENT ON COLUMN stock_transfer_items.quantity IS 'Количество для перемещения';
COMMENT ON COLUMN stock_transfer_items.transferred_quantity IS 'Фактически перемещенное количество';
COMMENT ON COLUMN stock_transfer_items.unit_cost IS 'Себестоимость единицы товара';
COMMENT ON COLUMN stock_transfer_items.currency IS 'Валюта себестоимости';
COMMENT ON COLUMN stock_transfer_items.notes IS 'Примечания к позиции';

CREATE INDEX idx_stock_transfer_items_transfer_id ON stock_transfer_items (transfer_id);
CREATE INDEX idx_stock_transfer_items_product_id ON stock_transfer_items (product_id);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_multi_warehouse_components_updated_at
    BEFORE UPDATE ON multi_warehouse_components
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouse_product_links_updated_at
    BEFORE UPDATE ON warehouse_product_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouse_movements_updated_at
    BEFORE UPDATE ON warehouse_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_reservations_updated_at
    BEFORE UPDATE ON stock_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_transfers_updated_at
    BEFORE UPDATE ON stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_transfer_items_updated_at
    BEFORE UPDATE ON stock_transfer_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ СО СКЛАДАМИ
-- ================================================================

-- Функция для обновления доступного количества товара
CREATE OR REPLACE FUNCTION update_available_quantity()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем доступное количество
    NEW.available_quantity := NEW.quantity - COALESCE(NEW.reserved_quantity, 0);

    -- Обновляем время последнего изменения
    NEW.last_updated := CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления доступного количества
CREATE TRIGGER update_warehouse_product_links_available_quantity_trigger
    BEFORE INSERT OR UPDATE ON warehouse_product_links
    FOR EACH ROW
    EXECUTE FUNCTION update_available_quantity();

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
    WHERE company_id = p_company_id AND is_active = TRUE;

    -- Проверяем лимит через общую функцию
    RETURN check_company_limits(p_company_id, 'warehouses', v_current_count);
END;
$$ LANGUAGE plpgsql;

-- Функция для получения остатков товара по всем складам
CREATE OR REPLACE FUNCTION get_product_stocks(p_product_id UUID)
RETURNS TABLE (
    warehouse_id UUID,
    warehouse_name VARCHAR,
    quantity DECIMAL,
    reserved_quantity DECIMAL,
    available_quantity DECIMAL,
    min_quantity DECIMAL,
    unit_cost DECIMAL,
    currency VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.name,
        s.quantity,
        s.reserved_quantity,
        s.available_quantity,
        s.min_quantity,
        s.unit_cost,
        s.currency
    FROM warehouse_product_links s
    JOIN warehouses w ON s.warehouse_id = w.id
    WHERE s.product_id = p_product_id
        AND s.is_active = TRUE
        AND w.is_active = TRUE
    ORDER BY w.is_main DESC, w.name;
END;
$$ LANGUAGE plpgsql;

-- Функция для резервирования товара
CREATE OR REPLACE FUNCTION reserve_stock(
    p_warehouse_id UUID,
    p_product_id UUID,
    p_quantity DECIMAL,
    p_reservation_type VARCHAR,
    p_reference_type VARCHAR DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_reservation_id UUID;
    v_available_quantity DECIMAL;
BEGIN
    -- Проверяем доступное количество
    SELECT available_quantity
    INTO v_available_quantity
    FROM warehouse_product_links
    WHERE warehouse_id = p_warehouse_id
        AND product_id = p_product_id
        AND is_active = TRUE;

    -- Если товара нет на складе или недостаточно
    IF v_available_quantity IS NULL OR v_available_quantity < p_quantity THEN
        RAISE EXCEPTION 'Недостаточно товара на складе. Доступно: %, требуется: %',
            COALESCE(v_available_quantity, 0), p_quantity;
    END IF;

    -- Создаем резервирование
    INSERT INTO stock_reservations (
        warehouse_id,
        product_id,
        quantity,
        reservation_type,
        reference_type,
        reference_id,
        expires_at,
        created_by
    ) VALUES (
        p_warehouse_id,
        p_product_id,
        p_quantity,
        p_reservation_type,
        p_reference_type,
        p_reference_id,
        p_expires_at,
        p_created_by
    ) RETURNING id INTO v_reservation_id;

    -- Обновляем зарезервированное количество
    UPDATE warehouse_product_links
    SET reserved_quantity = reserved_quantity + p_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE warehouse_id = p_warehouse_id
        AND product_id = p_product_id;

    RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для освобождения резервирования
CREATE OR REPLACE FUNCTION release_reservation(p_reservation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_warehouse_id UUID;
    v_product_id UUID;
    v_quantity DECIMAL;
BEGIN
    -- Получаем данные резервирования
    SELECT warehouse_id, product_id, quantity
    INTO v_warehouse_id, v_product_id, v_quantity
    FROM stock_reservations
    WHERE id = p_reservation_id
        AND status = 'active';

    -- Если резервирование не найдено
    IF v_warehouse_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Освобождаем резервирование
    UPDATE stock_reservations
    SET status = 'released',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_reservation_id;

    -- Уменьшаем зарезервированное количество
    UPDATE warehouse_product_links
    SET reserved_quantity = reserved_quantity - v_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE warehouse_id = v_warehouse_id
        AND product_id = v_product_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Функция для создания движения товара
CREATE OR REPLACE FUNCTION create_warehouse_movement(
    p_warehouse_id UUID,
    p_product_id UUID,
    p_movement_type VARCHAR,
    p_quantity DECIMAL,
    p_reference_type VARCHAR DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_unit_cost DECIMAL DEFAULT NULL,
    p_currency VARCHAR DEFAULT 'RUB',
    p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_movement_id UUID;
BEGIN
    -- Создаем движение
    INSERT INTO warehouse_movements (
        from_warehouse_id,
        to_warehouse_id,
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        description,
        unit_cost,
        currency,
        user_id
    ) VALUES (
        CASE WHEN p_quantity < 0 THEN p_warehouse_id ELSE NULL END,
        CASE WHEN p_quantity > 0 THEN p_warehouse_id ELSE NULL END,
        p_product_id,
        p_movement_type,
        p_quantity,
        p_reference_type,
        p_reference_id,
        p_description,
        p_unit_cost,
        p_currency,
        p_created_by
    ) RETURNING id INTO v_movement_id;

    -- Обновляем остаток на складе
    INSERT INTO warehouse_product_links (warehouse_id, product_id, quantity, unit_cost, currency)
    VALUES (p_warehouse_id, p_product_id, p_quantity, p_unit_cost, p_currency)
    ON CONFLICT (warehouse_id, product_id)
    DO UPDATE SET
        quantity = warehouse_product_links.quantity + EXCLUDED.quantity,
        unit_cost = COALESCE(EXCLUDED.unit_cost, warehouse_product_links.unit_cost),
        currency = EXCLUDED.currency,
        updated_at = CURRENT_TIMESTAMP;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ПРЕДСТАВЛЕНИЕ: v_product_total_stock - Общие остатки товаров
-- ================================================================
CREATE VIEW v_product_total_stock AS
SELECT
    wpl.product_id,
    SUM(wpl.quantity) as total_quantity,
    SUM(wpl.available_quantity) as available_quantity,
    COUNT(DISTINCT wpl.warehouse_id) as warehouse_count,
    AVG(wpl.quantity) as avg_quantity
FROM warehouse_product_links wpl
WHERE wpl.quantity > 0
GROUP BY wpl.product_id;

COMMENT ON VIEW v_product_total_stock IS 'Представление для получения общих остатков товаров по всем складам';
COMMENT ON COLUMN v_product_total_stock.product_id IS 'ID товара';
COMMENT ON COLUMN v_product_total_stock.total_quantity IS 'Общее количество товара на всех складах';
COMMENT ON COLUMN v_product_total_stock.available_quantity IS 'Доступное количество товара на всех складах';
COMMENT ON COLUMN v_product_total_stock.warehouse_count IS 'Количество складов, где есть товар';
COMMENT ON COLUMN v_product_total_stock.avg_quantity IS 'Среднее количество товара на склад';

-- Функция для пересчета остатков мульти-склада
CREATE OR REPLACE FUNCTION recalculate_multi_warehouse_stock(p_multi_warehouse_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_component_warehouse_id UUID;
    v_product_id UUID;
    v_total_quantity DECIMAL;
    v_total_available DECIMAL;
    v_total_reserved DECIMAL;
    v_avg_cost DECIMAL;
BEGIN
    -- Получаем все компонентные склады
    FOR v_component_warehouse_id IN
        SELECT component_warehouse_id
        FROM multi_warehouse_components
        WHERE multi_warehouse_id = p_multi_warehouse_id
            AND is_active = TRUE
    LOOP
        -- Для каждого товара на компонентном складе
        FOR v_product_id IN
            SELECT DISTINCT product_id
            FROM warehouse_product_links
            WHERE warehouse_id = v_component_warehouse_id
                AND is_active = TRUE
        LOOP
            -- Суммируем остатки по всем компонентным складам
            SELECT
                COALESCE(SUM(quantity), 0),
                COALESCE(SUM(available_quantity), 0),
                COALESCE(SUM(reserved_quantity), 0),
                COALESCE(AVG(unit_cost), 0)
            INTO v_total_quantity, v_total_available, v_total_reserved, v_avg_cost
            FROM warehouse_product_links wpl
            JOIN multi_warehouse_components mwc ON wpl.warehouse_id = mwc.component_warehouse_id
            WHERE mwc.multi_warehouse_id = p_multi_warehouse_id
                AND wpl.product_id = v_product_id
                AND wpl.is_active = TRUE
                AND mwc.is_active = TRUE;

            -- Обновляем или создаем запись в мульти-складе
            INSERT INTO warehouse_product_links (
                warehouse_id, product_id, quantity, available_quantity,
                reserved_quantity, unit_cost, last_updated
            ) VALUES (
                p_multi_warehouse_id, v_product_id, v_total_quantity,
                v_total_available, v_total_reserved, v_avg_cost, CURRENT_TIMESTAMP
            )
            ON CONFLICT (warehouse_id, product_id)
            DO UPDATE SET
                quantity = EXCLUDED.quantity,
                available_quantity = EXCLUDED.available_quantity,
                reserved_quantity = EXCLUDED.reserved_quantity,
                unit_cost = EXCLUDED.unit_cost,
                last_updated = CURRENT_TIMESTAMP;
        END LOOP;
    END LOOP;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 005
-- ================================================================