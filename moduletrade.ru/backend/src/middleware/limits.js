// backend/src/middleware/limits.js
const db = require('../config/database');
let redisClient = null;
try {
  const redis = require('../config/redis');
  // создадим клиента лениво внутри middleware
  redisClient = redis;
} catch (_) {}

async function getCompanyTariffLimits(companyId) {
  const res = await db.query(`
    SELECT COALESCE(t.limits, '{}'::jsonb) AS limits
    FROM companies c
    LEFT JOIN tariffs t ON c.tariff_id = t.id
    WHERE c.id = $1
  `, [companyId]);
  return res.rows[0]?.limits || {};
}

function enforceResourceLimit(resource) {
  return async (req, res, next) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(401).json({ success: false, error: 'Not authenticated' });

      const limits = await getCompanyTariffLimits(companyId);
      const maxAllowed = limits?.[resource];
      if (!maxAllowed || Number(maxAllowed) <= 0) {
        return next(); // лимит не задан — не ограничиваем
      }

      let countQuery;
      switch (resource) {
        case 'products':
          countQuery = `SELECT COUNT(*)::int AS cnt FROM products WHERE company_id = $1`;
          break;
        case 'users':
          countQuery = `SELECT COUNT(*)::int AS cnt FROM users WHERE company_id = $1`;
          break;
        default:
          return next();
      }

      const result = await db.query(countQuery, [companyId]);
      const current = result.rows[0]?.cnt || 0;
      if (current >= maxAllowed) {
        return res.status(403).json({ success: false, error: `Limit exceeded for ${resource}` });
      }
      next();
    } catch (error) {
      console.error('enforceResourceLimit error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

function apiCallsLimit() {
  return async (req, res, next) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId || !redisClient || !redisClient.set) {
        return next();
      }

      const limits = await getCompanyTariffLimits(companyId);
      const dailyLimit = limits?.api_calls;
      if (!dailyLimit || Number(dailyLimit) <= 0) return next();

      const dateKey = new Date().toISOString().slice(0, 10);
      const key = `api_calls:${companyId}:${dateKey}`;

      // инициализируем Redis клиент при необходимости
      if (!redisClient.client) {
        try { await redisClient.createRedisClient(); } catch(_) {}
      }

      const current = await redisClient.get(key);
      const currentVal = Number(current || 0);
      if (currentVal >= dailyLimit) {
        return res.status(429).json({ success: false, error: 'API calls limit exceeded' });
      }

      const ttl = 24 * 60 * 60; // сутки
      await redisClient.set(key, String(currentVal + 1), ttl);
      next();
    } catch (error) {
      console.warn('apiCallsLimit error (non-blocking):', error.message);
      next();
    }
  };
}

module.exports = {
  enforceResourceLimit,
  apiCallsLimit,
  getCompanyTariffLimits,
};


