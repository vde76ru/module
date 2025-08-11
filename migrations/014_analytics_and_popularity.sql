-- ================================================================
-- МИГРАЦИЯ 014: Система аналитики и популярности товаров
-- Описание: Создает систему аналитики продаж, популярности товаров и умной аналитики
-- Дата: 2025-01-27
-- Блок: Аналитика и популярность
-- Зависимости: Все предыдущие миграции
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Sales_Analytics - Аналитика продаж
-- ================================================================
CREATE TABLE IF NOT EXISTS sales_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    date DATE NOT NULL,

    -- Общие метрики
    total_revenue DECIMAL(15,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_items_sold INTEGER DEFAULT 0,
    average_order_value DECIMAL(12,2) DEFAULT 0,

    -- Продажи по каналам
    website_revenue DECIMAL(15,2) DEFAULT 0,
    website_orders INTEGER DEFAULT 0,
    marketplace_revenue DECIMAL(15,2) DEFAULT 0,
    marketplace_orders INTEGER DEFAULT 0,
    retail_revenue DECIMAL(15,2) DEFAULT 0,
    retail_orders INTEGER DEFAULT 0,

    -- Маржинальность
    total_cost DECIMAL(15,2) DEFAULT 0,
    total_margin DECIMAL(15,2) DEFAULT 0,
    margin_percentage DECIMAL(5,2) DEFAULT 0,

    -- Дополнительные метрики
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    top_products JSONB DEFAULT '[]'::jsonb,
    top_categories JSONB DEFAULT '[]'::jsonb,
    top_brands JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_sales_analytics_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_sales_analytics_unique
        UNIQUE (company_id, date)
);
ALTER TABLE sales_analytics
    ADD CONSTRAINT ck_sales_analytics_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_analytics_company_public_id ON sales_analytics (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_sales_analytics_public_id
    BEFORE INSERT ON sales_analytics
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

COMMENT ON TABLE sales_analytics IS 'Аналитика продаж по дням';
COMMENT ON COLUMN sales_analytics.company_id IS 'Компания';
COMMENT ON COLUMN sales_analytics.date IS 'Дата аналитики';
COMMENT ON COLUMN sales_analytics.total_revenue IS 'Общая выручка';
COMMENT ON COLUMN sales_analytics.total_orders IS 'Общее количество заказов';
COMMENT ON COLUMN sales_analytics.total_items_sold IS 'Общее количество проданных товаров';
COMMENT ON COLUMN sales_analytics.average_order_value IS 'Средний чек';
COMMENT ON COLUMN sales_analytics.website_revenue IS 'Выручка с сайта';
COMMENT ON COLUMN sales_analytics.website_orders IS 'Заказы с сайта';
COMMENT ON COLUMN sales_analytics.marketplace_revenue IS 'Выручка с маркетплейсов';
COMMENT ON COLUMN sales_analytics.marketplace_orders IS 'Заказы с маркетплейсов';
COMMENT ON COLUMN sales_analytics.retail_revenue IS 'Розничная выручка';
COMMENT ON COLUMN sales_analytics.retail_orders IS 'Розничные заказы';
COMMENT ON COLUMN sales_analytics.total_cost IS 'Общая себестоимость';
COMMENT ON COLUMN sales_analytics.total_margin IS 'Общая маржа';
COMMENT ON COLUMN sales_analytics.margin_percentage IS 'Процент маржи';
COMMENT ON COLUMN sales_analytics.new_customers IS 'Новые клиенты';
COMMENT ON COLUMN sales_analytics.returning_customers IS 'Повторные клиенты';
COMMENT ON COLUMN sales_analytics.top_products IS 'Топ товаров';
COMMENT ON COLUMN sales_analytics.top_categories IS 'Топ категорий';
COMMENT ON COLUMN sales_analytics.top_brands IS 'Топ брендов';

-- ================================================================
-- ТАБЛИЦА: Product_Popularity - Популярность товаров
-- ================================================================
CREATE TABLE IF NOT EXISTS product_popularity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    product_id UUID NOT NULL,

    -- Базовые метрики популярности
    popularity_score DECIMAL(8,4) DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    sale_count INTEGER DEFAULT 0,
    revenue_generated DECIMAL(15,2) DEFAULT 0,

    -- Временные метрики
    daily_views INTEGER DEFAULT 0,
    weekly_views INTEGER DEFAULT 0,
    monthly_views INTEGER DEFAULT 0,
    daily_sales INTEGER DEFAULT 0,
    weekly_sales INTEGER DEFAULT 0,
    monthly_sales INTEGER DEFAULT 0,

    -- Тренды
    view_trend DECIMAL(5,2) DEFAULT 0, -- Изменение просмотров в %
    sale_trend DECIMAL(5,2) DEFAULT 0, -- Изменение продаж в %
    revenue_trend DECIMAL(5,2) DEFAULT 0, -- Изменение выручки в %

    -- Дополнительные метрики
    conversion_rate DECIMAL(5,2) DEFAULT 0, -- Конверсия просмотров в продажи
    average_rating DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Умные метрики
    seasonality_score DECIMAL(5,2) DEFAULT 0, -- Сезонность товара
    demand_volatility DECIMAL(5,2) DEFAULT 0, -- Волатильность спроса
    price_sensitivity DECIMAL(5,2) DEFAULT 0, -- Чувствительность к цене

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_product_popularity_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_popularity_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_product_popularity_unique
        UNIQUE (company_id, product_id)
);
ALTER TABLE product_popularity
    ADD CONSTRAINT ck_product_popularity_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_popularity_company_public_id ON product_popularity (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_product_popularity_public_id
    BEFORE INSERT ON product_popularity
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

COMMENT ON TABLE product_popularity IS 'Популярность товаров с умной аналитикой';
COMMENT ON COLUMN product_popularity.company_id IS 'Компания';
COMMENT ON COLUMN product_popularity.product_id IS 'Товар';
COMMENT ON COLUMN product_popularity.popularity_score IS 'Общий балл популярности';
COMMENT ON COLUMN product_popularity.view_count IS 'Общее количество просмотров';
COMMENT ON COLUMN product_popularity.sale_count IS 'Общее количество продаж';
COMMENT ON COLUMN product_popularity.revenue_generated IS 'Общая выручка от товара';
COMMENT ON COLUMN product_popularity.daily_views IS 'Просмотры за день';
COMMENT ON COLUMN product_popularity.weekly_views IS 'Просмотры за неделю';
COMMENT ON COLUMN product_popularity.monthly_views IS 'Просмотры за месяц';
COMMENT ON COLUMN product_popularity.daily_sales IS 'Продажи за день';
COMMENT ON COLUMN product_popularity.weekly_sales IS 'Продажи за неделю';
COMMENT ON COLUMN product_popularity.monthly_sales IS 'Продажи за месяц';
COMMENT ON COLUMN product_popularity.view_trend IS 'Тренд просмотров в %';
COMMENT ON COLUMN product_popularity.sale_trend IS 'Тренд продаж в %';
COMMENT ON COLUMN product_popularity.revenue_trend IS 'Тренд выручки в %';
COMMENT ON COLUMN product_popularity.conversion_rate IS 'Конверсия просмотров в продажи';
COMMENT ON COLUMN product_popularity.average_rating IS 'Средний рейтинг';
COMMENT ON COLUMN product_popularity.review_count IS 'Количество отзывов';
COMMENT ON COLUMN product_popularity.last_activity IS 'Последняя активность';
COMMENT ON COLUMN product_popularity.seasonality_score IS 'Сезонность товара';
COMMENT ON COLUMN product_popularity.demand_volatility IS 'Волатильность спроса';
COMMENT ON COLUMN product_popularity.price_sensitivity IS 'Чувствительность к цене';

-- ================================================================
-- ТАБЛИЦА: Supplier_Analytics - Аналитика по поставщикам
-- ================================================================
CREATE TABLE IF NOT EXISTS supplier_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    date DATE NOT NULL,

    -- Метрики поставщика
    total_products INTEGER DEFAULT 0,
    active_products INTEGER DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_items_sold INTEGER DEFAULT 0,

    -- Финансовые метрики
    total_cost DECIMAL(15,2) DEFAULT 0,
    total_margin DECIMAL(15,2) DEFAULT 0,
    margin_percentage DECIMAL(5,2) DEFAULT 0,
    average_discount DECIMAL(5,2) DEFAULT 0,

    -- Качество поставок
    delivery_time_avg DECIMAL(5,2) DEFAULT 0, -- Среднее время доставки в днях
    stock_availability DECIMAL(5,2) DEFAULT 0, -- Доступность товаров в %
    return_rate DECIMAL(5,2) DEFAULT 0, -- Процент возвратов

    -- Топ товары поставщика
    top_products JSONB DEFAULT '[]'::jsonb,
    top_categories JSONB DEFAULT '[]'::jsonb,
    top_brands JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_supplier_analytics_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_supplier_analytics_supplier_id
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_supplier_analytics_unique
        UNIQUE (company_id, supplier_id, date)
);
ALTER TABLE supplier_analytics
    ADD CONSTRAINT ck_supplier_analytics_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_analytics_company_public_id ON supplier_analytics (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_supplier_analytics_public_id
    BEFORE INSERT ON supplier_analytics
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

COMMENT ON TABLE supplier_analytics IS 'Аналитика по поставщикам';
COMMENT ON COLUMN supplier_analytics.company_id IS 'Компания';
COMMENT ON COLUMN supplier_analytics.supplier_id IS 'Поставщик';
COMMENT ON COLUMN supplier_analytics.date IS 'Дата аналитики';
COMMENT ON COLUMN supplier_analytics.total_products IS 'Общее количество товаров';
COMMENT ON COLUMN supplier_analytics.active_products IS 'Активных товаров';
COMMENT ON COLUMN supplier_analytics.total_revenue IS 'Общая выручка';
COMMENT ON COLUMN supplier_analytics.total_orders IS 'Общее количество заказов';
COMMENT ON COLUMN supplier_analytics.total_items_sold IS 'Общее количество проданных товаров';
COMMENT ON COLUMN supplier_analytics.total_cost IS 'Общая себестоимость';
COMMENT ON COLUMN supplier_analytics.total_margin IS 'Общая маржа';
COMMENT ON COLUMN supplier_analytics.margin_percentage IS 'Процент маржи';
COMMENT ON COLUMN supplier_analytics.average_discount IS 'Средняя скидка';
COMMENT ON COLUMN supplier_analytics.delivery_time_avg IS 'Среднее время доставки';
COMMENT ON COLUMN supplier_analytics.stock_availability IS 'Доступность товаров';
COMMENT ON COLUMN supplier_analytics.return_rate IS 'Процент возвратов';
COMMENT ON COLUMN supplier_analytics.top_products IS 'Топ товары поставщика';
COMMENT ON COLUMN supplier_analytics.top_categories IS 'Топ категории поставщика';
COMMENT ON COLUMN supplier_analytics.top_brands IS 'Топ бренды поставщика';

-- ================================================================
-- ТАБЛИЦА: Popularity_History - История популярности
-- ================================================================
CREATE TABLE IF NOT EXISTS popularity_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    product_id UUID NOT NULL,
    date DATE NOT NULL,

    -- Дневные метрики
    daily_views INTEGER DEFAULT 0,
    daily_sales INTEGER DEFAULT 0,
    daily_revenue DECIMAL(12,2) DEFAULT 0,
    daily_orders INTEGER DEFAULT 0,

    -- Дополнительные метрики
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_popularity_history_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_popularity_history_product_id
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_popularity_history_unique
        UNIQUE (company_id, product_id, date)
);
ALTER TABLE popularity_history
    ADD CONSTRAINT ck_popularity_history_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_popularity_history_public_id ON popularity_history (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_popularity_history_public_id
    BEFORE INSERT ON popularity_history
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

COMMENT ON TABLE popularity_history IS 'История популярности товаров по дням';
COMMENT ON COLUMN popularity_history.company_id IS 'Компания';
COMMENT ON COLUMN popularity_history.product_id IS 'Товар';
COMMENT ON COLUMN popularity_history.date IS 'Дата';
COMMENT ON COLUMN popularity_history.daily_views IS 'Просмотры за день';
COMMENT ON COLUMN popularity_history.daily_sales IS 'Продажи за день';
COMMENT ON COLUMN popularity_history.daily_revenue IS 'Выручка за день';
COMMENT ON COLUMN popularity_history.daily_orders IS 'Заказы за день';
COMMENT ON COLUMN popularity_history.conversion_rate IS 'Конверсия за день';
COMMENT ON COLUMN popularity_history.average_rating IS 'Средний рейтинг за день';
COMMENT ON COLUMN popularity_history.review_count IS 'Количество отзывов за день';

-- ================================================================
-- ТАБЛИЦА: Analytics_Events - События аналитики
-- ================================================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'view', 'sale', 'order', 'rating'
    entity_type VARCHAR(50) NOT NULL, -- 'product', 'category', 'brand', 'supplier'
    entity_id UUID NOT NULL,
    user_id UUID,
    session_id VARCHAR(255),

    -- Данные события
    event_data JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Временные метки
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_analytics_events_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_analytics_events_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE analytics_events IS 'События аналитики';
COMMENT ON COLUMN analytics_events.company_id IS 'Компания';
COMMENT ON COLUMN analytics_events.event_type IS 'Тип события';
COMMENT ON COLUMN analytics_events.entity_type IS 'Тип сущности';
COMMENT ON COLUMN analytics_events.entity_id IS 'ID сущности';
COMMENT ON COLUMN analytics_events.user_id IS 'Пользователь';
COMMENT ON COLUMN analytics_events.session_id IS 'ID сессии';
COMMENT ON COLUMN analytics_events.event_data IS 'Данные события';
COMMENT ON COLUMN analytics_events.metadata IS 'Метаданные события';
COMMENT ON COLUMN analytics_events.event_timestamp IS 'Время события';
ALTER TABLE analytics_events
    ADD CONSTRAINT ck_analytics_events_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_events_company_public_id ON analytics_events (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_analytics_events_public_id
    BEFORE INSERT ON analytics_events
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ИНДЕКСЫ
-- ================================================================

-- Индексы для sales_analytics
CREATE INDEX IF NOT EXISTS idx_sales_analytics_company_id ON sales_analytics (company_id);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_date ON sales_analytics (date);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_total_revenue ON sales_analytics (total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_total_orders ON sales_analytics (total_orders DESC);

-- Индексы для product_popularity
CREATE INDEX IF NOT EXISTS idx_product_popularity_company_id ON product_popularity (company_id);
CREATE INDEX IF NOT EXISTS idx_product_popularity_product_id ON product_popularity (product_id);
CREATE INDEX IF NOT EXISTS idx_product_popularity_popularity_score ON product_popularity (popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_product_popularity_view_count ON product_popularity (view_count DESC);
CREATE INDEX IF NOT EXISTS idx_product_popularity_sale_count ON product_popularity (sale_count DESC);
CREATE INDEX IF NOT EXISTS idx_product_popularity_revenue_generated ON product_popularity (revenue_generated DESC);
CREATE INDEX IF NOT EXISTS idx_product_popularity_last_activity ON product_popularity (last_activity);

-- Индексы для supplier_analytics
CREATE INDEX IF NOT EXISTS idx_supplier_analytics_company_id ON supplier_analytics (company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_analytics_supplier_id ON supplier_analytics (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_analytics_date ON supplier_analytics (date);
CREATE INDEX IF NOT EXISTS idx_supplier_analytics_total_revenue ON supplier_analytics (total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_analytics_margin_percentage ON supplier_analytics (margin_percentage DESC);

-- Индексы для popularity_history
CREATE INDEX IF NOT EXISTS idx_popularity_history_company_id ON popularity_history (company_id);
CREATE INDEX IF NOT EXISTS idx_popularity_history_product_id ON popularity_history (product_id);
CREATE INDEX IF NOT EXISTS idx_popularity_history_date ON popularity_history (date);
CREATE INDEX IF NOT EXISTS idx_popularity_history_daily_views ON popularity_history (daily_views DESC);
CREATE INDEX IF NOT EXISTS idx_popularity_history_daily_sales ON popularity_history (daily_sales DESC);

-- Индексы для analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_events_company_id ON analytics_events (company_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_entity_type ON analytics_events (entity_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_entity_id ON analytics_events (entity_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_timestamp ON analytics_events (event_timestamp);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_sales_analytics_updated_at
    BEFORE UPDATE ON sales_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_popularity_updated_at
    BEFORE UPDATE ON product_popularity
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_analytics_updated_at
    BEFORE UPDATE ON supplier_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ
-- ================================================================

-- Функция для расчета популярности товара
CREATE OR REPLACE FUNCTION calculate_product_popularity(
    p_company_id UUID,
    p_product_id UUID
) RETURNS DECIMAL(8,4) AS $$
DECLARE
    v_popularity_score DECIMAL(8,4) := 0;
    v_view_weight DECIMAL(3,2) := 0.3;
    v_sale_weight DECIMAL(3,2) := 0.4;
    v_revenue_weight DECIMAL(3,2) := 0.3;
    v_view_score DECIMAL(8,4);
    v_sale_score DECIMAL(8,4);
    v_revenue_score DECIMAL(8,4);
    v_max_views INTEGER;
    v_max_sales INTEGER;
    v_max_revenue DECIMAL(15,2);
BEGIN
    -- Получаем максимальные значения для нормализации
    SELECT
        COALESCE(MAX(view_count), 1),
        COALESCE(MAX(sale_count), 1),
        COALESCE(MAX(revenue_generated), 1)
    INTO v_max_views, v_max_sales, v_max_revenue
    FROM product_popularity
    WHERE company_id = p_company_id;

    -- Получаем текущие значения товара
    SELECT
        COALESCE(view_count, 0),
        COALESCE(sale_count, 0),
        COALESCE(revenue_generated, 0)
    INTO v_view_score, v_sale_score, v_revenue_score
    FROM product_popularity
    WHERE company_id = p_company_id AND product_id = p_product_id;

    -- Нормализуем значения (0-1)
    v_view_score := LEAST(v_view_score::DECIMAL / v_max_views, 1);
    v_sale_score := LEAST(v_sale_score::DECIMAL / v_max_sales, 1);
    v_revenue_score := LEAST(v_revenue_score / v_max_revenue, 1);

    -- Рассчитываем общий балл популярности
    v_popularity_score :=
        (v_view_score * v_view_weight) +
        (v_sale_score * v_sale_weight) +
        (v_revenue_score * v_revenue_weight);

    RETURN v_popularity_score;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления популярности товара
CREATE OR REPLACE FUNCTION update_product_popularity(
    p_company_id UUID,
    p_product_id UUID
) RETURNS VOID AS $$
DECLARE
    v_popularity_score DECIMAL(8,4);
    v_view_trend DECIMAL(5,2);
    v_sale_trend DECIMAL(5,2);
    v_revenue_trend DECIMAL(5,2);
    v_old_views INTEGER;
    v_old_sales INTEGER;
    v_old_revenue DECIMAL(15,2);
    v_new_views INTEGER;
    v_new_sales INTEGER;
    v_new_revenue DECIMAL(15,2);
BEGIN
    -- Рассчитываем новый балл популярности
    v_popularity_score := calculate_product_popularity(p_company_id, p_product_id);

    -- Получаем старые значения для расчета трендов
    SELECT
        COALESCE(view_count, 0),
        COALESCE(sale_count, 0),
        COALESCE(revenue_generated, 0)
    INTO v_old_views, v_old_sales, v_old_revenue
    FROM product_popularity
    WHERE company_id = p_company_id AND product_id = p_product_id;

    -- Получаем новые значения из истории
    SELECT
        COALESCE(SUM(daily_views), 0),
        COALESCE(SUM(daily_sales), 0),
        COALESCE(SUM(daily_revenue), 0)
    INTO v_new_views, v_new_sales, v_new_revenue
    FROM popularity_history
    WHERE company_id = p_company_id
      AND product_id = p_product_id
      AND date >= CURRENT_DATE - INTERVAL '30 days';

    -- Рассчитываем тренды
    v_view_trend := CASE
        WHEN v_old_views > 0 THEN ((v_new_views - v_old_views)::DECIMAL / v_old_views) * 100
        ELSE 0
    END;

    v_sale_trend := CASE
        WHEN v_old_sales > 0 THEN ((v_new_sales - v_old_sales)::DECIMAL / v_old_sales) * 100
        ELSE 0
    END;

    v_revenue_trend := CASE
        WHEN v_old_revenue > 0 THEN ((v_new_revenue - v_old_revenue) / v_old_revenue) * 100
        ELSE 0
    END;

    -- Обновляем или создаем запись популярности
    INSERT INTO product_popularity (
        company_id, product_id, popularity_score, view_count, sale_count, revenue_generated,
        view_trend, sale_trend, revenue_trend, last_activity
    ) VALUES (
        p_company_id, p_product_id, v_popularity_score, v_new_views, v_new_sales, v_new_revenue,
        v_view_trend, v_sale_trend, v_revenue_trend, CURRENT_TIMESTAMP
    ) ON CONFLICT (company_id, product_id) DO UPDATE SET
        popularity_score = EXCLUDED.popularity_score,
        view_count = EXCLUDED.view_count,
        sale_count = EXCLUDED.sale_count,
        revenue_generated = EXCLUDED.revenue_generated,
        view_trend = EXCLUDED.view_trend,
        sale_trend = EXCLUDED.sale_trend,
        revenue_trend = EXCLUDED.revenue_trend,
        last_activity = EXCLUDED.last_activity,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Функция для расчета сезонности товара
CREATE OR REPLACE FUNCTION calculate_seasonality(
    p_company_id UUID,
    p_product_id UUID
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_seasonality_score DECIMAL(5,2) := 0;
    v_monthly_sales JSONB;
    v_current_month INTEGER;
    v_avg_sales DECIMAL(10,2);
    v_current_sales DECIMAL(10,2);
BEGIN
    -- Получаем продажи по месяцам за последний год
    SELECT jsonb_object_agg(
        EXTRACT(MONTH FROM date)::TEXT,
        SUM(daily_sales)
    ) INTO v_monthly_sales
    FROM popularity_history
    WHERE company_id = p_company_id
      AND product_id = p_product_id
      AND date >= CURRENT_DATE - INTERVAL '1 year';

    -- Рассчитываем средние продажи
    SELECT AVG(value::DECIMAL) INTO v_avg_sales
    FROM jsonb_each(v_monthly_sales);

    -- Получаем текущий месяц
    v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);

    -- Получаем продажи текущего месяца
    v_current_sales := COALESCE((v_monthly_sales->>v_current_month::TEXT)::DECIMAL, 0);

    -- Рассчитываем сезонность
    IF v_avg_sales > 0 THEN
        v_seasonality_score := ((v_current_sales - v_avg_sales) / v_avg_sales) * 100;
    END IF;

    RETURN v_seasonality_score;
END;
$$ LANGUAGE plpgsql;

-- Функция для расчета волатильности спроса
CREATE OR REPLACE FUNCTION calculate_demand_volatility(
    p_company_id UUID,
    p_product_id UUID
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_volatility DECIMAL(5,2) := 0;
    v_sales_std DECIMAL(10,2);
    v_sales_avg DECIMAL(10,2);
BEGIN
    -- Рассчитываем стандартное отклонение продаж
    SELECT
        STDDEV(daily_sales),
        AVG(daily_sales)
    INTO v_sales_std, v_sales_avg
    FROM popularity_history
    WHERE company_id = p_company_id
      AND product_id = p_product_id
      AND date >= CURRENT_DATE - INTERVAL '90 days';

    -- Рассчитываем коэффициент вариации
    IF v_sales_avg > 0 THEN
        v_volatility := (v_sales_std / v_sales_avg) * 100;
    END IF;

    RETURN v_volatility;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения топ товаров
CREATE OR REPLACE FUNCTION get_top_products(
    p_company_id UUID,
    p_limit INTEGER DEFAULT 10,
    p_period VARCHAR(20) DEFAULT '30 days'
) RETURNS TABLE(
    product_id UUID,
    product_name VARCHAR,
    brand_name VARCHAR,
    popularity_score DECIMAL(8,4),
    view_count INTEGER,
    sale_count INTEGER,
    revenue_generated DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pp.product_id,
        p.name,
        b.name,
        pp.popularity_score,
        pp.view_count,
        pp.sale_count,
        pp.revenue_generated
    FROM product_popularity pp
    JOIN products p ON pp.product_id = p.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE pp.company_id = p_company_id
      AND pp.last_activity >= CURRENT_TIMESTAMP - (p_period::INTERVAL)
    ORDER BY pp.popularity_score DESC, pp.revenue_generated DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения аналитики продаж
CREATE OR REPLACE FUNCTION get_sales_analytics(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE(
    date DATE,
    total_revenue DECIMAL(15,2),
    total_orders INTEGER,
    total_items_sold INTEGER,
    average_order_value DECIMAL(12,2),
    website_revenue DECIMAL(15,2),
    marketplace_revenue DECIMAL(15,2),
    retail_revenue DECIMAL(15,2),
    total_margin DECIMAL(15,2),
    margin_percentage DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sa.date,
        sa.total_revenue,
        sa.total_orders,
        sa.total_items_sold,
        sa.average_order_value,
        sa.website_revenue,
        sa.marketplace_revenue,
        sa.retail_revenue,
        sa.total_margin,
        sa.margin_percentage
    FROM sales_analytics sa
    WHERE sa.company_id = p_company_id
      AND sa.date BETWEEN p_start_date AND p_end_date
    ORDER BY sa.date;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 014
-- ================================================================