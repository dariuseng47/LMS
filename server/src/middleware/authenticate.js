import { AppError } from '../utils/AppError.js';
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

// เช็ค role พื้นฐาน — ส่วน permission ละเอียด (user_permission_overrides) จะเพิ่มเป็น middleware แยกภายหลัง
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้'));
    }
    return next();
  };
}
