-- 023_enhanced_attributes.sql
-- Миграция для улучшения системы атрибутов

-- Добавление полей для улучшенного маппинга в таблицу product_attributes
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS global_attribute_id UUID;
-- Колонка confidence_score уже существует в 011 для части схем,
-- поэтому добавляем её только если отсутствует
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,2) DEFAULT 1.00;
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS auto_mapped BOOLEAN DEFAULT FALSE;
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS mapping_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS external_source VARCHAR(100);
-- Поле is_required уже определено в миграции 004; не дублируем
-- ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT FALSE;
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS validation_rules JSONB DEFAULT '{}'::jsonb;
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS default_value TEXT;
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Добавление внешнего ключа для глобальных атрибутов
ALTER TABLE product_attributes ADD CONSTRAINT fk_product_attributes_global_attribute_id
    FOREIGN KEY (global_attribute_id) REFERENCES product_attributes(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Индексы для новых полей
CREATE INDEX IF NOT EXISTS idx_product_attributes_is_global ON product_attributes (is_global);
CREATE INDEX IF NOT EXISTS idx_product_attributes_global_attribute_id ON product_attributes (global_attribute_id);
CREATE INDEX IF NOT EXISTS idx_product_attributes_confidence_score ON product_attributes (confidence_score);
CREATE INDEX IF NOT EXISTS idx_product_attributes_auto_mapped ON product_attributes (auto_mapped);
CREATE INDEX IF NOT EXISTS idx_product_attributes_external_id ON product_attributes (external_id);
CREATE INDEX IF NOT EXISTS idx_product_attributes_external_source ON product_attributes (external_source);
-- Индекс по is_required уже присутствует, пропускаем во избежание конфликтов
CREATE INDEX IF NOT EXISTS idx_product_attributes_sort_order ON product_attributes (sort_order);

-- Комментарии к новым полям
COMMENT ON COLUMN product_attributes.is_global IS 'Флаг глобального атрибута';
COMMENT ON COLUMN product_attributes.global_attribute_id IS 'Ссылка на глобальный атрибут';
COMMENT ON COLUMN product_attributes.confidence_score IS 'Уровень уверенности в маппинге (0.00-1.00)';
COMMENT ON COLUMN product_attributes.auto_mapped IS 'Флаг автоматического маппинга';
COMMENT ON COLUMN product_attributes.mapping_history IS 'История изменений маппинга';
COMMENT ON COLUMN product_attributes.external_id IS 'Внешний ID атрибута в системе поставщика';
COMMENT ON COLUMN product_attributes.external_source IS 'Источник внешнего атрибута';
COMMENT ON COLUMN product_attributes.is_required IS 'Флаг обязательного атрибута';
COMMENT ON COLUMN product_attributes.validation_rules IS 'Правила валидации атрибута';
COMMENT ON COLUMN product_attributes.default_value IS 'Значение по умолчанию';
COMMENT ON COLUMN product_attributes.unit IS 'Единица измерения атрибута';
COMMENT ON COLUMN product_attributes.sort_order IS 'Порядок сортировки атрибута';

-- Создание таблицы для истории маппинга атрибутов
CREATE TABLE IF NOT EXISTS attribute_mapping_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    external_attribute_name VARCHAR(255) NOT NULL,
    internal_attribute_id UUID NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL,
    mapping_type VARCHAR(50) DEFAULT 'manual', -- manual, auto, suggested
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_attribute_mapping_history_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_attribute_mapping_history_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_attribute_mapping_history_internal_attribute_id
        FOREIGN KEY (internal_attribute_id) REFERENCES product_attributes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_attribute_mapping_history_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Индексы для таблицы истории
CREATE INDEX IF NOT EXISTS idx_attribute_mapping_history_company_id ON attribute_mapping_history (company_id);
CREATE INDEX IF NOT EXISTS idx_attribute_mapping_history_supplier_id ON attribute_mapping_history (supplier_id);
CREATE INDEX IF NOT EXISTS idx_attribute_mapping_history_external_attribute_name ON attribute_mapping_history (external_attribute_name);
CREATE INDEX IF NOT EXISTS idx_attribute_mapping_history_created_at ON attribute_mapping_history (created_at);

-- Комментарии
COMMENT ON TABLE attribute_mapping_history IS 'История маппинга атрибутов для обучения системы';
COMMENT ON COLUMN attribute_mapping_history.mapping_type IS 'Тип маппинга: manual, auto, suggested';

-- Таблица attribute_values создавалась ранее (в 011) с иным набором колонок.
-- Здесь приводим схему к единому виду: добавляем недостающие поля,
-- а если таблица отсутствует — создаем совместимую версию.
DO $$
BEGIN
  IF to_regclass('public.attribute_values') IS NULL THEN
    EXECUTE $ct$
    CREATE TABLE attribute_values (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        public_id INTEGER,
        attribute_id UUID NOT NULL,
        value TEXT NOT NULL,
        display_value VARCHAR(255),
        is_default BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

        CONSTRAINT fk_attribute_values_attribute_id
            FOREIGN KEY (attribute_id) REFERENCES product_attributes(id)
            ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT uk_attribute_values_unique
            UNIQUE (attribute_id, value)
    );
    $ct$;

    -- Совместимые ограничения для public_id
    BEGIN
      EXECUTE 'ALTER TABLE attribute_values
        ADD CONSTRAINT ck_attribute_values_public_id CHECK (public_id IS NULL OR public_id >= 100000)';
    EXCEPTION WHEN others THEN NULL; END;

  ELSE
    -- Добавляем недостающие поля к существующей таблице
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='attribute_values' AND column_name='is_default'
    ) THEN
      EXECUTE 'ALTER TABLE attribute_values ADD COLUMN is_default BOOLEAN DEFAULT FALSE';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='attribute_values' AND column_name='display_value'
    ) THEN
      EXECUTE 'ALTER TABLE attribute_values ADD COLUMN display_value VARCHAR(255)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='attribute_values' AND column_name='updated_at'
    ) THEN
      EXECUTE 'ALTER TABLE attribute_values ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL';
    END IF;
  END IF;
END $$;

-- Индексы для значений атрибутов
CREATE INDEX IF NOT EXISTS idx_attribute_values_attribute_id ON attribute_values (attribute_id);
CREATE INDEX IF NOT EXISTS idx_attribute_values_value ON attribute_values (value);
-- индексы, зависящие от новых колонок
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='attribute_values' AND column_name='is_default'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_attribute_values_is_default ON attribute_values (is_default)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='attribute_values' AND column_name='sort_order'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_attribute_values_sort_order ON attribute_values (sort_order)';
  END IF;
END $$;

-- Комментарии
COMMENT ON TABLE attribute_values IS 'Возможные значения для атрибутов типа select/multiselect';
COMMENT ON COLUMN attribute_values.value IS 'Значение атрибута';
COMMENT ON COLUMN attribute_values.is_default IS 'Флаг значения по умолчанию';

-- Создание таблицы для синонимов атрибутов
CREATE TABLE IF NOT EXISTS attribute_synonyms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_id UUID NOT NULL,
    synonym VARCHAR(255) NOT NULL,
    language VARCHAR(10) DEFAULT 'ru',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_attribute_synonyms_attribute_id
        FOREIGN KEY (attribute_id) REFERENCES product_attributes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_attribute_synonym UNIQUE (attribute_id, synonym, language)
);

-- Индексы для синонимов атрибутов
CREATE INDEX IF NOT EXISTS idx_attribute_synonyms_attribute_id ON attribute_synonyms (attribute_id);
CREATE INDEX IF NOT EXISTS idx_attribute_synonyms_synonym ON attribute_synonyms USING GIN (to_tsvector('russian', synonym));
CREATE INDEX IF NOT EXISTS idx_attribute_synonyms_language ON attribute_synonyms (language);

-- Комментарии
COMMENT ON TABLE attribute_synonyms IS 'Синонимы названий атрибутов для улучшения поиска';

-- Создание таблицы для шаблонов атрибутов
CREATE TABLE IF NOT EXISTS attribute_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID,
    attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_global BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,

    CONSTRAINT fk_attribute_templates_category_id
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_attribute_templates_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Индексы для шаблонов
CREATE INDEX IF NOT EXISTS idx_attribute_templates_name ON attribute_templates (name);
CREATE INDEX IF NOT EXISTS idx_attribute_templates_category_id ON attribute_templates (category_id);
CREATE INDEX IF NOT EXISTS idx_attribute_templates_is_global ON attribute_templates (is_global);
CREATE INDEX IF NOT EXISTS idx_attribute_templates_attributes ON attribute_templates USING GIN (attributes);

-- Комментарии
COMMENT ON TABLE attribute_templates IS 'Шаблоны атрибутов для категорий товаров';
COMMENT ON COLUMN attribute_templates.attributes IS 'JSON массив атрибутов шаблона';

DO $$
BEGIN
  -- Если в product_attributes есть category_id, строим представление с присоединением категорий,
  -- иначе создаем совместимое представление с NULL полями категории
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_attributes' AND column_name = 'category_id'
  ) THEN
    EXECUTE $v$
    CREATE OR REPLACE VIEW enhanced_attributes_view AS
    SELECT
        pa.*,
        c.name as category_name,
        c.category_path,
        av.values_array,
        asyn.synonyms_array,
        amh.mapping_count,
        amh.last_mapping_date
    FROM product_attributes pa
    LEFT JOIN categories c ON pa.category_id = c.id
    LEFT JOIN (
        SELECT
            attribute_id,
            ARRAY_AGG(value ORDER BY sort_order) as values_array
        FROM attribute_values
        WHERE is_active = true
        GROUP BY attribute_id
    ) av ON pa.id = av.attribute_id
    LEFT JOIN (
        SELECT
            attribute_id,
            ARRAY_AGG(synonym) as synonyms_array
        FROM attribute_synonyms
        WHERE is_active = true
        GROUP BY attribute_id
    ) asyn ON pa.id = asyn.attribute_id
    LEFT JOIN (
        SELECT
            internal_attribute_id,
            COUNT(*) as mapping_count,
            MAX(created_at) as last_mapping_date
        FROM attribute_mapping_history
        WHERE is_active = true
        GROUP BY internal_attribute_id
    ) amh ON pa.id = amh.internal_attribute_id
    WHERE pa.is_active = true;
    $v$;
  ELSE
    EXECUTE $v$
    CREATE OR REPLACE VIEW enhanced_attributes_view AS
    SELECT
        pa.*,
        NULL::VARCHAR as category_name,
        NULL::TEXT as category_path,
        av.values_array,
        asyn.synonyms_array,
        amh.mapping_count,
        amh.last_mapping_date
    FROM product_attributes pa
    LEFT JOIN (
        SELECT
            attribute_id,
            ARRAY_AGG(value ORDER BY sort_order) as values_array
        FROM attribute_values
        WHERE is_active = true
        GROUP BY attribute_id
    ) av ON pa.id = av.attribute_id
    LEFT JOIN (
        SELECT
            attribute_id,
            ARRAY_AGG(synonym) as synonyms_array
        FROM attribute_synonyms
        WHERE is_active = true
        GROUP BY attribute_id
    ) asyn ON pa.id = asyn.attribute_id
    LEFT JOIN (
        SELECT
            internal_attribute_id,
            COUNT(*) as mapping_count,
            MAX(created_at) as last_mapping_date
        FROM attribute_mapping_history
        WHERE is_active = true
        GROUP BY internal_attribute_id
    ) amh ON pa.id = amh.internal_attribute_id
    WHERE pa.is_active = true;
    $v$;
  END IF;
END $$;

-- Комментарий к представлению
COMMENT ON VIEW enhanced_attributes_view IS 'Расширенное представление атрибутов с дополнительной информацией';
