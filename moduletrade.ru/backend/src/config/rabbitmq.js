const amqp = require('amqplib');

class RabbitMQManager {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.queues = {
      STOCK_UPDATE: 'stock_update',
      PRICE_UPDATE: 'price_update',
      ORDER_SYNC: 'order_sync',
      PRODUCT_IMPORT: 'product_import',
      YML_GENERATION: 'yml_generation'
    };
  }

  async connect() {
    try {
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL || 'amqp://localhost'
      );
      
      this.channel = await this.connection.createChannel();
      
      // Создаем очереди
      for (const queue of Object.values(this.queues)) {
        await this.channel.assertQueue(queue, {
          durable: true,
          arguments: {
            'x-message-ttl': 3600000 // 1 час
          }
        });
      }
      
      console.log('RabbitMQ connected successfully');
    } catch (error) {
      console.error('RabbitMQ connection error:', error);
      throw error;
    }
  }

  async publishMessage(queue, message) {
    if (!this.channel) {
      await this.connect();
    }
    
    return this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  }

  async consumeMessages(queue, callback) {
    if (!this.channel) {
      await this.connect();
    }
    
    await this.channel.prefetch(1);
    
    return this.channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          this.channel.ack(msg);
        } catch (error) {
          console.error('Message processing error:', error);
          // Возвращаем сообщение в очередь после задержки
          setTimeout(() => {
            this.channel.nack(msg, false, true);
          }, 5000);
        }
      }
    });
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}

module.exports = new RabbitMQManager();
