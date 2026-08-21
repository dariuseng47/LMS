import { pool } from '../db/pool.js';
import { getIO } from '../sockets/ioInstance.js';
import { AppError } from '../utils/AppError.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Operator-facing scan actions for nativeapp/ — ward dispatch/receive. Simplified vs. the
// full "1st scan (read cabinet) -> replenish -> 2nd scan (cart -> cabinet)" par-level
// replenishment flow in Advanced_Feature_Details&Rules.md: this pass is a direct
// EPC -> cabinet issue/receive (manual EPC entry stand-in for a real scanner, see
// nativeapp/src/components/ScannerInput.jsx). Cart-tracking/replenishment counting is
// a later iteration.

function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

async function findTenantScopedFabricItemByEpc(tenantId, epcCode) {
  const rows = await scopedQuery(pool, tenantId).select('fabric_items', { epc_code: epcCode });
  return rows[0];
}

/**
 * POST /api/v1/scans/ward-issue — จ่ายผ้าจากคลังกลางไปตู้ประจำวอร์ด (admin/operator)
 */
export const wardIssue = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้');
  }

  const tenantId = req.auth.hospitalId;
  const { epcCode, cabinetId } = req.body;

  const cabinets = await scopedQuery(pool, tenantId).select('cabinets', {
    id: cabinetId,
    deleted_at: null,
  });
  const cabinet = cabinets[0];
  if (!cabinet) throw new AppError(404, 'NOT_FOUND', 'ไม่พบตู้เก็บผ้านี้');

  const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้ารหัสนี้');
  if (item.status === 'HOLD' || item.status === 'DECOMMISSIONED') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้ถูกพัก/แทงชำรุดอยู่ จ่ายออกไม่ได้');
  }

  await scopedQuery(pool, tenantId).update(
    'fabric_items',
    { id: item.id },
    { status: 'WARD_CABINET', current_location_type: 'CABINET', current_location_id: cabinet.id }
  );

  await scopedQuery(pool, tenantId).insert('scan_logs', {
    fabric_item_id: item.id,
    device_id: null,
    user_id: req.auth.userId,
    event_type: 'WARD_ISSUE',
    is_step_skipped: false,
    synced_from_offline: false,
    scanned_at: new Date(),
  });

  emitToHospital(tenantId, 'scan:ward-issue', { fabricItemId: item.id, epcCode, cabinetId: cabinet.id });

  return res.status(201).json({
    fabricItemId: item.id,
    epcCode,
    status: 'WARD_CABINET',
    cabinetId: cabinet.id,
  });
});

/**
 * POST /api/v1/scans/ward-receive — รับผ้าใช้แล้วกลับจากวอร์ดเข้าสู่รอบซักถัดไป (admin/operator)
 */
export const wardReceive = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้');
  }

  const tenantId = req.auth.hospitalId;
  const { epcCode } = req.body;

  const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้ารหัสนี้');
  if (item.status !== 'WARD_CABINET' && item.status !== 'IN_USE_WARD') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้ไม่ได้อยู่ที่วอร์ด รับเข้าไม่ได้');
  }

  await scopedQuery(pool, tenantId).update(
    'fabric_items',
    { id: item.id },
    { status: 'WASH', current_location_type: 'CENTRAL_STOCK', current_location_id: null }
  );

  await scopedQuery(pool, tenantId).insert('scan_logs', {
    fabric_item_id: item.id,
    device_id: null,
    user_id: req.auth.userId,
    event_type: 'WARD_RECEIVE',
    is_step_skipped: false,
    synced_from_offline: false,
    scanned_at: new Date(),
  });

  emitToHospital(tenantId, 'scan:ward-receive', { fabricItemId: item.id, epcCode });

  return res.json({ fabricItemId: item.id, epcCode, status: 'WASH' });
});
