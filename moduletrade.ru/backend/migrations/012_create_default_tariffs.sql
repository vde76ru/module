-- backend/migrations/012_create_default_tariffs.sql
-- Создание базовых тарифных планов

-- Вставка базовых тарифов
INSERT INTO tariffs (name, code, price, limits, features, is_active) VALUES
('Базовый', 'basic', 0.00, 
 '{"products": 100, "marketplaces": 1, "api_calls": 1000}',
 '["basic_sync", "manual_import"]', 
 true),
('Стандарт', 'standard', 2900.00,
 '{"products": 1000, "marketplaces": 3, "api_calls": 10000}',
 '["advanced_sync", "auto_import", "analytics"]',
 true),
('Профессиональный', 'professional', 9900.00,
 '{"products": 10000, "marketplaces": -1, "api_calls": 100000}',
 '["full_sync", "auto_import", "advanced_analytics", "api_access"]',
 true)
ON CONFLICT (code) DO NOTHING;

-- Обновление существующих тенантов базовым тарифом
UPDATE tenants 
SET tariff_id = (SELECT id FROM tariffs WHERE code = 'basic' LIMIT 1),
    subscription_status = 'active'
WHERE tariff_id IS NULL;