-- แท็บ "ประวัติการลงทะเบียนผ้า" (เว็บ: จัดการผ้าและล็อต › ลงทะเบียนผ้า / ล็อต)
--   ลงทะเบียน 1 ครั้ง (กดยืนยัน 1 ที) = 1 รอบ (fabric_registration_batches) บอกว่าลงเมื่อไหร่ ผ้าประเภท/ล็อตไหน กี่ชิ้น
--   ผ่านเครื่องไหน ใครลง + รายชิ้นในรอบ (fabric_registration_items)
--
-- source:
--   READER   = เครื่องอ่าน RFID (ประตูชั่งน้ำหนัก / จุดตรวจสอบ) สั่งอ่านจากหน้าเว็บ -> device_id
--   HANDHELD = เครื่องสแกนมือถือ ผ่าน registration_scan_sessions -> device_id + session_id
--   MANUAL   = พิมพ์ / วางรหัส EPC เอง ไม่ผ่านเครื่อง
--   LEGACY   = ลงทะเบียนก่อนมีตารางนี้ ไม่มีข้อมูลว่าผ่านเครื่องไหน (สร้างย้อนหลังด้านล่าง)
--
-- ประเภทผ้าเก็บ "ตอนลงทะเบียน" ไว้ (เปลี่ยนประเภทผ้าทีหลังประวัติไม่เปลี่ยนตาม) + สำเนาชื่อ category_name เผื่อประเภทนั้น
-- ถูกลบ — FK เป็น SET NULL ประวัติต้องไม่ขวางการลบประเภทผ้าที่ไม่มีผ้าผูกแล้ว
--
-- รันกับ database เดิม: mysql -u <user> -p <db> < 040_fabric_registration_history.sql
-- ต้องรันไฟล์นี้ "ก่อน" อัปโหลด server เวอร์ชันใหม่ (รันซ้ำได้ ไม่สร้างประวัติซ้ำ) ไม่แก้ตาราง fabric_items

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
-- ผ้าถูกสร้างตอนกดยืนยัน จึงอยู่ในช่วงเวลา created_at..updated_at ของ session นั้นเสมอ
-- (ใช้ updated_at แทน confirmed_at เพราะ confirmed_at เป็นเวลาฝั่ง server แอป อาจคนละเขตเวลากับ database)
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
-- ไม่รวมผ้าที่โอนย้ายข้ามโรงพยาบาล (โอนแล้วโรงพยาบาล/ประเภท/ล็อตถูกเปลี่ยนหมด ไม่รู้ว่าตอนลงทะเบียนเป็นอะไร)
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
