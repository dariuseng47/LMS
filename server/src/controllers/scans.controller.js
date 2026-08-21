import { pool } from '../db/pool.js';
import { getIO } from '../sockets/ioInstance.js';
import { AppError } from '../utils/AppError.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Operator-facing scan actions for nativeapp/ — ward dispatch/receive. Simplified vs. the
// full "1st scan (read cabinet) -> replenish -> 2nd scan (cart -> cabinet)" par-level
// replenishment flow in Advanced_Feature_Details&Rules.md: this pass is a direct
// EPC -> cabinet issue/receive (manual EPC entry stand-in for a real scanner, see
// nativeapp/src/components/ScannerInput.jsx). Cart-tracking/replenishment counting is
// a later iteration.

export function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

export async function findTenantScopedFabricItemByEpc(tenantId, epcCode) {
  const rows = await scopedQuery(pool, tenantId).select('fabric_items', { epc_code: epcCode });
  return rows[0];
}

/**
 * POST /api/v1/scans/ward-issue — จ่ายผ้าจากคลังกลางไปตู้ประจำวอร์ด (admin/operator)
 */
export const wardIssue = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้');
  }

  const tenantId = req.auth.hospitalId;
  const { epcCode, cabinetId } = req.body;

  const cabinets = await scopedQuery(pool, tenantId).select('cabinets', {
    id: cabinetId,
    deleted_at: null,
  });
  const cabinet = cabinets[0];
  if (!cabinet) throw new AppError(404, 'NOT_FOUND', 'ไม่พบตู้เก็บผ้านี้');

  const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้ารหัสนี้');
  if (item.status === 'HOLD' || item.status === 'DECOMMISSIONED') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้ถูกพัก/แทงชำรุดอยู่ จ่ายออกไม่ได้');
  }

  await scopedQuery(pool, tenantId).update(
    'fabric_items',
    { id: item.id },
    { status: 'WARD_CABINET', current_location_type: 'CABINET', current_location_id: cabinet.id }
  );

  await scopedQuery(pool, tenantId).insert('scan_logs', {
    fabric_item_id: item.id,
    device_id: null,
    user_id: req.auth.userId,
    event_type: 'WARD_ISSUE',
    is_step_skipped: false,
    synced_from_offline: false,
    scanned_at: new Date(),
  });

  emitToHospital(tenantId, 'scan:ward-issue', { fabricItemId: item.id, epcCode, cabinetId: cabinet.id });

  return res.status(201).json({
    fabricItemId: item.id,
    epcCode,
    status: 'WARD_CABINET',
    cabinetId: cabinet.id,
  });
});

/**
 * POST /api/v1/scans/ward-receive — รับผ้าใช้แล้วกลับจากวอร์ดเข้าสู่รอบซักถัดไป (admin/operator)
 */
export const wardReceive = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้');
  }

  const tenantId = req.auth.hospitalId;
  const { epcCode } = req.body;

  const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้ารหัสนี้');
  if (item.status !== 'WARD_CABINET' && item.status !== 'IN_USE_WARD') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้ไม่ได้อยู่ที่วอร์ด รับเข้าไม่ได้');
  }

  await scopedQuery(pool, tenantId).update(
    'fabric_items',
    { id: item.id },
    { status: 'WASH', current_location_type: 'CENTRAL_STOCK', current_location_id: null }
  );

  await scopedQuery(pool, tenantId).insert('scan_logs', {
    fabric_item_id: item.id,
    device_id: null,
    user_id: req.auth.userId,
    event_type: 'WARD_RECEIVE',
    is_step_skipped: false,
    synced_from_offline: false,
    scanned_at: new Date(),
  });

  emitToHospital(tenantId, 'scan:ward-receive', { fabricItemId: item.id, epcCode });

  return res.json({ fabricItemId: item.id, epcCode, status: 'WASH' });
});

/**
 * POST /api/v1/scans/weight-gate — device token เท่านั้น (WEIGHT_GATE edge device)
 * จุดที่ 3 ตาม Advanced_Feature_Details&Rules.md — ชั่งน้ำหนัก + อ่าน RFID 3 จุดพร้อมกันเป็นชุด
 * (epcCodes หลายชิ้นต่อการชั่ง 1 ครั้ง ใช้ weightKg เดียวกันทั้งชุด)
 * STEP_SKIPPED: ผ้าที่ไม่ได้อยู่สถานะ WASH มาก่อน (เช่น โผล่มาทั้งที่ยังอยู่ตู้แผนก/ใช้งานอยู่ที่วอร์ด
 * โดยไม่ผ่าน ward-receive ให้ครบ flow ก่อน) — ไม่ block การชั่ง แค่ flag ไว้ให้ตรวจสอบทีหลัง
 */
export const weightGate = asyncHandler(async (req, res) => {
  const tenantId = req.device.hospitalId;
  const { epcCodes, weightKg, sensorError } = req.body;

  const processed = [];
  const skipped = [];

  for (const epcCode of epcCodes) {
    // eslint-disable-next-line no-await-in-loop
    const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
    if (!item) {
      skipped.push({ epcCode, reason: 'NOT_FOUND' });
      continue; // eslint-disable-line no-continue
    }
    if (item.status === 'HOLD' || item.status === 'DECOMMISSIONED') {
      skipped.push({ epcCode, reason: 'INVALID_STATE' });
      continue; // eslint-disable-line no-continue
    }

    const isStepSkipped = item.status !== 'WASH';

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).update(
      'fabric_items',
      { id: item.id },
      {
        status: 'WEIGHT_COUNT',
        wash_count: item.wash_count + 1,
        current_location_type: null,
        current_location_id: null,
      }
    );

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).insert('scan_logs', {
      fabric_item_id: item.id,
      device_id: req.device.id,
      user_id: null,
      event_type: 'WEIGHT_COUNT',
      weight_kg: sensorError ? null : weightKg,
      sensor_error: sensorError,
      is_step_skipped: isStepSkipped,
      synced_from_offline: false,
      scanned_at: new Date(),
    });

    processed.push({ epcCode, fabricItemId: item.id, stepSkipped: isStepSkipped });
  }

  emitToHospital(tenantId, 'scan:created', {
    eventType: 'WEIGHT_COUNT',
    deviceId: req.device.id,
    processed,
  });

  return res.status(201).json({ processed, skipped, sensorError });
});

/**
 * POST /api/v1/scans/bundle-check — device token เท่านั้น (FOLDING_TABLE edge device)
 * จุดที่ 4 ตาม Advanced_Feature_Details&Rules.md — อ่าน RFID มัดผ้าที่พับเสร็จ 1 มัดต่อการสแกน 1 ครั้ง
 * เทียบจำนวนชิ้นกับ target_bundle_size ที่ตั้งไว้ต่อเครื่อง (NULL = ไม่เช็ค) และบันทึก RSSI ต่อชิ้น
 * ให้หน้า "แจ้งเตือน & ข้อยกเว้น" ดักจับสัญญาณอ่อนได้เหมือนเดิม (query จากคอลัมน์เดียวกัน)
 */
export const bundleCheck = asyncHandler(async (req, res) => {
  const tenantId = req.device.hospitalId;
  const { epcCodes, rssiDbm } = req.body;

  const [deviceRows] = await pool.query('SELECT target_bundle_size FROM devices WHERE id = ?', [
    req.device.id,
  ]);
  const targetBundleSize = deviceRows[0]?.target_bundle_size ?? null;

  const processed = [];
  const skipped = [];

  for (const epcCode of epcCodes) {
    // eslint-disable-next-line no-await-in-loop
    const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
    if (!item) {
      skipped.push({ epcCode, reason: 'NOT_FOUND' });
      continue; // eslint-disable-line no-continue
    }
    if (item.status === 'HOLD' || item.status === 'DECOMMISSIONED') {
      skipped.push({ epcCode, reason: 'INVALID_STATE' });
      continue; // eslint-disable-line no-continue
    }

    const isStepSkipped = item.status !== 'WEIGHT_COUNT';

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).update(
      'fabric_items',
      { id: item.id },
      { status: 'FOLDING_QC' }
    );

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).insert('scan_logs', {
      fabric_item_id: item.id,
      device_id: req.device.id,
      user_id: null,
      event_type: 'BUNDLE_CHECK',
      rssi_dbm: rssiDbm ?? null,
      is_step_skipped: isStepSkipped,
      synced_from_offline: false,
      scanned_at: new Date(),
    });

    processed.push({ epcCode, fabricItemId: item.id, stepSkipped: isStepSkipped });
  }

  const bundleSizeMismatch = targetBundleSize !== null && processed.length !== targetBundleSize;

  emitToHospital(tenantId, 'scan:created', {
    eventType: 'BUNDLE_CHECK',
    deviceId: req.device.id,
    processed,
    bundleSizeMismatch,
  });

  return res
    .status(201)
    .json({ processed, skipped, targetBundleSize, actualCount: processed.length, bundleSizeMismatch });
});
