// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// ========================================
// RATE LIMITING (простая реализация)
// ========================================

const rateLimitStore = new Map();

/**
 * Простой rate limiter без внешних зависимостей
 * @param {number} maxRequests - Максимальное количество запросов
 * @param {number} windowMs - Окно времени в миллисекундах
 * @returns {Function} Express middleware
 */
function rateLimiter(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Получаем или создаем записи для клиента
    if (!rateLimitStore.has(clientId)) {
      rateLimitStore.set(clientId, []);
    }

    const requests = rateLimitStore.get(clientId);

    // Удаляем старые записи
    const validRequests = requests.filter(time => time > windowStart);
    rateLimitStore.set(clientId, validRequests);

    // Проверяем лимит
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000),
        limit: maxRequests,
        window: windowMs
      });
    }

    // Добавляем текущий запрос
    validRequests.push(now);

    // Добавляем заголовки rate limit
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - validRequests.length),
      'X-RateLimit-Reset': new Date(windowStart + windowMs).toISOString()
    });

    next();
  };
}

// Очистка старых записей каждые 5 минут
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);

  for (const [clientId, requests] of rateLimitStore.entries()) {
    const validRequests = requests.filter(time => time > fiveMinutesAgo);
    if (validRequests.length === 0) {
      rateLimitStore.delete(clientId);
    } else {
      rateLimitStore.set(clientId, validRequests);
    }
  }
}, 5 * 60 * 1000);

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================

/**
 * Middleware для проверки JWT токена
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format',
        code: 'TOKEN_INVALID_FORMAT'
      });
    }

    try {
      // Верифицируем JWT токен
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded.userId || !decoded.tenantId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token payload',
          code: 'TOKEN_INVALID_PAYLOAD'
        });
      }

      // Проверяем существование пользователя и тенанта
      const userResult = await db.query(`
        SELECT
          u.id,
          u.email,
          u.role,
          u.name,
          u.is_active,
          u.tenant_id,
          u.last_login,
          u.created_at,
          t.id as tenant_id,
          t.name as tenant_name,
          t.db_schema,
          t.status as tenant_status,
          t.settings as tenant_settings
        FROM users u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE u.id = $1 AND u.is_active = true AND t.status = 'active'
      `, [decoded.userId]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'User not found or inactive',
          code: 'USER_NOT_FOUND'
        });
      }

      const user = userResult.rows[0];

      // Проверяем, что tenantId в токене соответствует пользователю
      if (user.tenant_id !== decoded.tenantId) {
        return res.status(401).json({
          success: false,
          error: 'Token tenant mismatch',
          code: 'TENANT_MISMATCH'
        });
      }

      // Добавляем информацию о пользователе к запросу
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        tenantId: user.tenant_id,
        tenantSchema: user.db_schema,
        tenantName: user.tenant_name,
        tenantStatus: user.tenant_status,
        tenantSettings: user.tenant_settings || {},
        lastLogin: user.last_login,
        createdAt: user.created_at
      };

      // Устанавливаем схему тенанта для последующих запросов
      req.tenantSchema = user.db_schema;

      next();

    } catch (jwtError) {
      let errorCode = 'TOKEN_INVALID';
      let errorMessage = 'Invalid token';

      if (jwtError.name === 'TokenExpiredError') {
        errorCode = 'TOKEN_EXPIRED';
        errorMessage = 'Token expired';
      } else if (jwtError.name === 'JsonWebTokenError') {
        errorCode = 'TOKEN_MALFORMED';
        errorMessage = 'Malformed token';
      } else if (jwtError.name === 'NotBeforeError') {
        errorCode = 'TOKEN_NOT_ACTIVE';
        errorMessage = 'Token not active';
      }

      return res.status(401).json({
        success: false,
        error: errorMessage,
        code: errorCode
      });
    }

  } catch (error) {
    console.error('Authentication middleware error:', error);

    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
}

// ========================================
// AUTHORIZATION MIDDLEWARE
// ========================================

/**
 * Middleware для проверки прав доступа по ролям
 * @param {string|Array} allowedRoles - Разрешенные роли
 * @returns {Function} Express middleware
 */
function checkRole(allowedRoles) {
  if (typeof allowedRoles === 'string') {
    allowedRoles = [allowedRoles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
}

/**
 * Middleware для проверки конкретных разрешений
 * @param {string} permission - Требуемое разрешение
 * @returns {Function} Express middleware
 */
function checkPermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role;

    // Администраторы имеют все права
    if (userRole === 'admin' || userRole === 'super_admin') {
      return next();
    }

    // Простая система разрешений на основе ролей
    const rolePermissions = {
      manager: [
        'products.read', 'products.create', 'products.update',
        'orders.read', 'orders.create', 'orders.update',
        'warehouses.read', 'warehouses.create', 'warehouses.update',
        'suppliers.read', 'suppliers.create', 'suppliers.update',
        'sync.read', 'sync.create',
        'analytics.read'
      ],
      operator: [
        'products.read', 'products.update',
        'orders.read', 'orders.update',
        'warehouses.read', 'warehouses.update',
        'sync.read'
      ],
      viewer: [
        'products.read',
        'orders.read',
        'warehouses.read',
        'analytics.read'
      ]
    };

    const userPermissions = rolePermissions[userRole] || [];

    if (!userPermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        code: 'PERMISSION_DENIED',
        requiredPermission: permission,
        userRole: userRole
      });
    }

    next();
  };
}

// ========================================
// TENANT ISOLATION MIDDLEWARE
// ========================================

/**
 * Middleware для обеспечения изоляции тенантов
 */
function ensureTenantIsolation(req, res, next) {
  if (!req.user || !req.user.tenantSchema) {
    return res.status(401).json({
      success: false,
      error: 'Tenant information missing',
      code: 'TENANT_MISSING'
    });
  }

  // Добавляем функцию для получения пула тенанта
  req.getTenantPool = () => db.getTenantPool(req.user.tenantSchema);

  next();
}

// ========================================
// OPTIONAL AUTHENTICATION
// ========================================

/**
 * Middleware для опциональной аутентификации
 * Не возвращает ошибку если токена нет, но проверяет его если есть
 */
async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Продолжаем без аутентификации
  }

  // Если токен есть, используем обычную аутентификацию
  return authenticate(req, res, next);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Генерирует JWT токен
 * @param {Object} payload - Данные для токена
 * @param {string} expiresIn - Время жизни токена
 * @returns {string} JWT токен
 */
function generateToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * Генерирует refresh токен
 * @param {Object} payload - Данные для токена
 * @returns {string} Refresh токен
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

/**
 * Верифицирует refresh токен
 * @param {string} token - Refresh токен
 * @returns {Object} Декодированные данные
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  rateLimiter,
  authenticate,
  optionalAuthenticate,
  checkRole,
  checkPermission,
  ensureTenantIsolation,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};