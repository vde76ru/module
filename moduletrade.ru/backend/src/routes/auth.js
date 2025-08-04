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
      name, subscription_status, plan, trial_end_date, is_active
    )
    VALUES ($1, 'trial', 'free', $2, true)
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
      company_id, email, password_hash, name, first_name, last_name, phone, role, role_id, is_active, is_verified
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin', $8, true, true)
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
      trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
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
      await client.query('BEGIN');

      // Проверяем существование пользователя
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists',
          code: 'USER_EXISTS'
        });
      }

      // Создаем пользователя и компанию
      const { user, company } = await createUserWithCompany(client, {
        email,
        password,
        firstName,
        lastName,
        name: fullName,
        companyName,
        phone
      });

      await client.query('COMMIT');

      // Генерируем токены
      const tokenPayload = {
        userId: user.id,
        companyId: user.company_id,
        role: user.role,
        email: user.email
      };

      const accessToken = generateToken(tokenPayload, '24h');
      const refreshToken = generateRefreshToken({ userId: user.id, companyId: user.company_id });

      logger.info('User registered successfully', { 
        userId: user.id, 
        email: user.email,
        companyId: user.company_id 
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            created_at: user.created_at
          },
          company: {
            id: company.id,
            name: company.name,
            plan: company.plan,
            subscription_status: company.subscription_status,
            trial_end_date: company.trial_end_date
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

    const { email, password, remember_me = false } = req.body;

    try {
      // Ищем пользователя с информацией о компании
      const userResult = await db.query(`
        SELECT
          u.id, u.email, u.password_hash, u.name, u.first_name, u.last_name, u.phone,
          u.role, u.role_id, u.is_active, u.is_verified, u.last_login,
          u.company_id, u.created_at,
          c.name as company_name, c.plan as company_plan,
          c.subscription_status, c.is_active as company_is_active
        FROM users u
        JOIN companies c ON u.company_id = c.id
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

      // Проверяем активность пользователя
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: 'Account suspended',
          code: 'ACCOUNT_SUSPENDED'
        });
      }

      // Проверяем активность компании
      if (!user.company_is_active) {
        return res.status(403).json({
          success: false,
          error: 'Company account suspended',
          code: 'COMPANY_SUSPENDED'
        });
      }

      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Обновляем данные последнего входа
      await db.query(`
        UPDATE users
        SET last_login = NOW(), login_count = login_count + 1, last_activity = NOW()
        WHERE id = $1
      `, [user.id]);

      // Генерируем токены
      const tokenPayload = {
        userId: user.id,
        companyId: user.company_id,
        role: user.role,
        email: user.email
      };

      const expiresIn = remember_me ? '30d' : '24h';
      const accessToken = generateToken(tokenPayload, expiresIn);
      const refreshToken = generateRefreshToken({ userId: user.id, companyId: user.company_id });

      logger.info('User logged in successfully', { 
        userId: user.id, 
        email: user.email,
        rememberMe: remember_me
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            created_at: user.created_at
          },
          company: user.company_id ? {
            id: user.company_id,
            name: user.company_name,
            plan: user.company_plan,
            subscription_status: user.subscription_status
          } : null,
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: remember_me ? 2592000 : 86400 // 30 дней или 24 часа в секундах
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
        c.id as company_id, c.subscription_status, c.is_active as company_is_active
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

    // Проверяем активность компании
    if (!user.company_is_active) {
      return res.status(403).json({
        success: false,
        error: 'Company account suspended',
        code: 'COMPANY_SUSPENDED'
      });
    }

    // Генерируем новый access token
    const tokenPayload = {
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email
    };

    const accessToken = generateToken(tokenPayload, '24h');

    res.json({
      success: true,
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
  try {
    // В будущем здесь можно добавить логику очистки refresh токенов из БД
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * GET /api/auth/me
 * Получение информации о текущем пользователе
 */
router.get('/me', authenticate, async (req, res) => {
  try {
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
          created_at: req.user.created_at,
          is_active: req.user.is_active
        },
        company: req.user.company_id ? {
          id: req.user.company_id,
          name: req.user.company_name,
          plan: req.user.company_plan,
          subscription_status: req.user.company_status
        } : null
      }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Смена пароля
 */
router.post('/change-password', 
  authenticate,
  [
    body('oldPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain uppercase, lowercase and number')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { oldPassword, newPassword } = req.body;

    try {
      // Получаем текущий хэш пароля
      const userResult = await db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Проверяем старый пароль
      const isValidPassword = await bcrypt.compare(oldPassword, userResult.rows[0].password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Хэшируем новый пароль
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Обновляем пароль
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, req.user.id]
      );

      logger.info('Password changed successfully', { userId: req.user.id });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }
);

module.exports = router;