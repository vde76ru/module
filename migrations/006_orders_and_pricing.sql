-- ================================================================
-- МИГРАЦИЯ 006: Заказы и ценообразование (ИСПРАВЛЕНА)
-- Описание: Создает таблицы для управления заказами и ценообразованием
-- Дата: 2025-01-27
-- Блок: Заказы и Ценообразование
-- Зависимости: 002 (companies, users), 003 (suppliers), 004 (products), 005 (warehouses)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Orders - Заказы (ОБНОВЛЕНА)
-- ================================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    order_number VARCHAR(100) NOT NULL,
    external_order_number VARCHAR(100),
    internal_order_number VARCHAR(100),
    external_order_id VARCHAR(100),
    marketplace_order_id VARCHAR(100),
    marketplace_id UUID,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    order_type VARCHAR(50) DEFAULT 'retail', -- 'retail', 'business', 'wholesale'
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivery_date TIMESTAMP WITH TIME ZONE,
    shipping_date TIMESTAMP WITH TIME ZONE, -- Дата отгрузки
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'RUB',
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50),
    commission_amount DECIMAL(12,2) DEFAULT 0.00,
    shipping_address JSONB DEFAULT '{}'::jsonb,
    billing_address JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_auto_processed BOOLEAN DEFAULT FALSE, -- Автоматически обработан
    is_reserved BOOLEAN DEFAULT FALSE, -- Товары зарезервированы
    supplier_order_id VARCHAR(100), -- ID заказа у поставщика
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_orders_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_orders_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_orders_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE orders IS 'Заказы клиентов';
COMMENT ON COLUMN orders.company_id IS 'Компания';
COMMENT ON COLUMN orders.order_number IS 'Номер заказа';
COMMENT ON COLUMN orders.external_order_number IS 'Номер заказа во внешней системе';
COMMENT ON COLUMN orders.internal_order_number IS 'Внутренний номер заказа';
COMMENT ON COLUMN orders.external_order_id IS 'Внешний ID заказа';
COMMENT ON COLUMN orders.marketplace_order_id IS 'ID заказа на маркетплейсе';
COMMENT ON COLUMN orders.marketplace_id IS 'Маркетплейс';
COMMENT ON COLUMN orders.customer_name IS 'Имя клиента';
COMMENT ON COLUMN orders.customer_email IS 'Email клиента';
COMMENT ON COLUMN orders.customer_phone IS 'Телефон клиента';
COMMENT ON COLUMN orders.status IS 'Статус заказа: pending, confirmed, processing, shipped, delivered, cancelled';
COMMENT ON COLUMN orders.order_type IS 'Тип заказа: retail, business, wholesale';
COMMENT ON COLUMN orders.order_date IS 'Дата заказа';
COMMENT ON COLUMN orders.delivery_date IS 'Дата доставки';
COMMENT ON COLUMN orders.shipping_date IS 'Дата отгрузки';
COMMENT ON COLUMN orders.total_amount IS 'Общая сумма заказа';
COMMENT ON COLUMN orders.currency IS 'Валюта заказа';
COMMENT ON COLUMN orders.payment_status IS 'Статус оплаты: pending, paid, failed, refunded';
COMMENT ON COLUMN orders.payment_method IS 'Способ оплаты';
COMMENT ON COLUMN orders.commission_amount IS 'Сумма комиссии';
COMMENT ON COLUMN orders.shipping_address IS 'Адрес доставки';
COMMENT ON COLUMN orders.billing_address IS 'Адрес для выставления счета';
COMMENT ON COLUMN orders.notes IS 'Примечания к заказу';
COMMENT ON COLUMN orders.metadata IS 'Дополнительные данные';
COMMENT ON COLUMN orders.is_auto_processed IS 'Автоматически обработан';
COMMENT ON COLUMN orders.is_reserved IS 'Товары зарезервированы';
COMMENT ON COLUMN orders.supplier_order_id IS 'ID заказа у поставщика';
COMMENT ON COLUMN orders.created_by IS 'Пользователь, создавший заказ';

ALTER TABLE orders ADD CONSTRAINT orders_number_unique_per_company
    UNIQUE (company_id, order_number);

CREATE INDEX idx_orders_company_id ON orders (company_id);
CREATE INDEX idx_orders_order_number ON orders (order_number);
CREATE INDEX idx_orders_external_order_number ON orders (external_order_number);
CREATE INDEX idx_orders_internal_order_number ON orders (internal_order_number);
CREATE INDEX idx_orders_external_order_id ON orders (external_order_id);
CREATE INDEX idx_orders_marketplace_order_id ON orders (marketplace_order_id);
CREATE INDEX idx_orders_marketplace_id ON orders (marketplace_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_order_type ON orders (order_type);
CREATE INDEX idx_orders_order_date ON orders (order_date DESC);
CREATE INDEX idx_orders_shipping_date ON orders (shipping_date);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);
CREATE INDEX idx_orders_customer_email ON orders (customer_email);
CREATE INDEX idx_orders_is_auto_processed ON orders (is_auto_processed);
CREATE INDEX idx_orders_is_reserved ON orders (is_reserved);
CREATE INDEX idx_orders_created_by ON orders (created_by);
ALTER TABLE orders
    ADD CONSTRAINT ck_orders_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_company_public_id ON orders (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_orders_public_id
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Order_Items - Позиции заказов (ОБНОВЛЕНА)
-- ================================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    warehouse_id UUID, -- Склад для отгрузки
    quantity DECIMAL(12,3) NOT NULL,
    reserved_quantity DECIMAL(12,3) DEFAULT 0, -- Зарезервированное количество
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    cost_price DECIMAL(12,2), -- Себестоимость на момент продажи
    margin_amount DECIMAL(12,2), -- Маржа
    margin_percent DECIMAL(5,2), -- Процент маржи
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_order_items_order_id
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_warehouse_id
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE order_items IS 'Позиции заказов';
COMMENT ON COLUMN order_items.order_id IS 'Заказ';
COMMENT ON COLUMN order_items.product_id IS 'Товар';
COMMENT ON COLUMN order_items.warehouse_id IS 'Склад для отгрузки';
COMMENT ON COLUMN order_items.quantity IS 'Количество товара';
COMMENT ON COLUMN order_items.reserved_quantity IS 'Зарезервированное количество';
COMMENT ON COLUMN order_items.unit_price IS 'Цена за единицу';
COMMENT ON COLUMN order_items.total_price IS 'Общая стоимость позиции';
COMMENT ON COLUMN order_items.currency IS 'Валюта цены';
COMMENT ON COLUMN order_items.discount_percent IS 'Процент скидки';
COMMENT ON COLUMN order_items.discount_amount IS 'Сумма скидки';
COMMENT ON COLUMN order_items.cost_price IS 'Себестоимость на момент продажи';
COMMENT ON COLUMN order_items.margin_amount IS 'Маржа';
COMMENT ON COLUMN order_items.margin_percent IS 'Процент маржи';
COMMENT ON COLUMN order_items.notes IS 'Примечания к позиции';

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
CREATE INDEX idx_order_items_warehouse_id ON order_items (warehouse_id);
CREATE INDEX idx_order_items_unit_price ON order_items (unit_price);
CREATE INDEX idx_order_items_cost_price ON order_items (cost_price);
ALTER TABLE order_items
    ADD CONSTRAINT ck_order_items_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_items_public_id ON order_items (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_order_items_public_id
    BEFORE INSERT ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Order_Processing_Logs - Логи обработки заказов
-- ================================================================
CREATE TABLE order_processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    order_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'reserved', 'confirmed', 'shipped', 'delivered'
    status VARCHAR(50) NOT NULL,
    message TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_order_processing_logs_order_id
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_processing_logs_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE order_processing_logs IS 'Логи обработки заказов';
COMMENT ON COLUMN order_processing_logs.order_id IS 'Заказ';
COMMENT ON COLUMN order_processing_logs.action IS 'Действие';
COMMENT ON COLUMN order_processing_logs.status IS 'Статус';
COMMENT ON COLUMN order_processing_logs.message IS 'Сообщение';
COMMENT ON COLUMN order_processing_logs.details IS 'Детали';
COMMENT ON COLUMN order_processing_logs.user_id IS 'Пользователь';

CREATE INDEX idx_order_processing_logs_order_id ON order_processing_logs (order_id);
CREATE INDEX idx_order_processing_logs_action ON order_processing_logs (action);
CREATE INDEX idx_order_processing_logs_status ON order_processing_logs (status);
CREATE INDEX idx_order_processing_logs_created_at ON order_processing_logs (created_at);
ALTER TABLE order_processing_logs
    ADD CONSTRAINT ck_order_processing_logs_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_processing_logs_public_id ON order_processing_logs (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_order_processing_logs_public_id
    BEFORE INSERT ON order_processing_logs
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Supplier_Orders - Заказы у поставщиков
-- ================================================================
CREATE TABLE supplier_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    order_id UUID, -- добавить это поле
    supplier_id UUID NOT NULL,
    order_number VARCHAR(100) NOT NULL,
    external_order_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending', -- изменить с VARCHAR(20)
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'RUB',
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expected_delivery_date TIMESTAMP WITH TIME ZONE,
    actual_delivery_date TIMESTAMP WITH TIME ZONE,
    payment_terms VARCHAR(100), -- добавить
    payment_status VARCHAR(20) DEFAULT 'pending', -- добавить
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID, -- добавить
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_supplier_orders_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_orders_order_id
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_orders_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_orders_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE supplier_orders IS 'Заказы у поставщиков';
COMMENT ON COLUMN supplier_orders.company_id IS 'Компания';
COMMENT ON COLUMN supplier_orders.order_id IS 'Заказ';
COMMENT ON COLUMN supplier_orders.supplier_id IS 'Поставщик';
COMMENT ON COLUMN supplier_orders.order_number IS 'Номер заказа';
COMMENT ON COLUMN supplier_orders.external_order_number IS 'Номер заказа в системе поставщика';
COMMENT ON COLUMN supplier_orders.status IS 'Статус заказа: pending, confirmed, shipped, delivered, cancelled';
COMMENT ON COLUMN supplier_orders.total_amount IS 'Общая сумма заказа';
COMMENT ON COLUMN supplier_orders.currency IS 'Валюта заказа';
COMMENT ON COLUMN supplier_orders.order_date IS 'Дата заказа';
COMMENT ON COLUMN supplier_orders.expected_delivery_date IS 'Ожидаемая дата доставки';
COMMENT ON COLUMN supplier_orders.actual_delivery_date IS 'Фактическая дата доставки';
COMMENT ON COLUMN supplier_orders.payment_terms IS 'Условия оплаты';
COMMENT ON COLUMN supplier_orders.payment_status IS 'Статус оплаты: pending, paid, overdue';
COMMENT ON COLUMN supplier_orders.notes IS 'Примечания к заказу';
COMMENT ON COLUMN supplier_orders.metadata IS 'Дополнительные данные';
COMMENT ON COLUMN supplier_orders.created_by IS 'Пользователь, создавший заказ';

CREATE INDEX idx_supplier_orders_company_id ON supplier_orders (company_id);
CREATE INDEX idx_supplier_orders_order_id ON supplier_orders (order_id);
CREATE INDEX idx_supplier_orders_supplier_id ON supplier_orders (supplier_id);
CREATE INDEX idx_supplier_orders_order_number ON supplier_orders (order_number);
CREATE INDEX idx_supplier_orders_external_order_number ON supplier_orders (external_order_number);
CREATE INDEX idx_supplier_orders_status ON supplier_orders (status);
CREATE INDEX idx_supplier_orders_order_date ON supplier_orders (order_date DESC);
CREATE INDEX idx_supplier_orders_payment_status ON supplier_orders (payment_status);
CREATE INDEX idx_supplier_orders_expected_delivery ON supplier_orders (expected_delivery_date);
CREATE INDEX idx_supplier_orders_created_by ON supplier_orders (created_by);
ALTER TABLE supplier_orders
    ADD CONSTRAINT ck_supplier_orders_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_orders_company_public_id ON supplier_orders (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_supplier_orders_public_id
    BEFORE INSERT ON supplier_orders
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Supplier_Order_Items - Позиции заказов у поставщиков
-- ================================================================
CREATE TABLE supplier_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    supplier_order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    external_product_id VARCHAR(255),
    name VARCHAR(500), -- добавить
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB', -- оставить
    received_quantity DECIMAL(12,3) DEFAULT 0, -- добавить
    status VARCHAR(20) DEFAULT 'pending', -- добавить
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- добавить
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_supplier_order_items_supplier_order_id
        FOREIGN KEY (supplier_order_id) REFERENCES supplier_orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_order_items_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE supplier_order_items IS 'Позиции заказов у поставщиков';
COMMENT ON COLUMN supplier_order_items.supplier_order_id IS 'Заказ у поставщика';
COMMENT ON COLUMN supplier_order_items.product_id IS 'Товар';
COMMENT ON COLUMN supplier_order_items.external_product_id IS 'Внешний ID товара';
COMMENT ON COLUMN supplier_order_items.name IS 'Название товара';
COMMENT ON COLUMN supplier_order_items.quantity IS 'Количество';
COMMENT ON COLUMN supplier_order_items.unit_price IS 'Цена за единицу';
COMMENT ON COLUMN supplier_order_items.total_price IS 'Общая стоимость';
COMMENT ON COLUMN supplier_order_items.currency IS 'Валюта';
COMMENT ON COLUMN supplier_order_items.received_quantity IS 'Полученное количество';
COMMENT ON COLUMN supplier_order_items.status IS 'Статус позиции: pending, confirmed, shipped, received';
COMMENT ON COLUMN supplier_order_items.notes IS 'Примечания';
COMMENT ON COLUMN supplier_order_items.metadata IS 'Дополнительные данные';

CREATE INDEX idx_supplier_order_items_supplier_order_id ON supplier_order_items (supplier_order_id);
CREATE INDEX idx_supplier_order_items_product_id ON supplier_order_items (product_id);
CREATE INDEX idx_supplier_order_items_external_product_id ON supplier_order_items (external_product_id);
CREATE INDEX idx_supplier_order_items_status ON supplier_order_items (status);
ALTER TABLE supplier_order_items
    ADD CONSTRAINT ck_supplier_order_items_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_order_items_public_id ON supplier_order_items (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_supplier_order_items_public_id
    BEFORE INSERT ON supplier_order_items
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Price_Types - Типы цен
-- ================================================================
CREATE TABLE price_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    category VARCHAR(50),
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE price_types IS 'Типы цен для товаров';
COMMENT ON COLUMN price_types.name IS 'Название типа цены';
COMMENT ON COLUMN price_types.code IS 'Код типа цены';
COMMENT ON COLUMN price_types.display_name IS 'Отображаемое название';
COMMENT ON COLUMN price_types.description IS 'Описание типа цены';
COMMENT ON COLUMN price_types.category IS 'Категория цены';
COMMENT ON COLUMN price_types.is_system IS 'Системный тип цены';
COMMENT ON COLUMN price_types.is_active IS 'Активен ли тип цены';

CREATE INDEX idx_price_types_code ON price_types (code);
CREATE INDEX idx_price_types_category ON price_types (category);
CREATE INDEX idx_price_types_is_active ON price_types (is_active);
ALTER TABLE price_types
    ADD CONSTRAINT ck_price_types_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_types_public_id ON price_types (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_price_types_public_id
    BEFORE INSERT ON price_types
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Prices - Цены товаров
-- ================================================================
CREATE TABLE prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    product_id UUID NOT NULL,
    price_type_id UUID NOT NULL,
    price_type VARCHAR(50) NOT NULL,
    value DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    min_quantity DECIMAL(12,3) DEFAULT 1,
    max_quantity DECIMAL(12,3),
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP WITH TIME ZONE,
    markup_percent DECIMAL(5,2),
    margin_percent DECIMAL(5,2),
    competitor_price DECIMAL(12,2),
    is_active BOOLEAN DEFAULT TRUE,
    is_auto_calculated BOOLEAN DEFAULT FALSE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_prices_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_prices_price_type_id
        FOREIGN KEY (price_type_id) REFERENCES price_types(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_prices_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_prices_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE prices IS 'Цены товаров по типам';
COMMENT ON COLUMN prices.product_id IS 'Товар';
COMMENT ON COLUMN prices.price_type_id IS 'Тип цены';
COMMENT ON COLUMN prices.price_type IS 'Код типа цены';
COMMENT ON COLUMN prices.value IS 'Значение цены';
COMMENT ON COLUMN prices.currency IS 'Валюта цены';
COMMENT ON COLUMN prices.min_quantity IS 'Минимальное количество для цены';
COMMENT ON COLUMN prices.max_quantity IS 'Максимальное количество для цены';
COMMENT ON COLUMN prices.valid_from IS 'Дата начала действия цены';
COMMENT ON COLUMN prices.valid_to IS 'Дата окончания действия цены';
COMMENT ON COLUMN prices.markup_percent IS 'Процент наценки';
COMMENT ON COLUMN prices.margin_percent IS 'Процент маржи';
COMMENT ON COLUMN prices.competitor_price IS 'Цена конкурента';
COMMENT ON COLUMN prices.is_active IS 'Активна ли цена';
COMMENT ON COLUMN prices.is_auto_calculated IS 'Автоматически рассчитана ли цена';
COMMENT ON COLUMN prices.created_by IS 'Пользователь, создавший цену';
COMMENT ON COLUMN prices.updated_by IS 'Пользователь, обновивший цену';

CREATE INDEX idx_prices_product_id ON prices (product_id);
CREATE INDEX idx_prices_price_type_id ON prices (price_type_id);
CREATE INDEX idx_prices_price_type ON prices (price_type);
ALTER TABLE prices ADD CONSTRAINT prices_product_price_type_unique
    UNIQUE (product_id, price_type);
CREATE INDEX idx_prices_valid_from ON prices (valid_from);
CREATE INDEX idx_prices_valid_to ON prices (valid_to);
CREATE INDEX idx_prices_is_active ON prices (is_active);
ALTER TABLE prices
    ADD CONSTRAINT ck_prices_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prices_public_id ON prices (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_prices_public_id
    BEFORE INSERT ON prices
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Pricing_Rules - Правила ценообразования
-- ================================================================
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL,
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '{}'::jsonb,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_pricing_rules_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pricing_rules_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE pricing_rules IS 'Правила ценообразования';
COMMENT ON COLUMN pricing_rules.company_id IS 'Компания';
COMMENT ON COLUMN pricing_rules.name IS 'Название правила';
COMMENT ON COLUMN pricing_rules.description IS 'Описание правила';
COMMENT ON COLUMN pricing_rules.rule_type IS 'Тип правила: discount, markup, fixed_price';
COMMENT ON COLUMN pricing_rules.conditions IS 'Условия применения правила';
COMMENT ON COLUMN pricing_rules.actions IS 'Действия правила';
COMMENT ON COLUMN pricing_rules.priority IS 'Приоритет правила';
COMMENT ON COLUMN pricing_rules.is_active IS 'Активно ли правило';
COMMENT ON COLUMN pricing_rules.valid_from IS 'Дата начала действия';
COMMENT ON COLUMN pricing_rules.valid_until IS 'Дата окончания действия';
COMMENT ON COLUMN pricing_rules.created_by IS 'Пользователь, создавший правило';

CREATE INDEX idx_pricing_rules_company_id ON pricing_rules (company_id);
CREATE INDEX idx_pricing_rules_rule_type ON pricing_rules (rule_type);
CREATE INDEX idx_pricing_rules_priority ON pricing_rules (priority);
CREATE INDEX idx_pricing_rules_is_active ON pricing_rules (is_active);
CREATE INDEX idx_pricing_rules_valid_from ON pricing_rules (valid_from);
CREATE INDEX idx_pricing_rules_valid_until ON pricing_rules (valid_until);
ALTER TABLE pricing_rules
    ADD CONSTRAINT ck_pricing_rules_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_rules_company_public_id ON pricing_rules (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_pricing_rules_public_id
    BEFORE INSERT ON pricing_rules
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Product_Prices - Цены товаров (альтернативная)
-- ================================================================
CREATE TABLE product_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    product_id UUID NOT NULL,
    price_type VARCHAR(50) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_prices_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_prices_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE product_prices IS 'Цены товаров';
COMMENT ON COLUMN product_prices.product_id IS 'Товар';
COMMENT ON COLUMN product_prices.price_type IS 'Тип цены: base, sale, wholesale, retail';
COMMENT ON COLUMN product_prices.price IS 'Цена товара';
COMMENT ON COLUMN product_prices.currency IS 'Валюта цены';
COMMENT ON COLUMN product_prices.valid_from IS 'Дата начала действия цены';
COMMENT ON COLUMN product_prices.valid_until IS 'Дата окончания действия цены';
COMMENT ON COLUMN product_prices.is_active IS 'Активна ли цена';
COMMENT ON COLUMN product_prices.created_by IS 'Пользователь, создавший цену';

CREATE INDEX idx_product_prices_product_id ON product_prices (product_id);
CREATE INDEX idx_product_prices_price_type ON product_prices (price_type);
CREATE INDEX idx_product_prices_valid_from ON product_prices (valid_from);
CREATE INDEX idx_product_prices_valid_until ON product_prices (valid_until);
CREATE INDEX idx_product_prices_is_active ON product_prices (is_active);
ALTER TABLE product_prices
    ADD CONSTRAINT ck_product_prices_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_prices_public_id ON product_prices (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_product_prices_public_id
    BEFORE INSERT ON product_prices
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Price_History - История изменения цен
-- ================================================================
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    product_id UUID NOT NULL,
    old_price DECIMAL(12,2),
    new_price DECIMAL(12,2) NOT NULL,
    price_type VARCHAR(50) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    change_reason VARCHAR(100),
    user_id UUID,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    supplier_price DECIMAL(12,2),
    calculation_log TEXT,
    supplier_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_price_history_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_price_history_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE price_history IS 'История изменения цен товаров';
COMMENT ON COLUMN price_history.product_id IS 'Товар';
COMMENT ON COLUMN price_history.old_price IS 'Старая цена';
COMMENT ON COLUMN price_history.new_price IS 'Новая цена';
COMMENT ON COLUMN price_history.price_type IS 'Тип цены';
COMMENT ON COLUMN price_history.currency IS 'Валюта цены';
COMMENT ON COLUMN price_history.change_reason IS 'Причина изменения цены';
COMMENT ON COLUMN price_history.user_id IS 'Пользователь, изменивший цену';
COMMENT ON COLUMN price_history.changed_at IS 'Дата изменения цены';
COMMENT ON COLUMN price_history.supplier_price IS 'Цена поставщика';
COMMENT ON COLUMN price_history.calculation_log IS 'Лог расчета цены';
COMMENT ON COLUMN price_history.supplier_id IS 'ID поставщика';
COMMENT ON COLUMN price_history.metadata IS 'Дополнительные данные';

CREATE INDEX idx_price_history_product_id ON price_history (product_id);
CREATE INDEX idx_price_history_price_type ON price_history (price_type);
CREATE INDEX idx_price_history_changed_at ON price_history (changed_at DESC);
CREATE INDEX idx_price_history_user_id ON price_history (user_id);
ALTER TABLE price_history
    ADD CONSTRAINT ck_price_history_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_history_public_id ON price_history (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_price_history_public_id
    BEFORE INSERT ON price_history
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Discounts - Скидки
-- ================================================================
CREATE TABLE discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(50) NOT NULL,
    discount_value DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2),
    currency VARCHAR(3) DEFAULT 'RUB',
    conditions JSONB DEFAULT '{}'::jsonb,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_discounts_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_discounts_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE discounts IS 'Скидки';
COMMENT ON COLUMN discounts.company_id IS 'Компания';
COMMENT ON COLUMN discounts.name IS 'Название скидки';
COMMENT ON COLUMN discounts.description IS 'Описание скидки';
COMMENT ON COLUMN discounts.discount_type IS 'Тип скидки: fixed, percent';
COMMENT ON COLUMN discounts.discount_value IS 'Значение скидки';
COMMENT ON COLUMN discounts.discount_percent IS 'Процент скидки';
COMMENT ON COLUMN discounts.currency IS 'Валюта скидки';
COMMENT ON COLUMN discounts.conditions IS 'Условия применения скидки';
COMMENT ON COLUMN discounts.valid_from IS 'Дата начала действия';
COMMENT ON COLUMN discounts.valid_until IS 'Дата окончания действия';
COMMENT ON COLUMN discounts.is_active IS 'Активна ли скидка';
COMMENT ON COLUMN discounts.usage_limit IS 'Лимит использования';
COMMENT ON COLUMN discounts.used_count IS 'Количество использований';
COMMENT ON COLUMN discounts.created_by IS 'Пользователь, создавший скидку';

CREATE INDEX idx_discounts_company_id ON discounts (company_id);
CREATE INDEX idx_discounts_discount_type ON discounts (discount_type);
CREATE INDEX idx_discounts_valid_from ON discounts (valid_from);
CREATE INDEX idx_discounts_valid_until ON discounts (valid_until);
CREATE INDEX idx_discounts_is_active ON discounts (is_active);
ALTER TABLE discounts
    ADD CONSTRAINT ck_discounts_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_discounts_company_public_id ON discounts (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_discounts_public_id
    BEFORE INSERT ON discounts
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Marketplace_Product_Links - Связь товаров с маркетплейсами
-- ================================================================
CREATE TABLE marketplace_product_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    product_id UUID NOT NULL,
    marketplace_id UUID NOT NULL,
    external_product_id VARCHAR(255),
    external_sku VARCHAR(255),
    price DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'RUB',
    price_calculated_at TIMESTAMP WITH TIME ZONE,
    price_calculation_log TEXT,
    additional_expenses DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    sync_status VARCHAR(20) DEFAULT 'pending',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_marketplace_product_links_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_marketplace_product_links_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_marketplace_product_links_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE marketplace_product_links IS 'Связь товаров с маркетплейсами';
COMMENT ON COLUMN marketplace_product_links.company_id IS 'Компания';
COMMENT ON COLUMN marketplace_product_links.product_id IS 'Товар';
COMMENT ON COLUMN marketplace_product_links.marketplace_id IS 'Маркетплейс';
COMMENT ON COLUMN marketplace_product_links.external_product_id IS 'ID товара на маркетплейсе';
COMMENT ON COLUMN marketplace_product_links.external_sku IS 'SKU товара на маркетплейсе';
COMMENT ON COLUMN marketplace_product_links.price IS 'Цена товара на маркетплейсе';
COMMENT ON COLUMN marketplace_product_links.currency IS 'Валюта цены';
COMMENT ON COLUMN marketplace_product_links.price_calculated_at IS 'Дата расчета цены';
COMMENT ON COLUMN marketplace_product_links.price_calculation_log IS 'Лог расчета цены';
COMMENT ON COLUMN marketplace_product_links.additional_expenses IS 'Дополнительные расходы';
COMMENT ON COLUMN marketplace_product_links.is_active IS 'Активна ли связь';
COMMENT ON COLUMN marketplace_product_links.sync_status IS 'Статус синхронизации';
COMMENT ON COLUMN marketplace_product_links.last_sync_at IS 'Дата последней синхронизации';
COMMENT ON COLUMN marketplace_product_links.metadata IS 'Дополнительные данные';

CREATE INDEX idx_marketplace_product_links_company_id ON marketplace_product_links (company_id);
CREATE INDEX idx_marketplace_product_links_product_id ON marketplace_product_links (product_id);
CREATE INDEX idx_marketplace_product_links_marketplace_id ON marketplace_product_links (marketplace_id);
CREATE INDEX idx_marketplace_product_links_external_product_id ON marketplace_product_links (external_product_id);
CREATE INDEX idx_marketplace_product_links_external_sku ON marketplace_product_links (external_sku);
CREATE INDEX idx_marketplace_product_links_price ON marketplace_product_links (price);
CREATE INDEX idx_marketplace_product_links_is_active ON marketplace_product_links (is_active);
CREATE INDEX idx_marketplace_product_links_sync_status ON marketplace_product_links (sync_status);
ALTER TABLE marketplace_product_links
    ADD CONSTRAINT ck_marketplace_product_links_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_product_links_company_public_id
  ON marketplace_product_links (company_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_marketplace_product_links_public_id
    BEFORE INSERT ON marketplace_product_links
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Product_Suppliers - Поставщики товаров
-- ================================================================
CREATE TABLE product_suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    product_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    external_product_id VARCHAR(255),
    original_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    mrc_price DECIMAL(12,2),
    enforce_mrc BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    delivery_time_days INTEGER,
    minimum_order_quantity DECIMAL(12,3) DEFAULT 1,
    stock_quantity DECIMAL(12,3),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_suppliers_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_suppliers_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_suppliers_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_suppliers IS 'Поставщики товаров';
COMMENT ON COLUMN product_suppliers.company_id IS 'Компания';
COMMENT ON COLUMN product_suppliers.product_id IS 'Товар';
COMMENT ON COLUMN product_suppliers.supplier_id IS 'Поставщик';
COMMENT ON COLUMN product_suppliers.external_product_id IS 'ID товара у поставщика';
COMMENT ON COLUMN product_suppliers.original_price IS 'Оригинальная цена поставщика';
COMMENT ON COLUMN product_suppliers.currency IS 'Валюта цены';
COMMENT ON COLUMN product_suppliers.mrc_price IS 'Минимальная розничная цена';
COMMENT ON COLUMN product_suppliers.enforce_mrc IS 'Принудительно использовать МРЦ';
COMMENT ON COLUMN product_suppliers.is_available IS 'Доступен ли товар у поставщика';
COMMENT ON COLUMN product_suppliers.delivery_time_days IS 'Срок доставки в днях';
COMMENT ON COLUMN product_suppliers.minimum_order_quantity IS 'Минимальное количество для заказа';
COMMENT ON COLUMN product_suppliers.stock_quantity IS 'Количество на складе поставщика';
COMMENT ON COLUMN product_suppliers.last_updated IS 'Дата последнего обновления';
COMMENT ON COLUMN product_suppliers.metadata IS 'Дополнительные данные';

CREATE INDEX idx_product_suppliers_company_id ON product_suppliers (company_id);
CREATE INDEX idx_product_suppliers_product_id ON product_suppliers (product_id);
CREATE INDEX idx_product_suppliers_supplier_id ON product_suppliers (supplier_id);
CREATE INDEX idx_product_suppliers_external_product_id ON product_suppliers (external_product_id);
CREATE INDEX idx_product_suppliers_original_price ON product_suppliers (original_price);
CREATE INDEX idx_product_suppliers_is_available ON product_suppliers (is_available);
CREATE INDEX idx_product_suppliers_last_updated ON product_suppliers (last_updated);
ALTER TABLE product_suppliers
    ADD CONSTRAINT ck_product_suppliers_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_suppliers_company_public_id ON product_suppliers (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_product_suppliers_public_id
    BEFORE INSERT ON product_suppliers
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Exchange_Rates - Курсы валют
-- ================================================================
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    currency_code VARCHAR(3) NOT NULL,
    rate DECIMAL(12,6) NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT exchange_rates_currency_code_unique UNIQUE (currency_code)
);

COMMENT ON TABLE exchange_rates IS 'Курсы валют';
COMMENT ON COLUMN exchange_rates.currency_code IS 'Код валюты (USD, EUR, RUB и т.д.)';
COMMENT ON COLUMN exchange_rates.rate IS 'Курс валюты к рублю';
COMMENT ON COLUMN exchange_rates.source IS 'Источник курса: manual, api, etc.';
COMMENT ON COLUMN exchange_rates.is_active IS 'Активен ли курс';
COMMENT ON COLUMN exchange_rates.updated_at IS 'Дата обновления курса';

CREATE INDEX idx_exchange_rates_currency_code ON exchange_rates (currency_code);
CREATE INDEX idx_exchange_rates_is_active ON exchange_rates (is_active);
CREATE INDEX idx_exchange_rates_updated_at ON exchange_rates (updated_at DESC);
ALTER TABLE exchange_rates
    ADD CONSTRAINT ck_exchange_rates_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_rates_public_id ON exchange_rates (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_exchange_rates_public_id
    BEFORE INSERT ON exchange_rates
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ФУНКЦИИ
-- ================================================================

-- Функция для резервирования товаров заказа
CREATE OR REPLACE FUNCTION reserve_order_items(
    p_order_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_order_item RECORD;
    v_warehouse_stock RECORD;
    v_reserved_quantity DECIMAL(12,3);
    v_success BOOLEAN := TRUE;
BEGIN
    -- Получаем все позиции заказа
    FOR v_order_item IN
        SELECT * FROM order_items
        WHERE order_id = p_order_id
    LOOP
        -- Ищем склад с достаточным количеством товара
        SELECT * INTO v_warehouse_stock
        FROM warehouse_product_links
        WHERE product_id = v_order_item.product_id
          AND available_quantity >= v_order_item.quantity
          AND is_active = TRUE
        ORDER BY available_quantity DESC
        LIMIT 1;

        -- Если нашли склад с достаточным количеством
        IF v_warehouse_stock.id IS NOT NULL THEN
            -- Резервируем товар
            UPDATE warehouse_product_links
            SET
                reserved_quantity = reserved_quantity + v_order_item.quantity,
                available_quantity = available_quantity - v_order_item.quantity
            WHERE id = v_warehouse_stock.id;

            -- Обновляем позицию заказа
            UPDATE order_items
            SET
                warehouse_id = v_warehouse_stock.warehouse_id,
                reserved_quantity = v_order_item.quantity,
                cost_price = v_warehouse_stock.unit_cost
            WHERE id = v_order_item.id;

        ELSE
            -- Не удалось зарезервировать товар
            v_success := FALSE;
        END IF;
    END LOOP;

    -- Обновляем статус заказа
    IF v_success THEN
        UPDATE orders
        SET is_reserved = TRUE
        WHERE id = p_order_id;
    END IF;

    RETURN v_success;
END;
$$ LANGUAGE plpgsql;

-- Функция для освобождения резерва товаров
CREATE OR REPLACE FUNCTION release_order_reservation(
    p_order_id UUID
) RETURNS VOID AS $$
DECLARE
    v_order_item RECORD;
BEGIN
    -- Получаем все позиции заказа
    FOR v_order_item IN
        SELECT * FROM order_items
        WHERE order_id = p_order_id AND reserved_quantity > 0
    LOOP
        -- Освобождаем резерв
        UPDATE warehouse_product_links
        SET
            reserved_quantity = reserved_quantity - v_order_item.reserved_quantity,
            available_quantity = available_quantity + v_order_item.reserved_quantity
        WHERE warehouse_id = v_order_item.warehouse_id
          AND product_id = v_order_item.product_id;
    END LOOP;

    -- Обновляем статус заказа
    UPDATE orders
    SET is_reserved = FALSE
    WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для определения типа заказа
CREATE OR REPLACE FUNCTION determine_order_type(
    p_customer_email VARCHAR(255),
    p_customer_name VARCHAR(255),
    p_metadata JSONB
) RETURNS VARCHAR(50) AS $$
DECLARE
    v_order_type VARCHAR(50) := 'retail';
    v_email_domain VARCHAR(255);
BEGIN
    -- Проверяем email на корпоративные домены
    IF p_customer_email IS NOT NULL THEN
        v_email_domain := split_part(p_customer_email, '@', 2);

        -- Список корпоративных доменов
        IF v_email_domain IN ('company.com', 'business.ru', 'corp.net') THEN
            v_order_type := 'business';
        END IF;
    END IF;

    -- Проверяем метаданные на признаки бизнес-заказа
    IF p_metadata ? 'is_business' AND p_metadata->>'is_business' = 'true' THEN
        v_order_type := 'business';
    END IF;

    -- Проверяем имя на корпоративные признаки
    IF p_customer_name IS NOT NULL AND (
        p_customer_name ILIKE '%ООО%' OR
        p_customer_name ILIKE '%ИП%' OR
        p_customer_name ILIKE '%LLC%' OR
        p_customer_name ILIKE '%LTD%'
    ) THEN
        v_order_type := 'business';
    END IF;

    RETURN v_order_type;
END;
$$ LANGUAGE plpgsql;

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

CREATE TRIGGER update_supplier_orders_updated_at
    BEFORE UPDATE ON supplier_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_order_items_updated_at
    BEFORE UPDATE ON supplier_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для автоматического определения типа заказа
CREATE OR REPLACE FUNCTION auto_determine_order_type()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_type IS NULL OR NEW.order_type = 'retail' THEN
        NEW.order_type := determine_order_type(
            NEW.customer_email,
            NEW.customer_name,
            NEW.metadata
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_determine_order_type
    BEFORE INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_determine_order_type();

CREATE TRIGGER update_pricing_rules_updated_at
    BEFORE UPDATE ON pricing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_prices_updated_at
    BEFORE UPDATE ON product_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discounts_updated_at
    BEFORE UPDATE ON discounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_types_updated_at
    BEFORE UPDATE ON price_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prices_updated_at
    BEFORE UPDATE ON prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_product_links_updated_at
    BEFORE UPDATE ON marketplace_product_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_suppliers_updated_at
    BEFORE UPDATE ON product_suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 006
-- ================================================================