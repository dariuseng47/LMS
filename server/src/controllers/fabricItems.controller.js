import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { getIO } from '../sockets/ioInstance.js';
import { resolveTenantId, assertTenantAccess } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { hasAnyPermission, permKeysForLegacy } from '../utils/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// ยิง event ให้ dashboard ที่เปิดหน้า "รายการพัก & ชำรุด" ค้างอยู่เห็นรายการใหม่ทันทีไม่ต้องรีเฟรช
// (ห้อง hospital:<id> เดียวกับที่ scans.controller.js/scanSessions.controller.js ใช้)
function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

/**
 * GET /api/v1/fabric-items — list + filter (status, category, lot, epc แบบ exact match)
 * JOIN users เอาชื่อคนแอด (created_by_name) มาด้วยเลย — scopedQuery generic select ไม่รองรับ
 * join จึงเขียน SQL ตรงเอง (เหมือน fabricLots.controller.js#listLots) แต่ยังบังคับ
 * hospital_id = ? เองด้วยมือแทนเพื่อ tenant-scope เหมือนเดิม
 *
 * ตัวกรองเพิ่ม: search (EPC มีคำนี้อยู่ส่วนไหนก็ได้), createdFrom/createdTo, updatedFrom/updatedTo
 * (YYYY-MM-DD ครอบทั้งวัน), orderBy (created_at | updated_at, ใหม่สุดก่อนเสมอ)
 *
 * แบ่งหน้า: ส่ง limit (+offset) มา -> คืน { fabricItems, total } เฉพาะหน้านั้น (dashboard คลังผ้า)
 * ไม่ส่ง limit -> คืนทุกแถวเหมือนเดิม (แอปมือถือ / export รายงาน / เมนูเปลี่ยนประเภทที่ต้องเลือกทั้งหมดตามตัวกรอง)
 */
export const listFabricItems = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const {
    status,
    categoryId,
    lotId,
    epcCode,
    search,
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo,
    orderBy = 'created_at',
    limit,
    offset = 0,
  } = req.query;

  const conditions = ['f.hospital_id = ?'];
  const values = [tenantId];
  if (status) {
    conditions.push('f.status = ?');
    values.push(status);
  }
  if (categoryId) {
    conditions.push('f.fabric_category_id = ?');
    values.push(categoryId);
  }
  if (lotId) {
    conditions.push('f.fabric_lot_id = ?');
    values.push(lotId);
  }
  if (epcCode) {
    conditions.push('f.epc_code = ?');
    values.push(epcCode);
  }
  if (search) {
    // escape % _ \\ ที่ผู้ใช้พิมพ์มา ให้ค้นแบบตัวอักษรตรงๆ ไม่ใช่ wildcard
    conditions.push('f.epc_code LIKE ?');
    values.push(`%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
  }
  // datetime ใน DB เก็บเวลาท้องถิ่น (pool ใช้ dateStrings) — เทียบเป็นสตริงทั้งวันแบบเดียวกับ
  // washReceiveReport.controller.js#fetchBatches
  if (createdFrom) {
    conditions.push('f.created_at >= ?');
    values.push(`${createdFrom} 00:00:00`);
  }
  if (createdTo) {
    conditions.push('f.created_at <= ?');
    values.push(`${createdTo} 23:59:59`);
  }
  if (updatedFrom) {
    conditions.push('f.updated_at >= ?');
    values.push(`${updatedFrom} 00:00:00`);
  }
  if (updatedTo) {
    conditions.push('f.updated_at <= ?');
    values.push(`${updatedTo} 23:59:59`);
  }

  const where = conditions.join(' AND ');
  // orderBy ผ่าน zod enum มาแล้ว (created_at | updated_at) จึงต่อเข้า SQL ได้ตรงๆ — id DESC กันลำดับ
  // สลับไปมาระหว่างหน้าเมื่อหลายแถวมีเวลาเท่ากัน (ลงทะเบียนเป็นก้อนในวินาทีเดียวกัน)
  const orderSql = `ORDER BY f.${orderBy === 'updated_at' ? 'updated_at' : 'created_at'} DESC, f.id DESC`;
  const paged = limit !== undefined;

  // LEFT JOIN cabinets/departments เอาชื่อแผนกมาด้วย — ใช้ตอนสถานะเป็น WARD_CABINET
  // (current_location_type='CABINET' เท่านั้นที่ current_location_id ชี้ไปที่ cabinets.id จริง
  // ดู resolveLocationName ใน tracking.controller.js ที่ทำ join แบบเดียวกัน)
  const [fabricItems] = await pool.query(
    `SELECT f.*, u.full_name AS created_by_name, d.name AS department_name
     FROM fabric_items f
     LEFT JOIN users u ON u.id = f.created_by
     LEFT JOIN cabinets c ON c.id = f.current_location_id AND f.current_location_type = 'CABINET'
     LEFT JOIN departments d ON d.id = c.department_id
     WHERE ${where}
     ${orderSql}${paged ? ' LIMIT ? OFFSET ?' : ''}`,
    paged ? [...values, limit, offset] : values
  );

  if (!paged) return res.json({ fabricItems });

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM fabric_items f WHERE ${where}`, values);
  return res.json({ fabricItems, total: Number(total) });
});

/**
 * POST /api/v1/fabric-items — admin ของโรงพยาบาล หรือ superadmin (มองข้าม tenant ได้ ต้องระบุ
 * hospitalId มาเองเสมอ ตามแพทเทิร์น resolveTenantId ดู docs/multi-tenant-isolation.md ชั้นที่ 1)
 * ผ้าใหม่เริ่มที่สถานะ CENTRAL_STOCK เสมอ (สต๊อกกลาง พร้อมแจก ยังไม่เคยผ่านการสแกนจริง)
 */
export const createFabricItem = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่ลงทะเบียนผ้าใหม่ได้');
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  const { epcCode, fabricLotId, photoUrl } = req.body;
  let { fabricCategoryId } = req.body;

  // ถ้าผูกล็อต ดึงประเภทจากล็อตให้อัตโนมัติ (ไม่ต้องกรอกซ้ำ) — ล็อตต้องตั้งประเภทไว้แล้ว
  if (fabricLotId) {
    const lots = await scopedQuery(pool, tenantId).select('fabric_lots', {
      id: fabricLotId,
    });
    const lot = lots[0];
    if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้านี้');
    fabricCategoryId = fabricCategoryId ?? lot.fabric_category_id;
    if (!fabricCategoryId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ล็อตนี้ยังไม่ได้ระบุประเภทผ้า กรุณาระบุ fabricCategoryId เอง');
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

  const result = await scopedQuery(pool, tenantId).insert('fabric_items', {
    epc_code: epcCode,
    fabric_category_id: fabricCategoryId,
    fabric_lot_id: fabricLotId ?? null,
    status: 'CENTRAL_STOCK',
    current_location_type: 'CENTRAL_STOCK',
    current_location_id: null,
    wash_count: 0,
    photo_url: photoUrl ?? null,
    created_by: req.auth.userId,
  });

  return res.status(201).json({ id: result.insertId, epcCode, status: 'CENTRAL_STOCK' });
});

/**
 * POST /api/v1/fabric-items/bulk — admin ของโรงพยาบาล หรือ superadmin (มองข้าม tenant ได้ ต้องระบุ
 * hospitalId มาเองเสมอ เหมือน createFabricItem ด้านบน) ลงทะเบียนผ้าหลายชิ้นพร้อมกัน เช่น รับผ้าล็อตใหม่
 * ทีละหลัก 100 ชิ้น ทุกชิ้นในคำขอเดียวแชร์ประเภท/ล็อตเดียวกัน ต่างกันแค่ epcCode รายชิ้น
 * EPC ที่ซ้ำกับที่มีอยู่แล้ว (หรือซ้ำกันเองในชุดที่ส่งมา) จะถูกข้าม ไม่ error ทั้งชุด
 */
export const bulkCreateFabricItems = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่ลงทะเบียนผ้าใหม่ได้');
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  const { epcCodes, fabricLotId, photoUrl } = req.body;
  let { fabricCategoryId } = req.body;

  if (fabricLotId) {
    const lots = await scopedQuery(pool, tenantId).select('fabric_lots', {
      id: fabricLotId,
    });
    const lot = lots[0];
    if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้านี้');
    fabricCategoryId = fabricCategoryId ?? lot.fabric_category_id;
    if (!fabricCategoryId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ล็อตนี้ยังไม่ได้ระบุประเภทผ้า กรุณาระบุ fabricCategoryId เอง');
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

    await scopedQuery(pool, tenantId).insert('fabric_items', {
      epc_code: epcCode,
      fabric_category_id: fabricCategoryId,
      fabric_lot_id: fabricLotId ?? null,
      status: 'CENTRAL_STOCK',
      current_location_type: 'CENTRAL_STOCK',
      current_location_id: null,
      wash_count: 0,
      photo_url: photoUrl ?? null,
      created_by: req.auth.userId,
    });
    created.push(epcCode);
  }

  return res.status(201).json({ created, skipped });
});

/**
 * POST /api/v1/fabric-items/check-epcs — เช็คว่า EPC ไหนมีในระบบแล้วบ้าง (ใช้ตอนสแกน/วางรหัสก่อนลงทะเบียน)
 * epc_code unique ระดับ global จึงเช็คข้ามทุกโรงพยาบาล — แต่ชื่อประเภทผ้าบอกเฉพาะรายการของโรงพยาบาลตัวเอง
 * (ของโรงพยาบาลอื่นคืน otherHospital: true แทน ไม่เปิดเผยข้อมูลข้าม tenant)
 */
export const checkEpcs = asyncHandler(async (req, res) => {
  const tenantId = req.auth.role === 'SUPERADMIN' ? req.body.hospitalId : req.auth.hospitalId;

  const uniqueCodes = [...new Set(req.body.epcCodes)];
  const [rows] = await pool.query(
    `SELECT f.epc_code, f.hospital_id, fc.name AS category_name
     FROM fabric_items f
     LEFT JOIN fabric_categories fc ON fc.id = f.fabric_category_id
     WHERE f.epc_code IN (?)`,
    [uniqueCodes]
  );

  const duplicates = rows.map((row) => {
    const own = tenantId && Number(row.hospital_id) === Number(tenantId);
    return {
      epcCode: row.epc_code,
      categoryName: own ? row.category_name : null,
      otherHospital: !own,
    };
  });

  return res.json({ duplicates });
});

/**
 * GET /api/v1/fabric-items/overview — ภาพรวมผ้าทั้งโรงพยาบาลสำหรับ "มินิ dashboard" ในแอป handheld
 *   - totals       : ผ้าทั้งหมด / ยังใช้งาน (ไม่นับแทงชำรุด) / แทงชำรุด / จำนวนประเภท / Max รวม
 *   - statusCounts : { STATUS: จำนวน } ทุกสถานะ (ไม่นับผ้าที่ถูกลบ)
 *   - categories   : ทุกประเภทผ้า + หมวดหมู่ + จำนวนแยกสถานะ + maxQty
 * maxQty = ผลรวม par level (cabinet_par_levels.par_level_qty) ของประเภทนั้นทุกตู้ที่ยังไม่ถูกลบ
 * = จำนวนผ้าสูงสุดที่ตั้งไว้ให้ตู้แผนกถือ (null = ยังไม่ได้ตั้ง par ให้ประเภทนี้)
 */
export const getFabricOverview = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const [[categoryRows], [countRows], [parRows]] = await Promise.all([
    pool.query(
      `SELECT c.id, c.name, c.group_id, g.name AS group_name
       FROM fabric_categories c
       LEFT JOIN fabric_groups g ON g.id = c.group_id
       WHERE c.hospital_id = ?
       ORDER BY g.name IS NULL, g.name, c.name`,
      [tenantId]
    ),
    pool.query(
      `SELECT fabric_category_id, status, COUNT(*) AS count
       FROM fabric_items
       WHERE hospital_id = ? AND deleted_at IS NULL
       GROUP BY fabric_category_id, status`,
      [tenantId]
    ),
    pool.query(
      `SELECT p.fabric_category_id, SUM(p.par_level_qty) AS max_qty,
              COUNT(DISTINCT p.cabinet_id) AS cabinet_count
       FROM cabinet_par_levels p
       JOIN cabinets cb ON cb.id = p.cabinet_id AND cb.deleted_at IS NULL
       WHERE cb.hospital_id = ?
       GROUP BY p.fabric_category_id`,
      [tenantId]
    ),
  ]);

  const parByCategory = new Map(
    parRows.map((r) => [
      Number(r.fabric_category_id),
      { maxQty: Number(r.max_qty), cabinetCount: Number(r.cabinet_count) },
    ])
  );

  const categories = categoryRows.map((c) => ({
    id: Number(c.id),
    name: c.name,
    groupId: c.group_id === null ? null : Number(c.group_id),
    groupName: c.group_name,
    total: 0,
    active: 0,
    maxQty: parByCategory.get(Number(c.id))?.maxQty ?? null,
    cabinetCount: parByCategory.get(Number(c.id))?.cabinetCount ?? 0,
    statusCounts: {},
  }));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const statusCounts = {};
  let all = 0;
  let decommissioned = 0;
  countRows.forEach((row) => {
    const n = Number(row.count);
    all += n;
    if (row.status === 'DECOMMISSIONED') decommissioned += n;
    statusCounts[row.status] = (statusCounts[row.status] || 0) + n;

    const category = byId.get(Number(row.fabric_category_id));
    if (!category) return;
    category.total += n;
    if (row.status !== 'DECOMMISSIONED') category.active += n;
    category.statusCounts[row.status] = (category.statusCounts[row.status] || 0) + n;
  });

  const maxQty = categories.reduce((sum, c) => sum + (c.maxQty ?? 0), 0);
  const groupCount = new Set(categories.map((c) => c.groupId ?? 'none')).size;

  return res.json({
    generatedAt: new Date().toISOString(),
    totals: {
      all,
      active: all - decommissioned,
      decommissioned,
      categoryCount: categories.length,
      groupCount,
      maxQty,
    },
    statusCounts,
    categories,
  });
});

/**
 * GET /api/v1/fabric-items/:epc — รายละเอียด + ประวัติสแกนทั้งหมด (ใช้แทน wash-history ด้วยในตัว)
 */
export const getFabricItemDetail = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const [items] = await pool.query(
    `SELECT f.*, u.full_name AS created_by_name, fc.name AS category_name
     FROM fabric_items f
     LEFT JOIN users u ON u.id = f.created_by
     LEFT JOIN fabric_categories fc ON fc.id = f.fabric_category_id
     WHERE f.hospital_id = ? AND f.epc_code = ?
     LIMIT 1`,
    [tenantId, req.params.epc]
  );
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

// หา fabric_item แบบไม่ผูก tenant — ใช้หา hospital_id เจ้าของจริงตอน superadmin ดำเนินการ
async function findItemAnyTenant(id) {
  const [rows] = await pool.query('SELECT * FROM fabric_items WHERE id = ?', [id]);
  return rows[0];
}

/**
 * POST /api/v1/fabric-items/:id/hold — admin + operator (default เปิด เพราะเกิดหน้างานบ่อย)
 */
export const holdFabricItem = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    const allowed = await hasAnyPermission(
      req.auth.userId,
      'OPERATOR',
      permKeysForLegacy('fabric.item.hold')
    );
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์พักผ้า กรุณาติดต่อ admin ให้เปิดสิทธิ์');
    }
  }

  const item = await findItemAnyTenant(req.params.id);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้าชิ้นนี้');
  await assertTenantAccess(req, item.hospital_id);
  const tenantId = item.hospital_id;
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
  if (req.auth.role === 'OPERATOR') {
    const allowed = await hasAnyPermission(
      req.auth.userId,
      'OPERATOR',
      permKeysForLegacy('fabric.item.hold')
    );
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์แทงชำรุดผ้า กรุณาติดต่อ admin ให้เปิดสิทธิ์');
    }
  }

  const item = await findItemAnyTenant(req.params.id);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้าชิ้นนี้');
  await assertTenantAccess(req, item.hospital_id);
  const tenantId = item.hospital_id;
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
