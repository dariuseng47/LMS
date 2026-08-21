import bcrypt from 'bcryptjs';

import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/tokens.js';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 วัน

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/v1/auth',
  };
}

async function issueTokenPair(user) {
  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    hospitalId: user.hospital_id,
    // perm_version จริงจาก DB (เพิ่มขึ้นทุกครั้งที่ user_permission_overrides ของ user นี้ถูกแก้
    // — ดู server/src/utils/permissions.js incrementPermVersion) client เอาไว้เทียบกับค่า cache
    // เพื่อรู้ว่าต้อง refresh permission set ใหม่ กันใช้สิทธิ์เก่าค้างหลังโดนลดสิทธิ์กะทันหัน
    permVersion: user.perm_version,
  });
  const refreshToken = signRefreshToken({ userId: user.id });

  const decoded = verifyRefreshToken(refreshToken);
  const expiresAt = new Date(decoded.exp * 1000);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.id, hashToken(refreshToken), expiresAt]
  );

  return { accessToken, refreshToken };
}

function sanitizeUser(user) {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * POST /api/v1/auth/login
 * หา user จาก username ระดับ global ก่อน (ยังไม่รู้ hospital_id ณ จุดนี้) จึง query ตรงผ่าน pool
 * ไม่ผ่าน scopedQuery เพราะขั้นตอนนี้คือการพิสูจน์ตัวตน ไม่ใช่การเข้าถึงข้อมูลระดับ tenant
 */
export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // LEFT JOIN hospitals — เผื่อ superadmin ที่ user.hospital_id เป็น NULL
  // เอาชื่อโรงพยาบาลติดมาด้วยเลยตั้งแต่ login เพื่อให้ sidebar switcher แสดงชื่อได้ทันที
  // โดยไม่ต้องมี endpoint แยก (admin/operator เรียก GET /hospitals ไม่ได้ เป็น superadmin เท่านั้น)
  const [rows] = await pool.query(
    `SELECT u.*, h.name AS hospital_name FROM users u
     LEFT JOIN hospitals h ON h.id = u.hospital_id
     WHERE u.username = ? AND u.deleted_at IS NULL LIMIT 1`,
    [username]
  );
  const user = rows[0];

  if (!user || !user.is_active) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  const { accessToken, refreshToken } = await issueTokenPair(user);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

  return res.json({
    accessToken,
    refreshToken, // mobile client (Expo SecureStore) อ่านจากตรงนี้ ฝั่ง web ใช้ cookie แทน
    user: sanitizeUser(user),
  });
});

/**
 * POST /api/v1/auth/refresh
 * รับ refresh token จาก cookie (web) หรือ body (mobile) แล้ว rotate ทันที (revoke ของเก่า, ออกใหม่)
 */
export const refresh = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

  if (!incomingToken) {
    throw new AppError(401, 'UNAUTHORIZED', 'ไม่พบ refresh token');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(incomingToken);
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'refresh token ไม่ถูกต้องหรือหมดอายุ');
  }

  const tokenHash = hashToken(incomingToken);
  const [tokenRows] = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND user_id = ? LIMIT 1',
    [tokenHash, decoded.sub]
  );
  const tokenRecord = tokenRows[0];

  if (!tokenRecord || tokenRecord.revoked_at || new Date(tokenRecord.expires_at) < new Date()) {
    throw new AppError(401, 'UNAUTHORIZED', 'refresh token ถูกเพิกถอนหรือหมดอายุแล้ว');
  }

  const [userRows] = await pool.query(
    'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL AND is_active = TRUE LIMIT 1',
    [decoded.sub]
  );
  const user = userRows[0];
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'ไม่พบผู้ใช้งานนี้แล้ว');
  }

  // Rotation: เพิกถอน refresh token เก่าก่อนออกอันใหม่เสมอ (กัน replay)
  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [
    tokenRecord.id,
  ]);

  const { accessToken, refreshToken } = await issueTokenPair(user);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

  return res.json({ accessToken, refreshToken });
});

/**
 * POST /api/v1/auth/logout
 * เพิกถอน refresh token ปัจจุบัน + เคลียร์ cookie
 */
export const logout = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

  if (incomingToken) {
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [
      hashToken(incomingToken),
    ]);
  }

  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  return res.status(204).send();
});

/**
 * GET /api/v1/auth/me
 * ต้องผ่าน authenticate middleware มาก่อนแล้ว (req.auth พร้อมใช้)
 */
export const me = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.*, h.name AS hospital_name FROM users u
     LEFT JOIN hospitals h ON h.id = u.hospital_id
     WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
    [req.auth.userId]
  );
  const user = rows[0];

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบผู้ใช้งานนี้');
  }

  return res.json({ user: sanitizeUser(user), permVersion: req.auth.permVersion });
});
