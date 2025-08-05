// ===================================================
// ФАЙЛ: backend/src/middleware/auth.js
// ИСПРАВЛЕННАЯ ВЕРСИЯ: Полностью рабочая RBAC система
// ===================================================

const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Middleware для аутентификации
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    // Получаем полную информацию о пользователе с ролью
    const result = await db.query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.name, u.phone,
        u.company_id, u.is_active, u.last_activity, u.role,
        u.role_id, r.name as role_name, r.display_name as role_display_name,
        c.name as company_name, c.plan as company_plan, 
        c.subscription_status as company_status, c.settings as company_settings
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1 AND u.is_active = true
    `, [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
        code: 'USER_INACTIVE'
      });
    }

    const user = result.rows[0];

    // Проверяем компанию из токена
    if (decoded.companyId && user.company_id !== decoded.companyId) {
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
 * Middleware для проверки разрешений (RBAC) - ПОЛНОСТЬЮ ИСПРАВЛЕН
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

    // Если нет role_id, но есть старое поле role - используем его для обратной совместимости
    let effectiveRoleId = roleId;
    if (!effectiveRoleId && req.user.role) {
      try {
        const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', [req.user.role]);
        if (roleResult.rows.length > 0) {
          effectiveRoleId = roleResult.rows[0].id;
        }
      } catch (error) {
        console.error('Error finding role by name:', error);
      }
    }

    if (!effectiveRoleId) {
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
      `, [effectiveRoleId, requiredPermission]);

      if (permissionResult.rows.length > 0) {
        return next();
      }
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Internal server error during permission check' 
      });
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