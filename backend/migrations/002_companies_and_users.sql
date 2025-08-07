-- ================================================================
-- МИГРАЦИЯ 002: Компании, пользователи и платежи
-- Описание: Создает таблицы для компаний, пользователей и системы платежей
-- Дата: 2025-01-27
-- Блок: Пользователи и Доступ
-- Зависимости: 001 (roles, tariffs)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Companies - Информация о компаниях клиентах
-- ================================================================
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    tariff_id UUID NOT NULL,
    trial_end_date TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    subscription_status VARCHAR(20) DEFAULT 'trial',
    plan VARCHAR(50),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    legal_info JSONB DEFAULT '{}'::jsonb,
    billing_info JSONB DEFAULT '{}'::jsonb,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    pricing_rules JSONB DEFAULT '{}'::jsonb,
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_companies_tariff_id
        FOREIGN KEY (tariff_id) REFERENCES tariffs(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

COMMENT ON TABLE companies IS 'Информация о компаниях-клиентах SaaS платформы. Каждая компания представляет отдельный аккаунт в системе';
COMMENT ON COLUMN companies.name IS 'Название компании';
COMMENT ON COLUMN companies.settings IS 'Настройки компании: валюта по умолчанию, часовой пояс, локализация и т.д.';
COMMENT ON COLUMN companies.tariff_id IS 'Внешний ключ на таблицу tariffs - текущий тариф компании';
COMMENT ON COLUMN companies.trial_end_date IS 'Дата окончания пробного периода';
COMMENT ON COLUMN companies.subscription_end_date IS 'Дата окончания подписки';
COMMENT ON COLUMN companies.subscription_status IS 'Статус подписки: trial, active, expired, cancelled';
COMMENT ON COLUMN companies.plan IS 'Текущий план подписки';
COMMENT ON COLUMN companies.contact_email IS 'Основной email для связи с компанией';
COMMENT ON COLUMN companies.contact_phone IS 'Основной телефон для связи с компанией';
COMMENT ON COLUMN companies.legal_info IS 'Юридическая информация: ИНН, КПП, ОГРН, адрес и т.д.';
COMMENT ON COLUMN companies.billing_info IS 'Информация для выставления счетов';
COMMENT ON COLUMN companies.last_activity_at IS 'Дата последней активности пользователей компании';
COMMENT ON COLUMN companies.is_active IS 'Активна ли компания';
COMMENT ON COLUMN companies.pricing_rules IS 'Правила ценообразования компании';
COMMENT ON COLUMN companies.subscription_start_date IS 'Дата начала подписки';

CREATE INDEX idx_companies_name ON companies (name);
CREATE INDEX idx_companies_tariff_id ON companies (tariff_id);
CREATE INDEX idx_companies_subscription_status ON companies (subscription_status);
CREATE INDEX idx_companies_trial_end_date ON companies (trial_end_date)
    WHERE trial_end_date IS NOT NULL;
CREATE INDEX idx_companies_contact_email ON companies (contact_email);
CREATE INDEX idx_companies_last_activity ON companies (last_activity_at);
CREATE INDEX idx_companies_subscription_status_trial ON companies (subscription_status, trial_end_date)
    WHERE subscription_status = 'trial';
CREATE INDEX idx_companies_is_active ON companies (is_active);
CREATE INDEX idx_companies_subscription_end_date ON companies (subscription_end_date);

-- ================================================================
-- ТАБЛИЦА: Users - Пользователи системы
-- ================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL,
    role VARCHAR(50),
    phone VARCHAR(50),
    avatar_url VARCHAR(500),
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    refresh_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires_at TIMESTAMP WITH TIME ZONE,
    remember_token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_users_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_users_role_id
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

COMMENT ON TABLE users IS 'Пользователи системы, привязанные к компаниям';
COMMENT ON COLUMN users.company_id IS 'Внешний ключ на таблицу companies - компания пользователя';
COMMENT ON COLUMN users.name IS 'Полное имя пользователя';
COMMENT ON COLUMN users.email IS 'Email пользователя - используется для входа в систему';
COMMENT ON COLUMN users.password_hash IS 'Хеш пароля пользователя (bcrypt)';
COMMENT ON COLUMN users.role_id IS 'Внешний ключ на таблицу roles - роль пользователя';
COMMENT ON COLUMN users.role IS 'Текстовое название роли для совместимости с кодом';
COMMENT ON COLUMN users.phone IS 'Телефон пользователя';
COMMENT ON COLUMN users.avatar_url IS 'URL аватара пользователя';
COMMENT ON COLUMN users.settings IS 'Персональные настройки пользователя: язык, тема, уведомления и т.д.';
COMMENT ON COLUMN users.is_active IS 'Активен ли пользователь (может ли входить в систему)';
COMMENT ON COLUMN users.email_verified_at IS 'Дата и время подтверждения email адреса';
COMMENT ON COLUMN users.last_login IS 'Дата и время последнего входа в систему';
COMMENT ON COLUMN users.last_login_ip IS 'IP адрес последнего входа';
COMMENT ON COLUMN users.refresh_token IS 'Токен обновления для аутентификации';
COMMENT ON COLUMN users.password_reset_token IS 'Токен для сброса пароля';
COMMENT ON COLUMN users.password_reset_expires_at IS 'Время истечения токена сброса пароля';
COMMENT ON COLUMN users.remember_token IS 'Токен для функции "Запомнить меня"';

ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT users_email_format_check
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
ALTER TABLE users ADD CONSTRAINT users_password_not_empty_check
    CHECK (LENGTH(password_hash) > 0);

CREATE INDEX idx_users_company_id ON users (company_id);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_role_id ON users (role_id);
CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_is_active ON users (is_active);
CREATE INDEX idx_users_last_login ON users (last_login);
CREATE INDEX idx_users_refresh_token ON users (refresh_token)
    WHERE refresh_token IS NOT NULL;
CREATE INDEX idx_users_password_reset_token ON users (password_reset_token)
    WHERE password_reset_token IS NOT NULL;
CREATE INDEX idx_users_company_active ON users (company_id, is_active);
CREATE INDEX idx_users_name_trgm ON users USING gin (name gin_trgm_ops);
CREATE INDEX idx_users_email_verified_at ON users (email_verified_at);

-- ================================================================
-- ТАБЛИЦА: Payments - История платежей компаний
-- ================================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
    payment_system VARCHAR(50),
    payment_system_id VARCHAR(255),
    payment_method VARCHAR(50),
    tariff_id UUID,
    period_type VARCHAR(20) DEFAULT 'monthly'
        CHECK (period_type IN ('monthly', 'yearly', 'trial')),
    period_months INTEGER DEFAULT 1,
    paid_from TIMESTAMP WITH TIME ZONE,
    paid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    failure_reason TEXT,
    failure_code VARCHAR(50),
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(12,2),
    refund_reason TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_payments_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_payments_tariff_id
        FOREIGN KEY (tariff_id) REFERENCES tariffs(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE payments IS 'История платежей и подписок компаний';
COMMENT ON COLUMN payments.company_id IS 'Компания, совершившая платеж';
COMMENT ON COLUMN payments.amount IS 'Сумма платежа в минимальных единицах валюты (копейки для RUB)';
COMMENT ON COLUMN payments.currency IS 'Валюта платежа (ISO 4217)';
COMMENT ON COLUMN payments.status IS 'Статус платежа: pending - ожидает, processing - обрабатывается, succeeded - успешен, failed - неуспешен, cancelled - отменен, refunded - возвращен';
COMMENT ON COLUMN payments.payment_system IS 'Платежная система (YooKassa, Сбер, Tinkoff и т.д.)';
COMMENT ON COLUMN payments.payment_system_id IS 'ID платежа во внешней платежной системе';
COMMENT ON COLUMN payments.payment_method IS 'Способ оплаты (bank_card, yoo_money, sbp и т.д.)';
COMMENT ON COLUMN payments.tariff_id IS 'Тариф, за который производится оплата';
COMMENT ON COLUMN payments.period_type IS 'Тип периода оплаты';
COMMENT ON COLUMN payments.period_months IS 'Количество месяцев, за которые производится оплата';
COMMENT ON COLUMN payments.paid_from IS 'Дата начала оплаченного периода';
COMMENT ON COLUMN payments.paid_until IS 'Дата окончания оплаченного периода';
COMMENT ON COLUMN payments.description IS 'Описание платежа для пользователя';
COMMENT ON COLUMN payments.internal_notes IS 'Внутренние заметки для администраторов';
COMMENT ON COLUMN payments.metadata IS 'Дополнительные данные платежа в JSON формате';
COMMENT ON COLUMN payments.failure_reason IS 'Причина неуспешности платежа';
COMMENT ON COLUMN payments.failure_code IS 'Код ошибки от платежной системы';
COMMENT ON COLUMN payments.refunded_at IS 'Дата и время возврата средств';
COMMENT ON COLUMN payments.refund_amount IS 'Сумма возврата';
COMMENT ON COLUMN payments.refund_reason IS 'Причина возврата';
COMMENT ON COLUMN payments.processed_at IS 'Дата и время обработки платежа системой';

ALTER TABLE payments ADD CONSTRAINT payments_amount_positive_check
    CHECK (amount > 0);
ALTER TABLE payments ADD CONSTRAINT payments_period_positive_check
    CHECK (period_months > 0);
ALTER TABLE payments ADD CONSTRAINT payments_period_valid_check
    CHECK (paid_until > COALESCE(paid_from, created_at));
ALTER TABLE payments ADD CONSTRAINT payments_refund_amount_check
    CHECK (refund_amount IS NULL OR refund_amount <= amount);

CREATE INDEX idx_payments_company_id ON payments (company_id);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_payment_system_id ON payments (payment_system_id);
CREATE INDEX idx_payments_tariff_id ON payments (tariff_id);
CREATE INDEX idx_payments_paid_until ON payments (paid_until);
CREATE INDEX idx_payments_period_type ON payments (period_type);
CREATE INDEX idx_payments_processed_at ON payments (processed_at);
CREATE INDEX idx_payments_company_succeeded ON payments (company_id, status)
    WHERE status = 'succeeded';
CREATE INDEX idx_payments_active_subscriptions ON payments (company_id, paid_until)
    WHERE status = 'succeeded';

-- ================================================================
-- ТАБЛИЦА: Billing_Accounts - Счета биллинга
-- ================================================================
CREATE TABLE billing_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    account_number VARCHAR(50) UNIQUE,
    account_type VARCHAR(50) DEFAULT 'main',
    balance DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active',
    currency VARCHAR(3) DEFAULT 'RUB',
    credit_limit DECIMAL(12,2) DEFAULT 0.00,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_billing_accounts_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE billing_accounts IS 'Счета биллинга компаний';
COMMENT ON COLUMN billing_accounts.company_id IS 'Компания-владелец счета';
COMMENT ON COLUMN billing_accounts.account_number IS 'Номер счета';
COMMENT ON COLUMN billing_accounts.account_type IS 'Тип счета';
COMMENT ON COLUMN billing_accounts.balance IS 'Текущий баланс счета';
COMMENT ON COLUMN billing_accounts.status IS 'Статус счета';
COMMENT ON COLUMN billing_accounts.currency IS 'Валюта счета';
COMMENT ON COLUMN billing_accounts.credit_limit IS 'Кредитный лимит';
COMMENT ON COLUMN billing_accounts.settings IS 'Настройки счета';

CREATE INDEX idx_billing_accounts_company_id ON billing_accounts (company_id);
CREATE INDEX idx_billing_accounts_status ON billing_accounts (status);
CREATE INDEX idx_billing_accounts_balance ON billing_accounts (balance);
CREATE INDEX idx_billing_accounts_account_number ON billing_accounts (account_number);
CREATE INDEX idx_billing_accounts_account_type ON billing_accounts (account_type);

-- ================================================================
-- ТАБЛИЦА: Billing_Transactions - Транзакции биллинга
-- ================================================================
CREATE TABLE billing_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_account_id UUID NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    status VARCHAR(20) DEFAULT 'pending',
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_billing_transactions_billing_account_id
        FOREIGN KEY (billing_account_id) REFERENCES billing_accounts(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE billing_transactions IS 'Транзакции биллинга';
COMMENT ON COLUMN billing_transactions.billing_account_id IS 'Счет биллинга';
COMMENT ON COLUMN billing_transactions.transaction_type IS 'Тип транзакции';
COMMENT ON COLUMN billing_transactions.amount IS 'Сумма транзакции';
COMMENT ON COLUMN billing_transactions.currency IS 'Валюта транзакции';
COMMENT ON COLUMN billing_transactions.status IS 'Статус транзакции';
COMMENT ON COLUMN billing_transactions.transaction_date IS 'Дата транзакции';
COMMENT ON COLUMN billing_transactions.reference_type IS 'Тип связанной сущности';
COMMENT ON COLUMN billing_transactions.reference_id IS 'ID связанной сущности';
COMMENT ON COLUMN billing_transactions.description IS 'Описание транзакции';
COMMENT ON COLUMN billing_transactions.metadata IS 'Дополнительные данные';

CREATE INDEX idx_billing_transactions_billing_account_id ON billing_transactions (billing_account_id);
CREATE INDEX idx_billing_transactions_transaction_type ON billing_transactions (transaction_type);
CREATE INDEX idx_billing_transactions_status ON billing_transactions (status);
CREATE INDEX idx_billing_transactions_transaction_date ON billing_transactions (transaction_date DESC);
CREATE INDEX idx_billing_transactions_reference ON billing_transactions (reference_type, reference_id);

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для автоматического заполнения поля role
CREATE OR REPLACE FUNCTION update_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем текстовое поле role на основе role_id
    SELECT r.name INTO NEW.role
    FROM roles r
    WHERE r.id = NEW.role_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_role_trigger
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_role();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_accounts_updated_at
    BEFORE UPDATE ON billing_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_transactions_updated_at
    BEFORE UPDATE ON billing_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ
-- ================================================================

-- Функция для проверки лимитов тарифного плана
CREATE OR REPLACE FUNCTION check_company_limits(
    p_company_id UUID,
    p_resource_type VARCHAR,
    p_current_count INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_tariff_limits JSONB;
    v_resource_limit INTEGER;
    v_actual_count INTEGER;
    v_result JSONB;
BEGIN
    -- Получаем лимиты тарифа компании
    SELECT t.limits
    INTO v_tariff_limits
    FROM companies c
    JOIN tariffs t ON c.tariff_id = t.id
    WHERE c.id = p_company_id;

    -- Если лимитов нет, возвращаем успех
    IF v_tariff_limits IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'limit', null, 'current', null);
    END IF;

    -- Получаем лимит для конкретного ресурса
    v_resource_limit := (v_tariff_limits ->> p_resource_type)::INTEGER;

    -- Если лимита нет для данного ресурса, разрешаем
    IF v_resource_limit IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'limit', null, 'current', null);
    END IF;

    -- Используем переданное значение или считаем актуальное
    v_actual_count := COALESCE(p_current_count, 0);

    -- Возвращаем результат проверки
    RETURN jsonb_build_object(
        'allowed', v_actual_count < v_resource_limit,
        'limit', v_resource_limit,
        'current', v_actual_count,
        'remaining', v_resource_limit - v_actual_count
    );
END;
$$ LANGUAGE plpgsql;

-- Функция для создания первого пользователя компании с ролью "Владелец"
CREATE OR REPLACE FUNCTION create_company_owner(
    p_company_id UUID,
    p_name VARCHAR,
    p_email VARCHAR,
    p_password_hash VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_owner_role_id UUID;
    v_user_id UUID;
BEGIN
    -- Находим роль "Владелец"
    SELECT id INTO v_owner_role_id
    FROM roles
    WHERE code = 'owner' AND is_system = TRUE;

    -- Если роли "Владелец" нет, выбрасываем ошибку
    IF v_owner_role_id IS NULL THEN
        RAISE EXCEPTION 'Системная роль "Владелец" не найдена';
    END IF;

    -- Создаем пользователя
    INSERT INTO users (
        company_id,
        name,
        email,
        password_hash,
        role_id,
        email_verified_at,
        is_active
    ) VALUES (
        p_company_id,
        p_name,
        p_email,
        p_password_hash,
        v_owner_role_id,
        CURRENT_TIMESTAMP, -- Автоматически подтверждаем email владельца
        TRUE
    ) RETURNING id INTO v_user_id;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для проверки лимита пользователей
CREATE OR REPLACE FUNCTION check_users_limit(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    -- Считаем активных пользователей компании
    SELECT COUNT(*)
    INTO v_current_count
    FROM users
    WHERE company_id = p_company_id AND is_active = TRUE;

    -- Проверяем лимит через общую функцию
    RETURN check_company_limits(p_company_id, 'users', v_current_count);
END;
$$ LANGUAGE plpgsql;

-- Функция для безопасного удаления пользователя
CREATE OR REPLACE FUNCTION safe_delete_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_company_id UUID;
    v_role_name VARCHAR;
    v_users_count INTEGER;
BEGIN
    -- Получаем информацию о пользователе
    SELECT u.company_id, r.name
    INTO v_company_id, v_role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = p_user_id;

    -- Проверяем, что пользователь существует
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Пользователь не найден';
    END IF;

    -- Запрещаем удаление последнего владельца компании
    IF v_role_name = 'Владелец' THEN
        SELECT COUNT(*)
        INTO v_users_count
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.company_id = v_company_id
        AND r.name = 'Владелец'
        AND u.is_active = TRUE;

        IF v_users_count <= 1 THEN
            RAISE EXCEPTION 'Нельзя удалить последнего владельца компании';
        END IF;
    END IF;

    -- Помечаем пользователя как неактивного вместо удаления
    UPDATE users
    SET is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения активной подписки компании
CREATE OR REPLACE FUNCTION get_active_subscription(p_company_id UUID)
RETURNS TABLE (
    payment_id UUID,
    paid_until TIMESTAMP WITH TIME ZONE,
    tariff_id UUID,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.paid_until,
        p.tariff_id,
        p.status
    FROM payments p
    WHERE p.company_id = p_company_id
        AND p.status = 'succeeded'
        AND p.paid_until > CURRENT_TIMESTAMP
    ORDER BY p.paid_until DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Функция для проверки активности подписки
CREATE OR REPLACE FUNCTION is_subscription_active(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM payments
    WHERE company_id = p_company_id
        AND status = 'succeeded'
        AND paid_until > CURRENT_TIMESTAMP;

    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 002
-- ================================================================