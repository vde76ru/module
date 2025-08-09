-- ================================================================
-- МИГРАЦИЯ 016: Выравнивание схемы с кодом backend
-- Описание: Добавляет недостающие таблицы/поля, которые используются кодом
-- Дата: 2025-01-27
-- Зависимости: все предыдущие миграции
-- ================================================================

-- 1) Добавляем колонку price в products (используется при синхронизации цен)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'price'
  ) THEN
    ALTER TABLE products ADD COLUMN price DECIMAL(12,2);
    COMMENT ON COLUMN products.price IS 'Текущая базовая цена товара (для быстрой выборки)';
  END IF;
END $$;

-- 2) Создаем таблицу связей товаров с поставщиками, если отсутствует
CREATE TABLE IF NOT EXISTS product_supplier_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_id INTEGER,
  company_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  product_id UUID NOT NULL,
  supplier_product_id VARCHAR(255),
  external_sku VARCHAR(255),
  supplier_price DECIMAL(12,2),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(50) DEFAULT 'pending',
  sync_errors JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

  CONSTRAINT fk_psl_company_id
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_psl_supplier_id
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_psl_product_id
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_psl_company_supplier_product_ext
  ON product_supplier_links (company_id, supplier_id, supplier_product_id);

CREATE INDEX IF NOT EXISTS idx_psl_company_id ON product_supplier_links (company_id);
CREATE INDEX IF NOT EXISTS idx_psl_supplier_id ON product_supplier_links (supplier_id);
CREATE INDEX IF NOT EXISTS idx_psl_product_id ON product_supplier_links (product_id);
CREATE INDEX IF NOT EXISTS idx_psl_sync_status ON product_supplier_links (sync_status);

CREATE TRIGGER update_product_supplier_links_updated_at
  BEFORE UPDATE ON product_supplier_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE product_supplier_links
  ADD CONSTRAINT ck_product_supplier_links_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_supplier_links_company_public_id
  ON product_supplier_links (company_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_product_supplier_links_public_id
  BEFORE INSERT ON product_supplier_links
  FOR EACH ROW
  EXECUTE FUNCTION assign_public_id_with_company();

COMMENT ON TABLE product_supplier_links IS 'Связи товаров с поставщиками и данные синхронизации';

-- 2.1) Добавляем недостающие поля в roles для RBAC
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'display_name'
  ) THEN
ALTER TABLE roles ADD COLUMN display_name VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE roles ADD COLUMN permissions JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2.2) Добавляем недостающие поля в companies, ожидаемые кодом
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'status'
  ) THEN
    ALTER TABLE companies ADD COLUMN status VARCHAR(20) DEFAULT 'trial';
  END IF;
END $$;

-- 2.3) Добавляем недостающие поля в categories (path, sort_order) для фронтенда/бэкенда
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'path'
  ) THEN
    ALTER TABLE categories ADD COLUMN path TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2.4) Начальные данные: тариф "Пробный" и системные роли
INSERT INTO tariffs (name, description, features, limits, monthly_price, yearly_price, is_active)
SELECT 'Пробный', 'Бесплатный пробный тариф на 14 дней', '{}', jsonb_build_object('products', 100, 'marketplaces', 1, 'users', 3), 0, 0, true
WHERE NOT EXISTS (SELECT 1 FROM tariffs WHERE name = 'Пробный');

-- Системные роли с JSON правами
INSERT INTO roles (name, code, display_name, description, is_system, is_active, permissions)
SELECT 'Владелец', 'owner', 'Владелец', 'Владелец аккаунта, полный доступ', true, true, jsonb_build_object('all', true)
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'owner');

INSERT INTO roles (name, code, display_name, description, is_system, is_active, permissions)
SELECT 'Администратор', 'admin', 'Администратор', 'Управление настройками и данными', true, true,
       jsonb_build_object(
         'products', jsonb_build_array('view','create','update','delete','export','import','manage'),
         'warehouses', jsonb_build_array('view','update','transfer'),
         'sync', jsonb_build_array('execute'),
         'users', jsonb_build_array('view','create','update'),
         'suppliers', jsonb_build_array('view','manage')
       )
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'admin');

INSERT INTO roles (name, code, display_name, description, is_system, is_active, permissions)
SELECT 'Менеджер', 'manager', 'Менеджер', 'Операционные задачи', false, true,
       jsonb_build_object(
         'products', jsonb_build_array('view','create','update','export','import'),
         'warehouses', jsonb_build_array('view','update','transfer'),
         'sync', jsonb_build_array('execute')
       )
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'manager');

INSERT INTO roles (name, code, display_name, description, is_system, is_active, permissions)
SELECT 'Оператор', 'operator', 'Оператор', 'Просмотр и базовые операции', false, true,
       jsonb_build_object(
         'products', jsonb_build_array('view'),
         'warehouses', jsonb_build_array('view')
       )
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'operator');

-- 3) Создаем таблицу связей складов с маркетплейсами (используется WarehouseService)
CREATE TABLE IF NOT EXISTS warehouse_marketplace_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL,
  marketplace_id UUID NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

  CONSTRAINT fk_wmc_warehouse_id
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_wmc_marketplace_id
    FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE warehouse_marketplace_connections
  ADD CONSTRAINT uk_wmc_warehouse_marketplace UNIQUE (warehouse_id, marketplace_id);

CREATE INDEX IF NOT EXISTS idx_wmc_warehouse_id ON warehouse_marketplace_connections (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wmc_marketplace_id ON warehouse_marketplace_connections (marketplace_id);
CREATE INDEX IF NOT EXISTS idx_wmc_is_active ON warehouse_marketplace_connections (is_active);

CREATE TRIGGER update_wmc_updated_at
  BEFORE UPDATE ON warehouse_marketplace_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE warehouse_marketplace_connections IS 'Связи складов с маркетплейсами и их настройки';

-- 4) Добавляем недостающие колонки в warehouses, которые ожидает код
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'city'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN city VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN contact_person VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'phone'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN phone VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'email'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN email VARCHAR(255);
  END IF;
END $$;

-- Конец миграции 016
