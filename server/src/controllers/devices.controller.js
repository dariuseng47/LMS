import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { hasPermission } from '../utils/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getGlobalSettings } from '../utils/globalSettings.js';

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

  const result = await scopedQuery(pool, req.auth.hospitalId).insert('devices', {
    device_type: deviceType,
    caretaker_name: caretakerName ?? null,
    caretaker_phone: caretakerPhone ?? null,
    rssi_threshold_dbm: rssiThresholdDbm ?? globalSettings.default_rssi_threshold_dbm,
    status: 'OFFLINE',
  });

  return res.status(201).json({ id: result.insertId, deviceType });
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
