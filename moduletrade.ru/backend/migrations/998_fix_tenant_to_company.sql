-- ========================================
-- МИГРАЦИЯ 998: ИСПРАВЛЕНИЕ TENANT → COMPANY
-- Приведение всех полей к единому стандарту
-- Версия: 2.0
-- ========================================

-- ========================================
-- ИСПРАВЛЕНИЕ VIEW И АЛИАСОВ
-- ========================================

-- Если есть представления, использующие старые названия, пересоздаем их
-- (В данном проекте представления создаются в миграции 006)

-- ========================================
-- ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ ПОЛЕЙ В COMPANIES
-- ========================================

-- Добавляем поля со старыми названиями как вычисляемые для обратной совместимости
-- Это временное решение для плавного перехода

DO $$
BEGIN
    -- Проверяем, существует ли колонка name в companies
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'name'
    ) THEN
        RAISE EXCEPTION 'Колонка name не найдена в таблице companies';
    END IF;

    -- Создаем функции для обратной совместимости
    CREATE OR REPLACE FUNCTION get_tenant_name(company_id INTEGER)
    RETURNS VARCHAR AS $func$
    BEGIN
        RETURN (SELECT name FROM companies WHERE id = company_id);
    END;
    $func$ LANGUAGE plpgsql STABLE;

    CREATE OR REPLACE FUNCTION get_tenant_plan(company_id INTEGER)
    RETURNS VARCHAR AS $func$
    BEGIN
        RETURN (SELECT plan FROM companies WHERE id = company_id);
    END;
    $func$ LANGUAGE plpgsql STABLE;

    CREATE OR REPLACE FUNCTION get_tenant_status(company_id INTEGER)
    RETURNS VARCHAR AS $func$
    BEGIN
        RETURN (SELECT subscription_status FROM companies WHERE id = company_id);
    END;
    $func$ LANGUAGE plpgsql STABLE;

END $$;

-- ========================================
-- СОЗДАНИЕ ВРЕМЕННЫХ ПРЕДСТАВЛЕНИЙ ДЛЯ СОВМЕСТИМОСТИ
-- ========================================

-- Представление для обратной совместимости кода, который еще использует tenant_*
CREATE OR REPLACE VIEW users_with_tenant_compat AS
SELECT
    u.*,
    c.name as tenant_name,
    c.plan as tenant_plan,
    c.subscription_status as tenant_status,
    c.is_active as tenant_is_active,
    c.settings as tenant_settings
FROM users u
JOIN companies c ON u.company_id = c.id;

COMMENT ON VIEW users_with_tenant_compat IS 'Представление для обратной совместимости со старым кодом, использующим tenant_* поля';

-- ========================================
-- ОБНОВЛЕНИЕ МЕТАДАННЫХ В JSONB ПОЛЯХ
-- ========================================

-- Обновляем metadata в companies, если есть ссылки на tenant
UPDATE companies
SET metadata =
    CASE
        WHEN metadata::text LIKE '%tenant%'
        THEN regexp_replace(metadata::text, '"tenant', '"company', 'g')::jsonb
        ELSE metadata
    END
WHERE metadata::text LIKE '%tenant%';

-- Обновляем settings в companies
UPDATE companies
SET settings =
    CASE
        WHEN settings::text LIKE '%tenant%'
        THEN regexp_replace(settings::text, '"tenant', '"company', 'g')::jsonb
        ELSE settings
    END
WHERE settings::text LIKE '%tenant%';

-- ========================================
-- СОЗДАНИЕ ИНДЕКСОВ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ========================================

-- Индексы для ускорения JOIN операций
CREATE INDEX IF NOT EXISTS idx_users_company_id_active
ON users(company_id, is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_companies_active_subscription
ON companies(is_active, subscription_status)
WHERE is_active = true;

-- ========================================
-- ПРОВЕРКА ЦЕЛОСТНОСТИ ДАННЫХ
-- ========================================

DO $$
DECLARE
    orphaned_users INTEGER;
    inactive_companies_with_active_users INTEGER;
    missing_role_ids INTEGER;
BEGIN
    -- Проверяем пользователей без компаний
    SELECT COUNT(*) INTO orphaned_users
    FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = u.company_id);

    IF orphaned_users > 0 THEN
        RAISE WARNING 'Найдено % пользователей без компаний', orphaned_users;
    END IF;

    -- Проверяем неактивные компании с активными пользователями
    SELECT COUNT(DISTINCT c.id) INTO inactive_companies_with_active_users
    FROM companies c
    JOIN users u ON u.company_id = c.id
    WHERE c.is_active = false AND u.is_active = true;

    IF inactive_companies_with_active_users > 0 THEN
        RAISE WARNING 'Найдено % неактивных компаний с активными пользователями', inactive_companies_with_active_users;
    END IF;

    -- Проверяем пользователей без role_id
    SELECT COUNT(*) INTO missing_role_ids
    FROM users
    WHERE role_id IS NULL;

    IF missing_role_ids > 0 THEN
        RAISE WARNING 'Найдено % пользователей без role_id', missing_role_ids;

        -- Пытаемся исправить
        UPDATE users u
        SET role_id = r.id
        FROM roles r
        WHERE u.role = r.name AND u.role_id IS NULL;
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'ПРОВЕРКА ДАННЫХ ЗАВЕРШЕНА';
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- ОБНОВЛЕНИЕ СИСТЕМНЫХ НАСТРОЕК
-- ========================================

-- Обновляем все настройки, где есть упоминание tenant
UPDATE company_settings
SET setting_key = REPLACE(setting_key, 'tenant_', 'company_')
WHERE setting_key LIKE 'tenant_%';

-- ========================================
-- СОЗДАНИЕ ВСПОМОГАТЕЛЬНЫХ ФУНКЦИЙ
-- ========================================

-- Функция для безопасного получения настроек компании
CREATE OR REPLACE FUNCTION get_company_setting(
    p_company_id INTEGER,
    p_setting_key VARCHAR,
    p_default_value TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT setting_value FROM company_settings
         WHERE company_id = p_company_id AND setting_key = p_setting_key),
        p_default_value
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================
-- ФИНАЛЬНАЯ СТАТИСТИКА
-- ========================================

DO $$
DECLARE
    companies_count INTEGER;
    users_count INTEGER;
    active_users_count INTEGER;
    settings_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO companies_count FROM companies WHERE is_active = true;
    SELECT COUNT(*) INTO users_count FROM users;
    SELECT COUNT(*) INTO active_users_count FROM users WHERE is_active = true;
    SELECT COUNT(*) INTO settings_count FROM company_settings;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'МИГРАЦИЯ TENANT → COMPANY ЗАВЕРШЕНА:';
    RAISE NOTICE '- Активные компании: %', companies_count;
    RAISE NOTICE '- Всего пользователей: %', users_count;
    RAISE NOTICE '- Активные пользователи: %', active_users_count;
    RAISE NOTICE '- Настройки компаний: %', settings_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ВАЖНО: Необходимо обновить код приложения!';
    RAISE NOTICE 'Замените в коде:';
    RAISE NOTICE '- tenantId → companyId';
    RAISE NOTICE '- tenant_id → company_id';
    RAISE NOTICE '- tenants → companies';
    RAISE NOTICE '- tenantName → companyName';
    RAISE NOTICE '========================================';
END $$;