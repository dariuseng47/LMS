import bcrypt from 'bcryptjs';

import { pool } from '../db/pool.js';
import { hashPin } from '../utils/pin.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { invalidateUserAuth } from '../utils/authCache.js';
import { isOnline } from '../sockets/presence.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hasPermission } from '../utils/permissions.js';
import { listAccessibleHospitals } from '../utils/tenant.js';
import {
  getUserScopeRows,
  normalizeScopeInput,
  assertScopesWithinDelegator,
  replaceUserScopes,
  primaryHospitalId,
} from '../utils/userScopes.js';

/**
 * GET /api/v1/users/me/hospitals — โรงพยาบาลที่บัญชีนี้เข้าถึงได้ + ธง canEdit ต่อแห่ง
 * ใช้โดยตัวสลับโรงพยาบาลทั้งฝั่งเว็บและ nativeapp (ทุก role รวม superadmin)
 */
export const getMyHospitals = asyncHandler(async (req, res) => {
  const hospitals = await listAccessibleHospitals(req);
  return res.json({ hospitals });
});

// PIN/รหัสผ่านเก็บเป็น hash ทางเดียว ดูค่าเดิมไม่ได้ — ส่งให้หน้าเว็บแค่ว่า "มี PIN แล้วหรือยัง"
function sanitizeUser(user) {
  const { password_hash: _passwordHash, pin_hash: pinHash, ...safeUser } = user;
  return { ...safeUser, has_pin: !!pinHash };
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
    // แอดมินเห็นพนักงานในทุกโรงพยาบาลที่ตัวเองดูแล (scope) — เทียบทั้ง hospital_id หลัก
    // และ user_hospital_scopes (เผื่อพนักงานถูกผูกหลายโรงพยาบาล)
    const adminScopes = await getUserScopeRows(req.auth.userId);
    const scopeIds = adminScopes.map((s) => s.hospitalId);
    if (scopeIds.length === 0 && req.auth.hospitalId) scopeIds.push(req.auth.hospitalId);

    if (scopeIds.length === 0) {
      return res.json({ users: [] });
    }
    const placeholders = scopeIds.map(() => '?').join(',');
    conditions.push(
      `(hospital_id IN (${placeholders}) OR id IN (SELECT user_id FROM user_hospital_scopes WHERE hospital_id IN (${placeholders})))`
    );
    values.push(...scopeIds, ...scopeIds);
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

// โหลดธง delegation ของ actor (แอดมิน) — can_manage_subordinates / handheld_enabled
async function loadActorFlags(userId) {
  const [rows] = await pool.query(
    'SELECT can_manage_subordinates, handheld_enabled FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  return {
    canManageSubordinates: !!rows[0]?.can_manage_subordinates,
    handheldEnabled: !!rows[0]?.handheld_enabled,
  };
}

/**
 * POST /api/v1/users
 * Cascading delegation ตาม docs/rbac-permissions.md:
 * - superadmin สร้าง SUPERADMIN (ไม่มี hospital) หรือ ADMIN/OPERATOR ให้โรงพยาบาลใดก็ได้
 *   (ระบุ hospitalScopes[] หรือ hospitalId เดี่ยว) + ตั้ง handheldEnabled / canManageSubordinates ได้
 * - admin สร้างได้เฉพาะ OPERATOR และต่อเมื่อ can_manage_subordinates ของตัวเอง = true
 *   scope ที่มอบให้ต้องเป็น subset ของ scope ตัวเอง (can_edit ก็ต้องไม่เกิน)
 */
export const createUser = asyncHandler(async (req, res) => {
  const { username, password, pin, fullName, phone, role } = req.body;

  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์สร้างบัญชีผู้ใช้');
  }

  let scopes = normalizeScopeInput(req.body);
  let handheldEnabled = req.body.handheldEnabled !== false; // default: true
  let canManageSubordinates = role === 'ADMIN' ? req.body.canManageSubordinates !== false : false;

  if (req.auth.role === 'SUPERADMIN') {
    if (role === 'SUPERADMIN') {
      scopes = [];
      canManageSubordinates = false;
    } else if (scopes.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ต้องระบุโรงพยาบาลอย่างน้อย 1 แห่งเมื่อสร้างบัญชี admin/operator');
    }
  } else {
    // ADMIN
    if (role !== 'OPERATOR') {
      throw new AppError(403, 'FORBIDDEN', 'admin สร้างได้เฉพาะบัญชี operator เท่านั้น');
    }
    const flags = await loadActorFlags(req.auth.userId);
    if (!flags.canManageSubordinates) {
      throw new AppError(403, 'FORBIDDEN', 'บัญชีของคุณไม่ได้รับอนุญาตให้สร้าง/จัดการพนักงาน');
    }
    // ไม่ระบุ scope มา -> สืบทอด scope ทั้งหมดของแอดมิน
    if (scopes.length === 0) {
      scopes = await getUserScopeRows(req.auth.userId);
      if (scopes.length === 0 && req.auth.hospitalId) {
        scopes = [{ hospitalId: req.auth.hospitalId, canEdit: true }];
      }
    }
    await assertScopesWithinDelegator(req.auth, scopes);
    canManageSubordinates = false; // operator ไม่มีลูกน้อง
    if (!flags.handheldEnabled) handheldEnabled = false; // มอบเกินตัวเองไม่ได้
  }

  const targetHospitalId = primaryHospitalId(scopes, req.auth.hospitalId);

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
    `INSERT INTO users
       (hospital_id, role, managed_by, username, password_hash, pin_hash, full_name, phone,
        is_active, handheld_enabled, can_manage_subordinates)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)`,
    [
      targetHospitalId,
      role,
      req.auth.userId,
      username,
      passwordHash,
      pinHash,
      fullName,
      phone ?? null,
      handheldEnabled ? 1 : 0,
      canManageSubordinates ? 1 : 0,
    ]
  );

  if (scopes.length > 0) {
    await replaceUserScopes(result.insertId, scopes, req.auth.userId);
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

  await logAudit({
    hospitalId: targetHospitalId,
    userId: req.auth.userId,
    action: 'USER_CREATED',
    entityType: 'user',
    entityId: result.insertId,
    metadata: { username, role, scopes, handheldEnabled, canManageSubordinates },
  });

  return res.status(201).json({ user: sanitizeUser(rows[0]), scopes });
});

export async function findTargetUser(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [
    id,
  ]);
  return rows[0];
}

// hard-coded boundary ตาม docs/rbac-permissions.md — ห้าม override เด็ดขาด
// (ใช้ร่วมกับ permissions.controller.js ด้วย เพราะกฎ "ใครจัดการใครได้" เหมือนกันทุกประตู)
// async เพราะต้องเทียบ user_hospital_scopes ของทั้งสองฝั่ง (แอดมินดูแลได้หลายโรงพยาบาล)
export async function assertCanManage(actingAuth, targetUser) {
  if (!targetUser) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบผู้ใช้งานนี้');
  }
  if (actingAuth.role === 'SUPERADMIN') return;

  if (actingAuth.role === 'ADMIN') {
    if (targetUser.role !== 'OPERATOR') {
      throw new AppError(403, 'FORBIDDEN', 'admin จัดการได้เฉพาะบัญชี operator เท่านั้น');
    }

    const adminScopes = await getUserScopeRows(actingAuth.userId);
    const targetScopes = await getUserScopeRows(targetUser.id);

    // บัญชีเก่าที่ยังไม่มี scope — เทียบ hospital_id เดี่ยวเหมือนเดิม
    if (adminScopes.length === 0 || targetScopes.length === 0) {
      if (targetUser.hospital_id !== actingAuth.hospitalId) {
        throw new AppError(403, 'FORBIDDEN', 'admin จัดการได้เฉพาะ operator ในโรงพยาบาลตัวเอง');
      }
      return;
    }

    // ต้องมีโรงพยาบาลร่วมกันอย่างน้อย 1 แห่งที่แอดมิน can_edit
    const canReach = targetScopes.some((t) =>
      adminScopes.some((a) => a.hospitalId === t.hospitalId && a.canEdit)
    );
    if (!canReach) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์จัดการพนักงานคนนี้ (ไม่มีโรงพยาบาลร่วมกัน)');
    }
    return;
  }

  throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์จัดการบัญชีผู้ใช้');
}

// ตั้งรหัสผ่าน/PIN ให้คนอื่น = เข้าใช้งานในนามคนนั้นได้ จึงเข้มกว่า assertCanManage (ที่ขอแค่มีโรงพยาบาลร่วมกัน):
// แอดมินต้องได้รับอนุญาตให้จัดการพนักงาน และพนักงานคนนั้นต้องไม่มีสิทธิ์เกินแอดมิน ทั้งโรงพยาบาลที่เข้าถึงได้
// และสิทธิ์เมนูที่ถูกเปิดเพิ่มให้เป็นรายบุคคล (GRANT) ไม่งั้นแอดมินใช้ช่องทางนี้ยกระดับสิทธิ์ตัวเองได้
// (บัญชี superadmin มีแต่ superadmin ด้วยกันที่แก้ได้ — assertCanManage กันแอดมินไว้แล้ว)
async function assertCanResetCredentials(actingAuth, targetUser) {
  if (actingAuth.role === 'SUPERADMIN') return;

  const flags = await loadActorFlags(actingAuth.userId);
  if (!flags.canManageSubordinates) {
    throw new AppError(403, 'FORBIDDEN', 'บัญชีของคุณไม่ได้รับอนุญาตให้สร้าง/จัดการพนักงาน');
  }

  const exceedsActor = () =>
    new AppError(
      403,
      'FORBIDDEN',
      'พนักงานคนนี้มีสิทธิ์มากกว่าบัญชีของคุณ จึงเปลี่ยนรหัสผ่าน/PIN ให้ไม่ได้ กรุณาติดต่อ superadmin'
    );

  let ownScopes = await getUserScopeRows(actingAuth.userId);
  if (ownScopes.length === 0 && actingAuth.hospitalId) {
    ownScopes = [{ hospitalId: actingAuth.hospitalId, canEdit: true }]; // บัญชีเก่าที่ยังไม่มี scope
  }
  const ownByHospital = new Map(ownScopes.map((s) => [s.hospitalId, s]));
  const targetScopes = await getUserScopeRows(targetUser.id);
  const withinScopes = targetScopes.every((t) => {
    const own = ownByHospital.get(t.hospitalId);
    return own && (own.canEdit || !t.canEdit);
  });
  if (!withinScopes) throw exceedsActor();

  const [grants] = await pool.query(
    "SELECT perm_key FROM user_permission_overrides WHERE user_id = ? AND effect = 'GRANT'",
    [targetUser.id]
  );
  for (const { perm_key: permKey } of grants) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await hasPermission(actingAuth.userId, actingAuth.role, permKey))) throw exceedsActor();
  }
}

/**
 * PATCH /api/v1/users/:id
 * - password / pin : ตั้งใหม่ให้ผู้ใช้ (ดู assertCanResetCredentials) — เตะทุกเซสชันเดิมของบัญชีนั้นออกทันที
 * - role     : เฉพาะ superadmin สลับ ADMIN <-> OPERATOR — ล้างสิทธิ์เมนูรายบุคคลกลับไปใช้ค่าเริ่มต้นของ
 *              บทบาทใหม่ (ไม่งั้น GRANT ที่เคยเปิดตอนเป็นแอดมินจะติดตัวไปตอนลดเป็น operator)
 */
export const updateUser = asyncHandler(async (req, res) => {
  const targetUser = await findTargetUser(req.params.id);
  await assertCanManage(req.auth, targetUser);

  const { fullName, phone, isActive, handheldEnabled, canManageSubordinates, password, pin, role } =
    req.body;
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
  if (handheldEnabled !== undefined) {
    // แอดมินมอบสิทธิ์ handheld ให้พนักงานได้ไม่เกินตัวเอง
    if (req.auth.role === 'ADMIN' && handheldEnabled) {
      const flags = await loadActorFlags(req.auth.userId);
      if (!flags.handheldEnabled) {
        throw new AppError(403, 'FORBIDDEN', 'บัญชีของคุณเองไม่มีสิทธิ์ใช้เครื่องพกพา จึงมอบให้ผู้อื่นไม่ได้');
      }
    }
    updates.push('handheld_enabled = ?');
    values.push(handheldEnabled ? 1 : 0);
  }

  const roleChanged = role !== undefined && role !== targetUser.role;
  const nextRole = roleChanged ? role : targetUser.role;
  // ค่าเริ่มต้นเดียวกับตอนสร้างบัญชี: admin จัดการพนักงานได้, operator ไม่มีลูกน้อง
  let nextCanManage = roleChanged ? nextRole === 'ADMIN' : undefined;
  if (roleChanged) {
    if (req.auth.role !== 'SUPERADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'เฉพาะ superadmin ที่เปลี่ยนบทบาทของผู้ใช้ได้');
    }
    if (targetUser.role === 'SUPERADMIN') {
      throw new AppError(400, 'VALIDATION_ERROR', 'เปลี่ยนบทบาทของบัญชี superadmin ไม่ได้');
    }
    updates.push('role = ?');
    values.push(nextRole);
  }
  if (canManageSubordinates !== undefined) {
    // เฉพาะ superadmin เท่านั้นที่ตั้ง "แอดมินคนนี้สร้างพนักงานได้ไหม"
    if (req.auth.role !== 'SUPERADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'เฉพาะ superadmin ที่ตั้งค่าสิทธิ์สร้างพนักงานของแอดมินได้');
    }
    if (nextRole !== 'ADMIN') {
      throw new AppError(400, 'VALIDATION_ERROR', 'ตั้งค่านี้ได้เฉพาะบัญชี admin');
    }
    nextCanManage = canManageSubordinates;
  }
  if (nextCanManage !== undefined) {
    updates.push('can_manage_subordinates = ?');
    values.push(nextCanManage ? 1 : 0);
  }

  const credentialsChanged = password !== undefined || pin !== undefined;
  if (credentialsChanged) await assertCanResetCredentials(req.auth, targetUser);
  if (password !== undefined) {
    updates.push('password_hash = ?');
    values.push(await bcrypt.hash(password, 12));
  }
  if (pin !== undefined) {
    updates.push('pin_hash = ?'); // ซ้ำกับคนอื่น -> UNIQUE ของ DB จับได้ตอน UPDATE ด้านล่าง
    values.push(hashPin(pin));
  }

  if (roleChanged || credentialsChanged) {
    // access token เดิม (มี role เก่าฝังอยู่) ใช้ต่อไม่ได้ตั้งแต่ request ถัดไป — ดู authenticate.js PERM_STALE
    updates.push('perm_version = perm_version + 1');
  }

  // เปลี่ยนชุดโรงพยาบาล (scope)
  let newScopes;
  if (Array.isArray(req.body.hospitalScopes) && targetUser.role !== 'SUPERADMIN') {
    newScopes = normalizeScopeInput(req.body);
    await assertScopesWithinDelegator(req.auth, newScopes);
  }

  if (updates.length === 0 && !newScopes) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  if (newScopes) {
    updates.push('hospital_id = ?');
    values.push(primaryHospitalId(newScopes, targetUser.hospital_id));
  }

  // เปลี่ยนบทบาท + ล้าง override / เปลี่ยนรหัสผ่าน,PIN + เพิกถอนเซสชัน ต้องสำเร็จหรือล้มเหลวไปพร้อมกัน
  let clearedOverrides;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [
      ...values,
      targetUser.id,
    ]);
    if (roleChanged) {
      [clearedOverrides] = await conn.query(
        'SELECT perm_key, effect, superadmin_locked FROM user_permission_overrides WHERE user_id = ?',
        [targetUser.id]
      );
      await conn.query('DELETE FROM user_permission_overrides WHERE user_id = ?', [targetUser.id]);
    }
    if (credentialsChanged) {
      await conn.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
        [targetUser.id]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (pin !== undefined && err.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'PIN_TAKEN', 'PIN นี้ถูกใช้แล้ว กรุณาเลือก PIN อื่น');
    }
    throw err;
  } finally {
    conn.release();
    // is_active / role / hospital_id ฯลฯ เปลี่ยน — ให้ authenticate อ่านค่าใหม่จาก DB ใน request ถัดไปทันที
    invalidateUserAuth(targetUser.id);
  }

  if (newScopes) {
    await replaceUserScopes(targetUser.id, newScopes, req.auth.userId); // ล้าง cache ให้เองอีกรอบ
  }

  await logAudit({
    hospitalId: targetUser.hospital_id,
    userId: req.auth.userId,
    action: 'USER_UPDATED',
    entityType: 'user',
    entityId: targetUser.id,
    metadata: {
      fullName,
      phone,
      isActive,
      handheldEnabled,
      canManageSubordinates: nextCanManage,
      scopes: newScopes,
      // ห้ามเก็บตัวรหัสผ่าน/PIN/hash ลง audit — บันทึกแค่ว่ามีการเปลี่ยน
      passwordChanged: password !== undefined ? true : undefined,
      pinChanged: pin !== undefined ? true : undefined,
      roleChange: roleChanged ? { from: targetUser.role, to: nextRole } : undefined,
      clearedOverrides, // เก็บค่าเดิมไว้เผื่อต้องตั้งคืน
    },
  });

  return res.status(204).send();
});

/**
 * DELETE /api/v1/users/:id — soft delete
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const targetUser = await findTargetUser(req.params.id);
  await assertCanManage(req.auth, targetUser);

  await pool.query('UPDATE users SET deleted_at = NOW(), is_active = FALSE WHERE id = ?', [
    req.params.id,
  ]);
  invalidateUserAuth(targetUser.id); // บัญชีที่ถูกลบต้องโดนบล็อกตั้งแต่ request ถัดไป ไม่ใช่รอ TTL

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
