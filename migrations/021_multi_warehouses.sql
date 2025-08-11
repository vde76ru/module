-- 021_multi_warehouses.sql
-- Миграция для системы мульти-складов

-- Компоненты мульти-складов: таблица создается в 005. Здесь гарантируем
-- наличие недостающих колонок без дублирования создания таблицы/индексов.
DO $$
BEGIN
  IF to_regclass('public.multi_warehouse_components') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'multi_warehouse_components' AND column_name = 'priority'
    ) THEN
      ALTER TABLE multi_warehouse_components ADD COLUMN priority INTEGER DEFAULT 1;
    END IF;
    -- Обновим комментарии на колонках/таблице (идемпотентно)
    BEGIN
      COMMENT ON TABLE multi_warehouse_components IS 'Компоненты мульти-складов';
      COMMENT ON COLUMN multi_warehouse_components.weight IS 'Вес компонента в общем остатке (от 0.01 до 10.00)';
      COMMENT ON COLUMN multi_warehouse_components.priority IS 'Приоритет компонента при распределении товаров';
    EXCEPTION WHEN others THEN
      -- игнорируем, если нет прав на комментарии
      NULL;
    END;
  END IF;
END $$;

-- Добавление полей для мульти-складов в warehouse_product_links
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS multi_warehouse_id UUID;
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS distribution_weight DECIMAL(5,2) DEFAULT 1.00;
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS auto_distributed BOOLEAN DEFAULT FALSE;

-- Добавление внешнего ключа
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_warehouse_product_links_multi_warehouse_id'
      AND conrelid = 'public.warehouse_product_links'::regclass
  ) THEN
    ALTER TABLE warehouse_product_links ADD CONSTRAINT fk_warehouse_product_links_multi_warehouse_id
      FOREIGN KEY (multi_warehouse_id) REFERENCES warehouses(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_warehouse_product_links_multi_warehouse_id ON warehouse_product_links (multi_warehouse_id);

-- Комментарии к новым полям
COMMENT ON COLUMN warehouse_product_links.multi_warehouse_id IS 'ID мульти-склада для автоматического распределения';
COMMENT ON COLUMN warehouse_product_links.distribution_weight IS 'Вес при распределении по мульти-складу';
COMMENT ON COLUMN warehouse_product_links.auto_distributed IS 'Флаг автоматического распределения';

-- Добавление поля типа склада в таблицу warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_type VARCHAR(50) DEFAULT 'physical';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_multi_warehouse BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_warehouses_warehouse_type ON warehouses (warehouse_type);
CREATE INDEX IF NOT EXISTS idx_warehouses_is_multi_warehouse ON warehouses (is_multi_warehouse);

-- Комментарии к новым полям
COMMENT ON COLUMN warehouses.warehouse_type IS 'Тип склада: physical, virtual, multi_warehouse';
COMMENT ON COLUMN warehouses.is_multi_warehouse IS 'Флаг мульти-склада';

-- Создание представления для мульти-складов
CREATE OR REPLACE VIEW multi_warehouse_stock_view AS
SELECT
    mw.id as multi_warehouse_id,
    mw.name as multi_warehouse_name,
    mw.code as multi_warehouse_code,
    p.id as product_id,
    p.name as product_name,
    p.internal_code as product_code,
    SUM(wpl.available_quantity * mwc.weight) as total_quantity,
    AVG(wpl.price) as avg_price,
    MIN(wpl.price) as min_price,
    MAX(wpl.price) as max_price,
    COUNT(DISTINCT mwc.component_warehouse_id) as warehouses_count,
    ARRAY_AGG(DISTINCT w.name) as warehouse_names
FROM warehouses mw
JOIN multi_warehouse_components mwc ON mw.id = mwc.multi_warehouse_id
JOIN warehouse_product_links wpl ON mwc.component_warehouse_id = wpl.warehouse_id
JOIN products p ON wpl.product_id = p.id
JOIN warehouses w ON mwc.component_warehouse_id = w.id
WHERE mw.warehouse_type = 'multi_warehouse'
    AND mwc.is_active = true
    AND wpl.is_active = true
    AND p.is_active = true
GROUP BY mw.id, mw.name, mw.code, p.id, p.name, p.internal_code;

-- Комментарий к представлению
COMMENT ON VIEW multi_warehouse_stock_view IS 'Представление для просмотра остатков по мульти-складам';
