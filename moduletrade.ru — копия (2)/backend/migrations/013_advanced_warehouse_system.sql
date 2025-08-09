-- ================================================================
-- МИГРАЦИЯ 013: Продвинутая система управления складами
-- Описание: Создает расширенную систему управления складами с интеграцией маркетплейсов
-- Дата: 2025-01-27
-- Блок: Склады и цены
-- Зависимости: Все предыдущие миграции
-- ================================================================

-- ================================================================
-- ОБНОВЛЕНИЕ ТАБЛИЦЫ: Warehouses - Добавляем поля для маркетплейсов
-- ================================================================

-- Добавляем новые поля в таблицу warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_type VARCHAR(50) DEFAULT 'physical';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS region VARCHAR(255);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'RU';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Moscow';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{}'::jsonb;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS delivery_zones JSONB DEFAULT '{}'::jsonb;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS marketplace_integrations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS pricing_settings JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN warehouses.warehouse_type IS 'Тип склада: physical, virtual, marketplace';
COMMENT ON COLUMN warehouses.city IS 'Город склада';
COMMENT ON COLUMN warehouses.region IS 'Регион склада';
COMMENT ON COLUMN warehouses.country IS 'Страна склада';
COMMENT ON COLUMN warehouses.timezone IS 'Часовой пояс склада';
COMMENT ON COLUMN warehouses.working_hours IS 'Рабочие часы склада';
COMMENT ON COLUMN warehouses.delivery_zones IS 'Зоны доставки склада';
COMMENT ON COLUMN warehouses.marketplace_integrations IS 'Интеграции с маркетплейсами';
COMMENT ON COLUMN warehouses.pricing_settings IS 'Настройки ценообразования склада';

-- ================================================================
-- ТАБЛИЦА: Warehouse_Marketplace_Integrations - Интеграции складов с маркетплейсами
-- ================================================================
CREATE TABLE IF NOT EXISTS warehouse_marketplace_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    warehouse_id UUID NOT NULL,
    marketplace_id UUID NOT NULL,
    external_warehouse_id VARCHAR(255),
    external_warehouse_name VARCHAR(255),
    integration_status VARCHAR(50) DEFAULT 'pending',
    settings JSONB DEFAULT '{}'::jsonb,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_warehouse_marketplace_integrations_warehouse_id
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_warehouse_marketplace_integrations_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_warehouse_marketplace_integrations_unique
        UNIQUE (warehouse_id, marketplace_id)
);
ALTER TABLE warehouse_marketplace_integrations
    ADD CONSTRAINT ck_warehouse_marketplace_integrations_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouse_marketplace_integrations_public_id ON warehouse_marketplace_integrations (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_warehouse_marketplace_integrations_public_id
    BEFORE INSERT ON warehouse_marketplace_integrations
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

COMMENT ON TABLE warehouse_marketplace_integrations IS 'Интеграции складов с маркетплейсами';
COMMENT ON COLUMN warehouse_marketplace_integrations.warehouse_id IS 'Склад';
COMMENT ON COLUMN warehouse_marketplace_integrations.marketplace_id IS 'Маркетплейс';
COMMENT ON COLUMN warehouse_marketplace_integrations.external_warehouse_id IS 'Внешний ID склада на маркетплейсе';
COMMENT ON COLUMN warehouse_marketplace_integrations.external_warehouse_name IS 'Внешнее название склада';
COMMENT ON COLUMN warehouse_marketplace_integrations.integration_status IS 'Статус интеграции';
COMMENT ON COLUMN warehouse_marketplace_integrations.settings IS 'Настройки интеграции';
COMMENT ON COLUMN warehouse_marketplace_integrations.last_sync_at IS 'Дата последней синхронизации';
COMMENT ON COLUMN warehouse_marketplace_integrations.is_active IS 'Активна ли интеграция';

-- ================================================================
-- ОБНОВЛЕНИЕ ТАБЛИЦЫ: Warehouse_Product_Links - Добавляем поля для цен
-- ================================================================
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12,2);
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(12,2);
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS retail_price DECIMAL(12,2);
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS website_price DECIMAL(12,2);
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS marketplace_price DECIMAL(12,2);
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS mrp_price DECIMAL(12,2);
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS rrp_price DECIMAL(12,2);
ALTER TABLE warehouse_product_links ADD COLUMN IF NOT EXISTS price_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN warehouse_product_links.purchase_price IS 'Цена закупки';
COMMENT ON COLUMN warehouse_product_links.wholesale_price IS 'Оптовая цена';
COMMENT ON COLUMN warehouse_product_links.retail_price IS 'Розничная цена';
COMMENT ON COLUMN warehouse_product_links.website_price IS 'Цена для сайта';
COMMENT ON COLUMN warehouse_product_links.marketplace_price IS 'Цена для маркетплейса';
COMMENT ON COLUMN warehouse_product_links.mrp_price IS 'Минимальная розничная цена';
COMMENT ON COLUMN warehouse_product_links.rrp_price IS 'Рекомендуемая розничная цена';
COMMENT ON COLUMN warehouse_product_links.price_history IS 'История изменения цен';

-- ================================================================
-- ТАБЛИЦА: Price_Calculation_Rules - Правила расчета цен
-- ================================================================
CREATE TABLE IF NOT EXISTS price_calculation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    warehouse_id UUID,
    brand_id UUID,
    category_id UUID,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'markup', 'discount', 'formula', 'fixed'
    price_type VARCHAR(50) NOT NULL, -- 'wholesale', 'retail', 'website', 'marketplace'
    priority INTEGER DEFAULT 0,
    conditions JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_price_calculation_rules_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_price_calculation_rules_warehouse_id
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_price_calculation_rules_brand_id
        FOREIGN KEY (brand_id) REFERENCES brands(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_price_calculation_rules_category_id
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE price_calculation_rules
    ADD CONSTRAINT ck_price_calculation_rules_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_calculation_rules_company_public_id ON price_calculation_rules (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_price_calculation_rules_public_id
    BEFORE INSERT ON price_calculation_rules
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

COMMENT ON TABLE price_calculation_rules IS 'Правила расчета цен';
COMMENT ON COLUMN price_calculation_rules.company_id IS 'Компания';
COMMENT ON COLUMN price_calculation_rules.warehouse_id IS 'Склад (NULL для всех складов)';
COMMENT ON COLUMN price_calculation_rules.brand_id IS 'Бренд (NULL для всех брендов)';
COMMENT ON COLUMN price_calculation_rules.category_id IS 'Категория (NULL для всех категорий)';
COMMENT ON COLUMN price_calculation_rules.rule_name IS 'Название правила';
COMMENT ON COLUMN price_calculation_rules.rule_type IS 'Тип правила';
COMMENT ON COLUMN price_calculation_rules.price_type IS 'Тип цены';
COMMENT ON COLUMN price_calculation_rules.priority IS 'Приоритет правила';
COMMENT ON COLUMN price_calculation_rules.conditions IS 'Условия применения правила';
COMMENT ON COLUMN price_calculation_rules.settings IS 'Настройки правила';
COMMENT ON COLUMN price_calculation_rules.valid_from IS 'Дата начала действия';
COMMENT ON COLUMN price_calculation_rules.valid_until IS 'Дата окончания действия';
COMMENT ON COLUMN price_calculation_rules.is_active IS 'Активно ли правило';

-- ================================================================
-- ТАБЛИЦА: Supplier_Discounts - Скидки от поставщиков
-- ================================================================
CREATE TABLE IF NOT EXISTS supplier_discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    brand_id UUID,
    category_id UUID,
    discount_type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed', 'tier'
    discount_value DECIMAL(10,2) NOT NULL,
    min_quantity DECIMAL(12,3),
    max_quantity DECIMAL(12,3),
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    conditions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_supplier_discounts_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_discounts_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_discounts_brand_id
        FOREIGN KEY (brand_id) REFERENCES brands(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_discounts_category_id
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE supplier_discounts
    ADD CONSTRAINT ck_supplier_discounts_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_discounts_company_public_id ON supplier_discounts (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_supplier_discounts_public_id
    BEFORE INSERT ON supplier_discounts
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

COMMENT ON TABLE supplier_discounts IS 'Скидки от поставщиков';
COMMENT ON COLUMN supplier_discounts.company_id IS 'Компания';
COMMENT ON COLUMN supplier_discounts.supplier_id IS 'Поставщик';
COMMENT ON COLUMN supplier_discounts.brand_id IS 'Бренд (NULL для всех брендов)';
COMMENT ON COLUMN supplier_discounts.category_id IS 'Категория (NULL для всех категорий)';
COMMENT ON COLUMN supplier_discounts.discount_type IS 'Тип скидки';
COMMENT ON COLUMN supplier_discounts.discount_value IS 'Значение скидки';
COMMENT ON COLUMN supplier_discounts.min_quantity IS 'Минимальное количество для скидки';
COMMENT ON COLUMN supplier_discounts.max_quantity IS 'Максимальное количество для скидки';
COMMENT ON COLUMN supplier_discounts.valid_from IS 'Дата начала действия скидки';
COMMENT ON COLUMN supplier_discounts.valid_until IS 'Дата окончания действия скидки';
COMMENT ON COLUMN supplier_discounts.conditions IS 'Дополнительные условия';
COMMENT ON COLUMN supplier_discounts.is_active IS 'Активна ли скидка';

-- ================================================================
-- ТАБЛИЦА: Marketplace_Commissions - Комиссии маркетплейсов
-- ================================================================
CREATE TABLE IF NOT EXISTS marketplace_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    marketplace_id UUID NOT NULL,
    category_id UUID,
    commission_type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed', 'tier'
    commission_value DECIMAL(10,2) NOT NULL,
    min_amount DECIMAL(12,2),
    max_amount DECIMAL(12,2),
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    conditions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_marketplace_commissions_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_marketplace_commissions_marketplace_id
        FOREIGN KEY (marketplace_id) REFERENCES marketplaces(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_marketplace_commissions_category_id
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE marketplace_commissions
    ADD CONSTRAINT ck_marketplace_commissions_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_commissions_company_public_id ON marketplace_commissions (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_marketplace_commissions_public_id
    BEFORE INSERT ON marketplace_commissions
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

COMMENT ON TABLE marketplace_commissions IS 'Комиссии маркетплейсов';
COMMENT ON COLUMN marketplace_commissions.company_id IS 'Компания';
COMMENT ON COLUMN marketplace_commissions.marketplace_id IS 'Маркетплейс';
COMMENT ON COLUMN marketplace_commissions.category_id IS 'Категория (NULL для всех категорий)';
COMMENT ON COLUMN marketplace_commissions.commission_type IS 'Тип комиссии';
COMMENT ON COLUMN marketplace_commissions.commission_value IS 'Значение комиссии';
COMMENT ON COLUMN marketplace_commissions.min_amount IS 'Минимальная сумма для комиссии';
COMMENT ON COLUMN marketplace_commissions.max_amount IS 'Максимальная сумма для комиссии';
COMMENT ON COLUMN marketplace_commissions.valid_from IS 'Дата начала действия комиссии';
COMMENT ON COLUMN marketplace_commissions.valid_until IS 'Дата окончания действия комиссии';
COMMENT ON COLUMN marketplace_commissions.conditions IS 'Дополнительные условия';
COMMENT ON COLUMN marketplace_commissions.is_active IS 'Активна ли комиссия';

-- ================================================================
-- ИНДЕКСЫ
-- ================================================================

-- Индексы для warehouse_marketplace_integrations
CREATE INDEX IF NOT EXISTS idx_warehouse_marketplace_integrations_warehouse_id ON warehouse_marketplace_integrations (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_marketplace_integrations_marketplace_id ON warehouse_marketplace_integrations (marketplace_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_marketplace_integrations_integration_status ON warehouse_marketplace_integrations (integration_status);
CREATE INDEX IF NOT EXISTS idx_warehouse_marketplace_integrations_is_active ON warehouse_marketplace_integrations (is_active);

-- Индексы для обновленных полей warehouse_product_links
CREATE INDEX IF NOT EXISTS idx_warehouse_product_links_purchase_price ON warehouse_product_links (purchase_price);
CREATE INDEX IF NOT EXISTS idx_warehouse_product_links_wholesale_price ON warehouse_product_links (wholesale_price);
CREATE INDEX IF NOT EXISTS idx_warehouse_product_links_retail_price ON warehouse_product_links (retail_price);
CREATE INDEX IF NOT EXISTS idx_warehouse_product_links_website_price ON warehouse_product_links (website_price);
CREATE INDEX IF NOT EXISTS idx_warehouse_product_links_marketplace_price ON warehouse_product_links (marketplace_price);
CREATE INDEX IF NOT EXISTS idx_warehouse_product_links_mrp_price ON warehouse_product_links (mrp_price);
CREATE INDEX IF NOT EXISTS idx_warehouse_product_links_rrp_price ON warehouse_product_links (rrp_price);

-- Индексы для price_calculation_rules
CREATE INDEX IF NOT EXISTS idx_price_calculation_rules_company_id ON price_calculation_rules (company_id);
CREATE INDEX IF NOT EXISTS idx_price_calculation_rules_warehouse_id ON price_calculation_rules (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_price_calculation_rules_brand_id ON price_calculation_rules (brand_id);
CREATE INDEX IF NOT EXISTS idx_price_calculation_rules_category_id ON price_calculation_rules (category_id);
CREATE INDEX IF NOT EXISTS idx_price_calculation_rules_rule_type ON price_calculation_rules (rule_type);
CREATE INDEX IF NOT EXISTS idx_price_calculation_rules_price_type ON price_calculation_rules (price_type);
CREATE INDEX IF NOT EXISTS idx_price_calculation_rules_priority ON price_calculation_rules (priority);
CREATE INDEX IF NOT EXISTS idx_price_calculation_rules_is_active ON price_calculation_rules (is_active);

-- Индексы для supplier_discounts
CREATE INDEX IF NOT EXISTS idx_supplier_discounts_company_id ON supplier_discounts (company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_discounts_supplier_id ON supplier_discounts (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_discounts_brand_id ON supplier_discounts (brand_id);
CREATE INDEX IF NOT EXISTS idx_supplier_discounts_category_id ON supplier_discounts (category_id);
CREATE INDEX IF NOT EXISTS idx_supplier_discounts_discount_type ON supplier_discounts (discount_type);
CREATE INDEX IF NOT EXISTS idx_supplier_discounts_valid_from ON supplier_discounts (valid_from);
CREATE INDEX IF NOT EXISTS idx_supplier_discounts_valid_until ON supplier_discounts (valid_until);
CREATE INDEX IF NOT EXISTS idx_supplier_discounts_is_active ON supplier_discounts (is_active);

-- Индексы для marketplace_commissions
CREATE INDEX IF NOT EXISTS idx_marketplace_commissions_company_id ON marketplace_commissions (company_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_commissions_marketplace_id ON marketplace_commissions (marketplace_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_commissions_category_id ON marketplace_commissions (category_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_commissions_commission_type ON marketplace_commissions (commission_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_commissions_valid_from ON marketplace_commissions (valid_from);
CREATE INDEX IF NOT EXISTS idx_marketplace_commissions_valid_until ON marketplace_commissions (valid_until);
CREATE INDEX IF NOT EXISTS idx_marketplace_commissions_is_active ON marketplace_commissions (is_active);

-- Индексы для обновленных полей warehouses
CREATE INDEX IF NOT EXISTS idx_warehouses_warehouse_type ON warehouses (warehouse_type);
CREATE INDEX IF NOT EXISTS idx_warehouses_city ON warehouses (city);
CREATE INDEX IF NOT EXISTS idx_warehouses_region ON warehouses (region);
CREATE INDEX IF NOT EXISTS idx_warehouses_country ON warehouses (country);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================

CREATE TRIGGER update_warehouse_marketplace_integrations_updated_at
    BEFORE UPDATE ON warehouse_marketplace_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_calculation_rules_updated_at
    BEFORE UPDATE ON price_calculation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_discounts_updated_at
    BEFORE UPDATE ON supplier_discounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_commissions_updated_at
    BEFORE UPDATE ON marketplace_commissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ
-- ================================================================

-- Функция для расчета цены товара
CREATE OR REPLACE FUNCTION calculate_price(
    p_warehouse_id UUID,
    p_product_id UUID,
    p_price_type VARCHAR(50),
    p_base_price DECIMAL(12,2)
) RETURNS DECIMAL(12,2) AS $$
DECLARE
    v_final_price DECIMAL(12,2) := p_base_price;
    v_rule RECORD;
    v_markup DECIMAL(5,2);
    v_discount DECIMAL(5,2);
    v_supplier_discount DECIMAL(5,2);
    v_marketplace_commission DECIMAL(5,2);
    v_product RECORD;
    v_warehouse RECORD;
BEGIN
    -- Получаем информацию о товаре и складе
    SELECT p.*, b.wholesale_markup, b.retail_markup
    INTO v_product
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.id = p_product_id;

    SELECT * INTO v_warehouse
    FROM warehouses
    WHERE id = p_warehouse_id;

    -- Применяем правила расчета цен
    FOR v_rule IN
        SELECT * FROM price_calculation_rules
        WHERE (warehouse_id IS NULL OR warehouse_id = p_warehouse_id)
          AND (brand_id IS NULL OR brand_id = v_product.brand_id)
          AND (category_id IS NULL OR category_id = v_product.category_id)
          AND price_type = p_price_type
          AND is_active = TRUE
          AND (valid_from IS NULL OR valid_from <= CURRENT_TIMESTAMP)
          AND (valid_until IS NULL OR valid_until >= CURRENT_TIMESTAMP)
        ORDER BY priority DESC
    LOOP
        CASE v_rule.rule_type
            WHEN 'markup' THEN
                v_markup := COALESCE((v_rule.settings->>'markup')::DECIMAL, 0);
                v_final_price := v_final_price * (1 + v_markup / 100);

            WHEN 'discount' THEN
                v_discount := COALESCE((v_rule.settings->>'discount')::DECIMAL, 0);
                v_final_price := v_final_price * (1 - v_discount / 100);

            WHEN 'fixed' THEN
                v_final_price := COALESCE((v_rule.settings->>'price')::DECIMAL, v_final_price);
        END CASE;
    END LOOP;

    -- Применяем скидки от поставщиков
    SELECT COALESCE(MAX(discount_value), 0)
    INTO v_supplier_discount
    FROM supplier_discounts
    WHERE supplier_id = v_product.main_supplier_id
      AND (brand_id IS NULL OR brand_id = v_product.brand_id)
      AND (category_id IS NULL OR category_id = v_product.category_id)
      AND is_active = TRUE
      AND (valid_from IS NULL OR valid_from <= CURRENT_TIMESTAMP)
      AND (valid_until IS NULL OR valid_until >= CURRENT_TIMESTAMP);

    IF v_supplier_discount > 0 THEN
        v_final_price := v_final_price * (1 - v_supplier_discount / 100);
    END IF;

    -- Применяем комиссии маркетплейсов (только для marketplace_price)
    IF p_price_type = 'marketplace' THEN
        SELECT COALESCE(MAX(commission_value), 0)
        INTO v_marketplace_commission
        FROM marketplace_commissions
        WHERE marketplace_id IN (
            SELECT marketplace_id FROM warehouse_marketplace_integrations
            WHERE warehouse_id = p_warehouse_id AND is_active = TRUE
        )
        AND (category_id IS NULL OR category_id = v_product.category_id)
        AND is_active = TRUE
        AND (valid_from IS NULL OR valid_from <= CURRENT_TIMESTAMP)
        AND (valid_until IS NULL OR valid_until >= CURRENT_TIMESTAMP);

        IF v_marketplace_commission > 0 THEN
            v_final_price := v_final_price * (1 + v_marketplace_commission / 100);
        END IF;
    END IF;

    -- Проверяем МРЦ/РРЦ бренда, если заданы
    IF v_product.wholesale_markup IS NOT NULL THEN
        -- no-op, поле доступно при необходимости для расчетов маржи
    END IF;

    RETURN ROUND(v_final_price, 2);
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления цен на складе
CREATE OR REPLACE FUNCTION update_warehouse_prices(
    p_warehouse_id UUID,
    p_product_id UUID,
    p_purchase_price DECIMAL(12,2)
) RETURNS VOID AS $$
DECLARE
    v_wholesale_price DECIMAL(12,2);
    v_retail_price DECIMAL(12,2);
    v_website_price DECIMAL(12,2);
    v_marketplace_price DECIMAL(12,2);
BEGIN
    -- Рассчитываем цены
    v_wholesale_price := calculate_price(p_warehouse_id, p_product_id, 'wholesale', p_purchase_price);
    v_retail_price := calculate_price(p_warehouse_id, p_product_id, 'retail', p_purchase_price);
    v_website_price := calculate_price(p_warehouse_id, p_product_id, 'website', p_purchase_price);
    v_marketplace_price := calculate_price(p_warehouse_id, p_product_id, 'marketplace', p_purchase_price);

    -- Обновляем цены в warehouse_product_links
    UPDATE warehouse_product_links
    SET
        purchase_price = p_purchase_price,
        wholesale_price = v_wholesale_price,
        retail_price = v_retail_price,
        website_price = v_website_price,
        marketplace_price = v_marketplace_price,
        updated_at = CURRENT_TIMESTAMP
    WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения скидки поставщика
CREATE OR REPLACE FUNCTION get_supplier_discount(
    p_supplier_id UUID,
    p_brand_id UUID,
    p_category_id UUID,
    p_quantity DECIMAL(12,3)
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_discount DECIMAL(5,2) := 0;
    v_discount_record RECORD;
BEGIN
    -- Ищем подходящую скидку
    SELECT discount_value
    INTO v_discount_record
    FROM supplier_discounts
    WHERE supplier_id = p_supplier_id
      AND (brand_id IS NULL OR brand_id = p_brand_id)
      AND (category_id IS NULL OR category_id = p_category_id)
      AND (min_quantity IS NULL OR p_quantity >= min_quantity)
      AND (max_quantity IS NULL OR p_quantity <= max_quantity)
      AND is_active = TRUE
      AND (valid_from IS NULL OR valid_from <= CURRENT_TIMESTAMP)
      AND (valid_until IS NULL OR valid_until >= CURRENT_TIMESTAMP)
    ORDER BY discount_value DESC
    LIMIT 1;

    IF v_discount_record.discount_value IS NOT NULL THEN
        v_discount := v_discount_record.discount_value;
    END IF;

    RETURN v_discount;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения комиссии маркетплейса
CREATE OR REPLACE FUNCTION get_marketplace_commission(
    p_marketplace_id UUID,
    p_category_id UUID,
    p_amount DECIMAL(12,2)
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_commission DECIMAL(5,2) := 0;
    v_commission_record RECORD;
BEGIN
    -- Ищем подходящую комиссию
    SELECT commission_value
    INTO v_commission_record
    FROM marketplace_commissions
    WHERE marketplace_id = p_marketplace_id
      AND (category_id IS NULL OR category_id = p_category_id)
      AND (min_amount IS NULL OR p_amount >= min_amount)
      AND (max_amount IS NULL OR p_amount <= max_amount)
      AND is_active = TRUE
      AND (valid_from IS NULL OR valid_from <= CURRENT_TIMESTAMP)
      AND (valid_until IS NULL OR valid_until >= CURRENT_TIMESTAMP)
    ORDER BY commission_value DESC
    LIMIT 1;

    IF v_commission_record.commission_value IS NOT NULL THEN
        v_commission := v_commission_record.commission_value;
    END IF;

    RETURN v_commission;
END;
$$ LANGUAGE plpgsql;