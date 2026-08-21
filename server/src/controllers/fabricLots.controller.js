import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/fabric-lots
 */
export const listLots = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const lots = await scopedQuery(pool, tenantId).select('fabric_lots');
  return res.json({ lots });
});

/**
 * POST /api/v1/fabric-lots — admin เท่านั้น (default; operator ต้องรอสิทธิ์ override ในอนาคต)
 * สร้างแค่ "หัวล็อต" (lot_code, quantity, purchased_at) — EPC รายชิ้นค่อยผูกเข้าล็อตทีหลัง
 * ผ่าน POST /fabric-items (fabricLotId) เพราะของจริงอาจยังไม่มี RFID tag ติดตอนสั่งซื้อ
 */
export const createLot = asyncHandler(async (req, res) => {
  if (req.auth.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลเท่านั้นที่เพิ่มล็อตผ้าได้');
  }

  const { lotCode, purchasedAt, quantity, fabricCategoryId, maxWashCycles, maxUsageMonths } = req.body;
  const result = await scopedQuery(pool, req.auth.hospitalId).insert('fabric_lots', {
    lot_code: lotCode,
    purchased_at: purchasedAt ?? null,
    quantity,
    fabric_category_id: fabricCategoryId ?? null,
    max_wash_cycles: maxWashCycles ?? null,
    max_usage_months: maxUsageMonths ?? null,
    created_by: req.auth.userId,
  });

  return res.status(201).json({ id: result.insertId, lotCode, quantity });
});
