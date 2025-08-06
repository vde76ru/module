-- ================================================================
-- МИГРАЦИЯ 004: Интеграции и маркетплейсы
-- Описание: Создает таблицы для поставщиков, маркетплейсов и их интеграций
-- Дата: 2025-01-27
-- Блок: Интеграции и Маркетплейсы
-- Зависимости: 002 (companies)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Suppliers - Поставщики товаров
-- ================================================================
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    type VARCHAR(50) DEFAULT 'manual',
    description TEXT,
    contact_info JSONB DEFAULT '{}'::jsonb,
    website VARCHAR(255),
    api_url VARCHAR(255),
    api_type VARCHAR(50),
    api_config JSONB DEFAULT '{}'::jsonb,
    credentials JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    is_main BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    priority INTEGER DEFAULT 0,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20),
    last_sync_error TEXT,
    sync_stats JSONB DEFAULT '{}'::jsonb,
    external_warehouse_id VARCHAR(255),
    integration_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_suppliers_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE suppliers IS 'Поставщики товаров для компаний';
COMMENT ON COLUMN suppliers.company_id IS 'Компания-владелец поставщика';
COMMENT ON COLUMN suppliers.name IS 'Название поставщика';
COMMENT ON COLUMN suppliers.code IS 'Код поставщика';
COMMENT ON COLUMN suppliers.type IS 'Тип поставщика: manual, api, file';
COMMENT ON COLUMN suppliers.description IS 'Описание поставщика';
COMMENT ON COLUMN suppliers.contact_info IS 'Контактная информация поставщика';
COMMENT ON COLUMN suppliers.website IS 'Веб-сайт поставщика';
COMMENT ON COLUMN suppliers.api_url IS 'URL API поставщика';
COMMENT ON COLUMN suppliers.api_type IS 'Тип API: rest, soap, graphql';
COMMENT ON COLUMN suppliers.api_config IS 'Конфигурация API поставщика';
COMMENT ON COLUMN suppliers.credentials IS 'Учетные данные для доступа к API';
COMMENT ON COLUMN suppliers.settings IS 'Настройки интеграции с поставщиком';
COMMENT ON COLUMN suppliers.is_main IS 'Является ли поставщик основным';
COMMENT ON COLUMN suppliers.status IS 'Статус поставщика: active, inactive, error';
COMMENT ON COLUMN suppliers.priority IS 'Приоритет поставщика при выборе источника товара';
COMMENT ON COLUMN suppliers.last_sync_at IS 'Дата и время последней синхронизации';
COMMENT ON COLUMN suppliers.last_sync_status IS 'Статус последней синхронизации';
COMMENT ON COLUMN suppliers.last_sync_error IS 'Ошибка последней синхронизации';
COMMENT ON COLUMN suppliers.sync_stats IS 'Статистика синхронизации';
COMMENT ON COLUMN suppliers.external_warehouse_id IS 'ID склада поставщика во внешней системе';
COMMENT ON COLUMN suppliers.integration_settings IS 'Настройки интеграции';

ALTER TABLE suppliers ADD CONSTRAINT suppliers_name_unique_per_company
    UNIQUE (company_id, name);
ALTER TABLE suppliers ADD CONSTRAINT suppliers_code_unique_per_company
    UNIQUE (company_id, code);

CREATE INDEX idx_suppliers_company_id ON suppliers (company_id);
CREATE INDEX idx_suppliers_name ON suppliers (name);
CREATE INDEX idx_suppliers_code ON suppliers (code);
CREATE INDEX idx_suppliers_type ON suppliers (type);
CREATE INDEX idx_suppliers_api_type ON suppliers (api_type);
CREATE INDEX idx_suppliers_is_main ON suppliers (is_main);
CREATE INDEX idx_suppliers_status ON suppliers (status);
CREATE INDEX idx_suppliers_priority ON suppliers (priority);
CREATE INDEX idx_suppliers_last_sync_at ON suppliers (last_sync_at);
CREATE INDEX idx_suppliers_last_sync_status ON suppliers (last_sync_status);
CREATE INDEX idx_suppliers_company_active ON suppliers (company_id, status, priority);

-- ================================================================
-- ТАБЛИЦА: Marketplaces - Маркетплейсы для продаж
-- ================================================================
CREATE TABLE marketplaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    type VARCHAR(50) DEFAULT 'marketplace',
    description TEXT,
    api_type VARCHAR(50),
    api_config JSONB DEFAULT '{}'::jsonb,
    credentials JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'active',
    priority INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    commission_rules JSONB DEFAULT '{}'::jsonb,
    commission_info JSONB DEFAULT '{}'::jsonb,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20),
    last_sync_error TEXT,
    sales_stats JSONB DEFAULT '{}'::jsonb,
    seller_cabinet_url VARCHAR(255),
    external_warehouse_id VARCHAR(255),
    integration_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_marketplaces_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE marketplaces IS 'Маркетплейсы для продажи товаров';
COMMENT ON COLUMN marketplaces.company_id IS 'Компания-владелец маркетплейса';
COMMENT ON COLUMN marketplaces.name IS 'Название маркетплейса';
COMMENT ON COLUMN marketplaces.code IS 'Код маркетплейса';
COMMENT ON COLUMN marketplaces.type IS 'Тип маркетплейса: marketplace, aggregator, social';
COMMENT ON COLUMN marketplaces.description IS 'Описание маркетплейса';
COMMENT ON COLUMN marketplaces.api_type IS 'Тип API: rest, soap, graphql';
COMMENT ON COLUMN marketplaces.api_config IS 'Конфигурация API';
COMMENT ON COLUMN marketplaces.credentials IS 'Учетные данные для доступа к API';
COMMENT ON COLUMN marketplaces.settings IS 'Настройки интеграции с маркетплейсом';
COMMENT ON COLUMN marketplaces.status IS 'Статус маркетплейса: active, inactive, error';
COMMENT ON COLUMN marketplaces.priority IS 'Приоритет маркетплейса';
COMMENT ON COLUMN marketplaces.is_public IS 'Публичный ли маркетплейс';
COMMENT ON COLUMN marketplaces.commission_rules IS 'Правила комиссий маркетплейса';
COMMENT ON COLUMN marketplaces.commission_info IS 'Информация о комиссиях';
COMMENT ON COLUMN marketplaces.last_sync_at IS 'Дата и время последней синхронизации';
COMMENT ON COLUMN marketplaces.last_sync_status IS 'Статус последней синхронизации';
COMMENT ON COLUMN marketplaces.last_sync_error IS 'Ошибка последней синхронизации';
COMMENT ON COLUMN marketplaces.sales_stats IS 'Статистика продаж';
COMMENT ON COLUMN marketplaces.seller_cabinet_url IS 'URL личного кабинета продавца';
COMMENT ON COLUMN marketplaces.external_warehouse_id IS 'ID склада во внешней системе';
COMMENT ON COLUMN marketplaces.integration_settings IS 'Настройки интеграции';

ALTER TABLE marketplaces ADD CONSTRAINT marketplaces_name_unique_per_company
    UNIQUE (company_id, name);
ALTER TABLE marketplaces ADD CONSTRAINT marketplaces_code_unique_per_company
    UNIQUE (company_id, code);

CREATE INDEX idx_marketplaces_company_id ON marketplaces (company_id);
CREATE INDEX idx_marketplaces_name ON marketplaces (name);
CREATE INDEX idx_marketplaces_code ON marketplaces (code);
CREATE INDEX idx_marketplaces_type ON marketplaces (type);
CREATE INDEX idx_marketplaces_status ON marketplaces (status);
CREATE INDEX idx_marketplaces_priority ON marketplaces (priority);
CREATE INDEX idx_marketplaces_is_public ON marketplaces (is_public);
CREATE INDEX idx_marketplaces_last_sync_at ON marketplaces (last_sync_at);
CREATE INDEX idx_marketplaces_last_sync_status ON marketplaces (last_sync_status);
CREATE INDEX idx_marketplaces_company_active ON marketplaces (company_id, status, priority);

-- ================================================================
-- ТАБЛИЦА: Product_Suppliers - Связь товаров с поставщиками
-- ================================================================
CREATE TABLE product_suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    external_product_id VARCHAR(255),
    external_product_code VARCHAR(255),
    supplier_price DECIMAL(12,2),
    supplier_currency VARCHAR(3) DEFAULT 'RUB',
    min_order_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER,
    is_preferred BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20),
    sync_error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_suppliers_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_suppliers_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE product_suppliers IS 'Связь товаров с поставщиками';
COMMENT ON COLUMN product_suppliers.product_id IS 'Товар';
COMMENT ON COLUMN product_suppliers.supplier_id IS 'Поставщик';
COMMENT ON COLUMN product_suppliers.external_product_id IS 'ID товара у поставщика';
COMMENT ON COLUMN product_suppliers.external_product_code IS 'Код товара у поставщика';
COMMENT ON COLUMN product_suppliers.supplier_price IS 'Цена у поставщика';
COMMENT ON COLUMN product_suppliers.supplier_currency IS 'Валюта цены поставщика';
COMMENT ON COLUMN product_suppliers.min_order_quantity IS 'Минимальное количество для заказа';
COMMENT ON COLUMN product_suppliers.lead_time_days IS 'Срок поставки в днях';
COMMENT ON COLUMN product_suppliers.is_preferred IS 'Предпочтительный поставщик для товара';
COMMENT ON COLUMN product_suppliers.is_active IS 'Активна ли связь';
COMMENT ON COLUMN product_suppliers.last_sync_at IS 'Дата последней синхронизации';
COMMENT ON COLUMN product_suppliers.sync_status IS 'Статус синхронизации';
COMMENT ON COLUMN product_suppliers.sync_error IS 'Ошибка синхронизации';
COMMENT ON COLUMN product_suppliers.metadata IS 'Дополнительные данные';

ALTER TABLE product_suppliers ADD CONSTRAINT product_suppliers_unique
    UNIQUE (product_id, supplier_id);

CREATE INDEX idx_product_suppliers_product_id ON product_suppliers (product_id);
CREATE INDEX idx_product_suppliers_supplier_id ON product_suppliers (supplier_id);
CREATE INDEX idx_product_suppliers_external_product_id ON product_suppliers (external_product_id);
CREATE INDEX idx_product_suppliers_is_preferred ON product_suppliers (is_preferred);
CREATE INDEX idx_product_suppliers_is_active ON product_suppliers (is_active);
CREATE INDEX idx_product_suppliers_last_sync_at ON product_suppliers (last_sync_at);
CREATE INDEX idx_product_suppliers_sync_status ON product_suppliers (sync_status);

-- ================================================================
-- ТАБЛИЦА: Marketplace_Settings - Настройки товаров для маркетплейсов
-- ================================================================
CREATE TABLE marketplace_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marketplace_id UUID NOT NULL,
    product_id UUID NOT NULL,
    external_product_id VARCHAR(255),
    external_category_id VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    price DECIMAL(12,2),
    sale_price DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'RUB',
    stock_quantity INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    sync_status VARCHAR(20) DEFAULT 'pending',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,
    marketplace_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_marketplace_settings_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_marketplace_settings_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE marketplace_settings IS 'Настройки товаров для конкретных маркетплейсов';
COMMENT ON COLUMN marketplace_settings.marketplace_id IS 'Маркетплейс';
COMMENT ON COLUMN marketplace_settings.product_id IS 'Товар';
COMMENT ON COLUMN marketplace_settings.external_product_id IS 'ID товара на маркетплейсе';
COMMENT ON COLUMN marketplace_settings.external_category_id IS 'ID категории на маркетплейсе';
COMMENT ON COLUMN marketplace_settings.title IS 'Название товара для маркетплейса';
COMMENT ON COLUMN marketplace_settings.description IS 'Описание товара для маркетплейса';
COMMENT ON COLUMN marketplace_settings.price IS 'Цена товара на маркетплейсе';
COMMENT ON COLUMN marketplace_settings.sale_price IS 'Цена со скидкой';
COMMENT ON COLUMN marketplace_settings.currency IS 'Валюта цены';
COMMENT ON COLUMN marketplace_settings.stock_quantity IS 'Количество товара на маркетплейсе';
COMMENT ON COLUMN marketplace_settings.is_active IS 'Активна ли настройка';
COMMENT ON COLUMN marketplace_settings.sync_status IS 'Статус синхронизации';
COMMENT ON COLUMN marketplace_settings.last_sync_at IS 'Дата последней синхронизации';
COMMENT ON COLUMN marketplace_settings.sync_error IS 'Ошибка синхронизации';
COMMENT ON COLUMN marketplace_settings.marketplace_data IS 'Дополнительные данные маркетплейса';

ALTER TABLE marketplace_settings ADD CONSTRAINT marketplace_settings_unique
    UNIQUE (marketplace_id, product_id);

CREATE INDEX idx_marketplace_settings_marketplace_id ON marketplace_settings (marketplace_id);
CREATE INDEX idx_marketplace_settings_product_id ON marketplace_settings (product_id);
CREATE INDEX idx_marketplace_settings_external_product_id ON marketplace_settings (external_product_id);
CREATE INDEX idx_marketplace_settings_is_active ON marketplace_settings (is_active);
CREATE INDEX idx_marketplace_settings_sync_status ON marketplace_settings (sync_status);
CREATE INDEX idx_marketplace_settings_last_sync_at ON marketplace_settings (last_sync_at);

-- ================================================================
-- ТАБЛИЦА: Marketplace_Integrations - Интеграции с маркетплейсами
-- ================================================================
CREATE TABLE marketplace_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marketplace_id UUID NOT NULL,
    integration_type VARCHAR(50) NOT NULL,
    api_endpoint VARCHAR(500),
    api_key VARCHAR(255),
    api_secret VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'active',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_interval_minutes INTEGER DEFAULT 60,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_marketplace_integrations_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE marketplace_integrations IS 'Интеграции с маркетплейсами';
COMMENT ON COLUMN marketplace_integrations.marketplace_id IS 'Маркетплейс';
COMMENT ON COLUMN marketplace_integrations.integration_type IS 'Тип интеграции: api, webhook, file';
COMMENT ON COLUMN marketplace_integrations.api_endpoint IS 'Endpoint API';
COMMENT ON COLUMN marketplace_integrations.api_key IS 'Ключ API';
COMMENT ON COLUMN marketplace_integrations.api_secret IS 'Секрет API';
COMMENT ON COLUMN marketplace_integrations.access_token IS 'Токен доступа';
COMMENT ON COLUMN marketplace_integrations.refresh_token IS 'Токен обновления';
COMMENT ON COLUMN marketplace_integrations.token_expires_at IS 'Время истечения токена';
COMMENT ON COLUMN marketplace_integrations.settings IS 'Настройки интеграции';
COMMENT ON COLUMN marketplace_integrations.status IS 'Статус интеграции';
COMMENT ON COLUMN marketplace_integrations.last_sync_at IS 'Дата последней синхронизации';
COMMENT ON COLUMN marketplace_integrations.sync_interval_minutes IS 'Интервал синхронизации в минутах';
COMMENT ON COLUMN marketplace_integrations.error_count IS 'Количество ошибок подряд';
COMMENT ON COLUMN marketplace_integrations.last_error IS 'Последняя ошибка';

CREATE INDEX idx_marketplace_integrations_marketplace_id ON marketplace_integrations (marketplace_id);
CREATE INDEX idx_marketplace_integrations_integration_type ON marketplace_integrations (integration_type);
CREATE INDEX idx_marketplace_integrations_status ON marketplace_integrations (status);
CREATE INDEX idx_marketplace_integrations_last_sync_at ON marketplace_integrations (last_sync_at);

-- ================================================================
-- ТАБЛИЦА: Supplier_Integrations - Интеграции с поставщиками
-- ================================================================
CREATE TABLE supplier_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL,
    integration_type VARCHAR(50) NOT NULL,
    api_endpoint VARCHAR(500),
    api_key VARCHAR(255),
    api_secret VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'active',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_interval_minutes INTEGER DEFAULT 60,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_supplier_integrations_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE supplier_integrations IS 'Интеграции с поставщиками';
COMMENT ON COLUMN supplier_integrations.supplier_id IS 'Поставщик';
COMMENT ON COLUMN supplier_integrations.integration_type IS 'Тип интеграции: api, webhook, file';
COMMENT ON COLUMN supplier_integrations.api_endpoint IS 'Endpoint API';
COMMENT ON COLUMN supplier_integrations.api_key IS 'Ключ API';
COMMENT ON COLUMN supplier_integrations.api_secret IS 'Секрет API';
COMMENT ON COLUMN supplier_integrations.access_token IS 'Токен доступа';
COMMENT ON COLUMN supplier_integrations.refresh_token IS 'Токен обновления';
COMMENT ON COLUMN supplier_integrations.token_expires_at IS 'Время истечения токена';
COMMENT ON COLUMN supplier_integrations.settings IS 'Настройки интеграции';
COMMENT ON COLUMN supplier_integrations.status IS 'Статус интеграции';
COMMENT ON COLUMN supplier_integrations.last_sync_at IS 'Дата последней синхронизации';
COMMENT ON COLUMN supplier_integrations.sync_interval_minutes IS 'Интервал синхронизации в минутах';
COMMENT ON COLUMN supplier_integrations.error_count IS 'Количество ошибок подряд';
COMMENT ON COLUMN supplier_integrations.last_error IS 'Последняя ошибка';

CREATE INDEX idx_supplier_integrations_supplier_id ON supplier_integrations (supplier_id);
CREATE INDEX idx_supplier_integrations_integration_type ON supplier_integrations (integration_type);
CREATE INDEX idx_supplier_integrations_status ON supplier_integrations (status);
CREATE INDEX idx_supplier_integrations_last_sync_at ON supplier_integrations (last_sync_at);

-- ================================================================
-- ТАБЛИЦА: System_Settings - Системные настройки
-- ================================================================
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID,
    setting_key VARCHAR(255) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_system_settings_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE system_settings IS 'Системные настройки компаний и глобальные настройки';
COMMENT ON COLUMN system_settings.company_id IS 'Компания (NULL для глобальных настроек)';
COMMENT ON COLUMN system_settings.setting_key IS 'Ключ настройки';
COMMENT ON COLUMN system_settings.setting_value IS 'Значение настройки';
COMMENT ON COLUMN system_settings.setting_type IS 'Тип значения: string, integer, boolean, json';
COMMENT ON COLUMN system_settings.description IS 'Описание настройки';
COMMENT ON COLUMN system_settings.is_public IS 'Публичная ли настройка';
COMMENT ON COLUMN system_settings.is_encrypted IS 'Зашифровано ли значение';

ALTER TABLE system_settings ADD CONSTRAINT system_settings_key_unique
    UNIQUE (company_id, setting_key);

CREATE INDEX idx_system_settings_company_id ON system_settings (company_id);
CREATE INDEX idx_system_settings_key ON system_settings (setting_key);
CREATE INDEX idx_system_settings_is_public ON system_settings (is_public);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplaces_updated_at
    BEFORE UPDATE ON marketplaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_suppliers_updated_at
    BEFORE UPDATE ON product_suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_settings_updated_at
    BEFORE UPDATE ON marketplace_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_integrations_updated_at
    BEFORE UPDATE ON marketplace_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_integrations_updated_at
    BEFORE UPDATE ON supplier_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С ИНТЕГРАЦИЯМИ
-- ================================================================

-- Функция для проверки лимита поставщиков
CREATE OR REPLACE FUNCTION check_suppliers_limit(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    -- Считаем активных поставщиков компании
    SELECT COUNT(*)
    INTO v_current_count
    FROM suppliers
    WHERE company_id = p_company_id AND status = 'active';

    -- Проверяем лимит через общую функцию
    RETURN check_company_limits(p_company_id, 'suppliers', v_current_count);
END;
$$ LANGUAGE plpgsql;

-- Функция для проверки лимита маркетплейсов
CREATE OR REPLACE FUNCTION check_marketplaces_limit(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    -- Считаем активных маркетплейсов компании
    SELECT COUNT(*)
    INTO v_current_count
    FROM marketplaces
    WHERE company_id = p_company_id AND status = 'active';

    -- Проверяем лимит через общую функцию
    RETURN check_company_limits(p_company_id, 'marketplaces', v_current_count);
END;
$$ LANGUAGE plpgsql;

-- Функция для получения предпочтительного поставщика товара
CREATE OR REPLACE FUNCTION get_preferred_supplier(p_product_id UUID)
RETURNS TABLE (
    supplier_id UUID,
    supplier_name VARCHAR,
    supplier_price DECIMAL,
    supplier_currency VARCHAR,
    lead_time_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.name,
        ps.supplier_price,
        ps.supplier_currency,
        ps.lead_time_days
    FROM product_suppliers ps
    JOIN suppliers s ON ps.supplier_id = s.id
    WHERE ps.product_id = p_product_id
        AND ps.is_preferred = true
        AND ps.is_active = true
        AND s.status = 'active'
    ORDER BY s.priority DESC, ps.supplier_price ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения активных интеграций маркетплейса
CREATE OR REPLACE FUNCTION get_active_marketplace_integrations(p_marketplace_id UUID)
RETURNS TABLE (
    integration_id UUID,
    integration_type VARCHAR,
    api_endpoint VARCHAR,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    error_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mi.id,
        mi.integration_type,
        mi.api_endpoint,
        mi.last_sync_at,
        mi.error_count
    FROM marketplace_integrations mi
    WHERE mi.marketplace_id = p_marketplace_id
        AND mi.status = 'active'
    ORDER BY mi.last_sync_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения активных интеграций поставщика
CREATE OR REPLACE FUNCTION get_active_supplier_integrations(p_supplier_id UUID)
RETURNS TABLE (
    integration_id UUID,
    integration_type VARCHAR,
    api_endpoint VARCHAR,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    error_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        si.id,
        si.integration_type,
        si.api_endpoint,
        si.last_sync_at,
        si.error_count
    FROM supplier_integrations si
    WHERE si.supplier_id = p_supplier_id
        AND si.status = 'active'
    ORDER BY si.last_sync_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления статуса синхронизации
CREATE OR REPLACE FUNCTION update_sync_status(
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_status VARCHAR,
    p_error TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    CASE p_entity_type
        WHEN 'supplier' THEN
            UPDATE suppliers
            SET last_sync_at = CURRENT_TIMESTAMP,
                last_sync_status = p_status,
                last_sync_error = p_error,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = p_entity_id;
        WHEN 'marketplace' THEN
            UPDATE marketplaces
            SET last_sync_at = CURRENT_TIMESTAMP,
                last_sync_status = p_status,
                last_sync_error = p_error,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = p_entity_id;
        WHEN 'product_supplier' THEN
            UPDATE product_suppliers
            SET last_sync_at = CURRENT_TIMESTAMP,
                sync_status = p_status,
                sync_error = p_error,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = p_entity_id;
        WHEN 'marketplace_setting' THEN
            UPDATE marketplace_settings
            SET last_sync_at = CURRENT_TIMESTAMP,
                sync_status = p_status,
                sync_error = p_error,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = p_entity_id;
        ELSE
            RETURN FALSE;
    END CASE;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 004
-- ================================================================