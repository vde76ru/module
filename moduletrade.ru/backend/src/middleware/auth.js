// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Middleware для аутентификации JWT токенов
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Проверяем существование пользователя
      const userResult = await db.mainPool.query(`
        SELECT u.*, t.db_schema 
        FROM users u
        JOIN tenants t ON u.tenant_id = t.id 
        WHERE u.id = $1 AND u.is_active = true
      `, [decoded.userId]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token - user not found'
        });
      }

      req.user = {
        ...userResult.rows[0],
        tenantId: userResult.rows[0].tenant_id
      };
      
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

/**
 * Middleware для проверки прав доступа
 */
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      // Простая проверка по ролям (можно расширить)
      const userRole = req.user.role;
      
      if (userRole === 'admin') {
        return next(); // Админы имеют все права
      }
      
      // Для других ролей можно добавить более сложную логику
      if (userRole === 'manager' && !permission.includes('delete')) {
        return next();
      }
      
      if (userRole === 'viewer' && permission.includes('read')) {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Permission check error'
      });
    }
  };
};

/**
 * Rate Limiter - собственная реализация без внешних зависимостей
 */
const rateLimiter = (maxRequests = 100, windowMs = 900000) => {
  const requests_map = new Map();
  
  return async (req, res, next) => {
    try {
      const key = req.user?.tenantId || req.ip;
      const now = Date.now();
      
      if (!requests_map.has(key)) {
        requests_map.set(key, []);
      }
      
      const timestamps = requests_map.get(key);
      const recentRequests = timestamps.filter(t => t > now - windowMs);
      
      if (recentRequests.length >= maxRequests) {
        // Логируем превышение для биллинга (если пользователь авторизован)
        if (req.user?.tenantId) {
          try {
            await db.mainPool.query(`
              INSERT INTO api_logs (tenant_id, endpoint, status, ip, created_at)
              VALUES ($1, $2, 'rate_limited', $3, NOW())
              ON CONFLICT DO NOTHING
            `, [req.user.tenantId, req.originalUrl, req.ip]);
          } catch (logError) {
            console.error('Failed to log rate limit:', logError);
          }
        }
        
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      recentRequests.push(now);
      requests_map.set(key, recentRequests);
      
      // Логируем успешный запрос (если пользователь авторизован)
      if (req.user?.tenantId) {
        try {
          await db.mainPool.query(`
            INSERT INTO api_logs (tenant_id, endpoint, status, ip, created_at)
            VALUES ($1, $2, 'success', $3, NOW())
            ON CONFLICT DO NOTHING
          `, [req.user.tenantId, req.originalUrl, req.ip]);
        } catch (logError) {
          console.error('Failed to log API request:', logError);
        }
      }
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next(); // Пропускаем в случае ошибки, чтобы не блокировать весь API
    }
  };
};

/**
 * Cleanup функция для очистки старых записей rate limiter
 */
const cleanupRateLimit = () => {
  const requests_map = rateLimiter.requests_map;
  if (requests_map) {
    const now = Date.now();
    const windowMs = 900000; // 15 минут
    
    for (const [key, timestamps] of requests_map.entries()) {
      const recentRequests = timestamps.filter(t => t > now - windowMs);
      if (recentRequests.length === 0) {
        requests_map.delete(key);
      } else {
        requests_map.set(key, recentRequests);
      }
    }
  }
};

// Запускаем очистку каждые 5 минут
setInterval(cleanupRateLimit, 5 * 60 * 1000);

module.exports = {
  authenticate,
  checkPermission,
  rateLimiter
};