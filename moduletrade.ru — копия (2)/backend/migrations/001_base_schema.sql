-- ================================================================
-- МИГРАЦИЯ 001: Базовая схема и расширения
-- Описание: Включает необходимые расширения, функцию-триггер и базовые таблицы
-- Дата: 2025-01-27
-- Назначение: Подготовка основы для последующих миграций
-- ================================================================

-- Расширения, необходимые проекту
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ================================================================
-- ПУБЛИЧНЫЕ ID: инфраструктура (счетчики и функции)
-- ================================================================

-- Универсальная функция для обновления поля updated_at
-- ВАЖНО: ДОЛЖНА БЫТЬ ОБЪЯВЛЕНА ДО ЛЮБОГО ТРИГГЕРА, КОТОРЫЙ ЕЕ ИСПОЛЬЗУЕТ
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Таблица счетчиков public_id по таблице и компании (NULL = глобально)
CREATE TABLE IF NOT EXISTS public_id_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  company_id UUID,
  last_value INTEGER NOT NULL DEFAULT 99999,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT uq_public_id_counters UNIQUE (table_name, company_id)
);

CREATE TRIGGER update_public_id_counters_updated_at
  BEFORE UPDATE ON public_id_counters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Функция: атомарно получить следующий public_id для таблицы/компании
CREATE OR REPLACE FUNCTION get_next_public_id(
  p_table_name TEXT,
  p_company_id UUID DEFAULT NULL,
  p_min_start INTEGER DEFAULT 100000
) RETURNS INTEGER AS $$
DECLARE
  v_next INTEGER;
BEGIN
  IF p_min_start IS NULL OR p_min_start < 1 THEN
    p_min_start := 100000;
  END IF;

  -- Гарантируем существование строки счетчика
  INSERT INTO public_id_counters (table_name, company_id, last_value)
  VALUES (p_table_name, p_company_id, p_min_start - 1)
  ON CONFLICT (table_name, company_id) DO NOTHING;

  -- Атомарно увеличиваем и возвращаем значение
  UPDATE public_id_counters
  SET last_value = public_id_counters.last_value + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE table_name = p_table_name AND (
    (company_id IS NULL AND p_company_id IS NULL) OR company_id = p_company_id
  )
  RETURNING last_value INTO v_next;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Триггер: присвоение public_id для таблиц с полем company_id
CREATE OR REPLACE FUNCTION assign_public_id_with_company()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_id IS NULL THEN
    NEW.public_id := get_next_public_id(TG_TABLE_NAME, NEW.company_id, 100000);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер: присвоение public_id для глобальных таблиц (без company_id)
CREATE OR REPLACE FUNCTION assign_public_id_global()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_id IS NULL THEN
    NEW.public_id := get_next_public_id(TG_TABLE_NAME, NULL, 100000);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (перенесено выше) Функция update_updated_at_column уже объявлена

-- ================================================================
-- ТАБЛИЦА: Tariffs — тарифные планы
-- ================================================================
CREATE TABLE IF NOT EXISTS tariffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_id INTEGER,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  features JSONB DEFAULT '{}'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  monthly_price DECIMAL(12,2),
  yearly_price DECIMAL(12,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tariffs_is_active ON tariffs (is_active);
ALTER TABLE tariffs
  ADD CONSTRAINT ck_tariffs_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tariffs_public_id ON tariffs (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER update_tariffs_updated_at
  BEFORE UPDATE ON tariffs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER assign_tariffs_public_id
  BEFORE INSERT ON tariffs
  FOR EACH ROW
  EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Roles — роли пользователей
-- ================================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_id INTEGER,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_is_active ON roles (is_active);
ALTER TABLE roles
  ADD CONSTRAINT ck_roles_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_public_id ON roles (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER assign_roles_public_id
  BEFORE INSERT ON roles
  FOR EACH ROW
  EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Brands — бренды
-- ================================================================
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_id INTEGER,
  name VARCHAR(255) UNIQUE NOT NULL,
  canonical_name VARCHAR(255),
  -- Настройки ценообразования на уровне бренда (используются в сервисах)
  wholesale_markup DECIMAL(5,2),
  retail_markup DECIMAL(5,2),
  mrp_price DECIMAL(12,2),
  rrp_price DECIMAL(12,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brands_name ON brands (name);
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm ON brands USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_brands_is_active ON brands (is_active);
ALTER TABLE brands
  ADD CONSTRAINT ck_brands_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_public_id ON brands (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER assign_brands_public_id
  BEFORE INSERT ON brands
  FOR EACH ROW
  EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Categories — категории товаров
-- Внимание: поле company_id добавлено без внешнего ключа, т.к. таблица
-- companies создается в миграции 002. Внешний ключ можно добавить позднее.
-- ================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_id INTEGER,
  company_id UUID,
  name VARCHAR(255) NOT NULL,
  parent_id UUID,
  level INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT fk_categories_parent_id
    FOREIGN KEY (parent_id) REFERENCES categories(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_company_id ON categories (company_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories (is_active);
CREATE INDEX IF NOT EXISTS idx_categories_name_trgm ON categories USING gin (name gin_trgm_ops);
ALTER TABLE categories
  ADD CONSTRAINT ck_categories_public_id CHECK (public_id IS NULL OR public_id >= 100000);
-- Уникальность public_id: отдельно для company_id IS NOT NULL и IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_company_public_id
  ON categories (company_id, public_id)
  WHERE public_id IS NOT NULL AND company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_public_id_global
  ON categories (public_id)
  WHERE public_id IS NOT NULL AND company_id IS NULL;

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER assign_categories_public_id
  BEFORE INSERT ON categories
  FOR EACH ROW
  EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: generate_unique_code
-- Назначение: генерирует уникальное значение кода с префиксом заданной длины
-- Пример: generate_unique_code('products', 'internal_code', 'PRD', 8)
-- ================================================================
CREATE OR REPLACE FUNCTION generate_unique_code(
  p_table_name TEXT,
  p_column_name TEXT,
  p_prefix TEXT DEFAULT '',
  p_random_length INTEGER DEFAULT 8
) RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN := TRUE;
BEGIN
  IF p_random_length < 1 THEN
    p_random_length := 8;
  END IF;

  WHILE v_exists LOOP
    v_code := COALESCE(p_prefix, '') || upper(substr(encode(gen_random_bytes(16), 'hex'), 1, p_random_length));
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE %I = $1)', p_table_name, p_column_name)
      INTO v_exists USING v_code;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Конец миграции 001
