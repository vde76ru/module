// backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

const db = require('../config/database');
const {
  authenticate,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  rateLimiter
} = require('../middleware/auth');

const router = express.Router();

// ========================================
// VALIDATION RULES
// ========================================

const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('tenantName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// ========================================
// AUTHENTICATION ROUTES
// ========================================

/**
 * POST /api/auth/register
 * Регистрация нового пользователя и тенанта
 */
router.post('/register',
  rateLimiter(5, 15 * 60 * 1000), // 5 попыток за 15 минут
  registerValidation,
  async (req, res) => {
    try {
      // Проверяем валидацию
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { email, password, name, tenantName } = req.body;

      // Проверяем, существует ли пользователь
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'User already exists',
          code: 'USER_EXISTS'
        });
      }

      // Хэшируем пароль
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Создаем tenant и пользователя в транзакции
      const result = await db.transaction(async (client) => {
        // Создаем тенанта
        const tenantResult = await client.query(`
          INSERT INTO tenants (
            id, name, domain, db_schema, status, tariff_id
          ) VALUES ($1, $2, $3, $4, 'active', (
            SELECT id FROM tariffs WHERE code = 'free' LIMIT 1
          ))
          RETURNING *
        `, [
          uuidv4(),
          tenantName,
          `${tenantName.toLowerCase().replace(/[^a-z0-9]/g, '')}.moduletrade.local`,
          `tenant_${uuidv4().replace(/-/g, '')}`
        ]);

        const tenant = tenantResult.rows[0];

        // Создаем пользователя
        const userResult = await client.query(`
          INSERT INTO users (
            id, tenant_id, email, password_hash, role, name, is_active
          ) VALUES ($1, $2, $3, $4, 'admin', $5, true)
          RETURNING id, email, role, name, tenant_id, created_at
        `, [
          uuidv4(),
          tenant.id,
          email,
          passwordHash,
          name
        ]);

        return {
          user: userResult.rows[0],
          tenant
        };
      });

      // Генерируем токены
      const tokenPayload = {
        userId: result.user.id,
        tenantId: result.tenant.id,
        role: result.user.role
      };

      const accessToken = generateToken(tokenPayload, '1h');
      const refreshToken = generateRefreshToken(tokenPayload);

      // Сохраняем refresh token
      await db.query(`
        INSERT INTO user_sessions (user_id, refresh_token, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id)
        DO UPDATE SET
          refresh_token = $2,
          expires_at = $3,
          updated_at = CURRENT_TIMESTAMP
      `, [
        result.user.id,
        refreshToken,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 дней
      ]);

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            tenantId: result.tenant.id,
            tenantName: result.tenant.name
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 3600 // 1 час в секундах
          }
        }
      });

    } catch (error) {
      console.error('Registration error:', error);

      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(409).json({
          success: false,
          error: 'Email already exists',
          code: 'EMAIL_EXISTS'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Вход в систему
 */
router.post('/login',
  rateLimiter(10, 15 * 60 * 1000), // 10 попыток за 15 минут
  loginValidation,
  async (req, res) => {
    try {
      // Проверяем валидацию
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { email, password } = req.body;

      // Находим пользователя с информацией о тенанте
      const userResult = await db.query(`
        SELECT
          u.id, u.email, u.password_hash, u.role, u.name,
          u.is_active, u.tenant_id, u.last_login,
          t.id as tenant_id, t.name as tenant_name,
          t.db_schema, t.status as tenant_status
        FROM users u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE u.email = $1
      `, [email]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const user = userResult.rows[0];

      // Проверяем статус пользователя и тенанта
      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          error: 'Account is deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      if (user.tenant_status !== 'active') {
        return res.status(401).json({
          success: false,
          error: 'Account is suspended',
          code: 'ACCOUNT_SUSPENDED'
        });
      }

      // Проверяем пароль
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Генерируем токены
      const tokenPayload = {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role
      };

      const accessToken = generateToken(tokenPayload, '1h');
      const refreshToken = generateRefreshToken(tokenPayload);

      // Обновляем последний вход и сохраняем refresh token
      await db.transaction(async (client) => {
        // Обновляем время последнего входа
        await client.query(
          'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
          [user.id]
        );

        // Сохраняем refresh token
        await client.query(`
          INSERT INTO user_sessions (user_id, refresh_token, expires_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id)
          DO UPDATE SET
            refresh_token = $2,
            expires_at = $3,
            updated_at = CURRENT_TIMESTAMP
        `, [
          user.id,
          refreshToken,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 дней
        ]);
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenant_id,
            tenantName: user.tenant_name,
            lastLogin: user.last_login
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 3600 // 1 час в секундах
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Обновление access токена
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    try {
      // Верифицируем refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Проверяем, существует ли сессия
      const sessionResult = await db.query(`
        SELECT us.*, u.role, u.is_active, t.status as tenant_status
        FROM user_sessions us
        JOIN users u ON us.user_id = u.id
        JOIN tenants t ON u.tenant_id = t.id
        WHERE us.user_id = $1 AND us.refresh_token = $2 AND us.expires_at > CURRENT_TIMESTAMP
      `, [decoded.userId, refreshToken]);

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      const session = sessionResult.rows[0];

      // Проверяем статус пользователя и тенанта
      if (!session.is_active || session.tenant_status !== 'active') {
        return res.status(401).json({
          success: false,
          error: 'Account is not active',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // Генерируем новый access token
      const tokenPayload = {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        role: session.role
      };

      const newAccessToken = generateToken(tokenPayload, '1h');

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: 3600
        }
      });

    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
});

/**
 * POST /api/auth/logout
 * Выход из системы
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Удаляем refresh token из базы
    await db.query(
      'DELETE FROM user_sessions WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

/**
 * GET /api/auth/me
 * Получение информации о текущем пользователе
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    // Получаем актуальную информацию о пользователе
    const userResult = await db.query(`
      SELECT
        u.id, u.email, u.name, u.role, u.last_login, u.created_at,
        t.id as tenant_id, t.name as tenant_name, t.db_schema,
        tar.name as tariff_name, tar.limits, tar.features
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN tariffs tar ON t.tariff_id = tar.id
      WHERE u.id = $1 AND u.is_active = true
    `, [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
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
        lastLogin: user.last_login,
        createdAt: user.created_at,
        tenant: {
          id: user.tenant_id,
          name: user.tenant_name,
          schema: user.db_schema
        },
        tariff: {
          name: user.tariff_name,
          limits: user.limits,
          features: user.features
        }
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info',
      code: 'USER_INFO_ERROR'
    });
  }
});

module.exports = router;