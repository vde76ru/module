-- ========================================
-- МИГРАЦИЯ 004: МОДУЛЬ СКЛАДОВ
-- Таблицы для управления физическими и виртуальными складами
-- Версия: 2.0
-- ========================================

-- ========================================
-- ФИЗИЧЕСКИЕ СКЛАДЫ
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
    contact_info JSONB DEFAULT '{}',
    -- Пример: {"manager": "Иван Петров", "phone": "+7123456789", "email": "warehouse@company.com"}

    -- Рабочие часы
    working_hours JSONB DEFAULT '{}',
    -- Пример: {"monday": "09:00-18:00", "saturday": "09:00-15:00", "sunday": "closed"}

    -- Характеристики склада
    total_area DECIMAL(10,2), -- общая площадь в м2
    storage_area DECIMAL(10,2), -- складская площадь в м2
    max_weight_capacity DECIMAL(12,3), -- максимальная грузоподъемность в кг

    -- Зоны хранения
    storage_zones JSONB DEFAULT '{}',
    -- Пример: {"A": {"description": "Быстрооборачиваемые товары", "capacity": 1000}, "B": {...}}

    -- Оборудование и возможности
    equipment JSONB DEFAULT '{}',
    -- Пример: {"forklift": true, "climate_control": true, "security_system": true}

    capabilities JSONB DEFAULT '{}',
    -- Пример: {"frozen_storage": false, "hazmat_storage": false, "oversized_items": true}

    -- Приоритет и настройки
    priority INTEGER DEFAULT 0, -- приоритет при выборе склада для размещения
    auto_allocation BOOLEAN DEFAULT TRUE, -- автоматическое размещение товаров

    -- Интеграции
    wms_integration JSONB DEFAULT '{}', -- интеграция с WMS системой
    -- Пример: {"system": "1C", "api_url": "...", "sync_enabled": true}

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE, -- склад по умолчанию

    -- Статистика
    total_products INTEGER DEFAULT 0,
    total_stock_value DECIMAL(12,2) DEFAULT 0,
    utilization_percent DECIMAL(5,2) DEFAULT 0, -- процент заполненности

    -- Метаданные
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, code)
);

COMMENT ON TABLE warehouses IS 'Физические и виртуальные склады';

-- ========================================
-- СВЯЗЬ ТОВАРОВ СО СКЛАДАМИ И ОСТАТКИ
-- ========================================

CREATE TABLE warehouse_product_links (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,

    -- Остатки
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(10,3) DEFAULT 0,
    available_quantity DECIMAL(10,3) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,

    -- Пороговые значения
    min_stock_level DECIMAL(10,3) DEFAULT 0, -- минимальный остаток
    max_stock_level DECIMAL(10,3), -- максимальный остаток
    reorder_point DECIMAL(10,3), -- точка перезаказа
    reorder_quantity DECIMAL(10,3), -- количество для перезаказа

    -- Размещение на складе
    location_zone VARCHAR(10), -- зона склада (A, B, C)
    location_row VARCHAR(10), -- ряд
    location_shelf VARCHAR(10), -- полка
    location_position VARCHAR(10), -- позиция
    location_full VARCHAR(100), -- полный адрес: "A-01-05-03"

    -- Характеристики размещения
    storage_requirements JSONB DEFAULT '{}',
    -- Пример: {"temperature_min": -5, "temperature_max": 25, "humidity_max": 60}

    -- Статистика движения
    last_receipt_date DATE,
    last_shipment_date DATE,
    total_receipts DECIMAL(12,3) DEFAULT 0,
    total_shipments DECIMAL(12,3) DEFAULT 0,

    -- Учетная информация
    cost_per_unit DECIMAL(12,2), -- себестоимость единицы
    total_cost DECIMAL(12,2), -- общая стоимость остатка

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Обновления
    last_count_date DATE, -- последняя инвентаризация
    last_movement TIMESTAMP WITH TIME ZONE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(warehouse_id, product_id)
);

COMMENT ON TABLE warehouse_product_links IS 'Связь товаров со складами и информация об остатках';

-- ========================================
-- ВИРТУАЛЬНЫЕ СКЛАДЫ
-- ========================================

CREATE TABLE virtual_warehouses (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Основная информация
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,

    -- Настройки виртуального склада
    warehouse_type VARCHAR(50) DEFAULT 'virtual',
    -- Возможные значения: virtual, aggregated, calculated, proxy

    -- Правила агрегации остатков
    aggregation_rules JSONB DEFAULT '{}',
    -- Пример: {"method": "sum", "include_reserved": false, "apply_coefficients": true}

    -- Частота обновления
    update_frequency VARCHAR(50) DEFAULT 'hourly',
    -- Возможные значения: realtime, hourly, daily, manual

    -- Источники данных
    data_sources JSONB DEFAULT '{}',
    -- Пример: {"physical_warehouses": [1,2,3], "suppliers": [10,11], "marketplaces": ["ozon", "wb"]}

    -- Фильтры и правила включения товаров
    inclusion_rules JSONB DEFAULT '{}',
    -- Пример: {"brands": [1,2,3], "categories": [5,6], "min_stock": 1, "exclude_discontinued": true}

    -- Коэффициенты для расчетов
    stock_coefficients JSONB DEFAULT '{}',
    -- Пример: {"safety_stock": 0.1, "supplier_reliability": 0.9, "seasonal_factor": 1.2}

    -- Приоритет и настройки
    priority INTEGER DEFAULT 0,
    auto_update BOOLEAN DEFAULT TRUE,

    -- Экспорт настройки
    export_enabled BOOLEAN DEFAULT TRUE,
    export_rules JSONB DEFAULT '{}',

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    last_update TIMESTAMP WITH TIME ZONE,
    update_in_progress BOOLEAN DEFAULT FALSE,

    -- Статистика
    total_products INTEGER DEFAULT 0,
    total_stock_items DECIMAL(12,3) DEFAULT 0,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, code)
);

COMMENT ON TABLE virtual_warehouses IS 'Виртуальные склады для агрегации остатков';

-- ========================================
-- СВЯЗИ ВИРТУАЛЬНЫХ СКЛАДОВ С ФИЗИЧЕСКИМИ
-- ========================================

CREATE TABLE virtual_warehouse_source_links (
    id SERIAL PRIMARY KEY,
    virtual_warehouse_id INTEGER REFERENCES virtual_warehouses(id) ON DELETE CASCADE,

    -- Тип источника
    source_type VARCHAR(50) NOT NULL, -- physical_warehouse, supplier, marketplace
    source_id INTEGER NOT NULL, -- ID склада, поставщика или настройки маркетплейса

    -- Правила включения
    include_all_products BOOLEAN DEFAULT TRUE,
    brand_filter INTEGER[], -- массив ID брендов для фильтрации
    category_filter INTEGER[], -- массив ID категорий для фильтрации
    custom_filter JSONB DEFAULT '{}', -- дополнительные фильтры

    -- Коэффициенты для расчетов
    stock_multiplier DECIMAL(5,2) DEFAULT 1.0, -- коэффициент для остатков
    priority INTEGER DEFAULT 0, -- приоритет источника

    -- Обработка данных
    data_mapping JSONB DEFAULT '{}', -- правила преобразования данных

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(virtual_warehouse_id, source_type, source_id)
);

COMMENT ON TABLE virtual_warehouse_source_links IS 'Связь виртуальных складов с источниками данных';

-- ========================================
-- ДВИЖЕНИЯ ТОВАРОВ
-- ========================================

CREATE TABLE warehouse_movements (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,

    -- Тип движения
    movement_type VARCHAR(50) NOT NULL,
    -- Возможные значения: receipt, shipment, transfer_in, transfer_out, adjustment, return, write_off

    -- Количество (положительное для поступления, отрицательное для списания)
    quantity DECIMAL(10,3) NOT NULL,

    -- Остаток после движения
    balance_after DECIMAL(10,3),

    -- Финансовая информация
    unit_cost DECIMAL(12,2),
    total_cost DECIMAL(12,2),

    -- Связанные документы
    document_type VARCHAR(100), -- order, transfer, adjustment, inventory
    document_id INTEGER, -- ID связанного документа
    document_number VARCHAR(255), -- номер документа

    -- Дополнительная информация
    reason VARCHAR(255), -- причина движения
    description TEXT,

    -- Связь с пользователем
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Склад назначения (для перемещений)
    target_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,

    -- Партия/серия
    batch_number VARCHAR(100),
    expiry_date DATE,

    -- Статус
    status VARCHAR(50) DEFAULT 'completed',
    -- Возможные значения: pending, completed, cancelled, reversed

    -- Даты
    planned_date DATE,
    actual_date DATE DEFAULT CURRENT_DATE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE warehouse_movements IS 'Движения товаров по складам';

-- ========================================
-- ЗАДАЧИ СКЛАДА (WAREHOUSE TASKS)
-- ========================================

CREATE TABLE warehouse_tasks (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,

    -- Тип задачи
    task_type VARCHAR(50) NOT NULL,
    -- Возможные значения: pick, pack, receive, count, relocate, check

    -- Приоритет
    priority INTEGER DEFAULT 0, -- чем больше, тем выше приоритет

    -- Статус задачи
    status VARCHAR(50) DEFAULT 'pending',
    -- Возможные значения: pending, in_progress, completed, cancelled, error

    -- Исполнитель
    assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Детали задачи
    task_data JSONB DEFAULT '{}',
    -- Пример для задачи pick: {"products": [{"id": 1, "quantity": 5, "location": "A-01-05"}]}

    -- Связанные документы
    source_document_type VARCHAR(100), -- order, transfer, inventory
    source_document_id INTEGER,

    -- Плановые и фактические данные
    planned_start TIMESTAMP WITH TIME ZONE,
    planned_duration INTEGER, -- планируемая длительность в минутах
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    actual_duration INTEGER, -- фактическая длительность в минутах

    -- Результат выполнения
    result_data JSONB DEFAULT '{}',
    error_message TEXT,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE warehouse_tasks IS 'Задачи для выполнения на складах';

-- ========================================
-- ИНВЕНТАРИЗАЦИЯ
-- ========================================

CREATE TABLE inventory_sessions (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Основная информация
    session_number VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Тип инвентаризации
    inventory_type VARCHAR(50) DEFAULT 'full',
    -- Возможные значения: full, partial, cycle, spot_check

    -- Область инвентаризации
    scope JSONB DEFAULT '{}',
    -- Пример: {"zones": ["A", "B"], "categories": [1,2,3], "products": [100,101,102]}

    -- Статус
    status VARCHAR(50) DEFAULT 'planned',
    -- Возможные значения: planned, in_progress, completed, cancelled

    -- Даты
    planned_start DATE NOT NULL,
    planned_end DATE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,

    -- Ответственные
    manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    participants INTEGER[], -- массив ID пользователей-участников

    -- Результаты
    total_items_planned INTEGER DEFAULT 0,
    total_items_counted INTEGER DEFAULT 0,
    discrepancies_found INTEGER DEFAULT 0,
    total_value_difference DECIMAL(12,2) DEFAULT 0,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(warehouse_id, session_number)
);

COMMENT ON TABLE inventory_sessions IS 'Сессии инвентаризации складов';

-- Детали инвентаризации по товарам
CREATE TABLE inventory_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES inventory_sessions(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,

    -- Ожидаемые данные (из системы)
    expected_quantity DECIMAL(10,3) DEFAULT 0,
    expected_location VARCHAR(100),
    expected_cost DECIMAL(12,2),

    -- Фактические данные (по результатам подсчета)
    actual_quantity DECIMAL(10,3),
    actual_location VARCHAR(100),
    actual_cost DECIMAL(12,2),

    -- Расхождения
    quantity_difference DECIMAL(10,3) GENERATED ALWAYS AS (COALESCE(actual_quantity, 0) - expected_quantity) STORED,
    cost_difference DECIMAL(12,2) GENERATED ALWAYS AS (COALESCE(actual_cost, 0) - COALESCE(expected_cost, 0)) STORED,

    -- Статус подсчета
    count_status VARCHAR(50) DEFAULT 'pending',
    -- Возможные значения: pending, counted, verified, discrepancy, not_found

    -- Кто считал
    counted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    counted_at TIMESTAMP WITH TIME ZONE,
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Объяснение расхождений
    discrepancy_reason VARCHAR(255),
    notes TEXT,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(session_id, product_id)
);

COMMENT ON TABLE inventory_items IS 'Детали инвентаризации по товарам';

-- ========================================
-- СОПОСТАВЛЕНИЯ СПРАВОЧНИКОВ
-- ========================================

-- Сопоставление брендов с внешними системами
CREATE TABLE brand_mappings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    internal_brand_id INTEGER REFERENCES internal_brands(id) ON DELETE CASCADE,

    -- Внешняя система
    external_system VARCHAR(100) NOT NULL, -- supplier_api, marketplace, erp_system, import
    external_system_id VARCHAR(255), -- ID системы (например, ID поставщика)

    -- Внешнее значение
    external_brand_name VARCHAR(255) NOT NULL,
    external_brand_code VARCHAR(255),

    -- Метаданные сопоставления
    mapping_type VARCHAR(50) DEFAULT 'manual', -- manual, auto, fuzzy, confirmed, ai
    confidence_score DECIMAL(3,2), -- уверенность в сопоставлении (0.00-1.00)
    mapping_algorithm VARCHAR(100), -- алгоритм сопоставления

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_confirmed BOOLEAN DEFAULT FALSE, -- подтверждено пользователем

    -- Кто создал/подтвердил
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, external_system, external_system_id, external_brand_name)
);

COMMENT ON TABLE brand_mappings IS 'Сопоставление внутренних брендов с внешними системами';

-- Сопоставление категорий с внешними системами
CREATE TABLE category_mappings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    internal_category_id INTEGER REFERENCES internal_categories(id) ON DELETE CASCADE,

    -- Внешняя система
    external_system VARCHAR(100) NOT NULL,
    external_system_id VARCHAR(255),

    -- Внешнее значение
    external_category_name VARCHAR(255) NOT NULL,
    external_category_code VARCHAR(255),
    external_category_path TEXT, -- полный путь во внешней системе

    -- Метаданные сопоставления
    mapping_type VARCHAR(50) DEFAULT 'manual',
    confidence_score DECIMAL(3,2),
    mapping_algorithm VARCHAR(100),

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_confirmed BOOLEAN DEFAULT FALSE,

    -- Кто создал/подтвердил
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, external_system, external_system_id, external_category_name)
);

COMMENT ON TABLE category_mappings IS 'Сопоставление внутренних категорий с внешними системами';

-- Сопоставление атрибутов с внешними системами
CREATE TABLE attribute_mappings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    internal_attribute_id INTEGER REFERENCES internal_attributes(id) ON DELETE CASCADE,

    -- Внешняя система
    external_system VARCHAR(100) NOT NULL,
    external_system_id VARCHAR(255),

    -- Внешнее значение
    external_attribute_name VARCHAR(255) NOT NULL,
    external_attribute_code VARCHAR(255),
    external_data_type VARCHAR(50),

    -- Правила преобразования значений
    value_transformation_rules JSONB DEFAULT '{}',
    -- Пример: {"unit_conversion": {"from": "mm", "to": "cm"}, "value_mapping": {"red": "красный"}}

    -- Метаданные сопоставления
    mapping_type VARCHAR(50) DEFAULT 'manual',
    confidence_score DECIMAL(3,2),
    mapping_algorithm VARCHAR(100),

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_confirmed BOOLEAN DEFAULT FALSE,

    -- Кто создал/подтвердил
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, external_system, external_system_id, external_attribute_name)
);

COMMENT ON TABLE attribute_mappings IS 'Сопоставление внутренних атрибутов с внешними системами';

-- ========================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ========================================

-- Индексы для физических складов
CREATE INDEX idx_warehouses_company_id ON warehouses(company_id);
CREATE INDEX idx_warehouses_code ON warehouses(code);
CREATE INDEX idx_warehouses_type ON warehouses(type);
CREATE INDEX idx_warehouses_is_active ON warehouses(is_active);
CREATE INDEX idx_warehouses_is_default ON warehouses(is_default);
CREATE INDEX idx_warehouses_priority ON warehouses(priority DESC);

-- Составные индексы для складов
CREATE INDEX idx_warehouses_company_active ON warehouses(company_id, is_active);

-- Индексы для связей товаров со складами
CREATE INDEX idx_warehouse_product_links_warehouse_id ON warehouse_product_links(warehouse_id);
CREATE INDEX idx_warehouse_product_links_product_id ON warehouse_product_links(product_id);
CREATE INDEX idx_warehouse_product_links_quantity ON warehouse_product_links(quantity);
CREATE INDEX idx_warehouse_product_links_available_quantity ON warehouse_product_links(available_quantity);
CREATE INDEX idx_warehouse_product_links_is_active ON warehouse_product_links(is_active);
CREATE INDEX idx_warehouse_product_links_location_zone ON warehouse_product_links(location_zone);

-- Составные индексы для остатков
CREATE INDEX idx_warehouse_product_links_warehouse_active ON warehouse_product_links(warehouse_id, is_active);
CREATE INDEX idx_warehouse_product_links_product_available ON warehouse_product_links(product_id, available_quantity) WHERE available_quantity > 0;

-- Индексы для виртуальных складов
CREATE INDEX idx_virtual_warehouses_company_id ON virtual_warehouses(company_id);
CREATE INDEX idx_virtual_warehouses_code ON virtual_warehouses(code);
CREATE INDEX idx_virtual_warehouses_type ON virtual_warehouses(warehouse_type);
CREATE INDEX idx_virtual_warehouses_is_active ON virtual_warehouses(is_active);
CREATE INDEX idx_virtual_warehouses_auto_update ON virtual_warehouses(auto_update);
CREATE INDEX idx_virtual_warehouses_last_update ON virtual_warehouses(last_update);

-- Индексы для связей виртуальных складов
CREATE INDEX idx_vw_source_links_virtual_warehouse ON virtual_warehouse_source_links(virtual_warehouse_id);
CREATE INDEX idx_vw_source_links_source ON virtual_warehouse_source_links(source_type, source_id);
CREATE INDEX idx_vw_source_links_is_active ON virtual_warehouse_source_links(is_active);
CREATE INDEX idx_vw_source_links_priority ON virtual_warehouse_source_links(priority DESC);

-- Индексы для движений
CREATE INDEX idx_warehouse_movements_company_id ON warehouse_movements(company_id);
CREATE INDEX idx_warehouse_movements_warehouse_id ON warehouse_movements(warehouse_id);
CREATE INDEX idx_warehouse_movements_product_id ON warehouse_movements(product_id);
CREATE INDEX idx_warehouse_movements_type ON warehouse_movements(movement_type);
CREATE INDEX idx_warehouse_movements_actual_date ON warehouse_movements(actual_date);
CREATE INDEX idx_warehouse_movements_status ON warehouse_movements(status);
CREATE INDEX idx_warehouse_movements_document ON warehouse_movements(document_type, document_id);

-- Составные индексы для движений
CREATE INDEX idx_warehouse_movements_warehouse_date ON warehouse_movements(warehouse_id, actual_date);
CREATE INDEX idx_warehouse_movements_product_date ON warehouse_movements(product_id, actual_date);

-- Индексы для задач склада
CREATE INDEX idx_warehouse_tasks_warehouse_id ON warehouse_tasks(warehouse_id);
CREATE INDEX idx_warehouse_tasks_type ON warehouse_tasks(task_type);
CREATE INDEX idx_warehouse_tasks_status ON warehouse_tasks(status);
CREATE INDEX idx_warehouse_tasks_priority ON warehouse_tasks(priority DESC);
CREATE INDEX idx_warehouse_tasks_assigned_user ON warehouse_tasks(assigned_user_id);
CREATE INDEX idx_warehouse_tasks_planned_start ON warehouse_tasks(planned_start);

-- Индексы для инвентаризации
CREATE INDEX idx_inventory_sessions_warehouse_id ON inventory_sessions(warehouse_id);
CREATE INDEX idx_inventory_sessions_company_id ON inventory_sessions(company_id);
CREATE INDEX idx_inventory_sessions_status ON inventory_sessions(status);
CREATE INDEX idx_inventory_sessions_planned_start ON inventory_sessions(planned_start);

CREATE INDEX idx_inventory_items_session_id ON inventory_items(session_id);
CREATE INDEX idx_inventory_items_product_id ON inventory_items(product_id);
CREATE INDEX idx_inventory_items_count_status ON inventory_items(count_status);
CREATE INDEX idx_inventory_items_discrepancy ON inventory_items(quantity_difference) WHERE quantity_difference != 0;

-- Индексы для сопоставлений
CREATE INDEX idx_brand_mappings_company_id ON brand_mappings(company_id);
CREATE INDEX idx_brand_mappings_internal_brand ON brand_mappings(internal_brand_id);
CREATE INDEX idx_brand_mappings_external_system ON brand_mappings(external_system, external_system_id);
CREATE INDEX idx_brand_mappings_external_name ON brand_mappings(external_brand_name);
CREATE INDEX idx_brand_mappings_is_active ON brand_mappings(is_active);
CREATE INDEX idx_brand_mappings_is_confirmed ON brand_mappings(is_confirmed);

CREATE INDEX idx_category_mappings_company_id ON category_mappings(company_id);
CREATE INDEX idx_category_mappings_internal_category ON category_mappings(internal_category_id);
CREATE INDEX idx_category_mappings_external_system ON category_mappings(external_system, external_system_id);
CREATE INDEX idx_category_mappings_external_name ON category_mappings(external_category_name);
CREATE INDEX idx_category_mappings_is_active ON category_mappings(is_active);
CREATE INDEX idx_category_mappings_is_confirmed ON category_mappings(is_confirmed);

CREATE INDEX idx_attribute_mappings_company_id ON attribute_mappings(company_id);
CREATE INDEX idx_attribute_mappings_internal_attribute ON attribute_mappings(internal_attribute_id);
CREATE INDEX idx_attribute_mappings_external_system ON attribute_mappings(external_system, external_system_id);
CREATE INDEX idx_attribute_mappings_external_name ON attribute_mappings(external_attribute_name);
CREATE INDEX idx_attribute_mappings_is_active ON attribute_mappings(is_active);
CREATE INDEX idx_attribute_mappings_is_confirmed ON attribute_mappings(is_confirmed);

-- ========================================
-- ТРИГГЕРЫ ДЛЯ АВТОМАТИЗАЦИИ
-- ========================================

-- Триггеры для обновления updated_at
CREATE TRIGGER trigger_update_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_warehouse_product_links_updated_at
    BEFORE UPDATE ON warehouse_product_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_virtual_warehouses_updated_at
    BEFORE UPDATE ON virtual_warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_virtual_warehouse_source_links_updated_at
    BEFORE UPDATE ON virtual_warehouse_source_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_warehouse_tasks_updated_at
    BEFORE UPDATE ON warehouse_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_inventory_sessions_updated_at
    BEFORE UPDATE ON inventory_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_brand_mappings_updated_at
    BEFORE UPDATE ON brand_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_category_mappings_updated_at
    BEFORE UPDATE ON category_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_attribute_mappings_updated_at
    BEFORE UPDATE ON attribute_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- СПЕЦИАЛЬНЫЕ ФУНКЦИИ
-- ========================================

-- Функция для создания движения товара при изменении остатков
CREATE OR REPLACE FUNCTION create_movement_on_stock_change()
RETURNS TRIGGER AS $$
DECLARE
    movement_type_val VARCHAR(50);
    quantity_change DECIMAL(10,3);
    user_id_val INTEGER;
BEGIN
    -- Определяем тип движения и изменение количества
    IF TG_OP = 'INSERT' THEN
        movement_type_val := 'receipt';
        quantity_change := NEW.quantity;
    ELSIF TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity THEN
        quantity_change := NEW.quantity - OLD.quantity;
        movement_type_val := CASE
            WHEN quantity_change > 0 THEN 'receipt'
            ELSE 'shipment'
        END;
    ELSE
        RETURN NEW; -- нет изменений в количестве
    END IF;

    -- Получаем ID пользователя из контекста
    BEGIN
        user_id_val := current_setting('app.current_user_id')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        user_id_val := NULL;
    END;

    -- Создаем запись движения
    INSERT INTO warehouse_movements (
        company_id, warehouse_id, product_id, movement_type,
        quantity, balance_after, user_id, reason, actual_date
    )
    SELECT
        w.company_id, NEW.warehouse_id, NEW.product_id, movement_type_val,
        quantity_change, NEW.quantity, user_id_val, 'stock_adjustment', CURRENT_DATE
    FROM warehouses w
    WHERE w.id = NEW.warehouse_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматического поиска соответствий брендов
CREATE OR REPLACE FUNCTION find_brand_matches(
    p_company_id INTEGER,
    p_external_brand_name VARCHAR,
    p_similarity_threshold DECIMAL DEFAULT 0.7
)
RETURNS TABLE (
    internal_brand_id INTEGER,
    internal_brand_name VARCHAR,
    similarity_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ib.id,
        ib.name,
        similarity(LOWER(ib.name), LOWER(p_external_brand_name))::DECIMAL(3,2)
    FROM internal_brands ib
    WHERE ib.is_active = TRUE
        AND similarity(LOWER(ib.name), LOWER(p_external_brand_name)) >= p_similarity_threshold
    ORDER BY similarity(LOWER(ib.name), LOWER(p_external_brand_name)) DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления статистики складов
CREATE OR REPLACE FUNCTION update_warehouse_stats()
RETURNS TRIGGER AS $$
DECLARE
    warehouse_id_val INTEGER;
    stats RECORD;
BEGIN
    -- Определяем ID склада
    IF TG_OP = 'DELETE' THEN
        warehouse_id_val := OLD.warehouse_id;
    ELSE
        warehouse_id_val := NEW.warehouse_id;
    END IF;

    -- Считаем статистику
    SELECT
        COUNT(*) as total_products,
        COALESCE(SUM(wpl.quantity * COALESCE(pp.amount, 0)), 0) as total_value,
        CASE
            WHEN w.storage_area > 0 THEN (COUNT(*) * 1.0 / w.storage_area * 100)
            ELSE 0
        END as utilization
    INTO stats
    FROM warehouse_product_links wpl
    JOIN warehouses w ON wpl.warehouse_id = w.id
    LEFT JOIN product_prices pp ON wpl.product_id = pp.product_id
        AND pp.price_type = 'purchase'
        AND pp.is_active = TRUE
    WHERE wpl.warehouse_id = warehouse_id_val
      AND wpl.is_active = TRUE
    GROUP BY w.storage_area;

    -- Обновляем статистику склада
    UPDATE warehouses
    SET
        total_products = COALESCE(stats.total_products, 0),
        total_stock_value = COALESCE(stats.total_value, 0),
        utilization_percent = COALESCE(stats.utilization, 0),
        updated_at = NOW()
    WHERE id = warehouse_id_val;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггеры
CREATE TRIGGER trigger_create_movement_on_stock_change
    AFTER INSERT OR UPDATE ON warehouse_product_links
    FOR EACH ROW EXECUTE FUNCTION create_movement_on_stock_change();

CREATE TRIGGER trigger_update_warehouse_stats
    AFTER INSERT OR UPDATE OR DELETE ON warehouse_product_links
    FOR EACH ROW EXECUTE FUNCTION update_warehouse_stats();

-- ========================================
-- ПРОВЕРКИ И ОГРАНИЧЕНИЯ
-- ========================================

-- Проверки для складов
ALTER TABLE warehouses ADD CONSTRAINT check_warehouse_type
    CHECK (type IN ('physical', 'virtual', 'dropship', 'consignment', 'rental'));

-- Проверки для движений
ALTER TABLE warehouse_movements ADD CONSTRAINT check_movement_type
    CHECK (movement_type IN ('receipt', 'shipment', 'transfer_in', 'transfer_out', 'adjustment', 'return', 'write_off', 'inventory'));

ALTER TABLE warehouse_movements ADD CONSTRAINT check_movement_status
    CHECK (status IN ('pending', 'completed', 'cancelled', 'reversed'));

-- Проверки для задач
ALTER TABLE warehouse_tasks ADD CONSTRAINT check_task_type
    CHECK (task_type IN ('pick', 'pack', 'receive', 'count', 'relocate', 'check', 'return', 'replenish'));

ALTER TABLE warehouse_tasks ADD CONSTRAINT check_task_status
    CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'error'));

-- Проверки для инвентаризации
ALTER TABLE inventory_sessions ADD CONSTRAINT check_inventory_type
    CHECK (inventory_type IN ('full', 'partial', 'cycle', 'spot_check'));

ALTER TABLE inventory_sessions ADD CONSTRAINT check_inventory_status
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE inventory_items ADD CONSTRAINT check_count_status
    CHECK (count_status IN ('pending', 'counted', 'verified', 'discrepancy', 'not_found'));

-- ========================================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ========================================

-- Представление текущих остатков по складам
CREATE VIEW current_warehouse_stock AS
SELECT
    w.id as warehouse_id,
    w.company_id,
    w.name as warehouse_name,
    w.code as warehouse_code,
    p.id as product_id,
    p.internal_code,
    p.name as product_name,
    wpl.quantity,
    wpl.reserved_quantity,
    wpl.available_quantity,
    wpl.location_full,
    wpl.min_stock_level,
    wpl.reorder_point,
    CASE
        WHEN wpl.available_quantity <= 0 THEN 'out_of_stock'
        WHEN wpl.available_quantity <= COALESCE(wpl.min_stock_level, 0) THEN 'low_stock'
        ELSE 'in_stock'
    END as stock_status,
    wpl.last_movement,
    wpl.updated_at
FROM warehouses w
JOIN warehouse_product_links wpl ON w.id = wpl.warehouse_id
JOIN products p ON wpl.product_id = p.id
WHERE w.is_active = TRUE
  AND wpl.is_active = TRUE
  AND p.is_active = TRUE;

COMMENT ON VIEW current_warehouse_stock IS 'Текущие остатки товаров по складам';

-- Представление сводки по складам
CREATE VIEW warehouse_summary AS
SELECT
    w.id,
    w.company_id,
    w.name,
    w.code,
    w.type,
    w.total_products,
    w.total_stock_value,
    w.utilization_percent,
    COUNT(wpl.id) as active_positions,
    COALESCE(SUM(wpl.quantity), 0) as total_quantity,
    COALESCE(SUM(wpl.available_quantity), 0) as total_available,
    COUNT(*) FILTER (WHERE wpl.available_quantity <= wpl.min_stock_level) as low_stock_items,
    COUNT(*) FILTER (WHERE wpl.available_quantity <= 0) as out_of_stock_items,
    w.is_active,
    w.updated_at
FROM warehouses w
LEFT JOIN warehouse_product_links wpl ON w.id = wpl.warehouse_id AND wpl.is_active = TRUE
WHERE w.is_active = TRUE
GROUP BY w.id;

COMMENT ON VIEW warehouse_summary IS 'Сводная информация по складам';