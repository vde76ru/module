-- ================================================================
-- МИГРАЦИЯ 019: Маппинги маркетплейсов (бренды/категории/атрибуты)
-- Описание: Добавляет таблицы маппинга для маркетплейсов (например, Яндекс.Маркет)
-- Дата: 2025-08-10
-- Зависимости: 001, 003, 011, 016
-- ================================================================

-- Таблица: marketplace_category_mappings
CREATE TABLE IF NOT EXISTS marketplace_category_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_id INTEGER,
  company_id UUID NOT NULL,
  marketplace_id UUID NOT NULL,
  external_category_id VARCHAR(255) NOT NULL,
  external_category_name VARCHAR(255),
  external_category_path TEXT,
  internal_category_id UUID NOT NULL,
  is_auto_mapped BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

  CONSTRAINT fk_mkt_cat_map_company_id
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_mkt_cat_map_marketplace_id
    FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_mkt_cat_map_internal_category_id
    FOREIGN KEY (internal_category_id) REFERENCES categories(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uk_mkt_cat_map_unique
    UNIQUE (company_id, marketplace_id, external_category_id)
);

ALTER TABLE marketplace_category_mappings
  ADD CONSTRAINT ck_mkt_cat_map_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_cat_map_company_public_id
  ON marketplace_category_mappings (company_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_cat_map_company_id ON marketplace_category_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_mkt_cat_map_marketplace_id ON marketplace_category_mappings (marketplace_id);
CREATE INDEX IF NOT EXISTS idx_mkt_cat_map_external_category_id ON marketplace_category_mappings (external_category_id);
CREATE INDEX IF NOT EXISTS idx_mkt_cat_map_internal_category_id ON marketplace_category_mappings (internal_category_id);
CREATE INDEX IF NOT EXISTS idx_mkt_cat_map_is_active ON marketplace_category_mappings (is_active);

CREATE TRIGGER update_mkt_cat_map_updated_at
  BEFORE UPDATE ON marketplace_category_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER assign_mkt_cat_map_public_id
  BEFORE INSERT ON marketplace_category_mappings
  FOR EACH ROW
  EXECUTE FUNCTION assign_public_id_with_company();


-- Таблица: marketplace_attribute_mappings
CREATE TABLE IF NOT EXISTS marketplace_attribute_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_id INTEGER,
  company_id UUID NOT NULL,
  marketplace_id UUID NOT NULL,
  external_key VARCHAR(255) NOT NULL,
  internal_name VARCHAR(255) NOT NULL,
  conversion_rules JSONB DEFAULT '{}'::jsonb,
  is_auto_mapped BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

  CONSTRAINT fk_mkt_attr_map_company_id
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_mkt_attr_map_marketplace_id
    FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uk_mkt_attr_map_unique
    UNIQUE (company_id, marketplace_id, external_key)
);

ALTER TABLE marketplace_attribute_mappings
  ADD CONSTRAINT ck_mkt_attr_map_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_attr_map_company_public_id
  ON marketplace_attribute_mappings (company_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_attr_map_company_id ON marketplace_attribute_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_mkt_attr_map_marketplace_id ON marketplace_attribute_mappings (marketplace_id);
CREATE INDEX IF NOT EXISTS idx_mkt_attr_map_external_key ON marketplace_attribute_mappings (external_key);
CREATE INDEX IF NOT EXISTS idx_mkt_attr_map_is_active ON marketplace_attribute_mappings (is_active);

CREATE TRIGGER update_mkt_attr_map_updated_at
  BEFORE UPDATE ON marketplace_attribute_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER assign_mkt_attr_map_public_id
  BEFORE INSERT ON marketplace_attribute_mappings
  FOR EACH ROW
  EXECUTE FUNCTION assign_public_id_with_company();


-- Таблица: marketplace_brand_mappings (с поддержкой синонимов)
CREATE TABLE IF NOT EXISTS marketplace_brand_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_id INTEGER,
  company_id UUID NOT NULL,
  marketplace_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  external_brand_name VARCHAR(255) NOT NULL,
  external_brand_code VARCHAR(255),
  mapping_settings JSONB DEFAULT '{}'::jsonb,
  sync_enabled BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

  CONSTRAINT fk_mkt_brand_map_company_id
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_mkt_brand_map_marketplace_id
    FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_mkt_brand_map_brand_id
    FOREIGN KEY (brand_id) REFERENCES brands(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uk_mkt_brand_map_synonym
    UNIQUE (company_id, marketplace_id, brand_id, external_brand_name)
);

ALTER TABLE marketplace_brand_mappings
  ADD CONSTRAINT ck_mkt_brand_map_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_brand_map_company_public_id
  ON marketplace_brand_mappings (company_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_brand_map_company_id ON marketplace_brand_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_mkt_brand_map_marketplace_id ON marketplace_brand_mappings (marketplace_id);
CREATE INDEX IF NOT EXISTS idx_mkt_brand_map_brand_id ON marketplace_brand_mappings (brand_id);
CREATE INDEX IF NOT EXISTS idx_mkt_brand_map_external_brand_name ON marketplace_brand_mappings (external_brand_name);
CREATE INDEX IF NOT EXISTS idx_mkt_brand_map_is_active ON marketplace_brand_mappings (is_active);

CREATE TRIGGER update_mkt_brand_map_updated_at
  BEFORE UPDATE ON marketplace_brand_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER assign_mkt_brand_map_public_id
  BEFORE INSERT ON marketplace_brand_mappings
  FOR EACH ROW
  EXECUTE FUNCTION assign_public_id_with_company();


-- Отметка о применении (опционально, если используется registry)
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    INSERT INTO schema_migrations (filename, applied_at, success)
    VALUES ('019_marketplace_mappings.sql', CURRENT_TIMESTAMP, true)
    ON CONFLICT (filename) DO UPDATE SET applied_at = CURRENT_TIMESTAMP, success = true;
  END IF;
END $$;


