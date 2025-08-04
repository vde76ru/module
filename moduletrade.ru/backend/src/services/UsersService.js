const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class UsersService {
  // Создание нового пользователя
  async createUser(companyId, userData) {
    const { email, password, name, role = 'user' } = userData;

    // Проверяем, существует ли пользователь
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 AND company_id = $2',
      [email, companyId]
    );

    if (existing.rows.length > 0) {
      throw new Error('User with this email already exists in this company');
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const result = await db.query(
      `INSERT INTO users (id, company_id, email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, name, role, is_active, created_at`,
      [uuidv4(), companyId, email, passwordHash, name, role, true]
    );

    return result.rows[0];
  }

  // Аутентификация пользователя
  async authenticate(email, password) {
    // Ищем пользователя во всех тенантах
    const result = await db.query(
      `SELECT u.*, c.id as company_id, c.name as tenant_name, c.is_active as tenant_is_active
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];

    // Проверяем статус тенанта
    if (!user.tenant_is_active) {
      throw new Error('Account suspended');
    }

    // Проверяем пароль
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Генерируем токены
    const accessToken = jwt.sign(
      {
        userId: user.id,
        companyId: user.company_id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, companyId: user.company_id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Обновляем последний вход
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant: {
          id: user.company_id,
          name: user.tenant_name
        }
      },
      tokens: {
        accessToken,
        refreshToken
      }
    };
  }

  // Обновление токена
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Получаем актуальные данные пользователя
      const result = await db.query(
        'SELECT id, email, role FROM users WHERE id = $1 AND is_active = true AND company_id = $2',
        [decoded.userId, decoded.companyId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      // Генерируем новый access token
      const accessToken = jwt.sign(
        {
          userId: user.id,
          companyId: decoded.companyId,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return { accessToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Управление API ключами
  async generateApiKey(companyId, name, permissions = []) {
    const key = `sk_${uuidv4().replace(/-/g, '')}`;
    const keyHash = await bcrypt.hash(key, 10);

    const result = await db.query(
      `INSERT INTO api_keys (id, company_id, name, key_hash, permissions, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, permissions, created_at`,
      [uuidv4(), companyId, name, keyHash, JSON.stringify(permissions), true]
    );

    return {
      ...result.rows[0],
      key // Возвращаем ключ только при создании
    };
  }

  // Валидация API ключа
  async validateApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('sk_')) {
      throw new Error('Invalid API key format');
    }

    // Получаем все активные ключи
    const result = await db.query(`
      SELECT
        ak.*,
        c.is_active as company_is_active
      FROM api_keys ak
      JOIN companies c ON ak.company_id = c.id
      WHERE ak.is_active = true
    `);

    for (const row of result.rows) {
      const isValid = await bcrypt.compare(apiKey, row.key_hash);
      if (isValid) {
        if (!row.company_is_active) {
          throw new Error('Company account suspended');
        }

        // Обновляем время последнего использования
        await db.query(
          'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
          [row.id]
        );

        return {
          company_id: row.company_id,
          permissions: row.permissions
        };
      }
    }

    throw new Error('Invalid API key');
  }

  // Получение списка пользователей
  async getUsers(companyId, filters = {}) {
    let query = `
      SELECT id, email, name, role, is_active, created_at, last_login
      FROM users
      WHERE company_id = $1
    `;
    const params = [companyId];

    if (filters.role) {
      params.push(filters.role);
      query += ` AND role = $${params.length}`;
    }

    if (filters.is_active !== undefined) {
      params.push(filters.is_active);
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  // Обновление пользователя
  async updateUser(companyId, userId, updates) {
    const allowedFields = ['name', 'role', 'is_active'];
    const setClause = [];
    const params = [userId, companyId];
    let paramIndex = 3;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        params.push(updates[field]);
        setClause.push(`${field} = $${paramIndex++}`);
      }
    }

    if (updates.password) {
      const passwordHash = await bcrypt.hash(updates.password, 10);
      params.push(passwordHash);
      setClause.push(`password_hash = $${paramIndex++}`);
    }

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    const result = await db.query(
      `UPDATE users
       SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND company_id = $2
       RETURNING id, email, name, role, is_active`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }

  // Удаление пользователя (мягкое удаление)
  async deleteUser(companyId, userId) {
    const result = await db.query(
      'UPDATE users SET is_active = false WHERE id = $1 AND company_id = $2 RETURNING id',
      [userId, companyId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return { success: true };
  }
}

module.exports = new UsersService();