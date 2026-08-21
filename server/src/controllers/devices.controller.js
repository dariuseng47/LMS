import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// หมายเหตุ: นี่คือ endpoint ขั้นต่ำสุดพอให้เลือกอุปกรณ์ handheld ได้ในหน้า scan-session
// ส่วนหน้า "อุปกรณ์ & สัญญาณ RFID" เต็มรูปแบบ (RSSI tuning, install location, heartbeat
// dashboard) ยังเป็นฟีเจอร์แยกที่รอทำต่อ

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

  const result = await scopedQuery(pool, req.auth.hospitalId).insert('devices', {
    device_type: deviceType,
    caretaker_name: caretakerName ?? null,
    caretaker_phone: caretakerPhone ?? null,
    rssi_threshold_dbm: rssiThresholdDbm ?? -65,
    status: 'OFFLINE',
  });

  return res.status(201).json({ id: result.insertId, deviceType });
});
