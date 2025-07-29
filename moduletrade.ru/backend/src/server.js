// backend/src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Инициализируем logger как можно раньше
let logger;
try {
  logger = require('./utils/logger');
  logger.info('Logger initialized successfully');
} catch (error) {
  console.error('Failed to initialize logger:', error.message);
  // Используем простой fallback
  logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    debug: (...args) => console.log('[DEBUG]', ...args),
    safeLog: (level, ...args) => console.log(`[${level.toUpperCase()}]`, ...args)
  };
}

// Импорт конфигурации базы данных
let db;
try {
  db = require('./config/database');
  logger.info('Database configuration loaded');
} catch (error) {
  logger.error('Failed to load database configuration:', error);
}

const app = express();

// ========================================
// MIDDLEWARE SETUP
// ========================================

// Логирование запросов
if (process.env.NODE_ENV !== 'test') {
  const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(logFormat));
  logger.info(`Morgan logging enabled with format: ${logFormat}`);
}

// Безопасность
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false
}));

// CORS настройка
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://moduletrade.ru')
  .split(',')
  .map(origin => origin.trim());

logger.info('Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Tenant-ID'
  ]
}));

// Сжатие ответов
app.use(compression());

// Парсинг JSON
app.use(express.json({
  limit: process.env.MAX_FILE_SIZE || '50mb',
  strict: true
}));

// Парсинг URL-encoded данных
app.use(express.urlencoded({
  extended: true,
  limit: process.env.MAX_FILE_SIZE || '50mb'
}));

// Статические файлы для uploads
app.use('/uploads', express.static('uploads', {
  maxAge: '1d',
  setHeaders: (res, path) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// ========================================
// HEALTH CHECK ENDPOINT
// ========================================
app.get('/health', async (req, res) => {
  try {
    // Базовая проверка здоровья
    let dbStatus = 'unknown';

    try {
      if (db && db.mainPool) {
        await db.mainPool.query('SELECT 1');
        dbStatus = 'ok';
      }
    } catch (dbError) {
      logger.error('Database health check failed:', dbError);
      dbStatus = 'error';
    }

    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        database: dbStatus
      }
    };

    // Если база недоступна, возвращаем 503
    if (dbStatus === 'error') {
      return res.status(503).json({
        ...healthStatus,
        status: 'error'
      });
    }

    res.json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Service unhealthy'
    });
  }
});

// ========================================
// REQUEST LOGGING (только в dev режиме)
// ========================================
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    logger.debug(`🔍 ${new Date().toISOString()} - ${req.method} ${req.path}`);

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(`✅ ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });

    next();
  });
}

// ========================================
// API ROUTES - С УЛУЧШЕННОЙ ОБРАБОТКОЙ ОШИБОК
// ========================================

const routeConfigs = [
  { path: '/api/auth', file: './routes/auth', name: 'auth' },
  { path: '/api/products', file: './routes/products', name: 'products' },
  { path: '/api/orders', file: './routes/orders', name: 'orders' },
  { path: '/api/analytics', file: './routes/analytics', name: 'analytics' },
  { path: '/api/warehouses', file: './routes/warehouses', name: 'warehouses' },
  { path: '/api/billing', file: './routes/billing', name: 'billing' },
  { path: '/api/sync', file: './routes/sync', name: 'sync' },
  { path: '/api/marketplaces', file: './routes/marketplaces', name: 'marketplaces' },
  { path: '/api/suppliers', file: './routes/suppliers', name: 'suppliers' },
  { path: '/api/dictionaries', file: './routes/dictionaries', name: 'dictionaries' },
  { path: '/api/settings', file: './routes/settings', name: 'settings' }
];

// Загружаем роуты с обработкой ошибок для каждого файла
const loadedRoutes = [];
const failedRoutes = [];

for (const config of routeConfigs) {
  try {
    const routeModule = require(config.file);
    app.use(config.path, routeModule);
    loadedRoutes.push(config.name);
    logger.info(`✅ Route loaded: ${config.name} -> ${config.path}`);
  } catch (error) {
    logger.error(`❌ Failed to load route ${config.name} (${config.file}):`, error.message);
    logger.debug('Route loading error details:', error);
    failedRoutes.push({ name: config.name, error: error.message });
  }
}

// Логируем общий статус загрузки роутов
logger.info(`Routes loaded: ${loadedRoutes.length}/${routeConfigs.length}`);
if (loadedRoutes.length > 0) {
  logger.info('Successfully loaded routes:', loadedRoutes.join(', '));
}
if (failedRoutes.length > 0) {
  logger.error('Failed routes:', failedRoutes.map(r => `${r.name} (${r.error})`).join(', '));
}

// ========================================
// ERROR HANDLERS
// ========================================

// 404 Handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global Error Handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body
  });

  const statusCode = error.statusCode || error.status || 500;

  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && {
      stack: error.stack,
      details: error.details
    })
  });
});

// ========================================
// SERVER STARTUP
// ========================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on ${HOST}:${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔍 Log level: ${process.env.LOG_LEVEL || 'info'}`);

  if (failedRoutes.length > 0) {
    logger.warn(`⚠️  Some routes failed to load. Check logs for details.`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;