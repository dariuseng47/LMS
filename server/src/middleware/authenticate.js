import { AppError } from '../utils/AppError.js';
import { hasPermission } from '../utils/permissions.js';
import { verifyAccessToken } from '../utils/tokens.js';

// ตรวจ Bearer access token แล้วแนบ req.auth = { userId, role, hospitalId, permVersion }
// hospital_id มาจาก JWT claim เท่านั้น — ดู docs/multi-tenant-isolation.md ชั้นที่ 1
export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'ไม่พบ access token'));
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      hospitalId: payload.hospital_id ?? null,
      permVersion: payload.perm_version,
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
