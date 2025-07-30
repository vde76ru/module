-- backend/migrations/013_create_billing_transactions.sql
-- Создание таблицы для транзакций биллинга

-- Таблица транзакций биллинга
CREATE TABLE IF NOT EXISTS billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    type VARCHAR(50) NOT NULL, -- payment, subscription, api_usage, refund
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    stripe_payment_intent_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание индексов для производительности
CREATE INDEX IF NOT EXISTS idx_billing_transactions_tenant ON billing_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_type ON billing_transactions(type);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_status ON billing_transactions(status);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_created ON billing_transactions(created_at);

-- Комментарии к таблице и полям
COMMENT ON TABLE billing_transactions IS 'Транзакции биллинговой системы';
COMMENT ON COLUMN billing_transactions.type IS 'Тип транзакции: payment, subscription, api_usage, refund';
COMMENT ON COLUMN billing_transactions.status IS 'Статус транзакции: pending, completed, failed';
COMMENT ON COLUMN billing_transactions.stripe_payment_intent_id IS 'ID платежа в Stripe';
COMMENT ON COLUMN billing_transactions.metadata IS 'Дополнительные данные в JSON формате';