import { pool } from '../db/pool.js';
import { resolveTenantId } from '../utils/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/wash-analytics — ทุก role
 * สรุปรอบซักตาม Advanced_Feature_Details&Rules.md หัวข้อ D. Master Fabric & Asset Management
 * เทียบ fabric_items.wash_count กับ fabric_categories.max_wash_cycles (Max Allowed Wash Cycles)
 * หมวดหมู่ที่ไม่ได้ตั้ง max_wash_cycles จะไม่มีเกณฑ์เตือน (near/over เป็น NULL)
 */
export const getWashAnalytics = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);

  const [categorySummary] = await pool.query(
    `SELECT fc.id AS category_id, fc.name AS category_name, fc.max_wash_cycles,
            COUNT(fi.id) AS item_count,
            ROUND(AVG(fi.wash_count), 1) AS avg_wash_count,
            SUM(CASE WHEN fc.max_wash_cycles IS NOT NULL AND fi.wash_count >= fc.max_wash_cycles
                     THEN 1 ELSE 0 END) AS over_threshold_count,
            SUM(CASE WHEN fc.max_wash_cycles IS NOT NULL
                     AND fi.wash_count >= fc.max_wash_cycles * 0.8 AND fi.wash_count < fc.max_wash_cycles
                     THEN 1 ELSE 0 END) AS near_threshold_count
     FROM fabric_categories fc
     LEFT JOIN fabric_items fi
       ON fi.fabric_category_id = fc.id AND fi.hospital_id = fc.hospital_id AND fi.deleted_at IS NULL
     WHERE fc.hospital_id = ?
     GROUP BY fc.id, fc.name, fc.max_wash_cycles
     ORDER BY fc.name`,
    [tenantId]
  );

  const [topWornItems] = await pool.query(
    `SELECT fi.id, fi.epc_code, fc.name AS category_name, fi.wash_count, fc.max_wash_cycles,
            ROUND(fi.wash_count / fc.max_wash_cycles * 100, 0) AS pct_of_max
     FROM fabric_items fi
     JOIN fabric_categories fc ON fc.id = fi.fabric_category_id
     WHERE fi.hospital_id = ? AND fi.deleted_at IS NULL
       AND fc.max_wash_cycles IS NOT NULL AND fc.max_wash_cycles > 0
     ORDER BY pct_of_max DESC
     LIMIT 10`,
    [tenantId]
  );

  return res.json({ categorySummary, topWornItems });
});
