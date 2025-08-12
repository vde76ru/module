// ===================================================
// ФАЙЛ: backend/src/middleware/audit.js
// MIDDLEWARE ДЛЯ АВТОМАТИЧЕСКОГО АУДИТА ДЕЙСТВИЙ
// ===================================================

const AuditService = require('../services/AuditService');
const logger = require('../utils/logger');

/**
 * Middleware для автоматического логирования действий пользователей
 */
const auditMiddleware = (options = {}) => {
  return async (req, res, next) => {
    // Пропускаем запросы к статическим файлам и health check
    if (req.url.includes('/static/') || req.url === '/api/health') {
      return next();
    }

    // Добавляем время начала запроса
    req.startTime = Date.now();

    // Сохраняем оригинальные методы ответа
    const originalSend = res.send;
    const originalJson = res.json;

    // Данные для аудита
    const auditData = {
      companyId: req.user?.companyId || req.user?.company_id,
      userId: req.user?.id || req.user?.userId,
      sessionId: req.sessionID || req.headers['x-session-id'] || req.user?.sessionId,
      ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      requestParams: {
        query: sanitizeObject(req.query),
        body: sanitizeObject(req.body),
        params: req.params
      }
    };

    // Переопределяем методы ответа для захвата результата
    res.send = function(body) {
      res.locals.responseBody = body;
      res.locals.responseData = body;
      return originalSend.call(this, body);
    };

    res.json = function(body) {
      res.locals.responseBody = body;
      res.locals.responseData = body;
      return originalJson.call(this, body);
    };

    // Логируем после завершения ответа
    res.on('finish', async () => {
      try {
        // Определяем действие на основе маршрута и метода
        const action = determineAction(req);

        if (action && auditData.companyId) {
          // Извлекаем дополнительную информацию из ответа
          const entityInfo = extractEntityInfo(req, res.locals.responseData);

          await AuditService.logAction({
            ...auditData,
            action,
            entityType: entityInfo.entityType,
            entityId: entityInfo.entityId,
            entityName: entityInfo.entityName,
            description: generateDescription(action, req, entityInfo),
            oldValues: entityInfo.oldValues,
            newValues: entityInfo.newValues,
            success: res.statusCode < 400,
            errorMessage: res.statusCode >= 400 ? getErrorMessage(res.locals.responseData) : null,
            metadata: {
              statusCode: res.statusCode,
              responseTime: Date.now() - req.startTime,
              userAgent: auditData.userAgent,
              route: req.route?.path
            },
            tags: generateTags(action, req)
          });
        }
      } catch (error) {
        logger.error('Error in audit middleware:', error);
      }
    });

    next();
  };
};

/**
 * Middleware для логирования входа в систему
 */
const auditLogin = async (req, res, next) => {
  const originalJson = res.json;

  res.json = function(body) {
    // Если вход успешный, логируем
    if (body.success && body.data?.user) {
      const user = body.data.user;

      AuditService.logAction({
        companyId: user.company_id,
        userId: user.id,
        sessionId: req.sessionID || req.headers['x-session-id'],
        action: 'user.login',
        description: `Пользователь ${user.name} (${user.email}) вошел в систему`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        success: true,
        metadata: {
          userRole: user.role,
          loginMethod: 'password'
        },
        tags: ['authentication', 'login']
      }).catch(error => {
        logger.error('Error logging login audit:', error);
      });

      // Создаем или обновляем сессию
      const sessionId = req.sessionID || req.headers['x-session-id'] || `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      AuditService.createOrUpdateSession({
        sessionId,
        companyId: user.company_id,
        userId: user.id,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      }).catch(error => {
        logger.error('Error creating audit session:', error);
      });
    } else {
      // Логируем неудачную попытку входа
      AuditService.logAction({
        companyId: null, // неизвестно
        userId: null,
        sessionId: req.sessionID,
        action: 'user.login_failed',
        description: `Неудачная попытка входа с email: ${req.body.email}`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        success: false,
        errorMessage: body.error || 'Invalid credentials',
        metadata: {
          attemptedEmail: req.body.email
        },
        tags: ['authentication', 'login_failed', 'security']
      }).catch(error => {
        logger.error('Error logging failed login audit:', error);
      });
    }

    return originalJson.call(this, body);
  };

  next();
};

/**
 * Middleware для логирования выхода из системы
 */
const auditLogout = async (req, res, next) => {
  if (req.user) {
    try {
      await AuditService.logAction({
        companyId: req.user.companyId || req.user.company_id,
        userId: req.user.id || req.user.userId,
        sessionId: req.sessionID || req.headers['x-session-id'],
        action: 'user.logout',
        description: `Пользователь вышел из системы`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        success: true,
        tags: ['authentication', 'logout']
      });

      // Завершаем сессию
      if (req.sessionID || req.headers['x-session-id']) {
        await AuditService.endSession(req.sessionID || req.headers['x-session-id']);
      }
    } catch (error) {
      logger.error('Error logging logout audit:', error);
    }
  }

  next();
};

/**
 * Определение действия на основе HTTP запроса
 */
function determineAction(req) {
  const { method, route } = req;
  const path = route?.path || req.path;

  // Мапинг маршрутов к действиям
  const actionMappings = {
    // Продукты
    'POST /api/products': 'product.create',
    'PUT /api/products/:id': 'product.update',
    'DELETE /api/products/:id': 'product.delete',

    // Поставщики
    'POST /api/suppliers': 'supplier.create',
    'PUT /api/suppliers/:id': 'supplier.update',
    'DELETE /api/suppliers/:id': 'supplier.delete',
    'POST /api/suppliers/:id/sync': 'supplier.sync',

    // Маркетплейсы
    'POST /api/marketplaces': 'marketplace.create',
    'PUT /api/marketplaces/:id': 'marketplace.update',
    'DELETE /api/marketplaces/:id': 'marketplace.delete',
    'POST /api/marketplaces/:id/sync': 'marketplace.sync',

    // Пользователи
    'POST /api/users': 'user.create',
    'PUT /api/users/:id': 'user.update',
    'DELETE /api/users/:id': 'user.delete',

    // Роли
    'POST /api/roles': 'role.create',
    'PUT /api/roles/:id': 'role.update',
    'DELETE /api/roles/:id': 'role.delete',

    // Заказы
    'POST /api/orders': 'order.create',
    'PUT /api/orders/:id': 'order.update',
    'DELETE /api/orders/:id': 'order.delete',

    // Настройки
    'PUT /api/settings': 'settings.update',

    // Импорт/экспорт
    'POST /api/products/import': 'data.import',
    'GET /api/products/export': 'data.export'
  };

  const key = `${method} ${path}`;
  return actionMappings[key] || null;
}

/**
 * Извлечение информации о сущности из запроса и ответа
 */
function extractEntityInfo(req, responseData) {
  const entityInfo = {
    entityType: null,
    entityId: null,
    entityName: null,
    oldValues: null,
    newValues: null
  };

  // Определяем тип сущности по URL
  if (req.url.includes('/products')) {
    entityInfo.entityType = 'product';
    entityInfo.entityId = req.params.id || responseData?.data?.id;
    entityInfo.entityName = req.body?.name || responseData?.data?.name;

    if (req.method === 'PUT') {
      entityInfo.newValues = req.body;
      // oldValues можно получить из отдельного запроса, но это усложняет логику
    } else if (req.method === 'POST') {
      entityInfo.newValues = req.body;
    }
  } else if (req.url.includes('/suppliers')) {
    entityInfo.entityType = 'supplier';
    entityInfo.entityId = req.params.id || responseData?.data?.id;
    entityInfo.entityName = req.body?.name || responseData?.data?.name;

    if (req.method === 'PUT') {
      entityInfo.newValues = req.body;
    } else if (req.method === 'POST') {
      entityInfo.newValues = req.body;
    }
  } else if (req.url.includes('/marketplaces')) {
    entityInfo.entityType = 'marketplace';
    entityInfo.entityId = req.params.id || responseData?.data?.id;
    entityInfo.entityName = req.body?.name || responseData?.data?.name;

    if (req.method === 'PUT') {
      entityInfo.newValues = req.body;
    } else if (req.method === 'POST') {
      entityInfo.newValues = req.body;
    }
  } else if (req.url.includes('/users')) {
    entityInfo.entityType = 'user';
    entityInfo.entityId = req.params.id || responseData?.data?.id;
    entityInfo.entityName = req.body?.name || responseData?.data?.name;

    if (req.method === 'PUT') {
      entityInfo.newValues = sanitizeObject(req.body);
    } else if (req.method === 'POST') {
      entityInfo.newValues = sanitizeObject(req.body);
    }
  } else if (req.url.includes('/orders')) {
    entityInfo.entityType = 'order';
    entityInfo.entityId = req.params.id || responseData?.data?.id;
    entityInfo.entityName = req.body?.order_number || responseData?.data?.order_number;

    if (req.method === 'PUT') {
      entityInfo.newValues = req.body;
    } else if (req.method === 'POST') {
      entityInfo.newValues = req.body;
    }
  }

  return entityInfo;
}

/**
 * Генерация описания действия
 */
function generateDescription(action, req, entityInfo) {
  const actionDescriptions = {
    'product.create': `Создан новый товар: ${entityInfo.entityName || entityInfo.entityId}`,
    'product.update': `Обновлен товар: ${entityInfo.entityName || entityInfo.entityId}`,
    'product.delete': `Удален товар: ${entityInfo.entityName || entityInfo.entityId}`,
    'supplier.create': `Добавлен новый поставщик: ${entityInfo.entityName || entityInfo.entityId}`,
    'supplier.update': `Обновлен поставщик: ${entityInfo.entityName || entityInfo.entityId}`,
    'supplier.delete': `Удален поставщик: ${entityInfo.entityName || entityInfo.entityId}`,
    'supplier.sync': `Выполнена синхронизация с поставщиком: ${entityInfo.entityName || entityInfo.entityId}`,
    'marketplace.create': `Добавлен новый маркетплейс: ${entityInfo.entityName || entityInfo.entityId}`,
    'marketplace.update': `Обновлен маркетплейс: ${entityInfo.entityName || entityInfo.entityId}`,
    'marketplace.delete': `Удален маркетплейс: ${entityInfo.entityName || entityInfo.entityId}`,
    'marketplace.sync': `Выполнена синхронизация с маркетплейсом: ${entityInfo.entityName || entityInfo.entityId}`,
    'user.create': `Создан новый пользователь: ${entityInfo.entityName || entityInfo.entityId}`,
    'user.update': `Обновлен пользователь: ${entityInfo.entityName || entityInfo.entityId}`,
    'user.delete': `Удален пользователь: ${entityInfo.entityName || entityInfo.entityId}`,
    'order.create': `Создан новый заказ: ${entityInfo.entityName || entityInfo.entityId}`,
    'order.update': `Обновлен заказ: ${entityInfo.entityName || entityInfo.entityId}`,
    'order.delete': `Удален заказ: ${entityInfo.entityName || entityInfo.entityId}`,
    'settings.update': 'Обновлены настройки системы',
    'data.import': 'Выполнен импорт данных',
    'data.export': 'Выполнен экспорт данных'
  };

  return actionDescriptions[action] || `Выполнено действие: ${action}`;
}

/**
 * Генерация тегов для действия
 */
function generateTags(action, req) {
  const tags = [];

  // Базовые теги по типу действия
  if (action.includes('create')) tags.push('create');
  if (action.includes('update')) tags.push('update');
  if (action.includes('delete')) tags.push('delete');
  if (action.includes('sync')) tags.push('sync');

  // Теги по категории
  if (action.includes('product')) tags.push('products');
  if (action.includes('supplier')) tags.push('suppliers');
  if (action.includes('marketplace')) tags.push('marketplaces');
  if (action.includes('user')) tags.push('users');
  if (action.includes('order')) tags.push('orders');
  if (action.includes('settings')) tags.push('settings');
  if (action.includes('data')) tags.push('data');

  // Дополнительные теги
  if (req.method === 'POST') tags.push('http_post');
  if (req.method === 'PUT') tags.push('http_put');
  if (req.method === 'DELETE') tags.push('http_delete');

  return tags;
}

/**
 * Извлечение сообщения об ошибке
 */
function getErrorMessage(responseData) {
  if (typeof responseData === 'string') {
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    return responseData.error || responseData.message || 'Unknown error';
  }

  return null;
}

/**
 * Санитизация объекта (удаление чувствительных данных)
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = { ...obj };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'credentials', 'api_key', 'api_config'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Рекурсивно обрабатываем вложенные объекты
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  }

  return sanitized;
}

module.exports = {
  auditMiddleware,
  auditLogin,
  auditLogout
};