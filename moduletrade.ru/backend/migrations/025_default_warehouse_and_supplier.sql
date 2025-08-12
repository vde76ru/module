-- ===================================================
-- МИГРАЦИЯ: 025_default_warehouse_and_supplier.sql
-- СОЗДАНИЕ СКЛАДА И ПОСТАВЩИКА ПО УМОЛЧАНИЮ
-- ===================================================

-- Сначала добавляем недостающие поля в таблицы
-- Добавляем колонку is_default в таблицу warehouses, если её нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'warehouses' AND column_name = 'is_default'
    ) THEN
        ALTER TABLE warehouses ADD COLUMN is_default BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Добавляем колонку type в таблицу suppliers, если её нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'type'
    ) THEN
        ALTER TABLE suppliers ADD COLUMN type VARCHAR(50) DEFAULT 'external';
    END IF;
END $$;

-- Функция для создания склада по умолчанию
CREATE OR REPLACE FUNCTION create_default_warehouse(p_company_id UUID)
RETURNS UUID AS $$
DECLARE
    v_warehouse_id UUID;
BEGIN
    -- Проверяем, существует ли уже склад по умолчанию
    SELECT id INTO v_warehouse_id
    FROM warehouses
    WHERE company_id = p_company_id AND is_default = true
    LIMIT 1;
    
    -- Если склад по умолчанию уже существует, возвращаем его ID
    IF v_warehouse_id IS NOT NULL THEN
        RETURN v_warehouse_id;
    END IF;
    
    -- Создаем склад по умолчанию
    INSERT INTO warehouses (
        company_id,
        name,
        description,
        address,
        contact_person,
        phone,
        email,
        is_default,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        p_company_id,
        'Основной склад',
        'Основной склад компании для хранения товаров',
        'Адрес не указан',
        'Менеджер',
        '+7 (000) 000-00-00',
        'warehouse@company.com',
        true,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) RETURNING id INTO v_warehouse_id;
    
    RETURN v_warehouse_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для создания поставщика "Собственные остатки" по умолчанию
CREATE OR REPLACE FUNCTION create_default_supplier(p_company_id UUID)
RETURNS UUID AS $$
DECLARE
    v_supplier_id UUID;
BEGIN
    -- Проверяем, существует ли уже поставщик "Собственные остатки"
    SELECT id INTO v_supplier_id
    FROM suppliers
    WHERE company_id = p_company_id AND type = 'own_stock'
    LIMIT 1;
    
    -- Если поставщик уже существует, возвращаем его ID
    IF v_supplier_id IS NOT NULL THEN
        RETURN v_supplier_id;
    END IF;
    
    -- Создаем поставщика "Собственные остатки" с правильной структурой
    INSERT INTO suppliers (
        company_id,
        name,
        description,
        type,
        contact_info,
        website,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        p_company_id,
        'Собственные остатки',
        'Поставщик для управления собственными товарными остатками',
        'own_stock',
        jsonb_build_object(
            'contact_person', 'Менеджер',
            'phone', '+7 (000) 000-00-00',
            'email', 'stock@company.com',
            'address', 'Адрес не указан'
        ),
        NULL,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) RETURNING id INTO v_supplier_id;
    
    RETURN v_supplier_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для инициализации компании (создание склада и поставщика по умолчанию)
CREATE OR REPLACE FUNCTION initialize_company_defaults(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
    v_warehouse_id UUID;
    v_supplier_id UUID;
    v_action_type_id UUID;
BEGIN
    -- Создаем склад по умолчанию
    v_warehouse_id := create_default_warehouse(p_company_id);
    
    -- Создаем поставщика по умолчанию
    v_supplier_id := create_default_supplier(p_company_id);
    
    -- Получаем или создаем тип действия для аудита
    SELECT id INTO v_action_type_id
    FROM audit_action_types
    WHERE code = 'company.defaults.created';
    
    IF v_action_type_id IS NULL THEN
        INSERT INTO audit_action_types (name, code, description, category, severity, is_system)
        VALUES (
            'Создание настроек по умолчанию',
            'company.defaults.created',
            'Автоматическое создание склада и поставщика при регистрации компании',
            'system',
            'info',
            true
        )
        RETURNING id INTO v_action_type_id;
    END IF;
    
    -- Логируем создание в правильном формате
    INSERT INTO audit_logs (
        company_id,
        user_id,
        action_type_id,  -- Используем action_type_id вместо action
        entity_type,     -- Используем entity_type вместо table_name
        entity_id,       -- Используем entity_id вместо record_id
        old_values,
        new_values,
        ip_address,
        user_agent,
        description,
        created_at
    ) VALUES (
        p_company_id,
        NULL,
        v_action_type_id,
        'company_defaults',
        p_company_id,
        NULL,
        jsonb_build_object(
            'warehouse_id', v_warehouse_id,
            'supplier_id', v_supplier_id,
            'message', 'Созданы склад и поставщик по умолчанию'
        ),
        '127.0.0.1'::inet,  -- Системный IP
        'System Migration',
        'Автоматическое создание склада и поставщика по умолчанию для новой компании',
        CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического создания склада и поставщика при создании новой компании
CREATE OR REPLACE FUNCTION trigger_create_company_defaults()
RETURNS TRIGGER AS $$
BEGIN
    -- Вызываем функцию инициализации для новой компании
    PERFORM initialize_company_defaults(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер, если его еще нет
DROP TRIGGER IF EXISTS create_company_defaults_trigger ON companies;
CREATE TRIGGER create_company_defaults_trigger
    AFTER INSERT ON companies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_company_defaults();

-- Создаем индекс для быстрого поиска складов по умолчанию
CREATE INDEX IF NOT EXISTS idx_warehouses_company_default ON warehouses(company_id, is_default);

-- Создаем индекс для быстрого поиска поставщиков по типу
CREATE INDEX IF NOT EXISTS idx_suppliers_company_type ON suppliers(company_id, type);

-- Функция для обновления существующих компаний
CREATE OR REPLACE FUNCTION update_existing_companies()
RETURNS VOID AS $$
DECLARE
    v_company RECORD;
BEGIN
    -- Проходим по всем существующим компаниям
    FOR v_company IN SELECT id FROM companies LOOP
        -- Создаем склад и поставщика по умолчанию для каждой компании
        PERFORM initialize_company_defaults(v_company.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Выполняем обновление для существующих компаний
SELECT update_existing_companies();

-- Удаляем временную функцию
DROP FUNCTION update_existing_companies();

-- Комментарии к функциям
COMMENT ON FUNCTION create_default_warehouse(UUID) IS 'Создает склад по умолчанию для компании';
COMMENT ON FUNCTION create_default_supplier(UUID) IS 'Создает поставщика "Собственные остатки" по умолчанию для компании';
COMMENT ON FUNCTION initialize_company_defaults(UUID) IS 'Инициализирует компанию, создавая склад и поставщика по умолчанию';
COMMENT ON FUNCTION trigger_create_company_defaults() IS 'Триггер для автоматического создания склада и поставщика при создании компании';
