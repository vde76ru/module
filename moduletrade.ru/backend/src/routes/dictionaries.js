// backend/src/routes/dictionaries.js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

/**
 * GET /api/dictionaries/categories
 * Получение списка категорий товаров
 */
router.get('/categories', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // ✅ ИСПРАВЛЕНО: Изменена таблица с product_categories на categories
    // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
    const result = await db.query(`
      SELECT 
        id, 
        canonical_name as name, 
        parent_id, 
        path as description, 
        created_at
      FROM categories
      ORDER BY parent_id NULLS FIRST, canonical_name ASC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: GET /api/dictionaries/brands
 * Получение списка брендов
 */
router.get('/brands', authenticate, async (req, res) => {
  try {
    const { search = '', limit = 100 } = req.query;

    let query = `
      SELECT 
        id, 
        canonical_name as name,
        created_at
      FROM brands
    `;
    
    const queryParams = [];
    let paramIndex = 1;

    if (search) {
      query += ` WHERE canonical_name ILIKE $${paramIndex}`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY canonical_name ASC LIMIT $${paramIndex}`;
    queryParams.push(limit);

    // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
    const result = await db.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: GET /api/dictionaries/suppliers
 * Получение списка поставщиков
 */
router.get('/suppliers', authenticate, async (req, res) => {
  try {
    const { search = '', is_active = null, limit = 100 } = req.query;

    let whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (is_active !== null) {
      // Предполагаем, что у поставщиков может быть поле is_active
      whereConditions.push(`(api_config IS NOT NULL)`); // Простая проверка активности
    }

    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        id,
        code,
        name,
        api_type,
        is_main,
        priority,
        created_at
      FROM suppliers
      ${whereClause}
      ORDER BY priority DESC, name ASC
      LIMIT $${paramIndex}
    `;

    queryParams.push(limit);

    // ✅ ИСПРАВЛЕНО: Удален tenantId из вызова db.query
    const result = await db.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/dictionaries/units
 * Получение списка единиц измерения
 */
router.get('/units', authenticate, async (req, res) => {
  try {
    const units = [
      { id: 'pcs', name: 'Штук', short: 'шт' },
      { id: 'kg', name: 'Килограмм', short: 'кг' },
      { id: 'g', name: 'Грамм', short: 'г' },
      { id: 'l', name: 'Литр', short: 'л' },
      { id: 'ml', name: 'Миллилитр', short: 'мл' },
      { id: 'm', name: 'Метр', short: 'м' },
      { id: 'cm', name: 'Сантиметр', short: 'см' },
      { id: 'box', name: 'Коробка', short: 'кор' },
      { id: 'pack', name: 'Упаковка', short: 'уп' },
      { id: 'pair', name: 'Пара', short: 'пар' }
    ];

    res.json({
      success: true,
      data: units
    });

  } catch (error) {
    console.error('Get units error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/dictionaries/statuses
 * Получение списка статусов
 */
router.get('/statuses', authenticate, async (req, res) => {
  try {
    const { type = 'order' } = req.query;

    const statuses = {
      order: [
        { id: 'new', name: 'Новый', color: '#1890ff' },
        { id: 'processing', name: 'В обработке', color: '#faad14' },
        { id: 'confirmed', name: 'Подтвержден', color: '#52c41a' },
        { id: 'packed', name: 'Упакован', color: '#13c2c2' },
        { id: 'shipped', name: 'Отправлен', color: '#2f54eb' },
        { id: 'delivered', name: 'Доставлен', color: '#52c41a' },
        { id: 'cancelled', name: 'Отменен', color: '#f5222d' },
        { id: 'returned', name: 'Возврат', color: '#fa541c' }
      ],
      product: [
        { id: 'active', name: 'Активный', color: '#52c41a' },
        { id: 'inactive', name: 'Неактивный', color: '#d9d9d9' },
        { id: 'out_of_stock', name: 'Нет в наличии', color: '#f5222d' },
        { id: 'low_stock', name: 'Мало на складе', color: '#faad14' },
        { id: 'discontinued', name: 'Снят с производства', color: '#8c8c8c' }
      ],
      warehouse: [
        { id: 'active', name: 'Активный', color: '#52c41a' },
        { id: 'inactive', name: 'Неактивный', color: '#d9d9d9' },
        { id: 'maintenance', name: 'На обслуживании', color: '#faad14' }
      ]
    };

    res.json({
      success: true,
      data: statuses[type] || []
    });

  } catch (error) {
    console.error('Get statuses error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/dictionaries/countries
 * Получение списка стран
 */
router.get('/countries', authenticate, async (req, res) => {
  try {
    const countries = [
      { id: 'RU', name: 'Россия', code: 'RU' },
      { id: 'CN', name: 'Китай', code: 'CN' },
      { id: 'US', name: 'США', code: 'US' },
      { id: 'DE', name: 'Германия', code: 'DE' },
      { id: 'IT', name: 'Италия', code: 'IT' },
      { id: 'FR', name: 'Франция', code: 'FR' },
      { id: 'KR', name: 'Южная Корея', code: 'KR' },
      { id: 'JP', name: 'Япония', code: 'JP' },
      { id: 'TR', name: 'Турция', code: 'TR' },
      { id: 'IN', name: 'Индия', code: 'IN' }
    ];

    res.json({
      success: true,
      data: countries
    });

  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;