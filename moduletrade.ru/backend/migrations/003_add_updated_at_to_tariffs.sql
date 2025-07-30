-- backend/migrations/003_add_updated_at_to_tariffs.sql
-- Добавление столбца updated_at в таблицу tariffs

-- Добавляем столбец updated_at в таблицу tariffs
ALTER TABLE public.tariffs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Обновляем существующие записи
UPDATE public.tariffs
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Добавляем триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION public.update_tariffs_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Создаем триггер (удаляем если существует)
DROP TRIGGER IF EXISTS update_tariffs_updated_at ON public.tariffs;

CREATE TRIGGER update_tariffs_updated_at
    BEFORE UPDATE ON public.tariffs
    FOR EACH ROW EXECUTE FUNCTION public.update_tariffs_updated_at_column();

-- Комментарий к столбцу
COMMENT ON COLUMN public.tariffs.updated_at IS 'Время последнего обновления тарифа';

-- Проверяем результат
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'tariffs' AND table_schema = 'public'
-- ORDER BY ordinal_position;