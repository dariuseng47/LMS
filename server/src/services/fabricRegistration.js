import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { getIO } from '../sockets/ioInstance.js';
import { scopedQuery } from '../db/scopedQuery.js';

// ลงทะเบียนผ้าใหม่ + บันทึก "ประวัติการลงทะเบียน" 1 รอบ (ดู db/migrations/040_fabric_registration_history.sql)
// ใช้ร่วมกันทุกทางที่สร้างผ้าใหม่: รายชิ้น / หลายชิ้น (เว็บ) และยืนยันรอบสแกนจาก Handheld

// มีคนอื่นลงทะเบียน EPC เดียวกันแทรกเข้ามาพอดี (หรือ deadlock) -> เริ่มใหม่ทั้งรอบ EPC นั้นจะกลายเป็น "ซ้ำ" แล้วถูกข้าม
const RETRYABLE_ERRORS = new Set(['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK']);
const MAX_ATTEMPTS = 3;

// epc_code ใน DB เทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่ — ฝั่งนี้ต้องเทียบแบบเดียวกัน
const epcKey = (epcCode) => epcCode.trim().toUpperCase();

async function recordHistory(conn, batch, epcCodes) {
  const [result] = await conn.query(
    `INSERT INTO fabric_registration_batches
       (hospital_id, source, device_id, session_id, fabric_category_id, category_name,
        fabric_lot_id, item_count, skipped_count, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batch.tenantId,
      batch.source,
      batch.deviceId,
      batch.sessionId,
      batch.category.id,
      batch.category.name,
      batch.fabricLotId,
      epcCodes.length,
      batch.skippedCount,
      batch.createdBy,
    ]
  );
  await conn.query(
    `INSERT INTO fabric_registration_items (batch_id, fabric_item_id, epc_code)
     SELECT ?, id, epc_code FROM fabric_items WHERE hospital_id = ? AND epc_code IN (?)`,
    [result.insertId, batch.tenantId, epcCodes]
  );
  return result.insertId;
}

async function registerOnce({ epcCodes, photoUrl, ...batch }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // epc_code เป็น unique key ระดับ global (ไม่ใช่ระดับ tenant) — ดู docs/data-model.md
    // จึงต้องเช็คซ้ำข้ามทุกโรงพยาบาล ไม่ใช่แค่ในเทแนนต์ตัวเอง
    const [existing] = await conn.query('SELECT epc_code FROM fabric_items WHERE epc_code IN (?)', [
      epcCodes,
    ]);
    const taken = new Set(existing.map((row) => epcKey(row.epc_code)));
    const created = epcCodes.filter((code) => !taken.has(epcKey(code)));
    const skipped = epcCodes.filter((code) => taken.has(epcKey(code)));

    let batchId = null;
    if (created.length > 0) {
      // ผ้าใหม่เริ่มที่สถานะ CENTRAL_STOCK เสมอ (สต๊อกกลาง พร้อมแจก ยังไม่เคยผ่านการสแกนจริง)
      await conn.query(
        `INSERT INTO fabric_items
           (hospital_id, epc_code, fabric_category_id, fabric_lot_id, status,
            current_location_type, current_location_id, wash_count, photo_url, created_by)
         VALUES ?`,
        [
          created.map((code) => [
            batch.tenantId,
            code,
            batch.category.id,
            batch.fabricLotId,
            'CENTRAL_STOCK',
            'CENTRAL_STOCK',
            null,
            0,
            photoUrl,
            batch.createdBy,
          ]),
        ]
      );

      try {
        batchId = await recordHistory(conn, { ...batch, skippedCount: skipped.length }, created);
      } catch (error) {
        // ยังไม่ได้รัน migration 040 — ลงทะเบียนผ้าต้องทำงานต่อได้ แค่ไม่มีประวัติ
        if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
        console.warn('[fabricRegistration] ไม่มีตารางประวัติการลงทะเบียน — ยังไม่ได้รัน migration 040');
      }
    }

    await conn.commit();
    return { batchId, created, skipped };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * ลงทะเบียนผ้าใหม่ทั้งชุด (ประเภท/ล็อตเดียวกัน) ใน transaction เดียว — EPC ที่มีในระบบแล้วถูกข้าม ไม่ error ทั้งชุด
 * source: READER (deviceId = เครื่องอ่าน) | HANDHELD (deviceId + sessionId) | MANUAL
 * คืน { batchId, created, skipped } (batchId = null ถ้าไม่มีผ้าใหม่เลย)
 */
export async function registerFabricItems({
  tenantId,
  epcCodes,
  fabricCategoryId,
  fabricLotId = null,
  photoUrl = null,
  createdBy,
  source,
  deviceId = null,
  sessionId = null,
}) {
  const [category] = await scopedQuery(pool, tenantId).select('fabric_categories', {
    id: fabricCategoryId,
  });
  if (!category) throw new AppError(404, 'NOT_FOUND', 'ไม่พบประเภทผ้านี้');

  const uniqueByKey = new Map();
  epcCodes.forEach((code) => {
    const key = epcKey(code);
    if (key && !uniqueByKey.has(key)) uniqueByKey.set(key, code.trim());
  });
  const codes = [...uniqueByKey.values()];
  if (codes.length === 0) return { batchId: null, created: [], skipped: [] };

  const params = {
    tenantId,
    epcCodes: codes,
    category: { id: category.id, name: category.name },
    fabricLotId,
    photoUrl,
    createdBy,
    source,
    deviceId,
    sessionId,
  };

  let result;
  for (let attempt = 1; !result; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      result = await registerOnce(params);
    } catch (error) {
      if (!RETRYABLE_ERRORS.has(error.code) || attempt >= MAX_ATTEMPTS) throw error;
    }
  }

  if (result.batchId) {
    // แท็บประวัติการลงทะเบียนที่เปิดค้างอยู่เห็นรอบใหม่ทันที
    const io = getIO();
    if (io) {
      io.to(`hospital:${tenantId}`).emit('fabric:registered', {
        batchId: result.batchId,
        itemCount: result.created.length,
      });
    }
  }

  return result;
}
