-- ================================================================
-- МИГРАЦИЯ 010: Дополнительные поля и таблицы
-- Описание: Добавляет недостающие поля в существующие таблицы и создает дополнительные таблицы
-- Дата: 2025-01-27
-- Блок: Дополнения и Улучшения
-- Зависимости: 003 (products), 004 (suppliers), 006 (orders), 009 (supplier_orders)
-- ================================================================

-- ================================================================
-- ДОБАВЛЕНИЕ ПОЛЕЙ В СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ
-- ================================================================

-- Добавление поля procurement_status в order_items
ALTER TABLE order_items ADD COLUMN procurement_status VARCHAR(20) DEFAULT 'pending';
COMMENT ON COLUMN order_items.procurement_status IS 'Статус закупки позиции: pending, ordered, shipped, received, cancelled';
CREATE INDEX idx_order_items_procurement_status ON order_items (procurement_status);

-- Добавление поля availability_status в product_suppliers
ALTER TABLE product_suppliers ADD COLUMN availability_status VARCHAR(20) DEFAULT 'available';
COMMENT ON COLUMN product_suppliers.availability_status IS 'Статус наличия товара у поставщика: available, out_of_stock, discontinued, limited';
CREATE INDEX idx_product_suppliers_availability_status ON product_suppliers (availability_status);

-- Алиасные поля удалены для устранения дублирования данных

-- ================================================================
-- ТАБЛИЦА: Procurement_Overrides - Переопределения закупок
-- ================================================================
CREATE TABLE procurement_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    order_item_id UUID NOT NULL,
    original_supplier_id UUID,
    new_supplier_id UUID,
    reason VARCHAR(255) NOT NULL,
    notes TEXT,
    created_by_user_id UUID NOT NULL,
    approved_by_user_id UUID,
    status VARCHAR(20) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_procurement_overrides_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_procurement_overrides_order_item_id
        FOREIGN KEY (order_item_id) REFERENCES order_items(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_procurement_overrides_original_supplier_id
        FOREIGN KEY (original_supplier_id) REFERENCES suppliers(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_procurement_overrides_new_supplier_id
        FOREIGN KEY (new_supplier_id) REFERENCES suppliers(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_procurement_overrides_created_by_user_id
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_procurement_overrides_approved_by_user_id
        FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE procurement_overrides IS 'Переопределения закупок (ручное изменение поставщиков)';
COMMENT ON COLUMN procurement_overrides.company_id IS 'Компания';
COMMENT ON COLUMN procurement_overrides.order_item_id IS 'Позиция заказа';
COMMENT ON COLUMN procurement_overrides.original_supplier_id IS 'Исходный поставщик';
COMMENT ON COLUMN procurement_overrides.new_supplier_id IS 'Новый поставщик';
COMMENT ON COLUMN procurement_overrides.reason IS 'Причина переопределения';
COMMENT ON COLUMN procurement_overrides.notes IS 'Дополнительные заметки';
COMMENT ON COLUMN procurement_overrides.created_by_user_id IS 'Пользователь, создавший переопределение';
COMMENT ON COLUMN procurement_overrides.approved_by_user_id IS 'Пользователь, утвердивший переопределение';
COMMENT ON COLUMN procurement_overrides.status IS 'Статус: pending, approved, rejected, applied';
COMMENT ON COLUMN procurement_overrides.metadata IS 'Дополнительные данные';

CREATE INDEX idx_procurement_overrides_company_id ON procurement_overrides (company_id);
CREATE INDEX idx_procurement_overrides_order_item_id ON procurement_overrides (order_item_id);
CREATE INDEX idx_procurement_overrides_original_supplier_id ON procurement_overrides (original_supplier_id);
CREATE INDEX idx_procurement_overrides_new_supplier_id ON procurement_overrides (new_supplier_id);
CREATE INDEX idx_procurement_overrides_created_by_user_id ON procurement_overrides (created_by_user_id);
CREATE INDEX idx_procurement_overrides_status ON procurement_overrides (status);
CREATE INDEX idx_procurement_overrides_created_at ON procurement_overrides (created_at DESC);

-- ================================================================
-- ТАБЛИЦА: Product_Mappings - Сопоставления товаров с внешними системами
-- ================================================================
CREATE TABLE product_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    system_type VARCHAR(50) NOT NULL,
    system_id VARCHAR(255) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    external_sku VARCHAR(255),
    external_name VARCHAR(500),
    mapping_data JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20),
    sync_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_mappings_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_mappings IS 'Сопоставления товаров с внешними системами';
COMMENT ON COLUMN product_mappings.product_id IS 'Товар в системе';
COMMENT ON COLUMN product_mappings.system_type IS 'Тип внешней системы: marketplace, supplier, warehouse';
COMMENT ON COLUMN product_mappings.system_id IS 'Идентификатор внешней системы';
COMMENT ON COLUMN product_mappings.external_id IS 'ID товара во внешней системе';
COMMENT ON COLUMN product_mappings.external_sku IS 'SKU товара во внешней системе';
COMMENT ON COLUMN product_mappings.external_name IS 'Название товара во внешней системе';
COMMENT ON COLUMN product_mappings.mapping_data IS 'Дополнительные данные сопоставления';
COMMENT ON COLUMN product_mappings.is_active IS 'Активно ли сопоставление';
COMMENT ON COLUMN product_mappings.last_sync_at IS 'Время последней синхронизации';
COMMENT ON COLUMN product_mappings.sync_status IS 'Статус синхронизации';
COMMENT ON COLUMN product_mappings.sync_error IS 'Ошибка синхронизации';

ALTER TABLE product_mappings ADD CONSTRAINT product_mappings_unique
    UNIQUE (product_id, system_type, system_id);
ALTER TABLE product_mappings ADD CONSTRAINT product_mappings_external_unique
    UNIQUE (system_type, system_id, external_id);

CREATE INDEX idx_product_mappings_product_id ON product_mappings (product_id);
CREATE INDEX idx_product_mappings_system_type ON product_mappings (system_type);
CREATE INDEX idx_product_mappings_system_id ON product_mappings (system_id);
CREATE INDEX idx_product_mappings_external_id ON product_mappings (external_id);
CREATE INDEX idx_product_mappings_external_sku ON product_mappings (external_sku);
CREATE INDEX idx_product_mappings_is_active ON product_mappings (is_active);
CREATE INDEX idx_product_mappings_last_sync_at ON product_mappings (last_sync_at);
CREATE INDEX idx_product_mappings_sync_status ON product_mappings (sync_status);

-- ================================================================
-- ТАБЛИЦА: Marketplace_Warehouses - Склады маркетплейсов
-- ================================================================
CREATE TABLE marketplace_warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    marketplace_id UUID NOT NULL,
    supplier_id UUID,
    warehouse_name VARCHAR(255) NOT NULL,
    warehouse_code VARCHAR(100),
    external_warehouse_id VARCHAR(255),
    address JSONB DEFAULT '{}'::jsonb,
    contact_info JSONB DEFAULT '{}'::jsonb,
    working_hours JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    commission_rate DECIMAL(5,2),
    settings JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_marketplace_warehouses_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_marketplace_warehouses_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_marketplace_warehouses_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE marketplace_warehouses IS 'Склады маркетплейсов';
COMMENT ON COLUMN marketplace_warehouses.company_id IS 'Компания';
COMMENT ON COLUMN marketplace_warehouses.marketplace_id IS 'Маркетплейс';
COMMENT ON COLUMN marketplace_warehouses.supplier_id IS 'Поставщик (если склад принадлежит поставщику)';
COMMENT ON COLUMN marketplace_warehouses.warehouse_name IS 'Название склада';
COMMENT ON COLUMN marketplace_warehouses.warehouse_code IS 'Код склада';
COMMENT ON COLUMN marketplace_warehouses.external_warehouse_id IS 'ID склада в системе маркетплейса';
COMMENT ON COLUMN marketplace_warehouses.address IS 'Адрес склада';
COMMENT ON COLUMN marketplace_warehouses.contact_info IS 'Контактная информация';
COMMENT ON COLUMN marketplace_warehouses.working_hours IS 'Часы работы склада';
COMMENT ON COLUMN marketplace_warehouses.is_active IS 'Активен ли склад';
COMMENT ON COLUMN marketplace_warehouses.is_default IS 'Является ли склад основным';
COMMENT ON COLUMN marketplace_warehouses.priority IS 'Приоритет склада';
COMMENT ON COLUMN marketplace_warehouses.commission_rate IS 'Ставка комиссии за использование склада';
COMMENT ON COLUMN marketplace_warehouses.settings IS 'Настройки склада';
COMMENT ON COLUMN marketplace_warehouses.metadata IS 'Дополнительные данные';

ALTER TABLE marketplace_warehouses ADD CONSTRAINT marketplace_warehouses_name_unique_per_marketplace
    UNIQUE (marketplace_id, warehouse_name);

CREATE INDEX idx_marketplace_warehouses_company_id ON marketplace_warehouses (company_id);
CREATE INDEX idx_marketplace_warehouses_marketplace_id ON marketplace_warehouses (marketplace_id);
CREATE INDEX idx_marketplace_warehouses_supplier_id ON marketplace_warehouses (supplier_id);
CREATE INDEX idx_marketplace_warehouses_warehouse_code ON marketplace_warehouses (warehouse_code);
CREATE INDEX idx_marketplace_warehouses_external_id ON marketplace_warehouses (external_warehouse_id);
CREATE INDEX idx_marketplace_warehouses_is_active ON marketplace_warehouses (is_active);
CREATE INDEX idx_marketplace_warehouses_is_default ON marketplace_warehouses (is_default);
CREATE INDEX idx_marketplace_warehouses_priority ON marketplace_warehouses (priority);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_procurement_overrides_updated_at
    BEFORE UPDATE ON procurement_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_mappings_updated_at
    BEFORE UPDATE ON product_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_warehouses_updated_at
    BEFORE UPDATE ON marketplace_warehouses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С MAPPINGS И OVERRIDES
-- ================================================================

-- Функция для получения сопоставления товара во внешней системе
CREATE OR REPLACE FUNCTION get_product_mapping(
    p_product_id UUID,
    p_system_type VARCHAR,
    p_system_id VARCHAR
)
RETURNS TABLE (
    external_id VARCHAR,
    external_sku VARCHAR,
    external_name VARCHAR,
    mapping_data JSONB,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pm.external_id,
        pm.external_sku,
        pm.external_name,
        pm.mapping_data,
        pm.is_active
    FROM product_mappings pm
    WHERE pm.product_id = p_product_id
        AND pm.system_type = p_system_type
        AND pm.system_id = p_system_id
        AND pm.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения активных переопределений закупок
CREATE OR REPLACE FUNCTION get_active_procurement_overrides(p_company_id UUID)
RETURNS TABLE (
    order_item_id UUID,
    original_supplier_name VARCHAR,
    new_supplier_name VARCHAR,
    reason VARCHAR,
    created_by_name VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        po.order_item_id,
        s1.name as original_supplier_name,
        s2.name as new_supplier_name,
        po.reason,
        u.name as created_by_name,
        po.created_at
    FROM procurement_overrides po
    LEFT JOIN suppliers s1 ON po.original_supplier_id = s1.id
    LEFT JOIN suppliers s2 ON po.new_supplier_id = s2.id
    LEFT JOIN users u ON po.created_by_user_id = u.id
    WHERE po.company_id = p_company_id
        AND po.status IN ('pending', 'approved', 'applied')
    ORDER BY po.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Функции и триггеры для синхронизации алиасных полей удалены

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 010
-- ================================================================