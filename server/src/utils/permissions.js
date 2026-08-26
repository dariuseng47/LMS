import { pool } from '../db/pool.js';

// Permission catalogue — ต้องตรงกับที่ seed ไว้ใน db/migrations/003_permission_overrides.sql
// เฉพาะรายการที่ configure ได้จริงผ่าน user_permission_overrides (ช่อง ⚙️ ใน docs/rbac-permissions.md)
// ส่วนที่เป็น ❌ ตายตัว (จัดการ admin, จัดการ operator โดย operator, HQ menu) เป็น hard-coded
// check ในโค้ดแยกต่างหาก ไม่ผ่าน catalogue นี้
export const PERMISSION_CATALOG = [
  {
    key: 'fabric.lot.create',
    category: 'fabric',
    label: 'ลงทะเบียนล็อตผ้าใหม่ / นำเข้าล็อต',
  },
  {
    key: 'fabric.item.hold',
    category: 'fabric',
    label: 'พักใช้งาน / แทงชำรุดผ้า',
  },
  {
    key: 'device.caretaker.update',
    category: 'device',
    label: 'แก้ไขข้อมูลผู้ดูแลอุปกรณ์ (ชื่อ/เบอร์โทร)',
  },
  {
    key: 'dashboard.hospital_profile.view',
    category: 'dashboard',
    label: 'ดูแดชบอร์ดโปรไฟล์โรงพยาบาล',
  },
];

const PERMISSION_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));

export function isKnownPermissionKey(permKey) {
  return PERMISSION_KEYS.has(permKey);
}

// effective(user, perm_key) ตามสูตรใน docs/rbac-permissions.md:
//   superadmin -> true เสมอ
//   มี override -> ใช้ effect นั้น (GRANT/DENY ชนะ default)
//   ไม่มี override -> ใช้ role_default_permissions ของ role นั้น
export async function hasPermission(userId, role, permKey) {
  if (role === 'SUPERADMIN') return true;

  const [overrides] = await pool.query(
    'SELECT effect FROM user_permission_overrides WHERE user_id = ? AND perm_key = ? LIMIT 1',
    [userId, permKey]
  );
  if (overrides[0]) return overrides[0].effect === 'GRANT';

  const [defaults] = await pool.query(
    'SELECT 1 FROM role_default_permissions WHERE role = ? AND perm_key = ? LIMIT 1',
    [role, permKey]
  );
  return !!defaults[0];
}

// คืนค่า effective permission ของ user ครบทุก key ใน catalogue พร้อมบอกด้วยว่า key ไหน
// ถูก override อยู่ (source: 'override' | 'default') และค่า roleDefault ดิบไว้เทียบ/รีเซ็ตกลับ
// (ต้องมีค่านี้แยกจาก effective เพราะตอน override อยู่ effective จะไม่ใช่ค่า default อีกต่อไป)
export async function getEffectivePermissions(userId, role) {
  if (role === 'SUPERADMIN') {
    return PERMISSION_CATALOG.map((p) => ({
      ...p,
      effective: true,
      roleDefault: true,
      source: 'superadmin',
    }));
  }

  const [overrideRows] = await pool.query(
    'SELECT perm_key, effect FROM user_permission_overrides WHERE user_id = ?',
    [userId]
  );
  const overrideMap = new Map(overrideRows.map((r) => [r.perm_key, r.effect]));

  const [defaultRows] = await pool.query(
    'SELECT perm_key FROM role_default_permissions WHERE role = ?',
    [role]
  );
  const defaultSet = new Set(defaultRows.map((r) => r.perm_key));

  return PERMISSION_CATALOG.map((p) => {
    const roleDefault = defaultSet.has(p.key);
    const override = overrideMap.get(p.key);
    if (override) {
      return { ...p, effective: override === 'GRANT', roleDefault, source: 'override' };
    }
    return { ...p, effective: roleDefault, roleDefault, source: 'default' };
  });
}

export async function incrementPermVersion(userId) {
  await pool.query('UPDATE users SET perm_version = perm_version + 1 WHERE id = ?', [userId]);
}

export async function getPermVersion(userId) {
  const [rows] = await pool.query('SELECT perm_version FROM users WHERE id = ?', [userId]);
  return rows[0]?.perm_version ?? 1;
}
