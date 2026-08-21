import { AppError } from './AppError.js';

// superadmin ไม่มี hospital_id ใน token (มองข้าม tenant ได้) จึงต้องระบุ ?hospitalId= มาเอง
// ทุกครั้งแบบ explicit (ห้าม default เป็น "ทุก tenant" เงียบๆ) — ดู docs/multi-tenant-isolation.md ชั้นที่ 1
export function resolveTenantId(req) {
  if (req.auth.role === 'SUPERADMIN') {
    const hospitalId = req.query?.hospitalId ? Number(req.query.hospitalId) : undefined;
    if (!hospitalId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ ?hospitalId= เสมอ');
    }
    return hospitalId;
  }
  return req.auth.hospitalId;
}
