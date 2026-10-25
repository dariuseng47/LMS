import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId, assertTenantAccess } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// "หมวดหมู่ผ้า" = fabric_groups (เช่น ผ้าเสตอไลส์, ผ้าสามัญ) — ชั้นบนสุด ประเภทผ้า (fabric_categories)
// สังกัดอยู่ใต้หมวดหมู่นี้ ดู controllers/fabricCategories.controller.js

function assertAdmin(req, action) {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', `ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่${action}หมวดหมู่ผ้าได้`);
  }
}

function isDuplicateNameError(error) {
  return error?.code === 'ER_DUP_ENTRY';
}

/**
 * GET /api/v1/fabric-groups — แนบจำนวนประเภทผ้าที่อยู่ในหมวดหมู่ (category_count)
 */
export const listGroups = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const [groups] = await pool.query(
    `SELECT g.*,
            (SELECT COUNT(*) FROM fabric_categories c WHERE c.group_id = g.id) AS category_count
     FROM fabric_groups g
     WHERE g.hospital_id = ?
     ORDER BY g.id`,
    [tenantId]
  );
  return res.json({ groups });
});

/**
 * POST /api/v1/fabric-groups — admin ของโรงพยาบาล หรือ superadmin (ต้องระบุ hospitalId เอง)
 */
export const createGroup = asyncHandler(async (req, res) => {
  assertAdmin(req, 'สร้าง');

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  const { name, description } = req.body;
  try {
    const result = await scopedQuery(pool, tenantId).insert('fabric_groups', {
      name,
      description: description || null,
    });
    return res.status(201).json({ id: result.insertId, name, description: description || null });
  } catch (error) {
    if (isDuplicateNameError(error)) {
      throw new AppError(409, 'DUPLICATE', `มีหมวดหมู่ผ้าชื่อ "${name}" อยู่แล้ว`);
    }
    throw error;
  }
});

/**
 * PATCH /api/v1/fabric-groups/:id
 */
export const updateGroup = asyncHandler(async (req, res) => {
  assertAdmin(req, 'แก้ไข');

  const [rows] = await pool.query('SELECT * FROM fabric_groups WHERE id = ?', [req.params.id]);
  const group = rows[0];
  if (!group) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบหมวดหมู่ผ้านี้');
  }
  await assertTenantAccess(req, group.hospital_id);

  const { name, description } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description || null;

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  try {
    await scopedQuery(pool, group.hospital_id).update('fabric_groups', { id: group.id }, updates);
  } catch (error) {
    if (isDuplicateNameError(error)) {
      throw new AppError(409, 'DUPLICATE', `มีหมวดหมู่ผ้าชื่อ "${name}" อยู่แล้ว`);
    }
    throw error;
  }
  return res.status(204).send();
});

/**
 * DELETE /api/v1/fabric-groups/:id — ลบได้เฉพาะหมวดหมู่ที่ไม่มีผ้าผูกอยู่เลย และไม่เหลือประเภทผ้าข้างใน
 * (ประเภทผ้าที่ไม่มีผ้าผูกต้องลบทีละประเภทก่อน กันเผลอลบทีเดียวหายหมด)
 */
export const deleteGroup = asyncHandler(async (req, res) => {
  assertAdmin(req, 'ลบ');

  const [rows] = await pool.query('SELECT * FROM fabric_groups WHERE id = ?', [req.params.id]);
  const group = rows[0];
  if (!group) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบหมวดหมู่ผ้านี้');
  }
  await assertTenantAccess(req, group.hospital_id);

  const [[{ itemCount }]] = await pool.query(
    `SELECT COUNT(*) AS itemCount
     FROM fabric_items i
     JOIN fabric_categories c ON c.id = i.fabric_category_id
     WHERE c.group_id = ?`,
    [group.id]
  );
  if (itemCount > 0) {
    throw new AppError(
      409,
      'GROUP_IN_USE',
      `ลบหมวดหมู่ผ้า "${group.name}" ไม่ได้ เพราะยังมีผ้าผูกอยู่ ${itemCount} ชิ้น`
    );
  }

  const [[{ categoryCount }]] = await pool.query(
    'SELECT COUNT(*) AS categoryCount FROM fabric_categories WHERE group_id = ?',
    [group.id]
  );
  if (categoryCount > 0) {
    throw new AppError(
      409,
      'GROUP_IN_USE',
      `ลบหมวดหมู่ผ้า "${group.name}" ไม่ได้ เพราะยังมีประเภทผ้า ${categoryCount} ประเภทอยู่ข้างใน — ลบประเภทผ้าเหล่านั้นก่อน`
    );
  }

  await pool.query('DELETE FROM fabric_groups WHERE id = ? AND hospital_id = ?', [
    group.id,
    group.hospital_id,
  ]);
  return res.status(204).send();
});
