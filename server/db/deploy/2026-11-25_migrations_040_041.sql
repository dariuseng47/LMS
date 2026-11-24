-- =====================================================================================
-- อัปเดต database รอบ 25 พ.ย. 2026 — migration 040 + 041 (รวมไว้ไฟล์เดียว)
-- =====================================================================================
-- ต้องรันไฟล์นี้ "ก่อน" อัปโหลด server เวอร์ชันใหม่ (commit 1de86d5 .. d9f103c)
--
-- ใช้กับ database เดิมที่รัน migration ถึง 039 แล้ว (server ที่อัปโหลดเมื่อ 24 พ.ย. มีถึง 039)
--   040 = ประวัติการลงทะเบียนผ้า (ตารางใหม่ 2 ตาราง + สร้างประวัติย้อนหลังจากผ้าที่มีอยู่)
--   041 = ล็อตมีได้หลายประเภทผ้า (ตารางใหม่ 1 ตาราง + แปลงล็อตเดิมให้เอง)
-- ไม่แก้/ไม่ลบข้อมูลในตารางเดิม (fabric_items, fabric_lots ฯลฯ) — แค่เพิ่มตารางใหม่และเติมข้อมูลลงตารางใหม่
--
-- วิธีรัน:  mysql -u <user> -p <db> < 2026-11-25_migrations_040_041.sql
--          (หรือวางทั้งไฟล์ใน phpMyAdmin / Plesk > Databases > SQL แล้วกดรัน)
-- แนะนำให้ backup database ก่อน — คำสั่ง CREATE/ALTER ของ MySQL commit ทันที ย้อนด้วย ROLLBACK ไม่ได้
--
-- รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ:
--   ถ้ามีคนใช้ระบบเก่าลงทะเบียนผ้า / สร้างล็อต ระหว่างรันไฟล์นี้กับอัปโหลด server เสร็จ
--   ให้รันไฟล์นี้ซ้ำอีกรอบหลังอัปโหลด — ผ้า/ล็อตที่เพิ่มช่วงนั้นจะถูกเติมเข้าตารางใหม่ให้ครบ
--
-- ถ้ารันแล้ว error "Duplicate column name 'backfill_key'" (รอบก่อนหยุดกลางทางในส่วน 040)
--   ให้รันบรรทัดนี้ก่อน แล้วรันไฟล์นี้ใหม่:
--   ALTER TABLE fabric_registration_batches DROP INDEX idx_frb_backfill, DROP COLUMN backfill_key;
-- =====================================================================================

SET NAMES utf8mb4;

-- -------------------------------------------------------------------------------------
-- ตรวจก่อนรัน: ต้องรัน 038 + 039 แล้ว — ถ้ายังไม่ได้รัน 2 บรรทัดนี้จะ error และไฟล์หยุดตรงนี้
-- (ไม่มีอะไรถูกแก้) ให้รัน migrations/038_rewash_status.sql และ 039_central_supply_status.sql ก่อน
-- -------------------------------------------------------------------------------------
SELECT id FROM rewash_records LIMIT 0;
SELECT stock_type FROM stock_scan_rounds LIMIT 0;


-- =====================================================================================
-- 040 — ประวัติการลงทะเบียนผ้า (เว็บ: จัดการผ้าและล็อต › ลงทะเบียนผ้า / ล็อต › แท็บ "ประวัติการลงทะเบียนผ้า")
-- =====================================================================================
--   ลงทะเบียน 1 ครั้ง (กดยืนยัน 1 ที) = 1 รอบ (fabric_registration_batches) + รายชิ้นในรอบ (fabric_registration_items)
--   source: READER = เครื่องอ่าน RFID, HANDHELD = เครื่องสแกนมือถือ, MANUAL = พิมพ์/วางรหัสเอง,
--           LEGACY = ผ้าที่ลงทะเบียนก่อนมีตารางนี้ (สร้างย้อนหลังด้านล่าง ไม่รู้ว่าผ่านเครื่องไหน)

CREATE TABLE IF NOT EXISTS fabric_registration_batches (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id        BIGINT UNSIGNED NOT NULL,
  source             ENUM('READER','HANDHELD','MANUAL','LEGACY') NOT NULL,
  device_id          BIGINT UNSIGNED NULL,
  session_id         BIGINT UNSIGNED NULL,
  fabric_category_id BIGINT UNSIGNED NULL,
  category_name      VARCHAR(150) NULL,
  fabric_lot_id      BIGINT UNSIGNED NULL,
  item_count         INT UNSIGNED NOT NULL DEFAULT 0,
  -- EPC ที่ถูกข้ามเพราะมีในระบบแล้ว
  skipped_count      INT UNSIGNED NOT NULL DEFAULT 0,
  created_by         BIGINT UNSIGNED NULL,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_frb_hospital_created (hospital_id, created_at),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (session_id) REFERENCES registration_scan_sessions(id),
  FOREIGN KEY (fabric_category_id) REFERENCES fabric_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (fabric_lot_id) REFERENCES fabric_lots(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS fabric_registration_items (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id       BIGINT UNSIGNED NOT NULL,
  fabric_item_id BIGINT UNSIGNED NOT NULL,
  epc_code       VARCHAR(64) NOT NULL,
  -- ผ้า 1 ชิ้นลงทะเบียนได้ครั้งเดียว
  UNIQUE KEY uq_fri_item (fabric_item_id),
  INDEX idx_fri_batch (batch_id),
  FOREIGN KEY (batch_id) REFERENCES fabric_registration_batches(id),
  FOREIGN KEY (fabric_item_id) REFERENCES fabric_items(id)
);

-- ---------- ประวัติย้อนหลัง 1/2: ผ้าที่มาจากรอบสแกน Handheld ที่ยืนยันแล้ว (รู้เครื่อง) ----------
INSERT INTO fabric_registration_batches
  (hospital_id, source, device_id, session_id, fabric_category_id, category_name, fabric_lot_id, created_by, created_at)
SELECT s.hospital_id, 'HANDHELD', s.device_id, s.id, c.id, c.name, s.fabric_lot_id, s.triggered_by, s.updated_at
FROM registration_scan_sessions s
LEFT JOIN fabric_lots l ON l.id = s.fabric_lot_id
LEFT JOIN fabric_categories c ON c.id = COALESCE(l.fabric_category_id, s.fabric_category_id)
WHERE s.status = 'CONFIRMED'
  AND NOT EXISTS (SELECT 1 FROM fabric_registration_batches b WHERE b.session_id = s.id);

INSERT INTO fabric_registration_items (batch_id, fabric_item_id, epc_code)
SELECT MIN(b.id), f.id, f.epc_code
FROM fabric_registration_batches b
JOIN registration_scan_sessions s ON s.id = b.session_id
JOIN fabric_items f
  ON f.hospital_id = s.hospital_id
 AND f.created_by = s.triggered_by
 AND f.created_at BETWEEN s.created_at AND s.updated_at
 AND JSON_CONTAINS(s.scanned_epcs, JSON_QUOTE(f.epc_code))
WHERE b.source = 'HANDHELD'
  AND NOT EXISTS (SELECT 1 FROM fabric_registration_items i WHERE i.fabric_item_id = f.id)
GROUP BY f.id, f.epc_code;

-- ---------- ประวัติย้อนหลัง 2/2: ผ้าที่เหลือ (ไม่รู้เครื่อง) ----------
-- จับกลุ่มเป็นรอบจาก คนลง + ประเภท + ล็อต + ช่วงเวลา 10 นาทีเดียวกัน
-- ประเภทตอนลงทะเบียน = ประเภทก่อนเปลี่ยนครั้งแรก (ถ้าเคยเปลี่ยนประเภทผ้า) ไม่งั้นใช้ประเภทปัจจุบัน
-- ไม่รวมผ้าที่โอนย้ายข้ามโรงพยาบาล (ไม่รู้ว่าตอนลงทะเบียนเป็นอะไร)
-- backfill_key เป็นคอลัมน์ชั่วคราว ใช้จับคู่รอบกับผ้า แล้วลบทิ้งท้ายส่วนนี้
ALTER TABLE fabric_registration_batches
  ADD COLUMN backfill_key VARCHAR(150) NULL,
  ADD INDEX idx_frb_backfill (backfill_key);

INSERT INTO fabric_registration_batches
  (hospital_id, source, fabric_category_id, fabric_lot_id, created_by, created_at, backfill_key)
SELECT t.hospital_id, 'LEGACY', t.category_id, t.fabric_lot_id, t.created_by, MIN(t.created_at), t.k
FROM (
  SELECT f.hospital_id, f.fabric_lot_id, f.created_by, f.created_at,
         COALESCE(
           (SELECT ci.from_category_id FROM fabric_category_change_items ci
            WHERE ci.fabric_item_id = f.id ORDER BY ci.id LIMIT 1),
           f.fabric_category_id) AS category_id,
         CONCAT_WS('|', f.hospital_id, IFNULL(f.created_by, 0),
           COALESCE(
             (SELECT ci.from_category_id FROM fabric_category_change_items ci
              WHERE ci.fabric_item_id = f.id ORDER BY ci.id LIMIT 1),
             f.fabric_category_id),
           IFNULL(f.fabric_lot_id, 0), FLOOR(UNIX_TIMESTAMP(f.created_at) / 600)) AS k
  FROM fabric_items f
  WHERE NOT EXISTS (SELECT 1 FROM fabric_registration_items i WHERE i.fabric_item_id = f.id)
    AND NOT EXISTS (SELECT 1 FROM transfer_records tr WHERE tr.fabric_item_id = f.id)
) t
GROUP BY t.hospital_id, t.category_id, t.fabric_lot_id, t.created_by, t.k;

INSERT INTO fabric_registration_items (batch_id, fabric_item_id, epc_code)
SELECT b.id, f.id, f.epc_code
FROM fabric_items f
JOIN fabric_registration_batches b
  ON b.source = 'LEGACY'
 AND b.backfill_key = CONCAT_WS('|', f.hospital_id, IFNULL(f.created_by, 0),
       COALESCE(
         (SELECT ci.from_category_id FROM fabric_category_change_items ci
          WHERE ci.fabric_item_id = f.id ORDER BY ci.id LIMIT 1),
         f.fabric_category_id),
       IFNULL(f.fabric_lot_id, 0), FLOOR(UNIX_TIMESTAMP(f.created_at) / 600))
WHERE NOT EXISTS (SELECT 1 FROM fabric_registration_items i WHERE i.fabric_item_id = f.id)
  AND NOT EXISTS (SELECT 1 FROM transfer_records tr WHERE tr.fabric_item_id = f.id);

ALTER TABLE fabric_registration_batches
  DROP INDEX idx_frb_backfill,
  DROP COLUMN backfill_key;

-- สรุปยอด/ชื่อประเภทของรอบย้อนหลัง แล้วตัดรอบ Handheld ที่ไม่มีผ้าเข้าจริงทิ้ง (EPC ซ้ำทั้งหมด)
UPDATE fabric_registration_batches b
LEFT JOIN fabric_categories c ON c.id = b.fabric_category_id
SET b.category_name = COALESCE(b.category_name, c.name),
    b.item_count = (SELECT COUNT(*) FROM fabric_registration_items i WHERE i.batch_id = b.id)
WHERE b.item_count = 0;

DELETE FROM fabric_registration_batches WHERE item_count = 0;


-- =====================================================================================
-- 041 — 1 ล็อตมีได้หลายประเภทผ้า (เว็บ: แท็บ "ตั้งค่าล็อต")
-- =====================================================================================
-- รายการประเภท + จำนวนสั่งซื้อของแต่ละประเภทในล็อต
-- fabric_lots เดิมยังอยู่ครบ (quantity = ยอดรวม, fabric_category_id = ประเภทเดียวของล็อต / หลายประเภท = NULL)
-- ประเภทที่ลงทะเบียนเข้าล็อตจริงแต่ไม่อยู่ในตารางนี้ server รวมจากผ้าให้เอง — ไม่ต้องสร้างแถวเพิ่ม

CREATE TABLE IF NOT EXISTS fabric_lot_lines (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fabric_lot_id      BIGINT UNSIGNED NOT NULL,
  fabric_category_id BIGINT UNSIGNED NOT NULL,
  quantity           INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_fll_lot_category (fabric_lot_id, fabric_category_id),
  FOREIGN KEY (fabric_lot_id) REFERENCES fabric_lots(id),
  FOREIGN KEY (fabric_category_id) REFERENCES fabric_categories(id)
);

-- ล็อตเดิมที่ตั้งประเภทไว้ -> 1 รายการ จำนวน = จำนวนของล็อต (ล็อตที่มีรายการแล้วไม่แตะ)
INSERT INTO fabric_lot_lines (fabric_lot_id, fabric_category_id, quantity)
SELECT l.id, l.fabric_category_id, l.quantity
FROM fabric_lots l
JOIN fabric_categories c ON c.id = l.fabric_category_id AND c.hospital_id = l.hospital_id
WHERE NOT EXISTS (SELECT 1 FROM fabric_lot_lines x WHERE x.fabric_lot_id = l.id);


-- =====================================================================================
-- ตรวจผลหลังรัน (อ่านอย่างเดียว)
-- =====================================================================================
-- ผ้าทั้งหมด vs ผ้าที่มีประวัติลงทะเบียน — ส่วนต่างคือผ้าที่เคยโอนย้ายข้ามโรงพยาบาล (ไม่สร้างประวัติให้)
SELECT
  (SELECT COUNT(*) FROM fabric_items)                                        AS fabric_items_total,
  (SELECT COUNT(*) FROM fabric_registration_items)                           AS registered_in_history,
  (SELECT COUNT(DISTINCT fabric_item_id) FROM transfer_records)              AS transferred_items_skipped,
  (SELECT COUNT(*) FROM fabric_registration_batches)                         AS history_rounds;

-- จำนวนรอบประวัติแยกตามที่มา
SELECT source, COUNT(*) AS rounds, SUM(item_count) AS items
FROM fabric_registration_batches
GROUP BY source;

-- ล็อตเดิมที่ตั้งประเภทไว้ vs ล็อตที่แปลงเป็นรายการแล้ว (2 ค่านี้ควรเท่ากัน)
-- ล็อตที่ประเภทเป็นของโรงพยาบาลอื่น (ข้อมูลผิด) ไม่ถูกแปลงและไม่นับในค่าแรก
SELECT
  (SELECT COUNT(*) FROM fabric_lots l
     JOIN fabric_categories c ON c.id = l.fabric_category_id AND c.hospital_id = l.hospital_id) AS lots_with_category,
  (SELECT COUNT(DISTINCT fabric_lot_id) FROM fabric_lot_lines)                                  AS lots_with_lines;

-- รอบ Handheld ที่ค้าง "รออนุมัติ" จากระบบเดิม — ถ้ามากกว่า 0 เว็บจะขึ้นแถบเตือนให้เคลียร์ในหน้าลงทะเบียนผ้า
SELECT COUNT(*) AS handheld_sessions_waiting_approval
FROM registration_scan_sessions
WHERE status = 'REPORTED';
