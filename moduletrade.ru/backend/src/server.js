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

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined'));

// Rate limiting
app.use('/api/', rateLimiter(100, 60000)); // 100 запросов в минуту

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/marketplaces', marketplacesRoutes);
app.use('/api/suppliers', suppliersRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Initialize services
async function initializeServices() {
  try {
    // Connect to RabbitMQ
    await rabbitmq.connect();
    
    // Initialize services
    const syncService = new SyncService();
    const billingService = new BillingService();
    const pimService = new PIMService();
    
    // Start workers
    await billingService.initializeTariffs();
    console.log('BillingService initialized successfully');
    console.log('SyncService ready');
    console.log('PIMService ready');
    console.log('All services initialized successfully');
    
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Service initialization error:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    await initializeServices();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  await db.close();
  await rabbitmq.close();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  
  await db.close();
  await rabbitmq.close();
  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
