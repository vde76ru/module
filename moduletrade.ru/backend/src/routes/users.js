// backend/src/routes/users.js
const express = require('express');
const bcrypt = require('bcrypt');
const { authenticate, checkPermission } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// List users of current company
router.get('/', authenticate, checkPermission('users.view'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search = '', limit = 50, offset = 0, is_active } = req.query;

    const conditions = ['u.company_id = $1'];
    const params = [companyId];
    let idx = 2;

    if (search) {
      conditions.push(`(u.email ILIKE $${idx} OR u.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (is_active === 'true' || is_active === 'false') {
      conditions.push(`u.is_active = $${idx}`);
      params.push(is_active === 'true');
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const listQuery = `
      SELECT u.id, u.email, u.name, u.phone, u.is_active, u.created_at, u.last_login, u.role_id,
             r.code as role, r.name as role_name, COALESCE(r.display_name, r.name) as role_display_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    const countQuery = `SELECT COUNT(*)::int AS total FROM users u WHERE ${whereClause}`;

    const [listRes, countRes] = await Promise.all([
      db.query(listQuery, [...params, parseInt(limit), parseInt(offset)]),
      db.query(countQuery, params),
    ]);

    res.json({
      success: true,
      data: listRes.rows,
      pagination: {
        total: countRes.rows[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user by id
router.get('/:id', authenticate, checkPermission('users.view'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.params.id;
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.phone, u.is_active, u.created_at, u.last_login, u.role_id,
              r.code as role, r.name as role_name, COALESCE(r.display_name, r.name) as role_display_name
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.company_id = $2`,
      [userId, companyId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create user
router.post('/', authenticate, checkPermission('users.create'), async (req, res) => {
  const client = await db.getClient();
  try {
    const companyId = req.user.companyId;
    const { email, password, name, phone, role_id, role } = req.body || {};
    if (!email || !password || !name || (!role_id && !role)) {
      return res.status(400).json({ success: false, error: 'email, password, name and role (or role_id) are required' });
    }

    await client.query('BEGIN');
    const dup = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (dup.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'User with this email already exists' });
    }
    // Resolve role_id by role code/name if not provided
    let effectiveRoleId = role_id;
    if (!effectiveRoleId && role) {
      const roleRes = await client.query('SELECT id FROM roles WHERE code = $1 OR name = $1 LIMIT 1', [role]);
      if (roleRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Invalid role' });
      }
      effectiveRoleId = roleRes.rows[0].id;
    }
    const hashed = await bcrypt.hash(password, 10);
    const ins = await client.query(
      `INSERT INTO users (email, password_hash, name, phone, company_id, role_id, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,true,NOW(),NOW())
       RETURNING id, email, name, phone, company_id, role_id, is_active, created_at`,
      [email, hashed, name, phone || null, companyId, effectiveRoleId]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update user
router.put('/:id', authenticate, checkPermission('users.update'), async (req, res) => {
  const client = await db.getClient();
  try {
    const companyId = req.user.companyId;
    const userId = req.params.id;
    const { name, phone, role_id, role, is_active, password } = req.body || {};

    await client.query('BEGIN');
    const exists = await client.query('SELECT id FROM users WHERE id = $1 AND company_id = $2', [userId, companyId]);
    if (exists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const fields = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name); }
    if (phone !== undefined) { fields.push(`phone = $${i++}`); values.push(phone); }
    let effectiveRoleId = role_id;
    if (!effectiveRoleId && role) {
      const roleRes = await client.query('SELECT id FROM roles WHERE code = $1 OR name = $1 LIMIT 1', [role]);
      if (roleRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Invalid role' });
      }
      effectiveRoleId = roleRes.rows[0].id;
    }
    if (effectiveRoleId !== undefined && effectiveRoleId !== null) { fields.push(`role_id = $${i++}`); values.push(effectiveRoleId); }
    if (typeof is_active === 'boolean') { fields.push(`is_active = $${i++}`); values.push(is_active); }
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      fields.push(`password_hash = $${i++}`); values.push(hashed);
    }
    fields.push(`updated_at = NOW()`);
    if (fields.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} AND company_id = $${i + 1} RETURNING id, email, name, phone, role_id, is_active`;
    const upd = await client.query(query, [...values, userId, companyId]);
    await client.query('COMMIT');
    res.json({ success: true, data: upd.rows[0] });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Delete (soft-deactivate) user
router.delete('/:id', authenticate, checkPermission('users.delete'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.params.id;
    const upd = await db.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2 RETURNING id',
      [userId, companyId]
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;


