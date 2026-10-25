import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { env, isAllowedOrigin } from '../config/env.js';
import { verifyAccessToken } from '../utils/tokens.js';

export const helmetMiddleware = helmet();

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ไม่ได้รับอนุญาต — ${origin}`));
  },
  credentials: true,
});

// Global rate limit — เดิม 100 req/15 นาที ต่อ IP (ตาม Principal_Software_Security_Engineer.md)
// แต่ใช้งานจริงโดน "Too many requests" บ่อย: เครื่อง handheld/คอมทุกเครื่องในโรงพยาบาลออกเน็ตผ่าน
// IP สาธารณะเดียวกัน (NAT) โควตาเลยถูกหารกันทั้งตึก + สแกนผ้า 1 กอง (หลายสิบแท็ก) ก็ยิง request
// ดูชนิดผ้าทีละแท็ก (nativeapp ScannedTagChip) หมดโควตาในไม่กี่นาที
//
// ตอนนี้: request ที่มี access token ถูกต้อง → นับแยก "ต่อผู้ใช้" (คนละคนไม่แย่งโควตากัน) โควตา
// สูงพอสำหรับงานสแกนจริง / ไม่มี token (หรือ token ปลอม/หมดอายุ) → นับต่อ IP ตามเดิม เข้มกว่า
// verify ลายเซ็นจริงก่อนใช้ sub เป็น key — กันคนปลอม token สุ่ม sub เพื่อหนี limit
// development: ผ่อนให้สูงมาก (dashboard 1 หน้ายิงหลายสิบ request + หลายแท็บ + dev tooling บน IP เดียว)
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_PER_USER = env.NODE_ENV === 'production' ? 3000 : 20000;
const RATE_LIMIT_PER_IP_ANONYMOUS = env.NODE_ENV === 'production' ? 300 : 5000;

function rateLimitUserId(req) {
  if (req.rateLimitUserId !== undefined) return req.rateLimitUserId;
  const header = req.headers.authorization;
  let userId = null;
  if (header && header.startsWith('Bearer ')) {
    try {
      userId = verifyAccessToken(header.slice('Bearer '.length)).sub ?? null;
    } catch {
      userId = null;
    }
  }
  req.rateLimitUserId = userId;
  return userId;
}

export const globalRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: (req) => (rateLimitUserId(req) ? RATE_LIMIT_PER_USER : RATE_LIMIT_PER_IP_ANONYMOUS),
  keyGenerator: (req) => {
    const userId = rateLimitUserId(req);
    return userId ? `user:${userId}` : `ip:${req.ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'ใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' },
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

// /auth/login-pin — keyspace มีแค่ 1 ล้านแบบ (เลขล้วน 6 หลัก) ต่างจาก password ที่ยาวและหลากตัวอักษร
// กว่ามาก จึงต้อง lock เข้มกว่า authRateLimiter ปกติ: ผิด 6 ครั้งล็อก 5 นาที (นับเฉพาะครั้งที่ไม่สำเร็จ
// เหมือนกัน) ล็อกตาม IP/อุปกรณ์ ไม่ใช่ตาม PIN เพราะขั้นตอนนี้ยังไม่รู้ว่าใครคือเจ้าของ PIN จนกว่าจะแมตช์เจอ
export const pinLoginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'TOO_MANY_REQUESTS', message: 'กรอก PIN ผิดบ่อยเกินไป กรุณาลองใหม่ใน 5 นาที' },
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
