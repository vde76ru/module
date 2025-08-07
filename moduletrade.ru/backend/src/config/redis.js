// ===================================================
// ФАЙЛ: backend/src/config/redis.js
// КОНФИГУРАЦИЯ REDIS ДЛЯ КЭШИРОВАНИЯ
// ===================================================

const redis = require('redis');
const logger = require('../utils/logger');

// ========================================
// REDIS CONFIGURATION
// ========================================

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || 'SecureRedisPass2025',
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('❌ Redis server refused connection');
      return new Error('Redis server refused connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error('❌ Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      logger.error('❌ Redis max retry attempts reached');
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
  max_attempts: 10,
  connect_timeout: 10000,
  command_timeout: 5000,
};

// ========================================
// REDIS CLIENT CREATION
// ========================================

let redisClient = null;

async function createRedisClient() {
  try {
    redisClient = redis.createClient(redisConfig);

    redisClient.on('connect', () => {
      logger.info('✅ Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client ready');
    });

    redisClient.on('error', (err) => {
      logger.error('❌ Redis client error:', err);
    });

    redisClient.on('end', () => {
      logger.info('🔌 Redis client disconnected');
    });

    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis client reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('❌ Failed to create Redis client:', error);
    throw error;
  }
}

// ========================================
// CACHE HELPER FUNCTIONS
// ========================================

/**
 * Устанавливает значение в кэш
 */
async function set(key, value, ttl = 3600) {
  try {
    if (!redisClient) {
      await createRedisClient();
    }
    
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
    await redisClient.setEx(key, ttl, serializedValue);
    logger.debug(`✅ Cache set: ${key}`);
  } catch (error) {
    logger.error('❌ Cache set error:', error);
    throw error;
  }
}

/**
 * Получает значение из кэша
 */
async function get(key) {
  try {
    if (!redisClient) {
      await createRedisClient();
    }
    
    const value = await redisClient.get(key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  } catch (error) {
    logger.error('❌ Cache get error:', error);
    return null;
  }
}

/**
 * Удаляет значение из кэша
 */
async function del(key) {
  try {
    if (!redisClient) {
      await createRedisClient();
    }
    
    await redisClient.del(key);
    logger.debug(`✅ Cache deleted: ${key}`);
  } catch (error) {
    logger.error('❌ Cache delete error:', error);
  }
}

/**
 * Проверяет существование ключа
 */
async function exists(key) {
  try {
    if (!redisClient) {
      await createRedisClient();
    }
    
    return await redisClient.exists(key);
  } catch (error) {
    logger.error('❌ Cache exists error:', error);
    return false;
  }
}

/**
 * Устанавливает время жизни ключа
 */
async function expire(key, ttl) {
  try {
    if (!redisClient) {
      await createRedisClient();
    }
    
    await redisClient.expire(key, ttl);
    logger.debug(`✅ Cache expire set: ${key} -> ${ttl}s`);
  } catch (error) {
    logger.error('❌ Cache expire error:', error);
  }
}

/**
 * Получает время жизни ключа
 */
async function ttl(key) {
  try {
    if (!redisClient) {
      await createRedisClient();
    }
    
    return await redisClient.ttl(key);
  } catch (error) {
    logger.error('❌ Cache TTL error:', error);
    return -1;
  }
}

/**
 * Очищает весь кэш
 */
async function flush() {
  try {
    if (!redisClient) {
      await createRedisClient();
    }
    
    await redisClient.flushDb();
    logger.info('✅ Cache flushed');
  } catch (error) {
    logger.error('❌ Cache flush error:', error);
  }
}

/**
 * Закрывает соединение с Redis
 */
async function close() {
  try {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      logger.info('✅ Redis client closed');
    }
  } catch (error) {
    logger.error('❌ Redis close error:', error);
  }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  createRedisClient,
  set,
  get,
  del,
  exists,
  expire,
  ttl,
  flush,
  close,
  client: redisClient
}; 