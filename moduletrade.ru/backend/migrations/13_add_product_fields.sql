-- =====================================
-- МИГРАЦИЯ: Добавление недостающих полей в products
-- ФАЙЛ: backend/migrations/013_add_product_fields.sql
-- =====================================

-- Добавляем недостающие поля в таблицу products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS sku VARCHAR(255),
ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS length DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS width DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS height DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS base_unit VARCHAR(20) DEFAULT 'pcs',
ADD COLUMN IF NOT EXISTS is_divisible BOOLEAN DEFAULT true;

-- Создаем таблицу категорий если ее нет
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    path TEXT,
    level INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, name, parent_id)
);

-- Добавляем связь products -> categories
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_company_sku ON products(company_id, sku);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_company_id ON categories(company_id);