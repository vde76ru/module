// ===================================================
// ФАЙЛ: backend/src/routes/audit.js
// МАРШРУТЫ ДЛЯ ПРОСМОТРА И УПРАВЛЕНИЯ ЛОГАМИ АУДИТА
// ===================================================

const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const AuditService = require('../services/AuditService');

// Получение логов аудита с фильтрацией
router.get('/', authenticate, checkPermission('audit.view'), async (req, res) => {
  try {
    const filters = {
      userId: req.query.user_id ? parseInt(req.query.user_id) : null,
      action: req.query.action,
      actionCategory: req.query.action_category,
      entityType: req.query.entity_type,
      entityId: req.query.entity_id,
      success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
      severity: req.query.severity,
      ipAddress: req.query.ip_address,
      dateFrom: req.query.date_from ? new Date(req.query.date_from) : null,
      dateTo: req.query.date_to ? new Date(req.query.date_to) : null,
      tags: req.query.tags ? req.query.tags.split(',') : null,
      search: req.query.search,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const result = await AuditService.getAuditLogs(req.user.companyId, filters);

    res.json({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        pages: Math.ceil(result.total / result.limit)
      }
    });

  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение статистики аудита
router.get('/stats', authenticate, checkPermission('audit.view'), async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 30;
    const stats = await AuditService.getAuditStats(req.user.companyId, days);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting audit stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение логов по конкретной сущности (аудит-трейл)
router.get('/entity/:entityType/:entityId', authenticate, checkPermission('audit.view'), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    const logs = await AuditService.getEntityAuditTrail(
      req.user.companyId,
      entityType,
      entityId,
      { limit }
    );

    res.json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error('Error getting entity audit trail:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение деталей конкретного лога аудита
router.get('/:logId', authenticate, checkPermission('audit.view'), async (req, res) => {
  try {
    const { logId } = req.params;

    const result = await AuditService.getAuditLogs(req.user.companyId, {
      limit: 1,
      offset: 0
    });

    const log = result.logs.find(l => l.id.toString() === logId);

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }

    res.json({
      success: true,
      data: log
    });

  } catch (error) {
    console.error('Error getting audit log details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Экспорт логов аудита
router.get('/export/:format', authenticate, checkPermission('audit.export'), async (req, res) => {
  try {
    const { format } = req.params;

    if (!['csv', 'json', 'xlsx'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported export format. Use csv, json, or xlsx'
      });
    }

    // Получаем все логи для экспорта (с ограничением)
    const filters = {
      dateFrom: req.query.date_from ? new Date(req.query.date_from) : null,
      dateTo: req.query.date_to ? new Date(req.query.date_to) : null,
      limit: 10000 // ограничиваем экспорт
    };

    const result = await AuditService.getAuditLogs(req.user.companyId, filters);

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.json`);
      res.setHeader('Content-Type', 'application/json');
      res.json(result.logs);
    } else if (format === 'csv') {
      // Простой CSV экспорт
      const csvData = convertToCSV(result.logs);
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
      res.setHeader('Content-Type', 'text/csv');
      res.send(csvData);
    } else {
      // XLSX потребует дополнительную библиотеку
      res.status(501).json({
        success: false,
        error: 'XLSX export not implemented yet'
      });
    }

  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Очистка старых логов (только для администраторов)
router.post('/cleanup', authenticate, checkPermission('audit.manage'), async (req, res) => {
  try {
    const retentionDays = req.body.retention_days || 365;

    if (retentionDays < 30) {
      return res.status(400).json({
        success: false,
        error: 'Retention period cannot be less than 30 days'
      });
    }

    const deletedCount = await AuditService.cleanupOldLogs(retentionDays);

    res.json({
      success: true,
      data: {
        deleted_count: deletedCount,
        retention_days: retentionDays
      }
    });

  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение типов действий для фильтров
router.get('/actions/types', authenticate, checkPermission('audit.view'), async (req, res) => {
  try {
    const db = require('../config/database');
    
    const result = await db.query(`
      SELECT 
        name, display_name, description, category, severity
      FROM audit_action_types 
      WHERE is_active = true 
      ORDER BY category, display_name
    `);

    const actionTypes = result.rows.reduce((acc, type) => {
      if (!acc[type.category]) {
        acc[type.category] = [];
      }
      acc[type.category].push({
        name: type.name,
        display_name: type.display_name,
        description: type.description,
        severity: type.severity
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: actionTypes
    });

  } catch (error) {
    console.error('Error getting action types:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Служебная функция для конвертации в CSV
function convertToCSV(logs) {
  if (logs.length === 0) {
    return 'No data';
  }

  const headers = [
    'ID', 'Дата/Время', 'Пользователь', 'Действие', 'Тип сущности', 
    'ID сущности', 'Название сущности', 'Описание', 'Успешно', 'IP адрес'
  ];

  const csvRows = [
    headers.join(','),
    ...logs.map(log => [
      log.id,
      log.created_at,
      log.user_name || 'Система',
      log.action_display,
      log.entity_type || '',
      log.entity_id || '',
      log.entity_name || '',
      `"${(log.description || '').replace(/"/g, '""')}"`,
      log.success ? 'Да' : 'Нет',
      log.ip_address || ''
    ].join(','))
  ];

  return csvRows.join('\n');
}

module.exports = router;