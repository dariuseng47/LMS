import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId, assertTenantAccess } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// "ประเภทผ้า" = fabric_categories (เช่น ชุดผ่าตัด, ผ้าปูเตียง) สังกัดหมวดหมู่ผ้า (fabric_groups) 1 หมวด
// ผ้าแต่ละชิ้น/ล็อตผูกกับประเภทผ้านี้ (fabric_category_id)

// ตารางที่อ้างอิงประเภทผ้าอยู่ — ถ้ามีแถวใดผูกอยู่จะลบประเภทผ้านั้นไม่ได้
const CATEGORY_REFERENCING_TABLES = [
  { table: 'fabric_items', label: 'ผ้า' },
  { table: 'fabric_lots', label: 'ล็อต' },
  { table: 'cabinet_par_levels', label: 'ตั้งค่า par level ของตู้' },
  { table: 'registration_scan_sessions', label: 'รอบสแกนลงทะเบียน' },
];

/**
 * GET /api/v1/fabric-categories — แนบ group_name + จำนวนผ้า/ล็อตที่ผูกอยู่ (item_count, lot_count)
 * ให้หน้าลงทะเบียนผ้ารู้ว่าประเภทไหนลบได้
 */
export const listCategories = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const [categories] = await pool.query(
    `SELECT c.*, g.name AS group_name,
            (SELECT COUNT(*) FROM fabric_items i WHERE i.fabric_category_id = c.id) AS item_count,
            (SELECT COUNT(*) FROM fabric_lots l WHERE l.fabric_category_id = c.id) AS lot_count
     FROM fabric_categories c
     LEFT JOIN fabric_groups g ON g.id = c.group_id
     WHERE c.hospital_id = ?
     ORDER BY c.id`,
    [tenantId]
  );
  return res.json({ categories });
});

async function assertGroupInTenant(groupId, tenantId) {
  const [rows] = await pool.query(
    'SELECT id FROM fabric_groups WHERE id = ? AND hospital_id = ?',
    [groupId, tenantId]
  );
  if (!rows[0]) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่พบหมวดหมู่ผ้านี้ในโรงพยาบาลที่เลือก');
  }
}

/**
 * POST /api/v1/fabric-categories — admin ของโรงพยาบาล หรือ superadmin (ต้องระบุ hospitalId เอง)
 */
export const createCategory = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่สร้างประเภทผ้าได้');
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  const { name, description, maxWashCycles, groupId } = req.body;
  await assertGroupInTenant(groupId, tenantId);
  const result = await scopedQuery(pool, tenantId).insert('fabric_categories', {
    group_id: groupId,
    name,
    description: description || null,
    max_wash_cycles: maxWashCycles ?? null,
  });

  return res.status(201).json({
    id: result.insertId,
    groupId,
    name,
    description: description || null,
    maxWashCycles: maxWashCycles ?? null,
  });
});

/**
 * PATCH /api/v1/fabric-categories/:id — admin ของโรงพยาบาล หรือ superadmin (แก้ไขประเภทของ รพ. ใดก็ได้)
 */
export const updateCategory = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่แก้ไขประเภทผ้าได้');
  }

  const [rows] = await pool.query('SELECT * FROM fabric_categories WHERE id = ?', [req.params.id]);
  const category = rows[0];
  if (!category) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบประเภทผ้านี้');
  }
  await assertTenantAccess(req, category.hospital_id);
  const tenantId = category.hospital_id;

  const { name, description, maxWashCycles, groupId } = req.body;
  const updates = {};
  if (groupId !== undefined) {
    await assertGroupInTenant(groupId, tenantId);
    updates.group_id = groupId;
  }
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description || null;
  if (maxWashCycles !== undefined) updates.max_wash_cycles = maxWashCycles;

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  await scopedQuery(pool, tenantId).update('fabric_categories', { id: req.params.id }, updates);
  return res.status(204).send();
});

/**
 * DELETE /api/v1/fabric-categories/:id — ลบได้เฉพาะประเภทผ้าที่ไม่มีผ้า/ล็อต/par level ผูกอยู่
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่ลบประเภทผ้าได้');
  }

  const [rows] = await pool.query('SELECT * FROM fabric_categories WHERE id = ?', [req.params.id]);
  const category = rows[0];
  if (!category) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบประเภทผ้านี้');
  }
  await assertTenantAccess(req, category.hospital_id);

  for (const { table, label } of CATEGORY_REFERENCING_TABLES) {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM \`${table}\` WHERE fabric_category_id = ?`,
      [category.id]
    );
    if (total > 0) {
      throw new AppError(
        409,
        'CATEGORY_IN_USE',
        `ลบประเภทผ้า "${category.name}" ไม่ได้ เพราะยังมี${label}ผูกอยู่ ${total} รายการ`
      );
    }
  }

  await pool.query('DELETE FROM fabric_categories WHERE id = ? AND hospital_id = ?', [
    category.id,
    category.hospital_id,
  ]);
  return res.status(204).send();
});
