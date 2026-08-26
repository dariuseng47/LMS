export const STORAGE_KEY = 'jwt_access_token';

// ISO timestamp ของเวลาที่ "เซสชัน" (ไม่ใช่แค่ access token ใบปัจจุบัน) จะหมดอายุจริง — คำนวณจาก
// server เสมอ (ดู server/src/controllers/auth.controller.js#sessionExpiresAtOf) ไม่ hardcode
// จำนวนชั่วโมงไว้ฝั่ง client เพื่อกันค่าเพี้ยนถ้า SESSION_MAX_TTL_HOURS ฝั่ง server ถูกปรับ
export const SESSION_EXPIRES_KEY = 'jwt_session_expires_at';
