-- ========================================
-- МИГРАЦИЯ 999: НАЧАЛЬНЫЕ ДАННЫЕ
-- Seed data для ModuleTrade V2.0
-- Версия: 2.5 (ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ)
-- ========================================

-- ========================================
-- РОЛИ ПОЛЬЗОВАТЕЛЕЙ
-- ========================================

INSERT INTO roles (name, display_name, description, is_system, priority, is_active)
VALUES
('admin', 'Администратор', 'Полный доступ', true, 100, true),
('manager', 'Менеджер', 'Управление', true, 50, true),
('operator', 'Оператор', 'Работа с заказами', true, 30, true),
('viewer', 'Наблюдатель', 'Только просмотр', true, 10, true),
('user', 'Пользователь', 'Базовая роль', true, 20, true),
('client', 'Клиент', 'Клиентская роль', false, 5, true)
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- РАЗРЕШЕНИЯ (PERMISSIONS)
-- ========================================

-- Товары
INSERT INTO permissions (name, display_name, resource, action, category) VALUES
('products.view', 'Просмотр товаров', 'products', 'view', 'products'),
('products.create', 'Создание товаров', 'products', 'create', 'products'),
('products.update', 'Редактирование товаров', 'products', 'update', 'products'),
('products.delete', 'Удаление товаров', 'products', 'delete', 'products'),
('products.import', 'Импорт товаров', 'products', 'import', 'products'),
('products.export', 'Экспорт товаров', 'products', 'export', 'products')
ON CONFLICT (name) DO NOTHING;

-- Заказы
INSERT INTO permissions (name, display_name, resource, action, category) VALUES
('orders.view', 'Просмотр заказов', 'orders', 'view', 'orders'),
('orders.create', 'Создание заказов', 'orders', 'create', 'orders'),
('orders.update', 'Редактирование заказов', 'orders', 'update', 'orders'),
('orders.delete', 'Удаление заказов', 'orders', 'delete', 'orders'),
('orders.export', 'Экспорт заказов', 'orders', 'export', 'orders')
ON CONFLICT (name) DO NOTHING;

-- Склады
INSERT INTO permissions (name, display_name, resource, action, category) VALUES
('warehouses.view', 'Просмотр складов', 'warehouses', 'view', 'warehouses'),
('warehouses.create', 'Создание складов', 'warehouses', 'create', 'warehouses'),
('warehouses.update', 'Редактирование складов', 'warehouses', 'update', 'warehouses'),
('warehouses.delete', 'Удаление складов', 'warehouses', 'delete', 'warehouses'),
('warehouses.transfer', 'Перемещение товаров', 'warehouses', 'transfer', 'warehouses')
ON CONFLICT (name) DO NOTHING;

-- Поставщики
INSERT INTO permissions (name, display_name, resource, action, category) VALUES
('suppliers.view', 'Просмотр поставщиков', 'suppliers', 'view', 'suppliers'),
('suppliers.create', 'Создание поставщиков', 'suppliers', 'create', 'suppliers'),
('suppliers.update', 'Редактирование поставщиков', 'suppliers', 'update', 'suppliers'),
('suppliers.delete', 'Удаление поставщиков', 'suppliers', 'delete', 'suppliers')
ON CONFLICT (name) DO NOTHING;

-- Маркетплейсы
INSERT INTO permissions (name, display_name, resource, action, category) VALUES
('marketplaces.view', 'Просмотр маркетплейсов', 'marketplaces', 'view', 'marketplaces'),
('marketplaces.create', 'Подключение маркетплейсов', 'marketplaces', 'create', 'marketplaces'),
('marketplaces.update', 'Настройка маркетплейсов', 'marketplaces', 'update', 'marketplaces'),
('marketplaces.delete', 'Отключение маркетплейсов', 'marketplaces', 'delete', 'marketplaces')
ON CONFLICT (name) DO NOTHING;

-- Пользователи
INSERT INTO permissions (name, display_name, resource, action, category) VALUES
('users.view', 'Просмотр пользователей', 'users', 'view', 'users'),
('users.create', 'Создание пользователей', 'users', 'create', 'users'),
('users.update', 'Редактирование пользователей', 'users', 'update', 'users'),
('users.delete', 'Удаление пользователей', 'users', 'delete', 'users')
ON CONFLICT (name) DO NOTHING;

-- Синхронизация
INSERT INTO permissions (name, display_name, resource, action, category) VALUES
('sync.execute', 'Запуск синхронизации', 'sync', 'execute', 'sync'),
('sync.view_logs', 'Просмотр логов синхронизации', 'sync', 'view_logs', 'sync')
ON CONFLICT (name) DO NOTHING;

-- Аналитика
INSERT INTO permissions (name, display_name, resource, action, category) VALUES
('analytics.view', 'Просмотр аналитики', 'analytics', 'view', 'analytics'),
('analytics.export', 'Экспорт отчетов', 'analytics', 'export', 'analytics')
ON CONFLICT (name) DO NOTHING;

-- Биллинг
INSERT INTO permissions (name, display_name, resource, action, category) VALUES
('billing.view', 'Просмотр биллинга', 'billing', 'view', 'billing'),
('billing.manage', 'Управление биллингом', 'billing', 'manage', 'billing')
ON CONFLICT (name) DO NOTHING;

-- Системные
INSERT INTO permissions (name, display_name, resource, action, category) VALUES
('system.admin', 'Системное администрирование', 'system', 'admin', 'system'),
('tenant.admin', 'Администрирование компании', 'tenant', 'admin', 'system')
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- СВЯЗЬ РОЛЕЙ С РАЗРЕШЕНИЯМИ
-- ========================================

-- Администратор - все права
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Менеджер
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND p.name IN (
    'products.view', 'products.create', 'products.update', 'products.delete', 'products.import', 'products.export',
    'orders.view', 'orders.create', 'orders.update', 'orders.delete', 'orders.export',
    'warehouses.view', 'warehouses.create', 'warehouses.update',
    'suppliers.view', 'suppliers.update',
    'marketplaces.view', 'marketplaces.update',
    'users.view',
    'sync.execute', 'sync.view_logs',
    'analytics.view', 'analytics.export',
    'billing.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Оператор
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'operator'
  AND p.name IN (
    'products.view', 'products.update',
    'orders.view', 'orders.update',
    'warehouses.view', 'warehouses.transfer',
    'suppliers.view',
    'marketplaces.view',
    'sync.execute',
    'analytics.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Наблюдатель
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'viewer'
  AND p.name IN (
    'products.view',
    'orders.view',
    'warehouses.view',
    'suppliers.view',
    'marketplaces.view',
    'analytics.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========================================
-- ТАРИФНЫЕ ПЛАНЫ
-- ========================================

INSERT INTO tariffs (code, name, description, price, limits, features, billing_period, trial_days, is_active)
VALUES
('free', 'Бесплатный', 'Базовый функционал', 0, '{"products": 100}', '["products_basic"]', 'monthly', 14, true),
('starter', 'Старт', 'Для начинающих', 2990, '{"products": 1000}', '["products_basic"]', 'monthly', 14, true),
('business', 'Бизнес', 'Для бизнеса', 9990, '{"products": 10000}', '["products_advanced"]', 'monthly', 14, true),
('premium', 'Премиум', 'Максимум', 19990, '{"products": 50000}', '["all_features"]', 'monthly', 14, true),
('enterprise', 'Энтерпрайз', 'Индивидуально', 0, '{"products": -1}', '["all_features"]', 'custom', 30, true)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- МАРКЕТПЛЕЙСЫ (Глобальный справочник)
-- ========================================

INSERT INTO marketplaces (code, name, api_type, commission_rules, is_public) VALUES
('ozon', 'Ozon', 'fbs', '{"type": "percent", "value": 15}', true),
('wildberries', 'Wildberries', 'fbs', '{"type": "percent", "value": 18}', true),
('yandex_market', 'Яндекс.Маркет', 'fbs', '{"type": "percent", "value": 12}', true),
('avito', 'Avito', 'classified', '{"type": "fixed", "value": 100}', true),
('sbermegamarket', 'СберМегаМаркет', 'fbs', '{"type": "percent", "value": 10}', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  api_type = EXCLUDED.api_type,
  commission_rules = EXCLUDED.commission_rules,
  updated_at = NOW();

-- ========================================
-- ЕДИНИЦЫ ИЗМЕРЕНИЯ
-- ========================================

INSERT INTO dictionaries (type, code, name, description, sort_order) VALUES
('units', 'pcs', 'шт', 'Штуки', 10),
('units', 'kg', 'кг', 'Килограммы', 20),
('units', 'g', 'г', 'Граммы', 30),
('units', 'l', 'л', 'Литры', 40),
('units', 'ml', 'мл', 'Миллилитры', 50),
('units', 'm', 'м', 'Метры', 60),
('units', 'cm', 'см', 'Сантиметры', 70),
('units', 'm2', 'м²', 'Квадратные метры', 80),
('units', 'm3', 'м³', 'Кубические метры', 90),
('units', 'pack', 'уп', 'Упаковка', 100)
ON CONFLICT (type, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ========================================
-- ВАЛЮТЫ
-- ========================================

INSERT INTO dictionaries (type, code, name, metadata, sort_order) VALUES
('currencies', 'RUB', 'Российский рубль', '{"symbol": "₽", "decimal_places": 2}', 10),
('currencies', 'USD', 'Доллар США', '{"symbol": "$", "decimal_places": 2}', 20),
('currencies', 'EUR', 'Евро', '{"symbol": "€", "decimal_places": 2}', 30),
('currencies', 'CNY', 'Китайский юань', '{"symbol": "¥", "decimal_places": 2}', 40)
ON CONFLICT (type, code) DO UPDATE SET
  name = EXCLUDED.name,
  metadata = EXCLUDED.metadata;

-- ========================================
-- СТАТУСЫ ЗАКАЗОВ
-- ========================================

INSERT INTO dictionaries (type, code, name, description, metadata, sort_order) VALUES
('order_statuses', 'new', 'Новый', 'Заказ только что создан', '{"color": "#1890ff", "icon": "plus-circle"}', 10),
('order_statuses', 'confirmed', 'Подтвержден', 'Заказ подтвержден клиентом', '{"color": "#52c41a", "icon": "check-circle"}', 20),
('order_statuses', 'processing', 'В обработке', 'Заказ обрабатывается', '{"color": "#faad14", "icon": "sync"}', 30),
('order_statuses', 'packed', 'Упакован', 'Заказ упакован и готов к отправке', '{"color": "#13c2c2", "icon": "gift"}', 40),
('order_statuses', 'shipped', 'Отправлен', 'Заказ передан в доставку', '{"color": "#2f54eb", "icon": "car"}', 50),
('order_statuses', 'delivered', 'Доставлен', 'Заказ доставлен клиенту', '{"color": "#52c41a", "icon": "check"}', 60),
('order_statuses', 'cancelled', 'Отменен', 'Заказ отменен', '{"color": "#f5222d", "icon": "close-circle"}', 70),
('order_statuses', 'returned', 'Возвращен', 'Заказ возвращен клиентом', '{"color": "#fa8c16", "icon": "rollback"}', 80)
ON CONFLICT (type, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- ========================================
-- ТИПЫ ДВИЖЕНИЙ ТОВАРОВ
-- ========================================

INSERT INTO dictionaries (type, code, name, description, metadata, sort_order) VALUES
('movement_types', 'receipt', 'Поступление', 'Поступление товара на склад', '{"impact": "positive"}', 10),
('movement_types', 'shipment', 'Отгрузка', 'Отгрузка товара со склада', '{"impact": "negative"}', 20),
('movement_types', 'transfer_in', 'Перемещение (приход)', 'Приход товара с другого склада', '{"impact": "positive"}', 30),
('movement_types', 'transfer_out', 'Перемещение (расход)', 'Отправка товара на другой склад', '{"impact": "negative"}', 40),
('movement_types', 'adjustment', 'Корректировка', 'Корректировка остатков', '{"impact": "neutral"}', 50),
('movement_types', 'return', 'Возврат', 'Возврат товара от клиента', '{"impact": "positive"}', 60),
('movement_types', 'write_off', 'Списание', 'Списание товара', '{"impact": "negative"}', 70)
ON CONFLICT (type, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- ========================================
-- СИСТЕМНЫЕ НАСТРОЙКИ ПО УМОЛЧАНИЮ
-- ========================================

-- Добавляем настройки для новых компаний
INSERT INTO company_settings (company_id, setting_key, setting_value, setting_type, category)
SELECT
  c.id,
  'default_currency',
  'RUB',
  'string',
  'general'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM company_settings cs
  WHERE cs.company_id = c.id AND cs.setting_key = 'default_currency'
);

INSERT INTO company_settings (company_id, setting_key, setting_value, setting_type, category)
SELECT
  c.id,
  'default_unit',
  'pcs',
  'string',
  'general'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM company_settings cs
  WHERE cs.company_id = c.id AND cs.setting_key = 'default_unit'
);

-- ========================================
-- ПРОВЕРКА И ИСПРАВЛЕНИЕ ДАННЫХ
-- ========================================

-- Обновляем старые роли на новые
UPDATE users SET role_id = r.id
FROM roles r
WHERE users.role = r.name AND users.role_id IS NULL;

-- Устанавливаем роль user для legacy записей
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'user')
WHERE role_id IS NULL AND role = 'user';

-- ========================================
-- ТЕСТОВЫЕ ДАННЫЕ (ОПЦИОНАЛЬНО)
-- ========================================

-- Тестовая компания (не используем ON CONFLICT т.к. нет UNIQUE на name)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Demo Company') THEN
        INSERT INTO companies (name, tariff_id, subscription_status, plan, trial_end_date, is_active)
        VALUES (
            'Demo Company',
            (SELECT id FROM tariffs WHERE code = 'free' LIMIT 1),
            'trial',
            'free',
            NOW() + INTERVAL '14 days',
            true
        );
    END IF;
END $$;

-- Тестовый пользователь (используем правильный ON CONFLICT)
DO $$
DECLARE
    demo_company_id INTEGER;
BEGIN
    SELECT id INTO demo_company_id FROM companies WHERE name = 'Demo Company' LIMIT 1;
    
    IF demo_company_id IS NOT NULL THEN
        INSERT INTO users (company_id, email, password_hash, first_name, last_name, name, role, role_id, is_active, email_verified, login_count)
        VALUES (
            demo_company_id,
            'user@demo.local',
            '$2b$12$LXyJj3p/iQgzD.fE9ZTqGOxEPbjI7vQJqQvzwqKVxb7HqKz1FwWtm', -- пароль: demo123
            'User', 'Demo', 'User Demo', 'user',
            (SELECT id FROM roles WHERE name = 'user' LIMIT 1),
            true, true, 0
        )
        ON CONFLICT (company_id, email) DO NOTHING;
    END IF;
END $$;

-- ========================================
-- ВЫВОД СТАТИСТИКИ
-- ========================================

DO $$
DECLARE
  roles_count INTEGER;
  permissions_count INTEGER;
  role_permissions_count INTEGER;
  tariffs_count INTEGER;
  marketplaces_count INTEGER;
  dictionaries_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO roles_count FROM roles;
  SELECT COUNT(*) INTO permissions_count FROM permissions;
  SELECT COUNT(*) INTO role_permissions_count FROM role_permissions;
  SELECT COUNT(*) INTO tariffs_count FROM tariffs;
  SELECT COUNT(*) INTO marketplaces_count FROM marketplaces;
  SELECT COUNT(*) INTO dictionaries_count FROM dictionaries;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'SEED DATA ЗАГРУЖЕНЫ УСПЕШНО:';
  RAISE NOTICE '- Роли: %', roles_count;
  RAISE NOTICE '- Разрешения: %', permissions_count;
  RAISE NOTICE '- Связи ролей: %', role_permissions_count;
  RAISE NOTICE '- Тарифы: %', tariffs_count;
  RAISE NOTICE '- Маркетплейсы: %', marketplaces_count;
  RAISE NOTICE '- Справочники: %', dictionaries_count;
  RAISE NOTICE '========================================';
END $$;