import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { resolveTenantId } from '../utils/tenant.js';

// แท็บ "ประวัติการลงทะเบียนผ้า" — 1 รอบ = กดยืนยันลงทะเบียน 1 ครั้ง (ดู services/fabricRegistration.js)

const BATCH_JOINS = `
  FROM fabric_registration_batches b
  LEFT JOIN devices d ON d.id = b.device_id
  LEFT JOIN fabric_categories c ON c.id = b.fabric_category_id
  LEFT JOIN fabric_groups g ON g.id = c.group_id
  LEFT JOIN fabric_lots l ON l.id = b.fabric_lot_id
  LEFT JOIN users u ON u.id = b.created_by
  LEFT JOIN registration_scan_sessions s ON s.id = b.session_id
  LEFT JOIN users cu ON cu.id = s.confirmed_by`;

const BATCH_COLUMNS = `
  b.id, b.created_at, b.source, b.item_count, b.skipped_count, b.session_id,
  b.device_id, d.device_type, d.ip_address, d.port, d.caretaker_name,
  b.fabric_category_id, COALESCE(c.name, b.category_name) AS category_name, g.name AS group_name,
  b.fabric_lot_id, l.lot_code, u.full_name AS created_by_name, cu.full_name AS confirmed_by_name`;

function toDevice(row) {
  if (!row.device_id) return null;
  return {
    id: row.device_id,
    deviceType: row.device_type,
    ipAddress: row.ip_address,
    port: row.port,
    caretakerName: row.caretaker_name,
  };
}

function toBatch(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    source: row.source,
    itemCount: Number(row.item_count),
    skippedCount: Number(row.skipped_count),
    device: toDevice(row),
    categoryId: row.fabric_category_id,
    categoryName: row.category_name,
    groupName: row.group_name,
    lotId: row.fabric_lot_id,
    lotCode: row.lot_code,
    createdByName: row.created_by_name,
    confirmedByName: row.confirmed_by_name,
  };
}

/**
 * GET /api/v1/fabric-items/registrations — รายการรอบลงทะเบียน (ใหม่สุดก่อน แบ่งหน้า) + สรุปยอดทั้งช่วงที่กรอง
 * ตัวกรอง: from/to (YYYY-MM-DD ครอบทั้งวัน), categoryId, deviceId, source
 */
export const listRegistrations = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { from, to, categoryId, deviceId, source, limit, offset } = req.query;

  const conditions = ['b.hospital_id = ?'];
  const values = [tenantId];
  // datetime ใน DB เก็บเวลาท้องถิ่น (pool ใช้ dateStrings) — เทียบเป็นสตริงทั้งวันแบบเดียวกับ listFabricItems
  if (from) {
    conditions.push('b.created_at >= ?');
    values.push(`${from} 00:00:00`);
  }
  if (to) {
    conditions.push('b.created_at <= ?');
    values.push(`${to} 23:59:59`);
  }
  if (categoryId) {
    conditions.push('b.fabric_category_id = ?');
    values.push(categoryId);
  }
  if (deviceId) {
    conditions.push('b.device_id = ?');
    values.push(deviceId);
  }
  if (source) {
    conditions.push('b.source = ?');
    values.push(source);
  }
  const where = conditions.join(' AND ');

  const [[rows], [[totals]], [categoryRows], [deviceRows]] = await Promise.all([
    pool.query(
      `SELECT ${BATCH_COLUMNS} ${BATCH_JOINS}
       WHERE ${where}
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) AS batch_count, COALESCE(SUM(b.item_count), 0) AS item_count,
              COALESCE(SUM(b.skipped_count), 0) AS skipped_count
       FROM fabric_registration_batches b WHERE ${where}`,
      values
    ),
    pool.query(
      `SELECT b.fabric_category_id, COALESCE(c.name, b.category_name) AS category_name,
              g.name AS group_name, COUNT(*) AS batch_count, SUM(b.item_count) AS item_count
       FROM fabric_registration_batches b
       LEFT JOIN fabric_categories c ON c.id = b.fabric_category_id
       LEFT JOIN fabric_groups g ON g.id = c.group_id
       WHERE ${where}
       GROUP BY b.fabric_category_id, COALESCE(c.name, b.category_name), g.name
       ORDER BY item_count DESC`,
      values
    ),
    pool.query(
      `SELECT b.source, b.device_id, d.device_type, d.ip_address, d.port, d.caretaker_name,
              COUNT(*) AS batch_count, SUM(b.item_count) AS item_count
       FROM fabric_registration_batches b
       LEFT JOIN devices d ON d.id = b.device_id
       WHERE ${where}
       GROUP BY b.source, b.device_id, d.device_type, d.ip_address, d.port, d.caretaker_name
       ORDER BY item_count DESC`,
      values
    ),
  ]);

  return res.json({
    batches: rows.map(toBatch),
    total: Number(totals.batch_count),
    summary: {
      batchCount: Number(totals.batch_count),
      itemCount: Number(totals.item_count),
      skippedCount: Number(totals.skipped_count),
      byCategory: categoryRows.map((row) => ({
        categoryId: row.fabric_category_id,
        categoryName: row.category_name,
        groupName: row.group_name,
        batchCount: Number(row.batch_count),
        itemCount: Number(row.item_count),
      })),
      byDevice: deviceRows.map((row) => ({
        source: row.source,
        device: toDevice(row),
        batchCount: Number(row.batch_count),
        itemCount: Number(row.item_count),
      })),
    },
  });
});

/**
 * GET /api/v1/fabric-items/registrations/:id — รอบเดียวพร้อมรายชิ้น (สถานะ/ประเภท "ตอนนี้" ของแต่ละชิ้น)
 * ชิ้นที่โอนย้ายไปโรงพยาบาลอื่นแล้วคืน transferred: true แทน ไม่เปิดเผยสถานะข้าม tenant
 */
export const getRegistration = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const [[row]] = await pool.query(
    `SELECT ${BATCH_COLUMNS} ${BATCH_JOINS} WHERE b.hospital_id = ? AND b.id = ?`,
    [tenantId, req.params.id]
  );
  if (!row) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรอบการลงทะเบียนนี้');

  const [items] = await pool.query(
    `SELECT i.epc_code, f.hospital_id, f.status, f.wash_count, c.name AS category_name
     FROM fabric_registration_items i
     JOIN fabric_items f ON f.id = i.fabric_item_id
     LEFT JOIN fabric_categories c ON c.id = f.fabric_category_id
     WHERE i.batch_id = ?
     ORDER BY i.id`,
    [row.id]
  );

  return res.json({
    batch: toBatch(row),
    items: items.map((item) => {
      const transferred = Number(item.hospital_id) !== Number(tenantId);
      return {
        epcCode: item.epc_code,
        transferred,
        status: transferred ? null : item.status,
        washCount: transferred ? null : item.wash_count,
        categoryName: transferred ? null : item.category_name,
      };
    }),
  });
});
