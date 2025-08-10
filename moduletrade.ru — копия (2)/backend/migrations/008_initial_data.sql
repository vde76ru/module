-- ================================================================
-- МИГРАЦИЯ 008: Начальные данные (ИСПРАВЛЕНА)
-- Описание: Заполняет базу данных начальными данными для работы системы
-- Дата: 2025-01-27
-- Блок: Начальные Данные
-- Зависимости: 001-007 (все предыдущие миграции)
-- ================================================================

-- ================================================================
-- ИСПРАВЛЕНИЕ ФУНКЦИИ get_next_public_id ДЛЯ ГЛОБАЛЬНЫХ ТАБЛИЦ
-- Причина: уникальный индекс (table_name, company_id) допускает несколько NULL,
-- что приводило к созданию нескольких счетчиков и ошибке
-- "query returned more than one row" при UPDATE ... RETURNING.
-- Решение: нормализуем NULL company_id к фиксированному UUID.
-- ================================================================
CREATE OR REPLACE FUNCTION get_next_public_id(
  p_table_name TEXT,
  p_company_id UUID DEFAULT NULL,
  p_min_start INTEGER DEFAULT 100000
) RETURNS INTEGER AS $$
DECLARE
  v_next INTEGER;
  v_company_id UUID;
BEGIN
  IF p_min_start IS NULL OR p_min_start < 1 THEN
    p_min_start := 100000;
  END IF;

  -- Нормализуем NULL к фиксированному UUID для глобальных таблиц
  v_company_id := COALESCE(p_company_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Гарантируем существование строки счетчика
  INSERT INTO public_id_counters (table_name, company_id, last_value)
  VALUES (p_table_name, v_company_id, p_min_start - 1)
  ON CONFLICT (table_name, company_id) DO NOTHING;

  -- Атомарно увеличиваем и возвращаем значение
  UPDATE public_id_counters
  SET last_value = public_id_counters.last_value + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE table_name = p_table_name AND company_id = v_company_id
  RETURNING last_value INTO v_next;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ ДЛЯ ТИПОВ ДЕЙСТВИЙ АУДИТА
-- ================================================================
INSERT INTO audit_action_types (id, name, code, description, category, severity, is_system, is_active) VALUES
-- Аутентификация
('00000000-0000-0000-0000-000000000001', 'Вход в систему', 'user.login', 'Пользователь вошел в систему', 'auth', 'info', true, true),
('00000000-0000-0000-0000-000000000002', 'Выход из системы', 'user.logout', 'Пользователь вышел из системы', 'auth', 'info', true, true),
('00000000-0000-0000-0000-000000000003', 'Неудачная попытка входа', 'user.login_failed', 'Неудачная попытка входа в систему', 'auth', 'warning', true, true),
('00000000-0000-0000-0000-000000000004', 'Сброс пароля', 'user.password_reset', 'Пользователь сбросил пароль', 'auth', 'info', true, true),
('00000000-0000-0000-0000-000000000005', 'Изменение пароля', 'user.password_change', 'Пользователь изменил пароль', 'auth', 'info', true, true),
-- Управление пользователями
('00000000-0000-0000-0000-000000000006', 'Создание пользователя', 'user.create', 'Создан новый пользователь', 'users', 'info', true, true),
('00000000-0000-0000-0000-000000000007', 'Обновление пользователя', 'user.update', 'Обновлены данные пользователя', 'users', 'info', true, true),
('00000000-0000-0000-0000-000000000008', 'Деактивация пользователя', 'user.deactivate', 'Пользователь деактивирован', 'users', 'warning', true, true),
('00000000-0000-0000-0000-000000000009', 'Активация пользователя', 'user.activate', 'Пользователь активирован', 'users', 'info', true, true),
-- Управление товарами
('00000000-0000-0000-0000-000000000010', 'Создание товара', 'product.create', 'Создан новый товар', 'products', 'info', true, true),
('00000000-0000-0000-0000-000000000011', 'Обновление товара', 'product.update', 'Обновлены данные товара', 'products', 'info', true, true),
('00000000-0000-0000-0000-000000000012', 'Удаление товара', 'product.delete', 'Товар удален', 'products', 'warning', true, true),
('00000000-0000-0000-0000-000000000013', 'Изменение цены товара', 'product.price_change', 'Изменена цена товара', 'products', 'info', true, true),
-- Управление заказами
('00000000-0000-0000-0000-000000000014', 'Создание заказа', 'order.create', 'Создан новый заказ', 'orders', 'info', true, true),
('00000000-0000-0000-0000-000000000015', 'Обновление заказа', 'order.update', 'Обновлены данные заказа', 'orders', 'info', true, true),
('00000000-0000-0000-0000-000000000016', 'Изменение статуса заказа', 'order.status_change', 'Изменен статус заказа', 'orders', 'info', true, true),
('00000000-0000-0000-0000-000000000017', 'Отмена заказа', 'order.cancel', 'Заказ отменен', 'orders', 'warning', true, true),
-- Управление складами
('00000000-0000-0000-0000-000000000018', 'Создание склада', 'warehouse.create', 'Создан новый склад', 'warehouses', 'info', true, true),
('00000000-0000-0000-0000-000000000019', 'Обновление склада', 'warehouse.update', 'Обновлены данные склада', 'warehouses', 'info', true, true),
('00000000-0000-0000-0000-000000000020', 'Движение товара', 'warehouse.movement', 'Движение товара на складе', 'warehouses', 'info', true, true),
('00000000-0000-0000-0000-000000000021', 'Резервирование товара', 'warehouse.reserve', 'Товар зарезервирован', 'warehouses', 'info', true, true),
-- Интеграции
('00000000-0000-0000-0000-000000000022', 'Синхронизация с поставщиком', 'integration.supplier_sync', 'Синхронизация с поставщиком', 'integrations', 'info', true, true),
('00000000-0000-0000-0000-000000000023', 'Синхронизация с маркетплейсом', 'integration.marketplace_sync', 'Синхронизация с маркетплейсом', 'integrations', 'info', true, true),
('00000000-0000-0000-0000-000000000024', 'Ошибка интеграции', 'integration.error', 'Ошибка в интеграции', 'integrations', 'error', true, true)
ON CONFLICT (code) DO NOTHING;

-- ================================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ ДЛЯ ТИПОВ ЦЕН
-- ================================================================
INSERT INTO price_types (id, name, code, display_name, description, category, is_system, is_active) VALUES
('00000000-0000-0000-0000-000000000050', 'base', 'base', 'Базовая цена', 'Базовая цена товара', 'pricing', true, true),
('00000000-0000-0000-0000-000000000051', 'retail', 'retail', 'Розничная цена', 'Розничная цена товара', 'pricing', true, true),
('00000000-0000-0000-0000-000000000052', 'wholesale', 'wholesale', 'Оптовая цена', 'Оптовая цена товара', 'pricing', true, true),
('00000000-0000-0000-0000-000000000053', 'purchase', 'purchase', 'Закупочная цена', 'Цена закупки у поставщика', 'pricing', true, true),
('00000000-0000-0000-0000-000000000054', 'sale', 'sale', 'Цена со скидкой', 'Цена товара со скидкой', 'pricing', true, true),
('00000000-0000-0000-0000-000000000055', 'ozon', 'ozon', 'Цена для Ozon', 'Цена товара для маркетплейса Ozon', 'marketplace', true, true),
('00000000-0000-0000-0000-000000000056', 'wildberries', 'wildberries', 'Цена для Wildberries', 'Цена товара для маркетплейса Wildberries', 'marketplace', true, true),
('00000000-0000-0000-0000-000000000057', 'yandex_market', 'yandex_market', 'Цена для Яндекс.Маркет', 'Цена товара для маркетплейса Яндекс.Маркет', 'marketplace', true, true),
('00000000-0000-0000-0000-000000000058', 'personal', 'personal', 'Персональная цена (без НДС)', 'Персональная цена клиента без НДС', 'supplier', true, true),
('00000000-0000-0000-0000-000000000059', 'personal_vat', 'personal_vat', 'Персональная цена (с НДС)', 'Персональная цена клиента с НДС', 'supplier', true, true),
('00000000-0000-0000-0000-000000000060', 'retail_vat', 'retail_vat', 'Розничная цена (с НДС)', 'Розничная цена с НДС', 'pricing', true, true),
('00000000-0000-0000-0000-000000000061', 'mrc', 'mrc', 'МРЦ (без НДС)', 'Минимальная розничная цена без НДС', 'pricing', true, true),
('00000000-0000-0000-0000-000000000062', 'mrc_vat', 'mrc_vat', 'МРЦ (с НДС)', 'Минимальная розничная цена с НДС', 'pricing', true, true)
ON CONFLICT (code) DO NOTHING;

-- ================================================================
-- СИСТЕМНЫЕ НАСТРОЙКИ
-- ================================================================
INSERT INTO system_settings (company_id, setting_key, setting_value, setting_type, description, is_public, is_encrypted) VALUES
-- Глобальные настройки (company_id = NULL)
(NULL, 'system.name', 'ModuleTrade', 'string', 'Название системы', true, false),
(NULL, 'system.version', '1.0.0', 'string', 'Версия системы', true, false),
(NULL, 'system.maintenance_mode', 'false', 'boolean', 'Режим обслуживания', true, false),
(NULL, 'system.default_language', 'ru', 'string', 'Язык по умолчанию', true, false),
(NULL, 'system.default_timezone', 'Europe/Moscow', 'string', 'Часовой пояс по умолчанию', true, false),
(NULL, 'system.default_currency', 'RUB', 'string', 'Валюта по умолчанию', true, false),
-- Настройки безопасности
(NULL, 'security.password_min_length', '8', 'integer', 'Минимальная длина пароля', true, false),
(NULL, 'security.password_require_uppercase', 'true', 'boolean', 'Требовать заглавные буквы в пароле', true, false),
(NULL, 'security.password_require_numbers', 'true', 'boolean', 'Требовать цифры в пароле', true, false),
(NULL, 'security.password_require_special', 'false', 'boolean', 'Требовать специальные символы в пароле', true, false),
(NULL, 'security.max_login_attempts', '5', 'integer', 'Максимальное количество попыток входа', true, false),
(NULL, 'security.login_lockout_duration', '30', 'integer', 'Длительность блокировки входа (минуты)', true, false),
(NULL, 'security.session_timeout', '1440', 'integer', 'Таймаут сессии (минуты)', true, false)
ON CONFLICT (company_id, setting_key) DO NOTHING;

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 008
-- ================================================================