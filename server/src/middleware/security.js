import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { CORS_ORIGINS } from '../config/env.js';

export const helmetMiddleware = helmet();

export const corsMiddleware = cors({
  origin: CORS_ORIGINS,
  credentials: true,
});

// Global rate limit — 100 req/15 นาที ตาม Principal_Software_Security_Engineer.md
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// กันโจมตีแบบ brute-force เฉพาะ /auth/login — นับเฉพาะครั้งที่ล็อกอิน "ไม่สำเร็จ"
// (skipSuccessfulRequests) ไม่งั้นผู้ใช้ที่พิมพ์รหัสผิดครั้งเดียวแล้วเข้าได้ปกติ
// จะโดนนับโควตาทิ้งไปโดยเปล่าประโยชน์
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'TOO_MANY_REQUESTS', message: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
});

// /auth/refresh ถูกเรียกอัตโนมัติเบื้องหลังตอน access token หมดอายุ (ทุกแท็บ/ทุกครั้งที่เปิดหน้าใหม่)
// ไม่ใช่ช่องทาง brute-force เดารหัสผ่าน (ต้องมี refresh token cookie ที่ถูกต้องอยู่แล้ว)
// จึงให้โควตาสูงกว่า login มาก เพื่อไม่ให้การใช้งานปกติหลายแท็บโดนบล็อก
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
});
