import { pool } from '../db/pool.js';
import { getIO } from '../sockets/ioInstance.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId, assertTenantAccess, assertHospitalEditable } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { registerFabricItems, findSessionRegistration } from '../services/fabricRegistration.js';

// Flow: ผู้ใช้เลือกล็อต/ประเภทผ้าบนแอป handheld -> เริ่มรอบ (trigger) -> เหนี่ยวไกสแกน -> ส่งผล (report)
// -> ลงทะเบียนเป็น fabric_items ทันที ไม่ต้องมีแอดมินอนุมัติบนเว็บแล้ว (ดูย้อนหลังได้ในแท็บ "ประวัติการลงทะเบียนผ้า")
//
// เพราะไม่มีคนอนุมัติคั่น สิทธิ์จึงเช็คที่ผู้ส่งเอง: route ต้องมี handheld.inventory.edit (หรือ web.fabric.register.edit)
// และโรงพยาบาลต้องอยู่ใน scope แบบแก้ไขได้ (assertHospitalEditable)
//
// /confirm เหลือไว้ปิดรอบที่ค้างสถานะ REPORTED จากระบบเดิม (ส่งผลมาก่อนเปลี่ยนเป็นลงทะเบียนอัตโนมัติ)
//
// หมายเหตุ: แอปยัง auth ด้วย user JWT ไม่ใช่ device token

const OPEN_STATUSES = ['PENDING', 'SCANNING', 'REPORTED'];

async function findTenantScopedSession(tenantId, id) {
  const rows = await scopedQuery(pool, tenantId).select('registration_scan_sessions', { id });
  return rows[0];
}

// หา session/device แบบไม่ผูก tenant — ใช้หา hospital_id เจ้าของจริงตอน superadmin ดำเนินการ
async function findSessionAnyTenant(id) {
  const [rows] = await pool.query('SELECT * FROM registration_scan_sessions WHERE id = ?', [id]);
  return rows[0];
}

async function findDeviceAnyTenant(id) {
  const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [id]);
  return rows[0];
}

function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

// รอบผูกล็อต หรือระบุแค่ประเภทตรงๆ ก็ได้ (ดู triggerScanSession) — ประเภทของผ้าที่จะลงทะเบียนมาจากอย่างใดอย่างหนึ่ง
async function resolveSessionCategoryId(session) {
  if (!session.fabric_lot_id) return session.fabric_category_id;

  const [lot] = await scopedQuery(pool, session.hospital_id).select('fabric_lots', {
    id: session.fabric_lot_id,
  });
  if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้าของรอบสแกนนี้');
  if (!lot.fabric_category_id) throw lotWithoutCategoryError();
  return lot.fabric_category_id;
}

function lotWithoutCategoryError() {
  return new AppError(
    400,
    'LOT_WITHOUT_CATEGORY',
    'ล็อตนี้ยังไม่ได้ตั้งประเภทผ้า — เลือก "ผูกประเภท" แทนการผูกล็อต'
  );
}

// ลงทะเบียนผ้าของรอบ + ปิดรอบ (CONFIRMED) ใน transaction เดียวกัน
// created_by = คนที่เริ่มรอบ/ถือ handheld (session.triggered_by) ตรงกับ "ผ้านี้ใครแอดมา" ที่หมายถึงคนทำงานหน้างานจริง
// confirmedBy = แอดมินที่กดยืนยันรอบค้างจากระบบเดิม (null = ลงทะเบียนอัตโนมัติ)
async function registerSession(session, { epcCodes, scannedEpcs, confirmedBy }) {
  const result = await registerFabricItems({
    tenantId: session.hospital_id,
    epcCodes,
    fabricCategoryId: await resolveSessionCategoryId(session),
    fabricLotId: session.fabric_lot_id,
    createdBy: session.triggered_by,
    source: 'HANDHELD',
    deviceId: session.device_id,
    sessionId: session.id,
    sessionClose: { scannedEpcs, confirmedBy },
  });

  emitToHospital(session.hospital_id, 'scan:confirmed', {
    sessionId: session.id,
    created: result.created,
    skipped: result.skipped,
  });
  return result;
}

/**
 * POST /api/v1/scan-sessions — เริ่มรอบสแกนใหม่ (admin/operator จากแอป handheld)
 * ผูกล็อต (fabricLotId) หรือระบุแค่ประเภทตรงๆ ไม่ผูกล็อต (fabricCategoryId) ก็ได้ — อย่างใด
 * อย่างหนึ่ง (validate แล้วที่ schema) เหมือน createFabricItem/bulkCreateFabricItems ที่ยอมให้
 * ลงทะเบียนแบบไม่มีล็อตได้เช่นกัน ดู fabricItems.controller.js
 * ล็อตที่ยังไม่ตั้งประเภทผ้า -> ปฏิเสธตั้งแต่ตอนเริ่ม (ไม่งั้นสแกนเสร็จแล้วลงทะเบียนไม่ได้)
 */
export const triggerScanSession = asyncHandler(async (req, res) => {
  const { fabricLotId, fabricCategoryId, deviceId } = req.body;

  // ผูก tenant ตามเจ้าของ deviceId ที่ระบุมาเลย (ไม่ต้องให้ superadmin ส่ง hospitalId แยกซ้ำ)
  const device = await findDeviceAnyTenant(deviceId);
  if (!device) throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  await assertTenantAccess(req, device.hospital_id);
  await assertHospitalEditable(req, device.hospital_id);
  const tenantId = device.hospital_id;

  let lot = null;
  let category = null;

  if (fabricLotId) {
    const lots = await scopedQuery(pool, tenantId).select('fabric_lots', { id: fabricLotId });
    lot = lots[0];
    if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้านี้');
    if (!lot.fabric_category_id) throw lotWithoutCategoryError();
  } else {
    const categories = await scopedQuery(pool, tenantId).select('fabric_categories', {
      id: fabricCategoryId,
    });
    category = categories[0];
    if (!category) throw new AppError(404, 'NOT_FOUND', 'ไม่พบประเภทผ้านี้');
  }

  if (device.device_type !== 'HANDHELD') {
    throw new AppError(400, 'VALIDATION_ERROR', 'อุปกรณ์ที่เลือกไม่ใช่ handheld scanner');
  }

  const result = await scopedQuery(pool, tenantId).insert('registration_scan_sessions', {
    fabric_lot_id: lot?.id ?? null,
    fabric_category_id: lot ? null : category.id,
    device_id: deviceId,
    status: 'PENDING',
    triggered_by: req.auth.userId,
  });

  const session = {
    id: result.insertId,
    fabricLotId: lot?.id ?? null,
    fabricCategoryId: lot ? null : category.id,
    deviceId,
    lotCode: lot?.lot_code ?? null,
    categoryName: category?.name ?? null,
    status: 'PENDING',
  };

  // ยิงไปทั้งห้อง hospital:<id> — อุปกรณ์ handheld (เมื่อมีแอปจริง) filter เอาเฉพาะ deviceId ตัวเอง
  emitToHospital(tenantId, 'scan:trigger', session);

  return res.status(201).json({ session });
});

/**
 * GET /api/v1/scan-sessions — รายการ session ที่ยังไม่ปิด (default: PENDING/SCANNING/REPORTED)
 *
 * เว็บใช้ดึงรอบที่ค้าง REPORTED จากระบบเดิม (รออนุมัติ) ให้แอดมินเคลียร์ครั้งเดียวในหน้าลงทะเบียนผ้า
 *
 * join lot_code / ชื่อประเภท / ชื่อผู้ถือ handheld ให้ frontend แสดงได้เลย — ต้องใช้ raw SQL
 * เพราะ scopedQuery ไม่รองรับ JOIN (บังคับ WHERE s.hospital_id = ? ไว้ให้ tenant isolation แล้ว)
 */
export const listScanSessions = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const requested = req.query.status
    ? String(req.query.status)
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => OPEN_STATUSES.concat('CONFIRMED', 'CANCELLED').includes(s))
    : OPEN_STATUSES;
  const statuses = requested.length ? requested : OPEN_STATUSES;
  const placeholders = statuses.map(() => '?').join(', ');

  const [sessions] = await pool.query(
    `SELECT s.*, l.lot_code, c.name AS category_name, lc.name AS lot_category_name,
            d.caretaker_name AS device_caretaker_name,
            u.full_name AS triggered_by_name
     FROM registration_scan_sessions s
     LEFT JOIN fabric_lots l ON l.id = s.fabric_lot_id
     LEFT JOIN fabric_categories c ON c.id = s.fabric_category_id
     LEFT JOIN fabric_categories lc ON lc.id = l.fabric_category_id
     LEFT JOIN devices d ON d.id = s.device_id
     LEFT JOIN users u ON u.id = s.triggered_by
     WHERE s.hospital_id = ? AND s.status IN (${placeholders})
     ORDER BY s.created_at DESC`,
    [tenantId, ...statuses]
  );

  return res.json({ sessions });
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
 * POST /api/v1/scan-sessions/:id/report — แอป handheld ส่งรายการ EPC ที่สแกนได้ -> ลงทะเบียนเข้าระบบทันที
 * ส่งซ้ำรอบที่ลงทะเบียนไปแล้ว (เช่น เน็ตหลุดก่อนได้คำตอบแล้วกดใหม่) -> ตอบผลเดิม ไม่ error
 */
export const reportScanSession = asyncHandler(async (req, res) => {
  const session = await findSessionAnyTenant(req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');
  await assertTenantAccess(req, session.hospital_id);
  await assertHospitalEditable(req, session.hospital_id);

  const { epcCodes } = req.body;

  let created;
  let skipped;
  try {
    ({ created, skipped } = await registerSession(session, {
      epcCodes,
      scannedEpcs: epcCodes,
      confirmedBy: null,
    }));
  } catch (error) {
    if (error.code !== 'SESSION_CLOSED') throw error;

    const current = await findSessionAnyTenant(session.id);
    if (current.status !== 'CONFIRMED') {
      throw new AppError(400, 'INVALID_STATE', 'รอบสแกนนี้ถูกยกเลิกไปแล้ว ส่งผลเพิ่มไม่ได้');
    }
    created = await findSessionRegistration(session.hospital_id, session.id);
    const createdSet = new Set(created);
    skipped = epcCodes.filter((epcCode) => !createdSet.has(epcCode));
  }

  return res.json({ sessionId: session.id, status: 'CONFIRMED', created, skipped });
});

/**
 * POST /api/v1/scan-sessions/:id/confirm — แอดมินยืนยันรอบที่ค้าง REPORTED จากระบบเดิม
 */
export const confirmScanSession = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin หรือ superadmin เท่านั้นที่ยืนยัน session ได้');
  }

  const session = await findSessionAnyTenant(req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');
  await assertTenantAccess(req, session.hospital_id);
  if (session.status !== 'REPORTED') {
    throw new AppError(400, 'INVALID_STATE', 'session นี้ยังไม่มีผลสแกนให้ยืนยัน');
  }

  // mysql2 แปลงคอลัมน์ JSON กลับเป็น JS array/object ให้อัตโนมัติตอน SELECT อยู่แล้ว
  // (ห้าม JSON.parse ซ้ำ ไม่งั้น array จะถูก toString() ก่อนแล้ว parse ไม่ผ่าน)
  const scannedEpcs = session.scanned_epcs || [];
  const { created, skipped } = await registerSession(session, {
    epcCodes: req.body.epcCodes ?? scannedEpcs,
    scannedEpcs,
    confirmedBy: req.auth.userId,
  });

  return res.json({ sessionId: session.id, status: 'CONFIRMED', created, skipped });
});

/**
 * POST /api/v1/scan-sessions/:id/cancel
 */
export const cancelScanSession = asyncHandler(async (req, res) => {
  const session = await findSessionAnyTenant(req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');
  await assertTenantAccess(req, session.hospital_id);
  const tenantId = session.hospital_id;

  // เงื่อนไขสถานะอยู่ใน WHERE กันยกเลิกทับรอบที่เพิ่งลงทะเบียนเสร็จพอดี
  const [result] = await pool.query(
    `UPDATE registration_scan_sessions SET status = 'CANCELLED'
     WHERE hospital_id = ? AND id = ? AND status IN (?)`,
    [tenantId, session.id, OPEN_STATUSES]
  );
  if (result.affectedRows === 0 && session.status !== 'CANCELLED') {
    throw new AppError(400, 'INVALID_STATE', 'รอบสแกนนี้ลงทะเบียนเข้าระบบไปแล้ว ยกเลิกไม่ได้');
  }

  emitToHospital(tenantId, 'scan:cancelled', { sessionId: session.id });

  return res.status(204).send();
});
