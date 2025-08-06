// ===================================================
// ФАЙЛ: backend/src/routes/auth.js
// ИСПРАВЛЕНИЯ: Добавлена обработка поля phone при регистрации
// ===================================================

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Регистрация пользователя - ИСПРАВЛЕНО
router.post('/register', async (req, res) => {
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

        // Создаем компанию с триальным периодом на 14 дней
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);
        
        const companyResult = await client.query(
            `INSERT INTO companies (name, tariff_id, status, trial_ends_at, created_at)
             VALUES ($1, $2, 'trial', $3, NOW())
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

        // Создаем пользователя с поддержкой поля phone
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
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    role: 'Владелец',
                    role_id: user.role_id,
                    company_id: user.company_id
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
router.post('/login', async (req, res) => {
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
                u.last_login_at, u.last_login_ip,
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
            'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
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

        res.json({
            success: true,
            token,
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
router.post('/logout', authenticate, async (req, res) => {
    // В JWT нет серверной сессии, поэтому просто возвращаем успех
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = router;