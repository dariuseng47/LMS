import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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

  const { epcCode, fabricCategoryId, fabricLotId, photoUrl } = req.body;

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

  const tenantId = req.auth.hospitalId;
  const item = await findTenantScopedItem(tenantId, req.params.id);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้าชิ้นนี้');
  if (item.status === 'DECOMMISSIONED') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้ถูกแทงชำรุดไปแล้ว พักใช้งานไม่ได้');
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

  return res.status(201).json({ id: result.insertId, fabricItemId: item.id, status: 'HOLD' });
});

/**
 * POST /api/v1/fabric-items/:id/decommission — admin + operator (default เปิด)
 */
export const decommissionFabricItem = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้');
  }

  const tenantId = req.auth.hospitalId;
  const item = await findTenantScopedItem(tenantId, req.params.id);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้าชิ้นนี้');
  if (item.status === 'DECOMMISSIONED') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้ถูกแทงชำรุดไปแล้ว');
  }

  const { reasonCode, photoUrl } = req.body;

  await scopedQuery(pool, tenantId).update(
    'fabric_items',
    { id: item.id },
    { status: 'DECOMMISSIONED' }
  );

  const [result] = await pool.query(
    `INSERT INTO hold_decommission_records (fabric_item_id, action_type, reason_code, photo_url, created_by)
     VALUES (?, 'DECOMMISSION', ?, ?, ?)`,
    [item.id, reasonCode, photoUrl ?? null, req.auth.userId]
  );

  return res.status(201).json({ id: result.insertId, fabricItemId: item.id, status: 'DECOMMISSIONED' });
});
