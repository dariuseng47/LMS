import { Server } from 'socket.io';

import { CORS_ORIGINS } from '../config/env.js';
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

  io.on('connection', (socket) => {
    const { hospitalId } = socket.auth;

    // superadmin (hospitalId = null) ไม่ auto-join ห้องไหนทั้งสิ้น ต้อง subscribe แบบ explicit
    // เพื่อไม่ให้เกิด cross-tenant leak โดยไม่ตั้งใจ (จุดนี้จะเพิ่ม event 'subscribe:hospital' พร้อม allow-list check ภายหลัง)
    if (hospitalId) {
      socket.join(`hospital:${hospitalId}`);
    }
  });

  return io;
}
