const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const redis = require('redis');
const amqp = require('amqplib');

// ✅ ИСПРАВЛЕНО: изменен путь с '/' на '/health' для соответствия подключению в server.js
router.get('/', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            api: 'healthy',
            database: 'unknown',
            redis: 'unknown',
            rabbitmq: 'unknown'
        },
        environment: process.env.NODE_ENV || 'development'
    };

    try {
        // Проверка PostgreSQL
        const pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        });

        const dbResult = await pool.query('SELECT NOW()');
        if (dbResult.rows.length > 0) {
            health.services.database = 'healthy';
        }
        await pool.end();
    } catch (error) {
        health.services.database = 'unhealthy';
        health.status = 'degraded';
        console.error('Database health check failed:', error.message);
    }

    try {
        // Проверка Redis
        const redisClient = redis.createClient({
            url: process.env.REDIS_URL || `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
        });

        await redisClient.connect();
        await redisClient.ping();
        health.services.redis = 'healthy';
        await redisClient.quit();
    } catch (error) {
        health.services.redis = 'unhealthy';
        health.status = 'degraded';
        console.error('Redis health check failed:', error.message);
    }

    try {
        // Проверка RabbitMQ
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        await connection.close();
        health.services.rabbitmq = 'healthy';
    } catch (error) {
        health.services.rabbitmq = 'unhealthy';
        health.status = 'degraded';
        console.error('RabbitMQ health check failed:', error.message);
    }

    // Определение общего статуса
    const unhealthyServices = Object.values(health.services).filter(s => s === 'unhealthy').length;
    if (unhealthyServices > 1) {
        health.status = 'unhealthy';
    }

    // Возвращаем соответствующий HTTP статус
    const httpStatus = health.status === 'ok' ? 200 : (health.status === 'degraded' ? 200 : 503);

    res.status(httpStatus).json(health);
});

// Простая проверка живости (для k8s liveness probe)
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString()
    });
});

// Проверка готовности (для k8s readiness probe)
router.get('/ready', async (req, res) => {
    try {
        // Быстрая проверка базы данных
        const pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        });

        await pool.query('SELECT 1');
        await pool.end();

        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'not_ready',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;