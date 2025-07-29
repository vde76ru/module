// backend/src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Правильный импорт database manager
const db = require('./config/database');

const app = express();

// ========================================
// LOGGING SETUP
// ========================================
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ========================================
// MIDDLEWARE
// ========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS конфигурация
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://moduletrade.ru')
  .split(',')
  .map(origin => origin.trim());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.use(compression());
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_FILE_SIZE || '10mb' }));

// ========================================
// RATE LIMITING (вместо express-rate-limit)
// ========================================
const { rateLimiter } = require('./middleware/auth');

// Применяем rate limiting только если включено
if (process.env.RATE_LIMIT_ENABLED === 'true') {
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 минут
  
  app.use(rateLimiter(maxRequests, windowMs));
}

// ========================================
// HEALTH CHECK
// ========================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// ========================================
// DEBUG MIDDLEWARE (только в dev режиме)
// ========================================
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`🔍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('Headers:', {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? '[HIDDEN]' : 'None'
    });
    next();
  });
}

// ========================================
// ROUTES
// ========================================
try {
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

} catch (error) {
  console.error('❌ Ошибка при загрузке роутов:', error.message);
  process.exit(1);
}

// ========================================
// ERROR HANDLING
// ========================================
app.use((err, req, res, next) => {
  console.error('❌ Необработанная ошибка:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// ========================================
// SERVER STARTUP
// ========================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    // Проверяем подключение к БД
    console.log('🔄 Проверка подключения к базе данных...');
    await db._testConnection();
    
    // Запускаем сервер
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Сервер запущен на ${HOST}:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔒 Rate limiting: ${process.env.RATE_LIMIT_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 Получен SIGTERM, завершаем сервер...');
      server.close(async () => {
        await db.close();
        console.log('✅ Сервер корректно завершен');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 Получен SIGINT, завершаем сервер...');
      server.close(async () => {
        await db.close();
        console.log('✅ Сервер корректно завершен');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Критическая ошибка при запуске сервера:', error);
    process.exit(1);
  }
}

// Запускаем сервер
if (require.main === module) {
  startServer();
}

module.exports = app;