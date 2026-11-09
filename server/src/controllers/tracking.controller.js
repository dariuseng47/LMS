import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { getStuckItems } from '../utils/alerts.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// current_location_type เป็น polymorphic ref ('CABINET' | 'DEVICE' | 'CENTRAL_STOCK')
// ดู docs/data-model.md — resolve เป็นชื่ออ่านง่ายสำหรับหน้า Location Search บนมือถือ
async function resolveLocationName(locationType, locationId) {
  if (locationType === 'CABINET' && locationId) {
    const [rows] = await pool.query(
      `SELECT cabinets.name AS cabinet_name, departments.name AS department_name
       FROM cabinets
       JOIN departments ON departments.id = cabinets.department_id
       WHERE cabinets.id = ?`,
      [locationId]
    );
    if (rows[0]) {
      return `ตู้ ${rows[0].cabinet_name} — ${rows[0].department_name}`;
    }
    return null;
  }

  if (locationType === 'DEVICE' && locationId) {
    const [rows] = await pool.query('SELECT device_type FROM devices WHERE id = ?', [locationId]);
    return rows[0] ? `อุปกรณ์ ${rows[0].device_type}` : null;
  }

  if (locationType === 'CENTRAL_STOCK') {
    return 'คลังกลาง';
  }

  return null;
}

/**
 * GET /api/v1/tracking/location/:epc — ค้นหาตำแหน่งล่าสุดของผ้าจาก EPC (ทุก role)
 */
export const getLocationByEpc = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const items = await scopedQuery(pool, tenantId).select('fabric_items', {
    epc_code: req.params.epc,
  });
  const item = items[0];
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้ารหัสนี้');

  const locationName = await resolveLocationName(item.current_location_type, item.current_location_id);

  const lastScans = await scopedQuery(pool, tenantId).select('scan_logs', { fabric_item_id: item.id });
  lastScans.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at));

  return res.json({
    fabricItem: { id: item.id, epcCode: item.epc_code, status: item.status },
    location: {
      type: item.current_location_type,
      id: item.current_location_id,
      name: locationName,
    },
    lastScan: lastScans[0] ?? null,
  });
});

/**
 * POST /api/v1/tracking/lookup — ค้นสถานะ/ประเภท/ตำแหน่งของผ้าหลายชิ้นในครั้งเดียว (ทุก role)
 * ใช้กับหน้า "สแกนค้นหาผ้า" บน handheld ที่สแกนแบบ bulk — แท็กไหลเข้ามาเป็นร้อย ถ้ายิง
 * GET /location/:epc ทีละแท็กจะช้าและหน่วงเครื่อง เลย resolve ชื่อตำแหน่ง + สแกนล่าสุดใน query เดียว
 * คืน { items: [...], notFound: [epc] } (เฉพาะผ้าของโรงพยาบาลที่เลือกอยู่)
 */
export const lookupByEpcs = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const uniqueCodes = [...new Set(req.body.epcCodes.map((c) => c.trim()).filter(Boolean))];

  const [rows] = await pool.query(
    `SELECT f.id, f.epc_code, f.status, f.current_location_type,
            fc.name AS category_name,
            c.name AS cabinet_name, d.name AS department_name,
            dev.device_type,
            (SELECT sl.event_type FROM scan_logs sl
               WHERE sl.fabric_item_id = f.id AND sl.hospital_id = f.hospital_id
               ORDER BY sl.scanned_at DESC, sl.id DESC LIMIT 1) AS last_event_type,
            (SELECT MAX(sl.scanned_at) FROM scan_logs sl
               WHERE sl.fabric_item_id = f.id AND sl.hospital_id = f.hospital_id) AS last_scanned_at
     FROM fabric_items f
     LEFT JOIN fabric_categories fc ON fc.id = f.fabric_category_id
     LEFT JOIN cabinets c
       ON f.current_location_type = 'CABINET' AND c.id = f.current_location_id AND c.hospital_id = f.hospital_id
     LEFT JOIN departments d ON d.id = c.department_id
     LEFT JOIN devices dev
       ON f.current_location_type = 'DEVICE' AND dev.id = f.current_location_id AND dev.hospital_id = f.hospital_id
     WHERE f.hospital_id = ? AND f.epc_code IN (?)`,
    [tenantId, uniqueCodes]
  );

  const items = rows.map((row) => {
    let locationName = null;
    if (row.current_location_type === 'CABINET' && row.cabinet_name) {
      locationName = `ตู้ ${row.cabinet_name}${row.department_name ? ` — ${row.department_name}` : ''}`;
    } else if (row.current_location_type === 'DEVICE' && row.device_type) {
      locationName = `อุปกรณ์ ${row.device_type}`;
    } else if (row.current_location_type === 'CENTRAL_STOCK') {
      locationName = 'คลังกลาง';
    }
    return {
      id: row.id,
      epcCode: row.epc_code,
      status: row.status,
      categoryName: row.category_name,
      locationName,
      lastEventType: row.last_event_type,
      lastScannedAt: row.last_scanned_at,
    };
  });

  const found = new Set(items.map((i) => i.epcCode));
  const notFound = uniqueCodes.filter((code) => !found.has(code));

  return res.json({ items, notFound });
});

/**
 * GET /api/v1/tracking/process-status — ทุก role (Process Status Monitor, initial load)
 * ภาพรวมจำนวนผ้าต่อสถานะทั้งหมด + รายการผ้าที่ค้างสถานะเกินเวลาที่ตั้งไว้ใน status_timeout_settings
 * ("ค้างสถานะ" ประมาณจาก fabric_items.updated_at เพราะยังไม่มีคอลัมน์ status_changed_at แยก
 * — ตาม Advanced_Feature_Details&Rules.md หัวข้อ C. Sequence Exception & Timeout Monitoring)
 */
export const getProcessStatus = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const [statusCounts] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM fabric_items
     WHERE hospital_id = ? AND deleted_at IS NULL GROUP BY status`,
    [tenantId]
  );

  const stuckItems = await getStuckItems(tenantId);

  return res.json({ statusCounts, stuckItems });
});
