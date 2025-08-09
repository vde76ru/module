// backend/src/routes/dictionaries.js
const express = require('express');
const { authenticate, checkPermission } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// ========================================
// УНИВЕРСАЛЬНЫЙ ЭНДПОИНТ ДЛЯ СПРАВОЧНИКОВ
// ========================================

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: GET /api/dictionaries?type={type}
 * Универсальный роут для получения справочников по типу
 * Задача 0.2: Реализация базовой логики для API GET /api/dictionaries?type={type}
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, search = '', limit = 100, offset = 0 } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Dictionary type is required',
        supportedTypes: [
          'categories', 'brands', 'suppliers', 'warehouses',
          'marketplaces', 'units', 'currencies', 'roles'
        ]
      });
    }

    let result;

    switch (type) {
      case 'categories':
        result = await getDictionaryCategories(search, limit, offset);
        break;
      case 'brands':
        result = await getDictionaryBrands(search, limit, offset);
        break;
      case 'suppliers':
        result = await getDictionarySuppliers(req.user.companyId, search, limit, offset);
        break;
      case 'warehouses':
        result = await getDictionaryWarehouses(req.user.companyId, search, limit, offset);
        break;
      case 'marketplaces':
        result = await getDictionaryMarketplaces(search, limit, offset);
        break;
      case 'units':
        result = await getDictionaryUnits(search, limit, offset);
        break;
      case 'currencies':
        result = await getDictionaryCurrencies(search, limit, offset);
        break;
      case 'roles':
        result = await getDictionaryRoles(search, limit, offset);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported dictionary type: ${type}`,
          supportedTypes: [
            'categories', 'brands', 'suppliers', 'warehouses',
            'marketplaces', 'units', 'currencies', 'roles'
          ]
        });
    }

    res.json({
      success: true,
      type: type,
      data: result.data,
      pagination: result.pagination || null
    });

  } catch (error) {
    console.error('Get dictionary error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ========================================
// СПЕЦИАЛИЗИРОВАННЫЕ ЭНДПОИНТЫ
// ========================================

/**
 * GET /api/dictionaries/categories
 * Получение списка категорий товаров
 */
router.get('/categories', authenticate, async (req, res) => {
  try {
    const { search = '', limit = 100, parent_id = null } = req.query;

    const result = await getDictionaryCategories(search, limit, 0, parent_id);

    res.json({
      success: true,
      data: result.data
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
 * GET /api/dictionaries/brands
 * Получение списка брендов
 */
router.get('/brands', authenticate, async (req, res) => {
  try {
    const { search = '', limit = 100 } = req.query;

    const result = await getDictionaryBrands(search, limit, 0);

    res.json({
      success: true,
      data: result.data
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
 * GET /api/dictionaries/suppliers
 * Получение списка поставщиков
 */
router.get('/suppliers', authenticate, async (req, res) => {
  try {
    const { search = '', is_active = 'true', limit = 100 } = req.query;

    const result = await getDictionarySuppliers(
      req.user.companyId,
      search,
      limit,
      0,
      is_active === 'true'
    );

    res.json({
      success: true,
      data: result.data
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
 * GET /api/dictionaries/warehouses
 * Получение списка складов
 */
router.get('/warehouses', authenticate, async (req, res) => {
  try {
    const { search = '', is_active = 'true', limit = 100 } = req.query;

    const result = await getDictionaryWarehouses(
      req.user.companyId,
      search,
      limit,
      0,
      is_active === 'true'
    );

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/dictionaries/attributes
 * Получение списка атрибутов товаров
 */
router.get('/attributes', authenticate, async (req, res) => {
  try {
    const { search = '', limit = 100 } = req.query;

    const result = await getDictionaryAttributes(req.user.companyId, search, limit, 0);

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get attributes error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/dictionaries/roles
 * Получение списка ролей (только для администраторов)
 */
router.get('/roles', authenticate, checkPermission('users.view'), async (req, res) => {
  try {
    const { search = '', limit = 50 } = req.query;

    const result = await getDictionaryRoles(search, limit, 0);

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Получение справочника категорий
 */
async function getDictionaryCategories(search = '', limit = 100, offset = 0, parentId = null) {
  let whereConditions = [];
  const queryParams = [];
  let paramIndex = 1;

  if (search) {
    whereConditions.push(`(name ILIKE $${paramIndex} OR canonical_name ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (parentId !== null) {
    if (parentId === 'null' || parentId === '') {
      whereConditions.push('parent_id IS NULL');
    } else {
      whereConditions.push(`parent_id = $${paramIndex}`);
      queryParams.push(parentId);
      paramIndex++;
    }
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const query = `
    SELECT
      id,
      name,
      parent_id,
      path as description,
      created_at
    FROM categories
    ${whereClause}
    ORDER BY parent_id NULLS FIRST, name ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(query, queryParams);

  return {
    data: result.rows,
    pagination: {
      limit,
      offset,
      total: result.rows.length
    }
  };
}

/**
 * Получение справочника брендов
 */
async function getDictionaryBrands(search = '', limit = 100, offset = 0) {
  let whereConditions = [];
  const queryParams = [];
  let paramIndex = 1;

  if (search) {
    whereConditions.push(`(name ILIKE $${paramIndex} OR canonical_name ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const query = `
    SELECT
      id,
      name,
      created_at
    FROM brands
    ${whereClause}
    ORDER BY name ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(query, queryParams);

  return {
    data: result.rows,
    pagination: {
      limit,
      offset,
      total: result.rows.length
    }
  };
}

/**
 * Получение справочника поставщиков
 */
async function getDictionarySuppliers(companyId, search = '', limit = 100, offset = 0, isActive = true) {
  let whereConditions = ['company_id = $1'];
  const queryParams = [companyId];
  let paramIndex = 2;

  if (search) {
    whereConditions.push(`(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (isActive !== null) {
    whereConditions.push(`(api_config IS NOT NULL)`); // Простая проверка активности
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT
      id,
      name,
      code,
      contact_info,
      created_at
    FROM suppliers
    ${whereClause}
    ORDER BY name ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(query, queryParams);

  return {
    data: result.rows,
    pagination: {
      limit,
      offset,
      total: result.rows.length
    }
  };
}

/**
 * Получение справочника складов
 */
async function getDictionaryWarehouses(companyId, search = '', limit = 100, offset = 0, isActive = true) {
  let whereConditions = ['company_id = $1'];
  const queryParams = [companyId];
  let paramIndex = 2;

  if (search) {
    whereConditions.push(`name ILIKE $${paramIndex}`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (isActive !== null) {
    whereConditions.push(`is_active = $${paramIndex}`);
    queryParams.push(isActive);
    paramIndex++;
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT
      id,
      name,
      type,
      address,
      is_active,
      created_at
    FROM warehouses
    ${whereClause}
    ORDER BY name ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(query, queryParams);

  return {
    data: result.rows,
    pagination: {
      limit,
      offset,
      total: result.rows.length
    }
  };
}

/**
 * Получение справочника маркетплейсов
 */
async function getDictionaryMarketplaces(search = '', limit = 100, offset = 0) {
  let whereConditions = [];
  const queryParams = [];
  let paramIndex = 1;

  if (search) {
    whereConditions.push(`name ILIKE $${paramIndex}`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const query = `
    SELECT
      id,
      name,
      code,
      api_type,
      created_at
    FROM marketplaces
    ${whereClause}
    ORDER BY name ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(query, queryParams);

  return {
    data: result.rows,
    pagination: {
      limit,
      offset,
      total: result.rows.length
    }
  };
}

/**
 * Получение справочника единиц измерения
 */
async function getDictionaryUnits(search = '', limit = 100, offset = 0) {
  const units = [
    { id: 'шт', name: 'Штуки', category: 'quantity' },
    { id: 'кг', name: 'Килограммы', category: 'weight' },
    { id: 'г', name: 'Граммы', category: 'weight' },
    { id: 'л', name: 'Литры', category: 'volume' },
    { id: 'мл', name: 'Миллилитры', category: 'volume' },
    { id: 'м', name: 'Метры', category: 'length' },
    { id: 'см', name: 'Сантиметры', category: 'length' },
    { id: 'мм', name: 'Миллиметры', category: 'length' },
    { id: 'м2', name: 'Квадратные метры', category: 'area' },
    { id: 'м3', name: 'Кубические метры', category: 'volume' },
    { id: 'упак', name: 'Упаковки', category: 'package' }
  ];

  let filteredUnits = units;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredUnits = units.filter(unit =>
      unit.name.toLowerCase().includes(searchLower) ||
      unit.id.toLowerCase().includes(searchLower)
    );
  }

  const startIndex = offset;
  const endIndex = Math.min(startIndex + limit, filteredUnits.length);
  const paginatedUnits = filteredUnits.slice(startIndex, endIndex);

  return {
    data: paginatedUnits,
    pagination: {
      limit,
      offset,
      total: filteredUnits.length
    }
  };
}

/**
 * Получение справочника валют
 */
async function getDictionaryCurrencies(search = '', limit = 100, offset = 0) {
  const currencies = [
    { id: 'RUB', name: 'Российский рубль', symbol: '₽' },
    { id: 'USD', name: 'Доллар США', symbol: '$' },
    { id: 'EUR', name: 'Евро', symbol: '€' },
    { id: 'KZT', name: 'Тенге', symbol: '₸' },
    { id: 'BYN', name: 'Белорусский рубль', symbol: 'Br' },
    { id: 'UAH', name: 'Гривна', symbol: '₴' }
  ];

  let filteredCurrencies = currencies;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredCurrencies = currencies.filter(currency =>
      currency.name.toLowerCase().includes(searchLower) ||
      currency.id.toLowerCase().includes(searchLower)
    );
  }

  const startIndex = offset;
  const endIndex = Math.min(startIndex + limit, filteredCurrencies.length);
  const paginatedCurrencies = filteredCurrencies.slice(startIndex, endIndex);

  return {
    data: paginatedCurrencies,
    pagination: {
      limit,
      offset,
      total: filteredCurrencies.length
    }
  };
}

/**
 * Получение справочника атрибутов товаров
 */
async function getDictionaryAttributes(companyId, search = '', limit = 100, offset = 0) {
  try {
    const conditions = ['company_id = $1'];
    const params = [companyId];
    let paramIndex = 2;

    if (search) {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT id, name, code, type, description, is_filterable, is_searchable, sort_order, is_active, created_at
      FROM product_attributes
      ${whereClause}
      ORDER BY sort_order ASC, name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return {
      data: result.rows,
      total: result.rows.length
    };

  } catch (error) {
    console.error('getDictionaryAttributes error:', error);
    throw error;
  }
}

/**
 * Получение справочника ролей
 */
async function getDictionaryRoles(search = '', limit = 50, offset = 0) {
  let whereConditions = ['is_active = true'];
  const queryParams = [];
  let paramIndex = 1;

  if (search) {
    whereConditions.push(`(name ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT
      id,
      name,
      display_name,
      description,
      created_at
    FROM roles
    ${whereClause}
    ORDER BY
      CASE name
        WHEN 'admin' THEN 1
        WHEN 'manager' THEN 2
        WHEN 'operator' THEN 3
        WHEN 'viewer' THEN 4
        ELSE 5
      END,
      display_name ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(query, queryParams);

  return {
    data: result.rows,
    pagination: {
      limit,
      offset,
      total: result.rows.length
    }
  };
}

module.exports = router;