const cron = require('node-cron');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const { sendSlackNotification } = require('../utils/slack');

class OrderOrchestrationService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    this.scheduledTasks = new Map();
  }

  async initialize() {
    logger.info('Initializing Order Orchestration Service');
    await this.setupSchedules();
    
    // Обновляем расписание каждые 5 минут
    cron.schedule('*/5 * * * *', async () => {
      await this.setupSchedules();
    });
  }

  async setupSchedules() {
    try {
      const result = await this.pool.query(`
        SELECT id, tenant_id, name, settings
        FROM sales_channels
        WHERE is_active = true
      `);

      const channels = result.rows;
      
      // Удаляем старые задачи
      for (const [channelId, task] of this.scheduledTasks) {
        if (!channels.find(ch => ch.id === channelId)) {
          task.stop();
          this.scheduledTasks.delete(channelId);
        }
      }

      // Создаем или обновляем задачи
      for (const channel of channels) {
        const schedule = channel.settings?.procurement_schedule || [];
        
        if (schedule.length > 0) {
          this.scheduleChannelProcurement(channel);
        }
      }
    } catch (error) {
      logger.error('Error setting up schedules:', error);
    }
  }

  scheduleChannelProcurement(channel) {
    const schedules = channel.settings?.procurement_schedule || [];
    
    // Удаляем старую задачу если есть
    if (this.scheduledTasks.has(channel.id)) {
      this.scheduledTasks.get(channel.id).stop();
    }

    // Создаем cron выражения для каждого времени
    schedules.forEach(time => {
      const [hours, minutes] = time.split(':');
      const cronExpression = `${minutes} ${hours} * * *`;
      
      const task = cron.schedule(cronExpression, async () => {
        logger.info(`Running procurement for channel ${channel.name} at ${time}`);
        await this.runProcurement(channel);
      });

      this.scheduledTasks.set(channel.id, task);
    });
  }

  async runProcurement(channel) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Собираем все потребности
      const needs = await this.collectNeeds(client, channel);
      
      if (needs.length === 0) {
        logger.info(`No procurement needs for channel ${channel.name}`);
        return;
      }

      // Группируем по поставщикам
      const groupedNeeds = this.groupNeedsBySupplier(needs);
      
      // Создаем заказы для каждого поставщика
      for (const [supplierId, items] of Object.entries(groupedNeeds)) {
        const orderId = await this.createSupplierOrder(
          client, 
          channel, 
          supplierId, 
          items
        );

        // Если включена автоматическая отправка, отправляем заказ
        if (channel.settings?.auto_confirm_orders) {
          await this.sendOrderToSupplier(client, orderId);
        }
      }

      await client.query('COMMIT');
      
      // Отправляем уведомление
      await sendSlackNotification(
        `✅ Автоматическая закупка для канала "${channel.name}" выполнена. Создано ${Object.keys(groupedNeeds).length} заказов.`
      );
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in procurement:', error);
      
      await sendSlackNotification(
        `❌ Ошибка автоматической закупки для канала "${channel.name}": ${error.message}`
      );
    } finally {
      client.release();
    }
  }

  async collectNeeds(client, channel) {
    const result = await client.query(`
      WITH pending_items AS (
        SELECT 
          oi.id,
          oi.product_id,
          oi.quantity,
          o.tenant_id,
          p.name as product_name,
          ps.supplier_id,
          ps.supplier_sku,
          ps.original_price,
          ps.currency
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        JOIN product_suppliers ps ON ps.product_id = oi.product_id
        WHERE o.sales_channel_id = $1
          AND oi.procurement_status = 'pending'
          AND NOT EXISTS (
            SELECT 1 FROM procurement_overrides po 
            WHERE po.order_item_id = oi.id
          )
      )
      SELECT * FROM pending_items
      ORDER BY supplier_id, product_id
    `, [channel.id]);

    return result.rows;
  }

  groupNeedsBySupplier(needs) {
    const grouped = {};
    
    for (const need of needs) {
      if (!grouped[need.supplier_id]) {
        grouped[need.supplier_id] = [];
      }
      
      // Проверяем, есть ли уже такой товар в группе
      const existing = grouped[need.supplier_id].find(
        item => item.product_id === need.product_id
      );
      
      if (existing) {
        // Суммируем количество
        existing.quantity += need.quantity;
        existing.order_item_ids.push(need.id);
      } else {
        grouped[need.supplier_id].push({
          product_id: need.product_id,
          supplier_sku: need.supplier_sku,
          quantity: need.quantity,
          original_price: need.original_price,
          currency: need.currency,
          product_name: need.product_name,
          order_item_ids: [need.id]
        });
      }
    }
    
    return grouped;
  }

  async createSupplierOrder(client, channel, supplierId, items) {
    // Получаем информацию о поставщике
    const supplierResult = await client.query(
      'SELECT name FROM suppliers WHERE id = $1',
      [supplierId]
    );
    const supplier = supplierResult.rows[0];

    // Создаем batch ID для группировки
    const batchId = require('crypto').randomUUID();

    // Создаем заказ поставщику
    const orderResult = await client.query(`
      INSERT INTO supplier_orders (
        tenant_id, 
        supplier_id, 
        status, 
        total_amount,
        aggregation_batch_id,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, NULL)
      RETURNING id
    `, [
      channel.tenant_id,
      supplierId,
      'draft',
      this.calculateTotalAmount(items),
      batchId
    ]);

    const orderId = orderResult.rows[0].id;

    // Добавляем позиции в заказ
    for (const item of items) {
      await client.query(`
        INSERT INTO supplier_order_items (
          order_id,
          product_id,
          supplier_sku,
          quantity,
          price,
          currency
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        orderId,
        item.product_id,
        item.supplier_sku,
        item.quantity,
        item.original_price,
        item.currency
      ]);

      // Обновляем статус позиций клиентских заказов
      for (const orderItemId of item.order_item_ids) {
        await client.query(`
          UPDATE order_items 
          SET procurement_status = 'ordered'
          WHERE id = $1
        `, [orderItemId]);
      }
    }

    logger.info(`Created supplier order ${orderId} for ${supplier.name} with ${items.length} items`);
    
    return orderId;
  }

  calculateTotalAmount(items) {
    return items.reduce((sum, item) => {
      return sum + (item.original_price * item.quantity);
    }, 0);
  }

  async sendOrderToSupplier(client, orderId) {
    try {
      // Получаем информацию о заказе
      const orderResult = await client.query(`
        SELECT so.*, s.name as supplier_name, s.api_config
        FROM supplier_orders so
        JOIN suppliers s ON s.id = so.supplier_id
        WHERE so.id = $1
      `, [orderId]);

      const order = orderResult.rows[0];

      // Получаем позиции заказа
      const itemsResult = await client.query(`
        SELECT * FROM supplier_order_items
        WHERE order_id = $1
      `, [orderId]);

      const items = itemsResult.rows;

      // Здесь должна быть интеграция с API поставщика
      // Пока просто меняем статус на confirmed
      await client.query(`
        UPDATE supplier_orders 
        SET status = 'confirmed', 
            sent_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [orderId]);

      logger.info(`Order ${orderId} sent to supplier ${order.supplier_name}`);
      
    } catch (error) {
      logger.error(`Error sending order ${orderId}:`, error);
      
      // Откатываем статусы позиций
      await client.query(`
        UPDATE order_items oi
        SET procurement_status = 'failed'
        FROM supplier_order_items soi
        WHERE soi.order_id = $1
          AND soi.product_id = oi.product_id
          AND oi.procurement_status = 'ordered'
      `, [orderId]);
      
      throw error;
    }
  }

  async manualTriggerProcurement(channelId) {
    const result = await this.pool.query(
      'SELECT * FROM sales_channels WHERE id = $1',
      [channelId]
    );

    if (result.rows.length === 0) {
      throw new Error('Channel not found');
    }

    const channel = result.rows[0];
    await this.runProcurement(channel);
  }
}

module.exports = new OrderOrchestrationService();
