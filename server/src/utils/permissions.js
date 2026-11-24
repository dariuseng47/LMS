import { pool } from '../db/pool.js';
import {
  getRoleDefaultPermissions,
  getUserPermissionOverrides,
  invalidateUserAuth,
} from './authCache.js';
import { MENU_PERMISSIONS, LEGACY_PERMISSION_REMAP } from '../config/menuCatalog.js';

// Permission catalogue — สร้างจาก server/src/config/menuCatalog.js (source of truth)
// ต้องตรงกับที่ seed ไว้ใน db/migrations/028_rbac_scopes_menu_permissions.sql
//
// key รูปแบบ `<channel>.<module>.<action>` โดย channel ∈ {web, handheld}, action ∈ {view, edit}
// ส่วนที่เป็น ❌ ตายตัว (HQ menu, จัดการ admin โดย admin ฯลฯ) เป็น hard-coded check แยกในโค้ด
// ไม่ผ่าน catalogue นี้ — ดู docs/rbac-permissions.md
export const PERMISSION_CATALOG = MENU_PERMISSIONS.map((p) => ({
  key: p.key,
  base: p.base,
  action: p.action,
  channel: p.channel,
  category: p.category,
  label: p.label,
}));

const PERMISSION_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));

// "แก้ไข" ใช้ได้ต่อเมื่อ "ดู" เปิดอยู่ด้วย — edit key -> view key ของเมนูเดียวกัน (เมนูที่มีแค่ edit ไม่อยู่ในนี้)
const VIEW_KEY_BY_EDIT = new Map(
  PERMISSION_CATALOG.filter((p) => p.action === 'edit' && PERMISSION_KEYS.has(`${p.base}.view`)).map(
    (p) => [p.key, `${p.base}.view`]
  )
);

const ROLE_LOCKED_KEYS = {
  OPERATOR: new Set(MENU_PERMISSIONS.filter((p) => p.isRoleLocked('OPERATOR')).map((p) => p.key)),
};

// เมนูที่เปิดให้ role นี้ไม่ได้ (menuCatalog lockedRoles)
export function isRoleLockedPermission(role, permKey) {
  return !!ROLE_LOCKED_KEYS[role]?.has(permKey);
}

export function isKnownPermissionKey(permKey) {
  return PERMISSION_KEYS.has(permKey);
}

// endpoint ที่ web กับ handheld ยิงมาที่ path เดียวกัน (เช่น เปลี่ยนสถานะผ้า, พัก/ชำรุด) เช็คด้วย
// คีย์เดิม (ก่อน 028) ผ่าน map นี้ -> แปลว่า "มีสิทธิ์ทำ action นี้จากช่องทางใดช่องทางหนึ่ง"
export function permKeysForLegacy(legacyKey) {
  return LEGACY_PERMISSION_REMAP[legacyKey] ?? [legacyKey];
}

// effective(user, perm_key) ตามสูตรใน docs/rbac-permissions.md:
//   superadmin -> true เสมอ
//   เมนูที่ล็อกไว้สำหรับ role นี้ -> false เสมอ
//   มี override -> ใช้ effect นั้น (GRANT/DENY ชนะ default)
//   ไม่มี override -> ใช้ role_default_permissions ของ role นั้น
//   คีย์ .edit -> ต้องมี .view ของเมนูเดียวกันด้วย
// override/default อ่านผ่าน authCache (โหลดทั้งชุดต่อ user/role ครั้งเดียว) — เดิมถาม DB 2 รอบต่อคีย์
export async function hasPermission(userId, role, permKey) {
  if (role === 'SUPERADMIN') return true;
  if (isRoleLockedPermission(role, permKey)) return false;

  const overrides = await getUserPermissionOverrides(userId);
  const defaults = await getRoleDefaultPermissions(role);
  const isOn = (key) =>
    overrides.has(key) ? overrides.get(key) === 'GRANT' : defaults.has(key);

  const viewKey = VIEW_KEY_BY_EDIT.get(permKey);
  return isOn(permKey) && (!viewKey || isOn(viewKey));
}

// true ถ้ามีสิทธิ์ "อย่างน้อยหนึ่ง" คีย์ในลิสต์ — ใช้กับ endpoint ที่ใช้ร่วมกันหลายช่องทาง
export async function hasAnyPermission(userId, role, permKeys) {
  if (role === 'SUPERADMIN') return true;
  for (const key of permKeys) {
    // eslint-disable-next-line no-await-in-loop
    if (await hasPermission(userId, role, key)) return true;
  }
  return false;
}

// คืนค่า effective permission ของ user ครบทุก key ใน catalogue พร้อมบอกด้วยว่า key ไหน
// ถูก override อยู่ (source: 'override' | 'default') และค่า roleDefault ดิบไว้เทียบ/รีเซ็ตกลับ
// (ต้องมีค่านี้แยกจาก effective เพราะตอน override อยู่ effective จะไม่ใช่ค่า default อีกต่อไป)
// superadminLocked = override นี้ superadmin ตั้งไว้ แอดมินของโรงพยาบาลแก้ทับไม่ได้
// selfEffective = ค่าสวิตช์ของคีย์นี้เอง (หน้าตั้งค่าใช้) / effective = ผลจริงหลังรวมเงื่อนไข "แก้ไขต้องมีดู"
// roleLocked = เปิดให้ role นี้ไม่ได้
export async function getEffectivePermissions(userId, role) {
  if (role === 'SUPERADMIN') {
    return PERMISSION_CATALOG.map((p) => ({
      ...p,
      effective: true,
      selfEffective: true,
      roleDefault: true,
      source: 'superadmin',
      superadminLocked: false,
      roleLocked: false,
    }));
  }

  const [overrideRows] = await pool.query(
    'SELECT perm_key, effect, superadmin_locked FROM user_permission_overrides WHERE user_id = ?',
    [userId]
  );
  const overrideMap = new Map(overrideRows.map((r) => [r.perm_key, r]));

  const [defaultRows] = await pool.query(
    'SELECT perm_key FROM role_default_permissions WHERE role = ?',
    [role]
  );
  const defaultSet = new Set(defaultRows.map((r) => r.perm_key));

  const isOn = (key) => {
    if (isRoleLockedPermission(role, key)) return false;
    const override = overrideMap.get(key);
    return override ? override.effect === 'GRANT' : defaultSet.has(key);
  };

  return PERMISSION_CATALOG.map((p) => {
    const override = overrideMap.get(p.key);
    const selfEffective = isOn(p.key);
    const viewKey = VIEW_KEY_BY_EDIT.get(p.key);
    return {
      ...p,
      effective: selfEffective && (!viewKey || isOn(viewKey)),
      selfEffective,
      roleDefault: defaultSet.has(p.key),
      source: override ? 'override' : 'default',
      superadminLocked: !!override?.superadmin_locked,
      roleLocked: isRoleLockedPermission(role, p.key),
    };
  });
}

// เขียน override ทั้งชุด + เพิ่ม perm_version ใน transaction เดียว (สำเร็จหรือล้มเหลวไปพร้อมกัน) แล้วล้าง authCache
// changes = [{ permKey, effect: 'GRANT' | 'DENY' | null }] — null = ลบ override กลับไปใช้ค่าเริ่มต้นของ role
export async function applyPermissionOverrides(userId, changes, { grantedBy, superadminLocked }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { permKey, effect } of changes) {
      if (effect === null) {
        // eslint-disable-next-line no-await-in-loop
        await conn.query('DELETE FROM user_permission_overrides WHERE user_id = ? AND perm_key = ?', [
          userId,
          permKey,
        ]);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await conn.query(
          `INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by, superadmin_locked)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             effect = VALUES(effect),
             granted_by = VALUES(granted_by),
             superadmin_locked = VALUES(superadmin_locked)`,
          [userId, permKey, effect, grantedBy, superadminLocked ? 1 : 0]
        );
      }
    }
    await conn.query('UPDATE users SET perm_version = perm_version + 1 WHERE id = ?', [userId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    invalidateUserAuth(userId);
  }
}

export async function getPermVersion(userId) {
  const [rows] = await pool.query('SELECT perm_version FROM users WHERE id = ?', [userId]);
  return rows[0]?.perm_version ?? 1;
}
