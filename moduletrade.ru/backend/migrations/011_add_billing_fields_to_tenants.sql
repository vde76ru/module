-- backend/migrations/011_add_billing_fields_to_tenants.sql
-- Миграция для добавления полей биллинга в таблицу tenants

-- Добавление полей биллинга в таблицу tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS tariff_id UUID REFERENCES tariffs(id),
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Создание индексов для производительности
CREATE INDEX IF NOT EXISTS idx_tenants_tariff_id ON tenants(tariff_id);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_status ON tenants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id ON tenants(stripe_customer_id);

-- Комментарии к полям
COMMENT ON COLUMN tenants.tariff_id IS 'ID текущего тарифного плана';
COMMENT ON COLUMN tenants.subscription_id IS 'ID подписки в Stripe';
COMMENT ON COLUMN tenants.subscription_status IS 'Статус подписки (active, inactive, cancelled)';
COMMENT ON COLUMN tenants.subscription_end_date IS 'Дата окончания подписки';
COMMENT ON COLUMN tenants.balance IS 'Баланс аккаунта';
COMMENT ON COLUMN tenants.stripe_customer_id IS 'ID клиента в Stripe';

-- Установка базового тарифа для существующих тенантов
UPDATE tenants 
SET tariff_id = (SELECT id FROM tariffs WHERE code = 'basic' LIMIT 1)
WHERE tariff_id IS NULL;