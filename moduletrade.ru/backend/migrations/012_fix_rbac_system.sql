-- =====================================
-- МИГРАЦИЯ: Исправление системы RBAC
-- ФАЙЛ: backend/migrations/012_fix_rbac_system.sql
-- =====================================

-- Изменяем поле role в таблице users на role_id
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;

-- Заполняем role_id на основе существующих ролей
UPDATE users SET role_id = (
  SELECT r.id FROM roles r WHERE r.name = users.role
) WHERE role IS NOT NULL;

-- Добавляем поле phone если его нет
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Обновляем индекс
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_id, role_id);