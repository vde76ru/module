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

    const result = await db.mainPool.query(`
      SELECT id, name, parent_id, description, created_at
      FROM product_categories
      WHERE tenant_id = $1
      ORDER BY parent_id NULLS FIRST, name ASC
    `, [tenantId]);

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