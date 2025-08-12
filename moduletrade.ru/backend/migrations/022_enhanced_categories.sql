-- 022_enhanced_categories.sql
-- Миграция для улучшения системы категорий

-- Добавление полей для глобальных категорий в таблицу categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS global_category_id UUID;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS category_path TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS external_source VARCHAR(100);

-- Добавление внешнего ключа для глобальных категорий
ALTER TABLE categories ADD CONSTRAINT fk_categories_global_category_id
    FOREIGN KEY (global_category_id) REFERENCES categories(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Индексы для новых полей
CREATE INDEX IF NOT EXISTS idx_categories_global_category_id ON categories (global_category_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_global ON categories (is_global);
CREATE INDEX IF NOT EXISTS idx_categories_category_path ON categories USING GIN (to_tsvector('russian', category_path));
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories (level);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories (sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_is_system ON categories (is_system);
CREATE INDEX IF NOT EXISTS idx_categories_external_id ON categories (external_id);
CREATE INDEX IF NOT EXISTS idx_categories_external_source ON categories (external_source);

-- Комментарии к новым полям
COMMENT ON COLUMN categories.global_category_id IS 'Ссылка на глобальную категорию';
COMMENT ON COLUMN categories.is_global IS 'Флаг глобальной категории (доступна всем компаниям)';
COMMENT ON COLUMN categories.category_path IS 'Полный путь к категории (например: Электроника/Телефоны/Смартфоны)';
COMMENT ON COLUMN categories.level IS 'Уровень вложенности категории';
COMMENT ON COLUMN categories.sort_order IS 'Порядок сортировки категории';
COMMENT ON COLUMN categories.is_system IS 'Флаг системной категории (нельзя удалить)';
COMMENT ON COLUMN categories.external_id IS 'Внешний ID категории в системе поставщика';
COMMENT ON COLUMN categories.external_source IS 'Источник внешней категории (rs24, yandex, etc.)';

-- Создание таблицы для синонимов категорий
CREATE TABLE IF NOT EXISTS category_synonyms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL,
    synonym VARCHAR(255) NOT NULL,
    language VARCHAR(10) DEFAULT 'ru',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT fk_category_synonyms_category_id
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_category_synonym UNIQUE (category_id, synonym, language)
);

-- Индексы для синонимов
CREATE INDEX IF NOT EXISTS idx_category_synonyms_category_id ON category_synonyms (category_id);
CREATE INDEX IF NOT EXISTS idx_category_synonyms_synonym ON category_synonyms USING GIN (to_tsvector('russian', synonym));
CREATE INDEX IF NOT EXISTS idx_category_synonyms_language ON category_synonyms (language);

-- Комментарии
COMMENT ON TABLE category_synonyms IS 'Синонимы названий категорий для улучшения поиска';
COMMENT ON COLUMN category_synonyms.synonym IS 'Синоним названия категории';
COMMENT ON COLUMN category_synonyms.language IS 'Язык синонима (ru, en, etc.)';

-- Создание функции для обновления путей категорий
CREATE OR REPLACE FUNCTION update_category_paths()
RETURNS TRIGGER AS $$
DECLARE
    parent_path TEXT;
    new_path TEXT;
BEGIN
    -- Если это корневая категория
    IF NEW.parent_id IS NULL THEN
        NEW.category_path = NEW.name;
        NEW.level = 1;
    ELSE
        -- Получаем путь родительской категории
        SELECT category_path INTO parent_path
        FROM categories
        WHERE id = NEW.parent_id;

        IF parent_path IS NOT NULL THEN
            NEW.category_path = parent_path || '/' || NEW.name;
            NEW.level = array_length(string_to_array(NEW.category_path, '/'), 1);
        ELSE
            NEW.category_path = NEW.name;
            NEW.level = 1;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создание триггера для автоматического обновления путей
CREATE TRIGGER trigger_update_category_paths
    BEFORE INSERT OR UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_category_paths();

-- Функция для рекурсивного обновления путей всех дочерних категорий
CREATE OR REPLACE FUNCTION update_all_category_paths()
RETURNS void AS $$
DECLARE
    cat RECORD;
BEGIN
    FOR cat IN SELECT id, parent_id, name FROM categories ORDER BY level ASC, sort_order ASC
    LOOP
        UPDATE categories
        SET
            category_path = CASE
                WHEN parent_id IS NULL THEN name
                ELSE (
                    SELECT category_path || '/' || cat.name
                    FROM categories
                    WHERE id = cat.parent_id
                )
            END,
            level = CASE
                WHEN parent_id IS NULL THEN 1
                ELSE (
                    SELECT level + 1
                    FROM categories
                    WHERE id = cat.parent_id
                )
            END
        WHERE id = cat.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Создание представления для иерархии категорий
CREATE OR REPLACE VIEW category_hierarchy_view AS
WITH RECURSIVE category_tree AS (
    SELECT
        id,
        name,
        parent_id,
        category_path,
        level,
        sort_order,
        is_global,
        is_system,
        ARRAY[id] as path_array,
        1 as depth
    FROM categories
    WHERE parent_id IS NULL

    UNION ALL

    SELECT
        c.id,
        c.name,
        c.parent_id,
        c.category_path,
        c.level,
        c.sort_order,
        c.is_global,
        c.is_system,
        ct.path_array || c.id,
        ct.depth + 1
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT
    id,
    name,
    parent_id,
    category_path,
    level,
    sort_order,
    is_global,
    is_system,
    path_array,
    depth,
    array_length(path_array, 1) as path_length
FROM category_tree
ORDER BY path_array;

-- Комментарий к представлению
COMMENT ON VIEW category_hierarchy_view IS 'Представление для просмотра иерархии категорий с рекурсивным обходом';
