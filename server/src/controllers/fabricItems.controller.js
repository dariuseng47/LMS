import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { getIO } from '../sockets/ioInstance.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { hasPermission } from '../utils/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// ยิง event ให้ dashboard ที่เปิดหน้า "รายการพัก & ชำรุด" ค้างอยู่เห็นรายการใหม่ทันทีไม่ต้องรีเฟรช
// (ห้อง hospital:<id> เดียวกับที่ scans.controller.js/scanSessions.controller.js ใช้)
function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

/**
 * GET /api/v1/fabric-items — list + filter (status, category, lot, epc แบบ exact match)
 */
export const listFabricItems = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const { status, categoryId, lotId, epcCode } = req.query;

  const where = {};
  if (status) where.status = status;
  if (categoryId) where.fabric_category_id = categoryId;
  if (lotId) where.fabric_lot_id = lotId;
  if (epcCode) where.epc_code = epcCode;

  const fabricItems = await scopedQuery(pool, tenantId).select('fabric_items', where);
  fabricItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return res.json({ fabricItems });
});

/**
 * POST /api/v1/fabric-items — admin เท่านั้น (default; operator ต้องรอสิทธิ์ override ในอนาคต)
 * ผ้าใหม่เริ่มที่สถานะ CENTRAL_STOCK เสมอ (สต๊อกกลาง พร้อมแจก ยังไม่เคยผ่านการสแกนจริง)
 */
export const createFabricItem = asyncHandler(async (req, res) => {
  if (req.auth.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลเท่านั้นที่ลงทะเบียนผ้าใหม่ได้');
  }

  const { epcCode, fabricLotId, photoUrl } = req.body;
  let { fabricCategoryId } = req.body;

  // ถ้าผูกล็อต ดึงหมวดหมู่จากล็อตให้อัตโนมัติ (ไม่ต้องกรอกซ้ำ) — ล็อตต้องตั้งหมวดหมู่ไว้แล้ว
  if (fabricLotId) {
    const lots = await scopedQuery(pool, req.auth.hospitalId).select('fabric_lots', {
      id: fabricLotId,
    });
    const lot = lots[0];
    if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้านี้');
    fabricCategoryId = fabricCategoryId ?? lot.fabric_category_id;
    if (!fabricCategoryId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ล็อตนี้ยังไม่ได้ระบุหมวดหมู่ผ้า กรุณาระบุ fabricCategoryId เอง');
    }
  }

  // epc_code เป็น unique key ระดับ global (ไม่ใช่ระดับ tenant) — ดู docs/data-model.md
  // จึงต้องเช็คซ้ำข้ามทุกโรงพยาบาล ไม่ใช่แค่ในเทแนนต์ตัวเอง (ข้อยกเว้นเดียวกับ auth.controller.js login)
  const [existing] = await pool.query('SELECT id FROM fabric_items WHERE epc_code = ? LIMIT 1', [
    epcCode,
  ]);
  if (existing[0]) {
    throw new AppError(409, 'EPC_TAKEN', 'รหัส EPC นี้มีอยู่ในระบบแล้ว');
  }

  const result = await scopedQuery(pool, req.auth.hospitalId).insert('fabric_items', {
    epc_code: epcCode,
    fabric_category_id: fabricCategoryId,
    fabric_lot_id: fabricLotId ?? null,
    status: 'CENTRAL_STOCK',
    current_location_type: 'CENTRAL_STOCK',
    current_location_id: null,
    wash_count: 0,
    photo_url: photoUrl ?? null,
  });

  return res.status(201).json({ id: result.insertId, epcCode, status: 'CENTRAL_STOCK' });
});

/**
 * POST /api/v1/fabric-items/bulk — admin เท่านั้น (ลงทะเบียนผ้าหลายชิ้นพร้อมกัน เช่น รับผ้าล็อตใหม่
 * ทีละหลัก 100 ชิ้น) ทุกชิ้นในคำขอเดียวแชร์หมวดหมู่/ล็อตเดียวกัน ต่างกันแค่ epcCode รายชิ้น
 * EPC ที่ซ้ำกับที่มีอยู่แล้ว (หรือซ้ำกันเองในชุดที่ส่งมา) จะถูกข้าม ไม่ error ทั้งชุด
 */
export const bulkCreateFabricItems = asyncHandler(async (req, res) => {
  if (req.auth.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลเท่านั้นที่ลงทะเบียนผ้าใหม่ได้');
  }

  const { epcCodes, fabricLotId, photoUrl } = req.body;
  let { fabricCategoryId } = req.body;

  if (fabricLotId) {
    const lots = await scopedQuery(pool, req.auth.hospitalId).select('fabric_lots', {
      id: fabricLotId,
    });
    const lot = lots[0];
    if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้านี้');
    fabricCategoryId = fabricCategoryId ?? lot.fabric_category_id;
    if (!fabricCategoryId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ล็อตนี้ยังไม่ได้ระบุหมวดหมู่ผ้า กรุณาระบุ fabricCategoryId เอง');
    }
  }

  const uniqueCodes = [...new Set(epcCodes)];
  const created = [];
  const skipped = [];

  for (const epcCode of uniqueCodes) {
    // epc_code เป็น unique key ระดับ global เหมือน createFabricItem เดี่ยวด้านบน
    const [existing] = await pool.query('SELECT id FROM fabric_items WHERE epc_code = ? LIMIT 1', [
      epcCode,
    ]);
    if (existing[0]) {
      skipped.push(epcCode);
      continue;
    }

    await scopedQuery(pool, req.auth.hospitalId).insert('fabric_items', {
      epc_code: epcCode,
      fabric_category_id: fabricCategoryId,
      fabric_lot_id: fabricLotId ?? null,
      status: 'CENTRAL_STOCK',
      current_location_type: 'CENTRAL_STOCK',
      current_location_id: null,
      wash_count: 0,
      photo_url: photoUrl ?? null,
    });
    created.push(epcCode);
  }

  return res.status(201).json({ created, skipped });
});

/**
 * GET /api/v1/fabric-items/:epc — รายละเอียด + ประวัติสแกนทั้งหมด (ใช้แทน wash-history ด้วยในตัว)
 */
export const getFabricItemDetail = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);

  const items = await scopedQuery(pool, tenantId).select('fabric_items', {
    epc_code: req.params.epc,
  });
  const fabricItem = items[0];
  if (!fabricItem) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้ารหัสนี้');
  }

  const scanHistory = await scopedQuery(pool, tenantId).select('scan_logs', {
    fabric_item_id: fabricItem.id,
  });
  scanHistory.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at));

  return res.json({ fabricItem, scanHistory });
});

async function findTenantScopedItem(tenantId, id) {
  const rows = await scopedQuery(pool, tenantId).select('fabric_items', { id });
  return rows[0];
}

/**
 * POST /api/v1/fabric-items/:id/hold — admin + operator (default เปิด เพราะเกิดหน้างานบ่อย)
 */
export const holdFabricItem = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้');
  }
  if (req.auth.role === 'OPERATOR') {
    const allowed = await hasPermission(req.auth.userId, 'OPERATOR', 'fabric.item.hold');
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์พักผ้า กรุณาติดต่อ admin ให้เปิดสิทธิ์');
    }
  }

  const tenantId = req.auth.hospitalId;
  const item = await findTenantScopedItem(tenantId, req.params.id);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้าชิ้นนี้');
  if (item.status === 'DECOMMISSIONED') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้ถูกแทงชำรุดไปแล้ว พักใช้งานไม่ได้');
  }
  if (item.status === 'PENDING_DECOMMISSION') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้กำลังรออนุมัติแทงชำรุดอยู่ พักใช้งานไม่ได้');
  }

  const { reasonCode, photoUrl } = req.body;

  await scopedQuery(pool, tenantId).update('fabric_items', { id: item.id }, { status: 'HOLD' });

  // hold_decommission_records ไม่มีคอลัมน์ hospital_id ของตัวเอง (tenant-scope ผ่าน fabric_item_id
  // ที่เช็คแล้วข้างบนว่าเป็นของ tenant นี้จริง) จึง insert ตรงได้ ไม่ผ่าน scopedQuery — ดู
  // server/src/db/scopedQuery.js หมายเหตุเรื่องตารางที่ tenant-scope ทางอ้อม
  const [result] = await pool.query(
    `INSERT INTO hold_decommission_records (fabric_item_id, action_type, reason_code, photo_url, created_by)
     VALUES (?, 'HOLD', ?, ?, ?)`,
    [item.id, reasonCode, photoUrl ?? null, req.auth.userId]
  );

  emitToHospital(tenantId, 'fabric:hold', {
    id: result.insertId,
    fabricItemId: item.id,
    epcCode: item.epc_code,
    reasonCode,
    photoUrl: photoUrl ?? null,
  });

  return res.status(201).json({ id: result.insertId, fabricItemId: item.id, status: 'HOLD' });
});

/**
 * POST /api/v1/fabric-items/:id/decommission — admin + operator (default เปิด)
 *
 * คำขอที่มาจากมือถือ (nativeapp/ ส่ง header X-Client-Type: mobile — ดู
 * nativeapp/src/api/client.js) ไม่มีผลทันที ต้องเข้าสถานะ PENDING_DECOMMISSION รอ admin
 * ของโรงพยาบาลกด approve/reject ที่ decommissionRequests.controller.js ก่อน ส่วนที่ทำผ่านหน้าเว็บ
 * เอง (admin คุมฟอร์มทั้งหมดอยู่แล้วบนเว็บ) มีผลทันทีเหมือนเดิม ไม่ต้องรออนุมัติซ้ำ
 */
export const decommissionFabricItem = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้');
  }
  if (req.auth.role === 'OPERATOR') {
    const allowed = await hasPermission(req.auth.userId, 'OPERATOR', 'fabric.item.hold');
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์แทงชำรุดผ้า กรุณาติดต่อ admin ให้เปิดสิทธิ์');
    }
  }

  const tenantId = req.auth.hospitalId;
  const item = await findTenantScopedItem(tenantId, req.params.id);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้าชิ้นนี้');
  if (item.status === 'DECOMMISSIONED') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้ถูกแทงชำรุดไปแล้ว');
  }
  if (item.status === 'PENDING_DECOMMISSION') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้มีคำขอแทงชำรุดที่รออนุมัติอยู่แล้ว');
  }

  const { reasonCode, photoUrl } = req.body;
  const isFromMobile = req.headers['x-client-type'] === 'mobile';
  const nextStatus = isFromMobile ? 'PENDING_DECOMMISSION' : 'DECOMMISSIONED';

  await scopedQuery(pool, tenantId).update('fabric_items', { id: item.id }, { status: nextStatus });

  const [result] = await pool.query(
    `INSERT INTO hold_decommission_records
       (fabric_item_id, action_type, reason_code, photo_url, status, previous_status, created_by)
     VALUES (?, 'DECOMMISSION', ?, ?, ?, ?, ?)`,
    [
      item.id,
      reasonCode,
      photoUrl ?? null,
      isFromMobile ? 'PENDING' : 'APPROVED',
      isFromMobile ? item.status : null,
      req.auth.userId,
    ]
  );

  const payload = {
    id: result.insertId,
    fabricItemId: item.id,
    epcCode: item.epc_code,
    reasonCode,
    photoUrl: photoUrl ?? null,
  };
  emitToHospital(tenantId, isFromMobile ? 'fabric:decommission-pending' : 'fabric:decommission', payload);

  return res.status(201).json({ id: result.insertId, fabricItemId: item.id, status: nextStatus });
});
