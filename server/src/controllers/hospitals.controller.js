import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// HQ Super Admin ยังไม่มีหน้า "จัดการ organizations" แยก (เป็น grouping เฉยๆ ตาม docs/data-model.md)
// จึงสร้าง default organization ให้อัตโนมัติแบบ idempotent เวลามีการสร้าง hospital ครั้งแรก
async function ensureDefaultOrganizationId() {
  const [rows] = await pool.query(
    "SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1"
  );
  if (rows[0]) return rows[0].id;

  const [result] = await pool.query('INSERT INTO organizations (name) VALUES (?)', [
    'Default Organization',
  ]);
  return result.insertId;
}

/**
 * GET /api/v1/hospitals — superadmin เท่านั้น
 */
export const listHospitals = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT h.id, h.name, h.quota_config, h.created_at,
            o.name AS organization_name
     FROM hospitals h
     JOIN organizations o ON o.id = h.organization_id
     WHERE h.deleted_at IS NULL
     ORDER BY h.created_at DESC`
  );
  return res.json({ hospitals: rows });
});

/**
 * POST /api/v1/hospitals — superadmin เท่านั้น (สร้าง tenant ใหม่)
 */
export const createHospital = asyncHandler(async (req, res) => {
  const { name, region } = req.body;

  const organizationId = await ensureDefaultOrganizationId();

  if (region) {
    await pool.query('UPDATE organizations SET region = ? WHERE id = ? AND region IS NULL', [
      region,
      organizationId,
    ]);
  }

  const [result] = await pool.query(
    'INSERT INTO hospitals (organization_id, name) VALUES (?, ?)',
    [organizationId, name]
  );

  return res.status(201).json({ id: result.insertId, name, organizationId });
});

/**
 * PATCH /api/v1/hospitals/:id — superadmin เท่านั้น
 */
export const updateHospital = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, quotaConfig } = req.body;

  const updates = [];
  const values = [];
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (quotaConfig !== undefined) {
    updates.push('quota_config = ?');
    values.push(JSON.stringify(quotaConfig));
  }

  if (updates.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  const [result] = await pool.query(
    `UPDATE hospitals SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    [...values, id]
  );

  if (result.affectedRows === 0) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบโรงพยาบาลนี้');
  }

  return res.status(204).send();
});

/**
 * GET /api/v1/hospitals/:id/dashboard-summary — superadmin (ทุก id) / admin (เฉพาะ tenant ตัวเอง)
 */
export const getDashboardSummary = asyncHandler(async (req, res) => {
  const hospitalId = Number(req.params.id);

  if (req.auth.role === 'ADMIN' && req.auth.hospitalId !== hospitalId) {
    throw new AppError(403, 'FORBIDDEN', 'เข้าถึงข้อมูลข้าม tenant ไม่ได้');
  }
  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงหน้านี้');
  }

  // audit ทุกครั้งที่ superadmin เข้าดูข้าม tenant — ดู docs/multi-tenant-isolation.md ชั้นที่ 5
  if (req.auth.role === 'SUPERADMIN') {
    await pool.query(
      'INSERT INTO audit_logs (hospital_id, user_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [
        hospitalId,
        req.auth.userId,
        'CROSS_TENANT_READ',
        'hospital_dashboard_summary',
        hospitalId,
        JSON.stringify({ hospitalId }),
      ]
    );
  }

  const [[fabricByStatus], [devicesByStatus], [todayScans], [stepSkipped]] = await Promise.all([
    pool.query(
      `SELECT status, COUNT(*) AS count FROM fabric_items
       WHERE hospital_id = ? AND deleted_at IS NULL GROUP BY status`,
      [hospitalId]
    ),
    pool.query(
      `SELECT status, COUNT(*) AS count FROM devices WHERE hospital_id = ? GROUP BY status`,
      [hospitalId]
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM scan_logs
       WHERE hospital_id = ? AND scanned_at >= CURDATE()`,
      [hospitalId]
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM scan_logs
       WHERE hospital_id = ? AND is_step_skipped = TRUE AND scanned_at >= (NOW() - INTERVAL 7 DAY)`,
      [hospitalId]
    ),
  ]);

  return res.json({
    fabricByStatus,
    devicesByStatus,
    todayScanCount: todayScans[0]?.count ?? 0,
    stepSkippedLast7Days: stepSkipped[0]?.count ?? 0,
  });
});
