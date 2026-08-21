import { Server } from 'socket.io';

import { pool } from '../db/pool.js';
import { CORS_ORIGINS } from '../config/env.js';
import { logAudit } from '../utils/auditLog.js';
import { verifyAccessToken } from '../utils/tokens.js';

// Socket.io ต้อง join room ตาม hospital_id จาก JWT เท่านั้น (ห้าม client เลือก room เอง)
// ดู docs/api-spec.md ส่วน Real-time และ docs/multi-tenant-isolation.md
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: CORS_ORIGINS, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = verifyAccessToken(token);
      socket.auth = {
        userId: payload.sub,
        role: payload.role,
        hospitalId: payload.hospital_id ?? null,
      };
      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', async (socket) => {
    const { hospitalId, role, userId } = socket.auth;

    if (hospitalId) {
      socket.join(`hospital:${hospitalId}`);
      return;
    }

    // superadmin ไม่มี tenant ของตัวเอง แต่ REST ฝั่งนี้อ่านข้ามทุก tenant ได้อยู่แล้วเป็นปกติ
    // (Super Dashboard, GET /hospitals/summary ฯลฯ — ดู multi-tenant-isolation.md ชั้นที่ 5)
    // จึง join ห้องของทุกโรงพยาบาลให้เลยตอน connect เพื่อให้หน้าภาพรวมข้ามเครือข่ายอัปเดต
    // real-time ได้เหมือนหน้าอื่น ไม่ใช่ cross-tenant leak ใหม่ เพราะสิทธิ์อ่านมีอยู่แล้ว
    // แค่ log ไว้เป็น CROSS_TENANT_READ ครั้งเดียวตอน connect เพื่อ accountability เหมือน REST
    if (role === 'SUPERADMIN') {
      const [hospitals] = await pool.query('SELECT id FROM hospitals WHERE deleted_at IS NULL');
      hospitals.forEach((h) => socket.join(`hospital:${h.id}`));

      await logAudit({
        hospitalId: null,
        userId,
        action: 'CROSS_TENANT_READ',
        entityType: 'socket_connection',
        entityId: null,
        metadata: { hospitalIds: hospitals.map((h) => h.id) },
      });
    }
  });

  return io;
}
