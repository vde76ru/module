-- ========================================
-- МИГРАЦИЯ 999: НАЧАЛЬНЫЕ ДАННЫЕ
-- Seed data для ModuleTrade V2.0
-- Версия: 2.3 (ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ)
-- ========================================

-- ========================================
-- РОЛИ ПОЛЬЗОВАТЕЛЕЙ
-- ========================================

INSERT INTO roles (name, display_name, description, is_system, priority) VALUES
('admin', 'Администратор', 'Полный доступ ко всем функциям системы', true, 100),
('manager', 'Менеджер', 'Управление товарами, заказами и аналитикой', true, 50),
('operator', 'Оператор', 'Работа с заказами и складами', true, 30),
('viewer', 'Наблюдатель', 'Только просмотр данных', true, 10),
('user', 'Пользователь', 'Базовая роль пользователя (legacy)', true, 20)
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
ON CONFLICT DO NOTHING;

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
ON CONFLICT DO NOTHING;

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
ON CONFLICT DO NOTHING;

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
ON CONFLICT DO NOTHING;

-- ========================================
-- ТАРИФНЫЕ ПЛАНЫ
-- ========================================

INSERT INTO tariffs (name, code, description, price, limits, features, billing_period, trial_days) VALUES
('Бесплатный', 'free', 'Базовый функционал для ознакомления', 0,
 '{"products": 100, "marketplaces": 1, "api_calls": 1000, "users": 1, "storage_gb": 1}',
 '["products_basic", "orders_basic", "warehouses_basic"]',
 'monthly', 0),

('Старт', 'starter', 'Для начинающих продавцов', 2990,
 '{"products": 1000, "marketplaces": 3, "api_calls": 10000, "users": 3, "storage_gb": 5}',
 '["products_basic", "orders_basic", "warehouses_basic", "sync_basic", "analytics_basic", "api_access"]',
 'monthly', 14),

('Бизнес', 'business', 'Для растущего бизнеса', 9990,
 '{"products": 10000, "marketplaces": 5, "api_calls": 50000, "users": 10, "storage_gb": 20}',
 '["products_advanced", "orders_advanced", "warehouses_advanced", "sync_advanced", "analytics_advanced", "api_access", "support_priority"]',
 'monthly', 14),

('Премиум', 'premium', 'Максимальные возможности', 19990,
 '{"products": 50000, "marketplaces": 10, "api_calls": 200000, "users": 25, "storage_gb": 50}',
 '["products_advanced", "orders_advanced", "warehouses_advanced", "multi_warehouse", "sync_advanced", "analytics_advanced", "api_access", "support_priority", "custom_reports", "white_label"]',
 'monthly', 14),

('Энтерпрайз', 'enterprise', 'Индивидуальное решение', 0,
 '{"products": -1, "marketplaces": -1, "api_calls": -1, "users": -1, "storage_gb": -1}',
 '["all_features", "custom_development", "dedicated_support", "sla", "on_premise"]',
 'custom', 30)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  billing_period = EXCLUDED.billing_period,
  trial_days = EXCLUDED.trial_days,
  updated_at = NOW();

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