const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class UsersService {
  // Создание нового пользователя
  async createUser(tenantId, userData) {
    const { email, password, name, role = 'user' } = userData;
    
    // Проверяем, существует ли пользователь
    const existing = await db.query(
      tenantId,
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      throw new Error('User with this email already exists');
    }
    
    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Создаем пользователя
    const result = await db.query(
      tenantId,
      `INSERT INTO users (id, email, password_hash, name, role, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, name, role, is_active, created_at`,
      [uuidv4(), email, passwordHash, name, role, true]
    );
    
    return result.rows[0];
  }
  
  // Аутентификация пользователя
  async authenticate(email, password) {
    // Ищем пользователя во всех тенантах
    const result = await db.mainPool.query(
      `SELECT u.*, t.id as tenant_id, t.name as tenant_name, t.status as tenant_status
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }
    
    const user = result.rows[0];
    
    // Проверяем статус тенанта
    if (user.tenant_status !== 'active') {
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
        tenantId: user.tenant_id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    
    // Обновляем последний вход
    await db.query(
      user.tenant_id,
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
          id: user.tenant_id,
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
        decoded.tenantId,
        'SELECT id, email, role FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = result.rows[0];
      
      // Генерируем новый access token
      const accessToken = jwt.sign(
        { 
          userId: user.id, 
          tenantId: decoded.tenantId,
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
  async generateApiKey(tenantId, name, permissions = []) {
    const key = `sk_${uuidv4().replace(/-/g, '')}`;
    const keyHash = await bcrypt.hash(key, 10);
    
    const result = await db.query(
      tenantId,
      `INSERT INTO api_keys (id, tenant_id, name, key_hash, permissions, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, permissions, created_at`,
      [uuidv4(), tenantId, name, keyHash, JSON.stringify(permissions), true]
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
    const result = await db.mainPool.query(`
      SELECT 
        ak.*,
        t.status as tenant_status
      FROM api_keys ak
      JOIN tenants t ON ak.tenant_id = t.id
      WHERE ak.is_active = true
    `);
    
    for (const row of result.rows) {
      const isValid = await bcrypt.compare(apiKey, row.key_hash);
      if (isValid) {
        if (row.tenant_status !== 'active') {
          throw new Error('Tenant suspended');
        }
        
        // Обновляем время последнего использования
        await db.mainPool.query(
          'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
          [row.id]
        );
        
        return {
          tenant_id: row.tenant_id,
          permissions: row.permissions
        };
      }
    }
    
    throw new Error('Invalid API key');
  }
  
  // Получение списка пользователей
  async getUsers(tenantId, filters = {}) {
    let query = `
      SELECT id, email, name, role, is_active, created_at, last_login
      FROM users
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.role) {
      params.push(filters.role);
      query += ` AND role = $${params.length}`;
    }
    
    if (filters.is_active !== undefined) {
      params.push(filters.is_active);
      query += ` AND is_active = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await db.query(tenantId, query, params);
    return result.rows;
  }
  
  // Обновление пользователя
  async updateUser(tenantId, userId, updates) {
    const allowedFields = ['name', 'role', 'is_active'];
    const setClause = [];
    const params = [userId];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        params.push(updates[field]);
        setClause.push(`${field} = $${params.length}`);
      }
    }
    
    if (updates.password) {
      const passwordHash = await bcrypt.hash(updates.password, 10);
      params.push(passwordHash);
      setClause.push(`password_hash = $${params.length}`);
    }
    
    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    const result = await db.query(
      tenantId,
      `UPDATE users 
       SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, email, name, role, is_active`,
      params
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    return result.rows[0];
  }
  
  // Удаление пользователя (мягкое удаление)
  async deleteUser(tenantId, userId) {
    const result = await db.query(
      tenantId,
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id',
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    return { success: true };
  }
}

module.exports = UsersService;
