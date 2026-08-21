import express from 'express';
import cookieParser from 'cookie-parser';

import routes from './routes/index.js';
import { UPLOAD_ROOT } from './middleware/upload.js';
import { errorHandler } from './middleware/errorHandler.js';
import { corsMiddleware, globalRateLimiter, helmetMiddleware } from './middleware/security.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(globalRateLimiter);

  // เสิร์ฟไฟล์ที่อัปโหลด (เช่น รูปพัก/ชำรุด) — ชื่อไฟล์เป็น UUID สุ่มเสมอ (ดู middleware/upload.js)
  // จึงเดาชื่อไฟล์คนอื่นไม่ได้ ไม่ต้องผ่าน authenticate เพื่อให้ <img src> ฝั่ง dashboard โหลดตรงได้เลย
  // express.static กัน path traversal (../) ให้อัตโนมัติอยู่แล้ว
  app.use('/uploads', express.static(UPLOAD_ROOT, { index: false, dotfiles: 'deny' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/v1', routes);

  app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use(errorHandler);

  return app;
}
