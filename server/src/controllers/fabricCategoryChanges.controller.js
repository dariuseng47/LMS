import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { getIO } from '../sockets/ioInstance.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { resolveTenantId, assertHospitalEditable } from '../utils/tenant.js';

// เมนู "เปลี่ยนหมวดหมู่ / ประเภทผ้า" — ย้ายผ้าไปอยู่ประเภทผ้าอื่น (หมวดหมู่เปลี่ยนตามประเภทใหม่เอง
// เพราะผ้าได้หมวดหมู่ผ่านประเภทผ้า) ดู db/migrations/033_fabric_category_changes.sql
//
// version control: ทุกการเปลี่ยน = 1 batch เก็บค่าก่อน/หลังรายชิ้น ย้อนกลับได้ทั้ง batch
// การย้อนกลับเองเป็น batch ใหม่ (REVERT) ประวัติเดิมไม่ถูกลบ/แก้ — ย้อนการย้อนกลับ (redo) ได้เช่นกัน
// ชิ้นที่ถูกเปลี่ยนประเภทต่อไปแล้วหลัง batch นั้น (ประเภทปัจจุบัน ≠ ปลายทางของ batch) จะไม่ถูกย้อน
// (ข้ามและรายงานเป็น conflict) กันย้อนทับงานของ batch ที่ใหม่กว่า

function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

// ผ้าที่จำหน่ายออกแล้วไม่ให้แก้ประเภท (ประวัติทรัพย์สินปิดแล้ว)
const BLOCKED_STATUSES = new Set(['DECOMMISSIONED']);

const ITEM_SELECT = `
  SELECT f.id, f.epc_code, f.status, f.fabric_category_id,
         fc.name AS category_name, fg.name AS group_name
  FROM fabric_items f
  JOIN fabric_categories fc ON fc.id = f.fabric_category_id
  LEFT JOIN fabric_groups fg ON fg.id = fc.group_id
  WHERE f.hospital_id = ? AND f.deleted_at IS NULL`;

async function loadTargetCategory(tenantId, categoryId) {
  const [rows] = await pool.query(
    `SELECT fc.id, fc.name, fg.name AS group_name
     FROM fabric_categories fc
     LEFT JOIN fabric_groups fg ON fg.id = fc.group_id
     WHERE fc.hospital_id = ? AND fc.id = ?`,
    [tenantId, categoryId]
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'ไม่พบประเภทผ้าปลายทางนี้');
  return { id: rows[0].id, name: rows[0].name, groupName: rows[0].group_name };
}

function toChangeRow(item) {
  return {
    itemId: item.id,
    epcCode: item.epc_code,
    status: item.status,
    fromCategoryId: item.fabric_category_id,
    fromCategoryName: item.category_name,
    fromGroupName: item.group_name,
  };
}

// แยกกลุ่มผ้าตาม EPC ที่ส่งมา — executor = pool (preview) หรือ connection (ใน transaction, lock แถว)
async function classifyItems(executor, tenantId, epcCodes, toCategoryId, { forUpdate = false } = {}) {
  const [items] = await executor.query(
    `${ITEM_SELECT} AND f.epc_code IN (?)${forUpdate ? ' FOR UPDATE' : ''}`,
    [tenantId, epcCodes]
  );
  const byEpc = new Map(items.map((i) => [i.epc_code, i]));

  const ready = [];
  const same = [];
  const blocked = [];
  const notFound = [];
  epcCodes.forEach((epcCode) => {
    const item = byEpc.get(epcCode);
    if (!item) notFound.push(epcCode);
    else if (BLOCKED_STATUSES.has(item.status)) blocked.push(toChangeRow(item));
    else if (Number(item.fabric_category_id) === Number(toCategoryId)) same.push(toChangeRow(item));
    else ready.push(toChangeRow(item));
  });
  return { ready, same, blocked, notFound };
}

/**
 * POST /api/v1/fabric-items/change-category
 * confirm=false -> preview: จัดกลุ่ม ready (เปลี่ยนได้) / same (อยู่ประเภทนี้แล้ว) / blocked / notFound
 * confirm=true  -> เปลี่ยนจริงเฉพาะ ready ใน transaction เดียว + บันทึก batch (version) + audit_logs
 */
export const changeCategory = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  await assertHospitalEditable(req, tenantId);

  const { toCategoryId, confirm, reason, source } = req.body;
  const epcCodes = [...new Set(req.body.epcCodes)];
  const toCategory = await loadTargetCategory(tenantId, toCategoryId);

  if (!confirm) {
    const groups = await classifyItems(pool, tenantId, epcCodes, toCategoryId);
    return res.json({ preview: true, toCategory, ...groups });
  }

  const conn = await pool.getConnection();
  let groups;
  let batchId;
  try {
    await conn.beginTransaction();
    groups = await classifyItems(conn, tenantId, epcCodes, toCategoryId, { forUpdate: true });
    if (groups.ready.length === 0) {
      throw new AppError(400, 'NOTHING_TO_CHANGE', 'ไม่มีผ้าที่เปลี่ยนประเภทได้ในรายการนี้');
    }

    const [batch] = await conn.query(
      `INSERT INTO fabric_category_change_batches
         (hospital_id, batch_type, mode, source, to_category_id, reason, item_count, created_by)
       VALUES (?, 'CHANGE', ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        groups.ready.length === 1 ? 'SINGLE' : 'BULK',
        source,
        toCategoryId,
        reason || null,
        groups.ready.length,
        req.auth.userId,
      ]
    );
    batchId = batch.insertId;

    await conn.query(
      `INSERT INTO fabric_category_change_items
         (batch_id, fabric_item_id, epc_code, from_category_id, to_category_id) VALUES ?`,
      [groups.ready.map((r) => [batchId, r.itemId, r.epcCode, r.fromCategoryId, toCategoryId])]
    );

    await conn.query(
      'UPDATE fabric_items SET fabric_category_id = ? WHERE hospital_id = ? AND id IN (?)',
      [toCategoryId, tenantId, groups.ready.map((r) => r.itemId)]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await logAudit({
    hospitalId: tenantId,
    userId: req.auth.userId,
    action: 'FABRIC_CATEGORY_CHANGED',
    entityType: 'fabric_category_change_batch',
    entityId: batchId,
    metadata: {
      batchId,
      source,
      reason: reason || null,
      toCategoryId,
      toCategoryName: toCategory.name,
      count: groups.ready.length,
      items: groups.ready.map((r) => ({
        epcCode: r.epcCode,
        fromCategoryId: r.fromCategoryId,
        fromCategoryName: r.fromCategoryName,
      })),
    },
  });

  emitToHospital(tenantId, 'fabric:category-changed', { batchId, count: groups.ready.length });

  return res.status(201).json({
    preview: false,
    batchId,
    toCategory,
    applied: groups.ready,
    same: groups.same,
    blocked: groups.blocked,
    notFound: groups.notFound,
  });
});

// สถานะของ batch ที่ client เอาไปโชว์ — derive จากจำนวนชิ้นที่ยังมีผลอยู่
function batchStatus(batch) {
  const total = Number(batch.item_count);
  const active = Number(batch.active_count);
  if (active === 0) return 'REVERTED';
  if (active < total) return 'PARTIALLY_REVERTED';
  return 'ACTIVE';
}

const BATCH_LIST_SELECT = `
  SELECT b.id, b.batch_type, b.mode, b.source, b.reason, b.item_count, b.reverts_batch_id,
         b.to_category_id, b.created_at, b.created_by, u.full_name AS created_by_name,
         tc.name AS to_category_name,
         (SELECT COUNT(*) FROM fabric_category_change_items i
           WHERE i.batch_id = b.id AND i.reverted_at IS NULL) AS active_count,
         (SELECT GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ')
            FROM fabric_category_change_items i
            JOIN fabric_categories c ON c.id = i.from_category_id
           WHERE i.batch_id = b.id) AS from_category_names,
         (SELECT GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ')
            FROM fabric_category_change_items i
            JOIN fabric_categories c ON c.id = i.to_category_id
           WHERE i.batch_id = b.id) AS to_category_names
  FROM fabric_category_change_batches b
  LEFT JOIN users u ON u.id = b.created_by
  LEFT JOIN fabric_categories tc ON tc.id = b.to_category_id`;

function serializeBatch(row) {
  return { ...row, status: batchStatus(row), active_count: Number(row.active_count) };
}

/**
 * GET /api/v1/fabric-items/category-changes — ประวัติการเปลี่ยน (ใหม่ล่าสุดก่อน)
 */
export const listCategoryChanges = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { limit, offset } = req.query;

  const [rows] = await pool.query(
    `${BATCH_LIST_SELECT}
     WHERE b.hospital_id = ?
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, limit, offset]
  );
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM fabric_category_change_batches WHERE hospital_id = ?',
    [tenantId]
  );

  return res.json({ batches: rows.map(serializeBatch), total: Number(total) });
});

async function loadBatch(executor, tenantId, batchId) {
  const [rows] = await executor.query(`${BATCH_LIST_SELECT} WHERE b.hospital_id = ? AND b.id = ?`, [
    tenantId,
    batchId,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรายการเปลี่ยนประเภทนี้');
  return rows[0];
}

/**
 * GET /api/v1/fabric-items/category-changes/:id — รายละเอียด batch + รายชิ้น (ก่อน/หลัง/ปัจจุบัน)
 */
export const getCategoryChange = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const batch = await loadBatch(pool, tenantId, req.params.id);

  const [items] = await pool.query(
    `SELECT i.id, i.fabric_item_id, i.epc_code, i.from_category_id, i.to_category_id,
            i.reverted_at, i.reverted_by_batch_id,
            fc.name AS from_category_name, fg.name AS from_group_name,
            tc.name AS to_category_name, tg.name AS to_group_name,
            f.fabric_category_id AS current_category_id, cc.name AS current_category_name
     FROM fabric_category_change_items i
     JOIN fabric_categories fc ON fc.id = i.from_category_id
     LEFT JOIN fabric_groups fg ON fg.id = fc.group_id
     JOIN fabric_categories tc ON tc.id = i.to_category_id
     LEFT JOIN fabric_groups tg ON tg.id = tc.group_id
     JOIN fabric_items f ON f.id = i.fabric_item_id
     JOIN fabric_categories cc ON cc.id = f.fabric_category_id
     WHERE i.batch_id = ?
     ORDER BY i.epc_code`,
    [batch.id]
  );

  return res.json({ batch: serializeBatch(batch), items });
});

// ชิ้นของ batch ที่ยังมีผลอยู่ แยกเป็นย้อนได้ (ประเภทปัจจุบันยังเป็นปลายทางของ batch) / conflict
async function classifyRevert(executor, batchId, { forUpdate = false } = {}) {
  const [items] = await executor.query(
    `SELECT i.id AS change_item_id, i.fabric_item_id, i.epc_code,
            i.from_category_id, i.to_category_id,
            f.fabric_category_id AS current_category_id,
            fc.name AS from_category_name, tc.name AS to_category_name,
            cc.name AS current_category_name
     FROM fabric_category_change_items i
     JOIN fabric_items f ON f.id = i.fabric_item_id
     JOIN fabric_categories fc ON fc.id = i.from_category_id
     JOIN fabric_categories tc ON tc.id = i.to_category_id
     JOIN fabric_categories cc ON cc.id = f.fabric_category_id
     WHERE i.batch_id = ? AND i.reverted_at IS NULL${forUpdate ? ' FOR UPDATE' : ''}`,
    [batchId]
  );

  const revertible = [];
  const conflicts = [];
  items.forEach((item) => {
    const row = {
      changeItemId: item.change_item_id,
      itemId: item.fabric_item_id,
      epcCode: item.epc_code,
      // ย้อนกลับ = เปลี่ยนจากประเภทปลายทางของ batch เดิม กลับเป็นประเภทก่อนหน้า
      fromCategoryId: item.to_category_id,
      fromCategoryName: item.to_category_name,
      toCategoryId: item.from_category_id,
      toCategoryName: item.from_category_name,
      currentCategoryName: item.current_category_name,
    };
    if (Number(item.current_category_id) === Number(item.to_category_id)) revertible.push(row);
    else conflicts.push(row);
  });
  return { revertible, conflicts };
}

/**
 * POST /api/v1/fabric-items/category-changes/:id/revert — ย้อนกลับทั้ง batch
 * confirm=false -> preview (revertible / conflicts), confirm=true -> ย้อนจริง + สร้าง batch REVERT
 */
export const revertCategoryChange = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  await assertHospitalEditable(req, tenantId);

  const { confirm, reason, source } = req.body;
  const batchId = Number(req.params.id);
  const original = await loadBatch(pool, tenantId, batchId);

  if (!confirm) {
    const groups = await classifyRevert(pool, batchId);
    return res.json({ preview: true, batch: serializeBatch(original), ...groups });
  }

  const conn = await pool.getConnection();
  let groups;
  let revertBatchId;
  try {
    await conn.beginTransaction();
    groups = await classifyRevert(conn, batchId, { forUpdate: true });
    if (groups.revertible.length === 0) {
      throw new AppError(
        400,
        'NOTHING_TO_REVERT',
        groups.conflicts.length > 0
          ? 'ผ้าทุกชิ้นถูกเปลี่ยนประเภทต่อไปแล้ว ย้อนกลับไม่ได้'
          : 'รายการนี้ถูกย้อนกลับครบแล้ว'
      );
    }

    const [batch] = await conn.query(
      `INSERT INTO fabric_category_change_batches
         (hospital_id, batch_type, mode, source, reason, item_count, reverts_batch_id, created_by)
       VALUES (?, 'REVERT', ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        groups.revertible.length === 1 ? 'SINGLE' : 'BULK',
        source,
        reason || null,
        groups.revertible.length,
        batchId,
        req.auth.userId,
      ]
    );
    revertBatchId = batch.insertId;

    await conn.query(
      `INSERT INTO fabric_category_change_items
         (batch_id, fabric_item_id, epc_code, from_category_id, to_category_id) VALUES ?`,
      [
        groups.revertible.map((r) => [
          revertBatchId,
          r.itemId,
          r.epcCode,
          r.fromCategoryId,
          r.toCategoryId,
        ]),
      ]
    );

    // คืนประเภทเดิมทีละประเภทปลายทาง (ผ้าใน batch เดียวอาจมาจากหลายประเภทเดิม)
    const idsByTarget = new Map();
    groups.revertible.forEach((r) => {
      if (!idsByTarget.has(r.toCategoryId)) idsByTarget.set(r.toCategoryId, []);
      idsByTarget.get(r.toCategoryId).push(r.itemId);
    });
    for (const [targetCategoryId, itemIds] of idsByTarget) {
      // eslint-disable-next-line no-await-in-loop
      await conn.query(
        'UPDATE fabric_items SET fabric_category_id = ? WHERE hospital_id = ? AND id IN (?)',
        [targetCategoryId, tenantId, itemIds]
      );
    }

    await conn.query(
      'UPDATE fabric_category_change_items SET reverted_by_batch_id = ?, reverted_at = NOW() WHERE id IN (?)',
      [revertBatchId, groups.revertible.map((r) => r.changeItemId)]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await logAudit({
    hospitalId: tenantId,
    userId: req.auth.userId,
    action: 'FABRIC_CATEGORY_REVERTED',
    entityType: 'fabric_category_change_batch',
    entityId: revertBatchId,
    metadata: {
      batchId: revertBatchId,
      revertsBatchId: batchId,
      source,
      reason: reason || null,
      count: groups.revertible.length,
      skippedConflicts: groups.conflicts.length,
      items: groups.revertible.map((r) => ({
        epcCode: r.epcCode,
        fromCategoryName: r.fromCategoryName,
        toCategoryName: r.toCategoryName,
      })),
    },
  });

  emitToHospital(tenantId, 'fabric:category-changed', {
    batchId: revertBatchId,
    count: groups.revertible.length,
  });

  return res.status(201).json({
    preview: false,
    batchId: revertBatchId,
    revertsBatchId: batchId,
    reverted: groups.revertible,
    conflicts: groups.conflicts,
  });
});
