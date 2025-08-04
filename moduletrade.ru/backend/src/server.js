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
// PROXY CONFIGURATION (ВАЖНО!)
// ========================================
// Включаем trust proxy для работы за Nginx
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
// HEALTH CHECK
// ========================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: db ? 'connected' : 'disconnected'
  });
});

// ========================================
// ROUTES
// ========================================
const routesDir = './routes';
const fs = require('fs');
const path = require('path');

// Автоматическая загрузка маршрутов
if (fs.existsSync(path.join(__dirname, 'routes'))) {
  const routeFiles = fs.readdirSync(path.join(__dirname, 'routes'))
    .filter(file => file.endsWith('.js'));
  
  let loadedRoutes = 0;
  
  routeFiles.forEach(file => {
    try {
      const routeName = path.basename(file, '.js');
      const routePath = `/api/${routeName}`;
      const route = require(path.join(__dirname, 'routes', file));
      
      app.use(routePath, route);
      logger.info(`✅ Route loaded: ${routeName} -> ${routePath}`);
      loadedRoutes++;
    } catch (error) {
      logger.error(`❌ Failed to load route ${file}:`, error.message);
    }
  });
  
  logger.info(`Routes loaded: ${loadedRoutes}/${routeFiles.length}`);
  
  if (loadedRoutes === routeFiles.length) {
    logger.info('Successfully loaded routes:');
  }
}

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Не показываем подробности ошибки в production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
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
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;