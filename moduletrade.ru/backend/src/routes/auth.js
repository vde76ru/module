// backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

/**
 * POST /api/auth/login
 * Авторизация пользователя
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, remember_me } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Находим пользователя
    const userResult = await db.mainPool.query(`
      SELECT u.*, t.name as tenant_name, t.tariff_id 
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE u.email = $1 AND u.active = true
    `, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const user = userResult.rows[0];

    // Проверяем пароль
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Проверяем статус тенанта
    if (!user.tenant_id) {
      return res.status(403).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Создаем JWT токен
    const tokenPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: remember_me ? '7d' : '1d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id },
      process.env.JWT_REFRESH_SECRET || 'refresh_secret',
      { expiresIn: '30d' }
    );

    // Обновляем last_login
    await db.mainPool.query(`
      UPDATE users 
      SET last_login = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [user.id]);

    // Сохраняем refresh token
    await db.mainPool.query(`
      INSERT INTO user_sessions (user_id, refresh_token, expires_at, created_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days', NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `, [user.id, refreshToken]);

    res.json({
      success: true,
      data: {
        token: accessToken,
        refreshToken: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant_id: user.tenant_id,
          tenant_name: user.tenant_name
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Обновление токена
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // Проверяем refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret');
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Проверяем, существует ли сессия
    const sessionResult = await db.mainPool.query(`
      SELECT us.*, u.email, u.role, u.name
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.refresh_token = $1 AND us.expires_at > NOW()
    `, [refreshToken]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Session expired'
      });
    }

    const session = sessionResult.rows[0];

    // Создаем новый access token
    const tokenPayload = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      email: session.email,
      role: session.role
    };

    const newAccessToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      data: {
        token: newAccessToken,
        user: {
          id: session.user_id,
          email: session.email,
          name: session.name,
          role: session.role,
          tenant_id: decoded.tenantId
        }
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/me
 * Получение текущего пользователя
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const userResult = await db.mainPool.query(`
      SELECT u.id, u.email, u.name, u.role, u.tenant_id, u.created_at,
             t.name as tenant_name, t.tariff_id,
             tr.name as tariff_name, tr.limits as tariff_limits
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN tariffs tr ON t.tariff_id = tr.id
      WHERE u.id = $1
    `, [req.user.userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name,
        tariff_name: user.tariff_name,
        tariff_limits: user.tariff_limits,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/logout
 * Выход из системы
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Удаляем сессию пользователя
    await db.mainPool.query(`
      DELETE FROM user_sessions 
      WHERE user_id = $1
    `, [req.user.userId]);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/register
 * Регистрация нового пользователя
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, company_name } = req.body;

    // Валидация
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password and name are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Проверяем, существует ли пользователь
    const existingUser = await db.mainPool.query(`
      SELECT id FROM users WHERE email = $1
    `, [email.toLowerCase()]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Хэшируем пароль
    const passwordHash = await bcrypt.hash(password, 12);

    // Начинаем транзакцию
    await db.mainPool.query('BEGIN');

    try {
      // Создаем тенанта
      const tenantResult = await db.mainPool.query(`
        INSERT INTO tenants (name, tariff_id, created_at)
        VALUES ($1, 1, NOW())
        RETURNING id
      `, [company_name || `${name} Company`]);

      const tenantId = tenantResult.rows[0].id;

      // Создаем пользователя
      const userResult = await db.mainPool.query(`
        INSERT INTO users (tenant_id, email, password_hash, name, role, active, created_at)
        VALUES ($1, $2, $3, $4, 'admin', true, NOW())
        RETURNING id, email, name, role
      `, [tenantId, email.toLowerCase(), passwordHash, name]);

      const user = userResult.rows[0];

      // Создаем JWT токены
      const tokenPayload = {
        userId: user.id,
        tenantId: tenantId,
        email: user.email,
        role: user.role
      };

      const accessToken = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1d' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, tenantId: tenantId },
        process.env.JWT_REFRESH_SECRET || 'refresh_secret',
        { expiresIn: '30d' }
      );

      // Сохраняем refresh token
      await db.mainPool.query(`
        INSERT INTO user_sessions (user_id, refresh_token, expires_at, created_at)
        VALUES ($1, $2, NOW() + INTERVAL '30 days', NOW())
      `, [user.id, refreshToken]);

      await db.mainPool.query('COMMIT');

      res.status(201).json({
        success: true,
        data: {
          token: accessToken,
          refreshToken: refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenant_id: tenantId
          }
        }
      });

    } catch (error) {
      await db.mainPool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;