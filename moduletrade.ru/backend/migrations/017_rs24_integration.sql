-- ================================================================
-- МИГРАЦИЯ 017: Интеграция с RS24 API (ИСПРАВЛЕННАЯ)
-- Описание: Расширяет существующие таблицы для работы с поставщиком RS24
-- Дата: 2025-01-30
-- Зависимости: все предыдущие миграции
-- Путь: backend/migrations/017_rs24_integration.sql
-- ================================================================

-- ================================================================
-- РАСШИРЕНИЕ ТАБЛИЦЫ: suppliers - добавляем поля для RS24
-- ================================================================
DO $$
BEGIN
    -- Добавляем недостающие поля в suppliers для RS24
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'auto_sync_enabled') THEN
        ALTER TABLE suppliers ADD COLUMN auto_sync_enabled BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'sync_interval_hours') THEN
        ALTER TABLE suppliers ADD COLUMN sync_interval_hours INTEGER DEFAULT 24;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'next_sync_at') THEN
        ALTER TABLE suppliers ADD COLUMN next_sync_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- ================================================================
-- РАСШИРЕНИЕ ТАБЛИЦЫ: products - добавляем поля для RS24
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'etim_class') THEN
        ALTER TABLE products ADD COLUMN etim_class VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'etim_class_name') THEN
        ALTER TABLE products ADD COLUMN etim_class_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'multiplicity') THEN
        ALTER TABLE products ADD COLUMN multiplicity INTEGER DEFAULT 1;
    END IF;
END $$;

-- ================================================================
-- РАСШИРЕНИЕ ТАБЛИЦЫ: import_sessions - Добавим недостающие поля
-- ================================================================
DO $$
BEGIN
  IF to_regclass('public.import_sessions') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='import_sessions' AND column_name='session_id') THEN
      ALTER TABLE import_sessions ADD COLUMN session_id VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='import_sessions' AND column_name='created_items') THEN
      ALTER TABLE import_sessions ADD COLUMN created_items INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='import_sessions' AND column_name='updated_items') THEN
      ALTER TABLE import_sessions ADD COLUMN updated_items INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='import_sessions' AND column_name='error_details') THEN
      ALTER TABLE import_sessions ADD COLUMN error_details JSONB DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END $$;

-- ================================================================
-- ТАБЛИЦА: Import_Logs - Логи импорта товаров (если не существует)
-- ================================================================
-- Проверяем, существует ли таблица import_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'import_logs') THEN
        CREATE TABLE import_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            public_id INTEGER,
            import_session_id UUID NOT NULL,
            level VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            external_id VARCHAR(255),
            product_id UUID,
            brand_id UUID,
            warehouse_id UUID,
            details JSONB DEFAULT '{}'::jsonb,
            stack_trace TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

            CONSTRAINT fk_import_logs_session_id
                FOREIGN KEY (import_session_id) REFERENCES import_sessions(id)
                ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_import_logs_product_id
                FOREIGN KEY (product_id) REFERENCES products(id)
                ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT fk_import_logs_brand_id
                FOREIGN KEY (brand_id) REFERENCES brands(id)
                ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT fk_import_logs_warehouse_id
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
                ON DELETE SET NULL ON UPDATE CASCADE
        );

        CREATE INDEX idx_import_logs_session_id ON import_logs (import_session_id);
        CREATE INDEX idx_import_logs_level ON import_logs (level);
        CREATE INDEX idx_import_logs_created_at ON import_logs (created_at);
        CREATE INDEX idx_import_logs_external_id ON import_logs (external_id);
    ELSE
        -- Добавляем недостающие колонки, если таблица существует
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'import_logs' AND column_name = 'warehouse_id') THEN
            ALTER TABLE import_logs ADD COLUMN warehouse_id UUID;
            ALTER TABLE import_logs ADD CONSTRAINT fk_import_logs_warehouse_id
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
                ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'import_logs' AND column_name = 'stack_trace') THEN
            ALTER TABLE import_logs ADD COLUMN stack_trace TEXT;
        END IF;
    END IF;
END $$;

-- Добавляем constraint и trigger для public_id, если еще не существуют
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_import_logs_public_id'
          AND conrelid = 'public.import_logs'::regclass
    ) THEN
        ALTER TABLE import_logs
            ADD CONSTRAINT ck_import_logs_public_id CHECK (public_id IS NULL OR public_id >= 100000);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_logs_public_id
  ON import_logs (public_id)
  WHERE public_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'assign_import_logs_public_id'
          AND tgrelid = 'public.import_logs'::regclass
    ) THEN
        CREATE TRIGGER assign_import_logs_public_id
            BEFORE INSERT ON import_logs
            FOR EACH ROW
            EXECUTE FUNCTION assign_public_id_global();
    END IF;
END $$;

-- ================================================================
-- ТАБЛИЦА: Warehouse_Supplier_Links - Связи складов с поставщиками
-- ================================================================
CREATE TABLE IF NOT EXISTS warehouse_supplier_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    priority INTEGER DEFAULT 100,
    is_default BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_warehouse_supplier_links_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_supplier_links_warehouse_id
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_supplier_links_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_warehouse_supplier_links_unique
        UNIQUE (warehouse_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_supplier_links_company_id ON warehouse_supplier_links (company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_supplier_links_warehouse_id ON warehouse_supplier_links (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_supplier_links_supplier_id ON warehouse_supplier_links (supplier_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_supplier_links_is_active ON warehouse_supplier_links (is_active);

ALTER TABLE warehouse_supplier_links
    ADD CONSTRAINT ck_warehouse_supplier_links_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouse_supplier_links_company_public_id
  ON warehouse_supplier_links (company_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_warehouse_supplier_links_public_id
    BEFORE INSERT ON warehouse_supplier_links
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Attribute_Mappings - Маппинг атрибутов RS24
-- ================================================================
DO $$
BEGIN
  -- If table does not exist, create it with the canonical columns used by code (from migration 011)
  IF to_regclass('public.attribute_mappings') IS NULL THEN
    CREATE TABLE attribute_mappings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        public_id INTEGER,
        company_id UUID NOT NULL,
        supplier_id UUID NOT NULL,
        external_key VARCHAR(255) NOT NULL,
        internal_name VARCHAR(255) NOT NULL,
        conversion_rules JSONB DEFAULT '{}'::jsonb,
        is_auto_mapped BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

        CONSTRAINT fk_attribute_mappings_company_id
            FOREIGN KEY (company_id) REFERENCES companies(id)
            ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_attribute_mappings_supplier_id
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
            ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT uk_attribute_mappings_unique
            UNIQUE (company_id, supplier_id, external_key)
    );
  ELSE
    -- If table exists but older columns from 011 are missing, align schema additively
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='attribute_mappings' AND column_name='external_key'
    ) THEN
      ALTER TABLE attribute_mappings ADD COLUMN external_key VARCHAR(255);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='attribute_mappings' AND column_name='internal_name'
    ) THEN
      ALTER TABLE attribute_mappings ADD COLUMN internal_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='attribute_mappings' AND column_name='conversion_rules'
    ) THEN
      ALTER TABLE attribute_mappings ADD COLUMN conversion_rules JSONB DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='attribute_mappings' AND column_name='is_auto_mapped'
    ) THEN
      ALTER TABLE attribute_mappings ADD COLUMN is_auto_mapped BOOLEAN DEFAULT FALSE;
    END IF;
  END IF;
END $$;

-- Добавляем поле internal_attribute_id если не существует
DO $$
BEGIN
  IF to_regclass('public.attribute_mappings') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attribute_mappings' AND column_name='internal_attribute_id') THEN
      ALTER TABLE attribute_mappings ADD COLUMN internal_attribute_id UUID;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attribute_mappings_company_id ON attribute_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_attribute_mappings_supplier_id ON attribute_mappings (supplier_id);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attribute_mappings' AND column_name = 'external_key'
  ) THEN
    -- Ensure we have the expected index on external_key (compatible with migration 011)
    CREATE INDEX IF NOT EXISTS idx_attribute_mappings_external_key ON attribute_mappings (external_key);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_attribute_mappings_is_active ON attribute_mappings (is_active);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_attribute_mappings_public_id'
          AND conrelid = 'public.attribute_mappings'::regclass
    ) THEN
        ALTER TABLE attribute_mappings
            ADD CONSTRAINT ck_attribute_mappings_public_id CHECK (public_id IS NULL OR public_id >= 100000);
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_attribute_mappings_company_public_id
  ON attribute_mappings (company_id, public_id)
  WHERE public_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'assign_attribute_mappings_public_id'
          AND tgrelid = 'public.attribute_mappings'::regclass
    ) THEN
        CREATE TRIGGER assign_attribute_mappings_public_id
            BEFORE INSERT ON attribute_mappings
            FOR EACH ROW
            EXECUTE FUNCTION assign_public_id_with_company();
    END IF;
END $$;

-- ================================================================
-- СОЗДАНИЕ ТРИГГЕРОВ ДЛЯ UPDATED_AT (С ПРОВЕРКОЙ СУЩЕСТВОВАНИЯ)
-- ================================================================

-- Проверяем и создаем триггер для import_sessions только если не существует
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_import_sessions_updated_at'
          AND tgrelid = 'public.import_sessions'::regclass
    ) THEN
        CREATE TRIGGER update_import_sessions_updated_at
            BEFORE UPDATE ON import_sessions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Триггер для warehouse_supplier_links
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_warehouse_supplier_links_updated_at'
          AND tgrelid = 'public.warehouse_supplier_links'::regclass
    ) THEN
        CREATE TRIGGER update_warehouse_supplier_links_updated_at
            BEFORE UPDATE ON warehouse_supplier_links
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Триггер для attribute_mappings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_attribute_mappings_updated_at'
          AND tgrelid = 'public.attribute_mappings'::regclass
    ) THEN
        CREATE TRIGGER update_attribute_mappings_updated_at
            BEFORE UPDATE ON attribute_mappings
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С RS24
-- ================================================================

-- Функция для получения товаров поставщика с фильтрацией
CREATE OR REPLACE FUNCTION get_supplier_products(
    p_company_id UUID,
    p_supplier_id UUID,
    p_brand_ids UUID[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 1000,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    product_id UUID,
    external_id VARCHAR,
    name VARCHAR,
    brand_name VARCHAR,
    sku VARCHAR,
    last_sync TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.external_id,
        p.name,
        b.name as brand_name,
        p.sku,
        p.last_sync
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.company_id = p_company_id
      AND (p.main_supplier_id = p_supplier_id OR p.supplier_data ? p_supplier_id::text)
      AND (p_brand_ids IS NULL OR p.brand_id = ANY(p_brand_ids))
      AND p.is_active = true
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Функция для очистки старых логов импорта (старше 30 дней)
CREATE OR REPLACE FUNCTION cleanup_old_import_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM import_logs
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- КОММЕНТАРИИ К ТАБЛИЦАМ
-- ================================================================

COMMENT ON TABLE import_sessions IS 'Сессии импорта товаров от поставщиков';
COMMENT ON TABLE import_logs IS 'Логи импорта товаров';
COMMENT ON TABLE warehouse_supplier_links IS 'Связи складов с поставщиками';
COMMENT ON TABLE attribute_mappings IS 'Маппинг атрибутов товаров поставщиков';

COMMENT ON COLUMN suppliers.auto_sync_enabled IS 'Включена ли автоматическая синхронизация';
COMMENT ON COLUMN suppliers.sync_interval_hours IS 'Интервал синхронизации в часах';
COMMENT ON COLUMN suppliers.next_sync_at IS 'Время следующей синхронизации';

COMMENT ON COLUMN products.etim_class IS 'Класс ETIM товара';
COMMENT ON COLUMN products.etim_class_name IS 'Название класса ETIM';
COMMENT ON COLUMN products.multiplicity IS 'Кратность заказа у поставщика';

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ
-- ================================================================

-- Записываем информацию о выполнении миграции
DO $$
BEGIN
    INSERT INTO schema_migrations (filename, applied_at, success)
    VALUES ('017_rs24_integration.sql', CURRENT_TIMESTAMP, true)
    ON CONFLICT (filename) DO UPDATE SET applied_at = CURRENT_TIMESTAMP, success = true;

    RAISE NOTICE 'Migration 017_rs24_integration completed successfully';
END $$;