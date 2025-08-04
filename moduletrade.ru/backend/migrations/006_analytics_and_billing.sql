-- ========================================
-- МИГРАЦИЯ 006: МОДУЛИ АНАЛИТИКИ И БИЛЛИНГА
-- Таблицы для аналитики, отчетности и биллинговой системы
-- Версия: 2.0
-- ========================================

-- ========================================
-- МОДУЛЬ АНАЛИТИКИ ПРОДАЖ
-- ========================================

CREATE TABLE sales_analytics (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    marketplace_id INTEGER REFERENCES marketplace_settings(id) ON DELETE SET NULL,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,

    -- Период аналитики
    period_type VARCHAR(20) NOT NULL,
    -- Возможные значения: daily, weekly, monthly, quarterly, yearly

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Метрики продаж
    quantity_sold DECIMAL(10,2) NOT NULL DEFAULT 0,
    revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    profit DECIMAL(12,2) NOT NULL DEFAULT 0,
    margin_percent DECIMAL(5,2) DEFAULT 0,

    -- Дополнительные метрики
    orders_count INTEGER DEFAULT 0,
    avg_order_value DECIMAL(12,2) DEFAULT 0,

    -- Возвраты и отмены
    return_quantity DECIMAL(10,2) DEFAULT 0,
    return_amount DECIMAL(12,2) DEFAULT 0,
    cancelled_quantity DECIMAL(10,2) DEFAULT 0,
    cancelled_amount DECIMAL(12,2) DEFAULT 0,

    -- Конверсии и эффективность
    views_count INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,4) DEFAULT 0,
    click_through_rate DECIMAL(5,4) DEFAULT 0,

    -- Складские метрики
    avg_stock_level DECIMAL(10,2) DEFAULT 0,
    stockout_days INTEGER DEFAULT 0,
    inventory_turnover DECIMAL(5,2) DEFAULT 0,

    -- Валюта и дополнительная информация
    currency CHAR(3) DEFAULT 'RUB',

    -- Метаданные
    metadata JSONB DEFAULT '{}',
    calculation_details JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, product_id, marketplace_id, warehouse_id, period_type, period_start)
);

COMMENT ON TABLE sales_analytics IS 'Аналитические данные по продажам товаров';

-- ========================================
-- АНАЛИТИКА ПО ПОСТАВЩИКАМ
-- ========================================

CREATE TABLE supplier_analytics (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,

    -- Период
    period_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Метрики закупок
    total_orders INTEGER DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(12,2) DEFAULT 0,

    -- Метрики исполнения
    on_time_deliveries INTEGER DEFAULT 0,
    late_deliveries INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,

    -- Качественные метрики
    avg_delivery_time DECIMAL(5,2) DEFAULT 0,
    delivery_accuracy_percent DECIMAL(5,2) DEFAULT 0,
    quality_score DECIMAL(3,2) DEFAULT 0,

    -- Финансовые метрики
    cost_savings DECIMAL(12,2) DEFAULT 0,
    payment_terms_compliance DECIMAL(5,2) DEFAULT 0,

    -- Метаданные
    currency CHAR(3) DEFAULT 'RUB',
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, supplier_id, period_type, period_start)
);

COMMENT ON TABLE supplier_analytics IS 'Аналитика работы с поставщиками';

-- ========================================
-- МОДУЛЬ ДОСТУПНЫХ ФУНКЦИЙ ПЛАТФОРМЫ
-- ========================================

CREATE TABLE available_features (
    id SERIAL PRIMARY KEY,

    -- Основная информация
    feature_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Стоимость
    monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    setup_fee DECIMAL(10,2) DEFAULT 0,

    -- Категория и группировка
    category VARCHAR(100),
    -- Возможные значения: core, advanced, integration, analytics, support

    feature_group VARCHAR(100),
    sort_order INTEGER DEFAULT 0,

    -- Лимиты и квоты
    usage_limits JSONB DEFAULT '{}',
    -- Пример: {"api_calls": 10000, "products": 1000, "users": 5, "storage_gb": 10}

    -- Зависимости
    depends_on_features VARCHAR(100)[], -- массив кодов функций, от которых зависит
    conflicts_with_features VARCHAR(100)[], -- массив несовместимых функций

    -- Настройки
    is_metered BOOLEAN DEFAULT FALSE, -- тарифицируется по использованию
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly, usage_based

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_beta BOOLEAN DEFAULT FALSE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE available_features IS 'Доступные функции и модули платформы';

-- ========================================
-- ПОДПИСКИ КОМПАНИЙ НА ФУНКЦИИ
-- ========================================

CREATE TABLE company_subscriptions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    feature_id INTEGER REFERENCES available_features(id) ON DELETE CASCADE,

    -- Период подписки
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Биллинг
    monthly_price DECIMAL(10,2) NOT NULL,
    setup_fee DECIMAL(10,2) DEFAULT 0,

    -- Статус подписки
    is_active BOOLEAN DEFAULT TRUE,
    auto_renew BOOLEAN DEFAULT TRUE,

    -- Лимиты использования
    usage_limits JSONB DEFAULT '{}',
    current_usage JSONB DEFAULT '{}',
    -- Пример: {"api_calls": {"limit": 10000, "used": 2543}, "products": {"limit": 1000, "used": 156}}

    -- Биллинговая информация
    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    next_billing_date DATE,
    last_billing_date DATE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',
    activation_details JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, feature_id)
);

COMMENT ON TABLE company_subscriptions IS 'Подписки компаний на функции платформы';

-- ========================================
-- БИЛЛИНГОВЫЕ ТРАНЗАКЦИИ
-- ========================================

CREATE TABLE billing_transactions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Тип и статус транзакции
    type VARCHAR(50) NOT NULL,
    -- Возможные значения: payment, refund, adjustment, subscription, usage_charge, setup_fee

    status VARCHAR(50) DEFAULT 'pending',
    -- Возможные значения: pending, processing, completed, failed, cancelled, disputed

    -- Финансовые данные
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) DEFAULT 'RUB',

    -- Связанные объекты
    subscription_id INTEGER REFERENCES company_subscriptions(id) ON DELETE SET NULL,
    tariff_id INTEGER REFERENCES tariffs(id) ON DELETE SET NULL,
    related_order_id INTEGER, -- может ссылаться на заказы или другие объекты

    -- Биллинговый период
    billing_period_start DATE,
    billing_period_end DATE,

    -- Внешние системы платежей
    stripe_payment_intent_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),

    payment_method VARCHAR(100), -- card, bank_transfer, digital_wallet, etc

    -- Описание и детали
    description TEXT,
    invoice_number VARCHAR(255),

    -- Время обработки
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',
    payment_details JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE billing_transactions IS 'Транзакции биллинговой системы';

-- ========================================
-- ИСПОЛЬЗОВАНИЕ ФУНКЦИЙ
-- ========================================

CREATE TABLE feature_usage (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    feature_code VARCHAR(100) NOT NULL,
    subscription_id INTEGER REFERENCES company_subscriptions(id) ON DELETE SET NULL,

    -- Метрики использования
    usage_date DATE NOT NULL,
    usage_count INTEGER DEFAULT 1,
    usage_volume DECIMAL(12,2) DEFAULT 0, -- для объемных метрик

    -- Детали использования
    usage_type VARCHAR(100), -- api_call, product_sync, export, report, etc
    resource_id VARCHAR(255), -- ID ресурса, с которым работали

    -- Время использования
    usage_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id VARCHAR(255), -- ID сессии пользователя

    -- Пользователь
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Метаданные использования
    metadata JSONB DEFAULT '{}',
    request_details JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, feature_code, usage_date)
);

COMMENT ON TABLE feature_usage IS 'Статистика использования функций компаниями';

-- ========================================
-- ИСТОРИЯ ТАРИФОВ
-- ========================================

CREATE TABLE tariff_history (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    tariff_id INTEGER REFERENCES tariffs(id) ON DELETE CASCADE,

    -- Период действия тарифа
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,

    -- Финансовые условия на момент подключения
    monthly_price DECIMAL(10,2) NOT NULL,
    setup_fee DECIMAL(10,2) DEFAULT 0,

    -- Снимок настроек тарифа на момент подключения
    limits JSONB NOT NULL,
    features JSONB NOT NULL,
    billing_cycle VARCHAR(20) DEFAULT 'monthly',

    -- Причина изменения
    change_reason VARCHAR(255),
    -- Возможные значения: upgrade, downgrade, renewal, cancellation, migration, promotion

    -- Кто инициировал изменение
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    change_source VARCHAR(100) DEFAULT 'manual', -- manual, automatic, support, api

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE tariff_history IS 'История изменений тарифных планов компаний';

-- ========================================
-- ОТЧЕТЫ И АНАЛИТИЧЕСКИЕ ПРЕДСТАВЛЕНИЯ
-- ========================================

CREATE TABLE custom_reports (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Основная информация
    name VARCHAR(255) NOT NULL,
    description TEXT,
    report_type VARCHAR(100) NOT NULL,
    -- Возможные значения: sales, profit, inventory, supplier, marketplace, custom

    -- Конфигурация отчета
    config JSONB DEFAULT '{}',
    -- Пример: {"filters": {...}, "columns": [...], "grouping": {...}, "sorting": {...}}

    query_definition JSONB DEFAULT '{}', -- определение запроса для генерации отчета

    -- Расписание
    schedule_settings JSONB DEFAULT '{}',
    -- Пример: {"frequency": "weekly", "day": "monday", "time": "09:00", "recipients": [...]}

    is_scheduled BOOLEAN DEFAULT FALSE,
    last_generated TIMESTAMP WITH TIME ZONE,
    next_generation TIMESTAMP WITH TIME ZONE,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    generation_status VARCHAR(50) DEFAULT 'ready',
    -- Возможные значения: ready, generating, completed, error

    -- Доступ
    is_public BOOLEAN DEFAULT FALSE, -- доступен ли другим пользователям компании
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE custom_reports IS 'Пользовательские отчеты и аналитика';

-- ========================================
-- ИСТОРИЯ ГЕНЕРАЦИИ ОТЧЕТОВ
-- ========================================

CREATE TABLE report_generation_history (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES custom_reports(id) ON DELETE CASCADE,

    -- Информация о генерации
    generation_type VARCHAR(50) DEFAULT 'manual',
    -- Возможные значения: manual, scheduled, api

    status VARCHAR(50) NOT NULL,
    -- Возможные значения: started, completed, failed, cancelled

    -- Результат генерации
    file_url VARCHAR(500), -- ссылка на сгенерированный файл
    file_format VARCHAR(20), -- pdf, xlsx, csv, json
    file_size INTEGER, -- размер файла в байтах

    -- Статистика
    records_processed INTEGER DEFAULT 0,
    generation_time_seconds INTEGER,

    -- Параметры генерации
    generation_params JSONB DEFAULT '{}',

    -- Время
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Ошибки
    error_message TEXT,
    error_details JSONB DEFAULT '{}',

    -- Кто запустил
    generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE report_generation_history IS 'История генерации отчетов';

-- ========================================
-- КВОТЫ И ЛИМИТЫ ИСПОЛЬЗОВАНИЯ
-- ========================================

CREATE TABLE usage_quotas (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Ресурс и период
    resource_type VARCHAR(100) NOT NULL,
    -- Возможные значения: api_calls, products, users, storage_gb, exports, reports

    quota_period VARCHAR(20) NOT NULL, -- daily, weekly, monthly, yearly
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Лимиты
    quota_limit INTEGER NOT NULL,
    quota_used INTEGER DEFAULT 0,
    quota_remaining INTEGER GENERATED ALWAYS AS (quota_limit - quota_used) STORED,

    -- Предупреждения
    warning_threshold INTEGER, -- при каком использовании предупреждать
    warning_sent BOOLEAN DEFAULT FALSE,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_unlimited BOOLEAN DEFAULT FALSE, -- безлимитная квота

    -- Сброс квоты
    auto_reset BOOLEAN DEFAULT TRUE,
    last_reset TIMESTAMP WITH TIME ZONE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, resource_type, quota_period, period_start)
);

COMMENT ON TABLE usage_quotas IS 'Квоты использования ресурсов компаниями';

-- ========================================
-- ДЕТАЛЬНОЕ ИСПОЛЬЗОВАНИЕ РЕСУРСОВ
-- ========================================

CREATE TABLE resource_usage_details (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    quota_id INTEGER REFERENCES usage_quotas(id) ON DELETE CASCADE,

    -- Детали использования
    resource_type VARCHAR(100) NOT NULL,
    usage_amount INTEGER DEFAULT 1,

    -- Контекст использования
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100), -- create_product, api_call, export_data, etc
    resource_id VARCHAR(255), -- ID конкретного ресурса

    -- Время использования
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Дополнительная информация
    details JSONB DEFAULT '{}',
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE resource_usage_details IS 'Детальная информация об использовании ресурсов';

-- ========================================
-- БИЗНЕС-МЕТРИКИ КОМПАНИЙ
-- ========================================

CREATE TABLE company_metrics (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Период метрик
    metric_date DATE NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- daily, weekly, monthly

    -- Общие метрики активности
    active_users INTEGER DEFAULT 0,
    total_logins INTEGER DEFAULT 0,
    avg_session_duration DECIMAL(8,2) DEFAULT 0, -- в минутах

    -- Метрики контента
    total_products INTEGER DEFAULT 0,
    active_products INTEGER DEFAULT 0,
    new_products INTEGER DEFAULT 0,

    -- Метрики заказов
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(12,2) DEFAULT 0,

    -- Метрики интеграций
    sync_operations INTEGER DEFAULT 0,
    successful_syncs INTEGER DEFAULT 0,
    failed_syncs INTEGER DEFAULT 0,

    -- Метрики API
    api_calls INTEGER DEFAULT 0,
    api_errors INTEGER DEFAULT 0,

    -- Валюта
    currency CHAR(3) DEFAULT 'RUB',

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, metric_date, metric_type)
);

COMMENT ON TABLE company_metrics IS 'Ежедневные бизнес-метрики компаний';

-- ========================================
-- ПЛАТФОРМЕННЫЕ МЕТРИКИ
-- ========================================

CREATE TABLE platform_metrics (
    id SERIAL PRIMARY KEY,

    -- Период метрик
    metric_date DATE NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- daily, weekly, monthly

    -- Метрики роста
    total_companies INTEGER DEFAULT 0,
    active_companies INTEGER DEFAULT 0,
    new_companies INTEGER DEFAULT 0,
    churned_companies INTEGER DEFAULT 0,

    -- Финансовые метрики
    total_revenue DECIMAL(12,2) DEFAULT 0,
    recurring_revenue DECIMAL(12,2) DEFAULT 0,
    one_time_revenue DECIMAL(12,2) DEFAULT 0,

    -- Метрики использования
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    total_products INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,

    -- Технические метрики
    total_api_calls INTEGER DEFAULT 0,
    total_sync_operations INTEGER DEFAULT 0,
    avg_response_time DECIMAL(8,2) DEFAULT 0, -- в миллисекундах
    uptime_percent DECIMAL(5,2) DEFAULT 100,

    -- Метрики поддержки
    support_tickets INTEGER DEFAULT 0,
    resolved_tickets INTEGER DEFAULT 0,
    avg_resolution_time DECIMAL(8,2) DEFAULT 0, -- в часах

    -- Валюта
    currency CHAR(3) DEFAULT 'RUB',

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(metric_date, metric_type)
);

COMMENT ON TABLE platform_metrics IS 'Общие метрики платформы';

-- ========================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ========================================

-- Индексы для аналитики продаж
CREATE INDEX idx_sales_analytics_company ON sales_analytics(company_id);
CREATE INDEX idx_sales_analytics_product ON sales_analytics(product_id);
CREATE INDEX idx_sales_analytics_supplier ON sales_analytics(supplier_id);
CREATE INDEX idx_sales_analytics_marketplace ON sales_analytics(marketplace_id);
CREATE INDEX idx_sales_analytics_warehouse ON sales_analytics(warehouse_id);
CREATE INDEX idx_sales_analytics_period ON sales_analytics(period_type, period_start, period_end);
CREATE INDEX idx_sales_analytics_revenue ON sales_analytics(revenue);
CREATE INDEX idx_sales_analytics_profit ON sales_analytics(profit);

-- Составные индексы для аналитики
CREATE INDEX idx_sales_analytics_company_period ON sales_analytics(company_id, period_type, period_start);
CREATE INDEX idx_sales_analytics_product_period ON sales_analytics(product_id, period_type, period_start);

-- Индексы для аналитики поставщиков
CREATE INDEX idx_supplier_analytics_company ON supplier_analytics(company_id);
CREATE INDEX idx_supplier_analytics_supplier ON supplier_analytics(supplier_id);
CREATE INDEX idx_supplier_analytics_period ON supplier_analytics(period_type, period_start, period_end);

-- Индексы для функций и подписок
CREATE INDEX idx_available_features_code ON available_features(feature_code);
CREATE INDEX idx_available_features_category ON available_features(category);
CREATE INDEX idx_available_features_is_active ON available_features(is_active);
CREATE INDEX idx_available_features_monthly_price ON available_features(monthly_price);

CREATE INDEX idx_company_subscriptions_company ON company_subscriptions(company_id);
CREATE INDEX idx_company_subscriptions_feature ON company_subscriptions(feature_id);
CREATE INDEX idx_company_subscriptions_active ON company_subscriptions(is_active);
CREATE INDEX idx_company_subscriptions_expires ON company_subscriptions(expires_at);
CREATE INDEX idx_company_subscriptions_next_billing ON company_subscriptions(next_billing_date);

-- Составные индексы для подписок
CREATE INDEX idx_company_subscriptions_company_active ON company_subscriptions(company_id, is_active);

-- GIN индексы для использования функций
CREATE INDEX idx_company_subscriptions_limits ON company_subscriptions USING GIN(usage_limits);
CREATE INDEX idx_company_subscriptions_usage ON company_subscriptions USING GIN(current_usage);

-- Индексы для биллинговых транзакций
CREATE INDEX idx_billing_transactions_company ON billing_transactions(company_id);
CREATE INDEX idx_billing_transactions_type ON billing_transactions(type);
CREATE INDEX idx_billing_transactions_status ON billing_transactions(status);
CREATE INDEX idx_billing_transactions_subscription ON billing_transactions(subscription_id);
CREATE INDEX idx_billing_transactions_tariff ON billing_transactions(tariff_id);
CREATE INDEX idx_billing_transactions_amount ON billing_transactions(amount);
CREATE INDEX idx_billing_transactions_processed_at ON billing_transactions(processed_at);
CREATE INDEX idx_billing_transactions_stripe_payment ON billing_transactions(stripe_payment_intent_id);

-- Составные индексы для транзакций
CREATE INDEX idx_billing_transactions_company_date ON billing_transactions(company_id, processed_at);
CREATE INDEX idx_billing_transactions_company_status ON billing_transactions(company_id, status);

-- Индексы для использования функций
CREATE INDEX idx_feature_usage_company ON feature_usage(company_id);
CREATE INDEX idx_feature_usage_feature_code ON feature_usage(feature_code);
CREATE INDEX idx_feature_usage_subscription ON feature_usage(subscription_id);
CREATE INDEX idx_feature_usage_date ON feature_usage(usage_date);
CREATE INDEX idx_feature_usage_user ON feature_usage(user_id);
CREATE INDEX idx_feature_usage_timestamp ON feature_usage(usage_timestamp);

-- Составные индексы для использования
CREATE INDEX idx_feature_usage_company_date ON feature_usage(company_id, usage_date);
CREATE INDEX idx_feature_usage_feature_date ON feature_usage(feature_code, usage_date);

-- Индексы для истории тарифов
CREATE INDEX idx_tariff_history_company ON tariff_history(company_id);
CREATE INDEX idx_tariff_history_tariff ON tariff_history(tariff_id);
CREATE INDEX idx_tariff_history_period ON tariff_history(started_at, ended_at);
CREATE INDEX idx_tariff_history_changed_by ON tariff_history(changed_by);

-- Индексы для отчетов
CREATE INDEX idx_custom_reports_company ON custom_reports(company_id);
CREATE INDEX idx_custom_reports_type ON custom_reports(report_type);
CREATE INDEX idx_custom_reports_is_active ON custom_reports(is_active);
CREATE INDEX idx_custom_reports_is_scheduled ON custom_reports(is_scheduled);
CREATE INDEX idx_custom_reports_created_by ON custom_reports(created_by);
CREATE INDEX idx_custom_reports_next_generation ON custom_reports(next_generation);

CREATE INDEX idx_report_generation_history_report ON report_generation_history(report_id);
CREATE INDEX idx_report_generation_history_status ON report_generation_history(status);
CREATE INDEX idx_report_generation_history_started_at ON report_generation_history(started_at);

-- Индексы для квот
CREATE INDEX idx_usage_quotas_company ON usage_quotas(company_id);
CREATE INDEX idx_usage_quotas_resource_type ON usage_quotas(resource_type);
CREATE INDEX idx_usage_quotas_period ON usage_quotas(quota_period, period_start, period_end);
CREATE INDEX idx_usage_quotas_is_active ON usage_quotas(is_active);
CREATE INDEX idx_usage_quotas_warning ON usage_quotas(warning_threshold, warning_sent);

-- Составные индексы для квот
CREATE INDEX idx_usage_quotas_company_resource ON usage_quotas(company_id, resource_type);

CREATE INDEX idx_resource_usage_details_company ON resource_usage_details(company_id);
CREATE INDEX idx_resource_usage_details_quota ON resource_usage_details(quota_id);
CREATE INDEX idx_resource_usage_details_resource_type ON resource_usage_details(resource_type);
CREATE INDEX idx_resource_usage_details_user ON resource_usage_details(user_id);
CREATE INDEX idx_resource_usage_details_used_at ON resource_usage_details(used_at);

-- Индексы для метрик
CREATE INDEX idx_company_metrics_company ON company_metrics(company_id);
CREATE INDEX idx_company_metrics_date ON company_metrics(metric_date);
CREATE INDEX idx_company_metrics_type ON company_metrics(metric_type);

-- Составные индексы для метрик
CREATE INDEX idx_company_metrics_company_date ON company_metrics(company_id, metric_date);

CREATE INDEX idx_platform_metrics_date ON platform_metrics(metric_date);
CREATE INDEX idx_platform_metrics_type ON platform_metrics(metric_type);

-- ========================================
-- ТРИГГЕРЫ ДЛЯ АВТОМАТИЗАЦИИ
-- ========================================

-- Триггеры для обновления updated_at
CREATE TRIGGER trigger_update_sales_analytics_updated_at
    BEFORE UPDATE ON sales_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_supplier_analytics_updated_at
    BEFORE UPDATE ON supplier_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_available_features_updated_at
    BEFORE UPDATE ON available_features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_company_subscriptions_updated_at
    BEFORE UPDATE ON company_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_billing_transactions_updated_at
    BEFORE UPDATE ON billing_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_custom_reports_updated_at
    BEFORE UPDATE ON custom_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_usage_quotas_updated_at
    BEFORE UPDATE ON usage_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ФУНКЦИИ ДЛЯ АНАЛИТИКИ И БИЛЛИНГА
-- ========================================

-- Функция для обновления использования квот
CREATE OR REPLACE FUNCTION update_quota_usage(
    p_company_id INTEGER,
    p_resource_type VARCHAR(100),
    p_usage_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    current_quota RECORD;
    quota_exceeded BOOLEAN := FALSE;
BEGIN
    -- Находим активную квоту на текущий период
    SELECT * INTO current_quota
    FROM usage_quotas
    WHERE company_id = p_company_id
      AND resource_type = p_resource_type
      AND is_active = TRUE
      AND period_start <= CURRENT_DATE
      AND period_end >= CURRENT_DATE
    ORDER BY period_start DESC
    LIMIT 1;

    -- Если квота не найдена, создаем новую (месячную)
    IF current_quota IS NULL THEN
        INSERT INTO usage_quotas (
            company_id, resource_type, quota_period,
            period_start, period_end, quota_limit, quota_used
        ) VALUES (
            p_company_id, p_resource_type, 'monthly',
            DATE_TRUNC('month', CURRENT_DATE),
            DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
            CASE p_resource_type
                WHEN 'api_calls' THEN 10000
                WHEN 'products' THEN 1000
                WHEN 'exports' THEN 100
                ELSE 1000
            END,
            p_usage_amount
        );
    ELSE
        -- Обновляем использование
        UPDATE usage_quotas
        SET quota_used = quota_used + p_usage_amount,
            updated_at = NOW()
        WHERE id = current_quota.id;

        -- Проверяем превышение квоты
        IF current_quota.quota_used + p_usage_amount > current_quota.quota_limit
           AND NOT current_quota.is_unlimited THEN
            quota_exceeded := TRUE;
        END IF;

        -- Проверяем порог предупреждения
        IF NOT current_quota.warning_sent
           AND current_quota.warning_threshold IS NOT NULL
           AND current_quota.quota_used + p_usage_amount >= current_quota.warning_threshold THEN
            UPDATE usage_quotas
            SET warning_sent = TRUE
            WHERE id = current_quota.id;

            -- Здесь можно добавить логику отправки уведомления
        END IF;
    END IF;

    RETURN NOT quota_exceeded;
END;
$$ LANGUAGE plpgsql;

-- Функция для расчета margin_percent в аналитике
CREATE OR REPLACE FUNCTION calculate_margin_percent()
RETURNS TRIGGER AS $$
BEGIN
    -- Рассчитываем процент маржи
    IF NEW.revenue > 0 THEN
        NEW.margin_percent := ((NEW.profit / NEW.revenue) * 100)::DECIMAL(5,2);
    ELSE
        NEW.margin_percent := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления баланса компании при транзакциях
CREATE OR REPLACE FUNCTION update_company_balance()
RETURNS TRIGGER AS $$
DECLARE
    balance_change DECIMAL(12,2);
BEGIN
    -- Рассчитываем изменение баланса в зависимости от типа транзакции
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        balance_change := CASE NEW.type
            WHEN 'payment' THEN NEW.amount
            WHEN 'refund' THEN -NEW.amount
            WHEN 'adjustment' THEN NEW.amount
            ELSE 0
        END;

        -- Обновляем баланс компании
        UPDATE companies
        SET balance = balance + balance_change,
            updated_at = NOW()
        WHERE id = NEW.company_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггеры
CREATE TRIGGER trigger_calculate_margin_percent
    BEFORE INSERT OR UPDATE ON sales_analytics
    FOR EACH ROW EXECUTE FUNCTION calculate_margin_percent();

CREATE TRIGGER trigger_update_company_balance
    AFTER UPDATE ON billing_transactions
    FOR EACH ROW EXECUTE FUNCTION update_company_balance();

-- ========================================
-- ПРОВЕРКИ И ОГРАНИЧЕНИЯ
-- ========================================

-- Проверки для аналитики продаж
ALTER TABLE sales_analytics ADD CONSTRAINT check_period_type
    CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly'));

ALTER TABLE sales_analytics ADD CONSTRAINT check_dates_order
    CHECK (period_start <= period_end);

-- Проверки для функций
ALTER TABLE available_features ADD CONSTRAINT check_monthly_price_non_negative
    CHECK (monthly_price >= 0);

ALTER TABLE available_features ADD CONSTRAINT check_billing_cycle
    CHECK (billing_cycle IN ('monthly', 'yearly', 'usage_based'));

-- Проверки для подписок
ALTER TABLE company_subscriptions ADD CONSTRAINT check_subscription_dates
    CHECK (starts_at < expires_at);

ALTER TABLE company_subscriptions ADD CONSTRAINT check_subscription_price_non_negative
    CHECK (monthly_price >= 0);

-- Проверки для транзакций
ALTER TABLE billing_transactions ADD CONSTRAINT check_transaction_type
    CHECK (type IN ('payment', 'refund', 'adjustment', 'subscription', 'usage_charge', 'setup_fee'));

ALTER TABLE billing_transactions ADD CONSTRAINT check_transaction_status
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'disputed'));

-- Проверки для квот
ALTER TABLE usage_quotas ADD CONSTRAINT check_quota_limit_positive
    CHECK (quota_limit > 0);

ALTER TABLE usage_quotas ADD CONSTRAINT check_quota_used_non_negative
    CHECK (quota_used >= 0);

ALTER TABLE usage_quotas ADD CONSTRAINT check_quota_period
    CHECK (quota_period IN ('daily', 'weekly', 'monthly', 'yearly'));

-- Проверки для отчетов
ALTER TABLE custom_reports ADD CONSTRAINT check_report_type
    CHECK (report_type IN ('sales', 'profit', 'inventory', 'supplier', 'marketplace', 'custom', 'usage', 'billing'));

ALTER TABLE custom_reports ADD CONSTRAINT check_generation_status
    CHECK (generation_status IN ('ready', 'generating', 'completed', 'error'));

-- ========================================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ========================================

-- Представление активных подписок
CREATE VIEW active_subscriptions AS
SELECT
    cs.id,
    cs.company_id,
    c.name as company_name,
    af.feature_code,
    af.name as feature_name,
    af.category,
    cs.monthly_price,
    cs.starts_at,
    cs.expires_at,
    cs.auto_renew,
    cs.next_billing_date,
    cs.usage_limits,
    cs.current_usage,
    cs.is_active
FROM company_subscriptions cs
JOIN companies c ON cs.company_id = c.id
JOIN available_features af ON cs.feature_id = af.id
WHERE cs.is_active = TRUE
  AND cs.expires_at > NOW()
  AND c.is_active = TRUE;

COMMENT ON VIEW active_subscriptions IS 'Представление активных подписок компаний';

-- Представление доходности компаний
CREATE VIEW company_revenue_summary AS
SELECT
    c.id as company_id,
    c.name as company_name,
    c.plan,
    COALESCE(SUM(cs.monthly_price), 0) as monthly_revenue,
    COUNT(cs.id) as active_subscriptions,
    c.subscription_status,
    c.subscription_end_date,
    c.created_at as customer_since
FROM companies c
LEFT JOIN company_subscriptions cs ON c.id = cs.company_id AND cs.is_active = TRUE
WHERE c.is_active = TRUE
GROUP BY c.id;

COMMENT ON VIEW company_revenue_summary IS 'Сводка по доходности компаний';

-- Представление использования квот
CREATE VIEW quota_usage_summary AS
SELECT
    uq.company_id,
    c.name as company_name,
    uq.resource_type,
    uq.quota_limit,
    uq.quota_used,
    uq.quota_remaining,
    CASE
        WHEN uq.is_unlimited THEN 'unlimited'
        WHEN uq.quota_remaining <= 0 THEN 'exceeded'
        WHEN uq.warning_threshold IS NOT NULL AND uq.quota_used >= uq.warning_threshold THEN 'warning'
        WHEN uq.quota_used::DECIMAL / uq.quota_limit > 0.8 THEN 'high_usage'
        ELSE 'normal'
    END as usage_status,
    uq.period_start,
    uq.period_end,
    uq.last_reset
FROM usage_quotas uq
JOIN companies c ON uq.company_id = c.id
WHERE uq.is_active = TRUE
  AND uq.period_start <= CURRENT_DATE
  AND uq.period_end >= CURRENT_DATE;

COMMENT ON VIEW quota_usage_summary IS 'Сводка по использованию квот компаниями';