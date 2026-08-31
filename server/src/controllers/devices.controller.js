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
  const tenantId = await resolveTenantId(req);
  const where = { deleted_at: null };
  if (req.query.deviceType) where.device_type = req.query.deviceType;

  const devices = await scopedQuery(pool, tenantId).select('devices', where);
  return res.json({ devices });
});

/**
 * POST /api/v1/devices — admin เท่านั้น
 */
export const createDevice = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่เพิ่มอุปกรณ์ได้');
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  const {
    deviceType,
    caretakerName,
    caretakerPhone,
    rssiThresholdDbm,
    targetBundleSize,
    ipAddress,
    port,
    scanProfile,
    scanPowerDbm,
  } = req.body;

  // ไม่ระบุ rssiThresholdDbm มา -> fallback ไปใช้ค่ามาตรฐานกลางที่ superadmin ตั้งไว้
  // (Global System Config) ดู server/src/controllers/globalSettings.controller.js
  const globalSettings = await getGlobalSettings();

  // ออก device token ให้ตั้งแต่สร้าง — ต้องนำไปตั้งค่าใน edge agent เพื่อยิง /heartbeat ได้
  // เก็บแค่ hash ไว้ ตัว plaintext ส่งกลับให้เห็นครั้งเดียวตอนนี้เท่านั้น (เหมือน API key ทั่วไป)
  const deviceToken = generateDeviceToken();

  const result = await scopedQuery(pool, tenantId).insert('devices', {
    device_type: deviceType,
    caretaker_name: caretakerName ?? null,
    caretaker_phone: caretakerPhone ?? null,
    rssi_threshold_dbm: rssiThresholdDbm ?? globalSettings.default_rssi_threshold_dbm,
    target_bundle_size: targetBundleSize ?? null,
    ip_address: ipAddress ?? null,
    port: port ?? null,
    scan_profile: scanProfile ?? 'NORMAL',
    scan_power_dbm: scanPowerDbm ?? null,
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
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่รีเซ็ต token ได้');
  }

  const [rows] = await pool.query('SELECT * FROM devices WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  const device = rows[0];
  if (!device) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }
  if (req.auth.role === 'ADMIN' && device.hospital_id !== req.auth.hospitalId) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }

  const deviceToken = generateDeviceToken();
  await pool.query('UPDATE devices SET device_token_hash = ? WHERE id = ?', [
    hashToken(deviceToken),
    req.params.id,
  ]);

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
 * PATCH /api/v1/devices/:id
 *  - admin/superadmin: แก้ได้ทุกอย่าง (ประเภท, ผู้ดูแล, RSSI, จำนวนต่อมัด, IP/Port)
 *  - operator: ต้องได้รับสิทธิ์ 'device.caretaker.update' จาก admin ก่อน (ดู docs/rbac-permissions.md,
 *    default: ปิด) และแก้ได้แค่ข้อมูลผู้ดูแลเท่านั้น — ส่งฟิลด์ config มาด้วยจะถูกปฏิเสธ
 * ฟิลด์ที่ส่งค่าว่าง/null มา = สั่งล้างค่านั้น (เช่น ลบ IP/Port ออก)
 */
export const updateDevice = asyncHandler(async (req, res) => {
  const isPrivileged = ['ADMIN', 'SUPERADMIN'].includes(req.auth.role);

  const configKeys = [
    'deviceType',
    'rssiThresholdDbm',
    'targetBundleSize',
    'ipAddress',
    'port',
    'scanProfile',
    'scanPowerDbm',
  ];

  if (!isPrivileged) {
    const allowed = await hasPermission(
      req.auth.userId,
      req.auth.role,
      'web.devices.caretaker.edit'
    );
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์แก้ไขข้อมูลผู้ดูแลอุปกรณ์ กรุณาติดต่อ admin ให้เปิดสิทธิ์');
    }
    if (configKeys.some((key) => req.body[key] !== undefined)) {
      throw new AppError(403, 'FORBIDDEN', 'operator แก้ไขได้เฉพาะข้อมูลผู้ดูแลอุปกรณ์ ไม่รวมประเภท/RSSI/เครือข่าย');
    }
  }

  const [rows] = await pool.query('SELECT * FROM devices WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  const device = rows[0];
  if (!device) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }
  if (req.auth.role !== 'SUPERADMIN' && device.hospital_id !== req.auth.hospitalId) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }

  const {
    caretakerName,
    caretakerPhone,
    deviceType,
    rssiThresholdDbm,
    targetBundleSize,
    ipAddress,
    port,
    scanProfile,
    scanPowerDbm,
  } = req.body;

  const updates = {};
  if (caretakerName !== undefined) updates.caretaker_name = caretakerName || null;
  if (caretakerPhone !== undefined) updates.caretaker_phone = caretakerPhone || null;
  if (isPrivileged) {
    if (deviceType !== undefined) updates.device_type = deviceType;
    if (rssiThresholdDbm !== undefined) updates.rssi_threshold_dbm = rssiThresholdDbm;
    if (targetBundleSize !== undefined) updates.target_bundle_size = targetBundleSize ?? null;
    if (ipAddress !== undefined) updates.ip_address = ipAddress || null;
    if (port !== undefined) updates.port = port ?? null;
    if (scanProfile !== undefined) updates.scan_profile = scanProfile;
    if (scanPowerDbm !== undefined) updates.scan_power_dbm = scanPowerDbm ?? null;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  await pool.query('UPDATE devices SET ? WHERE id = ?', [updates, req.params.id]);

  return res.status(204).send();
});

/**
 * DELETE /api/v1/devices/:id — admin/superadmin เท่านั้น
 * soft delete (devices มี FK จาก scan_logs / device_status_log ฯลฯ ลบจริงไม่ได้ถ้ามีประวัติ)
 * อุปกรณ์ที่ลบแล้วจะหายจากทุกรายการ แต่ประวัติสแกนเดิมยังอยู่
 */
export const deleteDevice = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่ลบอุปกรณ์ได้');
  }

  const [rows] = await pool.query('SELECT * FROM devices WHERE id = ? AND deleted_at IS NULL', [
    req.params.id,
  ]);
  const device = rows[0];
  if (!device) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }
  if (req.auth.role !== 'SUPERADMIN' && device.hospital_id !== req.auth.hospitalId) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }

  await pool.query('UPDATE devices SET deleted_at = NOW() WHERE id = ?', [req.params.id]);

  return res.status(204).send();
});
