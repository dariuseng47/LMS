import { pool } from '../db/pool.js';
import { getIO } from '../sockets/ioInstance.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { hasPermission } from '../utils/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getGlobalSettings } from '../utils/globalSettings.js';
import { hashToken, generateDeviceToken } from '../utils/tokens.js';

function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

/**
 * GET /api/v1/devices
 */
export const listDevices = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const where = {};
  if (req.query.deviceType) where.device_type = req.query.deviceType;

  const devices = await scopedQuery(pool, tenantId).select('devices', where);
  return res.json({ devices });
});

/**
 * POST /api/v1/devices — admin เท่านั้น
 */
export const createDevice = asyncHandler(async (req, res) => {
  if (req.auth.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลเท่านั้นที่เพิ่มอุปกรณ์ได้');
  }

  const { deviceType, caretakerName, caretakerPhone, rssiThresholdDbm } = req.body;

  // ไม่ระบุ rssiThresholdDbm มา -> fallback ไปใช้ค่ามาตรฐานกลางที่ superadmin ตั้งไว้
  // (Global System Config) ดู server/src/controllers/globalSettings.controller.js
  const globalSettings = await getGlobalSettings();

  // ออก device token ให้ตั้งแต่สร้าง — ต้องนำไปตั้งค่าใน edge agent เพื่อยิง /heartbeat ได้
  // เก็บแค่ hash ไว้ ตัว plaintext ส่งกลับให้เห็นครั้งเดียวตอนนี้เท่านั้น (เหมือน API key ทั่วไป)
  const deviceToken = generateDeviceToken();

  const result = await scopedQuery(pool, req.auth.hospitalId).insert('devices', {
    device_type: deviceType,
    caretaker_name: caretakerName ?? null,
    caretaker_phone: caretakerPhone ?? null,
    rssi_threshold_dbm: rssiThresholdDbm ?? globalSettings.default_rssi_threshold_dbm,
    device_token_hash: hashToken(deviceToken),
    status: 'OFFLINE',
  });

  return res.status(201).json({ id: result.insertId, deviceType, deviceToken });
});

/**
 * POST /api/v1/devices/:id/rotate-token — admin เท่านั้น ออก device token ใหม่แทนของเดิม
 * (ของเดิมใช้ไม่ได้ทันที) เผื่อ token หลุด/ทำหาย
 */
export const rotateDeviceToken = asyncHandler(async (req, res) => {
  if (req.auth.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลเท่านั้นที่รีเซ็ต token ได้');
  }

  const devices = await scopedQuery(pool, req.auth.hospitalId).select('devices', {
    id: req.params.id,
  });
  if (!devices[0]) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }

  const deviceToken = generateDeviceToken();
  await scopedQuery(pool, req.auth.hospitalId).update(
    'devices',
    { id: req.params.id },
    { device_token_hash: hashToken(deviceToken) }
  );

  return res.json({ deviceToken });
});

/**
 * POST /api/v1/devices/:id/heartbeat — device token เท่านั้น (ไม่ใช่ user JWT)
 * Edge device ยิงทุก 30 วิ ตาม docs/device-network-failure-handling.md หัวข้อ 1
 * ถ้าเพิ่งกลับมาจาก OFFLINE ให้ log การเปลี่ยนสถานะ + แจ้ง dashboard ผ่าน Socket.io ทันที
 */
export const receiveHeartbeat = asyncHandler(async (req, res) => {
  // :id ใน URL แค่ช่วยอ่าน log ง่าย ไม่ใช่ตัวตัดสิน — ยึด req.device.id จาก token เป็นหลักเสมอ
  // เผื่อ edge device ตั้งค่า URL ผิดตัว (เช่น deploy สลับเครื่อง) ยังกันได้ตรงนี้
  if (Number(req.params.id) !== req.device.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'device token ไม่ตรงกับ device id ใน URL');
  }

  const [current] = await pool.query('SELECT status, hospital_id FROM devices WHERE id = ?', [
    req.device.id,
  ]);
  const wasOffline = current[0]?.status === 'OFFLINE';

  await pool.query(
    'UPDATE devices SET last_heartbeat_at = NOW(), status = ? WHERE id = ?',
    ['ONLINE', req.device.id]
  );

  if (wasOffline) {
    await pool.query(
      'INSERT INTO device_status_log (device_id, status) VALUES (?, ?)',
      [req.device.id, 'ONLINE']
    );
    emitToHospital(req.device.hospitalId, 'device:status_changed', {
      deviceId: req.device.id,
      status: 'ONLINE',
    });
  }

  return res.status(204).send();
});

/**
 * PATCH /api/v1/devices/:id — admin เสมอ / operator ต้องได้รับสิทธิ์ 'device.caretaker.update'
 * จาก admin ก่อน (ดู docs/rbac-permissions.md, default: operator ปิด) แก้ได้แค่ข้อมูลผู้ดูแล
 * ไม่ให้แตะ RSSI/config อื่นผ่าน endpoint นี้ (นั่นยังเป็นสิทธิ์ admin ล้วนตายตัว)
 */
export const updateDeviceCaretaker = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin หรือ operator ของโรงพยาบาลเท่านั้นที่แก้ไขได้');
  }
  if (req.auth.role === 'OPERATOR') {
    const allowed = await hasPermission(req.auth.userId, 'OPERATOR', 'device.caretaker.update');
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์แก้ไขข้อมูลผู้ดูแลอุปกรณ์ กรุณาติดต่อ admin ให้เปิดสิทธิ์');
    }
  }

  const devices = await scopedQuery(pool, req.auth.hospitalId).select('devices', {
    id: req.params.id,
  });
  if (!devices[0]) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }

  const { caretakerName, caretakerPhone } = req.body;
  const updates = {};
  if (caretakerName !== undefined) updates.caretaker_name = caretakerName;
  if (caretakerPhone !== undefined) updates.caretaker_phone = caretakerPhone;

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  await scopedQuery(pool, req.auth.hospitalId).update('devices', { id: req.params.id }, updates);

  return res.status(204).send();
});
