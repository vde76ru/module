// backend/src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { DatabaseManager } = require('./services/DatabaseManager');

const app = express();

// ========================================
// MIDDLEWARE
// ========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // Разрешаем eval для решения CSP проблемы
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

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://moduletrade.ru',
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // лимит 100 запросов с IP за 15 минут
});
app.use(limiter);

// ========================================
// IMPORT ROUTES
// ========================================
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const analyticsRoutes = require('./routes/analytics');
const warehousesRoutes = require('./routes/warehouses');
const billingRoutes = require('./routes/billing');
const syncRoutes = require('./routes/sync');
const marketplacesRoutes = require('./routes/marketplaces');
const suppliersRoutes = require('./routes/suppliers');

// ========================================
// DEBUG MIDDLEWARE - ДО МАРШРУТОВ!
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
// API ROUTES - С ПРЕФИКСОМ /api
// ========================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/marketplaces', marketplacesRoutes);
app.use('/api/suppliers', suppliersRoutes);

// ========================================
// LEGACY ROUTES (БЕЗ ПРЕФИКСА) - для обратной совместимости
// ========================================
app.use('/auth', authRoutes);
app.use('/products', productsRoutes);
app.use('/orders', ordersRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/warehouses', warehousesRoutes);
app.use('/billing', billingRoutes);
app.use('/sync', syncRoutes);
app.use('/marketplaces', marketplacesRoutes);
app.use('/suppliers', suppliersRoutes);

// ========================================
// HEALTH CHECK
// ========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ========================================
// TEST ENDPOINTS
// ========================================
app.get('/test', (req, res) => {
  res.json({
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    available_routes: [
      '/api/auth',
      '/api/products',
      '/api/orders',
      '/api/analytics',
      '/api/billing',
      '/api/sync',
      '/api/marketplaces',
      '/api/suppliers'
    ]
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'API Backend is working!',
    timestamp: new Date().toISOString(),
    available_routes: [
      '/api/auth',
      '/api/products',
      '/api/orders',
      '/api/analytics',
      '/api/billing',
      '/api/sync',
      '/api/marketplaces',
      '/api/suppliers'
    ]
  });
});

// ========================================
// ERROR HANDLING
// ========================================
app.use((err, req, res, next) => {
  console.error('🚨 Global error handler:', err);

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

  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_routes: [
      '/api/auth',
      '/api/products', 
      '/api/orders',
      '/api/analytics',
      '/api/billing',
      '/api/sync',
      '/api/marketplaces',
      '/api/suppliers'
    ]
  });
});

// ========================================
// SERVER STARTUP
// ========================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    // Инициализация базы данных
    console.log('🚀 Initializing services...');
    
    const db = new DatabaseManager();
    await db.initialize();
    console.log('✅ Database initialized');

    // Запуск сервера
    app.listen(PORT, HOST, () => {
      console.log('🎉 ========================================');
      console.log(`🚀 Server running on ${HOST}:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://${HOST}:${PORT}/health`);
      console.log(`🔗 API Health check: http://${HOST}:${PORT}/api/health`);
      console.log(`🔗 API test: http://${HOST}:${PORT}/api/test`);
      console.log('📋 Available API routes:');
      console.log('   - /api/auth/* (authentication)');
      console.log('   - /api/products/* (products management)');
      console.log('   - /api/orders/* (orders management)');
      console.log('   - /api/analytics/* (analytics & reports)');
      console.log('   - /api/warehouses/* (warehouse management)');
      console.log('   - /api/billing/* (billing & tariffs)');
      console.log('   - /api/sync/* (synchronization)');
      console.log('   - /api/marketplaces/* (marketplace integrations)');
      console.log('   - /api/suppliers/* (supplier management)');
      console.log('🎉 ========================================');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;