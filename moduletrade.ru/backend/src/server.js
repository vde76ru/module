// ========================================
// ИСПРАВЛЕННЫЙ backend/src/server.js
// CORS дублирование полностью убрано!
// ========================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const db = require('./config/database');
const rabbitmq = require('./config/rabbitmq');
const { rateLimiter } = require('./middleware/auth');

// Services
const SyncService = require('./services/SyncService');
const BillingService = require('./services/BillingService');
const PIMService = require('./services/PIMService');

// Routes
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const billingRoutes = require('./routes/billing');
const syncRoutes = require('./routes/sync');
const marketplacesRoutes = require('./routes/marketplaces');
const suppliersRoutes = require('./routes/suppliers');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// CORS КОНФИГУРАЦИЯ - ЕДИНСТВЕННОЕ МЕСТО!
// ========================================
const corsOptions = {
  origin: [
    'https://moduletrade.ru',
    'https://app.moduletrade.ru',
    'https://www.moduletrade.ru'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Real-IP',
    'X-Forwarded-For',
    'X-Forwarded-Proto'
  ],
  optionsSuccessStatus: 200
};

// ========================================
// MIDDLEWARE В ПРАВИЛЬНОМ ПОРЯДКЕ
// ========================================

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS - ЕДИНСТВЕННОЕ МЕСТО УСТАНОВКИ CORS!
app.use(cors(corsOptions));

// Сжатие
app.use(compression());

// Парсинг JSON и URL
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Логирование
app.use(morgan('combined'));

// ========================================
// HEALTH CHECK - БЕЗ PREFIX
// ========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ========================================
// API ROUTES - БЕЗ /api PREFIX!
// ========================================
// Важно: nginx убирает /api из пути, поэтому здесь routes без префикса

app.use('/auth', authRoutes);
app.use('/products', productsRoutes);
app.use('/billing', billingRoutes);
app.use('/sync', syncRoutes);
app.use('/marketplaces', marketplacesRoutes);
app.use('/suppliers', suppliersRoutes);

// ========================================
// RATE LIMITING (после основных routes)
// ========================================
app.use(rateLimiter(100, 60000)); // 100 запросов в минуту

// ========================================
// DEBUG MIDDLEWARE - для отслеживания запросов
// ========================================
app.use((req, res, next) => {
  console.log(`🔍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'Bearer ***' : 'none',
    'origin': req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
  });
  next();
});

// ========================================
// TEST ENDPOINTS для диагностики
// ========================================
app.get('/test', (req, res) => {
  res.json({
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    headers: req.headers
  });
});

app.post('/test-auth', (req, res) => {
  res.json({
    message: 'Auth endpoint accessible',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================
app.use((err, req, res, next) => {
  console.error('🚨 Global error handler:', err);

  // НЕ УСТАНАВЛИВАЕМ CORS headers здесь - middleware уже их установил!

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ========================================
// 404 HANDLER
// ========================================
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);

  // НЕ УСТАНАВЛИВАЕМ CORS headers здесь - middleware уже их установил!

  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// ========================================
// INITIALIZE SERVICES
// ========================================
async function initializeServices() {
  try {
    console.log('🚀 Initializing services...');

    // Connect to RabbitMQ (может быть недоступен в некоторых окружениях)
    try {
      await rabbitmq.connect();
      console.log('✅ RabbitMQ connected successfully');
    } catch (error) {
      console.warn('⚠️ RabbitMQ connection failed:', error.message);
    }

    // Initialize services
    try {
      const billingService = new BillingService();
      await billingService.initializeTariffs();
      console.log('✅ BillingService initialized successfully');
    } catch (error) {
      console.warn('⚠️ BillingService initialization failed:', error.message);
    }

    const syncService = new SyncService();
    const pimService = new PIMService();

    console.log('✅ SyncService ready');
    console.log('✅ PIMService ready');
    console.log('✅ All services initialized successfully');

  } catch (error) {
    console.error('🚨 Service initialization error:', error);
    // Не завершаем процесс, продолжаем работу без некоторых сервисов
  }
}

// ========================================
// START SERVER
// ========================================
async function startServer() {
  try {
    // Инициализируем сервисы
    await initializeServices();

    // Запускаем сервер
    app.listen(PORT, '0.0.0.0', () => {
      console.log('🎉 ========================================');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API test: http://localhost:${PORT}/test`);
      console.log('🎉 ========================================');
    });

  } catch (error) {
    console.error('🚨 Failed to start server:', error);
    process.exit(1);
  }
}

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

// Запускаем сервер
startServer();

module.exports = app;