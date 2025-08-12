// backend/src/services/SessionService.js
// Управление пользовательскими сессиями на основе таблицы user_sessions и audit_sessions

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

class SessionService {
  async createSession({ userId, companyId = null, ip_address = null, user_agent = null, ttlHours = 720 } = {}) {
    const sessionToken = uuidv4();
    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO user_sessions (user_id, company_id, session_token, refresh_token, ip_address, user_agent, expires_at, is_active, login_time, last_activity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())`,
      [userId, companyId, sessionToken, refreshToken, ip_address, user_agent, expiresAt]
    );
    await db.query(
      `INSERT INTO audit_sessions (user_id, session_id, ip_address, user_agent, is_active, login_time, last_activity)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (session_id) DO NOTHING`,
      [userId, sessionToken, ip_address, user_agent]
    );
    return { sessionToken, refreshToken, expiresAt };
  }

  async validateSession(sessionToken) {
    const res = await db.query(
      `SELECT * FROM user_sessions WHERE session_token = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())`,
      [sessionToken]
    );
    return res.rows[0] || null;
  }

  async touch(sessionToken) {
    await db.query(`UPDATE user_sessions SET last_activity = NOW() WHERE session_token = $1`, [sessionToken]);
    await db.query(`UPDATE audit_sessions SET last_activity = NOW() WHERE session_id = $1`, [sessionToken]);
  }

  async rotateRefreshToken(sessionToken) {
    const newRefresh = uuidv4();
    await db.query(`UPDATE user_sessions SET refresh_token = $2, updated_at = NOW() WHERE session_token = $1`, [sessionToken, newRefresh]);
    return newRefresh;
  }

  async rotateRefreshByToken(oldRefreshToken) {
    const sel = await db.query('SELECT * FROM user_sessions WHERE refresh_token = $1 AND is_active = true', [oldRefreshToken]);
    if (sel.rows.length === 0) throw new Error('Invalid refresh token');
    const session = sel.rows[0];
    const newRefresh = uuidv4();
    await db.query('UPDATE user_sessions SET refresh_token = $1, last_activity = NOW() WHERE id = $2', [newRefresh, session.id]);
    const accessToken = jwt.sign(
      { userId: session.user_id, companyId: session.company_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return { accessToken, refreshToken: newRefresh };
  }

  async revoke(sessionToken) {
    await db.query(`UPDATE user_sessions SET is_active = false, logout_time = NOW(), updated_at = NOW() WHERE session_token = $1`, [sessionToken]);
    await db.query(`UPDATE audit_sessions SET is_active = false, logout_time = NOW(), updated_at = NOW() WHERE session_id = $1`, [sessionToken]);
    return { success: true };
  }

  async invalidateUserSessions(userId) {
    await db.query('UPDATE user_sessions SET is_active = false, updated_at = NOW() WHERE user_id = $1', [userId]);
  }

  async cleanupExpired() {
    await db.query(`DELETE FROM user_sessions WHERE expires_at IS NOT NULL AND expires_at < NOW()`);
    await db.query(`UPDATE audit_sessions SET is_active = false WHERE logout_time IS NULL AND last_activity < NOW() - INTERVAL '7 days'`);
  }
}

module.exports = new SessionService();


