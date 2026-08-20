import bcrypt from 'bcryptjs';

import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function sanitizeUser(user) {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * GET /api/v1/users
 * superadmin: เห็นทุกคน (filter ?hospitalId= ได้) / admin: เห็นเฉพาะ tenant ตัวเอง (บังคับ ไม่สนใจ query)
 */
export const listUsers = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }

  const conditions = ['deleted_at IS NULL'];
  const values = [];

  if (req.auth.role === 'ADMIN') {
    conditions.push('hospital_id = ?');
    values.push(req.auth.hospitalId);
  } else if (req.query.hospitalId) {
    conditions.push('hospital_id = ?');
    values.push(req.query.hospitalId);
  }

  const [rows] = await pool.query(
    `SELECT * FROM users WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    values
  );

  return res.json({ users: rows.map(sanitizeUser) });
});

/**
 * POST /api/v1/users
 * Cascading delegation ตาม docs/rbac-permissions.md:
 * - superadmin สร้าง ADMIN หรือ OPERATOR ให้ hospital ไหนก็ได้ (ต้องระบุ hospitalId)
 * - admin สร้างได้เฉพาะ OPERATOR ในโรงพยาบาลตัวเองเท่านั้น (ไม่สนใจ hospitalId ที่ส่งมา บังคับเป็นของตัวเองเสมอ)
 */
export const createUser = asyncHandler(async (req, res) => {
  const { username, password, fullName, phone, role, hospitalId } = req.body;

  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์สร้างบัญชีผู้ใช้');
  }

  let targetHospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    if (!hospitalId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ต้องระบุ hospitalId เมื่อ superadmin เป็นคนสร้างบัญชี');
    }
    targetHospitalId = hospitalId;
  } else {
    // ADMIN — ห้ามมอบสิทธิ์เกินตัวเอง: สร้างได้แค่ OPERATOR และต้องอยู่ tenant เดียวกับตัวเองเท่านั้น
    if (role !== 'OPERATOR') {
      throw new AppError(403, 'FORBIDDEN', 'admin สร้างได้เฉพาะบัญชี operator เท่านั้น');
    }
    targetHospitalId = req.auth.hospitalId;
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [
    username,
  ]);
  if (existing[0]) {
    throw new AppError(409, 'USERNAME_TAKEN', 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [result] = await pool.query(
    `INSERT INTO users (hospital_id, role, managed_by, username, password_hash, full_name, phone, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
    [targetHospitalId, role, req.auth.userId, username, passwordHash, fullName, phone ?? null]
  );

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

  return res.status(201).json({ user: sanitizeUser(rows[0]) });
});

async function findTargetUser(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [
    id,
  ]);
  return rows[0];
}

// hard-coded boundary ตาม docs/rbac-permissions.md — ห้าม override เด็ดขาด
function assertCanManage(actingAuth, targetUser) {
  if (!targetUser) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบผู้ใช้งานนี้');
  }
  if (actingAuth.role === 'SUPERADMIN') return;

  if (actingAuth.role === 'ADMIN') {
    if (targetUser.role !== 'OPERATOR' || targetUser.hospital_id !== actingAuth.hospitalId) {
      throw new AppError(403, 'FORBIDDEN', 'admin จัดการได้เฉพาะ operator ในโรงพยาบาลตัวเองเท่านั้น');
    }
    return;
  }

  throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์จัดการบัญชีผู้ใช้');
}

/**
 * PATCH /api/v1/users/:id
 */
export const updateUser = asyncHandler(async (req, res) => {
  const targetUser = await findTargetUser(req.params.id);
  assertCanManage(req.auth, targetUser);

  const { fullName, phone, isActive } = req.body;
  const updates = [];
  const values = [];
  if (fullName !== undefined) {
    updates.push('full_name = ?');
    values.push(fullName);
  }
  if (phone !== undefined) {
    updates.push('phone = ?');
    values.push(phone);
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(isActive);
  }

  if (updates.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [
    ...values,
    req.params.id,
  ]);

  return res.status(204).send();
});

/**
 * DELETE /api/v1/users/:id — soft delete
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const targetUser = await findTargetUser(req.params.id);
  assertCanManage(req.auth, targetUser);

  await pool.query('UPDATE users SET deleted_at = NOW(), is_active = FALSE WHERE id = ?', [
    req.params.id,
  ]);

  return res.status(204).send();
});
