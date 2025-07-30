-- backend/migrations/017_fix_missing_tables.sql
-- Финальная миграция для исправления всех проблем с базой данных

-- ========================================
-- СОЗДАНИЕ НЕДОСТАЮЩИХ ТАБЛИЦ
-- ========================================

-- Создание таблицы арендаторов (tenants) если её нет
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    plan VARCHAR(50) DEFAULT 'free',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы пользователей если её нет
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Добавление tenant_id к таблицам если колонка отсутствует
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES orders(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- ========================================
-- СОЗДАНИЕ ТАБЛИЦ ДЛЯ ЗАКАЗОВ И ПОЗИЦИЙ
-- ========================================

-- Таблица заказов
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    order_number VARCHAR(100) NOT NULL,
    marketplace_id UUID REFERENCES marketplaces(id),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'new',
    total_amount DECIMAL(12,2) DEFAULT 0,
    commission_amount DECIMAL(12,2) DEFAULT 0,
    delivery_address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, order_number)
);

-- Таблица позиций заказов
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(12,2) NOT NULL,
    total_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * price) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- СОЗДАНИЕ ТАБЛИЦ ДЛЯ СИНХРОНИЗАЦИИ
-- ========================================

-- Таблица логов синхронизации
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    sync_type VARCHAR(50) NOT NULL, -- 'products', 'orders', 'stock'
    source_type VARCHAR(50) NOT NULL, -- 'supplier', 'marketplace'
    source_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'started', -- 'started', 'completed', 'failed'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    records_processed INTEGER DEFAULT 0,
    records_success INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    details JSONB DEFAULT '{}'
);

-- ========================================
-- ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ
-- ========================================

-- Индексы для таблицы products
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_brand_category ON products (brand_id, category_id);
CREATE INDEX IF NOT EXISTS idx_products_search ON products (name, internal_code);

-- Индексы для таблицы orders
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders (order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON orders (marketplace_id);

-- Индексы для таблицы order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);

-- Индексы для таблицы sync_logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_tenant_id ON sync_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs (status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs (started_at);

-- ========================================
-- ТРИГГЕРЫ ДЛЯ updated_at
-- ========================================

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Применение триггеров к таблицам
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at 
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- КОММЕНТАРИИ К ТАБЛИЦАМ
-- ========================================

COMMENT ON TABLE tenants IS 'Арендаторы (клиенты SaaS)';
COMMENT ON TABLE users IS 'Пользователи системы';
COMMENT ON TABLE orders IS 'Заказы от покупателей';
COMMENT ON TABLE order_items IS 'Позиции заказов';
COMMENT ON TABLE sync_logs IS 'Логи синхронизации с внешними системами';

-- ========================================
-- ВСТАВКА ТЕСТОВЫХ ДАННЫХ (ОПЦИОНАЛЬНО)
-- ========================================

-- Создание тестового арендатора если его нет
INSERT INTO tenants (id, name, domain, plan) 
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Test Company',
    'test.moduletrade.ru',
    'premium'
) ON CONFLICT (id) DO NOTHING;

-- Создание тестового пользователя если его нет
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin@test.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LDtHJZf.2QE2p0D12', -- password: admin123
    'Test',
    'Admin',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- ========================================
-- СОЗДАНИЕ ПРЕДСТАВЛЕНИЙ (VIEWS)
-- ========================================

-- Представление для статистики по продуктам
CREATE OR REPLACE VIEW product_stats AS
SELECT 
    p.tenant_id,
    COUNT(*) as total_products,
    COUNT(CASE WHEN p.is_active = true THEN 1 END) as active_products,
    COUNT(DISTINCT p.brand_id) as unique_brands,
    COUNT(DISTINCT p.category_id) as unique_categories,
    COUNT(CASE WHEN p.source_type = 'manual' THEN 1 END) as manual_products,
    COUNT(CASE WHEN p.source_type = 'supplier' THEN 1 END) as supplier_products
FROM products p
GROUP BY p.tenant_id;

-- Представление для статистики по заказам
CREATE OR REPLACE VIEW order_stats AS
SELECT 
    o.tenant_id,
    COUNT(*) as total_orders,
    SUM(o.total_amount) as total_revenue,
    AVG(o.total_amount) as avg_order_value,
    COUNT(CASE WHEN o.status = 'new' THEN 1 END) as new_orders,
    COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders
FROM orders o
GROUP BY o.tenant_id;

COMMENT ON VIEW product_stats IS 'Статистика по товарам для каждого арендатора';
COMMENT ON VIEW order_stats IS 'Статистика по заказам для каждого арендатора';