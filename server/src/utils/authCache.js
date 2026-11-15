import { pool } from '../db/pool.js';

// ============================================================================
// In-memory cache ของ "บริบทสิทธิ์" ที่ทุก request ต้องอ่านซ้ำ ๆ จาก DB
//
// ก่อนมี cache: 1 request (เช่น POST /tracking/lookup ตอนสแกนผ้า) ต้องถาม DB ก่อนถึง query จริง 3–6 รอบ
//   authenticate        -> users (perm_version/is_active/deleted_at)          1 รอบ
//   resolveTenantId     -> user_hospital_scopes                               1 รอบ
//   requirePermission   -> user_permission_overrides + role_default_permissions 2 รอบ "ต่อคีย์"
// DB อยู่คนละเครื่องกับ Node (RTT ~15–20ms ต่อรอบ) = เสียเวลาฟรี ~50–120ms ทุก request
//
// ข้อมูลกลุ่มนี้แทบไม่เปลี่ยน และจุดที่เขียนมีไม่กี่ที่ — ทุกจุดเรียก invalidateUserAuth(userId) ทันที:
//   - users.controller.js       updateUser / deleteUser  (is_active, deleted_at, scope, ...)
//   - userScopes.js             replaceUserScopes
//   - permissions.js            incrementPermVersion (ทุกครั้งที่แก้ override สิทธิ์)
// TTL เป็นตาข่ายกันพลาดชั้นที่สอง (แก้ DB ตรง ๆ / รันหลาย process) ไม่ใช่กลไกหลัก
//
// ⚠ cache อยู่ใน memory ของ process เดียว — ถ้า Plesk/Passenger รัน Node หลาย process การ invalidate
//   จะมีผลแค่ process ที่รับ request แก้ไขนั้น process อื่นรอหมด TTL (สูงสุด USER_TTL_MS) ดูคำแนะนำ
//   ตั้งค่า Plesk ใน server/README.md (ตั้ง 1 process — socket.io ก็ต้องการแบบนั้นอยู่แล้ว)
//
// ไม่ cache ข้อมูลผ้า (สถานะ/ตำแหน่ง/สแกนล่าสุด) ที่นี่โดยตั้งใจ — เปลี่ยนทุกครั้งที่สแกนผ่านทุกจุด
// (รับผ้า/ชั่ง/จ่ายวอร์ด/ตรวจตู้/เปลี่ยนสถานะ ฯลฯ ~15 จุดเขียน) ผิดนิดเดียวก็โชว์สถานะผิด และ query
// lookup เองใช้ index อยู่แล้ว (เร็วพอ ๆ กับ RTT 1 รอบ) — คุ้มน้อย เสี่ยงมาก
// ============================================================================

const USER_TTL_MS = 30 * 1000; // สถานะบัญชี — สั้นสุด (ปิดบัญชีต้องมีผลเร็ว)
const SCOPE_TTL_MS = 60 * 1000;
const OVERRIDE_TTL_MS = 60 * 1000;
const ROLE_DEFAULT_TTL_MS = 5 * 60 * 1000; // เปลี่ยนเฉพาะตอนรัน migration (ต้อง restart อยู่แล้ว)
const MAX_ENTRIES = 5000;

function createTtlCache(ttlMs) {
  const map = new Map(); // key -> { value, expiresAt }
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt < Date.now()) {
        map.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      if (map.size >= MAX_ENTRIES) map.clear();
      map.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    delete(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

const userStateCache = createTtlCache(USER_TTL_MS);
const scopeCache = createTtlCache(SCOPE_TTL_MS);
const overrideCache = createTtlCache(OVERRIDE_TTL_MS);
const roleDefaultCache = createTtlCache(ROLE_DEFAULT_TTL_MS);

// generation ต่อ user — กัน race: request A อ่าน DB (ค่าเก่า) -> request B แก้ + invalidate ->
// A เขียนค่าเก่าลง cache ทับ ถ้า generation เปลี่ยนระหว่างที่ A อ่าน จะไม่เขียนผลนั้นลง cache
const generations = new Map();
const genOf = (userId) => generations.get(String(userId)) ?? 0;

async function loadThrough(cache, key, userId, loader) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const gen = genOf(userId);
  const value = await loader();
  if (genOf(userId) === gen) cache.set(key, value);
  return value;
}

// { perm_version, is_active, deleted_at } หรือ null ถ้าไม่พบ user
export function getUserAuthState(userId) {
  const key = String(userId);
  return loadThrough(userStateCache, key, userId, async () => {
    const [rows] = await pool.query(
      'SELECT perm_version, is_active, deleted_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    return rows[0] ?? null;
  });
}

// [{ hospitalId, canEdit }] — ห้ามแก้ array ที่ได้ไป (ใช้ร่วมกันหลาย request)
export function getUserScopes(userId) {
  const key = String(userId);
  return loadThrough(scopeCache, key, userId, async () => {
    const [rows] = await pool.query(
      'SELECT hospital_id, can_edit FROM user_hospital_scopes WHERE user_id = ?',
      [userId]
    );
    return Object.freeze(
      rows.map((r) => Object.freeze({ hospitalId: Number(r.hospital_id), canEdit: !!r.can_edit }))
    );
  });
}

// Map(perm_key -> 'GRANT' | 'DENY') ของ user — โหลดทั้งชุดครั้งเดียว แทนถามทีละคีย์
export function getUserPermissionOverrides(userId) {
  const key = String(userId);
  return loadThrough(overrideCache, key, userId, async () => {
    const [rows] = await pool.query(
      'SELECT perm_key, effect FROM user_permission_overrides WHERE user_id = ?',
      [userId]
    );
    return new Map(rows.map((r) => [r.perm_key, r.effect]));
  });
}

// Set(perm_key) ที่ role นี้ได้เป็นค่าเริ่มต้น
export async function getRoleDefaultPermissions(role) {
  const hit = roleDefaultCache.get(role);
  if (hit !== undefined) return hit;
  const [rows] = await pool.query('SELECT perm_key FROM role_default_permissions WHERE role = ?', [
    role,
  ]);
  const value = new Set(rows.map((r) => r.perm_key));
  roleDefaultCache.set(role, value);
  return value;
}

// เรียกทุกครั้งหลังเขียน users / user_hospital_scopes / user_permission_overrides ของ user นั้น
export function invalidateUserAuth(userId) {
  if (userId === undefined || userId === null) return;
  const key = String(userId);
  generations.set(key, genOf(userId) + 1); // จำนวน key = จำนวน user ที่เคยถูกแก้ (มีขอบเขต)
  userStateCache.delete(key);
  scopeCache.delete(key);
  overrideCache.delete(key);
}

export function clearAuthCache() {
  userStateCache.clear();
  scopeCache.clear();
  overrideCache.clear();
  roleDefaultCache.clear();
}
