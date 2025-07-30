-- Таблица тенантов (клиентов)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    db_schema VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица пользователей
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- admin, manager, viewer
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица тарифов
CREATE TABLE tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    limits JSONB NOT NULL, -- {"products": 1000, "marketplaces": 3, etc}
    features JSONB NOT NULL, -- ["api_access", "yml_feed", etc]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица транзакций (биллинг)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    type VARCHAR(50) NOT NULL, -- subscription, api_usage, import, etc
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Модифицированная таблица товаров для PIM
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id), -- NEW: мультитенантность
    internal_code VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    brand_id UUID REFERENCES brands(id),
    category_id UUID REFERENCES categories(id),
    attributes JSONB DEFAULT '{}',
    source_type VARCHAR(50) NOT NULL, -- NEW: 'supplier' или 'internal'
    is_active BOOLEAN DEFAULT TRUE,
    main_supplier_id UUID REFERENCES suppliers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, internal_code)
);

CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_source_type ON products(source_type);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_attributes ON products USING GIN(attributes);

-- Таблица остатков для внутренних товаров
CREATE TABLE internal_product_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    warehouse_name VARCHAR(255) DEFAULT 'main',
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    price DECIMAL(12,2) NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, warehouse_name)
);

-- Таблица связей товар-поставщик
CREATE TABLE product_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    supplier_id UUID REFERENCES suppliers(id),
    supplier_code VARCHAR(100) NOT NULL, -- код товара у поставщика
    supplier_article VARCHAR(255), -- артикул производителя у поставщика
    price DECIMAL(12,2),
    quantity INTEGER DEFAULT 0,
    delivery_days INTEGER DEFAULT 0,
    last_sync TIMESTAMP,
    UNIQUE(supplier_id, supplier_code)
);

-- Таблица складов маркетплейсов
CREATE TABLE marketplace_warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketplace_id UUID REFERENCES marketplaces(id),
    supplier_id UUID REFERENCES suppliers(id),
    warehouse_code VARCHAR(100) NOT NULL,
    warehouse_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    UNIQUE(marketplace_id, warehouse_code)
);

-- Таблица заказов
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    marketplace_id UUID REFERENCES marketplaces(id),
    marketplace_order_id VARCHAR(255) NOT NULL,
    warehouse_id UUID REFERENCES marketplace_warehouses(id),
    status VARCHAR(50) NOT NULL,
    total_amount DECIMAL(12,2),
    commission_amount DECIMAL(12,2),
    order_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    commission_rate DECIMAL(5,2)
);

-- Таблица заказов поставщикам
CREATE TABLE supplier_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_order_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    total_amount DECIMAL(12,2),
    scheduled_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supplier_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_order_id UUID REFERENCES supplier_orders(id),
    product_supplier_id UUID REFERENCES product_suppliers(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(12,2) NOT NULL
);

-- Связь заказов маркетплейса с заказами поставщику
CREATE TABLE order_supplier_order_mapping (
    order_item_id UUID REFERENCES order_items(id),
    supplier_order_item_id UUID REFERENCES supplier_order_items(id),
    PRIMARY KEY (order_item_id, supplier_order_item_id)
);

