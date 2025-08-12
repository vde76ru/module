// backend/src/services/CategoryService.js
// Расширенная работа с категориями: дерево, уровни, перемещения, хлебные крошки, синхронизация

const db = require('../config/database');
const logger = require('../utils/logger');

class CategoryService {
    /**
     * Получение дерева категорий для компании
     */
    async getCategoryTree(companyId, includeGlobal = true) {
        try {
            let query = `
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
                        external_id,
                        external_source,
                        ARRAY[id] as path_array,
                        1 as depth
                    FROM categories
                    WHERE parent_id IS NULL
                    AND (company_id = $1 OR is_global = true)

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
                        c.external_id,
                        c.external_source,
                        ct.path_array || c.id,
                        ct.depth + 1
                    FROM categories c
                    JOIN category_tree ct ON c.parent_id = ct.id
                    WHERE c.company_id = $1 OR c.is_global = true
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
                    external_id,
                    external_source,
                    path_array,
                    depth,
                    array_length(path_array, 1) as path_length
                FROM category_tree
                ORDER BY path_array, sort_order
            `;

            const result = await db.query(query, [companyId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting category tree:', error);
            throw error;
        }
    }

    /**
     * Получение глобальных категорий
     */
    async getGlobalCategories() {
        try {
            const query = `
                SELECT id, name, parent_id, category_path, level, sort_order
                FROM categories
                WHERE is_global = true AND is_active = true
                ORDER BY sort_order, name
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error getting global categories:', error);
            throw error;
        }
    }

    /**
     * Создание глобальной категории
     */
    async createGlobalCategory(categoryData, createdBy) {
        try {
            const query = `
                INSERT INTO categories (
                    name, parent_id, description, is_global, is_system,
                    external_id, external_source, sort_order, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const values = [
                categoryData.name,
                categoryData.parent_id || null,
                categoryData.description || null,
                true, // is_global
                categoryData.is_system || false,
                categoryData.external_id || null,
                categoryData.external_source || null,
                categoryData.sort_order || 0,
                createdBy
            ];

            const result = await db.query(query, values);

            // Обновляем пути для всех дочерних категорий
            await this.updateCategoryPaths();

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating global category:', error);
            throw error;
        }
    }

    /**
     * Создание локальной категории
     */
    async createLocalCategory(companyId, categoryData, createdBy) {
        try {
            const query = `
                INSERT INTO categories (
                    company_id, name, parent_id, description, global_category_id,
                    is_global, is_system, external_id, external_source,
                    sort_order, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const values = [
                companyId,
                categoryData.name,
                categoryData.parent_id || null,
                categoryData.description || null,
                categoryData.global_category_id || null,
                false, // is_global
                categoryData.is_system || false,
                categoryData.external_id || null,
                categoryData.external_source || null,
                categoryData.sort_order || 0,
                createdBy
            ];

            const result = await db.query(query, values);

            // Обновляем пути для всех дочерних категорий
            await this.updateCategoryPaths();

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating local category:', error);
            throw error;
        }
    }

    /**
     * Обновление категории
     */
    async updateCategory(categoryId, updateData, updatedBy) {
        try {
            const query = `
                UPDATE categories
                SET
                    name = COALESCE($1, name),
                    parent_id = COALESCE($2, parent_id),
                    description = COALESCE($3, description),
                    global_category_id = COALESCE($4, global_category_id),
                    sort_order = COALESCE($5, sort_order),
                    external_id = COALESCE($6, external_id),
                    external_source = COALESCE($7, external_source),
                    updated_at = CURRENT_TIMESTAMP,
                    updated_by = $8
                WHERE id = $9
                RETURNING *
            `;

            const values = [
                updateData.name,
                updateData.parent_id,
                updateData.description,
                updateData.global_category_id,
                updateData.sort_order,
                updateData.external_id,
                updateData.external_source,
                updatedBy,
                categoryId
            ];

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Category not found');
            }

            // Обновляем пути для всех дочерних категорий
            await this.updateCategoryPaths();

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating category:', error);
            throw error;
        }
    }

    /**
     * Удаление категории
     */
    async deleteCategory(categoryId, companyId) {
        try {
            // Проверяем, что категория принадлежит компании или является глобальной
            const checkQuery = `
                SELECT id, is_global, is_system, company_id
                FROM categories
                WHERE id = $1
            `;

            const checkResult = await db.query(checkQuery, [categoryId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Category not found');
            }

            const category = checkResult.rows[0];

            // Нельзя удалить системную категорию
            if (category.is_system) {
                throw new Error('Cannot delete system category');
            }

            // Проверяем права на удаление
            if (!category.is_global && category.company_id !== companyId) {
                throw new Error('Access denied');
            }

            // Проверяем, есть ли дочерние категории
            const childrenQuery = `
                SELECT COUNT(*) as count
                FROM categories
                WHERE parent_id = $1
            `;

            const childrenResult = await db.query(childrenQuery, [categoryId]);

            if (parseInt(childrenResult.rows[0].count) > 0) {
                throw new Error('Cannot delete category with children');
            }

            // Проверяем, есть ли товары в этой категории
            const productsQuery = `
                SELECT COUNT(*) as count
                FROM products
                WHERE category_id = $1
            `;

            const productsResult = await db.query(productsQuery, [categoryId]);

            if (parseInt(productsResult.rows[0].count) > 0) {
                throw new Error('Cannot delete category with products');
            }

            // Удаляем категорию
            const deleteQuery = `
                DELETE FROM categories
                WHERE id = $1
            `;

            await db.query(deleteQuery, [categoryId]);

            return { success: true, message: 'Category deleted successfully' };
        } catch (error) {
            logger.error('Error deleting category:', error);
            throw error;
        }
    }

    /**
     * Массовое обновление категорий
     */
    async bulkUpdateCategories(companyId, updates) {
        try {
            const results = [];

            for (const update of updates) {
                try {
                    if (update.action === 'update') {
                        const result = await this.updateCategory(update.id, update.data, update.updated_by);
                        results.push({ id: update.id, action: 'update', success: true, data: result });
                    } else if (update.action === 'delete') {
                        const result = await this.deleteCategory(update.id, companyId);
                        results.push({ id: update.id, action: 'delete', success: true, data: result });
                    }
                } catch (error) {
                    results.push({
                        id: update.id,
                        action: update.action,
                        success: false,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('Error bulk updating categories:', error);
            throw error;
        }
    }

    /**
     * Поиск категорий
     */
    async searchCategories(companyId, searchTerm, includeGlobal = true) {
        try {
            let query = `
                SELECT id, name, parent_id, category_path, level, is_global, company_id
                FROM categories
                WHERE (company_id = $1 OR is_global = $2)
                AND is_active = true
                AND (
                    name ILIKE $3 OR
                    category_path ILIKE $3 OR
                    description ILIKE $3
                )
                ORDER BY level, sort_order, name
                LIMIT 50
            `;

            const values = [companyId, includeGlobal, `%${searchTerm}%`];
            const result = await db.query(query, values);

            return result.rows;
        } catch (error) {
            logger.error('Error searching categories:', error);
            throw error;
        }
    }

    /**
     * Синхронизация с внешними системами
     */
    async syncWithExternal(externalSource, categories) {
        try {
            const results = [];

            for (const category of categories) {
                try {
                    // Ищем существующую категорию по внешнему ID
                    const existingQuery = `
                        SELECT id FROM categories
                        WHERE external_id = $1 AND external_source = $2
                    `;

                    const existingResult = await db.query(existingQuery, [category.external_id, externalSource]);

                    if (existingResult.rows.length > 0) {
                        // Обновляем существующую категорию
                        const updateQuery = `
                            UPDATE categories
                            SET
                                name = $1,
                                parent_id = $2,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = $3
                            RETURNING *
                        `;

                        const updateResult = await db.query(updateQuery, [
                            category.name,
                            category.parent_id,
                            existingResult.rows[0].id
                        ]);

                        results.push({
                            external_id: category.external_id,
                            action: 'updated',
                            data: updateResult.rows[0]
                        });
                    } else {
                        // Создаем новую категорию
                        const createQuery = `
                            INSERT INTO categories (
                                name, parent_id, external_id, external_source,
                                is_global, created_at
                            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                            RETURNING *
                        `;

                        const createResult = await db.query(createQuery, [
                            category.name,
                            category.parent_id,
                            category.external_id,
                            externalSource,
                            false
                        ]);

                        results.push({
                            external_id: category.external_id,
                            action: 'created',
                            data: createResult.rows[0]
                        });
                    }
                } catch (error) {
                    results.push({
                        external_id: category.external_id,
                        action: 'error',
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('Error syncing with external:', error);
            throw error;
        }
    }

    /**
     * Обновление путей категорий
     */
    async updateCategoryPaths() {
        try {
            // Вызываем функцию обновления путей
            await db.query('SELECT update_all_category_paths()');
        } catch (error) {
            logger.error('Error updating category paths:', error);
            throw error;
        }
    }

    /**
     * Получение статистики по категориям
     */
    async getCategoryStats(companyId) {
        try {
            const query = `
                SELECT
                    c.id,
                    c.name,
                    c.category_path,
                    c.level,
                    COUNT(p.id) as products_count,
                    COUNT(DISTINCT c2.id) as subcategories_count
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
                LEFT JOIN categories c2 ON c.id = c2.parent_id AND c2.is_active = true
                WHERE (c.company_id = $1 OR c.is_global = true)
                AND c.is_active = true
                GROUP BY c.id, c.name, c.category_path, c.level
                ORDER BY c.level, c.sort_order, c.name
            `;

            const result = await db.query(query, [companyId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting category stats:', error);
            throw error;
        }
    }
}

module.exports = new CategoryService();


