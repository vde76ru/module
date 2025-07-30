-- Таблица поставщиков
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    api_type VARCHAR(50) NOT NULL, -- 'etm', 'rs24', 'custom'
    api_config JSONB NOT NULL, -- конфигурация API
    is_main BOOLEAN DEFAULT FALSE, -- основной поставщик
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица маркетплейсов
CREATE TABLE marketplaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    api_type VARCHAR(50) NOT NULL, -- 'ozon', 'yandex', 'wildberries'
    api_config JSONB NOT NULL,
    commission_rules JSONB NOT NULL, -- правила комиссий по категориям
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица брендов с маппингом
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name VARCHAR(255) UNIQUE NOT NULL, -- унифицированное название
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brand_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id),
    source_type VARCHAR(50) NOT NULL, -- 'supplier', 'marketplace'
    source_id UUID NOT NULL, -- ID поставщика или маркетплейса
    source_name VARCHAR(255) NOT NULL, -- название у источника
    UNIQUE(source_type, source_id, source_name)
);

-- Таблица категорий с иерархией
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id),
    canonical_name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL, -- материализованный путь
    level INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE category_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id),
    source_type VARCHAR(50) NOT NULL,
    source_id UUID NOT NULL,
    source_code VARCHAR(255),
    source_name VARCHAR(500) NOT NULL,
    UNIQUE(source_type, source_id, source_code)
);

-- Таблица атрибутов
CREATE TABLE attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name VARCHAR(255) UNIQUE NOT NULL,
    data_type VARCHAR(50) NOT NULL, -- 'string', 'number', 'boolean'
    unit_type VARCHAR(50), -- 'length', 'weight', 'power', etc
    default_unit VARCHAR(20), -- 'mm', 'kg', 'W'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attribute_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribute_id UUID REFERENCES attributes(id),
    source_type VARCHAR(50) NOT NULL,
    source_id UUID NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    unit_conversion JSONB, -- правила конвертации единиц
    UNIQUE(source_type, source_id, source_name)
);
