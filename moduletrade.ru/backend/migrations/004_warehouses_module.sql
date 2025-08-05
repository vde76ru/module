-- ========================================
-- МИГРАЦИЯ 004: СКЛАДЫ И УПРАВЛЕНИЕ ОСТАТКАМИ
-- Модуль управления складами, остатками и движениями товаров
-- ========================================

-- ========================================
-- СКЛАДЫ
-- ========================================

CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Основная информация
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL, -- уникальный код склада в рамках компании
    description TEXT,
    
    -- Тип склада
    type VARCHAR(50) DEFAULT 'physical',
    -- Возможные значения: physical, virtual, dropship, consignment, rental
    
    -- Адрес склада
    address JSONB DEFAULT '{}',
    -- Пример: {"country": "RU", "city": "Москва", "street": "ул. Складская, 1", "postal_code": "123456"}
    
    -- Контактная информация
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Рабочее время
    working_hours JSONB DEFAULT '{}',
    -- Пример: {"monday": "9:00-18:00", "tuesday": "9:00-18:00", ...}
    
    -- Технические характеристики
    total_area DECIMAL(10,2), -- общая площадь в кв.м
    storage_area DECIMAL(10,2), -- складская площадь в кв.м
    max_weight_capacity DECIMAL(12,3), -- максимальная грузоподъемность в тоннах
    
    -- Возможности склада
    capabilities JSONB DEFAULT '[]',
    -- Пример: ["frozen_storage", "hazmat", "fragile_items", "oversized_items"]
    
    -- Настройки склада
    settings JSONB DEFAULT '{}',
    -- Пример: {"auto_reserve": true, "allow_negative_stock": false, "use_locations": true}
    
    -- Приоритет склада (для автоматического выбора)
    priority INTEGER DEFAULT 0,
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE, -- основной склад компании
    
    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

CREATE INDEX idx_warehouses_company_id ON warehouses(company_id);
CREATE INDEX idx_warehouses_code ON warehouses(code);
CREATE INDEX idx_warehouses_type ON warehouses(type);
CREATE INDEX idx_warehouses_is_active ON warehouses(is_active);
CREATE INDEX idx_warehouses_is_default ON warehouses(is_default);
CREATE INDEX idx_warehouses_priority ON warehouses(priority);

-- ========================================
-- ЗОНЫ И ЯЧЕЙКИ СКЛАДА
-- ========================================

CREATE TABLE warehouse_locations (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    
    -- Иерархия: зона -> стеллаж -> полка -> ячейка
    parent_id INTEGER REFERENCES warehouse_locations(id) ON DELETE CASCADE,
    
    -- Основная информация
    name VARCHAR(255) NOT NULL, -- A, A-01, A-01-05, A-01-05-01
    code VARCHAR(100) NOT NULL, -- полный код ячейки
    description TEXT,
    
    -- Тип локации
    location_type VARCHAR(50) NOT NULL,
    -- Возможные значения: zone, aisle, rack, shelf, bin
    
    -- Координаты (для навигации)
    coordinates JSONB DEFAULT '{}',
    -- Пример: {"x": 10.5, "y": 25.0, "z": 2.0}
    
    -- Характеристики
    max_weight DECIMAL(10,3), -- максимальный вес в кг
    max_volume DECIMAL(10,3), -- максимальный объем в куб.м
    temperature_range JSONB DEFAULT '{}',
    -- Пример: {"min": -18, "max": -15}
    
    -- Специальные условия
    special_conditions JSONB DEFAULT '[]',
    -- Пример: ["frozen", "fragile", "hazmat", "high_value"]
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_pickable BOOLEAN DEFAULT TRUE, -- можно ли отбирать товар из этой ячейки
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(warehouse_id, code)
);

CREATE INDEX idx_warehouse_locations_warehouse_id ON warehouse_locations(warehouse_id);
CREATE INDEX idx_warehouse_locations_parent_id ON warehouse_locations(parent_id);
CREATE INDEX idx_warehouse_locations_code ON warehouse_locations(code);
CREATE INDEX idx_warehouse_locations_type ON warehouse_locations(location_type);
CREATE INDEX idx_warehouse_locations_is_active ON warehouse_locations(is_active);

-- ========================================
-- ОСТАТКИ ТОВАРОВ НА СКЛАДАХ
-- ========================================

CREATE TABLE warehouse_stocks (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL,
    
    -- Остатки
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    available_quantity DECIMAL(10,3) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    
    -- Минимальные и максимальные остатки для данного склада
    min_stock_level DECIMAL(10,3) DEFAULT 0,
    max_stock_level DECIMAL(10,3),
    reorder_point DECIMAL(10,3),
    
    -- Статус остатков
    stock_status VARCHAR(50) DEFAULT 'normal',
    -- Возможные значения: normal, low_stock, out_of_stock, excess, quarantine
    
    -- Информация о последних движениях
    last_movement_date TIMESTAMP WITH TIME ZONE,
    last_count_date TIMESTAMP WITH TIME ZONE, -- дата последней инвентаризации
    
    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(warehouse_id, product_id, location_id)
);

CREATE INDEX idx_warehouse_stocks_warehouse_id ON warehouse_stocks(warehouse_id);
CREATE INDEX idx_warehouse_stocks_product_id ON warehouse_stocks(product_id);
CREATE INDEX idx_warehouse_stocks_location_id ON warehouse_stocks(location_id);
CREATE INDEX idx_warehouse_stocks_quantity ON warehouse_stocks(quantity);
CREATE INDEX idx_warehouse_stocks_available_quantity ON warehouse_stocks(available_quantity);
CREATE INDEX idx_warehouse_stocks_stock_status ON warehouse_stocks(stock_status);

-- ========================================
-- ДВИЖЕНИЯ ТОВАРОВ
-- ========================================

CREATE TABLE warehouse_movements (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    
    -- Тип движения
    movement_type VARCHAR(50) NOT NULL,
    -- Возможные значения: receipt, shipment, transfer_in, transfer_out, adjustment, return, write_off
    
    -- Количество (положительное для поступления, отрицательное для списания)
    quantity DECIMAL(10,3) NOT NULL,
    
    -- Остаток после движения
    balance_after DECIMAL(10,3),
    
    -- Локации
    from_location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL,
    to_location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL,
    
    -- Финансовая информация
    unit_cost DECIMAL(12,2),
    total_cost DECIMAL(12,2) GENERATED ALWAYS AS (ABS(quantity) * COALESCE(unit_cost, 0)) STORED,
    
    -- Связанные документы
    document_type VARCHAR(100), -- purchase_order, sales_order, transfer, adjustment, inventory
    document_id INTEGER, -- ID связанного документа
    document_number VARCHAR(255), -- номер документа
    
    -- Дополнительная информация
    reason VARCHAR(255), -- причина движения
    description TEXT,
    
    -- Связь с пользователем
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Склад назначения (для перемещений между складами)
    target_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
    
    -- Партия/серия
    batch_number VARCHAR(100),
    expiry_date DATE,
    
    -- Статус движения
    status VARCHAR(50) DEFAULT 'completed',
    -- Возможные значения: pending, completed, cancelled, reversed
    
    -- Даты
    planned_date DATE,
    actual_date DATE DEFAULT CURRENT_DATE,
    
    -- Метаданные
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_warehouse_movements_warehouse_id ON warehouse_movements(warehouse_id);
CREATE INDEX idx_warehouse_movements_product_id ON warehouse_movements(product_id);
CREATE INDEX idx_warehouse_movements_movement_type ON warehouse_movements(movement_type);
CREATE INDEX idx_warehouse_movements_document ON warehouse_movements(document_type, document_id);
CREATE INDEX idx_warehouse_movements_user_id ON warehouse_movements(user_id);
CREATE INDEX idx_warehouse_movements_actual_date ON warehouse_movements(actual_date);
CREATE INDEX idx_warehouse_movements_status ON warehouse_movements(status);

-- ========================================
-- ЗАДАЧИ СКЛАДА
-- ========================================

CREATE TABLE warehouse_tasks (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    
    -- Тип задачи
    task_type VARCHAR(50) NOT NULL,
    -- Возможные значения: pick, pack, receive, count, relocate, check
    
    -- Приоритет (чем больше, тем выше приоритет)
    priority INTEGER DEFAULT 0,
    
    -- Статус задачи
    status VARCHAR(50) DEFAULT 'pending',
    -- Возможные значения: pending, assigned, in_progress, completed, cancelled, error
    
    -- Исполнитель
    assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Детали задачи
    task_data JSONB DEFAULT '{}',
    -- Пример для задачи pick: {"products": [{"id": 1, "quantity": 5, "location": "A-01-05"}]}
    
    -- Связанные документы
    source_document_type VARCHAR(100), -- sales_order, transfer, inventory
    source_document_id INTEGER,
    
    -- Плановые и фактические данные
    planned_start TIMESTAMP WITH TIME ZONE,
    planned_duration INTEGER, -- планируемая длительность в минутах
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    actual_duration INTEGER GENERATED ALWAYS AS (
        CASE WHEN actual_start IS NOT NULL AND actual_end IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (actual_end - actual_start)) / 60 
        ELSE NULL END
    ) STORED,
    
    -- Результат выполнения
    completion_notes TEXT,
    completion_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_warehouse_tasks_warehouse_id ON warehouse_tasks(warehouse_id);
CREATE INDEX idx_warehouse_tasks_assigned_user_id ON warehouse_tasks(assigned_user_id);
CREATE INDEX idx_warehouse_tasks_task_type ON warehouse_tasks(task_type);
CREATE INDEX idx_warehouse_tasks_status ON warehouse_tasks(status);
CREATE INDEX idx_warehouse_tasks_priority ON warehouse_tasks(priority);
CREATE INDEX idx_warehouse_tasks_source_document ON warehouse_tasks(source_document_type, source_document_id);

-- ========================================
-- ИНВЕНТАРИЗАЦИЯ
-- ========================================

CREATE TABLE inventory_counts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    
    -- Основная информация
    count_number VARCHAR(100) NOT NULL,
    count_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Тип инвентаризации
    count_type VARCHAR(50) DEFAULT 'full',
    -- Возможные значения: full, partial, cycle, spot
    
    -- Статус инвентаризации
    status VARCHAR(50) DEFAULT 'planned',
    -- Возможные значения: planned, in_progress, completed, cancelled
    
    -- Даты
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Ответственные
    responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Результаты
    total_items_planned INTEGER DEFAULT 0,
    total_items_counted INTEGER DEFAULT 0,
    total_discrepancies INTEGER DEFAULT 0,
    
    -- Примечания
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, count_number)
);

CREATE INDEX idx_inventory_counts_company_id ON inventory_counts(company_id);
CREATE INDEX idx_inventory_counts_warehouse_id ON inventory_counts(warehouse_id);
CREATE INDEX idx_inventory_counts_status ON inventory_counts(status);
CREATE INDEX idx_inventory_counts_planned_start_date ON inventory_counts(planned_start_date);

-- ========================================
-- ПОЗИЦИИ ИНВЕНТАРИЗАЦИИ
-- ========================================

CREATE TABLE inventory_count_items (
    id SERIAL PRIMARY KEY,
    inventory_count_id INTEGER REFERENCES inventory_counts(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL,
    
    -- Ожидаемое количество (по системе)
    expected_quantity DECIMAL(10,3) NOT NULL,
    
    -- Фактически посчитанное количество
    counted_quantity DECIMAL(10,3),
    
    -- Расхождение
    discrepancy DECIMAL(10,3) GENERATED ALWAYS AS (
        COALESCE(counted_quantity, 0) - expected_quantity
    ) STORED,
    
    -- Статус подсчета
    count_status VARCHAR(50) DEFAULT 'pending',
    -- Возможные значения: pending, counted, discrepancy, adjusted, skipped
    
    -- Информация о подсчете
    counted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    counted_at TIMESTAMP WITH TIME ZONE,
    
    -- Причина расхождения
    discrepancy_reason VARCHAR(255),
    notes TEXT,
    
    -- Была ли применена корректировка
    adjustment_applied BOOLEAN DEFAULT FALSE,
    adjustment_movement_id BIGINT REFERENCES warehouse_movements(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_count_items_inventory_count_id ON inventory_count_items(inventory_count_id);
CREATE INDEX idx_inventory_count_items_product_id ON inventory_count_items(product_id);
CREATE INDEX idx_inventory_count_items_location_id ON inventory_count_items(location_id);
CREATE INDEX idx_inventory_count_items_count_status ON inventory_count_items(count_status);
CREATE INDEX idx_inventory_count_items_discrepancy ON inventory_count_items(discrepancy);

-- ========================================
-- ПЕРЕМЕЩЕНИЯ МЕЖДУ СКЛАДАМИ
-- ========================================

CREATE TABLE warehouse_transfers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    from_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE RESTRICT,
    to_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE RESTRICT,
    
    -- Номер перемещения
    transfer_number VARCHAR(100) NOT NULL,
    
    -- Статус перемещения
    status VARCHAR(50) DEFAULT 'draft',
    -- Возможные значения: draft, sent, in_transit, received, completed, cancelled
    
    -- Даты
    transfer_date DATE DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Ответственные
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sent_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    received_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Транспортировка
    transport_type VARCHAR(100), -- courier, transport_company, self_delivery
    transport_details JSONB DEFAULT '{}',
    tracking_number VARCHAR(255),
    
    -- Общая информация
    total_items_count INTEGER DEFAULT 0,
    total_weight DECIMAL(10,3),
    
    -- Примечания
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, transfer_number)
);

CREATE INDEX idx_warehouse_transfers_company_id ON warehouse_transfers(company_id);
CREATE INDEX idx_warehouse_transfers_from_warehouse_id ON warehouse_transfers(from_warehouse_id);
CREATE INDEX idx_warehouse_transfers_to_warehouse_id ON warehouse_transfers(to_warehouse_id);
CREATE INDEX idx_warehouse_transfers_status ON warehouse_transfers(status);
CREATE INDEX idx_warehouse_transfers_transfer_date ON warehouse_transfers(transfer_date);

-- ========================================
-- ПОЗИЦИИ ПЕРЕМЕЩЕНИЙ
-- ========================================

CREATE TABLE warehouse_transfer_items (
    id SERIAL PRIMARY KEY,
    warehouse_transfer_id INTEGER REFERENCES warehouse_transfers(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
    
    -- Количество
    quantity DECIMAL(10,3) NOT NULL,
    
    -- Локации
    from_location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL,
    to_location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL,
    
    -- Фактические данные при получении
    received_quantity DECIMAL(10,3),
    discrepancy DECIMAL(10,3) GENERATED ALWAYS AS (
        COALESCE(received_quantity, 0) - quantity
    ) STORED,
    
    -- Партия/серия
    batch_number VARCHAR(100),
    expiry_date DATE,
    
    -- Примечания
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_warehouse_transfer_items_warehouse_transfer_id ON warehouse_transfer_items(warehouse_transfer_id);
CREATE INDEX idx_warehouse_transfer_items_product_id ON warehouse_transfer_items(product_id);
CREATE INDEX idx_warehouse_transfer_items_from_location_id ON warehouse_transfer_items(from_location_id);
CREATE INDEX idx_warehouse_transfer_items_to_location_id ON warehouse_transfer_items(to_location_id);

-- ========================================
-- ДОБАВЛЕНИЕ ВНЕШНИХ КЛЮЧЕЙ К СУЩЕСТВУЮЩИМ ТАБЛИЦАМ
-- ========================================

-- Добавляем связь с складом в таблицу поступлений товаров
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_goods_receipt_items_warehouse'
        AND table_name = 'goods_receipt_items'
    ) THEN
        ALTER TABLE goods_receipt_items
        ADD CONSTRAINT fk_goods_receipt_items_warehouse
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Добавляем связь основного поставщика в таблицу товаров
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_products_main_supplier'
        AND table_name = 'products'
    ) THEN
        ALTER TABLE products
        ADD CONSTRAINT fk_products_main_supplier
        FOREIGN KEY (main_supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Индексы для новых внешних ключей
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_warehouse_id ON goods_receipt_items(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_products_main_supplier_id ON products(main_supplier_id);

-- ========================================
-- ТРИГГЕРЫ
-- ========================================

-- Триггеры для updated_at
CREATE TRIGGER trigger_update_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_warehouse_locations_updated_at
    BEFORE UPDATE ON warehouse_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_warehouse_stocks_updated_at
    BEFORE UPDATE ON warehouse_stocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_warehouse_tasks_updated_at
    BEFORE UPDATE ON warehouse_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_inventory_counts_updated_at
    BEFORE UPDATE ON inventory_counts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_warehouse_transfers_updated_at
    BEFORE UPDATE ON warehouse_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ФУНКЦИИ ДЛЯ АВТОМАТИЗАЦИИ
-- ========================================

-- Функция для обновления остатков товаров
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
DECLARE
    total_stock DECIMAL(10,3);
    total_reserved DECIMAL(10,3);
BEGIN
    -- Вычисляем общие остатки товара по всем складам
    SELECT 
        COALESCE(SUM(quantity), 0),
        COALESCE(SUM(reserved_quantity), 0)
    INTO total_stock, total_reserved
    FROM warehouse_stocks ws
    JOIN warehouses w ON ws.warehouse_id = w.id
    WHERE ws.product_id = COALESCE(NEW.product_id, OLD.product_id)
      AND w.is_active = TRUE;
    
    -- Обновляем остатки в таблице товаров
    UPDATE products 
    SET 
        current_stock = total_stock,
        reserved_stock = total_reserved,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления остатков товаров
CREATE TRIGGER trigger_update_product_stock
    AFTER INSERT OR UPDATE OR DELETE ON warehouse_stocks
    FOR EACH ROW EXECUTE FUNCTION update_product_stock();

-- Функция для создания движения при изменении остатков
CREATE OR REPLACE FUNCTION create_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    movement_quantity DECIMAL(10,3);
    movement_type VARCHAR(50);
    current_user_id INTEGER;
BEGIN
    -- Получаем текущий user_id из контекста сессии
    current_user_id := NULLIF(current_setting('app.current_user_id', true), '')::INTEGER;
    
    IF TG_OP = 'INSERT' THEN
        -- При создании записи об остатках
        IF NEW.quantity != 0 THEN
            INSERT INTO warehouse_movements (
                warehouse_id, product_id, movement_type, quantity, 
                balance_after, user_id, reason
            ) VALUES (
                NEW.warehouse_id, NEW.product_id, 'adjustment', NEW.quantity,
                NEW.quantity, current_user_id, 'Initial stock'
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- При обновлении остатков
        movement_quantity := NEW.quantity - OLD.quantity;
        
        IF movement_quantity != 0 THEN
            movement_type := CASE 
                WHEN movement_quantity > 0 THEN 'adjustment'
                ELSE 'adjustment'
            END;
            
            INSERT INTO warehouse_movements (
                warehouse_id, product_id, movement_type, quantity,
                balance_after, user_id, reason
            ) VALUES (
                NEW.warehouse_id, NEW.product_id, movement_type, movement_quantity,
                NEW.quantity, current_user_id, 'Stock adjustment'
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- При удалении записи об остатках
        IF OLD.quantity != 0 THEN
            INSERT INTO warehouse_movements (
                warehouse_id, product_id, movement_type, quantity,
                balance_after, user_id, reason
            ) VALUES (
                OLD.warehouse_id, OLD.product_id, 'adjustment', -OLD.quantity,
                0, current_user_id, 'Stock record deleted'
            );
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Триггер для создания движений при изменении остатков
CREATE TRIGGER trigger_create_stock_movement
    AFTER INSERT OR UPDATE OF quantity OR DELETE ON warehouse_stocks
    FOR EACH ROW EXECUTE FUNCTION create_stock_movement();

-- Функция для генерации номеров документов
CREATE OR REPLACE FUNCTION generate_warehouse_document_number()
RETURNS TRIGGER AS $$
DECLARE
    company_prefix VARCHAR(10);
    next_number INTEGER;
    document_number_val VARCHAR(100);
    doc_prefix VARCHAR(10);
    table_name VARCHAR(50);
BEGIN
    -- Определяем тип документа и префикс
    table_name := TG_TABLE_NAME;
    
    CASE table_name
        WHEN 'inventory_counts' THEN 
            doc_prefix := 'INV';
            IF NEW.count_number IS NOT NULL THEN RETURN NEW; END IF;
        WHEN 'warehouse_transfers' THEN 
            doc_prefix := 'TR';
            IF NEW.transfer_number IS NOT NULL THEN RETURN NEW; END IF;
        ELSE 
            RETURN NEW;
    END CASE;
    
    -- Получаем префикс компании
    SELECT UPPER(LEFT(name, 3)) INTO company_prefix
    FROM companies WHERE id = NEW.company_id;
    
    -- Получаем следующий номер для текущего года
    EXECUTE format('
        SELECT COALESCE(MAX(CAST(SUBSTRING(%I FROM ''\d+$'') AS INTEGER)), 0) + 1
        FROM %I 
        WHERE company_id = $1 
          AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
          AND %I ~ $2
    ', 
    CASE table_name 
        WHEN 'inventory_counts' THEN 'count_number'
        WHEN 'warehouse_transfers' THEN 'transfer_number'
    END,
    table_name,
    CASE table_name 
        WHEN 'inventory_counts' THEN 'count_number'
        WHEN 'warehouse_transfers' THEN 'transfer_number'
    END
    ) INTO next_number
    USING NEW.company_id, 
          company_prefix || '-' || doc_prefix || '-' || EXTRACT(YEAR FROM NOW()) || '-\d+$';
    
    -- Формируем номер документа
    document_number_val := company_prefix || '-' || doc_prefix || '-' || 
                          EXTRACT(YEAR FROM NOW()) || '-' || LPAD(next_number::TEXT, 4, '0');
    
    -- Присваиваем номер
    CASE table_name
        WHEN 'inventory_counts' THEN NEW.count_number := document_number_val;
        WHEN 'warehouse_transfers' THEN NEW.transfer_number := document_number_val;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для автоматической генерации номеров документов
CREATE TRIGGER trigger_generate_inventory_count_number
    BEFORE INSERT ON inventory_counts
    FOR EACH ROW EXECUTE FUNCTION generate_warehouse_document_number();

CREATE TRIGGER trigger_generate_transfer_number
    BEFORE INSERT ON warehouse_transfers
    FOR EACH ROW EXECUTE FUNCTION generate_warehouse_document_number();

-- ========================================
-- ОГРАНИЧЕНИЯ И ПРОВЕРКИ
-- ========================================

-- Проверки для складов
ALTER TABLE warehouses ADD CONSTRAINT check_areas_positive
    CHECK (COALESCE(total_area, 0) >= 0 AND COALESCE(storage_area, 0) >= 0 AND 
           COALESCE(storage_area, 0) <= COALESCE(total_area, storage_area));

ALTER TABLE warehouses ADD CONSTRAINT check_only_one_default_warehouse
    EXCLUDE (company_id WITH =) WHERE (is_default = TRUE);

-- Проверки для остатков
ALTER TABLE warehouse_stocks ADD CONSTRAINT check_stock_quantities_non_negative
    CHECK (quantity >= 0 AND reserved_quantity >= 0);

-- Проверки для движений
ALTER TABLE warehouse_movements ADD CONSTRAINT check_movement_type_valid
    CHECK (movement_type IN ('receipt', 'shipment', 'transfer_in', 'transfer_out', 
                             'adjustment', 'return', 'write_off'));

-- Проверки для задач
ALTER TABLE warehouse_tasks ADD CONSTRAINT check_task_type_valid
    CHECK (task_type IN ('pick', 'pack', 'receive', 'count', 'relocate', 'check'));

-- Проверки для инвентаризации
ALTER TABLE inventory_count_items ADD CONSTRAINT check_expected_quantity_non_negative
    CHECK (expected_quantity >= 0);

-- Проверки для перемещений
ALTER TABLE warehouse_transfer_items ADD CONSTRAINT check_transfer_quantity_positive
    CHECK (quantity > 0);

ALTER TABLE warehouse_transfers ADD CONSTRAINT check_different_warehouses
    CHECK (from_warehouse_id != to_warehouse_id);