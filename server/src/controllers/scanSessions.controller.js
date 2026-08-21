import { pool } from '../db/pool.js';
import { getIO } from '../sockets/ioInstance.js';
import { AppError } from '../utils/AppError.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Flow: แอดมินเลือกล็อต + อุปกรณ์ handheld ที่ผูกไว้ -> trigger (ยิง socket event ไปที่ห้อง
// hospital:<id> ให้แอปบนเครื่อง handheld เข้าโหมดสแกน) -> เครื่องสแกนแล้วส่งรายการ EPC กลับมา
// (report) -> แอดมินตรวจสอบแล้วกดยืนยันบนเว็บ (confirm) ค่อย commit เป็น fabric_items จริง
//
// หมายเหตุ: ตอนนี้ยังไม่มีแอป handheld จริง (nativeapp/ ว่างเปล่า) และยังไม่มี device-token auth
// endpoint /report จึงเปิดให้ user (admin/operator) เรียกได้เหมือนกันไปก่อน — เมื่อสร้างแอป
// handheld จริงจะต้องเปลี่ยนไปใช้ device-token auth แยกต่างหาก (ไม่ใช้ user JWT)

async function findTenantScopedSession(tenantId, id) {
  const rows = await scopedQuery(pool, tenantId).select('registration_scan_sessions', { id });
  return rows[0];
}

function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

/**
 * POST /api/v1/scan-sessions — trigger session ใหม่ (admin/operator)
 */
export const triggerScanSession = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้');
  }

  const tenantId = req.auth.hospitalId;
  const { fabricLotId, deviceId } = req.body;

  const lots = await scopedQuery(pool, tenantId).select('fabric_lots', { id: fabricLotId });
  const lot = lots[0];
  if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้านี้');

  const devices = await scopedQuery(pool, tenantId).select('devices', { id: deviceId });
  const device = devices[0];
  if (!device) throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  if (device.device_type !== 'HANDHELD') {
    throw new AppError(400, 'VALIDATION_ERROR', 'อุปกรณ์ที่เลือกไม่ใช่ handheld scanner');
  }

  const result = await scopedQuery(pool, tenantId).insert('registration_scan_sessions', {
    fabric_lot_id: fabricLotId,
    device_id: deviceId,
    status: 'PENDING',
    triggered_by: req.auth.userId,
  });

  const session = {
    id: result.insertId,
    fabricLotId,
    deviceId,
    lotCode: lot.lot_code,
    status: 'PENDING',
  };

  // ยิงไปทั้งห้อง hospital:<id> — อุปกรณ์ handheld (เมื่อมีแอปจริง) filter เอาเฉพาะ deviceId ตัวเอง
  emitToHospital(tenantId, 'scan:trigger', session);

  return res.status(201).json({ session });
});

/**
 * GET /api/v1/scan-sessions/:id
 */
export const getScanSession = asyncHandler(async (req, res) => {
  const tenantId = req.auth.role === 'SUPERADMIN' ? Number(req.query.hospitalId) : req.auth.hospitalId;
  const session = await findTenantScopedSession(tenantId, req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');

  return res.json({ session });
});

/**
 * POST /api/v1/scan-sessions/:id/report — อุปกรณ์ (หรือ user ไปพลางก่อน) ส่งรายการ EPC ที่สแกนเจอ
 */
export const reportScanSession = asyncHandler(async (req, res) => {
  const tenantId = req.auth.hospitalId;
  const session = await findTenantScopedSession(tenantId, req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');
  if (session.status === 'CONFIRMED' || session.status === 'CANCELLED') {
    throw new AppError(400, 'INVALID_STATE', 'session นี้ปิดไปแล้ว รายงานผลเพิ่มไม่ได้');
  }

  const { epcCodes } = req.body;

  await scopedQuery(pool, tenantId).update(
    'registration_scan_sessions',
    { id: session.id },
    { status: 'REPORTED', scanned_epcs: JSON.stringify(epcCodes) }
  );

  emitToHospital(tenantId, 'scan:reported', { sessionId: session.id, epcCodes });

  return res.json({ sessionId: session.id, status: 'REPORTED', epcCodes });
});

/**
 * POST /api/v1/scan-sessions/:id/confirm — admin ตรวจสอบแล้วยืนยัน commit เป็น fabric_items จริง
 */
export const confirmScanSession = asyncHandler(async (req, res) => {
  if (req.auth.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin เท่านั้นที่ยืนยัน session ได้');
  }

  const tenantId = req.auth.hospitalId;
  const session = await findTenantScopedSession(tenantId, req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');
  if (session.status !== 'REPORTED') {
    throw new AppError(400, 'INVALID_STATE', 'session นี้ยังไม่มีผลสแกนให้ยืนยัน');
  }

  const lots = await scopedQuery(pool, tenantId).select('fabric_lots', { id: session.fabric_lot_id });
  const lot = lots[0];
  if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้าของ session นี้');
  if (!lot.fabric_category_id) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ล็อตนี้ยังไม่ได้ระบุหมวดหมู่ผ้า ยืนยันไม่ได้');
  }

  // mysql2 แปลงคอลัมน์ JSON กลับเป็น JS array/object ให้อัตโนมัติตอน SELECT อยู่แล้ว
  // (ห้าม JSON.parse ซ้ำ ไม่งั้น array จะถูก toString() ก่อนแล้ว parse ไม่ผ่าน)
  const scannedEpcs = session.scanned_epcs || [];
  const epcCodes = req.body.epcCodes ?? scannedEpcs;

  const created = [];
  const skipped = [];

  for (const epcCode of epcCodes) {
    // epc_code unique ระดับ global — เช็คซ้ำข้ามทุกโรงพยาบาลเหมือน fabricItems.controller.js
    // eslint-disable-next-line no-await-in-loop
    const [existing] = await pool.query('SELECT id FROM fabric_items WHERE epc_code = ? LIMIT 1', [
      epcCode,
    ]);
    if (existing[0]) {
      skipped.push(epcCode);
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).insert('fabric_items', {
      epc_code: epcCode,
      fabric_category_id: lot.fabric_category_id,
      fabric_lot_id: lot.id,
      status: 'CENTRAL_STOCK',
      current_location_type: 'CENTRAL_STOCK',
      current_location_id: null,
      wash_count: 0,
    });
    created.push(epcCode);
  }

  await scopedQuery(pool, tenantId).update(
    'registration_scan_sessions',
    { id: session.id },
    {
      status: 'CONFIRMED',
      confirmed_by: req.auth.userId,
      confirmed_at: new Date(),
    }
  );

  emitToHospital(tenantId, 'scan:confirmed', { sessionId: session.id, created, skipped });

  return res.json({ sessionId: session.id, status: 'CONFIRMED', created, skipped });
});

/**
 * POST /api/v1/scan-sessions/:id/cancel
 */
export const cancelScanSession = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้');
  }

  const tenantId = req.auth.hospitalId;
  const session = await findTenantScopedSession(tenantId, req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');

  await scopedQuery(pool, tenantId).update(
    'registration_scan_sessions',
    { id: session.id },
    { status: 'CANCELLED' }
  );

  emitToHospital(tenantId, 'scan:cancelled', { sessionId: session.id });

  return res.status(204).send();
});
