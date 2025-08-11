-- 020_product_documents.sql
-- Миграция для системы документов товаров

-- Создание таблицы для документов товаров
CREATE TABLE IF NOT EXISTS product_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER GENERATED ALWAYS AS IDENTITY,
    product_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500),
    external_url VARCHAR(500),
    supplier_id UUID,
    file_size BIGINT,
    mime_type VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_by UUID,

    CONSTRAINT fk_product_documents_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_documents_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_product_documents_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_product_documents_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Создание индексов
CREATE INDEX idx_product_documents_product_id ON product_documents (product_id);
CREATE INDEX idx_product_documents_document_type ON product_documents (document_type);
CREATE INDEX idx_product_documents_supplier_id ON product_documents (supplier_id);
CREATE INDEX idx_product_documents_is_active ON product_documents (is_active);
CREATE INDEX idx_product_documents_created_at ON product_documents (created_at);

-- Создание уникального индекса для public_id
CREATE UNIQUE INDEX idx_product_documents_public_id ON product_documents (public_id);

-- Комментарии к таблице
COMMENT ON TABLE product_documents IS 'Документы товаров (сертификаты, инструкции, спецификации)';
COMMENT ON COLUMN product_documents.document_type IS 'Тип документа: certificate, manual, spec, warranty, other';
COMMENT ON COLUMN product_documents.metadata IS 'Дополнительные метаданные документа';

-- Добавление полей для документов в таблицу products
ALTER TABLE products ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS certificates JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS technical_specs JSONB DEFAULT '{}'::jsonb;

-- Добавление индексов для JSON полей
CREATE INDEX IF NOT EXISTS idx_products_documents ON products USING GIN (documents);
CREATE INDEX IF NOT EXISTS idx_products_certificates ON products USING GIN (certificates);
CREATE INDEX IF NOT EXISTS idx_products_technical_specs ON products USING GIN (technical_specs);

-- Комментарии к новым полям
COMMENT ON COLUMN products.documents IS 'JSON массив документов товара';
COMMENT ON COLUMN products.certificates IS 'JSON массив сертификатов товара';
COMMENT ON COLUMN products.technical_specs IS 'JSON массив технических спецификаций';

-- Создание представления для удобного доступа к документам
CREATE OR REPLACE VIEW product_documents_view AS
SELECT
    pd.id,
    pd.public_id,
    pd.product_id,
    p.name as product_name,
    p.internal_code as product_code,
    pd.document_type,
    pd.name as document_name,
    pd.file_url,
    pd.external_url,
    pd.supplier_id,
    s.name as supplier_name,
    pd.file_size,
    pd.mime_type,
    pd.metadata,
    pd.is_active,
    pd.created_at,
    pd.updated_at,
    pd.created_by,
    u1.email as created_by_email,
    pd.updated_by,
    u2.email as updated_by_email
FROM product_documents pd
JOIN products p ON pd.product_id = p.id
LEFT JOIN suppliers s ON pd.supplier_id = s.id
LEFT JOIN users u1 ON pd.created_by = u1.id
LEFT JOIN users u2 ON pd.updated_by = u2.id
WHERE pd.is_active = true AND p.is_active = true;

-- Комментарий к представлению
COMMENT ON VIEW product_documents_view IS 'Представление для просмотра документов товаров с дополнительной информацией';
