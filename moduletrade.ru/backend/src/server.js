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
// PROXY CONFIGURATION (ВАЖНО для исправления ошибки!)
// ========================================
// Включаем trust proxy для работы за Nginx reverse proxy
app.set('trust proxy', true);
logger.info('Trust proxy enabled for reverse proxy support');

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

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
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
    if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png')) {
      res.set('Cache-Control', 'public, max-age=86400'); // 1 день
    }
  }
}));

// ========================================
// HEALTH CHECK ENDPOINT
// ========================================

const healthRouter = require('./routes/health');
app.use('/health', healthRouter);

// ========================================
// API ROUTES
// ========================================

const routesPath = './routes';
const routeFiles = [
  'auth',
  'products',
  'orders',
  'analytics',
  'warehouses',
  'billing',
  'sync',
  'marketplaces',
  'suppliers',
  'dictionaries',
  'settings'
];

let loadedRoutes = 0;
const failedRoutes = [];

routeFiles.forEach(routeName => {
  try {
    const route = require(`${routesPath}/${routeName}`);
    app.use(`/api/${routeName}`, route);
    loadedRoutes++;
    logger.info(`✅ Route loaded: ${routeName} -> /api/${routeName}`);
  } catch (error) {
    failedRoutes.push(routeName);
    logger.error(`❌ Failed to load route ${routeName} (${routesPath}/${routeName}):`, error.message, { stack: error.stack });
  }
});

logger.info(`Routes loaded: ${loadedRoutes}/${routeFiles.length}`);
if (loadedRoutes > 0) {
  logger.info('Successfully loaded routes:', routeFiles.filter(r => !failedRoutes.includes(r)).join(', '));
}
if (failedRoutes.length > 0) {
  logger.error('Failed routes:', failedRoutes.join(', '));
}

// ========================================
// ERROR HANDLERS
// ========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Global error handler:', error);

  // CORS errors
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      origin: req.get('origin')
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired'
    });
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details
    });
  }

  // Database errors
  if (error.code === '23505') { // Unique violation
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry'
    });
  }

  if (error.code === '23503') { // Foreign key violation
    return res.status(400).json({
      success: false,
      error: 'Invalid reference'
    });
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ========================================
// SERVER START
// ========================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on ${HOST}:${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔍 Log level: ${process.env.LOG_LEVEL || 'debug'}`);

  if (failedRoutes.length > 0) {
    logger.warn('⚠️  Some routes failed to load. Check logs for details.');
  }
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  // Останавливаем прием новых запросов
  server.close(() => {
    logger.info('✅ HTTP server closed');
  });

  // Закрываем подключения к БД
  if (db && db.gracefulShutdown) {
    try {
      await db.gracefulShutdown();
      logger.info('✅ Database connections closed');
    } catch (error) {
      logger.error('❌ Error closing database connections:', error);
    }
  }

  // Даем время на завершение активных запросов
  setTimeout(() => {
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  }, 5000);
};

// Обработка сигналов
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;