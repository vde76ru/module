-- backend/migrations/014_add_name_to_users.sql
-- Добавление поля name в таблицу users

-- Добавление поля name в таблицу users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Комментарий к полю
COMMENT ON COLUMN users.name IS 'Полное имя пользователя';

-- Заполнение имени на основе email для существующих пользователей
UPDATE users 
SET name = SPLIT_PART(email, '@', 1)
WHERE name IS NULL;