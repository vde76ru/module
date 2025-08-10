-- ================================================================
-- МИГРАЦИЯ 018: Синонимы брендов и подтверждение маппингов
-- Описание: Разрешаем несколько внешних названий (синонимов) на один бренд
--            у одного поставщика. Добавляем вспомогательные индексы.
-- Дата: 2025-08-10
-- Зависимости: 011, 012 (brand_supplier_mappings)
-- ================================================================

DO $$
BEGIN
  -- Снимаем старый уникальный ключ, если существует
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uk_brand_supplier_mappings_unique'
      AND conrelid = 'public.brand_supplier_mappings'::regclass
  ) THEN
    ALTER TABLE brand_supplier_mappings
      DROP CONSTRAINT uk_brand_supplier_mappings_unique;
  END IF;

  -- Убеждаемся, что колонка external_brand_name существует (добавлялась в 012)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_supplier_mappings' AND column_name = 'external_brand_name'
  ) THEN
    ALTER TABLE brand_supplier_mappings ADD COLUMN external_brand_name VARCHAR(255);
  END IF;

  -- Новый уникальный ключ: один бренд может иметь несколько внешних названий (синонимов)
  -- но одно и то же внешнее название не должно дублироваться для того же бренда/поставщика/компании
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uk_brand_supplier_mappings_by_synonym'
      AND conrelid = 'public.brand_supplier_mappings'::regclass
  ) THEN
    ALTER TABLE brand_supplier_mappings
      ADD CONSTRAINT uk_brand_supplier_mappings_by_synonym
      UNIQUE (company_id, supplier_id, brand_id, external_brand_name);
  END IF;

  -- Индекс по внешнему названию бренда для быстрого поиска
  CREATE INDEX IF NOT EXISTS idx_brand_supplier_mappings_external_brand_name
    ON brand_supplier_mappings (external_brand_name);

END $$;

-- Отмечаем миграцию примененной
DO $$
BEGIN
  INSERT INTO schema_migrations (filename, applied_at, success)
  VALUES ('018_brand_mapping_synonyms.sql', CURRENT_TIMESTAMP, true)
  ON CONFLICT (filename) DO UPDATE SET applied_at = CURRENT_TIMESTAMP, success = true;
END $$;


