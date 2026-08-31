import bcrypt from 'bcryptjs';

import { pool } from '../db/pool.js';
import { hashPin } from '../utils/pin.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { isOnline } from '../sockets/presence.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listAccessibleHospitals } from '../utils/tenant.js';

/**
 * GET /api/v1/users/me/hospitals — โรงพยาบาลที่บัญชีนี้เข้าถึงได้ + ธง canEdit ต่อแห่ง
 * ใช้โดยตัวสลับโรงพยาบาลทั้งฝั่งเว็บและ nativeapp (ทุก role รวม superadmin)
 */
export const getMyHospitals = asyncHandler(async (req, res) => {
  const hospitals = await listAccessibleHospitals(req);
  return res.json({ hospitals });
});

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

  if (req.query.role) {
    const roles = req.query.role
      .split(',')
      .map((role) => role.trim().toUpperCase())
      .filter((role) => ['SUPERADMIN', 'ADMIN', 'OPERATOR'].includes(role));
    if (roles.length > 0) {
      conditions.push('role IN (?)');
      values.push(roles);
    }
  }

  const [rows] = await pool.query(
    `SELECT * FROM users WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    values
  );

  // isOnline มาจาก in-memory socket presence (server/src/sockets/presence.js) ไม่ใช่คอลัมน์ DB —
  // ใช้ดูว่า handheld/เว็บของ user นี้เปิดแอปค้างอยู่ตอนนี้ไหม (ดู last_login_at/last_login_client
  // คู่กันสำหรับ "ล็อกอินล่าสุดเมื่อไหร่จากช่องทางไหน")
  const users = rows.map((row) => ({ ...sanitizeUser(row), isOnline: isOnline(row.id) }));

  return res.json({ users });
});

/**
 * POST /api/v1/users
 * Cascading delegation ตาม docs/rbac-permissions.md:
 * - superadmin สร้าง SUPERADMIN คนอื่นได้ (ไม่มี hospital), หรือสร้าง ADMIN/OPERATOR ให้ hospital ไหนก็ได้ (ต้องระบุ hospitalId)
 * - admin สร้างได้เฉพาะ OPERATOR ในโรงพยาบาลตัวเองเท่านั้น (ไม่สนใจ hospitalId ที่ส่งมา บังคับเป็นของตัวเองเสมอ)
 */
export const createUser = asyncHandler(async (req, res) => {
  const { username, password, pin, fullName, phone, role, hospitalId } = req.body;

  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์สร้างบัญชีผู้ใช้');
  }

  let targetHospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    if (role === 'SUPERADMIN') {
      // superadmin ไม่มี hospital — เพิกเฉย hospitalId แม้จะส่งมา
      targetHospitalId = null;
    } else {
      if (!hospitalId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'ต้องระบุ hospitalId เมื่อ superadmin เป็นคนสร้างบัญชี');
      }
      targetHospitalId = hospitalId;
    }
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

  const pinHash = hashPin(pin);
  const [existingPin] = await pool.query('SELECT id FROM users WHERE pin_hash = ? LIMIT 1', [
    pinHash,
  ]);
  if (existingPin[0]) {
    throw new AppError(409, 'PIN_TAKEN', 'PIN นี้ถูกใช้แล้ว กรุณาเลือก PIN อื่น');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [result] = await pool.query(
    `INSERT INTO users (hospital_id, role, managed_by, username, password_hash, pin_hash, full_name, phone, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
    [targetHospitalId, role, req.auth.userId, username, passwordHash, pinHash, fullName, phone ?? null]
  );

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

  await logAudit({
    hospitalId: targetHospitalId,
    userId: req.auth.userId,
    action: 'USER_CREATED',
    entityType: 'user',
    entityId: result.insertId,
    metadata: { username, role },
  });

  return res.status(201).json({ user: sanitizeUser(rows[0]) });
});

export async function findTargetUser(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [
    id,
  ]);
  return rows[0];
}

// hard-coded boundary ตาม docs/rbac-permissions.md — ห้าม override เด็ดขาด
// (ใช้ร่วมกับ permissions.controller.js ด้วย เพราะกฎ "ใครจัดการใครได้" เหมือนกันทุกประตู)
export function assertCanManage(actingAuth, targetUser) {
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

  await logAudit({
    hospitalId: targetUser.hospital_id,
    userId: req.auth.userId,
    action: 'USER_UPDATED',
    entityType: 'user',
    entityId: targetUser.id,
    metadata: { fullName, phone, isActive },
  });

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

  await logAudit({
    hospitalId: targetUser.hospital_id,
    userId: req.auth.userId,
    action: 'USER_DELETED',
    entityType: 'user',
    entityId: targetUser.id,
    metadata: { username: targetUser.username },
  });

  return res.status(204).send();
});
