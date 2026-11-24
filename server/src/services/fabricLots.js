import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { scopedQuery } from '../db/scopedQuery.js';

// 1 ล็อต มีได้หลายประเภทผ้า (ดู db/migrations/041_fabric_lot_lines.sql)
// ประเภทในล็อต = ที่ตั้งไว้ตอนสั่งซื้อ (fabric_lot_lines) รวมกับประเภทของผ้าที่ลงทะเบียนเข้าล็อตจริง — ลงผ้าประเภทที่ไม่อยู่
// ในล็อต ประเภทนั้นจึงขึ้นในล็อตให้อัตโนมัติ (quantity = null เพราะไม่มีจำนวนสั่งซื้อ)

/** คืน Map<lotId, lines[]> ของทุกล็อตในโรงพยาบาล — line = { category_id, category_name, group_name, quantity, registered_count } */
export async function loadLotLines(tenantId) {
  const [[ordered], [registered], [categories]] = await Promise.all([
    pool.query(
      `SELECT ll.fabric_lot_id, ll.fabric_category_id, ll.quantity
       FROM fabric_lot_lines ll
       JOIN fabric_lots l ON l.id = ll.fabric_lot_id
       WHERE l.hospital_id = ?
       ORDER BY ll.id`,
      [tenantId]
    ),
    pool.query(
      `SELECT fabric_lot_id, fabric_category_id, COUNT(*) AS registered_count
       FROM fabric_items
       WHERE hospital_id = ? AND fabric_lot_id IS NOT NULL AND deleted_at IS NULL
       GROUP BY fabric_lot_id, fabric_category_id`,
      [tenantId]
    ),
    pool.query(
      `SELECT c.id, c.name, g.name AS group_name
       FROM fabric_categories c
       LEFT JOIN fabric_groups g ON g.id = c.group_id
       WHERE c.hospital_id = ?`,
      [tenantId]
    ),
  ]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const linesByLot = new Map();

  const ensureLine = (lotId, categoryId) => {
    if (!linesByLot.has(lotId)) linesByLot.set(lotId, new Map());
    const lines = linesByLot.get(lotId);
    if (!lines.has(categoryId)) {
      const category = categoryById.get(categoryId);
      lines.set(categoryId, {
        category_id: categoryId,
        category_name: category?.name ?? null,
        group_name: category?.group_name ?? null,
        quantity: null,
        registered_count: 0,
      });
    }
    return lines.get(categoryId);
  };

  ordered.forEach((row) => {
    ensureLine(row.fabric_lot_id, row.fabric_category_id).quantity = Number(row.quantity);
  });
  registered.forEach((row) => {
    ensureLine(row.fabric_lot_id, row.fabric_category_id).registered_count = Number(
      row.registered_count
    );
  });

  return new Map([...linesByLot].map(([lotId, lines]) => [lotId, [...lines.values()]]));
}

// ประเภททุกตัวต้องเป็นของโรงพยาบาลนี้
export async function assertCategoriesInTenant(tenantId, categoryIds) {
  if (categoryIds.length === 0) return;
  const [rows] = await pool.query(
    'SELECT id FROM fabric_categories WHERE hospital_id = ? AND id IN (?)',
    [tenantId, categoryIds]
  );
  if (rows.length !== new Set(categoryIds).size) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่พบประเภทผ้าบางรายการในโรงพยาบาลนี้');
  }
}

// ค่าสรุประดับล็อต (คอลัมน์เดิมใน fabric_lots) จากรายการประเภท — ให้ server/แอปเวอร์ชันเก่าอ่านต่อได้
export function lotSummaryOf(lines) {
  return {
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    fabric_category_id: lines.length === 1 ? lines[0].fabricCategoryId : null,
  };
}

export async function insertLotLines(conn, lotId, lines) {
  if (lines.length === 0) return;
  await conn.query(
    'INSERT INTO fabric_lot_lines (fabric_lot_id, fabric_category_id, quantity) VALUES ?',
    [lines.map((line) => [lotId, line.fabricCategoryId, line.quantity])]
  );
}

async function findLotCategoryId(lot) {
  const [lines] = await pool.query(
    'SELECT fabric_category_id FROM fabric_lot_lines WHERE fabric_lot_id = ?',
    [lot.id]
  );
  if (lines.length === 1) return lines[0].fabric_category_id;
  return lines.length === 0 ? lot.fabric_category_id : null;
}

/**
 * ประเภทผ้าของชุดที่จะลงทะเบียน: ระบุมาเอง (ไม่จำเป็นต้องอยู่ในล็อต) หรือไม่ระบุแต่ล็อตมีประเภทเดียว
 * ล็อตหลายประเภท/ยังไม่ตั้งประเภท แล้วไม่ระบุมา -> LOT_NEEDS_CATEGORY
 * คืน { lot, fabricCategoryId } (lot = null ถ้าไม่ผูกล็อต)
 */
export async function resolveRegistrationTarget(tenantId, { fabricLotId, fabricCategoryId }) {
  if (!fabricLotId) return { lot: null, fabricCategoryId };

  const [lot] = await scopedQuery(pool, tenantId).select('fabric_lots', { id: fabricLotId });
  if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้านี้');

  const categoryId = fabricCategoryId ?? (await findLotCategoryId(lot));
  if (!categoryId) {
    throw new AppError(
      400,
      'LOT_NEEDS_CATEGORY',
      'ล็อตนี้มีหลายประเภทผ้า (หรือยังไม่ได้ตั้งประเภท) ต้องเลือกประเภทผ้าของชุดนี้ด้วย — ถ้าแอปยังเลือกไม่ได้ ให้ใช้ "ผูกประเภท" แทน'
    );
  }
  return { lot, fabricCategoryId: categoryId };
}
