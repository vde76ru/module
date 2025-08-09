// ===================================================
// ФАЙЛ: backend/src/routes/auth.js
// ИСПРАВЛЕНИЯ: Добавлена обработка поля phone при регистрации
// ===================================================

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { auditLogin, auditLogout } = require('../middleware/audit');

const router = express.Router();

// Feature flag to control public registration
const isRegistrationAllowed = (process.env.ALLOW_REGISTRATION || '').toLowerCase() === 'true';
const allowedRegistrationIps = (process.env.ALLOWED_REGISTER_IPS || '')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

const { enforceResourceLimit, apiCallsLimit } = require('../middleware/limits');

// Регистрация пользователя - ИСПРАВЛЕНО
router.post('/register', apiCallsLimit(), async (req, res) => {
    // Security gate: allow toggling registration and optional IP allowlist
    if (!isRegistrationAllowed) {
        return res.status(403).json({
            success: false,
            error: 'Registration is disabled'
        });
    }

    if (allowedRegistrationIps.length > 0) {
        const realIpHeader = req.headers['x-real-ip'];
        const forwardedForHeader = req.headers['x-forwarded-for'];
        const ipFromForwardedFor = Array.isArray(forwardedForHeader)
            ? forwardedForHeader[0]
            : (forwardedForHeader || '').split(',')[0].trim();
        const requestIp = (realIpHeader || ipFromForwardedFor || req.ip || '').replace(/^::ffff:/, '');

        if (!allowedRegistrationIps.includes(requestIp)) {
            return res.status(403).json({
                success: false,
                error: 'Registration is restricted for your IP'
            });
        }
    }

    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const { email, password, name, phone, company_name, companyName, firstName, lastName } = req.body;

        // Поддерживаем оба формата названия компании
        const finalCompanyName = company_name || companyName;

        // Поддерживаем оба формата имени
        const finalName = name || (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName);

        // Валидация
        if (!email || !password || !finalName || !finalCompanyName) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: email, password, name, and company name are required'
            });
        }

        // Проверяем, существует ли пользователь
        const existingUser = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'User already exists'
            });
        }

        // Хешируем пароль
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Получаем тариф "Пробный" для новых пользователей
        const tariffResult = await client.query(
            'SELECT id FROM tariffs WHERE name = $1 AND is_active = true LIMIT 1',
            ['Пробный']
        );

        if (tariffResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                error: 'Trial tariff "Пробный" not found. Please check database seed data.'
            });
        }

        const tariffId = tariffResult.rows[0].id;

        // Создаем компанию с триальным периодом на 14 дней и валидными полями подписки
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        const companyResult = await client.query(
            `INSERT INTO companies (
                name,
                tariff_id,
                subscription_status,
                plan,
                trial_end_date,
                subscription_start_date,
                created_at,
                is_active
            )
            VALUES ($1, $2, 'trial', 'trial', $3, NOW(), NOW(), true)
            RETURNING id`,
            [finalCompanyName, tariffId, trialEndDate]
        );

        const companyId = companyResult.rows[0].id;

        // Получаем системную роль "Владелец"
        const ownerRoleResult = await client.query(
            `SELECT id FROM roles WHERE name = 'Владелец' AND is_system = true LIMIT 1`
        );

        if (ownerRoleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                error: 'System role "Владелец" not found. Please check database seed data.'
            });
        }

        const roleId = ownerRoleResult.rows[0].id;

        // Создаем пользователя с поддержкой поля phone (active) и владельческой ролью
        const userResult = await client.query(
            `INSERT INTO users (email, password_hash, name, phone, company_id, role_id, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
             RETURNING id, email, name, phone, company_id, role_id`,
            [
                email,
                hashedPassword,
                finalName,
                phone || null,
                companyId,
                roleId
            ]
        );

        const user = userResult.rows[0];

        // Генерируем и сохраняем refresh token и активируем подпись trial-платежа для аналитики
        const crypto = require('crypto');
        const refreshToken = crypto.randomBytes(64).toString('hex');
        await client.query(
            'UPDATE users SET refresh_token = $1, updated_at = NOW() WHERE id = $2',
            [refreshToken, user.id]
        );

        // Опциональная запись trial-платежа — включаем только если явно задано
        if (String(process.env.ENABLE_TRIAL_PAYMENT || '').toLowerCase() === 'true') {
          await client.query(
              `INSERT INTO payments (
                  company_id, amount, currency, status, tariff_id,
                  period_type, period_months, paid_from, paid_until, description
              ) VALUES ($1, 0.01, 'RUB', 'succeeded', $2, 'trial', 1, NOW(), $3, 'Trial activation')`,
              [companyId, tariffId, trialEndDate]
          );
        }

        await client.query('COMMIT');

        // Создаем JWT токен
        const token = jwt.sign(
            {
                userId: user.id,
                companyId: user.company_id,
                role: 'Владелец'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            token,
            refreshToken,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    role: 'Владелец',
                    role_id: user.role_id,
                    company_id: user.company_id,
                    is_active: true
                },
                company: {
                    id: companyId,
                    subscription_status: 'trial',
                    plan: 'trial',
                    trial_end_date: trialEndDate.toISOString()
                }
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    } finally {
        client.release();
    }
});

// Вход пользователя
router.post('/login', apiCallsLimit(), auditLogin, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Получаем пользователя с ролью
        const result = await db.query(`
            SELECT
                u.id, u.email, u.password_hash, u.name, u.phone,
                u.company_id, u.is_active, u.email_verified_at, u.role_id,
                u.last_login, u.last_login_ip,
                r.name as role_name, r.display_name as role_display_name,
                c.name as company_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.email = $1
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        // Проверяем пароль
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Обновляем время последнего входа
        await db.query(
            'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1',
            [user.id]
        );

        // Создаем JWT токен
        const token = jwt.sign(
            {
                userId: user.id,
                companyId: user.company_id,
                role: user.role_name
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Генерируем и сохраняем новый refresh token
        const crypto = require('crypto');
        const refreshToken = crypto.randomBytes(64).toString('hex');
        await db.query(
            'UPDATE users SET refresh_token = $1, updated_at = NOW() WHERE id = $2',
            [refreshToken, user.id]
        );

        res.json({
            success: true,
            token,
            refreshToken,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    role: user.role_name,
                    role_id: user.role_id,
                    role_name: user.role_name,
                    role_display_name: user.role_display_name,
                    company_id: user.company_id,
                    company_name: user.company_name,
                    is_active: user.is_active,
                    email_verified: user.email_verified_at ? true : false
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

// Получение информации о текущем пользователе
router.get('/me', authenticate, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                user: {
                    id: req.user.id,
                    email: req.user.email,
                    name: req.user.name,
                    phone: req.user.phone,
                    role: req.user.role || req.user.roleName,
                    role_id: req.user.roleId,
                    role_name: req.user.roleName,
                    role_display_name: req.user.roleDisplayName,
                    company_id: req.user.companyId,
                    company_name: req.user.companyName,
                    is_active: req.user.isActive
                },
                company: req.user.companyId ? {
                    id: req.user.companyId,
                    name: req.user.companyName
                } : null
            }
        });
    } catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Выход
router.post('/logout', authenticate, auditLogout, async (req, res) => {
    try {
        // Инвалидация refresh-токена пользователя при выходе
        await db.query(
            'UPDATE users SET refresh_token = NULL, updated_at = NOW() WHERE id = $1',
            [req.user.id]
        );

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        // Даже если произошла ошибка при очистке refresh токена, не блокируем логаут на клиенте
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
});

// Обновление токена
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
        const result = await db.query(
            'SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.refresh_token = $1 AND u.is_active = true',
            [refreshToken]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }

        const user = result.rows[0];

        // Создаем новый access token
        const newToken = jwt.sign(
            {
                userId: user.id,
                companyId: user.company_id,
                role: user.role_name
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Создаем новый refresh token
        const newRefreshToken = require('crypto').randomBytes(64).toString('hex');

        // Обновляем refresh token в БД
        await db.query(
            'UPDATE users SET refresh_token = $1, updated_at = NOW() WHERE id = $2',
            [newRefreshToken, user.id]
        );

        res.json({
            success: true,
            token: newToken,
            refreshToken: newRefreshToken
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Смена пароля
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        // Получаем текущий пароль пользователя
        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = result.rows[0];

        // Проверяем текущий пароль
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Хешируем новый пароль
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Обновляем пароль
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [hashedPassword, req.user.id]
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Забыли пароль
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        // Проверяем, существует ли пользователь
        const result = await db.query(
            'SELECT id, name FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        if (result.rows.length === 0) {
            // Не сообщаем, что пользователь не найден (безопасность)
            return res.json({
                success: true,
                message: 'If the email exists, a password reset link has been sent'
            });
        }

        const user = result.rows[0];

        // Генерируем токен для сброса пароля
        const resetToken = require('crypto').randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000); // 1 час

        // Сохраняем токен в БД
        await db.query(
            'UPDATE users SET password_reset_token = $1, password_reset_expires_at = $2, updated_at = NOW() WHERE id = $3',
            [resetToken, resetExpires, user.id]
        );

        // TODO: Отправить email с ссылкой для сброса пароля
        // В реальном проекте здесь должна быть отправка email

        res.json({
            success: true,
            message: 'If the email exists, a password reset link has been sent'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Сброс пароля
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Token and new password are required'
            });
        }

        // Проверяем токен
        const result = await db.query(
            'SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires_at > NOW() AND is_active = true',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset token'
            });
        }

        const user = result.rows[0];

        // Хешируем новый пароль
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Обновляем пароль и очищаем токен
        await db.query(
            'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires_at = NULL, updated_at = NOW() WHERE id = $2',
            [hashedPassword, user.id]
        );

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;