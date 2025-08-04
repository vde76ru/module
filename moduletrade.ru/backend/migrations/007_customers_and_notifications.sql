-- ========================================
-- МИГРАЦИЯ 007: МОДУЛИ КЛИЕНТОВ И УВЕДОМЛЕНИЙ
-- Таблицы для CRM системы и системы уведомлений
-- Версия: 2.0
-- ========================================

-- ========================================
-- МОДУЛЬ УПРАВЛЕНИЯ КЛИЕНТАМИ (CRM)
-- ========================================

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Основная информация
    customer_code VARCHAR(100), -- уникальный код клиента в рамках компании
    name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    middle_name VARCHAR(100),

    -- Контактная информация
    email VARCHAR(255),
    phone VARCHAR(50),
    additional_phones JSONB DEFAULT '[]',

    -- Адреса
    addresses JSONB DEFAULT '[]',
    -- Пример: [{"type": "billing", "country": "RU", "city": "Москва", "street": "...", "postal_code": "..."}]

    default_address_index INTEGER DEFAULT 0,

    -- Тип клиента
    customer_type VARCHAR(50) DEFAULT 'individual',
    -- Возможные значения: individual, business, wholesale, vip, reseller

    -- Юридическая информация (для юр. лиц)
    legal_info JSONB DEFAULT '{}',
    -- Пример: {"company_name": "ООО Рога и копыта", "inn": "1234567890", "kpp": "123456789", "ogrn": "..."}

    -- Статус клиента
    status VARCHAR(50) DEFAULT 'active',
    -- Возможные значения: active, inactive, blocked, vip, prospect

    -- Сегментация
    segments JSONB DEFAULT '[]', -- массив сегментов клиента
    tags JSONB DEFAULT '[]', -- теги для группировки

    -- Даты
    first_order_date DATE,
    last_order_date DATE,

    -- Статистика
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(12,2) DEFAULT 0,
    lifetime_value DECIMAL(12,2) DEFAULT 0,

    -- Скидки и условия
    discount_percent DECIMAL(5,2) DEFAULT 0,
    payment_terms JSONB DEFAULT '{}',
    -- Пример: {"payment_method": "card", "credit_limit": 50000, "payment_days": 30}

    -- Настройки коммуникации
    communication_preferences JSONB DEFAULT '{}',
    -- Пример: {"email_marketing": true, "sms_notifications": false, "call_notifications": true}

    -- Менеджер
    assigned_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Источник клиента
    acquisition_source VARCHAR(100), -- website, marketplace, referral, advertising, etc
    acquisition_date DATE,
    referrer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,

    -- Метаданные
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Внешние ID
    external_ids JSONB DEFAULT '{}',
    -- Пример: {"crm_id": "12345", "marketplace_ids": {"ozon": "buyer123", "wb": "client456"}}

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, customer_code)
);

COMMENT ON TABLE customers IS 'База клиентов (CRM)';

-- ========================================
-- ИСТОРИЯ ВЗАИМОДЕЙСТВИЙ С КЛИЕНТАМИ
-- ========================================

CREATE TABLE customer_interactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Тип взаимодействия
    interaction_type VARCHAR(100) NOT NULL,
    -- Возможные значения: call, email, meeting, support_ticket, order, complaint, review

    -- Направление взаимодействия
    direction VARCHAR(20) DEFAULT 'outbound',
    -- Возможные значения: inbound, outbound

    -- Содержание
    subject VARCHAR(255),
    content TEXT,

    -- Результат
    outcome VARCHAR(100), -- positive, negative, neutral, follow_up_needed, resolved
    next_action VARCHAR(255),
    next_action_date DATE,

    -- Участники
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- ответственный сотрудник
    participants JSONB DEFAULT '[]', -- другие участники

    -- Связанные объекты
    related_order_id INTEGER REFERENCES incoming_orders(id) ON DELETE SET NULL,
    related_object_type VARCHAR(100), -- order, product, support_ticket, etc
    related_object_id INTEGER,

    -- Каналы коммуникации
    communication_channel VARCHAR(100), -- phone, email, chat, face_to_face, video_call

    -- Приоритет и статус
    priority INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed',
    -- Возможные значения: scheduled, in_progress, completed, cancelled

    -- Время взаимодействия
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE customer_interactions IS 'История взаимодействий с клиентами';

-- ========================================
-- СИСТЕМА УВЕДОМЛЕНИЙ
-- ========================================

CREATE TABLE notification_templates (
    id SERIAL PRIMARY KEY,

    -- Основная информация
    template_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Тип уведомления
    notification_type VARCHAR(50) NOT NULL,
    -- Возможные значения: email, sms, push, system, webhook

    -- Категория
    category VARCHAR(100),
    -- Возможные значения: order, stock, sync, billing, system, marketing

    -- Триггер
    trigger_event VARCHAR(100) NOT NULL,
    -- Возможные значения: order_created, stock_low, sync_error, payment_received, etc

    -- Шаблон сообщения
    subject_template VARCHAR(500),
    message_template TEXT NOT NULL,

    -- Настройки форматирования
    format_type VARCHAR(50) DEFAULT 'html',
    -- Возможные значения: plain, html, markdown

    -- Переменные шаблона
    template_variables JSONB DEFAULT '[]',
    -- Пример: ["customer_name", "order_number", "total_amount"]

    -- Настройки отправки
    priority INTEGER DEFAULT 0,
    batch_sending BOOLEAN DEFAULT FALSE,
    delay_minutes INTEGER DEFAULT 0,

    -- Локализация
    locale VARCHAR(10) DEFAULT 'ru',

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE, -- системный шаблон (нельзя удалять)

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE notification_templates IS 'Шаблоны уведомлений';

-- ========================================
-- ОЧЕРЕДЬ УВЕДОМЛЕНИЙ
-- ========================================

CREATE TABLE notification_queue (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES notification_templates(id) ON DELETE SET NULL,

    -- Получатель
    recipient_type VARCHAR(50) NOT NULL,
    -- Возможные значения: user, customer, external, webhook

    recipient_id INTEGER, -- ID пользователя или клиента
    recipient_contact VARCHAR(255) NOT NULL, -- email, phone, url

    -- Тип уведомления
    notification_type VARCHAR(50) NOT NULL,
    category VARCHAR(100),

    -- Содержание
    subject VARCHAR(500),
    message TEXT NOT NULL,

    -- Приоритет и планирование
    priority INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Статус отправки
    status VARCHAR(50) DEFAULT 'pending',
    -- Возможные значения: pending, sending, sent, failed, cancelled

    -- Результат отправки
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Ошибки
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,

    -- Связанные объекты
    related_object_type VARCHAR(100),
    related_object_id INTEGER,

    -- Метаданные
    metadata JSONB DEFAULT '{}',
    delivery_details JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE notification_queue IS 'Очередь уведомлений для отправки';

-- ========================================
-- НАСТРОЙКИ УВЕДОМЛЕНИЙ КОМПАНИЙ
-- ========================================

CREATE TABLE company_notification_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Общие настройки
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    sms_notifications_enabled BOOLEAN DEFAULT FALSE,
    push_notifications_enabled BOOLEAN DEFAULT TRUE,

    -- Настройки по категориям
    category_settings JSONB DEFAULT '{}',
    -- Пример: {"order": {"email": true, "sms": false}, "stock": {"email": true, "sms": true}}

    -- Настройки времени отправки
    quiet_hours JSONB DEFAULT '{}',
    -- Пример: {"start": "22:00", "end": "08:00", "timezone": "Europe/Moscow"}

    -- Частота уведомлений
    frequency_limits JSONB DEFAULT '{}',
    -- Пример: {"email": {"max_per_hour": 10, "max_per_day": 50}, "sms": {"max_per_day": 5}}

    -- Контакты по умолчанию
    default_email VARCHAR(255),
    default_phone VARCHAR(50),

    -- Специальные настройки
    emergency_contacts JSONB DEFAULT '[]',
    escalation_rules JSONB DEFAULT '{}',

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id)
);

COMMENT ON TABLE company_notification_settings IS 'Настройки уведомлений для компаний';

-- ========================================
-- НАСТРОЙКИ УВЕДОМЛЕНИЙ ПОЛЬЗОВАТЕЛЕЙ
-- ========================================

CREATE TABLE user_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Каналы уведомлений
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    browser_enabled BOOLEAN DEFAULT TRUE,

    -- Предпочтения по категориям
    category_preferences JSONB DEFAULT '{}',
    -- Пример: {"order": {"email": true, "push": true}, "system": {"email": false, "push": true}}

    -- Контакты для уведомлений
    notification_email VARCHAR(255), -- может отличаться от основного email
    notification_phone VARCHAR(50),

    -- Настройки времени
    timezone VARCHAR(100) DEFAULT 'Europe/Moscow',
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',

    -- Группировка уведомлений
    digest_enabled BOOLEAN DEFAULT FALSE,
    digest_frequency VARCHAR(20) DEFAULT 'daily', -- hourly, daily, weekly
    digest_time TIME DEFAULT '09:00',

    -- Фильтры
    priority_threshold INTEGER DEFAULT 0, -- минимальный приоритет для уведомлений

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id)
);

COMMENT ON TABLE user_notification_preferences IS 'Персональные настройки уведомлений пользователей';

-- ========================================
-- ИСТОРИЯ УВЕДОМЛЕНИЙ
-- ========================================

CREATE TABLE notification_history (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Основная информация
    notification_type VARCHAR(50) NOT NULL,
    category VARCHAR(100),

    -- Получатель
    recipient_type VARCHAR(50) NOT NULL,
    recipient_id INTEGER,
    recipient_contact VARCHAR(255),

    -- Содержание
    subject VARCHAR(500),
    message TEXT,

    -- Статус доставки
    status VARCHAR(50) NOT NULL,
    -- Возможные значения: sent, delivered, read, failed, bounced, spam

    -- Время событий
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Взаимодействие с уведомлением
    clicked_at TIMESTAMP WITH TIME ZONE,
    action_taken VARCHAR(255), -- какое действие выполнил получатель

    -- Метрики доставки
    delivery_duration_ms INTEGER, -- время доставки в миллисекундах
    provider VARCHAR(100), -- провайдер доставки (smtp, sms_service, push_service)

    -- Связанные объекты
    related_object_type VARCHAR(100),
    related_object_id INTEGER,

    -- Метаданные
    metadata JSONB DEFAULT '{}',
    delivery_details JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE notification_history IS 'История отправленных уведомлений';

-- ========================================
-- ПОДПИСКИ НА УВЕДОМЛЕНИЯ
-- ========================================

CREATE TABLE notification_subscriptions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Подписчик
    subscriber_type VARCHAR(50) NOT NULL,
    -- Возможные значения: user, customer, external, webhook

    subscriber_id INTEGER,
    contact VARCHAR(255) NOT NULL,

    -- Подписка
    event_types JSONB DEFAULT '[]', -- массив типов событий
    conditions JSONB DEFAULT '{}', -- условия срабатывания

    -- Настройки доставки
    delivery_method VARCHAR(50) NOT NULL, -- email, sms, webhook, push
    delivery_settings JSONB DEFAULT '{}',

    -- Статус подписки
    is_active BOOLEAN DEFAULT TRUE,
    confirmed BOOLEAN DEFAULT FALSE,
    confirmation_token VARCHAR(255),
    confirmed_at TIMESTAMP WITH TIME ZONE,

    -- Статистика
    total_notifications INTEGER DEFAULT 0,
    last_notification_at TIMESTAMP WITH TIME ZONE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE notification_subscriptions IS 'Подписки на уведомления';

-- ========================================
-- ГРУППЫ КЛИЕНТОВ
-- ========================================

CREATE TABLE customer_groups (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

    -- Основная информация
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Тип группы
    group_type VARCHAR(50) DEFAULT 'manual',
    -- Возможные значения: manual, automatic, dynamic

    -- Условия автоматического включения (для automatic и dynamic групп)
    auto_criteria JSONB DEFAULT '{}',
    -- Пример: {"total_spent": {"min": 10000}, "order_count": {"min": 5}, "last_order_days": {"max": 30}}

    -- Настройки группы
    discount_percent DECIMAL(5,2) DEFAULT 0,
    special_conditions JSONB DEFAULT '{}',

    -- Цвет для UI
    color VARCHAR(20),
    icon VARCHAR(100),

    -- Статистика
    members_count INTEGER DEFAULT 0,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(company_id, name)
);

COMMENT ON TABLE customer_groups IS 'Группы клиентов для сегментации';

-- ========================================
-- ПРИНАДЛЕЖНОСТЬ КЛИЕНТОВ К ГРУППАМ
-- ========================================

CREATE TABLE customer_group_memberships (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES customer_groups(id) ON DELETE CASCADE,

    -- Тип членства
    membership_type VARCHAR(50) DEFAULT 'manual',
    -- Возможные значения: manual, automatic, imported

    -- Даты
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- для временного членства

    -- Кто добавил
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Метаданные
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(customer_id, group_id)
);

COMMENT ON TABLE customer_group_memberships IS 'Принадлежность клиентов к группам';

-- ========================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ========================================

-- Индексы для клиентов
CREATE INDEX idx_customers_company_id ON customers(company_id);
CREATE INDEX idx_customers_customer_code ON customers(customer_code);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_customer_type ON customers(customer_type);
CREATE INDEX idx_customers_assigned_manager ON customers(assigned_manager_id);
CREATE INDEX idx_customers_acquisition_source ON customers(acquisition_source);
CREATE INDEX idx_customers_total_spent ON customers(total_spent);
CREATE INDEX idx_customers_last_order_date ON customers(last_order_date);

-- Составные индексы для клиентов
CREATE INDEX idx_customers_company_status ON customers(company_id, status);
CREATE INDEX idx_customers_company_type ON customers(company_id, customer_type);
CREATE INDEX idx_customers_manager_status ON customers(assigned_manager_id, status);

-- Полнотекстовый поиск для клиентов
CREATE INDEX idx_customers_name_gin ON customers USING GIN(to_tsvector('russian', COALESCE(name, '')));
CREATE INDEX idx_customers_fullname_gin ON customers USING GIN(to_tsvector('russian',
    COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(middle_name, '')
));

-- GIN индексы для JSON полей клиентов
CREATE INDEX idx_customers_addresses ON customers USING GIN(addresses);
CREATE INDEX idx_customers_segments ON customers USING GIN(segments);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);
CREATE INDEX idx_customers_external_ids ON customers USING GIN(external_ids);

-- Индексы для взаимодействий с клиентами
CREATE INDEX idx_customer_interactions_customer ON customer_interactions(customer_id);
CREATE INDEX idx_customer_interactions_company ON customer_interactions(company_id);
CREATE INDEX idx_customer_interactions_type ON customer_interactions(interaction_type);
CREATE INDEX idx_customer_interactions_direction ON customer_interactions(direction);
CREATE INDEX idx_customer_interactions_user ON customer_interactions(user_id);
CREATE INDEX idx_customer_interactions_status ON customer_interactions(status);
CREATE INDEX idx_customer_interactions_scheduled_at ON customer_interactions(scheduled_at);
CREATE INDEX idx_customer_interactions_completed_at ON customer_interactions(completed_at);
CREATE INDEX idx_customer_interactions_related_order ON customer_interactions(related_order_id);

-- Составные индексы для взаимодействий
CREATE INDEX idx_customer_interactions_customer_type ON customer_interactions(customer_id, interaction_type);
CREATE INDEX idx_customer_interactions_company_status ON customer_interactions(company_id, status);

-- Индексы для шаблонов уведомлений
CREATE INDEX idx_notification_templates_code ON notification_templates(template_code);
CREATE INDEX idx_notification_templates_type ON notification_templates(notification_type);
CREATE INDEX idx_notification_templates_category ON notification_templates(category);
CREATE INDEX idx_notification_templates_trigger_event ON notification_templates(trigger_event);
CREATE INDEX idx_notification_templates_is_active ON notification_templates(is_active);
CREATE INDEX idx_notification_templates_locale ON notification_templates(locale);

-- Индексы для очереди уведомлений
CREATE INDEX idx_notification_queue_company ON notification_queue(company_id);
CREATE INDEX idx_notification_queue_template ON notification_queue(template_id);
CREATE INDEX idx_notification_queue_recipient ON notification_queue(recipient_type, recipient_id);
CREATE INDEX idx_notification_queue_contact ON notification_queue(recipient_contact);
CREATE INDEX idx_notification_queue_type ON notification_queue(notification_type);
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_priority ON notification_queue(priority DESC);
CREATE INDEX idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);
CREATE INDEX idx_notification_queue_next_retry ON notification_queue(next_retry_at);

-- Составные индексы для очереди
CREATE INDEX idx_notification_queue_status_scheduled ON notification_queue(status, scheduled_at);
CREATE INDEX idx_notification_queue_company_status ON notification_queue(company_id, status);

-- Индексы для настроек уведомлений
CREATE INDEX idx_company_notification_settings_company ON company_notification_settings(company_id);

CREATE INDEX idx_user_notification_preferences_user ON user_notification_preferences(user_id);

-- Индексы для истории уведомлений
CREATE INDEX idx_notification_history_company ON notification_history(company_id);
CREATE INDEX idx_notification_history_recipient ON notification_history(recipient_type, recipient_id);
CREATE INDEX idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX idx_notification_history_category ON notification_history(category);
CREATE INDEX idx_notification_history_status ON notification_history(status);
CREATE INDEX idx_notification_history_sent_at ON notification_history(sent_at);

-- Составные индексы для истории
CREATE INDEX idx_notification_history_company_date ON notification_history(company_id, sent_at);
CREATE INDEX idx_notification_history_recipient_date ON notification_history(recipient_type, recipient_id, sent_at);

-- Индексы для подписок на уведомления
CREATE INDEX idx_notification_subscriptions_company ON notification_subscriptions(company_id);
CREATE INDEX idx_notification_subscriptions_subscriber ON notification_subscriptions(subscriber_type, subscriber_id);
CREATE INDEX idx_notification_subscriptions_contact ON notification_subscriptions(contact);
CREATE INDEX idx_notification_subscriptions_delivery_method ON notification_subscriptions(delivery_method);
CREATE INDEX idx_notification_subscriptions_is_active ON notification_subscriptions(is_active);
CREATE INDEX idx_notification_subscriptions_confirmed ON notification_subscriptions(confirmed);

-- GIN индексы для массивов и JSON
CREATE INDEX idx_notification_subscriptions_event_types ON notification_subscriptions USING GIN(event_types);

-- Индексы для групп клиентов
CREATE INDEX idx_customer_groups_company ON customer_groups(company_id);
CREATE INDEX idx_customer_groups_type ON customer_groups(group_type);
CREATE INDEX idx_customer_groups_is_active ON customer_groups(is_active);

CREATE INDEX idx_customer_group_memberships_customer ON customer_group_memberships(customer_id);
CREATE INDEX idx_customer_group_memberships_group ON customer_group_memberships(group_id);
CREATE INDEX idx_customer_group_memberships_type ON customer_group_memberships(membership_type);
CREATE INDEX idx_customer_group_memberships_is_active ON customer_group_memberships(is_active);
CREATE INDEX idx_customer_group_memberships_expires ON customer_group_memberships(expires_at);

-- ========================================
-- ТРИГГЕРЫ ДЛЯ АВТОМАТИЗАЦИИ
-- ========================================

-- Триггеры для обновления updated_at
CREATE TRIGGER trigger_update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_customer_interactions_updated_at
    BEFORE UPDATE ON customer_interactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_notification_queue_updated_at
    BEFORE UPDATE ON notification_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_company_notification_settings_updated_at
    BEFORE UPDATE ON company_notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_user_notification_preferences_updated_at
    BEFORE UPDATE ON user_notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_customer_groups_updated_at
    BEFORE UPDATE ON customer_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_notification_subscriptions_updated_at
    BEFORE UPDATE ON notification_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С КЛИЕНТАМИ И УВЕДОМЛЕНИЯМИ
-- ========================================

-- Функция для обновления статистики клиента
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
DECLARE
    customer_stats RECORD;
    customer_id_val INTEGER;
BEGIN
    -- Определяем ID клиента из заказа
    IF TG_OP = 'DELETE' THEN
        -- Получаем customer_id из customer_info
        customer_id_val := (OLD.customer_info->>'customer_id')::INTEGER;
    ELSE
        customer_id_val := (NEW.customer_info->>'customer_id')::INTEGER;
    END IF;

    -- Если customer_id не задан, выходим
    IF customer_id_val IS NULL THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    -- Считаем статистику клиента
    SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_spent,
        COALESCE(AVG(total_amount), 0) as avg_order_value,
        MIN(order_date)::DATE as first_order_date,
        MAX(order_date)::DATE as last_order_date
    INTO customer_stats
    FROM incoming_orders
    WHERE (customer_info->>'customer_id')::INTEGER = customer_id_val
      AND status NOT IN ('cancelled');

    -- Обновляем статистику клиента
    UPDATE customers
    SET
        total_orders = customer_stats.total_orders,
        total_spent = customer_stats.total_spent,
        avg_order_value = customer_stats.avg_order_value,
        first_order_date = customer_stats.first_order_date,
        last_order_date = customer_stats.last_order_date,
        lifetime_value = customer_stats.total_spent, -- простой расчет LTV
        updated_at = NOW()
    WHERE id = customer_id_val;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Функция для создания уведомления
CREATE OR REPLACE FUNCTION create_notification(
    p_company_id INTEGER,
    p_template_code VARCHAR(100),
    p_recipient_type VARCHAR(50),
    p_recipient_id INTEGER,
    p_recipient_contact VARCHAR(255),
    p_variables JSONB DEFAULT '{}'
)
RETURNS INTEGER AS $$
DECLARE
    template_rec RECORD;
    notification_id INTEGER;
    final_subject VARCHAR(500);
    final_message TEXT;
    variable_name TEXT;
    variable_value TEXT;
BEGIN
    -- Получаем шаблон
    SELECT * INTO template_rec
    FROM notification_templates
    WHERE template_code = p_template_code AND is_active = TRUE;

    IF template_rec IS NULL THEN
        RAISE EXCEPTION 'Template % not found', p_template_code;
    END IF;

    -- Подставляем переменные в шаблон
    final_subject := template_rec.subject_template;
    final_message := template_rec.message_template;

    -- Заменяем переменные в тексте
    FOR variable_name IN SELECT jsonb_object_keys(p_variables) LOOP
        variable_value := p_variables->>variable_name;
        final_subject := REPLACE(final_subject, '{{' || variable_name || '}}', variable_value);
        final_message := REPLACE(final_message, '{{' || variable_name || '}}', variable_value);
    END LOOP;

    -- Создаем уведомление в очереди
    INSERT INTO notification_queue (
        company_id, template_id, recipient_type, recipient_id, recipient_contact,
        notification_type, category, subject, message, priority
    ) VALUES (
        p_company_id, template_rec.id, p_recipient_type, p_recipient_id, p_recipient_contact,
        template_rec.notification_type, template_rec.category, final_subject, final_message, template_rec.priority
    ) RETURNING id INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления счетчика участников группы
CREATE OR REPLACE FUNCTION update_group_members_count()
RETURNS TRIGGER AS $$
DECLARE
    group_id_val INTEGER;
    new_count INTEGER;
BEGIN
    -- Определяем ID группы
    IF TG_OP = 'DELETE' THEN
        group_id_val := OLD.group_id;
    ELSE
        group_id_val := NEW.group_id;
    END IF;

    -- Считаем активных участников
    SELECT COUNT(*)
    INTO new_count
    FROM customer_group_memberships
    WHERE group_id = group_id_val AND is_active = TRUE;

    -- Обновляем счетчик
    UPDATE customer_groups
    SET members_count = new_count, updated_at = NOW()
    WHERE id = group_id_val;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматической генерации кода клиента
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
DECLARE
    company_prefix VARCHAR(10);
    next_number INTEGER;
    customer_code_val VARCHAR(100);
BEGIN
    -- Если код уже задан, не генерируем
    IF NEW.customer_code IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Получаем префикс компании
    SELECT UPPER(LEFT(name, 3)) INTO company_prefix
    FROM companies WHERE id = NEW.company_id;

    -- Получаем следующий номер
    SELECT COALESCE(MAX(CAST(SUBSTRING(customer_code FROM '\d+$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM customers
    WHERE company_id = NEW.company_id
      AND customer_code ~ (company_prefix || '-C\d+$');

    -- Формируем код клиента
    customer_code_val := company_prefix || '-C' || LPAD(next_number::TEXT, 6, '0');

    NEW.customer_code := customer_code_val;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггеры
CREATE TRIGGER trigger_update_customer_stats
    AFTER INSERT OR UPDATE OR DELETE ON incoming_orders
    FOR EACH ROW EXECUTE FUNCTION update_customer_stats();

CREATE TRIGGER trigger_update_group_members_count
    AFTER INSERT OR UPDATE OR DELETE ON customer_group_memberships
    FOR EACH ROW EXECUTE FUNCTION update_group_members_count();

CREATE TRIGGER trigger_generate_customer_code
    BEFORE INSERT ON customers
    FOR EACH ROW EXECUTE FUNCTION generate_customer_code();

-- ========================================
-- ПРОВЕРКИ И ОГРАНИЧЕНИЯ
-- ========================================

-- Проверки для клиентов
ALTER TABLE customers ADD CONSTRAINT check_customer_type
    CHECK (customer_type IN ('individual', 'business', 'wholesale', 'vip', 'reseller'));

ALTER TABLE customers ADD CONSTRAINT check_customer_status
    CHECK (status IN ('active', 'inactive', 'blocked', 'vip', 'prospect'));

-- Проверки для взаимодействий
ALTER TABLE customer_interactions ADD CONSTRAINT check_interaction_type
    CHECK (interaction_type IN ('call', 'email', 'meeting', 'support_ticket', 'order', 'complaint', 'review', 'marketing'));

ALTER TABLE customer_interactions ADD CONSTRAINT check_direction
    CHECK (direction IN ('inbound', 'outbound'));

ALTER TABLE customer_interactions ADD CONSTRAINT check_interaction_status
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'));

-- Проверки для уведомлений
ALTER TABLE notification_templates ADD CONSTRAINT check_notification_type
    CHECK (notification_type IN ('email', 'sms', 'push', 'system', 'webhook'));

ALTER TABLE notification_queue ADD CONSTRAINT check_queue_recipient_type
    CHECK (recipient_type IN ('user', 'customer', 'external', 'webhook'));

ALTER TABLE notification_queue ADD CONSTRAINT check_queue_status
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled'));

ALTER TABLE notification_history ADD CONSTRAINT check_history_status
    CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'bounced', 'spam'));

-- Проверки для групп клиентов
ALTER TABLE customer_groups ADD CONSTRAINT check_group_type
    CHECK (group_type IN ('manual', 'automatic', 'dynamic'));

ALTER TABLE customer_group_memberships ADD CONSTRAINT check_membership_type
    CHECK (membership_type IN ('manual', 'automatic', 'imported'));

-- ========================================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ========================================

-- Представление активных клиентов с статистикой
CREATE VIEW active_customers AS
SELECT
    c.id,
    c.company_id,
    c.customer_code,
    c.name,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.customer_type,
    c.status,
    c.total_orders,
    c.total_spent,
    c.avg_order_value,
    c.lifetime_value,
    c.first_order_date,
    c.last_order_date,
    c.assigned_manager_id,
    u.name as manager_name,

    -- Вычисляемые поля
    CASE
        WHEN c.last_order_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'active'
        WHEN c.last_order_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'inactive'
        WHEN c.last_order_date IS NOT NULL THEN 'dormant'
        ELSE 'prospect'
    END as activity_status,

    CURRENT_DATE - c.last_order_date as days_since_last_order,

    c.created_at,
    c.updated_at
FROM customers c
LEFT JOIN users u ON c.assigned_manager_id = u.id
WHERE c.status IN ('active', 'vip');

COMMENT ON VIEW active_customers IS 'Представление активных клиентов с расширенной статистикой';

-- Представление уведомлений для отправки
CREATE VIEW pending_notifications AS
SELECT
    nq.id,
    nq.company_id,
    nq.template_id,
    nt.template_code,
    nq.recipient_type,
    nq.recipient_id,
    nq.recipient_contact,
    nq.notification_type,
    nq.category,
    nq.subject,
    nq.message,
    nq.priority,
    nq.scheduled_at,
    nq.retry_count,
    nq.max_retries,
    nq.next_retry_at,

    -- Проверяем настройки компании
    CASE
        WHEN nq.notification_type = 'email' AND cns.email_notifications_enabled = FALSE THEN FALSE
        WHEN nq.notification_type = 'sms' AND cns.sms_notifications_enabled = FALSE THEN FALSE
        WHEN nq.notification_type = 'push' AND cns.push_notifications_enabled = FALSE THEN FALSE
        ELSE TRUE
    END as is_allowed_by_company,

    nq.created_at
FROM notification_queue nq
LEFT JOIN notification_templates nt ON nq.template_id = nt.id
LEFT JOIN company_notification_settings cns ON nq.company_id = cns.company_id
WHERE nq.status = 'pending'
  AND nq.scheduled_at <= NOW()
  AND (nq.next_retry_at IS NULL OR nq.next_retry_at <= NOW())
  AND nq.retry_count < nq.max_retries
ORDER BY nq.priority DESC, nq.scheduled_at ASC;

COMMENT ON VIEW pending_notifications IS 'Уведомления готовые к отправке';

-- Представление топ клиентов
CREATE VIEW top_customers AS
SELECT
    c.id,
    c.company_id,
    c.customer_code,
    c.name,
    c.customer_type,
    c.total_orders,
    c.total_spent,
    c.avg_order_value,
    c.lifetime_value,
    c.last_order_date,

    -- Ранжирование
    RANK() OVER (PARTITION BY c.company_id ORDER BY c.total_spent DESC) as revenue_rank,
    RANK() OVER (PARTITION BY c.company_id ORDER BY c.total_orders DESC) as orders_rank,

    c.created_at
FROM customers c
WHERE c.status IN ('active', 'vip')
  AND c.total_orders > 0;

COMMENT ON VIEW top_customers IS 'Топ клиентов по различным метрикам';