-- ================================================================
-- МИГРАЦИЯ 006: Заказы и ценообразование
-- Описание: Создает таблицы для управления заказами, позициями заказов и ценообразованием
-- Дата: 2025-01-27
-- Блок: Заказы и Ценообразование
-- Зависимости: 002 (companies), 003 (products), 004 (marketplaces), 005 (warehouses)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Orders - Заказы
-- ================================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    marketplace_id UUID,
    order_number VARCHAR(100) UNIQUE,
    external_order_id VARCHAR(255),
    internal_order_number VARCHAR(100),
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivery_date TIMESTAMP WITH TIME ZONE,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_info JSONB DEFAULT '{}'::jsonb,
    shipping_address JSONB DEFAULT '{}'::jsonb,
    billing_address JSONB DEFAULT '{}'::jsonb,
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'RUB',
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending',
    shipping_method VARCHAR(50),
    tracking_number VARCHAR(100),
    notes TEXT,
    marketplace_data JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'new',
    commission_amount DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

        CONSTRAINT fk_orders_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_orders_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE orders IS 'Заказы компаний';
COMMENT ON COLUMN orders.company_id IS 'Компания-владелец заказа';
COMMENT ON COLUMN orders.marketplace_id IS 'Маркетплейс, с которого поступил заказ';
COMMENT ON COLUMN orders.order_number IS 'Номер заказа';
COMMENT ON COLUMN orders.external_order_id IS 'ID заказа во внешней системе (маркетплейс)';
COMMENT ON COLUMN orders.internal_order_number IS 'Внутренний номер заказа';
COMMENT ON COLUMN orders.order_date IS 'Дата создания заказа';
COMMENT ON COLUMN orders.delivery_date IS 'Дата доставки';
COMMENT ON COLUMN orders.customer_name IS 'Имя клиента';
COMMENT ON COLUMN orders.customer_email IS 'Email клиента';
COMMENT ON COLUMN orders.customer_phone IS 'Телефон клиента';
COMMENT ON COLUMN orders.customer_info IS 'Дополнительная информация о клиенте';
COMMENT ON COLUMN orders.shipping_address IS 'Адрес доставки';
COMMENT ON COLUMN orders.billing_address IS 'Адрес для выставления счета';
COMMENT ON COLUMN orders.total_amount IS 'Общая сумма заказа';
COMMENT ON COLUMN orders.currency IS 'Валюта заказа';
COMMENT ON COLUMN orders.payment_method IS 'Способ оплаты';
COMMENT ON COLUMN orders.payment_status IS 'Статус оплаты: pending, paid, failed, refunded';
COMMENT ON COLUMN orders.shipping_method IS 'Способ доставки';
COMMENT ON COLUMN orders.tracking_number IS 'Номер отслеживания';
COMMENT ON COLUMN orders.notes IS 'Примечания к заказу';
COMMENT ON COLUMN orders.marketplace_data IS 'Данные от маркетплейса';
COMMENT ON COLUMN orders.status IS 'Статус заказа: new, processing, shipped, delivered, cancelled';
COMMENT ON COLUMN orders.commission_amount IS 'Сумма комиссии маркетплейса';

CREATE INDEX idx_orders_company_id ON orders (company_id);
CREATE INDEX idx_orders_marketplace_id ON orders (marketplace_id);
CREATE INDEX idx_orders_order_number ON orders (order_number);
CREATE INDEX idx_orders_external_order_id ON orders (external_order_id);
CREATE INDEX idx_orders_internal_order_number ON orders (internal_order_number);
CREATE INDEX idx_orders_order_date ON orders (order_date DESC);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);
CREATE INDEX idx_orders_customer_email ON orders (customer_email);
CREATE INDEX idx_orders_tracking_number ON orders (tracking_number);
CREATE INDEX idx_orders_company_status ON orders (company_id, status, order_date);

-- ================================================================
-- ТАБЛИЦА: Order_Items - Позиции заказов
-- ================================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    external_product_id VARCHAR(255),
    name VARCHAR(500),
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    shipping_amount DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'pending',
    warehouse_id UUID,
    tracking_number VARCHAR(100),
    notes TEXT,
    marketplace_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_order_items_order_id
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_warehouse_id
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE order_items IS 'Позиции заказов';
COMMENT ON COLUMN order_items.order_id IS 'Заказ';
COMMENT ON COLUMN order_items.product_id IS 'Товар';
COMMENT ON COLUMN order_items.external_product_id IS 'ID товара во внешней системе';
COMMENT ON COLUMN order_items.name IS 'Название товара в заказе';
COMMENT ON COLUMN order_items.quantity IS 'Количество товара';
COMMENT ON COLUMN order_items.unit_price IS 'Цена за единицу';
COMMENT ON COLUMN order_items.total_price IS 'Общая стоимость позиции';
COMMENT ON COLUMN order_items.discount_amount IS 'Сумма скидки';
COMMENT ON COLUMN order_items.tax_amount IS 'Сумма налога';
COMMENT ON COLUMN order_items.shipping_amount IS 'Стоимость доставки';
COMMENT ON COLUMN order_items.status IS 'Статус позиции: pending, processing, shipped, delivered, cancelled';
COMMENT ON COLUMN order_items.warehouse_id IS 'Склад отгрузки';
COMMENT ON COLUMN order_items.tracking_number IS 'Номер отслеживания';
COMMENT ON COLUMN order_items.notes IS 'Примечания к позиции';
COMMENT ON COLUMN order_items.marketplace_data IS 'Данные от маркетплейса';

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
CREATE INDEX idx_order_items_external_product_id ON order_items (external_product_id);
CREATE INDEX idx_order_items_status ON order_items (status);
CREATE INDEX idx_order_items_warehouse_id ON order_items (warehouse_id);
CREATE INDEX idx_order_items_tracking_number ON order_items (tracking_number);

-- ================================================================
-- ТАБЛИЦА: Prices - Цены товаров
-- ================================================================
CREATE TABLE prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    price_type VARCHAR(50) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    conditions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_prices_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE prices IS 'Цены товаров';
COMMENT ON COLUMN prices.product_id IS 'Товар';
COMMENT ON COLUMN prices.price_type IS 'Тип цены: retail, wholesale, sale, cost';
COMMENT ON COLUMN prices.price IS 'Цена товара';
COMMENT ON COLUMN prices.currency IS 'Валюта цены';
COMMENT ON COLUMN prices.valid_from IS 'Дата начала действия цены';
COMMENT ON COLUMN prices.valid_to IS 'Дата окончания действия цены';
COMMENT ON COLUMN prices.is_active IS 'Активна ли цена';
COMMENT ON COLUMN prices.conditions IS 'Условия применения цены';

CREATE INDEX idx_prices_product_id ON prices (product_id);
CREATE INDEX idx_prices_price_type ON prices (price_type);
CREATE INDEX idx_prices_valid_from ON prices (valid_from);
CREATE INDEX idx_prices_valid_to ON prices (valid_to);
CREATE INDEX idx_prices_is_active ON prices (is_active);
CREATE INDEX idx_prices_current ON prices (product_id, price_type, valid_from, valid_to)
    WHERE is_active = true;

-- ================================================================
-- ТАБЛИЦА: Price_Types - Типы цен
-- ================================================================
CREATE TABLE price_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE price_types IS 'Типы цен товаров';
COMMENT ON COLUMN price_types.name IS 'Название типа цены';
COMMENT ON COLUMN price_types.code IS 'Код типа цены';
COMMENT ON COLUMN price_types.description IS 'Описание типа цены';
COMMENT ON COLUMN price_types.is_system IS 'Системный тип цены';
COMMENT ON COLUMN price_types.is_active IS 'Активен ли тип цены';
COMMENT ON COLUMN price_types.sort_order IS 'Порядок сортировки';

CREATE INDEX idx_price_types_code ON price_types (code);
CREATE INDEX idx_price_types_is_active ON price_types (is_active);
CREATE INDEX idx_price_types_sort_order ON price_types (sort_order);

-- ================================================================
-- ТАБЛИЦА: Price_History - История изменений цен
-- ================================================================
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    price_type VARCHAR(50) NOT NULL,
    old_price DECIMAL(12,2),
    new_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    change_reason VARCHAR(100),
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_price_history_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_price_history_changed_by
        FOREIGN KEY (changed_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE price_history IS 'История изменений цен товаров';
COMMENT ON COLUMN price_history.product_id IS 'Товар';
COMMENT ON COLUMN price_history.price_type IS 'Тип цены';
COMMENT ON COLUMN price_history.old_price IS 'Старая цена';
COMMENT ON COLUMN price_history.new_price IS 'Новая цена';
COMMENT ON COLUMN price_history.currency IS 'Валюта цены';
COMMENT ON COLUMN price_history.change_reason IS 'Причина изменения цены';
COMMENT ON COLUMN price_history.changed_by IS 'Пользователь, изменивший цену';
COMMENT ON COLUMN price_history.changed_at IS 'Дата и время изменения';
COMMENT ON COLUMN price_history.metadata IS 'Дополнительные данные';

CREATE INDEX idx_price_history_product_id ON price_history (product_id);
CREATE INDEX idx_price_history_price_type ON price_history (price_type);
CREATE INDEX idx_price_history_changed_at ON price_history (changed_at DESC);
CREATE INDEX idx_price_history_changed_by ON price_history (changed_by);

-- ================================================================
-- ТАБЛИЦА: Incoming_Orders - Входящие заказы с маркетплейсов
-- ================================================================
CREATE TABLE incoming_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    marketplace_id UUID NOT NULL,
    external_order_id VARCHAR(255) NOT NULL,
    order_number VARCHAR(100),
    order_date TIMESTAMP WITH TIME ZONE,
    customer_info JSONB DEFAULT '{}'::jsonb,
    shipping_address JSONB DEFAULT '{}'::jsonb,
    billing_address JSONB DEFAULT '{}'::jsonb,
    total_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'RUB',
    commission_amount DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'new',
    sync_status VARCHAR(20) DEFAULT 'pending',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,
    marketplace_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_incoming_orders_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_incoming_orders_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE incoming_orders IS 'Входящие заказы с маркетплейсов';
COMMENT ON COLUMN incoming_orders.company_id IS 'Компания';
COMMENT ON COLUMN incoming_orders.marketplace_id IS 'Маркетплейс';
COMMENT ON COLUMN incoming_orders.external_order_id IS 'ID заказа на маркетплейсе';
COMMENT ON COLUMN incoming_orders.order_number IS 'Номер заказа';
COMMENT ON COLUMN incoming_orders.order_date IS 'Дата заказа';
COMMENT ON COLUMN incoming_orders.customer_info IS 'Информация о клиенте';
COMMENT ON COLUMN incoming_orders.shipping_address IS 'Адрес доставки';
COMMENT ON COLUMN incoming_orders.billing_address IS 'Адрес для выставления счета';
COMMENT ON COLUMN incoming_orders.total_amount IS 'Общая сумма заказа';
COMMENT ON COLUMN incoming_orders.currency IS 'Валюта заказа';
COMMENT ON COLUMN incoming_orders.commission_amount IS 'Сумма комиссии';
COMMENT ON COLUMN incoming_orders.status IS 'Статус заказа';
COMMENT ON COLUMN incoming_orders.sync_status IS 'Статус синхронизации';
COMMENT ON COLUMN incoming_orders.last_sync_at IS 'Дата последней синхронизации';
COMMENT ON COLUMN incoming_orders.sync_error IS 'Ошибка синхронизации';
COMMENT ON COLUMN incoming_orders.marketplace_data IS 'Данные от маркетплейса';

ALTER TABLE incoming_orders ADD CONSTRAINT incoming_orders_external_unique
    UNIQUE (company_id, marketplace_id, external_order_id);

CREATE INDEX idx_incoming_orders_company_id ON incoming_orders (company_id);
CREATE INDEX idx_incoming_orders_marketplace_id ON incoming_orders (marketplace_id);
CREATE INDEX idx_incoming_orders_external_order_id ON incoming_orders (external_order_id);
CREATE INDEX idx_incoming_orders_order_date ON incoming_orders (order_date DESC);
CREATE INDEX idx_incoming_orders_status ON incoming_orders (status);
CREATE INDEX idx_incoming_orders_sync_status ON incoming_orders (sync_status);

-- ================================================================
-- ТАБЛИЦА: Incoming_Order_Items - Позиции входящих заказов
-- ================================================================
CREATE TABLE incoming_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incoming_order_id UUID NOT NULL,
    external_product_id VARCHAR(255),
    product_id UUID,
    name VARCHAR(500),
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2),
    total_price DECIMAL(12,2),
    status VARCHAR(20) DEFAULT 'pending',
    marketplace_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_incoming_order_items_incoming_order_id
        FOREIGN KEY (incoming_order_id) REFERENCES incoming_orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_incoming_order_items_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE incoming_order_items IS 'Позиции входящих заказов';
COMMENT ON COLUMN incoming_order_items.incoming_order_id IS 'Входящий заказ';
COMMENT ON COLUMN incoming_order_items.external_product_id IS 'ID товара на маркетплейсе';
COMMENT ON COLUMN incoming_order_items.product_id IS 'Связанный товар в системе';
COMMENT ON COLUMN incoming_order_items.name IS 'Название товара';
COMMENT ON COLUMN incoming_order_items.quantity IS 'Количество товара';
COMMENT ON COLUMN incoming_order_items.unit_price IS 'Цена за единицу';
COMMENT ON COLUMN incoming_order_items.total_price IS 'Общая стоимость';
COMMENT ON COLUMN incoming_order_items.status IS 'Статус позиции';
COMMENT ON COLUMN incoming_order_items.marketplace_data IS 'Данные от маркетплейса';

CREATE INDEX idx_incoming_order_items_incoming_order_id ON incoming_order_items (incoming_order_id);
CREATE INDEX idx_incoming_order_items_external_product_id ON incoming_order_items (external_product_id);
CREATE INDEX idx_incoming_order_items_product_id ON incoming_order_items (product_id);
CREATE INDEX idx_incoming_order_items_status ON incoming_order_items (status);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prices_updated_at
    BEFORE UPDATE ON prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_types_updated_at
    BEFORE UPDATE ON price_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incoming_orders_updated_at
    BEFORE UPDATE ON incoming_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incoming_order_items_updated_at
    BEFORE UPDATE ON incoming_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С ЗАКАЗАМИ И ЦЕНАМИ
-- ================================================================

-- Функция для получения текущей цены товара
CREATE OR REPLACE FUNCTION get_current_price(
    p_product_id UUID,
    p_price_type VARCHAR DEFAULT 'retail'
) RETURNS DECIMAL AS $$
DECLARE
    v_price DECIMAL;
BEGIN
    SELECT price
    INTO v_price
    FROM prices
    WHERE product_id = p_product_id
        AND price_type = p_price_type
        AND is_active = true
        AND (valid_from IS NULL OR valid_from <= CURRENT_TIMESTAMP)
        AND (valid_to IS NULL OR valid_to > CURRENT_TIMESTAMP)
    ORDER BY valid_from DESC
    LIMIT 1;

    RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления цены товара с записью в историю
CREATE OR REPLACE FUNCTION update_product_price(
    p_product_id UUID,
    p_price_type VARCHAR,
    p_new_price DECIMAL,
    p_currency VARCHAR DEFAULT 'RUB',
    p_reason VARCHAR DEFAULT NULL,
    p_changed_by UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_price DECIMAL;
    v_price_id UUID;
BEGIN
    -- Получаем текущую цену
    SELECT price, id
    INTO v_old_price, v_price_id
    FROM prices
    WHERE product_id = p_product_id
        AND price_type = p_price_type
        AND is_active = true
        AND (valid_from IS NULL OR valid_from <= CURRENT_TIMESTAMP)
        AND (valid_to IS NULL OR valid_to > CURRENT_TIMESTAMP)
    ORDER BY valid_from DESC
    LIMIT 1;

    -- Если цена изменилась, записываем в историю
    IF v_old_price IS DISTINCT FROM p_new_price THEN
        INSERT INTO price_history (
            product_id,
            price_type,
            old_price,
            new_price,
            currency,
            change_reason,
            changed_by
        ) VALUES (
            p_product_id,
            p_price_type,
            v_old_price,
            p_new_price,
            p_currency,
            p_reason,
            p_changed_by
        );
    END IF;

    -- Если есть активная цена, деактивируем её
    IF v_price_id IS NOT NULL THEN
        UPDATE prices
        SET valid_to = CURRENT_TIMESTAMP,
            is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_price_id;
    END IF;

    -- Создаем новую цену
    INSERT INTO prices (
        product_id,
        price_type,
        price,
        currency,
        valid_from,
        is_active
    ) VALUES (
        p_product_id,
        p_price_type,
        p_new_price,
        p_currency,
        CURRENT_TIMESTAMP,
        true
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Функция для расчета общей суммы заказа
CREATE OR REPLACE FUNCTION calculate_order_total(p_order_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_total DECIMAL;
BEGIN
    SELECT COALESCE(SUM(total_price), 0)
    INTO v_total
    FROM order_items
    WHERE order_id = p_order_id;

    -- Обновляем общую сумму заказа
    UPDATE orders
    SET total_amount = v_total,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_order_id;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения заказов с низким остатком
CREATE OR REPLACE FUNCTION get_orders_with_low_stock(p_company_id UUID)
RETURNS TABLE (
    order_id UUID,
    order_number VARCHAR,
    product_id UUID,
    product_name VARCHAR,
    required_quantity DECIMAL,
    available_quantity DECIMAL,
    warehouse_id UUID,
    warehouse_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.order_number,
        oi.product_id,
        oi.name,
        oi.quantity,
        wpl.available_quantity,
        wpl.warehouse_id,
        w.name
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN warehouse_product_links wpl ON oi.product_id = wpl.product_id
    LEFT JOIN warehouses w ON wpl.warehouse_id = w.id
    WHERE o.company_id = p_company_id
        AND o.status IN ('new', 'processing')
        AND oi.status IN ('pending', 'processing')
        AND wpl.available_quantity < oi.quantity
        AND wpl.is_active = true
        AND w.is_active = true
    ORDER BY o.order_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Функция для резервирования товаров под заказ
CREATE OR REPLACE FUNCTION reserve_stock_for_order(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_order_item RECORD;
    v_warehouse_id UUID;
    v_available_quantity DECIMAL;
    v_reserved_quantity DECIMAL;
    v_success BOOLEAN := true;
BEGIN
    -- Проходим по всем позициям заказа
    FOR v_order_item IN
        SELECT oi.id, oi.product_id, oi.quantity, oi.warehouse_id
        FROM order_items oi
        WHERE oi.order_id = p_order_id
            AND oi.status IN ('pending', 'processing')
    LOOP
        -- Если склад не указан, выбираем склад с наибольшим остатком
        IF v_order_item.warehouse_id IS NULL THEN
            SELECT wpl.warehouse_id
            INTO v_warehouse_id
            FROM warehouse_product_links wpl
            WHERE wpl.product_id = v_order_item.product_id
                AND wpl.is_active = true
                AND wpl.available_quantity >= v_order_item.quantity
            ORDER BY wpl.available_quantity DESC
            LIMIT 1;
        ELSE
            v_warehouse_id := v_order_item.warehouse_id;
        END IF;

        -- Проверяем доступность товара
        IF v_warehouse_id IS NOT NULL THEN
            SELECT available_quantity, reserved_quantity
            INTO v_available_quantity, v_reserved_quantity
            FROM warehouse_product_links
            WHERE warehouse_id = v_warehouse_id
                AND product_id = v_order_item.product_id
                AND is_active = true;

            -- Если товара достаточно, резервируем
            IF v_available_quantity >= v_order_item.quantity THEN
                PERFORM reserve_stock(v_warehouse_id, v_order_item.product_id, v_order_item.quantity, v_order_item.id);

                -- Обновляем позицию заказа
                UPDATE order_items
                SET warehouse_id = v_warehouse_id,
                    status = 'processing',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = v_order_item.id;
            ELSE
                v_success := false;
            END IF;
        ELSE
            v_success := false;
        END IF;
    END LOOP;

    RETURN v_success;
END;
$$ LANGUAGE plpgsql;

-- Функция для отмены резервирования товаров заказа
CREATE OR REPLACE FUNCTION release_stock_for_order(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
    v_order_item RECORD;
BEGIN
    -- Проходим по всем позициям заказа
    FOR v_order_item IN
        SELECT oi.id, oi.product_id, oi.quantity, oi.warehouse_id
        FROM order_items oi
        WHERE oi.order_id = p_order_id
            AND oi.warehouse_id IS NOT NULL
    LOOP
        -- Освобождаем резерв
        PERFORM release_reservation(
            v_order_item.warehouse_id,
            v_order_item.product_id,
            v_order_item.quantity,
            v_order_item.id
        );

        -- Обновляем статус позиции
        UPDATE order_items
        SET status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_order_item.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 006
-- ================================================================