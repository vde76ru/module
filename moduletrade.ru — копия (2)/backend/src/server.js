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

// Импорт конфигурации Redis
let redis;
try {
  redis = require('./config/redis');
  logger.info('Redis configuration loaded');
} catch (error) {
  logger.warn('Redis configuration not loaded:', error.message);
}

// Импорт конфигурации RabbitMQ
let rabbitmq;
try {
  rabbitmq = require('./config/rabbitmq');
  logger.info('RabbitMQ configuration loaded');
} catch (error) {
  logger.warn('RabbitMQ configuration not loaded:', error.message);
}

const app = express();

// ========================================
// RESPONSE CACHING POLICY
// ========================================
// Отключаем ETag и кэширование динамических API-ответов
app.set('etag', false);
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ========================================
// APPLY DB MIGRATIONS ON STARTUP (non-blocking)
// ========================================
try {
  const shouldRunMigrations = process.env.RUN_MIGRATIONS_ON_START === 'true' && process.env.SKIP_DB_MIGRATIONS !== 'true';
  if (shouldRunMigrations) {
    const path = require('path');
    const { spawn } = require('child_process');

    // Минимальная проверка соединения (не фатальная)
    if (db && db.checkConnection) {
      db.checkConnection().catch(() => {
        logger.warn('DB connection check failed, proceeding to migrations');
      });
    }

    const child = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'safe_migrate.js')], {
      stdio: 'ignore',
      env: process.env,
      detached: true,
    });
    child.unref();
    logger.info('🟡 DB migrations launched in background (non-blocking)');
  } else {
    logger.info('⏭️  DB migrations on startup disabled (set RUN_MIGRATIONS_ON_START=true to enable)');
  }
} catch (err) {
  logger.error('❌ Failed to schedule migrations on startup:', err);
}

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
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080,http://localhost:3000,https://moduletrade.ru,https://www.moduletrade.ru')
  .split(',')
  .map(origin => origin.trim());

logger.info('Allowed CORS origins:', allowedOrigins);

app.use((req, res, next) => {
  const origin = req.get('origin');
  logger.debug(`Request from origin: ${origin}, method: ${req.method}, path: ${req.path}`);
  next();
});

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.get('origin');
    const isAllowedOrigin = !origin || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*');

    if (isAllowedOrigin) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Tenant-ID');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    }
  }
  next();
});

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

// Stripe webhook парсится внутри роутера; здесь не дублируем raw body parser

// Парсинг JSON (after webhook raw)
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
// START BACKGROUND WORKERS (SYNC)
// ========================================
try {
  const syncWorkers = require('./jobs/syncWorkers');
  syncWorkers.start().catch((e) => logger.error('Failed to start sync workers:', e));
  logger.info('Sync workers bootstrapped');
} catch (e) {
  logger.error('Sync workers not started:', e.message);
}

// ========================================
// AUDIT MIDDLEWARE
// ========================================
// Подключаем middleware для автоматического логирования действий
try {
  const { auditMiddleware } = require('./middleware/audit');
  app.use('/api', auditMiddleware());
  logger.info('✅ Audit middleware loaded');
} catch (error) {
  logger.warn('⚠️ Audit middleware not loaded:', error.message);
}

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
  'settings',
  'users',
  'audit',
  'productImport',
  'images',
  'rs24',
  'jobs'
];

let loadedRoutes = 0;
const failedRoutes = [];

routeFiles.forEach(routeName => {
  try {
    const route = require(`${routesPath}/${routeName}`);
    const mountPath = routeName === 'productImport' ? '/api/product-import' : `/api/${routeName}`;
    app.use(mountPath, route);
    loadedRoutes++;
    logger.info(`✅ Route loaded: ${routeName} -> ${mountPath}`);
  } catch (error) {
    failedRoutes.push(routeName);
    const details = error && (error.stack || error.message || String(error));
    logger.error(`❌ Failed to load route ${routeName} (${routesPath}/${routeName}): ${details}`);
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

  // Запускаем планировщик задач
  try {
    const scheduler = require('./jobs/scheduler');
    if (process.env.START_JOBS_ON_START === 'true') {
      scheduler.start();
      logger.info('✅ Job scheduler started');
    } else {
      logger.info('⏸️  Job scheduler startup disabled (set START_JOBS_ON_START=true to enable)');
    }
  } catch (error) {
    logger.error('❌ Failed to initialize job scheduler:', error);
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

  // Закрываем подключения к Redis
  if (redis && redis.close) {
    try {
      await redis.close();
      logger.info('✅ Redis connections closed');
    } catch (error) {
      logger.error('❌ Error closing Redis connections:', error);
    }
  }

  // Закрываем подключения к RabbitMQ
  if (rabbitmq && rabbitmq.closeConnection) {
    try {
      await rabbitmq.closeConnection();
      logger.info('✅ RabbitMQ connections closed');
    } catch (error) {
      logger.error('❌ Error closing RabbitMQ connections:', error);
    }
  }

  // Останавливаем планировщик задач
  try {
    const scheduler = require('./jobs/scheduler');
    scheduler.stop();
    logger.info('✅ Job scheduler stopped');
  } catch (error) {
    logger.error('❌ Error stopping job scheduler:', error);
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