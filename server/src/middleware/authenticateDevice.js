import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { hashToken } from '../utils/tokens.js';

// Auth แยกจาก user JWT โดยสิ้นเชิง — edge device (Raspberry Pi) ไม่ใช่ user ไม่มี role/hospital
// context ของตัวเอง ใช้ device_token_hash ผูกกับ device แต่ละตัว (ออกให้ตอน POST /devices และ
// รีเซ็ตได้ผ่าน POST /devices/:id/rotate-token) เทียบกับ :id ใน URL เพื่อกัน token ของเครื่องหนึ่ง
// ไปยิง heartbeat แทนอีกเครื่องได้ — ดู docs/device-network-failure-handling.md หัวข้อ 1
export async function authenticateDevice(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'ไม่พบ device token'));
  }

  const token = header.slice('Bearer '.length);
  const tokenHash = hashToken(token);

  try {
    const [rows] = await pool.query(
      'SELECT id, hospital_id FROM devices WHERE id = ? AND device_token_hash = ? LIMIT 1',
      [req.params.id, tokenHash]
    );
    if (!rows[0]) {
      return next(new AppError(401, 'UNAUTHORIZED', 'device token ไม่ถูกต้อง'));
    }

    req.device = { id: rows[0].id, hospitalId: rows[0].hospital_id };
    return next();
  } catch (err) {
    return next(err);
  }
}
