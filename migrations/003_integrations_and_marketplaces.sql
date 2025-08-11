-- ================================================================
-- МИГРАЦИЯ 003: Интеграции и маркетплейсы (ИСПРАВЛЕНА)
-- Описание: Создает таблицы для поставщиков, маркетплейсов и их интеграций
-- Дата: 2025-01-27
-- Блок: Интеграции и Маркетплейсы
-- Зависимости: 001 (brands, categories), 002 (companies)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Suppliers - Поставщики товаров
-- ================================================================
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
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
    is_active BOOLEAN DEFAULT TRUE,
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
COMMENT ON COLUMN suppliers.is_active IS 'Активен ли поставщик';
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
CREATE INDEX idx_suppliers_is_active ON suppliers (is_active);
CREATE INDEX idx_suppliers_priority ON suppliers (priority);
CREATE INDEX idx_suppliers_last_sync_at ON suppliers (last_sync_at);
CREATE INDEX idx_suppliers_last_sync_status ON suppliers (last_sync_status);
CREATE INDEX idx_suppliers_company_active ON suppliers (company_id, status, priority);
ALTER TABLE suppliers
    ADD CONSTRAINT ck_suppliers_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_public_id ON suppliers (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_suppliers_public_id
    BEFORE INSERT ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- Примечание: добавление products.main_supplier_id выполняется в миграции 004

-- ================================================================
-- ТАБЛИЦА: Marketplaces - Маркетплейсы для продаж
-- ================================================================
CREATE TABLE marketplaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
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
    is_active BOOLEAN DEFAULT TRUE,
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
COMMENT ON COLUMN marketplaces.is_active IS 'Активен ли маркетплейс';
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
CREATE INDEX idx_marketplaces_is_active ON marketplaces (is_active);
CREATE INDEX idx_marketplaces_last_sync_at ON marketplaces (last_sync_at);
CREATE INDEX idx_marketplaces_last_sync_status ON marketplaces (last_sync_status);
CREATE INDEX idx_marketplaces_company_active ON marketplaces (company_id, status, priority);
ALTER TABLE marketplaces
    ADD CONSTRAINT ck_marketplaces_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplaces_company_public_id ON marketplaces (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_marketplaces_public_id
    BEFORE INSERT ON marketplaces
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

 -- Примечание: marketplace_settings создается в миграции 004 (удалено из 003)

-- ================================================================
-- ТАБЛИЦА: Marketplace_Integration_Settings - Настройки интеграций с маркетплейсами
-- ================================================================
CREATE TABLE marketplace_integration_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    marketplace_id UUID NOT NULL,
    api_credentials JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending',
    sync_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_marketplace_integration_settings_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_marketplace_integration_settings_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE marketplace_integration_settings IS 'Настройки интеграций с маркетплейсами';
COMMENT ON COLUMN marketplace_integration_settings.company_id IS 'Компания';
COMMENT ON COLUMN marketplace_integration_settings.marketplace_id IS 'Маркетплейс';
COMMENT ON COLUMN marketplace_integration_settings.api_credentials IS 'API учетные данные';
COMMENT ON COLUMN marketplace_integration_settings.settings IS 'Настройки интеграции';
COMMENT ON COLUMN marketplace_integration_settings.is_active IS 'Активна ли интеграция';
COMMENT ON COLUMN marketplace_integration_settings.last_sync_at IS 'Дата последней синхронизации';
COMMENT ON COLUMN marketplace_integration_settings.sync_status IS 'Статус синхронизации';
COMMENT ON COLUMN marketplace_integration_settings.sync_error IS 'Ошибка синхронизации';

ALTER TABLE marketplace_integration_settings ADD CONSTRAINT marketplace_integration_settings_unique
    UNIQUE (company_id, marketplace_id);

CREATE INDEX idx_marketplace_integration_settings_company_id ON marketplace_integration_settings (company_id);
CREATE INDEX idx_marketplace_integration_settings_marketplace_id ON marketplace_integration_settings (marketplace_id);
CREATE INDEX idx_marketplace_integration_settings_is_active ON marketplace_integration_settings (is_active);
CREATE INDEX idx_marketplace_integration_settings_sync_status ON marketplace_integration_settings (sync_status);
ALTER TABLE marketplace_integration_settings
    ADD CONSTRAINT ck_marketplace_integration_settings_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_integration_settings_company_public_id
  ON marketplace_integration_settings (company_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_marketplace_integration_settings_public_id
    BEFORE INSERT ON marketplace_integration_settings
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Marketplace_Integrations - Интеграции с маркетплейсами
-- ================================================================
CREATE TABLE marketplace_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
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
ALTER TABLE marketplace_integrations
    ADD CONSTRAINT ck_marketplace_integrations_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_integrations_public_id ON marketplace_integrations (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_marketplace_integrations_public_id
    BEFORE INSERT ON marketplace_integrations
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Supplier_Integrations - Интеграции с поставщиками
-- ================================================================
CREATE TABLE supplier_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
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
ALTER TABLE supplier_integrations
    ADD CONSTRAINT ck_supplier_integrations_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_integrations_public_id ON supplier_integrations (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_supplier_integrations_public_id
    BEFORE INSERT ON supplier_integrations
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: System_Settings - Системные настройки
-- ================================================================
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
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
ALTER TABLE system_settings
    ADD CONSTRAINT ck_system_settings_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_settings_company_public_id
  ON system_settings (company_id, public_id)
  WHERE public_id IS NOT NULL AND company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_settings_public_id_global
  ON system_settings (public_id)
  WHERE public_id IS NOT NULL AND company_id IS NULL;

CREATE TRIGGER assign_system_settings_public_id
    BEFORE INSERT ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Incoming_Orders - Входящие заказы
-- ================================================================
CREATE TABLE incoming_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    marketplace_id UUID NOT NULL,
    order_number VARCHAR(100) NOT NULL,
    marketplace_order_id VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'new',
    payment_status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'RUB',
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
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
COMMENT ON COLUMN incoming_orders.order_number IS 'Номер заказа';
COMMENT ON COLUMN incoming_orders.marketplace_order_id IS 'ID заказа на маркетплейсе';
COMMENT ON COLUMN incoming_orders.customer_name IS 'Имя клиента';
COMMENT ON COLUMN incoming_orders.customer_email IS 'Email клиента';
COMMENT ON COLUMN incoming_orders.status IS 'Статус заказа';
COMMENT ON COLUMN incoming_orders.payment_status IS 'Статус оплаты';
COMMENT ON COLUMN incoming_orders.total_amount IS 'Общая сумма заказа';
COMMENT ON COLUMN incoming_orders.currency IS 'Валюта заказа';
COMMENT ON COLUMN incoming_orders.order_date IS 'Дата заказа';
COMMENT ON COLUMN incoming_orders.metadata IS 'Дополнительные данные';

CREATE INDEX idx_incoming_orders_company_id ON incoming_orders (company_id);
CREATE INDEX idx_incoming_orders_marketplace_id ON incoming_orders (marketplace_id);
CREATE INDEX idx_incoming_orders_marketplace_order_id ON incoming_orders (marketplace_order_id);
CREATE INDEX idx_incoming_orders_status ON incoming_orders (status);
CREATE INDEX idx_incoming_orders_order_date ON incoming_orders (order_date);
ALTER TABLE incoming_orders
    ADD CONSTRAINT ck_incoming_orders_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_incoming_orders_company_public_id
  ON incoming_orders (company_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_incoming_orders_public_id
    BEFORE INSERT ON incoming_orders
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Incoming_Order_Items - Позиции входящих заказов
-- ================================================================
CREATE TABLE incoming_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    order_id UUID NOT NULL,
    external_product_id VARCHAR(255),
    product_name VARCHAR(500),
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_incoming_order_items_order_id
        FOREIGN KEY (order_id) REFERENCES incoming_orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE incoming_order_items IS 'Позиции входящих заказов';
COMMENT ON COLUMN incoming_order_items.order_id IS 'Заказ';
COMMENT ON COLUMN incoming_order_items.external_product_id IS 'Внешний ID товара';
COMMENT ON COLUMN incoming_order_items.product_name IS 'Название товара';
COMMENT ON COLUMN incoming_order_items.quantity IS 'Количество';
COMMENT ON COLUMN incoming_order_items.unit_price IS 'Цена за единицу';
COMMENT ON COLUMN incoming_order_items.total_price IS 'Общая стоимость позиции';
COMMENT ON COLUMN incoming_order_items.raw_data IS 'Сырые данные от маркетплейса';

CREATE INDEX idx_incoming_order_items_order_id ON incoming_order_items (order_id);
CREATE INDEX idx_incoming_order_items_external_product_id ON incoming_order_items (external_product_id);
ALTER TABLE incoming_order_items
    ADD CONSTRAINT ck_incoming_order_items_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_incoming_order_items_public_id ON incoming_order_items (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_incoming_order_items_public_id
    BEFORE INSERT ON incoming_order_items
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: External_Systems - Внешние системы
-- ================================================================
CREATE TABLE external_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    api_endpoint VARCHAR(500),
    api_credentials JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_external_systems_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE external_systems IS 'Внешние системы интеграции';
COMMENT ON COLUMN external_systems.company_id IS 'Компания';
COMMENT ON COLUMN external_systems.name IS 'Название системы';
COMMENT ON COLUMN external_systems.type IS 'Тип системы: supplier, marketplace, erp, crm';
COMMENT ON COLUMN external_systems.description IS 'Описание системы';
COMMENT ON COLUMN external_systems.api_endpoint IS 'API endpoint системы';
COMMENT ON COLUMN external_systems.api_credentials IS 'API учетные данные';
COMMENT ON COLUMN external_systems.settings IS 'Настройки интеграции';
COMMENT ON COLUMN external_systems.is_active IS 'Активна ли система';
COMMENT ON COLUMN external_systems.last_sync_at IS 'Время последней синхронизации';

CREATE INDEX idx_external_systems_company_id ON external_systems (company_id);
CREATE INDEX idx_external_systems_type ON external_systems (type);
CREATE INDEX idx_external_systems_is_active ON external_systems (is_active);
ALTER TABLE external_systems
    ADD CONSTRAINT ck_external_systems_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_external_systems_company_public_id
  ON external_systems (company_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_external_systems_public_id
    BEFORE INSERT ON external_systems
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Sales_Channels - Каналы продаж
-- ================================================================
CREATE TABLE sales_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_sales_channels_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE sales_channels IS 'Каналы продаж';
COMMENT ON COLUMN sales_channels.company_id IS 'Компания';
COMMENT ON COLUMN sales_channels.name IS 'Название канала';
COMMENT ON COLUMN sales_channels.type IS 'Тип канала: marketplace, website, retail, wholesale';
COMMENT ON COLUMN sales_channels.description IS 'Описание канала';
COMMENT ON COLUMN sales_channels.settings IS 'Настройки канала';
COMMENT ON COLUMN sales_channels.is_active IS 'Активен ли канал';

CREATE INDEX idx_sales_channels_company_id ON sales_channels (company_id);
CREATE INDEX idx_sales_channels_type ON sales_channels (type);
CREATE INDEX idx_sales_channels_is_active ON sales_channels (is_active);
ALTER TABLE sales_channels
    ADD CONSTRAINT ck_sales_channels_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_channels_company_public_id ON sales_channels (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_sales_channels_public_id
    BEFORE INSERT ON sales_channels
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

 -- Примечание: procurement_overrides создается в миграции 004 (удалено из 003)

-- ================================================================
-- ТАБЛИЦА: Permissions - Разрешения
-- ================================================================
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    module VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE permissions IS 'Разрешения системы';
COMMENT ON COLUMN permissions.name IS 'Название разрешения';
COMMENT ON COLUMN permissions.code IS 'Код разрешения';
COMMENT ON COLUMN permissions.description IS 'Описание разрешения';
COMMENT ON COLUMN permissions.module IS 'Модуль системы';
COMMENT ON COLUMN permissions.is_active IS 'Активно ли разрешение';

CREATE INDEX idx_permissions_code ON permissions (code);
CREATE INDEX idx_permissions_module ON permissions (module);
CREATE INDEX idx_permissions_is_active ON permissions (is_active);

-- ================================================================
-- ТАБЛИЦА: Role_Permissions - Разрешения ролей
-- ================================================================
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_role_permissions_role_id
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_role_permissions_permission_id
        FOREIGN KEY (permission_id) REFERENCES permissions(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE role_permissions IS 'Связи ролей с разрешениями';
COMMENT ON COLUMN role_permissions.role_id IS 'Роль';
COMMENT ON COLUMN role_permissions.permission_id IS 'Разрешение';
COMMENT ON COLUMN role_permissions.is_active IS 'Активна ли связь';

ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_unique
    UNIQUE (role_id, permission_id);

CREATE INDEX idx_role_permissions_role_id ON role_permissions (role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions (permission_id);
CREATE INDEX idx_role_permissions_is_active ON role_permissions (is_active);

-- ================================================================
-- ТАБЛИЦА: Tenant_Integrations - Интеграции тенантов
-- ================================================================
CREATE TABLE tenant_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    integration_type VARCHAR(50) NOT NULL,
    integration_name VARCHAR(255) NOT NULL,
    api_credentials JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_tenant_integrations_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE tenant_integrations IS 'Интеграции тенантов с внешними системами';
COMMENT ON COLUMN tenant_integrations.company_id IS 'Компания';
COMMENT ON COLUMN tenant_integrations.integration_type IS 'Тип интеграции';
COMMENT ON COLUMN tenant_integrations.integration_name IS 'Название интеграции';
COMMENT ON COLUMN tenant_integrations.api_credentials IS 'API учетные данные';
COMMENT ON COLUMN tenant_integrations.settings IS 'Настройки интеграции';
COMMENT ON COLUMN tenant_integrations.is_active IS 'Активна ли интеграция';
COMMENT ON COLUMN tenant_integrations.last_sync_at IS 'Время последней синхронизации';

CREATE INDEX idx_tenant_integrations_company_id ON tenant_integrations (company_id);
CREATE INDEX idx_tenant_integrations_type ON tenant_integrations (integration_type);
CREATE INDEX idx_tenant_integrations_is_active ON tenant_integrations (is_active);

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

-- Примечание: триггер update_marketplace_settings_updated_at создается в миграции 004

CREATE TRIGGER update_marketplace_integration_settings_updated_at
    BEFORE UPDATE ON marketplace_integration_settings
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

CREATE TRIGGER update_incoming_orders_updated_at
    BEFORE UPDATE ON incoming_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incoming_order_items_updated_at
    BEFORE UPDATE ON incoming_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_integrations_updated_at
    BEFORE UPDATE ON tenant_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_external_systems_updated_at
    BEFORE UPDATE ON external_systems
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_channels_updated_at
    BEFORE UPDATE ON sales_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Примечание: триггер update_procurement_overrides_updated_at создается в миграции 004

CREATE TRIGGER update_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at
    BEFORE UPDATE ON role_permissions
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

    -- Используем существующую функцию check_company_limits из миграции 002
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

    -- Используем существующую функцию check_company_limits из миграции 002
    RETURN check_company_limits(p_company_id, 'marketplaces', v_current_count);
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
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 003
-- ================================================================