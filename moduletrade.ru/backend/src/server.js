// backend/src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Импорт конфигурации базы данных
const db = require('./config/database');

const app = express();

// ========================================
// MIDDLEWARE SETUP
// ========================================

// Логирование запросов
if (process.env.NODE_ENV !== 'test') {
  const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(logFormat));
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

app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
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
// SIMPLE RATE LIMITING (без redis)
// ========================================
const rateLimitMap = new Map();

const rateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    if (process.env.RATE_LIMIT_ENABLED !== 'true') {
      return next();
    }

    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Очищаем старые записи
    if (rateLimitMap.has(clientId)) {
      const requests = rateLimitMap.get(clientId).filter(time => time > windowStart);
      rateLimitMap.set(clientId, requests);
    } else {
      rateLimitMap.set(clientId, []);
    }

    const requests = rateLimitMap.get(clientId);

    if (requests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    requests.push(now);
    next();
  };
};

// Применяем rate limiting
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 минут
app.use(rateLimiter(maxRequests, windowMs));

// ========================================
// HEALTH CHECK
// ========================================
app.get('/health', async (req, res) => {
  try {
    // Проверяем подключение к базе данных
    await db._testConnection();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        database: 'ok'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
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
    console.log(`🔍 ${new Date().toISOString()} - ${req.method} ${req.path}`);

    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`✅ ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });

    next();
  });
}

// ========================================
// API ROUTES
// ========================================
try {
  // Импортируем роуты
  const authRoutes = require('./routes/auth');
  const productsRoutes = require('./routes/products');
  const ordersRoutes = require('./routes/orders');
  const analyticsRoutes = require('./routes/analytics');
  const warehousesRoutes = require('./routes/warehouses');
  const billingRoutes = require('./routes/billing');
  const syncRoutes = require('./routes/sync');
  const marketplacesRoutes = require('./routes/marketplaces');
  const suppliersRoutes = require('./routes/suppliers');

  // Монтируем роуты
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/warehouses', warehousesRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/marketplaces', marketplacesRoutes);
  app.use('/api/suppliers', suppliersRoutes);

  console.log('✅ Все роуты загружены успешно');

} catch (error) {
  console.error('❌ Ошибка при загрузке роутов:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

// ========================================
// ERROR HANDLING
// ========================================

// Обработка ошибок CORS
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      origin: req.headers.origin
    });
  }
  next(err);
});

// Общий обработчик ошибок
app.use((err, req, res, next) => {
  console.error('❌ Необработанная ошибка:');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('URL:', req.originalUrl);
  console.error('Method:', req.method);
  console.error('Headers:', req.headers);

  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
      url: req.originalUrl
    })
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.warn(`🔍 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// ========================================
// SERVER STARTUP
// ========================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    console.log('🚀 Запуск ModuleTrade Backend Server...');
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔒 Rate limiting: ${process.env.RATE_LIMIT_ENABLED === 'true' ? 'enabled' : 'disabled'}`);

    // Проверяем подключение к базе данных
    console.log('🔄 Проверка подключения к базе данных...');
    await db._testConnection();
    console.log('✅ База данных подключена успешно');

    // Запускаем HTTP сервер
    const server = app.listen(PORT, HOST, () => {
      console.log(`🌐 Сервер запущен на http://${HOST}:${PORT}`);
      console.log(`🔗 Health check: http://${HOST}:${PORT}/health`);
      console.log(`📚 API доступен по: http://${HOST}:${PORT}/api`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Получен сигнал ${signal}, начинаем graceful shutdown...`);

      server.close(async (err) => {
        if (err) {
          console.error('❌ Ошибка при закрытии сервера:', err);
          process.exit(1);
        }

        try {
          console.log('🔄 Закрываем подключения к базе данных...');
          await db.close();
          console.log('✅ Все подключения закрыты');
          console.log('👋 Сервер корректно завершен');
          process.exit(0);
        } catch (error) {
          console.error('❌ Ошибка при закрытии подключений:', error);
          process.exit(1);
        }
      });

      // Принудительное завершение через 30 секунд
      setTimeout(() => {
        console.error('⏰ Превышен таймаут graceful shutdown, принудительное завершение');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Обработка необработанных ошибок
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Критическая ошибка при запуске сервера:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Запускаем сервер только если этот файл запущен напрямую
if (require.main === module) {
  startServer();
}

module.exports = app;