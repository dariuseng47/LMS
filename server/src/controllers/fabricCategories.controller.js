import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/fabric-categories
 */
export const listCategories = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const categories = await scopedQuery(pool, tenantId).select('fabric_categories');
  return res.json({ categories });
});

/**
 * POST /api/v1/fabric-categories — admin เท่านั้น (สร้างในโรงพยาบาลตัวเอง)
 * superadmin ไม่มี tenant context ของตัวเอง จึงสร้างหมวดหมู่ผ้าให้ รพ. ไหนโดยตรงไม่ได้
 */
export const createCategory = asyncHandler(async (req, res) => {
  if (req.auth.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลเท่านั้นที่สร้างหมวดหมู่ผ้าได้');
  }

  const { name, maxWashCycles } = req.body;
  const result = await scopedQuery(pool, req.auth.hospitalId).insert('fabric_categories', {
    name,
    max_wash_cycles: maxWashCycles ?? null,
  });

  return res.status(201).json({ id: result.insertId, name, maxWashCycles: maxWashCycles ?? null });
});

/**
 * PATCH /api/v1/fabric-categories/:id — admin เท่านั้น (แก้ไขหมวดหมู่ในโรงพยาบาลตัวเอง)
 */
export const updateCategory = asyncHandler(async (req, res) => {
  if (req.auth.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลเท่านั้นที่แก้ไขหมวดหมู่ผ้าได้');
  }

  const tenantId = req.auth.hospitalId;
  const existing = await scopedQuery(pool, tenantId).select('fabric_categories', {
    id: req.params.id,
  });
  if (!existing[0]) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบหมวดหมู่ผ้านี้');
  }

  const { name, maxWashCycles } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (maxWashCycles !== undefined) updates.max_wash_cycles = maxWashCycles;

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  await scopedQuery(pool, tenantId).update('fabric_categories', { id: req.params.id }, updates);
  return res.status(204).send();
});
