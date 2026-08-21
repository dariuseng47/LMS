import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

// Access Token: อายุสั้น (15 นาที default) แนบผ่าน Authorization: Bearer
export function signAccessToken({ userId, role, hospitalId, permVersion }) {
  return jwt.sign(
    { sub: String(userId), role, hospital_id: hospitalId ?? null, perm_version: permVersion },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

// Refresh Token: อายุยาว (7 วัน default) + track ใน DB (refresh_tokens) เพื่อ whitelist/rotate/revoke ได้
export function signRefreshToken({ userId }) {
  return jwt.sign({ sub: String(userId) }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

// เก็บ hash ของ refresh token ลง DB แทนตัวจริง (กันกรณี DB รั่วแล้วใช้ token เดิม replay ได้ทันที)
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Device token: opaque random string (ไม่ใช่ JWT) ให้ edge device ใช้ยิง POST /devices/:id/heartbeat
// เห็น plaintext ได้ครั้งเดียวตอนออก/รีเซ็ต — เก็บแค่ hash ไว้เทียบ (ดู authenticateDevice.js)
export function generateDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}
