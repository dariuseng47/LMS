import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { getIO } from '../sockets/ioInstance.js';
import { scopedQuery } from '../db/scopedQuery.js';

// ลงทะเบียนผ้าใหม่ + บันทึก "ประวัติการลงทะเบียน" 1 รอบ (ดู db/migrations/040_fabric_registration_history.sql)
// ใช้ร่วมกันทุกทางที่สร้างผ้าใหม่: รายชิ้น / หลายชิ้น (เว็บ) และรอบสแกนจาก Handheld

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

// ปิดรอบสแกน Handheld ใน transaction เดียวกับการสร้างผ้า — ล็อกแถวไว้ก่อน ส่งผลซ้ำพร้อมกัน (กดสองที / เน็ตหลุดแล้ว
// ส่งใหม่) ตัวที่สองจะรอแล้วเห็นว่ารอบปิดไปแล้ว
async function lockOpenSession(conn, tenantId, sessionId) {
  const [rows] = await conn.query(
    'SELECT status FROM registration_scan_sessions WHERE hospital_id = ? AND id = ? FOR UPDATE',
    [tenantId, sessionId]
  );
  if (!rows[0] || ['CONFIRMED', 'CANCELLED'].includes(rows[0].status)) {
    throw new AppError(400, 'SESSION_CLOSED', 'รอบสแกนนี้ปิดไปแล้ว');
  }
}

async function closeSession(conn, tenantId, sessionId, { scannedEpcs, confirmedBy }) {
  await conn.query(
    `UPDATE registration_scan_sessions
     SET status = 'CONFIRMED', scanned_epcs = ?, confirmed_by = ?, confirmed_at = NOW()
     WHERE hospital_id = ? AND id = ?`,
    [JSON.stringify(scannedEpcs), confirmedBy, tenantId, sessionId]
  );
}

async function registerOnce({ epcCodes, photoUrl, sessionClose, ...batch }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (batch.sessionId) await lockOpenSession(conn, batch.tenantId, batch.sessionId);

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

    if (batch.sessionId) await closeSession(conn, batch.tenantId, batch.sessionId, sessionClose);

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
 * source: READER (deviceId = เครื่องอ่าน) | HANDHELD (deviceId + sessionId + sessionClose) | MANUAL
 * sessionClose = { scannedEpcs, confirmedBy } — ปิดรอบสแกน sessionId เป็น CONFIRMED ไปพร้อมกัน (รอบปิดไปแล้ว -> SESSION_CLOSED)
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
  sessionClose = null,
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
    sessionClose,
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

// ผลของรอบสแกน Handheld ที่ลงทะเบียนไปแล้ว (ใช้ตอบการส่งผลซ้ำให้ได้คำตอบเดิม)
export async function findSessionRegistration(tenantId, sessionId) {
  const [rows] = await pool.query(
    `SELECT i.epc_code
     FROM fabric_registration_batches b
     JOIN fabric_registration_items i ON i.batch_id = b.id
     WHERE b.hospital_id = ? AND b.session_id = ?`,
    [tenantId, sessionId]
  );
  return rows.map((row) => row.epc_code);
}
