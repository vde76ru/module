// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Middleware для проверки аутентификации
 */
const authenticate = async (req, res, next) => {
  try {
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7); // Убираем "Bearer "

    // Проверяем токен
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    // Проверяем, что пользователь существует и активен
    const userResult = await db.query(`
      SELECT
        u.id, u.email, u.name, u.phone, u.role, u.role_id, u.is_active,
        u.company_id, u.last_login, u.created_at, u.first_name, u.last_name,
        c.name as company_name, c.plan as company_plan, c.is_active as company_is_active,
        c.subscription_status as company_status, c.settings as company_settings,
        r.name as role_name, r.display_name as role_display_name
      FROM users u
      JOIN companies c ON u.company_id = c.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.rows[0];

    // Проверяем активность пользователя
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Account suspended',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    // Проверяем активность компании
    if (!user.company_is_active) {
      return res.status(403).json({
        success: false,
        error: 'Company account suspended',
        code: 'COMPANY_SUSPENDED'
      });
    }

    // Проверяем соответствие токена и компании
    if (decoded.companyId && decoded.companyId !== user.company_id) {
      return res.status(401).json({
        success: false,
        error: 'Token company mismatch',
        code: 'COMPANY_MISMATCH'
      });
    }

    // Добавляем информацию о пользователе к запросу
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,  // Старое поле для обратной совместимости
      roleId: user.role_id,  // Новое поле
      roleName: user.role_name,
      roleDisplayName: user.role_display_name,
      companyId: user.company_id,
      companyName: user.company_name,
      companyPlan: user.company_plan,
      companyStatus: user.company_status,
      companySettings: user.company_settings,
      isActive: user.is_active,
      firstName: user.first_name,
      lastName: user.last_name,
    };

    // Обновляем последнюю активность
    db.query(
      'UPDATE users SET last_activity = NOW() WHERE id = $1',
      [user.id]
    ).catch(err => console.error('Failed to update last activity:', err));

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};


/**
 * Middleware для проверки роли
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (roles.includes(req.user.role) || (req.user.roleName && roles.includes(req.user.roleName))) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
      code: 'FORBIDDEN'
    });
  };
};

/**
 * Middleware для проверки разрешений (RBAC) - ПЕРЕПИСАНА
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { roleName, roleId } = req.user;

    // Администраторы имеют все права по определению
    if (roleName === 'admin') {
      return next();
    }

    if (!roleId) {
        return res.status(403).json({
            success: false,
            error: 'User role not configured properly',
            code: 'FORBIDDEN'
        });
    }

    try {
      // Проверяем разрешения через RBAC систему
      const permissionResult = await db.query(`
        SELECT 1
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = $1 AND p.name = $2 AND p.is_active = true
        LIMIT 1
      `, [roleId, requiredPermission]);

      if (permissionResult.rows.length > 0) {
        return next();
      }
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error during permission check' });
    }

    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
      code: 'FORBIDDEN',
      required_permission: requiredPermission
    });
  };
};


/**
 * Middleware для опциональной аутентификации
 */
const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  return authenticate(req, res, next);
};

module.exports = {
  authenticate,
  checkRole,
  checkPermission,
  optionalAuthenticate
};