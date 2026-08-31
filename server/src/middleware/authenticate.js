import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { hasPermission } from '../utils/permissions.js';
import { verifyAccessToken } from '../utils/tokens.js';

// ตรวจ Bearer access token แล้วแนบ req.auth = { userId, role, hospitalId, permVersion, sessionStartedAt }
// hospital_id มาจาก JWT claim เท่านั้น — ดู docs/multi-tenant-isolation.md ชั้นที่ 1
export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'ไม่พบ access token'));
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);

    // เช็คเพดานอายุเซสชันรวม (SESSION_MAX_TTL_HOURS) ตรงนี้ด้วย — ให้ทันทีที่เจอ ไม่ต้องรอ
    // access token ใบนี้หมดอายุเองก่อน (สูงสุด 15 นาที) ค่อยไปโดนบล็อกจริงตอน /auth/refresh
    // token เก่า (ก่อนมี claim นี้) จะไม่มี session_started_at — ปล่อยผ่าน ให้ refresh ครั้งถัดไป
    // เริ่มนับเซสชันใหม่แทน (ดู auth.controller.js#issueTokenPair)
    if (payload.session_started_at) {
      const sessionAgeMs = Date.now() - payload.session_started_at * 1000;
      if (sessionAgeMs > env.SESSION_MAX_TTL_HOURS * 60 * 60 * 1000) {
        return next(
          new AppError(
            401,
            'SESSION_EXPIRED',
            `เซสชันหมดอายุ (ครบ ${env.SESSION_MAX_TTL_HOURS} ชั่วโมงนับจากเข้าสู่ระบบ) กรุณาเข้าสู่ระบบใหม่`
          )
        );
      }
    }

    req.auth = {
      userId: payload.sub,
      role: payload.role,
      hospitalId: payload.hospital_id ?? null,
      permVersion: payload.perm_version,
      sessionStartedAt: payload.session_started_at ?? null,
    };
    return next();
  } catch {
    return next(new AppError(401, 'UNAUTHORIZED', 'access token ไม่ถูกต้องหรือหมดอายุ'));
  }
}

// เช็ค role พื้นฐาน
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้'));
    }
    return next();
  };
}

// เช็ค permission ละเอียดตาม user_permission_overrides (ดู docs/rbac-permissions.md)
// ใช้ "เพิ่มเติม" จากเช็ค role เดิมในตัว controller เอง ไม่ใช่แทนที่ — เช่น superadmin
// อาจยังโดนบล็อกจาก business rule เฉพาะจุด (เช่น ห้ามทำ hold/decommission) ได้อยู่แม้ผ่าน
// permission middleware นี้แล้ว เพราะ effective() ของ superadmin คือ true เสมอ
export function requirePermission(permKey) {
  return async (req, res, next) => {
    try {
      const allowed = await hasPermission(req.auth.userId, req.auth.role, permKey);
      if (!allowed) {
        throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบ');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// ผ่านถ้ามีสิทธิ์ "อย่างน้อยหนึ่ง" คีย์ — ใช้กับ endpoint ที่ web กับ handheld ยิงมาที่ path เดียวกัน
// (คนละคีย์คนละช่องทาง เช่น เปลี่ยนสถานะผ้า / รับ-ส่งวอร์ด)
export function requireAnyPermission(...permKeys) {
  return async (req, res, next) => {
    try {
      for (const key of permKeys) {
        // eslint-disable-next-line no-await-in-loop
        if (await hasPermission(req.auth.userId, req.auth.role, key)) return next();
      }
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบ');
    } catch (err) {
      next(err);
    }
  };
}
