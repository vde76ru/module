-- ================================================================
-- МИГРАЦИЯ 007: Аудит и разрешения
-- Описание: Создает таблицы для аудита, логирования и управления разрешениями
-- Дата: 2025-01-27
-- Блок: Безопасность и Аудит
-- Зависимости: 002 (companies, users)
-- ================================================================

-- ================================================================
-- ТАБЛИЦА: Audit_Action_Types - Типы действий для аудита
-- ================================================================
CREATE TABLE audit_action_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50),
    severity VARCHAR(20) DEFAULT 'info',
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE audit_action_types IS 'Типы действий для аудита';
COMMENT ON COLUMN audit_action_types.name IS 'Название типа действия';
COMMENT ON COLUMN audit_action_types.code IS 'Код типа действия';
COMMENT ON COLUMN audit_action_types.description IS 'Описание типа действия';
COMMENT ON COLUMN audit_action_types.category IS 'Категория действия';
COMMENT ON COLUMN audit_action_types.severity IS 'Важность: info, warning, error, critical';
COMMENT ON COLUMN audit_action_types.is_system IS 'Системный тип действия';
COMMENT ON COLUMN audit_action_types.is_active IS 'Активен ли тип действия';

CREATE INDEX idx_audit_action_types_code ON audit_action_types (code);
CREATE INDEX idx_audit_action_types_category ON audit_action_types (category);
CREATE INDEX idx_audit_action_types_severity ON audit_action_types (severity);
CREATE INDEX idx_audit_action_types_is_active ON audit_action_types (is_active);
ALTER TABLE audit_action_types
    ADD CONSTRAINT ck_audit_action_types_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_action_types_public_id ON audit_action_types (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_audit_action_types_public_id
    BEFORE INSERT ON audit_action_types
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Audit_Logs - Журнал аудита
-- ================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID,
    user_id UUID,
    action_type_id UUID NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    success BOOLEAN DEFAULT TRUE,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    description TEXT,
    entity_name VARCHAR(255),
    request_method VARCHAR(10),
    request_url TEXT,
    request_params JSONB,
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_audit_logs_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_audit_logs_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_audit_logs_action_type_id
        FOREIGN KEY (action_type_id) REFERENCES audit_action_types(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

COMMENT ON TABLE audit_logs IS 'Журнал аудита действий пользователей';
COMMENT ON COLUMN audit_logs.company_id IS 'Компания';
COMMENT ON COLUMN audit_logs.user_id IS 'Пользователь, выполнивший действие';
COMMENT ON COLUMN audit_logs.action_type_id IS 'Тип действия';
COMMENT ON COLUMN audit_logs.entity_type IS 'Тип сущности';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID сущности';
COMMENT ON COLUMN audit_logs.old_values IS 'Старые значения';
COMMENT ON COLUMN audit_logs.new_values IS 'Новые значения';
COMMENT ON COLUMN audit_logs.success IS 'Успешность операции';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP адрес пользователя';
COMMENT ON COLUMN audit_logs.user_agent IS 'User Agent браузера';
COMMENT ON COLUMN audit_logs.session_id IS 'ID сессии';
COMMENT ON COLUMN audit_logs.description IS 'Описание действия';
COMMENT ON COLUMN audit_logs.entity_name IS 'Название сущности';
COMMENT ON COLUMN audit_logs.request_method IS 'HTTP метод запроса';
COMMENT ON COLUMN audit_logs.request_url IS 'URL запроса';
COMMENT ON COLUMN audit_logs.request_params IS 'Параметры запроса';
COMMENT ON COLUMN audit_logs.tags IS 'Теги для фильтрации';
COMMENT ON COLUMN audit_logs.metadata IS 'Дополнительные данные';

CREATE INDEX idx_audit_logs_company_id ON audit_logs (company_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_action_type_id ON audit_logs (action_type_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_success ON audit_logs (success);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs (ip_address);
CREATE INDEX idx_audit_logs_session_id ON audit_logs (session_id);
ALTER TABLE audit_logs
    ADD CONSTRAINT ck_audit_logs_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_logs_company_public_id ON audit_logs (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_audit_logs_public_id
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: Audit_Sessions - Сессии пользователей для аудита
-- ================================================================
CREATE TABLE audit_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID,
    user_id UUID NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_audit_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_audit_sessions_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE audit_sessions IS 'Сессии пользователей для аудита';
COMMENT ON COLUMN audit_sessions.user_id IS 'Пользователь';
COMMENT ON COLUMN audit_sessions.session_id IS 'ID сессии';
COMMENT ON COLUMN audit_sessions.ip_address IS 'IP адрес';
COMMENT ON COLUMN audit_sessions.user_agent IS 'User Agent браузера';
COMMENT ON COLUMN audit_sessions.login_time IS 'Время входа';
COMMENT ON COLUMN audit_sessions.logout_time IS 'Время выхода';
COMMENT ON COLUMN audit_sessions.is_active IS 'Активна ли сессия';
COMMENT ON COLUMN audit_sessions.metadata IS 'Дополнительные данные';

CREATE INDEX idx_audit_sessions_user_id ON audit_sessions (user_id);
CREATE INDEX idx_audit_sessions_company_id ON audit_sessions (company_id);
CREATE INDEX idx_audit_sessions_session_id ON audit_sessions (session_id);
CREATE INDEX idx_audit_sessions_is_active ON audit_sessions (is_active);
ALTER TABLE audit_sessions
    ADD CONSTRAINT ck_audit_sessions_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_sessions_public_id ON audit_sessions (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_audit_sessions_public_id
    BEFORE INSERT ON audit_sessions
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();
CREATE INDEX idx_audit_sessions_login_time ON audit_sessions (login_time);

-- ================================================================
-- ТАБЛИЦА: System_Logs - Системные логи
-- ================================================================
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    category VARCHAR(50),
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    stack_trace TEXT,
    ip_address INET,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_system_logs_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_system_logs_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE system_logs IS 'Системные логи приложения';
COMMENT ON COLUMN system_logs.company_id IS 'Компания (NULL для системных логов)';
COMMENT ON COLUMN system_logs.level IS 'Уровень лога: debug, info, warning, error, critical';
COMMENT ON COLUMN system_logs.category IS 'Категория лога';
COMMENT ON COLUMN system_logs.message IS 'Сообщение лога';
COMMENT ON COLUMN system_logs.context IS 'Контекст лога';
COMMENT ON COLUMN system_logs.stack_trace IS 'Стек вызовов для ошибок';
COMMENT ON COLUMN system_logs.ip_address IS 'IP адрес';
COMMENT ON COLUMN system_logs.user_id IS 'Пользователь';

CREATE INDEX idx_system_logs_company_id ON system_logs (company_id);
CREATE INDEX idx_system_logs_level ON system_logs (level);
CREATE INDEX idx_system_logs_category ON system_logs (category);
CREATE INDEX idx_system_logs_created_at ON system_logs (created_at DESC);
CREATE INDEX idx_system_logs_user_id ON system_logs (user_id);
CREATE INDEX idx_system_logs_ip_address ON system_logs (ip_address);
ALTER TABLE system_logs
    ADD CONSTRAINT ck_system_logs_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_logs_company_public_id
  ON system_logs (company_id, public_id)
  WHERE public_id IS NOT NULL AND company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_logs_public_id_global
  ON system_logs (public_id)
  WHERE public_id IS NOT NULL AND company_id IS NULL;

CREATE TRIGGER assign_system_logs_public_id
    BEFORE INSERT ON system_logs
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: User_Permissions - Разрешения пользователей
-- ================================================================
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    user_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    action VARCHAR(50) NOT NULL,
    is_granted BOOLEAN DEFAULT TRUE,
    conditions JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_user_permissions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_user_permissions_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE user_permissions IS 'Разрешения пользователей';
COMMENT ON COLUMN user_permissions.user_id IS 'Пользователь';
COMMENT ON COLUMN user_permissions.resource_type IS 'Тип ресурса';
COMMENT ON COLUMN user_permissions.resource_id IS 'ID ресурса (NULL для всех ресурсов типа)';
COMMENT ON COLUMN user_permissions.action IS 'Действие: read, write, delete, admin';
COMMENT ON COLUMN user_permissions.is_granted IS 'Предоставлено ли разрешение';
COMMENT ON COLUMN user_permissions.conditions IS 'Условия применения разрешения';
COMMENT ON COLUMN user_permissions.expires_at IS 'Дата истечения разрешения';
COMMENT ON COLUMN user_permissions.created_by IS 'Пользователь, создавший разрешение';

CREATE INDEX idx_user_permissions_user_id ON user_permissions (user_id);
CREATE INDEX idx_user_permissions_resource ON user_permissions (resource_type, resource_id);
CREATE INDEX idx_user_permissions_action ON user_permissions (action);
CREATE INDEX idx_user_permissions_is_granted ON user_permissions (is_granted);
CREATE INDEX idx_user_permissions_expires_at ON user_permissions (expires_at);
CREATE INDEX idx_user_permissions_created_by ON user_permissions (created_by);
ALTER TABLE user_permissions
    ADD CONSTRAINT ck_user_permissions_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_permissions_public_id ON user_permissions (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_user_permissions_public_id
    BEFORE INSERT ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: User_Sessions - Сессии пользователей
-- ================================================================
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    user_id UUID NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_user_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE user_sessions IS 'Сессии пользователей';
COMMENT ON COLUMN user_sessions.user_id IS 'Пользователь';
COMMENT ON COLUMN user_sessions.session_token IS 'Токен сессии';
COMMENT ON COLUMN user_sessions.refresh_token IS 'Токен обновления';
COMMENT ON COLUMN user_sessions.ip_address IS 'IP адрес';
COMMENT ON COLUMN user_sessions.user_agent IS 'User Agent браузера';
COMMENT ON COLUMN user_sessions.login_time IS 'Время входа';
COMMENT ON COLUMN user_sessions.last_activity IS 'Время последней активности';
COMMENT ON COLUMN user_sessions.expires_at IS 'Время истечения сессии';
COMMENT ON COLUMN user_sessions.is_active IS 'Активна ли сессия';
COMMENT ON COLUMN user_sessions.metadata IS 'Дополнительные данные';

CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions (session_token);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions (refresh_token);
CREATE INDEX idx_user_sessions_is_active ON user_sessions (is_active);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions (last_activity);
ALTER TABLE user_sessions
    ADD CONSTRAINT ck_user_sessions_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_sessions_public_id ON user_sessions (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_user_sessions_public_id
    BEFORE INSERT ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Failed_Login_Attempts - Неудачные попытки входа
-- ================================================================
CREATE TABLE failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempt_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE failed_login_attempts IS 'Неудачные попытки входа';
COMMENT ON COLUMN failed_login_attempts.email IS 'Email пользователя';
COMMENT ON COLUMN failed_login_attempts.ip_address IS 'IP адрес';
COMMENT ON COLUMN failed_login_attempts.user_agent IS 'User Agent браузера';
COMMENT ON COLUMN failed_login_attempts.attempt_time IS 'Время попытки';
COMMENT ON COLUMN failed_login_attempts.reason IS 'Причина неудачи';
COMMENT ON COLUMN failed_login_attempts.metadata IS 'Дополнительные данные';

CREATE INDEX idx_failed_login_attempts_email ON failed_login_attempts (email);
CREATE INDEX idx_failed_login_attempts_ip_address ON failed_login_attempts (ip_address);
CREATE INDEX idx_failed_login_attempts_attempt_time ON failed_login_attempts (attempt_time DESC);
CREATE INDEX idx_failed_login_attempts_email_time ON failed_login_attempts (email, attempt_time);
ALTER TABLE failed_login_attempts
    ADD CONSTRAINT ck_failed_login_attempts_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_failed_login_attempts_public_id ON failed_login_attempts (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_failed_login_attempts_public_id
    BEFORE INSERT ON failed_login_attempts
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: Password_Reset_Tokens - Токены сброса пароля
-- ================================================================
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    user_id UUID NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_password_reset_tokens_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE password_reset_tokens IS 'Токены для сброса пароля';
COMMENT ON COLUMN password_reset_tokens.user_id IS 'Пользователь';
COMMENT ON COLUMN password_reset_tokens.token IS 'Токен сброса';
COMMENT ON COLUMN password_reset_tokens.ip_address IS 'IP адрес';
COMMENT ON COLUMN password_reset_tokens.user_agent IS 'User Agent браузера';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Время истечения токена';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Время использования токена';
COMMENT ON COLUMN password_reset_tokens.is_active IS 'Активен ли токен';

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens (token);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);
CREATE INDEX idx_password_reset_tokens_is_active ON password_reset_tokens (is_active);
ALTER TABLE password_reset_tokens
    ADD CONSTRAINT ck_password_reset_tokens_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_password_reset_tokens_public_id ON password_reset_tokens (public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_password_reset_tokens_public_id
    BEFORE INSERT ON password_reset_tokens
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_global();

-- ================================================================
-- ТАБЛИЦА: API_Keys - API ключи
-- ================================================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID NOT NULL,
    user_id UUID,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used TIMESTAMP WITH TIME ZONE,
    last_ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_api_keys_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_api_keys_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE api_keys IS 'API ключи для доступа к системе';
COMMENT ON COLUMN api_keys.company_id IS 'Компания';
COMMENT ON COLUMN api_keys.user_id IS 'Пользователь (NULL для системных ключей)';
COMMENT ON COLUMN api_keys.name IS 'Название ключа';
COMMENT ON COLUMN api_keys.key_hash IS 'Хеш API ключа';
COMMENT ON COLUMN api_keys.permissions IS 'Разрешения ключа';
COMMENT ON COLUMN api_keys.is_active IS 'Активен ли ключ';
COMMENT ON COLUMN api_keys.expires_at IS 'Время истечения ключа';
COMMENT ON COLUMN api_keys.last_used IS 'Время последнего использования';
COMMENT ON COLUMN api_keys.last_ip_address IS 'IP адрес последнего использования';

CREATE INDEX idx_api_keys_company_id ON api_keys (company_id);
CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys (is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys (expires_at);
CREATE INDEX idx_api_keys_last_used ON api_keys (last_used);
ALTER TABLE api_keys
    ADD CONSTRAINT ck_api_keys_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_company_public_id ON api_keys (company_id, public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER assign_api_keys_public_id
    BEFORE INSERT ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТАБЛИЦА: API_Requests - Логи запросов к API
-- ================================================================
CREATE TABLE api_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id INTEGER,
    company_id UUID,
    user_id UUID,
    api_key_id UUID,
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    status_code INTEGER,
    response_time INTEGER,
    ip_address INET,
    user_agent TEXT,
    request_body JSONB,
    response_body JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_api_requests_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_api_requests_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_api_requests_api_key_id
        FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE api_requests IS 'Логи запросов к API';
COMMENT ON COLUMN api_requests.company_id IS 'Компания';
COMMENT ON COLUMN api_requests.user_id IS 'Пользователь';
COMMENT ON COLUMN api_requests.api_key_id IS 'API ключ';
COMMENT ON COLUMN api_requests.method IS 'HTTP метод';
COMMENT ON COLUMN api_requests.endpoint IS 'Endpoint API';
COMMENT ON COLUMN api_requests.status_code IS 'HTTP статус код';
COMMENT ON COLUMN api_requests.response_time IS 'Время ответа в миллисекундах';
COMMENT ON COLUMN api_requests.ip_address IS 'IP адрес';
COMMENT ON COLUMN api_requests.user_agent IS 'User Agent';
COMMENT ON COLUMN api_requests.request_body IS 'Тело запроса';
COMMENT ON COLUMN api_requests.response_body IS 'Тело ответа';
COMMENT ON COLUMN api_requests.error_message IS 'Сообщение об ошибке';

CREATE INDEX idx_api_requests_company_id ON api_requests (company_id);
CREATE INDEX idx_api_requests_user_id ON api_requests (user_id);
CREATE INDEX idx_api_requests_api_key_id ON api_requests (api_key_id);
CREATE INDEX idx_api_requests_method ON api_requests (method);
CREATE INDEX idx_api_requests_endpoint ON api_requests (endpoint);
CREATE INDEX idx_api_requests_status_code ON api_requests (status_code);
CREATE INDEX idx_api_requests_created_at ON api_requests (created_at DESC);
CREATE INDEX idx_api_requests_ip_address ON api_requests (ip_address);
ALTER TABLE api_requests
    ADD CONSTRAINT ck_api_requests_public_id CHECK (public_id IS NULL OR public_id >= 100000);
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_requests_company_public_id
  ON api_requests (company_id, public_id)
  WHERE public_id IS NOT NULL AND company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_requests_public_id_global
  ON api_requests (public_id)
  WHERE public_id IS NOT NULL AND company_id IS NULL;

CREATE TRIGGER assign_api_requests_public_id
    BEFORE INSERT ON api_requests
    FOR EACH ROW
    EXECUTE FUNCTION assign_public_id_with_company();

-- ================================================================
-- ТРИГГЕРЫ
-- ================================================================
CREATE TRIGGER update_audit_action_types_updated_at
    BEFORE UPDATE ON audit_action_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_sessions_updated_at
    BEFORE UPDATE ON audit_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at
    BEFORE UPDATE ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С АУДИТОМ И БЕЗОПАСНОСТЬЮ
-- ================================================================

-- Функция для записи аудита
CREATE OR REPLACE FUNCTION log_audit_event(
    p_company_id UUID,
    p_user_id UUID,
    p_action_code VARCHAR,
    p_entity_type VARCHAR DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE,
    p_description TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_action_type_id UUID;
    v_audit_id UUID;
BEGIN
    -- Получаем ID типа действия
    SELECT id INTO v_action_type_id
    FROM audit_action_types
    WHERE code = p_action_code AND is_active = true;

    -- Если тип действия не найден, создаем его
    IF v_action_type_id IS NULL THEN
        INSERT INTO audit_action_types (name, code, description, is_system)
        VALUES (p_action_code, p_action_code, 'Автоматически созданный тип действия', false)
        RETURNING id INTO v_action_type_id;
    END IF;

    -- Записываем аудит
    INSERT INTO audit_logs (
        company_id,
        user_id,
        action_type_id,
        entity_type,
        entity_id,
        old_values,
        new_values,
        success,
        ip_address,
        user_agent,
        session_id,
        description,
        metadata
    ) VALUES (
        p_company_id,
        p_user_id,
        v_action_type_id,
        p_entity_type,
        p_entity_id,
        p_old_values,
        p_new_values,
        p_success,
        p_ip_address,
        p_user_agent,
        p_session_id,
        p_description,
        COALESCE(p_metadata, '{}'::jsonb)
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для проверки разрешений пользователя
-- ИСПРАВЛЕНА: Параметры без значений по умолчанию идут первыми
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_resource_type VARCHAR,
    p_action VARCHAR,
    p_resource_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN := false;
    v_user_role VARCHAR;
BEGIN
    -- Получаем роль пользователя
    SELECT r.name INTO v_user_role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = p_user_id;

    -- Проверяем системные роли
    IF v_user_role = 'Владелец' THEN
        RETURN true;
    END IF;

    -- Проверяем конкретные разрешения
    SELECT EXISTS (
        SELECT 1
        FROM user_permissions
        WHERE user_id = p_user_id
            AND resource_type = p_resource_type
            AND (resource_id = p_resource_id OR resource_id IS NULL)
            AND action = p_action
            AND is_granted = true
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql;

-- Функция для создания API ключа
CREATE OR REPLACE FUNCTION create_api_key(
    p_company_id UUID,
    p_name VARCHAR,
    p_permissions JSONB DEFAULT '{}'::jsonb,
    p_user_id UUID DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS TABLE (key_id UUID, api_key VARCHAR) AS $$
DECLARE
    v_key_id UUID;
    v_api_key VARCHAR;
    v_key_hash VARCHAR;
BEGIN
    -- Генерируем API ключ
    v_api_key := 'sk_' || encode(gen_random_bytes(32), 'base64');
    v_key_hash := crypt(v_api_key, gen_salt('bf'));

    -- Создаем запись
    INSERT INTO api_keys (
        company_id,
        user_id,
        name,
        key_hash,
        permissions,
        expires_at
    ) VALUES (
        p_company_id,
        p_user_id,
        p_name,
        v_key_hash,
        p_permissions,
        p_expires_at
    ) RETURNING id INTO v_key_id;

    RETURN QUERY SELECT v_key_id, v_api_key;
END;
$$ LANGUAGE plpgsql;

-- Функция для валидации API ключа
CREATE OR REPLACE FUNCTION validate_api_key(p_api_key VARCHAR)
RETURNS TABLE (
    key_id UUID,
    company_id UUID,
    user_id UUID,
    permissions JSONB,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ak.id,
        ak.company_id,
        ak.user_id,
        ak.permissions,
        ak.is_active
    FROM api_keys ak
    WHERE ak.key_hash = crypt(p_api_key, ak.key_hash)
        AND ak.is_active = true
        AND (ak.expires_at IS NULL OR ak.expires_at > CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Функция для очистки старых логов
CREATE OR REPLACE FUNCTION cleanup_old_logs(p_days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER := 0;
BEGIN
    -- Удаляем старые системные логи
    DELETE FROM system_logs
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * p_days_to_keep;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- Удаляем старые API запросы
    DELETE FROM api_requests
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * p_days_to_keep;

    -- Удаляем неактивные сессии
    DELETE FROM user_sessions
    WHERE expires_at < CURRENT_TIMESTAMP;

    -- Удаляем истекшие токены сброса пароля
    DELETE FROM password_reset_tokens
    WHERE expires_at < CURRENT_TIMESTAMP;

    -- Удаляем старые неудачные попытки входа
    DELETE FROM failed_login_attempts
    WHERE attempt_time < CURRENT_TIMESTAMP - INTERVAL '1 day' * 30;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Функция для блокировки пользователя после неудачных попыток
CREATE OR REPLACE FUNCTION check_failed_login_attempts(p_email VARCHAR, p_max_attempts INTEGER DEFAULT 5)
RETURNS BOOLEAN AS $$
DECLARE
    v_attempt_count INTEGER;
BEGIN
    -- Считаем неудачные попытки за последний час
    SELECT COUNT(*)
    INTO v_attempt_count
    FROM failed_login_attempts
    WHERE email = p_email
        AND attempt_time > CURRENT_TIMESTAMP - INTERVAL '1 hour';

    -- Если превышен лимит, блокируем
    IF v_attempt_count >= p_max_attempts THEN
        -- Блокируем пользователя
        UPDATE users
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = p_email;

        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ФУНКЦИИ ДЛЯ АУДИТА
-- ================================================================

-- Функция для получения статистики аудита
CREATE OR REPLACE FUNCTION get_audit_stats(
    p_company_id UUID DEFAULT NULL,
    p_date_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_date_to TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS TABLE (
    total_actions BIGINT,
    users_count BIGINT,
    tables_count BIGINT,
    actions_by_type JSONB,
    actions_by_user JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH audit_data AS (
        SELECT
            al.user_id,
            u.name as user_name,
            aat.code as action_code,
            al.entity_type
        FROM audit_logs al
        JOIN audit_action_types aat ON al.action_type_id = aat.id
        LEFT JOIN users u ON al.user_id = u.id
        WHERE (p_company_id IS NULL OR al.company_id = p_company_id)
          AND (p_date_from IS NULL OR al.created_at >= p_date_from)
          AND (p_date_to IS NULL OR al.created_at <= p_date_to)
    ),
    stats AS (
        SELECT
            (SELECT COUNT(*) FROM audit_data) as total_actions,
            (SELECT COUNT(DISTINCT user_id) FROM audit_data) as users_count,
            (SELECT COUNT(DISTINCT entity_type) FROM audit_data) as tables_count,
            (
                SELECT jsonb_object_agg(action_code, action_count)
                FROM (
                    SELECT action_code, COUNT(*) as action_count
                    FROM audit_data
                    GROUP BY action_code
                ) as actions
            ) as actions_by_type,
            (
                SELECT jsonb_object_agg(COALESCE(user_name, 'system'), user_action_count)
                FROM (
                    SELECT user_name, COUNT(*) as user_action_count
                    FROM audit_data
                    GROUP BY user_name
                ) as user_actions
            ) as actions_by_user
    )
    SELECT
        COALESCE(s.total_actions, 0),
        COALESCE(s.users_count, 0),
        COALESCE(s.tables_count, 0),
        COALESCE(s.actions_by_type, '{}'::jsonb),
        COALESCE(s.actions_by_user, '{}'::jsonb)
    FROM stats s;
END;
$$ LANGUAGE plpgsql;

-- Функция для очистки старых логов аудита
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
    p_days_to_keep INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * p_days_to_keep;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ПРЕДСТАВЛЕНИЯ ДЛЯ СКЛАДОВ
-- ================================================================

-- Представление для агрегации остатков по всем складам
-- УДАЛЕНО: Дублирующееся определение v_product_total_stock (уже определено в миграции 005)

-- УДАЛЕНО: Дублирующееся определение функции recalculate_multi_warehouse_stock (уже определена в миграции 005)

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 007
-- ================================================================