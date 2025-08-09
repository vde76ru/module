// ===================================================
// ФАЙЛ: backend/src/services/AuditService.js
// ПОЛНАЯ РЕАЛИЗАЦИЯ: Система аудита и логирования действий
// ===================================================

const db = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class AuditService {
  /**
   * Логирование действия пользователя
   */
  async logAction(actionData) {
    try {
      const {
        companyId,
        userId,
        sessionId,
        action,
        entityType = null,
        entityId = null,
        description = null,
        oldValues = null,
        newValues = null,
        ipAddress = null,
        userAgent = null,
        success = true,
        errorMessage = null,
        metadata = null
      } = actionData;

      // Получаем ID типа действия
      const actionTypeResult = await db.query(
        'SELECT id FROM audit_action_types WHERE code = $1',
        [action]
      );

      let actionTypeId;
      if (actionTypeResult.rows.length === 0) {
        // Создаем новый тип действия если не найден
        const newActionTypeResult = await db.query(`
          INSERT INTO audit_action_types (name, code, description, category, is_system)
          VALUES ($1, $2, $3, 'custom', false)
          RETURNING id
        `, [action, action, `Автоматически созданное действие: ${action}`]);

        actionTypeId = newActionTypeResult.rows[0].id;
      } else {
        actionTypeId = actionTypeResult.rows[0].id;
      }

      // Вычисляем изменения
      const changes = this.calculateChanges(oldValues, newValues);

      // Создаем запись в логе аудита
      const auditLogResult = await db.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action_type_id, entity_type, entity_id,
          old_values, new_values, success, ip_address, user_agent,
          session_id, description, metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
        ) RETURNING id
      `, [
        companyId,
        userId,
        actionTypeId,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        success,
        ipAddress,
        userAgent,
        sessionId,
        description,
        metadata ? JSON.stringify(metadata) : null
      ]);

      const logId = auditLogResult.rows[0].id;

      // Обновляем активность сессии если сессия указана
      if (sessionId) {
        await this.updateSessionActivity(sessionId);
      }

      logger.debug(`Audit log created: ${action} by user ${userId} (log ID: ${logId})`);
      return logId;

    } catch (error) {
      logger.error('Error creating audit log:', error);
      // Не прерываем основной процесс из-за ошибки аудита
      return null;
    }
  }

  /**
   * Создание или обновление сессии пользователя
   */
  async createOrUpdateSession(sessionData) {
    try {
      const {
        sessionId,
        companyId,
        userId,
        ipAddress,
        userAgent
      } = sessionData;

      await db.query(`
        INSERT INTO audit_sessions (
          session_id, company_id, user_id, ip_address, user_agent,
          login_time, last_activity, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, NOW(), NOW(), true
        )
        ON CONFLICT (session_id)
        DO UPDATE SET
          last_activity = NOW(),
          is_active = true,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          updated_at = NOW()
      `, [sessionId, companyId, userId, ipAddress, userAgent]);

      return sessionId;

    } catch (error) {
      logger.error('Error creating/updating session:', error);
      return null;
    }
  }

  /**
   * Обновление активности сессии
   */
  async updateSessionActivity(sessionId) {
    try {
      await db.query(
        'UPDATE audit_sessions SET last_activity = NOW(), updated_at = NOW() WHERE session_id = $1',
        [sessionId]
      );
    } catch (error) {
      logger.error('Error updating session activity:', error);
    }
  }

  /**
   * Завершение сессии
   */
  async endSession(sessionId) {
    try {
      await db.query(`
        UPDATE audit_sessions
        SET logout_time = NOW(), is_active = false, updated_at = NOW()
        WHERE session_id = $1
      `, [sessionId]);

      // Логируем завершение сессии
      const sessionResult = await db.query(
        'SELECT company_id, user_id FROM audit_sessions WHERE session_id = $1',
        [sessionId]
      );

      if (sessionResult.rows.length > 0) {
        const { company_id, user_id } = sessionResult.rows[0];
        await this.logAction({
          companyId: company_id,
          userId: user_id,
          sessionId,
          action: 'user.logout',
          description: 'Пользователь завершил сессию',
          success: true
        });
      }

    } catch (error) {
      logger.error('Error ending session:', error);
    }
  }

  /**
   * Получение логов аудита с фильтрацией
   */
  async getAuditLogs(companyId, filters = {}) {
    try {
      let query = `
        SELECT
          al.id, al.created_at, al.entity_type, al.entity_id,
          al.description, al.success, al.ip_address,
          aat.name as action_name, aat.code as action_code, aat.category as action_category,
          aat.severity as action_severity,
          u.name as user_name, u.email as user_email,
          al.old_values, al.new_values, al.metadata
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        JOIN audit_action_types aat ON al.action_type_id = aat.id
        WHERE al.company_id = $1
      `;

      const params = [companyId];
      let paramIndex = 2;

      // Применяем фильтры
      if (filters.userId) {
        query += ` AND al.user_id = $${paramIndex}`;
        params.push(filters.userId);
        paramIndex++;
      }

      if (filters.action) {
        query += ` AND aat.code = $${paramIndex}`;
        params.push(filters.action);
        paramIndex++;
      }

      if (filters.actionCategory) {
        query += ` AND aat.category = $${paramIndex}`;
        params.push(filters.actionCategory);
        paramIndex++;
      }

      if (filters.entityType) {
        query += ` AND al.entity_type = $${paramIndex}`;
        params.push(filters.entityType);
        paramIndex++;
      }

      if (filters.entityId) {
        query += ` AND al.entity_id = $${paramIndex}`;
        params.push(filters.entityId);
        paramIndex++;
      }

      if (filters.success !== undefined) {
        query += ` AND al.success = $${paramIndex}`;
        params.push(filters.success);
        paramIndex++;
      }

      if (filters.severity) {
        query += ` AND aat.severity = $${paramIndex}`;
        params.push(filters.severity);
        paramIndex++;
      }

      if (filters.ipAddress) {
        query += ` AND al.ip_address = $${paramIndex}`;
        params.push(filters.ipAddress);
        paramIndex++;
      }

      if (filters.dateFrom) {
        query += ` AND al.created_at >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters.dateTo) {
        query += ` AND al.created_at <= $${paramIndex}`;
        params.push(filters.dateTo);
        paramIndex++;
      }

      if (filters.search) {
        query += ` AND (
          al.description ILIKE $${paramIndex} OR
          u.name ILIKE $${paramIndex} OR
          aat.name ILIKE $${paramIndex}
        )`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      // Сортировка и пагинация
      query += ` ORDER BY al.created_at DESC`;

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      // Подсчет общего количества записей
      let countQuery = `
        SELECT COUNT(*) as total
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        JOIN audit_action_types aat ON al.action_type_id = aat.id
        WHERE al.company_id = $1
      `;

      // Применяем те же фильтры для подсчета
      const countParams = params.slice(0, -2); // убираем limit и offset
      const countResult = await db.query(countQuery + query.substring(query.indexOf('AND'), query.indexOf('ORDER BY')), countParams);

      return {
        logs: result.rows.map(row => ({
          ...row,
          old_values: row.old_values ? JSON.parse(row.old_values) : null,
          new_values: row.new_values ? JSON.parse(row.new_values) : null,
          metadata: row.metadata ? JSON.parse(row.metadata) : null
        })),
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      };

    } catch (error) {
      logger.error('Error getting audit logs:', error);
      throw error;
    }
  }

  /**
   * Получение статистики аудита
   */
  async getAuditStats(companyId, days = 30) {
    try {
      const result = await db.query(
        'SELECT * FROM get_audit_stats($1, $2)',
        [companyId, days]
      );

      return result.rows[0] || {
        total_actions: 0,
        unique_users: 0,
        failed_actions: 0,
        success_rate: 0,
        top_actions: [],
        activity_by_hour: []
      };

    } catch (error) {
      logger.error('Error getting audit stats:', error);
      throw error;
    }
  }

  /**
   * Получение логов по сущности
   */
  async getEntityAuditTrail(companyId, entityType, entityId, options = {}) {
    try {
      const limit = options.limit || 100;
      const result = await db.query(`
        SELECT
          al.id, al.created_at, al.description,
          al.old_values, al.new_values,
          aat.name as action_name, aat.severity,
          u.name as user_name, u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        JOIN audit_action_types aat ON al.action_type_id = aat.id
        WHERE al.company_id = $1
          AND al.entity_type = $2
          AND al.entity_id = $3
        ORDER BY al.created_at DESC
        LIMIT $4
      `, [companyId, entityType, entityId, limit]);

      return result.rows.map(row => ({
        ...row,
        old_values: row.old_values ? JSON.parse(row.old_values) : null,
        new_values: row.new_values ? JSON.parse(row.new_values) : null
      }));

    } catch (error) {
      logger.error('Error getting entity audit trail:', error);
      throw error;
    }
  }

  /**
   * Очистка старых логов
   */
  async cleanupOldLogs(retentionDays = 365) {
    try {
      const result = await db.query(
        'SELECT cleanup_old_audit_logs($1)',
        [retentionDays]
      );

      const deletedCount = result.rows[0].cleanup_old_audit_logs;
      logger.info(`Cleaned up ${deletedCount} old audit logs (older than ${retentionDays} days)`);

      return deletedCount;

    } catch (error) {
      logger.error('Error cleaning up old audit logs:', error);
      throw error;
    }
  }

  /**
   * Вычисление изменений между старыми и новыми значениями
   */
  calculateChanges(oldValues, newValues) {
    if (!oldValues || !newValues) {
      return null;
    }

    const changes = {};

    // Обрабатываем новые и измененные поля
    for (const key in newValues) {
      if (newValues[key] !== oldValues[key]) {
        changes[key] = {
          from: oldValues[key],
          to: newValues[key],
          type: oldValues[key] === undefined ? 'added' : 'changed'
        };
      }
    }

    // Обрабатываем удаленные поля
    for (const key in oldValues) {
      if (!(key in newValues)) {
        changes[key] = {
          from: oldValues[key],
          to: undefined,
          type: 'removed'
        };
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Создание middleware для автоматического логирования
   */
  createAuditMiddleware() {
    return (req, res, next) => {
      // Сохраняем оригинальные методы
      const originalSend = res.send;
      const originalJson = res.json;

      // Данные для аудита
      const auditData = {
        companyId: req.user?.companyId,
        userId: req.user?.id,
        sessionId: req.sessionID || req.headers['x-session-id'],
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        requestParams: {
          query: req.query,
          body: this.sanitizeRequestBody(req.body),
          params: req.params
        }
      };

      // Переопределяем методы ответа для захвата результата
      res.send = function(body) {
        res.locals.responseBody = body;
        return originalSend.call(this, body);
      };

      res.json = function(body) {
        res.locals.responseBody = body;
        return originalJson.call(this, body);
      };

      // Логируем после завершения ответа
      res.on('finish', () => {
        // Определяем действие на основе маршрута и метода
        const action = this.determineAction(req);

        if (action && auditData.companyId) {
          this.logAction({
            ...auditData,
            action,
            success: res.statusCode < 400,
            errorMessage: res.statusCode >= 400 ? res.locals.responseBody : null,
            metadata: {
              statusCode: res.statusCode,
              responseTime: Date.now() - req.startTime
            }
          }).catch(error => {
            logger.error('Error in audit middleware:', error);
          });
        }
      });

      next();
    };
  }

  /**
   * Определение действия на основе HTTP запроса
   */
  determineAction(req) {
    const { method, route } = req;
    const path = route?.path || req.path;

    // Мапинг маршрутов к действиям
    const actionMappings = {
      'POST /api/auth/login': 'user.login',
      'POST /api/auth/logout': 'user.logout',
      'POST /api/products': 'product.create',
      'PUT /api/products/:id': 'product.update',
      'DELETE /api/products/:id': 'product.delete',
      'POST /api/suppliers': 'supplier.create',
      'PUT /api/suppliers/:id': 'supplier.update',
      'DELETE /api/suppliers/:id': 'supplier.delete',
      'POST /api/users': 'user.create',
      'PUT /api/users/:id': 'user.update',
      'DELETE /api/users/:id': 'user.delete'
    };

    const key = `${method} ${path}`;
    return actionMappings[key] || null;
  }

  /**
   * Санитизация тела запроса (удаление чувствительных данных)
   */
  sanitizeRequestBody(body) {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credentials'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

module.exports = new AuditService();