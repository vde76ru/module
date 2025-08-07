-- ================================================================
-- МИГРАЦИЯ 008: Начальные данные
-- Описание: Заполняет базу данных начальными данными для работы системы
-- Дата: 2025-01-27
-- Блок: Начальные Данные
-- Зависимости: 001-007 (все предыдущие миграции)
-- ================================================================

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
INSERT INTO price_types (id, name, code, description, is_system, is_active, sort_order) VALUES 

('00000000-0000-0000-0000-000000000025', 'Розничная цена', 'retail', 'Розничная цена для конечных покупателей', true, true, 1),
('00000000-0000-0000-0000-000000000026', 'Оптовая цена', 'wholesale', 'Оптовая цена для дилеров и партнеров', true, true, 2),
('00000000-0000-0000-0000-000000000027', 'Цена со скидкой', 'sale', 'Цена со скидкой во время акций', true, true, 3),
('00000000-0000-0000-0000-000000000028', 'Себестоимость', 'cost', 'Себестоимость товара', true, true, 4),
('00000000-0000-0000-0000-000000000029', 'Закупочная цена', 'purchase', 'Цена закупки у поставщика', true, true, 5),
('00000000-0000-0000-0000-000000000030', 'Рекомендуемая цена', 'recommended', 'Рекомендуемая цена продажи', true, true, 6)

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
(NULL, 'security.session_timeout', '1440', 'integer', 'Таймаут сессии (минуты)', true, false),

-- Настройки интеграций
(NULL, 'integration.sync_interval', '60', 'integer', 'Интервал синхронизации (минуты)', false, false),
(NULL, 'integration.max_retry_attempts', '3', 'integer', 'Максимальное количество попыток повтора', false, false),
(NULL, 'integration.retry_delay', '300', 'integer', 'Задержка между повторами (секунды)', false, false),

-- Настройки уведомлений
(NULL, 'notifications.email_enabled', 'true', 'boolean', 'Включить email уведомления', false, false),
(NULL, 'notifications.sms_enabled', 'false', 'boolean', 'Включить SMS уведомления', false, false),
(NULL, 'notifications.webhook_enabled', 'false', 'boolean', 'Включить webhook уведомления', false, false),

-- Настройки файлов
(NULL, 'files.max_upload_size', '10485760', 'integer', 'Максимальный размер загружаемого файла (байты)', true, false),
(NULL, 'files.allowed_extensions', 'jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx', 'string', 'Разрешенные расширения файлов', true, false),
(NULL, 'files.storage_type', 'local', 'string', 'Тип хранилища файлов', false, false),

-- Настройки API
(NULL, 'api.rate_limit_requests', '1000', 'integer', 'Лимит запросов к API', false, false),
(NULL, 'api.rate_limit_window', '3600', 'integer', 'Окно лимита запросов (секунды)', false, false),
(NULL, 'api.enable_logging', 'true', 'boolean', 'Включить логирование API запросов', false, false),

-- Настройки аудита
(NULL, 'audit.enabled', 'true', 'boolean', 'Включить аудит', false, false),
(NULL, 'audit.retention_days', '365', 'integer', 'Срок хранения аудита (дни)', false, false),
(NULL, 'audit.log_sensitive_data', 'false', 'boolean', 'Логировать чувствительные данные', false, false),

-- Настройки биллинга
(NULL, 'billing.auto_renewal', 'true', 'boolean', 'Автоматическое продление подписок', false, false),
(NULL, 'billing.grace_period_days', '7', 'integer', 'Льготный период после истечения подписки (дни)', false, false),
(NULL, 'billing.currency_exchange_enabled', 'false', 'boolean', 'Включить конвертацию валют', false, false),

-- Настройки складов
(NULL, 'warehouse.auto_reserve', 'true', 'boolean', 'Автоматическое резервирование товаров', false, false),
(NULL, 'warehouse.low_stock_threshold', '10', 'integer', 'Порог низкого остатка товара', false, false),
(NULL, 'warehouse.enable_batch_tracking', 'true', 'boolean', 'Включить отслеживание партий', false, false),

-- Настройки заказов
(NULL, 'orders.auto_processing', 'true', 'boolean', 'Автоматическая обработка заказов', false, false),
(NULL, 'orders.require_confirmation', 'false', 'boolean', 'Требовать подтверждение заказов', false, false),
(NULL, 'orders.auto_cancel_unpaid', 'true', 'boolean', 'Автоматическая отмена неоплаченных заказов', false, false),

-- Настройки товаров
(NULL, 'products.auto_sync_prices', 'true', 'boolean', 'Автоматическая синхронизация цен', false, false),
(NULL, 'products.auto_update_stock', 'true', 'boolean', 'Автоматическое обновление остатков', false, false),
(NULL, 'products.require_approval', 'false', 'boolean', 'Требовать одобрение новых товаров', false, false),

-- Настройки интеграций с маркетплейсами
(NULL, 'marketplace.auto_export_products', 'true', 'boolean', 'Автоматический экспорт товаров', false, false),
(NULL, 'marketplace.auto_import_orders', 'true', 'boolean', 'Автоматический импорт заказов', false, false),
(NULL, 'marketplace.sync_inventory', 'true', 'boolean', 'Синхронизация остатков', false, false),

-- Настройки интеграций с поставщиками
(NULL, 'supplier.auto_import_products', 'true', 'boolean', 'Автоматический импорт товаров от поставщиков', false, false),
(NULL, 'supplier.auto_update_prices', 'true', 'boolean', 'Автоматическое обновление цен от поставщиков', false, false),
(NULL, 'supplier.auto_update_stock', 'true', 'boolean', 'Автоматическое обновление остатков от поставщиков', false, false)

ON CONFLICT (company_id, setting_key) DO NOTHING;

-- ================================================================
-- ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ (ОПЦИОНАЛЬНО)
-- ================================================================

-- Создаем демонстрационную компанию
INSERT INTO companies (id, name, tariff_id, status, contact_email, is_active) VALUES 
('00000000-0000-0000-0000-000000000031', 'Демо Компания', 
 (SELECT id FROM tariffs WHERE name = 'Стартер' LIMIT 1), 
 'active', 'demo@example.com', true)
ON CONFLICT DO NOTHING;

-- Создаем демонстрационного пользователя
INSERT INTO users (id, company_id, name, email, password_hash, role, is_active, email_verified_at) VALUES 
('00000000-0000-0000-0000-000000000032', 
 '00000000-0000-0000-0000-000000000031', 
 'Администратор Демо', 
 'admin@demo.com', 
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
 'Владелец', 
 true, 
 CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;

-- Создаем демонстрационный склад
INSERT INTO warehouses (id, company_id, name, code, type, description, is_default, is_active) VALUES 
('00000000-0000-0000-0000-000000000033', 
 '00000000-0000-0000-0000-000000000031', 
 'Основной склад', 
 'MAIN', 
 'warehouse', 
 'Основной склад демонстрационной компании', 
 true, 
 true)
ON CONFLICT DO NOTHING;

-- Создаем демонстрационные категории
INSERT INTO categories (id, company_id, name, slug, description, sort_order, is_active) VALUES 
('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000031', 'Электроника', 'elektronika', 'Электронные устройства и гаджеты', 1, true),
('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000031', 'Одежда', 'odezhda', 'Одежда и аксессуары', 2, true),
('00000000-0000-0000-0000-000000000036', '00000000-0000-0000-0000-000000000031', 'Книги', 'knigi', 'Книги и литература', 3, true)
ON CONFLICT DO NOTHING;

-- Создаем базовые типы цен
INSERT INTO price_types (id, name, code, display_name, description, category, is_system) VALUES
('00000000-0000-0000-0000-000000000050', 'base', 'base', 'Базовая цена', 'Базовая цена товара', 'pricing', true),
('00000000-0000-0000-0000-000000000051', 'retail', 'retail', 'Розничная цена', 'Розничная цена товара', 'pricing', true),
('00000000-0000-0000-0000-000000000052', 'wholesale', 'wholesale', 'Оптовая цена', 'Оптовая цена товара', 'pricing', true),
('00000000-0000-0000-0000-000000000053', 'purchase', 'purchase', 'Закупочная цена', 'Цена закупки у поставщика', 'pricing', true),
('00000000-0000-0000-0000-000000000054', 'sale', 'sale', 'Цена со скидкой', 'Цена товара со скидкой', 'pricing', true),
('00000000-0000-0000-0000-000000000055', 'ozon', 'ozon', 'Цена для Ozon', 'Цена товара для маркетплейса Ozon', 'marketplace', true),
('00000000-0000-0000-0000-000000000056', 'wildberries', 'wildberries', 'Цена для Wildberries', 'Цена товара для маркетплейса Wildberries', 'marketplace', true),
('00000000-0000-0000-0000-000000000057', 'yandex_market', 'yandex_market', 'Цена для Яндекс.Маркет', 'Цена товара для маркетплейса Яндекс.Маркет', 'marketplace', true)
ON CONFLICT (code) DO NOTHING;

-- Создаем демонстрационные бренды
INSERT INTO brands (id, company_id, name, slug, description, sort_order, is_active) VALUES 
('00000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-000000000031', 'Apple', 'apple', 'Технологическая компания Apple', 1, true),
('00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000031', 'Samsung', 'samsung', 'Корейская компания Samsung', 2, true),
('00000000-0000-0000-0000-000000000039', '00000000-0000-0000-0000-000000000031', 'Nike', 'nike', 'Спортивная одежда Nike', 3, true)
ON CONFLICT DO NOTHING;

-- Создаем демонстрационные товары (БЕЗ поля sku - добавится в миграции 010)
INSERT INTO products (id, company_id, name, description, brand_id, category_id, status, is_active) VALUES 
('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000031', 'iPhone 15 Pro', 'Смартфон Apple iPhone 15 Pro', '00000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-000000000034', 'active', true),
('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000031', 'Samsung Galaxy S24', 'Смартфон Samsung Galaxy S24', '00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000034', 'active', true),
('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000031', 'Nike Air Max', 'Кроссовки Nike Air Max', '00000000-0000-0000-0000-000000000039', '00000000-0000-0000-0000-000000000035', 'active', true)
ON CONFLICT DO NOTHING;

-- Создаем демонстрационные цены
INSERT INTO prices (id, product_id, price_type_id, price_type, value, currency, is_active) VALUES 
('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000051', 'retail', 129990.00, 'RUB', true),
('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000051', 'retail', 89990.00, 'RUB', true),
('00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000051', 'retail', 15990.00, 'RUB', true)
ON CONFLICT DO NOTHING;

-- Создаем демонстрационные остатки на складе
INSERT INTO warehouse_product_links (id, warehouse_id, product_id, quantity, available_quantity, price, is_active) VALUES 
('00000000-0000-0000-0000-000000000046', '00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000040', 50, 50, 129990.00, true),
('00000000-0000-0000-0000-000000000047', '00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000041', 30, 30, 89990.00, true),
('00000000-0000-0000-0000-000000000048', '00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000042', 100, 100, 15990.00, true)
ON CONFLICT DO NOTHING;

-- Обновляем демо-товары, добавляя sku (после выполнения миграции 010)
UPDATE products SET sku = 'IPHONE-15-PRO' WHERE id = '00000000-0000-0000-0000-000000000040';
UPDATE products SET sku = 'SAMSUNG-S24' WHERE id = '00000000-0000-0000-0000-000000000041';
UPDATE products SET sku = 'NIKE-AIR-MAX' WHERE id = '00000000-0000-0000-0000-000000000042';

-- ================================================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ 008
-- ================================================================ 