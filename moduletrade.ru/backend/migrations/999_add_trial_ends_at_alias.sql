-- ========================================
-- МИГРАЦИЯ 999: ДОБАВЛЕНИЕ АЛИАСА trial_ends_at
-- Для обратной совместимости с кодом
-- ========================================

-- Создаем вычисляемую колонку для совместимости
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE
GENERATED ALWAYS AS (trial_end_date) STORED;

COMMENT ON COLUMN companies.trial_ends_at IS 'Алиас для trial_end_date для обратной совместимости';

-- ========================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ
-- ========================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 999_add_trial_ends_at_alias.sql completed successfully';
END $$;