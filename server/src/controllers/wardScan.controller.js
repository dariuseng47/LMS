import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertTenantWritable, resolveWritableTenantId } from '../utils/tenant.js';
import { emitToHospital } from './scans.controller.js';

// "สแกนรับ-ส่งผ้า" บนเว็บ (หน้า รับ-ส่งผ้าประจำวอร์ด) — สแกนผ้าทั้งกองผ่านเครื่องอ่าน RFID แล้วยืนยันทีเดียว
// กติกาเดียวกับ ward-issue / ward-receive ทีละชิ้นใน scans.controller.js แต่ทำทั้งชุดด้วย query แบบก้อน
// ใน transaction เดียว (สแกนรถเข็นทีละหลายสิบ-หลายร้อยชิ้น ถ้ายิงทีละชิ้นจะช้าและค้างครึ่งทางได้)
//
// ชิ้นที่ทำไม่ได้ไม่ทำให้ทั้งชุดล้ม — คืนใน skipped พร้อมเหตุผลให้หน้าจอแจ้ง

// จ่ายออกไม่ได้ — ตรงกับเงื่อนไขใน scans.controller.js#wardIssue
const ISSUE_BLOCKED_STATUSES = new Set(['HOLD', 'DECOMMISSIONED', 'PENDING_DECOMMISSION', 'REWASH']);
// รับคืนได้เฉพาะผ้าที่อยู่ที่วอร์ด — ตรงกับ scans.controller.js#wardReceive
const RECEIVE_SOURCE_STATUSES = new Set(['WARD_CABINET', 'IN_USE_WARD']);

async function loadItemsByEpc(tenantId, epcCodes) {
  const [rows] = await pool.query(
    `SELECT id, epc_code, status, fabric_category_id, current_location_type, current_location_id
     FROM fabric_items
     WHERE hospital_id = ? AND epc_code IN (?)`,
    [tenantId, epcCodes]
  );
  return new Map(rows.map((row) => [row.epc_code, row]));
}

const uniqueCodes = (codes) => [...new Set(codes.map((code) => code.trim()).filter(Boolean))];

// อัปเดตสถานะ/ตำแหน่ง + บันทึก scan_logs ทั้งชุดใน transaction เดียว
async function applyBatch({ tenantId, itemIds, setSql, setParams, logRows }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE fabric_items SET ${setSql} WHERE hospital_id = ? AND id IN (?)`, [
      ...setParams,
      tenantId,
      itemIds,
    ]);
    await conn.query(
      `INSERT INTO scan_logs (hospital_id, fabric_item_id, device_id, user_id, event_type,
                              is_step_skipped, synced_from_offline, metadata, scanned_at)
       VALUES ?`,
      [logRows]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * POST /api/v1/scans/ward-issue-batch — จ่ายผ้าทั้งชุดเข้าตู้ประจำวอร์ด
 * body: { cabinetId, epcCodes[] } — โรงพยาบาลมาจากตู้ (ไม่ต้องส่ง hospitalId)
 *
 * skipped.reason:
 *   NOT_FOUND          — ไม่พบผ้ารหัสนี้ในโรงพยาบาลของตู้
 *   INVALID_STATE      — พัก/แทงชำรุด/รออนุมัติแทงชำรุด/รอส่งซักใหม่ (จ่ายออกไม่ได้)
 *   ALREADY_IN_CABINET — อยู่ในตู้นี้แล้ว (สแกนติดผ้าที่อยู่ในตู้) ไม่บันทึกซ้ำ กันยอดเติมเพี้ยน
 * ผ้าที่อยู่ตู้อื่น = โอนข้ามตู้ (metadata.isTransfer) เหมือน ward-issue ทีละชิ้น
 */
export const wardIssueBatch = asyncHandler(async (req, res) => {
  const { cabinetId } = req.body;
  const epcCodes = uniqueCodes(req.body.epcCodes);

  const [cabinetRows] = await pool.query(
    'SELECT id, hospital_id, name FROM cabinets WHERE id = ? AND deleted_at IS NULL',
    [cabinetId]
  );
  const cabinet = cabinetRows[0];
  if (!cabinet) throw new AppError(404, 'NOT_FOUND', 'ไม่พบตู้เก็บผ้านี้');
  await assertTenantWritable(req, cabinet.hospital_id);
  const tenantId = cabinet.hospital_id;
  const targetId = Number(cabinet.id);

  const itemByEpc = await loadItemsByEpc(tenantId, epcCodes);
  const toIssue = [];
  const skipped = [];
  for (const epcCode of epcCodes) {
    const item = itemByEpc.get(epcCode);
    const inCabinet = item?.current_location_type === 'CABINET';
    if (!item) skipped.push({ epcCode, reason: 'NOT_FOUND' });
    else if (ISSUE_BLOCKED_STATUSES.has(item.status)) {
      skipped.push({ epcCode, reason: 'INVALID_STATE', status: item.status });
    } else if (
      item.status === 'WARD_CABINET' &&
      inCabinet &&
      Number(item.current_location_id) === targetId
    ) {
      skipped.push({ epcCode, reason: 'ALREADY_IN_CABINET', status: item.status });
    } else {
      const isTransfer = inCabinet && Number(item.current_location_id) !== targetId;
      toIssue.push({ item, isTransfer, fromCabinetId: isTransfer ? item.current_location_id : null });
    }
  }

  if (toIssue.length > 0) {
    const scannedAt = new Date();
    await applyBatch({
      tenantId,
      itemIds: toIssue.map(({ item }) => item.id),
      setSql: "status = 'WARD_CABINET', current_location_type = 'CABINET', current_location_id = ?",
      setParams: [targetId],
      logRows: toIssue.map(({ item, isTransfer, fromCabinetId }) => [
        tenantId,
        item.id,
        null,
        req.auth.userId,
        'WARD_ISSUE',
        false,
        false,
        JSON.stringify({ cabinetId: targetId, isTransfer, fromCabinetId, roundId: null, batch: true }),
        scannedAt,
      ]),
    });
  }

  const processed = toIssue.map(({ item, isTransfer }) => ({
    epcCode: item.epc_code,
    fabricItemId: item.id,
    fabricCategoryId: item.fabric_category_id,
    isTransfer,
  }));

  // event เดิมของ ward-issue — ทุกหน้าที่ฟังอยู่แค่รีเฟรชข้อมูล (epcCodes ใช้ให้หน้าสแกนเครื่องอื่นตรวจซ้ำ)
  if (processed.length > 0) {
    emitToHospital(tenantId, 'scan:ward-issue', {
      cabinetId: targetId,
      count: processed.length,
      epcCodes: processed.map((p) => p.epcCode),
    });
  }

  return res.status(201).json({
    cabinetId: targetId,
    cabinetName: cabinet.name,
    processed,
    skipped,
  });
});

/**
 * POST /api/v1/scans/ward-receive-batch?hospitalId= — รับผ้าใช้แล้วกลับจากวอร์ดทั้งชุด (superadmin ต้องส่ง hospitalId)
 * body: { epcCodes[] }
 *
 * skipped.reason: NOT_FOUND | INVALID_STATE (ไม่ได้อยู่ที่วอร์ด — ตู้แผนก / ใช้งานที่วอร์ด)
 */
export const wardReceiveBatch = asyncHandler(async (req, res) => {
  const tenantId = await resolveWritableTenantId(req);
  const epcCodes = uniqueCodes(req.body.epcCodes);

  const itemByEpc = await loadItemsByEpc(tenantId, epcCodes);
  const toReceive = [];
  const skipped = [];
  for (const epcCode of epcCodes) {
    const item = itemByEpc.get(epcCode);
    if (!item) skipped.push({ epcCode, reason: 'NOT_FOUND' });
    else if (!RECEIVE_SOURCE_STATUSES.has(item.status)) {
      skipped.push({ epcCode, reason: 'INVALID_STATE', status: item.status });
    } else toReceive.push(item);
  }

  if (toReceive.length > 0) {
    const scannedAt = new Date();
    await applyBatch({
      tenantId,
      itemIds: toReceive.map((item) => item.id),
      setSql: "status = 'WASH', current_location_type = 'CENTRAL_STOCK', current_location_id = NULL",
      setParams: [],
      logRows: toReceive.map((item) => [
        tenantId,
        item.id,
        null,
        req.auth.userId,
        'WARD_RECEIVE',
        false,
        false,
        JSON.stringify({
          batch: true,
          fromCabinetId: item.current_location_type === 'CABINET' ? item.current_location_id : null,
        }),
        scannedAt,
      ]),
    });
  }

  const processed = toReceive.map((item) => ({
    epcCode: item.epc_code,
    fabricItemId: item.id,
    fabricCategoryId: item.fabric_category_id,
  }));

  if (processed.length > 0) {
    emitToHospital(tenantId, 'scan:ward-receive', {
      count: processed.length,
      epcCodes: processed.map((p) => p.epcCode),
    });
  }

  return res.status(201).json({ processed, skipped });
});
