import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import {
  resolveTenantId,
  assertTenantWritable,
  resolveWritableBodyTenantId,
} from '../utils/tenant.js';
import { hasAnyPermission, permKeysForLegacy } from '../utils/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  loadLotLines,
  lotSummaryOf,
  insertLotLines,
  assertCategoriesInTenant,
} from '../services/fabricLots.js';

/**
 * GET /api/v1/fabric-lots — join ชื่อผู้เพิ่มล็อต (admin) ให้ตารางแสดงผลได้เลย ไม่ต้อง join เพิ่มฝั่ง frontend เอง
 *   lines            = ประเภทผ้าในล็อต + จำนวนสั่งซื้อ/ลงทะเบียนแล้วของแต่ละประเภท (ดู services/fabricLots.js)
 *   registered_count = ผ้าที่ลงทะเบียนเข้าล็อตนี้แล้วทุกประเภทรวมกัน (เทียบกับ quantity = ยอดสั่งซื้อรวม)
 *   category_name/group_name = ประเภทเดียวของล็อต (หลายประเภท = null) คงไว้ให้แอปเวอร์ชันเก่า
 */
export const listLots = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const [[lots], linesByLot] = await Promise.all([
    pool.query(
      `SELECT l.*, u.full_name AS created_by_name, c.name AS category_name, g.name AS group_name
       FROM fabric_lots l
       LEFT JOIN users u ON u.id = l.created_by
       LEFT JOIN fabric_categories c ON c.id = l.fabric_category_id
       LEFT JOIN fabric_groups g ON g.id = c.group_id
       WHERE l.hospital_id = ?
       ORDER BY l.id DESC`,
      [tenantId]
    ),
    loadLotLines(tenantId),
  ]);

  return res.json({
    lots: lots.map((lot) => {
      const lines = linesByLot.get(lot.id) ?? [];
      return {
        ...lot,
        lines,
        registered_count: lines.reduce((sum, line) => sum + line.registered_count, 0),
      };
    }),
  });
});

/**
 * POST /api/v1/fabric-lots — admin เสมอ / operator ต้องได้รับสิทธิ์ 'fabric.lot.create'
 * จาก admin ก่อน (ดู docs/rbac-permissions.md, default: operator ปิด)
 * สร้างแค่ "หัวล็อต" + รายการประเภท (lines) — EPC รายชิ้นค่อยผูกเข้าล็อตทีหลัง
 * ผ่าน POST /fabric-items (fabricLotId) เพราะของจริงอาจยังไม่มี RFID tag ติดตอนสั่งซื้อ
 * ยังรับแบบเดิม (quantity + fabricCategoryId ประเภทเดียว) จากเว็บเวอร์ชันเก่าได้
 */
export const createLot = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    const allowed = await hasAnyPermission(
      req.auth.userId,
      'OPERATOR',
      permKeysForLegacy('fabric.lot.create')
    );
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เพิ่มล็อตผ้า กรุณาติดต่อ admin ให้เปิดสิทธิ์');
    }
  }

  const tenantId = await resolveWritableBodyTenantId(req);

  const { lotCode, purchasedAt, quantity, fabricCategoryId, maxWashCycles, maxUsageMonths } = req.body;
  const lines = req.body.lines ?? (fabricCategoryId ? [{ fabricCategoryId, quantity }] : []);
  await assertCategoriesInTenant(
    tenantId,
    lines.map((line) => line.fabricCategoryId)
  );
  const summary = lines.length > 0 ? lotSummaryOf(lines) : { quantity, fabric_category_id: null };

  const conn = await pool.getConnection();
  let lotId;
  try {
    await conn.beginTransaction();
    const [result] = await conn.query('INSERT INTO fabric_lots SET ?', [
      {
        hospital_id: tenantId,
        lot_code: lotCode,
        purchased_at: purchasedAt || null,
        max_wash_cycles: maxWashCycles ?? null,
        max_usage_months: maxUsageMonths ?? null,
        created_by: req.auth.userId,
        ...summary,
      },
    ]);
    lotId = result.insertId;
    await insertLotLines(conn, lotId, lines);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return res.status(201).json({ id: lotId, lotCode, quantity: summary.quantity });
});

/**
 * PATCH /api/v1/fabric-lots/:id — แก้ไขล็อต ส่งเฉพาะฟิลด์ที่แก้ (null = ล้างค่า) lines = แทนที่รายการประเภททั้งชุด
 * ผ้าที่ลงทะเบียนไปแล้วไม่ถูกแก้ — ประเภทที่เอาออกจากรายการแต่มีผ้าอยู่ ยังขึ้นในล็อตตามผ้าจริง (ไม่มีจำนวนสั่งซื้อ)
 */
export const updateLot = asyncHandler(async (req, res) => {
  const [[existing]] = await pool.query('SELECT hospital_id FROM fabric_lots WHERE id = ?', [
    req.params.id,
  ]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้านี้');
  await assertTenantWritable(req, existing.hospital_id);
  const tenantId = existing.hospital_id;

  const { lotCode, purchasedAt, lines, maxWashCycles, maxUsageMonths } = req.body;
  if (lines) {
    await assertCategoriesInTenant(
      tenantId,
      lines.map((line) => line.fabricCategoryId)
    );
  }

  const updates = {
    ...(lotCode !== undefined && { lot_code: lotCode }),
    ...(purchasedAt !== undefined && { purchased_at: purchasedAt || null }),
    ...(maxWashCycles !== undefined && { max_wash_cycles: maxWashCycles }),
    ...(maxUsageMonths !== undefined && { max_usage_months: maxUsageMonths }),
    ...(lines && lotSummaryOf(lines)),
  };
  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE fabric_lots SET ? WHERE hospital_id = ? AND id = ?', [
      updates,
      tenantId,
      req.params.id,
    ]);
    if (lines) {
      await conn.query('DELETE FROM fabric_lot_lines WHERE fabric_lot_id = ?', [req.params.id]);
      await insertLotLines(conn, req.params.id, lines);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return res.status(204).send();
});
