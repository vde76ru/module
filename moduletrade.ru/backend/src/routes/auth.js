// backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ========================================
// RATE LIMITING
// ========================================

const rateLimiter = (maxRequests, windowMs) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      success: false,
      error: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Используем X-Forwarded-For от nginx
      const forwarded = req.headers['x-forwarded-for'];
      const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
      return ip;
    },
    skip: (req) => {
      // Пропускаем health checks
      return req.path === '/health';
    }
  });
};

// ========================================
// JWT HELPERS
// ========================================

const generateToken = (payload, expiresIn) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret', { expiresIn: '30d' });
};

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
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase and number'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('companyName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required')
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
// HELPER FUNCTIONS
// ========================================

/**
 * Создание пользователя с компанией
 */
async function createUserWithCompany(client, userData) {
  // 1. Создаем компанию
  const companyResult = await client.query(`
    INSERT INTO companies (
      name, subscription_status, plan, trial_end_date
    )
    VALUES ($1, 'trial', 'free', $2)
    RETURNING id, name, plan, subscription_status, trial_end_date
  `, [
    userData.companyName,
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 дней пробного периода
  ]);

  const company = companyResult.rows[0];

  // 2. Хэшируем пароль
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(userData.password, saltRounds);

  // 3. Получаем роль admin
  const roleResult = await client.query(`SELECT id FROM roles WHERE name = 'admin'`);
  if (roleResult.rows.length === 0) {
      throw new Error('Admin role not found');
  }
  const adminRoleId = roleResult.rows[0].id;

  // 4. Создаем пользователя
  const userResult = await client.query(`
    INSERT INTO users (
      company_id, email, password_hash, name, first_name, last_name, phone, role, role_id, is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin', $8, true)
    RETURNING id, email, name, first_name, last_name, role, created_at
  `, [
    company.id,
    userData.email,
    passwordHash,
    userData.name,
    userData.firstName,
    userData.lastName,
    userData.phone,
    adminRoleId
  ]);

  const user = userResult.rows[0];

  return {
    user: {
      ...user,
      company_id: company.id
    },
    company: {
      ...company,
      trial_end_date: company.trial_end_date
    }
  };
}

// ========================================
// AUTHENTICATION ROUTES
// ========================================

/**
 * POST /api/auth/register
 * Регистрация нового пользователя с бесплатным пробным периодом
 */
router.post('/register',
  rateLimiter(5, 15 * 60 * 1000),
  registerValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, firstName, lastName, companyName, phone } = req.body;
    const fullName = `${firstName} ${lastName}`.trim();
    const client = await db.getClient();

    try {
      // Проверяем существование пользователя
      const existingUser = await client.query(
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

      await client.query('BEGIN');

      // Создаем пользователя с компанией
      const result = await createUserWithCompany(client, {
        email,
        password,
        name: fullName,
        firstName,
        lastName,
        companyName,
        phone: phone || null
      });

      const tokenPayload = {
        userId: result.user.id,
        companyId: result.company.id,
        role: result.user.role
      };

      const accessToken = generateToken(tokenPayload, '24h');
      const refreshToken = generateRefreshToken(tokenPayload);

      // Обновляем время последнего входа
      await client.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [result.user.id]
      );

      await client.query('COMMIT');

      // Возвращаем ответ в формате, который ожидает фронтенд
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            first_name: result.user.first_name,
            last_name: result.user.last_name,
            role: result.user.role,
            created_at: result.user.created_at
          },
          company: {
            id: result.company.id,
            name: result.company.name,
            plan: result.company.plan,
            subscription_status: result.company.subscription_status,
            trial_ends_at: result.company.trial_end_date
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 86400
          }
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Registration error:', error);

      res.status(500).json({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    } finally {
      client.release();
    }
  }
);

/**
 * POST /api/auth/login
 * Вход в систему
 */
router.post('/login',
  rateLimiter(10, 15 * 60 * 1000),
  loginValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    try {
      // Находим пользователя с информацией о компании
      const userResult = await db.query(`
        SELECT
          u.id, u.email, u.password_hash, u.name, u.first_name, u.last_name, u.role, u.is_active,
          c.id as company_id, c.name as company_name, c.plan, c.subscription_status, c.settings
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
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

      if (!user.is_active) {
          return res.status(403).json({
            success: false,
            error: 'User account is inactive'
          });
      }

      // Проверяем активность компании
      if (user.company_id && user.subscription_status === 'suspended') {
        return res.status(403).json({
          success: false,
          error: 'Account suspended',
          code: 'ACCOUNT_SUSPENDED'
        });
      }

      // Проверяем пароль
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Генерируем токены
      const tokenPayload = {
        userId: user.id,
        companyId: user.company_id,
        role: user.role
      };

      const accessToken = generateToken(tokenPayload, '24h');
      const refreshToken = generateRefreshToken(tokenPayload);

      // Обновляем время последнего входа
      await db.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = $1',
        [user.id]
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role
          },
          company: user.company_id ? {
            id: user.company_id,
            name: user.company_name,
          } : null,
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 86400
          }
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
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
 * Обновление токена
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token required',
      code: 'TOKEN_REQUIRED'
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret');

    // Проверяем существование пользователя
    const userResult = await db.query(`
      SELECT
        u.id, u.email, u.name, u.role, u.is_active,
        c.id as company_id, c.subscription_status
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1 AND u.is_active = true
    `, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    const user = userResult.rows[0];

    // Генерируем новый access token
    const tokenPayload = {
      userId: user.id,
      companyId: user.company_id,
      role: user.role
    };

    const accessToken = generateToken(tokenPayload, '24h');

    res.json({
      success: true,
      token: accessToken, // Для совместимости
      data: {
        tokens: {
            accessToken,
            expiresIn: 86400
        }
      }
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

/**
 * POST /api/auth/logout
 * Выход из системы
 */
router.post('/logout', async (req, res) => {
    res.json({
      success: true,
      message: 'Logout successful'
    });
});

/**
 * GET /api/auth/me
 * Получение информации о текущем пользователе
 */
router.get('/me', authenticate, async (req, res) => {
    res.json({
        success: true,
        data: {
            user: {
              id: req.user.id,
              email: req.user.email,
              name: req.user.name,
              first_name: req.user.first_name,
              last_name: req.user.last_name,
              role: req.user.role,
              created_at: req.user.created_at
            },
            company: req.user.companyId ? {
              id: req.user.companyId,
              name: req.user.company_name
            } : null
        }
    });
});

module.exports = router;