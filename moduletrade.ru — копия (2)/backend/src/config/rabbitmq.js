// ===================================================
// ФАЙЛ: backend/src/config/rabbitmq.js
// КОНФИГУРАЦИЯ RABBITMQ ДЛЯ ОЧЕРЕДЕЙ СООБЩЕНИЙ
// ===================================================

const amqp = require('amqplib');
const logger = require('../utils/logger');

// ========================================
// RABBITMQ CONFIGURATION
// ========================================

const rabbitmqConfig = {
  hostname: process.env.RABBITMQ_HOST || 'rabbitmq',
  port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
  // ВАЖНО: Выставляем дефолты в соответствии с docker-compose
  username: process.env.RABBITMQ_USER || 'moduletrade_admin',
  password: process.env.RABBITMQ_PASS || '3mVVdqZ9EcyrpQSCS-c44r7yV',
  vhost: process.env.RABBITMQ_VHOST || '/moduletrade'.replace(/^\/?/, '/'),
  heartbeat: 60,
  connection_timeout: 60000,
  channel_max: 0,
  frame_max: 0,
};

// ========================================
// RABBITMQ CONNECTION
// ========================================

let connection = null;
let channel = null;

/**
 * Создает соединение с RabbitMQ
 */
async function createConnection() {
  try {
    if (connection && connection.connection && connection.connection.writable) {
      return connection;
    }

    // Предпочитаем явный URL из окружения, если он задан (совпадает с docker-compose)
    const url = process.env.RABBITMQ_URL
      || `amqp://${encodeURIComponent(rabbitmqConfig.username)}:${encodeURIComponent(rabbitmqConfig.password)}@${rabbitmqConfig.hostname}:${rabbitmqConfig.port}${rabbitmqConfig.vhost.startsWith('/') ? rabbitmqConfig.vhost : `/${rabbitmqConfig.vhost}`}`;
    
    connection = await amqp.connect(url);
    
    connection.on('connect', () => {
      logger.info('✅ RabbitMQ connected');
    });

    connection.on('error', (err) => {
      logger.error('❌ RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      logger.info('🔌 RabbitMQ connection closed');
      connection = null;
      channel = null;
    });

    return connection;
  } catch (error) {
    logger.error('❌ Failed to create RabbitMQ connection:', error);
    throw error;
  }
}

/**
 * Создает канал для работы с очередями
 */
async function createChannel() {
  try {
    if (!connection) {
      await createConnection();
    }

    if (channel && channel.connection && channel.connection.writable) {
      return channel;
    }

    channel = await connection.createChannel();
    
    channel.on('error', (err) => {
      logger.error('❌ RabbitMQ channel error:', err);
    });

    channel.on('return', (msg) => {
      logger.warn('⚠️ RabbitMQ message returned:', msg);
    });

    return channel;
  } catch (error) {
    logger.error('❌ Failed to create RabbitMQ channel:', error);
    throw error;
  }
}

// ========================================
// QUEUE OPERATIONS
// ========================================

/**
 * Создает очередь
 */
async function createQueue(queueName, options = {}) {
  try {
    const ch = await createChannel();
    
    const defaultOptions = {
      durable: true,
      autoDelete: false,
      arguments: {}
    };

    await ch.assertQueue(queueName, { ...defaultOptions, ...options });
    logger.info(`✅ Queue created: ${queueName}`);
    
    return ch;
  } catch (error) {
    logger.error(`❌ Failed to create queue ${queueName}:`, error);
    throw error;
  }
}

/**
 * Отправляет сообщение в очередь
 */
async function sendToQueue(queueName, message, options = {}) {
  try {
    const ch = await createChannel();
    
    const defaultOptions = {
      persistent: true,
      contentType: 'application/json'
    };

    const messageBuffer = Buffer.from(JSON.stringify(message));
    const result = ch.sendToQueue(queueName, messageBuffer, { ...defaultOptions, ...options });
    
    if (result) {
      logger.debug(`✅ Message sent to queue: ${queueName}`);
    } else {
      logger.warn(`⚠️ Message not sent to queue: ${queueName} (queue full)`);
    }
    
    return result;
  } catch (error) {
    logger.error(`❌ Failed to send message to queue ${queueName}:`, error);
    throw error;
  }
}

/**
 * Получает сообщение из очереди
 */
async function consumeQueue(queueName, handler, options = {}) {
  try {
    const ch = await createChannel();
    
    const defaultOptions = {
      noAck: false,
      prefetch: 1
    };

    await ch.prefetch(options.prefetch || 1);
    
    const result = await ch.consume(queueName, async (msg) => {
      try {
        if (msg) {
          const content = JSON.parse(msg.content.toString());
          await handler(content, msg);
          ch.ack(msg);
          logger.debug(`✅ Message processed from queue: ${queueName}`);
        }
      } catch (error) {
        logger.error(`❌ Error processing message from queue ${queueName}:`, error);
        ch.nack(msg, false, true); // Reject and requeue
      }
    }, { ...defaultOptions, ...options });

    logger.info(`✅ Consumer started for queue: ${queueName}`);
    return result;
  } catch (error) {
    logger.error(`❌ Failed to consume queue ${queueName}:`, error);
    throw error;
  }
}

/**
 * Получает одно сообщение из очереди
 */
async function getMessage(queueName) {
  try {
    const ch = await createChannel();
    const msg = await ch.get(queueName, { noAck: false });
    
    if (msg) {
      const content = JSON.parse(msg.content.toString());
      logger.debug(`✅ Message received from queue: ${queueName}`);
      return { content, message: msg };
    }
    
    return null;
  } catch (error) {
    logger.error(`❌ Failed to get message from queue ${queueName}:`, error);
    throw error;
  }
}

/**
 * Подтверждает обработку сообщения
 */
async function ackMessage(message) {
  try {
    const ch = await createChannel();
    ch.ack(message);
    logger.debug('✅ Message acknowledged');
  } catch (error) {
    logger.error('❌ Failed to acknowledge message:', error);
    throw error;
  }
}

/**
 * Отклоняет сообщение
 */
async function nackMessage(message, requeue = true) {
  try {
    const ch = await createChannel();
    ch.nack(message, false, requeue);
    logger.debug(`✅ Message nacked (requeue: ${requeue})`);
  } catch (error) {
    logger.error('❌ Failed to nack message:', error);
    throw error;
  }
}

// ========================================
// EXCHANGE OPERATIONS
// ========================================

/**
 * Создает exchange
 */
async function createExchange(exchangeName, type = 'direct', options = {}) {
  try {
    const ch = await createChannel();
    
    const defaultOptions = {
      durable: true,
      autoDelete: false
    };

    await ch.assertExchange(exchangeName, type, { ...defaultOptions, ...options });
    logger.info(`✅ Exchange created: ${exchangeName} (${type})`);
    
    return ch;
  } catch (error) {
    logger.error(`❌ Failed to create exchange ${exchangeName}:`, error);
    throw error;
  }
}

/**
 * Отправляет сообщение в exchange
 */
async function publishToExchange(exchangeName, routingKey, message, options = {}) {
  try {
    const ch = await createChannel();
    
    const defaultOptions = {
      persistent: true,
      contentType: 'application/json'
    };

    const messageBuffer = Buffer.from(JSON.stringify(message));
    const result = ch.publish(exchangeName, routingKey, messageBuffer, { ...defaultOptions, ...options });
    
    if (result) {
      logger.debug(`✅ Message published to exchange: ${exchangeName} (${routingKey})`);
    } else {
      logger.warn(`⚠️ Message not published to exchange: ${exchangeName} (${routingKey})`);
    }
    
    return result;
  } catch (error) {
    logger.error(`❌ Failed to publish message to exchange ${exchangeName}:`, error);
    throw error;
  }
}

/**
 * Привязывает очередь к exchange
 */
async function bindQueue(queueName, exchangeName, routingKey) {
  try {
    const ch = await createChannel();
    await ch.bindQueue(queueName, exchangeName, routingKey);
    logger.info(`✅ Queue ${queueName} bound to exchange ${exchangeName} (${routingKey})`);
  } catch (error) {
    logger.error(`❌ Failed to bind queue ${queueName} to exchange ${exchangeName}:`, error);
    throw error;
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Проверяет соединение с RabbitMQ
 */
async function checkConnection() {
  try {
    const conn = await createConnection();
    const ch = await createChannel();
    await ch.checkQueue('test-connection');
    logger.info('✅ RabbitMQ connection check successful');
    return true;
  } catch (error) {
    logger.error('❌ RabbitMQ connection check failed:', error);
    return false;
  }
}

/**
 * Закрывает соединение с RabbitMQ
 */
async function closeConnection() {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    
    if (connection) {
      await connection.close();
      connection = null;
    }
    
    logger.info('✅ RabbitMQ connection closed');
  } catch (error) {
    logger.error('❌ Failed to close RabbitMQ connection:', error);
  }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  createConnection,
  createChannel,
  createQueue,
  sendToQueue,
  consumeQueue,
  getMessage,
  ackMessage,
  nackMessage,
  createExchange,
  publishToExchange,
  bindQueue,
  checkConnection,
  closeConnection,
  connection,
  channel
};
