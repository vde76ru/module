const jwt = require('jsonwebtoken');
const UsersService = require('../services/UsersService');

const usersService = new UsersService();

// Проверка JWT токена
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'No authorization header'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Проверяем, является ли это API ключом
    if (token.startsWith('tk_')) {
      try {
        const apiKeyData = await usersService.validateAPIKey(token);
        req.user = {
          tenantId: apiKeyData.tenant_id,
          permissions: apiKeyData.permissions,
          isApiKey: true
        };
        return next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }
    }
    
    // Проверяем JWT токен
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

// Проверка прав доступа
const checkPermission = (permission) => {
  return (req, res, next) => {
    // Администраторы имеют все права
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Для API ключей проверяем разрешения
    if (req.user.isApiKey) {
      if (req.user.permissions.includes(permission) || 
          req.user.permissions.includes('*')) {
        return next();
      }
    }
    
    // Проверяем роли для обычных пользователей
    const rolePermissions = {
      manager: [
        'products.read',
        'products.create',
        'products.update',
        'orders.read',
        'sync.execute'
      ],
      viewer: [
        'products.read',
        'orders.read'
      ]
    };
    
    const userPermissions = rolePermissions[req.user.role] || [];
    
    if (userPermissions.includes(permission)) {
      return next();
    }
    
    res.status(403).json({
      success: false,
      error: 'Insufficient permissions'
    });
  };
};

// Rate limiting для API
const rateLimiter = (requests = 100, windowMs = 60000) => {
  const requests_map = new Map();
  
  return async (req, res, next) => {
    const key = req.user?.tenantId || req.ip;
    const now = Date.now();
    
    if (!requests_map.has(key)) {
      requests_map.set(key, []);
    }
    
    const timestamps = requests_map.get(key);
    const recentRequests = timestamps.filter(t => t > now - windowMs);
    
    if (recentRequests.length >= requests) {
      // Логируем превышение для биллинга
      if (req.user?.tenantId) {
        await db.mainPool.query(`
          INSERT INTO api_logs (tenant_id, endpoint, status, ip)
          VALUES ($1, $2, 'rate_limited', $3)
        `, [req.user.tenantId, req.originalUrl, req.ip]);
      }
      
      return res.status(429).json({
        success: false,
        error: 'Too many requests'
      });
    }
    
    recentRequests.push(now);
    requests_map.set(key, recentRequests);
    
    // Логируем успешный запрос
    if (req.user?.tenantId) {
      await db.mainPool.query(`
        INSERT INTO api_logs (tenant_id, endpoint, status, ip)
        VALUES ($1, $2, 'success', $3)
      `, [req.user.tenantId, req.originalUrl, req.ip]);
    }
    
    next();
  };
};

module.exports = {
  authenticate,
  checkPermission,
  rateLimiter
};
