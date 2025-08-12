// backend/src/services/AttributeService.js
// Сервис для управления атрибутами товаров (глобальные, локальные, маппинг)

const db = require('../config/database');
const { logger } = require('../utils/logger');

class AttributeService {
    /**
     * Получение всех атрибутов для компании
     */
    async getAllAttributes(companyId, filters = {}) {
        try {
            let query = `
                SELECT
                    pa.*,
                    c.name as category_name,
                    c.category_path,
                    av.values_array,
                    asyn.synonyms_array
                FROM product_attributes pa
                LEFT JOIN categories c ON pa.category_id = c.id
                LEFT JOIN (
                    SELECT
                        attribute_id,
                        ARRAY_AGG(value ORDER BY sort_order) as values_array
                    FROM attribute_values
                    WHERE is_active = true
                    GROUP BY attribute_id
                ) av ON pa.id = av.attribute_id
                LEFT JOIN (
                    SELECT
                        attribute_id,
                        ARRAY_AGG(synonym) as synonyms_array
                    FROM attribute_synonyms
                    WHERE is_active = true
                    GROUP BY attribute_id
                ) asyn ON pa.id = asyn.attribute_id
                WHERE (pa.company_id = $1 OR pa.is_global = true)
                AND pa.is_active = true
            `;

            const params = [companyId];
            let paramIndex = 2;

            if (filters.category_id) {
                query += ` AND pa.category_id = $${paramIndex}`;
                params.push(filters.category_id);
                paramIndex++;
            }

            if (filters.attribute_type) {
                query += ` AND pa.attribute_type = $${paramIndex}`;
                params.push(filters.attribute_type);
                paramIndex++;
            }

            if (filters.is_global !== undefined) {
                query += ` AND pa.is_global = $${paramIndex}`;
                params.push(filters.is_global);
                paramIndex++;
            }

            if (filters.search) {
                query += ` AND (
                    pa.name ILIKE $${paramIndex} OR
                    pa.description ILIKE $${paramIndex}
                )`;
                params.push(`%${filters.search}%`);
                paramIndex++;
            }

            query += ` ORDER BY pa.sort_order, pa.name`;

            if (filters.limit) {
                query += ` LIMIT $${paramIndex}`;
                params.push(filters.limit);
                paramIndex++;
            }

            if (filters.offset) {
                query += ` OFFSET $${paramIndex}`;
                params.push(filters.offset);
            }

            const result = await db.query(query, params);
            return result.rows;
        } catch (error) {
            logger.error('Error getting attributes:', error);
            throw error;
        }
    }

    /**
     * Получение атрибута по ID
     */
    async getAttributeById(attributeId, companyId) {
        try {
            const query = `
                SELECT
                    pa.*,
                    c.name as category_name,
                    c.category_path,
                    av.values_array,
                    asyn.synonyms_array
                FROM product_attributes pa
                LEFT JOIN categories c ON pa.category_id = c.id
                LEFT JOIN (
                    SELECT
                        attribute_id,
                        ARRAY_AGG(value ORDER BY sort_order) as values_array
                    FROM attribute_values
                    WHERE is_active = true
                    GROUP BY attribute_id
                ) av ON pa.id = av.attribute_id
                LEFT JOIN (
                    SELECT
                        attribute_id,
                        ARRAY_AGG(synonym) as synonyms_array
                    FROM attribute_synonyms
                    WHERE is_active = true
                    GROUP BY attribute_id
                ) asyn ON pa.id = asyn.attribute_id
                WHERE pa.id = $1
                AND (pa.company_id = $2 OR pa.is_global = true)
                AND pa.is_active = true
            `;

            const result = await db.query(query, [attributeId, companyId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting attribute by ID:', error);
            throw error;
        }
    }

    /**
     * Создание глобального атрибута
     */
    async createGlobalAttribute(attributeData, createdBy) {
        try {
            const query = `
                INSERT INTO product_attributes (
                    name, description, attribute_type, category_id, is_global,
                    is_required, validation_rules, default_value, unit,
                    sort_order, external_id, external_source, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `;

            const values = [
                attributeData.name,
                attributeData.description || null,
                attributeData.attribute_type || 'text',
                attributeData.category_id || null,
                true, // is_global
                attributeData.is_required || false,
                attributeData.validation_rules ? JSON.stringify(attributeData.validation_rules) : '{}',
                attributeData.default_value || null,
                attributeData.unit || null,
                attributeData.sort_order || 0,
                attributeData.external_id || null,
                attributeData.external_source || null,
                createdBy
            ];

            const result = await db.query(query, values);

            // Создаем значения атрибута если они переданы
            if (attributeData.values && Array.isArray(attributeData.values)) {
                await this.createAttributeValues(result.rows[0].id, attributeData.values);
            }

            // Создаем синонимы если они переданы
            if (attributeData.synonyms && Array.isArray(attributeData.synonyms)) {
                await this.createAttributeSynonyms(result.rows[0].id, attributeData.synonyms);
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating global attribute:', error);
            throw error;
        }
    }

    /**
     * Создание локального атрибута
     */
    async createLocalAttribute(companyId, attributeData, createdBy) {
        try {
            const query = `
                INSERT INTO product_attributes (
                    company_id, name, description, attribute_type, category_id,
                    global_attribute_id, is_global, is_required, validation_rules,
                    default_value, unit, sort_order, external_id, external_source, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *
            `;

            const values = [
                companyId,
                attributeData.name,
                attributeData.description || null,
                attributeData.attribute_type || 'text',
                attributeData.category_id || null,
                attributeData.global_attribute_id || null,
                false, // is_global
                attributeData.is_required || false,
                attributeData.validation_rules ? JSON.stringify(attributeData.validation_rules) : '{}',
                attributeData.default_value || null,
                attributeData.unit || null,
                attributeData.sort_order || 0,
                attributeData.external_id || null,
                attributeData.external_source || null,
                createdBy
            ];

            const result = await db.query(query, values);

            // Создаем значения атрибута если они переданы
            if (attributeData.values && Array.isArray(attributeData.values)) {
                await this.createAttributeValues(result.rows[0].id, attributeData.values);
            }

            // Создаем синонимы если они переданы
            if (attributeData.synonyms && Array.isArray(attributeData.synonyms)) {
                await this.createAttributeSynonyms(result.rows[0].id, attributeData.synonyms);
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating local attribute:', error);
            throw error;
        }
    }

    /**
     * Обновление атрибута
     */
    async updateAttribute(attributeId, updateData, updatedBy, companyId) {
        try {
            // Проверяем права на редактирование
            const checkQuery = `
                SELECT id, is_global, company_id
                FROM product_attributes
                WHERE id = $1
            `;

            const checkResult = await db.query(checkQuery, [attributeId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Attribute not found');
            }

            const attribute = checkResult.rows[0];

            // Проверяем права на редактирование
            if (!attribute.is_global && attribute.company_id !== companyId) {
                throw new Error('Access denied');
            }

            const query = `
                UPDATE product_attributes
                SET
                    name = COALESCE($1, name),
                    description = COALESCE($2, description),
                    attribute_type = COALESCE($3, attribute_type),
                    category_id = COALESCE($4, category_id),
                    global_attribute_id = COALESCE($5, global_attribute_id),
                    is_required = COALESCE($6, is_required),
                    validation_rules = COALESCE($7, validation_rules),
                    default_value = COALESCE($8, default_value),
                    unit = COALESCE($9, unit),
                    sort_order = COALESCE($10, sort_order),
                    external_id = COALESCE($11, external_id),
                    external_source = COALESCE($12, external_source),
                    updated_at = CURRENT_TIMESTAMP,
                    updated_by = $13
                WHERE id = $14
                RETURNING *
            `;

            const values = [
                updateData.name,
                updateData.description,
                updateData.attribute_type,
                updateData.category_id,
                updateData.global_attribute_id,
                updateData.is_required,
                updateData.validation_rules ? JSON.stringify(updateData.validation_rules) : null,
                updateData.default_value,
                updateData.unit,
                updateData.sort_order,
                updateData.external_id,
                updateData.external_source,
                updatedBy,
                attributeId
            ];

            const result = await db.query(query, values);

            // Обновляем значения атрибута если они переданы
            if (updateData.values && Array.isArray(updateData.values)) {
                await this.updateAttributeValues(attributeId, updateData.values);
            }

            // Обновляем синонимы если они переданы
            if (updateData.synonyms && Array.isArray(updateData.synonyms)) {
                await this.updateAttributeSynonyms(attributeId, updateData.synonyms);
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating attribute:', error);
            throw error;
        }
    }

    /**
     * Удаление атрибута
     */
    async deleteAttribute(attributeId, companyId) {
        try {
            // Проверяем права на удаление
            const checkQuery = `
                SELECT id, is_global, company_id
                FROM product_attributes
                WHERE id = $1
            `;

            const checkResult = await db.query(checkQuery, [attributeId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Attribute not found');
            }

            const attribute = checkResult.rows[0];

            // Проверяем права на удаление
            if (!attribute.is_global && attribute.company_id !== companyId) {
                throw new Error('Access denied');
            }

            // Проверяем, используется ли атрибут в товарах
            const usageQuery = `
                SELECT COUNT(*) as count
                FROM product_attribute_values
                WHERE attribute_id = $1
            `;

            const usageResult = await db.query(usageQuery, [attributeId]);

            if (parseInt(usageResult.rows[0].count) > 0) {
                throw new Error('Cannot delete attribute that is used in products');
            }

            // Удаляем атрибут
            const deleteQuery = `
                DELETE FROM product_attributes
                WHERE id = $1
            `;

            await db.query(deleteQuery, [attributeId]);

            return { success: true, message: 'Attribute deleted successfully' };
        } catch (error) {
            logger.error('Error deleting attribute:', error);
            throw error;
        }
    }

    /**
     * Создание значений атрибута
     */
    async createAttributeValues(attributeId, values) {
        try {
            for (const value of values) {
                const query = `
                    INSERT INTO attribute_values (
                        attribute_id, value, is_default, sort_order
                    ) VALUES ($1, $2, $3, $4)
                    ON CONFLICT (attribute_id, value) DO NOTHING
                `;

                await db.query(query, [
                    attributeId,
                    value.value,
                    value.is_default || false,
                    value.sort_order || 0
                ]);
            }
        } catch (error) {
            logger.error('Error creating attribute values:', error);
            throw error;
        }
    }

    /**
     * Обновление значений атрибута
     */
    async updateAttributeValues(attributeId, values) {
        try {
            // Удаляем старые значения
            await db.query('DELETE FROM attribute_values WHERE attribute_id = $1', [attributeId]);

            // Создаем новые значения
            await this.createAttributeValues(attributeId, values);
        } catch (error) {
            logger.error('Error updating attribute values:', error);
            throw error;
        }
    }

    /**
     * Создание синонимов атрибута
     */
    async createAttributeSynonyms(attributeId, synonyms) {
        try {
            for (const synonym of synonyms) {
                const query = `
                    INSERT INTO attribute_synonyms (
                        attribute_id, synonym, language
                    ) VALUES ($1, $2, $3)
                    ON CONFLICT (attribute_id, synonym, language) DO NOTHING
                `;

                await db.query(query, [
                    attributeId,
                    synonym.synonym,
                    synonym.language || 'ru'
                ]);
            }
        } catch (error) {
            logger.error('Error creating attribute synonyms:', error);
            throw error;
        }
    }

    /**
     * Обновление синонимов атрибута
     */
    async updateAttributeSynonyms(attributeId, synonyms) {
        try {
            // Удаляем старые синонимы
            await db.query('DELETE FROM attribute_synonyms WHERE attribute_id = $1', [attributeId]);

            // Создаем новые синонимы
            await this.createAttributeSynonyms(attributeId, synonyms);
        } catch (error) {
            logger.error('Error updating attribute synonyms:', error);
            throw error;
        }
    }

    /**
     * Автоматический маппинг атрибутов
     */
    async autoMapAttributes(companyId, supplierId, externalAttributes) {
        try {
            const results = [];

            for (const externalAttr of externalAttributes) {
                try {
                    // Ищем похожие атрибуты по названию и синонимам
                    const searchQuery = `
                        SELECT
                            pa.id,
                            pa.name,
                            pa.attribute_type,
                            pa.confidence_score,
                            CASE
                                WHEN pa.name ILIKE $1 THEN 1.0
                                WHEN pa.name ILIKE $2 THEN 0.9
                                WHEN pa.name ILIKE $3 THEN 0.8
                                ELSE 0.5
                            END as name_similarity,
                            CASE
                                WHEN EXISTS (
                                    SELECT 1 FROM attribute_synonyms
                                    WHERE attribute_id = pa.id
                                    AND synonym ILIKE $1
                                ) THEN 0.9
                                ELSE 0.0
                            END as synonym_similarity
                        FROM product_attributes pa
                        WHERE (pa.company_id = $4 OR pa.is_global = true)
                        AND pa.is_active = true
                        AND (
                            pa.name ILIKE $1 OR
                            pa.name ILIKE $2 OR
                            pa.name ILIKE $3 OR
                            EXISTS (
                                SELECT 1 FROM attribute_synonyms
                                WHERE attribute_id = pa.id
                                AND synonym ILIKE $1
                            )
                        )
                        ORDER BY
                            GREATEST(name_similarity, synonym_similarity) DESC,
                            pa.confidence_score DESC
                        LIMIT 5
                    `;

                    const searchPatterns = [
                        externalAttr.name,
                        `%${externalAttr.name}%`,
                        `${externalAttr.name}%`
                    ];

                    const searchResult = await db.query(searchQuery, [
                        ...searchPatterns,
                        companyId
                    ]);

                    if (searchResult.rows.length > 0) {
                        const bestMatch = searchResult.rows[0];
                        const confidenceScore = Math.max(
                            bestMatch.name_similarity,
                            bestMatch.synonym_similarity
                        );

                        // Сохраняем маппинг в истории
                        await this.saveMappingHistory(
                            companyId,
                            supplierId,
                            externalAttr.name,
                            bestMatch.id,
                            confidenceScore,
                            'auto'
                        );

                        results.push({
                            external_name: externalAttr.name,
                            internal_id: bestMatch.id,
                            internal_name: bestMatch.name,
                            confidence_score: confidenceScore,
                            mapped: true
                        });
                    } else {
                        results.push({
                            external_name: externalAttr.name,
                            mapped: false,
                            reason: 'No similar attributes found'
                        });
                    }
                } catch (error) {
                    results.push({
                        external_name: externalAttr.name,
                        mapped: false,
                        reason: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('Error auto mapping attributes:', error);
            throw error;
        }
    }

    /**
     * Сохранение истории маппинга
     */
    async saveMappingHistory(companyId, supplierId, externalName, internalId, confidenceScore, mappingType) {
        try {
            const query = `
                INSERT INTO attribute_mapping_history (
                    company_id, supplier_id, external_attribute_name,
                    internal_attribute_id, confidence_score, mapping_type
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `;

            await db.query(query, [
                companyId,
                supplierId,
                externalName,
                internalId,
                confidenceScore,
                mappingType
            ]);
        } catch (error) {
            logger.error('Error saving mapping history:', error);
            throw error;
        }
    }

    /**
     * Получение шаблонов атрибутов для категории
     */
    async getAttributeTemplates(categoryId, companyId) {
        try {
            const query = `
                SELECT
                    at.*,
                    at.attributes as template_attributes
                FROM attribute_templates at
                WHERE (at.category_id = $1 OR at.is_global = true)
                AND at.is_active = true
                ORDER BY at.is_global DESC, at.name
            `;

            const result = await db.query(query, [categoryId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting attribute templates:', error);
            throw error;
        }
    }

    /**
     * Применение шаблона атрибутов к товару
     */
    async applyAttributeTemplate(productId, templateId, companyId) {
        try {
            // Получаем шаблон
            const templateQuery = `
                SELECT attributes FROM attribute_templates
                WHERE id = $1 AND is_active = true
            `;

            const templateResult = await db.query(templateQuery, [templateId]);

            if (templateResult.rows.length === 0) {
                throw new Error('Template not found');
            }

            const template = templateResult.rows[0];
            const attributes = template.attributes || [];

            // Применяем атрибуты к товару
            for (const attr of attributes) {
                const attrQuery = `
                    INSERT INTO product_attribute_values (
                        product_id, attribute_id, value, created_at
                    ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                    ON CONFLICT (product_id, attribute_id) DO UPDATE SET
                        value = EXCLUDED.value,
                        updated_at = CURRENT_TIMESTAMP
                `;

                await db.query(attrQuery, [
                    productId,
                    attr.attribute_id,
                    attr.default_value || ''
                ]);
            }

            return { success: true, attributes_applied: attributes.length };
        } catch (error) {
            logger.error('Error applying attribute template:', error);
            throw error;
        }
    }
}

module.exports = AttributeService;
