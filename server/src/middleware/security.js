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

// Rate limit เข้มกว่าเฉพาะ /auth/login และ /auth/refresh — 5 req/15 นาที
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
});
