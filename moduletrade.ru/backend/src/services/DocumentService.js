// backend/src/services/DocumentService.js
// Сервис для управления документами товаров (сертификаты, инструкции, спецификации)

const db = require('../config/database');
const { logger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class DocumentService {
    /**
     * Получение всех документов товара
     */
    async getProductDocuments(productId, companyId) {
        try {
            const query = `
                SELECT
                    pd.*,
                    s.name as supplier_name,
                    s.external_id as supplier_external_id,
                    u.name as created_by_name
                FROM product_documents pd
                LEFT JOIN suppliers s ON pd.supplier_id = s.id
                LEFT JOIN users u ON pd.created_by = u.id
                WHERE pd.product_id = $1
                AND pd.is_active = true
                ORDER BY pd.document_type, pd.created_at DESC
            `;

            const result = await db.query(query, [productId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting product documents:', error);
            throw error;
        }
    }

    /**
     * Получение документа по ID
     */
    async getDocumentById(documentId, companyId) {
        try {
            const query = `
                SELECT
                    pd.*,
                    p.name as product_name,
                    p.internal_code as product_code,
                    s.name as supplier_name,
                    u.name as created_by_name
                FROM product_documents pd
                JOIN products p ON pd.product_id = p.id
                LEFT JOIN suppliers s ON pd.supplier_id = s.id
                LEFT JOIN users u ON pd.created_by = u.id
                WHERE pd.id = $1
                AND p.company_id = $2
                AND pd.is_active = true
            `;

            const result = await db.query(query, [documentId, companyId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting document by ID:', error);
            throw error;
        }
    }

    /**
     * Создание документа товара
     */
    async createDocument(companyId, documentData, createdBy) {
        try {
            // Проверяем, что товар принадлежит компании
            const productCheck = await db.query(
                'SELECT id FROM products WHERE id = $1 AND company_id = $2',
                [documentData.product_id, companyId]
            );

            if (productCheck.rows.length === 0) {
                throw new Error('Product not found or access denied');
            }

            // Проверяем поставщика если указан
            if (documentData.supplier_id) {
                const supplierCheck = await db.query(
                    'SELECT id FROM suppliers WHERE id = $1 AND company_id = $2',
                    [documentData.supplier_id, companyId]
                );

                if (supplierCheck.rows.length === 0) {
                    throw new Error('Supplier not found or access denied');
                }
            }

            const query = `
                INSERT INTO product_documents (
                    product_id, document_type, name, file_url, external_url,
                    supplier_id, file_size, mime_type, metadata, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const values = [
                documentData.product_id,
                documentData.document_type,
                documentData.name,
                documentData.file_url || null,
                documentData.external_url || null,
                documentData.supplier_id || null,
                documentData.file_size || null,
                documentData.mime_type || null,
                documentData.metadata ? JSON.stringify(documentData.metadata) : '{}',
                createdBy
            ];

            const result = await db.query(query, values);

            // Обновляем поле documents в таблице products
            await this.updateProductDocumentsField(documentData.product_id);

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating document:', error);
            throw error;
        }
    }

    /**
     * Обновление документа
     */
    async updateDocument(documentId, updateData, updatedBy, companyId) {
        try {
            // Проверяем права на редактирование
            const checkQuery = `
                SELECT pd.id
                FROM product_documents pd
                JOIN products p ON pd.product_id = p.id
                WHERE pd.id = $1 AND p.company_id = $2
            `;

            const checkResult = await db.query(checkQuery, [documentId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Document not found or access denied');
            }

            const query = `
                UPDATE product_documents
                SET
                    name = COALESCE($1, name),
                    document_type = COALESCE($2, document_type),
                    file_url = COALESCE($3, file_url),
                    external_url = COALESCE($4, external_url),
                    supplier_id = COALESCE($5, supplier_id),
                    file_size = COALESCE($6, file_size),
                    mime_type = COALESCE($7, mime_type),
                    metadata = COALESCE($8, metadata),
                    updated_at = CURRENT_TIMESTAMP,
                    updated_by = $9
                WHERE id = $10
                RETURNING *
            `;

            const values = [
                updateData.name,
                updateData.document_type,
                updateData.file_url,
                updateData.external_url,
                updateData.supplier_id,
                updateData.file_size,
                updateData.mime_type,
                updateData.metadata ? JSON.stringify(updateData.metadata) : null,
                updatedBy,
                documentId
            ];

            const result = await db.query(query, values);

            // Обновляем поле documents в таблице products
            if (result.rows.length > 0) {
                await this.updateProductDocumentsField(result.rows[0].product_id);
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating document:', error);
            throw error;
        }
    }

    /**
     * Удаление документа
     */
    async deleteDocument(documentId, companyId) {
        try {
            // Проверяем права на удаление
            const checkQuery = `
                SELECT pd.id, pd.file_url, pd.product_id
                FROM product_documents pd
                JOIN products p ON pd.product_id = p.id
                WHERE pd.id = $1 AND p.company_id = $2
            `;

            const checkResult = await db.query(checkQuery, [documentId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Document not found or access denied');
            }

            const document = checkResult.rows[0];

            // Удаляем файл если он существует
            if (document.file_url) {
                await this.deleteDocumentFile(document.file_url);
            }

            // Удаляем запись из базы
            const deleteQuery = `
                DELETE FROM product_documents
                WHERE id = $1
            `;

            await db.query(deleteQuery, [documentId]);

            // Обновляем поле documents в таблице products
            await this.updateProductDocumentsField(document.product_id);

            return { success: true, message: 'Document deleted successfully' };
        } catch (error) {
            logger.error('Error deleting document:', error);
            throw error;
        }
    }

    /**
     * Массовое создание документов
     */
    async bulkCreateDocuments(companyId, documents, createdBy) {
        try {
            const results = [];

            for (const documentData of documents) {
                try {
                    const result = await this.createDocument(companyId, documentData, createdBy);
                    results.push({
                        name: documentData.name,
                        success: true,
                        data: result
                    });
                } catch (error) {
                    results.push({
                        name: documentData.name,
                        success: false,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('Error bulk creating documents:', error);
            throw error;
        }
    }

    /**
     * Загрузка документа с файла
     */
    async uploadDocument(companyId, productId, file, documentData, createdBy) {
        try {
            // Проверяем права на загрузку
            const productCheck = await db.query(
                'SELECT id FROM products WHERE id = $1 AND company_id = $2',
                [productId, companyId]
            );

            if (productCheck.rows.length === 0) {
                throw new Error('Product not found or access denied');
            }

            // Генерируем уникальное имя файла
            const fileExtension = path.extname(file.originalname);
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}${fileExtension}`;
            const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
            const filePath = path.join(uploadDir, fileName);

            // Создаем директорию если не существует
            await fs.mkdir(uploadDir, { recursive: true });

            // Сохраняем файл
            await fs.writeFile(filePath, file.buffer);

            // Создаем запись в базе
            const documentRecord = {
                ...documentData,
                product_id: productId,
                file_url: `/uploads/documents/${fileName}`,
                file_size: file.size,
                mime_type: file.mimetype
            };

            const result = await this.createDocument(companyId, documentRecord, createdBy);

            return result;
        } catch (error) {
            logger.error('Error uploading document:', error);
            throw error;
        }
    }

    /**
     * Синхронизация документов с поставщиком
     */
    async syncSupplierDocuments(companyId, supplierId, productId, externalDocuments) {
        try {
            const results = [];

            for (const extDoc of externalDocuments) {
                try {
                    // Проверяем, существует ли уже такой документ
                    const existingQuery = `
                        SELECT id FROM product_documents
                        WHERE product_id = $1
                        AND supplier_id = $2
                        AND external_url = $3
                    `;

                    const existingResult = await db.query(existingQuery, [
                        productId,
                        supplierId,
                        extDoc.url
                    ]);

                    if (existingResult.rows.length === 0) {
                        // Создаем новый документ
                        const documentData = {
                            product_id: productId,
                            document_type: extDoc.type || 'other',
                            name: extDoc.name || 'Document from supplier',
                            external_url: extDoc.url,
                            supplier_id: supplierId,
                            metadata: {
                                external_id: extDoc.id,
                                last_synced: new Date().toISOString(),
                                supplier_data: extDoc
                            }
                        };

                        const result = await this.createDocument(companyId, documentData, null);
                        results.push({
                            external_id: extDoc.id,
                            action: 'created',
                            data: result
                        });
                    } else {
                        // Обновляем существующий документ
                        const updateData = {
                            name: extDoc.name || 'Document from supplier',
                            metadata: {
                                external_id: extDoc.id,
                                last_synced: new Date().toISOString(),
                                supplier_data: extDoc
                            }
                        };

                        const result = await this.updateDocument(
                            existingResult.rows[0].id,
                            updateData,
                            null,
                            companyId
                        );

                        results.push({
                            external_id: extDoc.id,
                            action: 'updated',
                            data: result
                        });
                    }
                } catch (error) {
                    results.push({
                        external_id: extDoc.id,
                        action: 'error',
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('Error syncing supplier documents:', error);
            throw error;
        }
    }

    /**
     * Получение документов по типу
     */
    async getDocumentsByType(companyId, documentType, filters = {}) {
        try {
            let query = `
                SELECT
                    pd.*,
                    p.name as product_name,
                    p.internal_code as product_code,
                    s.name as supplier_name,
                    u.name as created_by_name
                FROM product_documents pd
                JOIN products p ON pd.product_id = p.id
                LEFT JOIN suppliers s ON pd.supplier_id = s.id
                LEFT JOIN users u ON pd.created_by = u.id
                WHERE pd.document_type = $1
                AND p.company_id = $2
                AND pd.is_active = true
            `;

            const params = [documentType, companyId];
            let paramIndex = 3;

            if (filters.supplier_id) {
                query += ` AND pd.supplier_id = $${paramIndex}`;
                params.push(filters.supplier_id);
                paramIndex++;
            }

            if (filters.search) {
                query += ` AND (
                    pd.name ILIKE $${paramIndex} OR
                    p.name ILIKE $${paramIndex}
                )`;
                params.push(`%${filters.search}%`);
                paramIndex++;
            }

            query += ` ORDER BY pd.created_at DESC`;

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
            logger.error('Error getting documents by type:', error);
            throw error;
        }
    }

    /**
     * Поиск документов
     */
    async searchDocuments(companyId, searchTerm, filters = {}) {
        try {
            let query = `
                SELECT
                    pd.*,
                    p.name as product_name,
                    p.internal_code as product_code,
                    s.name as supplier_name,
                    u.name as created_by_name
                FROM product_documents pd
                JOIN products p ON pd.product_id = p.id
                LEFT JOIN suppliers s ON pd.supplier_id = s.id
                LEFT JOIN users u ON pd.created_by = u.id
                WHERE p.company_id = $1
                AND pd.is_active = true
                AND (
                    pd.name ILIKE $2 OR
                    p.name ILIKE $2 OR
                    p.internal_code ILIKE $2 OR
                    s.name ILIKE $2
                )
            `;

            const params = [companyId, `%${searchTerm}%`];
            let paramIndex = 3;

            if (filters.document_type) {
                query += ` AND pd.document_type = $${paramIndex}`;
                params.push(filters.document_type);
                paramIndex++;
            }

            if (filters.supplier_id) {
                query += ` AND pd.supplier_id = $${paramIndex}`;
                params.push(filters.supplier_id);
                paramIndex++;
            }

            query += ` ORDER BY pd.created_at DESC`;

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
            logger.error('Error searching documents:', error);
            throw error;
        }
    }

    /**
     * Обновление поля documents в таблице products
     */
    async updateProductDocumentsField(productId) {
        try {
            const documentsQuery = `
                SELECT
                    id,
                    name,
                    document_type as type,
                    COALESCE(file_url, external_url) as url,
                    supplier_id,
                    created_at
                FROM product_documents
                WHERE product_id = $1 AND is_active = true
                ORDER BY created_at DESC
            `;

            const documentsResult = await db.query(documentsQuery, [productId]);

            const flatDocuments = documentsResult.rows.map(row => ({
                id: row.id,
                title: row.name,
                type: row.type,
                file_url: row.url && row.url.startsWith('/uploads/') ? row.url : null,
                external_url: row.url && !row.url.startsWith('/uploads/') ? row.url : null,
                supplier_id: row.supplier_id,
                created_at: row.created_at
            }));

            // Обновляем поле documents в таблице products (как массив)
            const updateQuery = `
                UPDATE products
                SET documents = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `;

            await db.query(updateQuery, [JSON.stringify(flatDocuments), productId]);

        } catch (error) {
            logger.error('Error updating product documents field:', error);
            throw error;
        }
    }

    /**
     * Удаление файла документа
     */
    async deleteDocumentFile(fileUrl) {
        try {
            if (fileUrl && fileUrl.startsWith('/uploads/')) {
                const filePath = path.join(process.cwd(), fileUrl.substring(1));
                await fs.unlink(filePath);
            }
        } catch (error) {
            logger.warn('Error deleting document file:', error);
            // Не прерываем выполнение если файл не найден
        }
    }

    /**
     * Получение статистики по документам
     */
    async getDocumentStats(companyId) {
        try {
            const query = `
                SELECT
                    pd.document_type,
                    COUNT(*) as total_count,
                    COUNT(CASE WHEN pd.supplier_id IS NOT NULL THEN 1 END) as supplier_documents,
                    COUNT(CASE WHEN pd.file_url IS NOT NULL THEN 1 END) as uploaded_files,
                    COUNT(CASE WHEN pd.external_url IS NOT NULL THEN 1 END) as external_links,
                    AVG(pd.file_size) as avg_file_size
                FROM product_documents pd
                JOIN products p ON pd.product_id = p.id
                WHERE p.company_id = $1 AND pd.is_active = true
                GROUP BY pd.document_type
                ORDER BY total_count DESC
            `;

            const result = await db.query(query, [companyId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting document stats:', error);
            throw error;
        }
    }
}

module.exports = DocumentService;
