// backend/src/routes/jobs.js
const express = require('express');
const { authenticate, checkRole } = require('../middleware/auth');
const db = require('../config/database');
const cron = require('node-cron');
const scheduler = require('../jobs/scheduler');

const router = express.Router();

// Перечень поддерживаемых типов задач
const ALLOWED_TYPES = new Set([
  'import',              // импорт товаров (можно указать supplier_id, brand_ids)
  'supplier-prices',     // обновление цен от поставщика (supplier_id, product_ids)
  'supplier-stocks',     // обновление остатков от поставщика (supplier_id, product_ids, warehouse_id)
  'prices',              // пересчет цен по правилам
  'analytics',
  'subscriptions',
  'marketplaces',        // полная синхронизация МП (или конкретный marketplace_id)
  'export',              // экспорт данных в файл с фильтрами
  'popularity',
  'cache-cleanup',
  'log-cleanup',
]);

// GET /api/jobs/schedules — список расписаний текущей компании
router.get('/schedules', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const result = await db.query(`
      SELECT id, schedule_name, schedule_type, cron_expression, is_active, last_run, next_run, settings
      FROM sync_schedules
      WHERE company_id = $1
      ORDER BY schedule_name ASC
    `, [companyId]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to list schedules:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/jobs/schedules — создать расписание
router.post('/schedules', authenticate, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { schedule_name, schedule_type, cron_expression, is_active = true, settings = {} } = req.body;

    if (!schedule_name || !schedule_type || !cron_expression) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (!ALLOWED_TYPES.has(schedule_type)) {
      return res.status(400).json({ success: false, error: 'Unsupported schedule_type' });
    }
    if (!cron.validate(cron_expression)) {
      return res.status(400).json({ success: false, error: 'Invalid cron expression' });
    }

    const result = await db.query(`
      INSERT INTO sync_schedules (company_id, schedule_name, schedule_type, cron_expression, is_active, settings)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [companyId, schedule_name, schedule_type, cron_expression, is_active, JSON.stringify(settings)]);

    // Перепланировать
    await scheduler.rescheduleAll();

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Failed to create schedule:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/jobs/schedules/:id — обновить расписание
router.put('/schedules/:id', authenticate, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { schedule_name, schedule_type, cron_expression, is_active, settings } = req.body;

    // Загружаем текущее
    const current = await db.query(`
      SELECT * FROM sync_schedules WHERE id = $1 AND company_id = $2
    `, [id, companyId]);
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    // Валидации
    if (schedule_type && !ALLOWED_TYPES.has(schedule_type)) {
      return res.status(400).json({ success: false, error: 'Unsupported schedule_type' });
    }
    if (cron_expression && !cron.validate(cron_expression)) {
      return res.status(400).json({ success: false, error: 'Invalid cron expression' });
    }

    const updated = await db.query(`
      UPDATE sync_schedules
      SET
        schedule_name = COALESCE($1, schedule_name),
        schedule_type = COALESCE($2, schedule_type),
        cron_expression = COALESCE($3, cron_expression),
        is_active = COALESCE($4, is_active),
        settings = COALESCE($5, settings),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND company_id = $7
      RETURNING *
    `, [
      schedule_name || null,
      schedule_type || null,
      cron_expression || null,
      typeof is_active === 'boolean' ? is_active : null,
      settings ? JSON.stringify(settings) : null,
      id,
      companyId,
    ]);

    await scheduler.rescheduleAll();

    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    console.error('Failed to update schedule:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/jobs/schedules/:id — удалить расписание
router.delete('/schedules/:id', authenticate, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM sync_schedules
      WHERE id = $1 AND company_id = $2
      RETURNING id
    `, [id, companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    await scheduler.rescheduleAll();

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Failed to delete schedule:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/jobs/run-now — немедленный запуск (по типу)
router.post('/run-now', authenticate, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { job, schedule_type } = req.body;

    const mapTypeToJobName = (type) => ({
      'import': 'product-import',
      'prices': 'price-update',
      'analytics': 'analytics',
      'subscriptions': 'subscription-check',
      'marketplaces': 'marketplace-sync',
      'popularity': 'popularity-update',
      'cache-cleanup': 'cache-cleanup',
      'log-cleanup': 'log-cleanup',
    })[type];

    const jobName = job || mapTypeToJobName(schedule_type);
    if (!jobName) {
      return res.status(400).json({ success: false, error: 'Specify job or schedule_type' });
    }

    await scheduler.runJobImmediately(jobName);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to run job immediately:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/jobs/start — запустить планировщик (после настройки)
router.post('/start', authenticate, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    await scheduler.start();
    return res.json({ success: true, data: scheduler.getJobStatus() });
  } catch (error) {
    console.error('Failed to start scheduler:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/jobs/stop — остановить планировщик
router.post('/stop', authenticate, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    await scheduler.stop();
    return res.json({ success: true, data: scheduler.getJobStatus() });
  } catch (error) {
    console.error('Failed to stop scheduler:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;


