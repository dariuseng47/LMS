-- สถานะใหม่ "ส่งซักใหม่" (REWASH) — ผ้าที่เจอว่ายังไม่สะอาด/มีคราบ/ปนเปื้อน ระหว่างทาง (หลังซัก, ในสต๊อกกลาง,
-- ในตู้แผนก, ที่วอร์ด) แล้วถูกส่งกลับไปซักใหม่ ตั้งผ่านเมนู "เปลี่ยนสถานะผ้า" (handheld / popup หน้าคลังผ้า)
-- ผ้า REWASH กลับเข้า flow ปกติตอน "รับผ้าหลังซัก & ชั่งน้ำหนัก" (WASH) ไม่ถือว่าข้ามขั้นตอน
--
-- rewash_records = ประวัติการส่งซักใหม่ 1 แถวต่อ 1 ครั้งต่อชิ้น เก็บ snapshot ณ ตอนส่ง (สถานะเดิม, ตู้/แผนก
-- ที่ผ้าอยู่, ประเภทผ้า) เพราะหลังจากนั้นผ้าย้ายสถานะ/ตำแหน่งไปเรื่อย ๆ ถ้าคำนวณย้อนจาก scan_logs จะหาแผนก
-- ต้นทางไม่ได้ — ใช้ทำแท็บ "ประวัติผ้าส่งซักใหม่" (ดู server/src/controllers/rewashAnalysis.controller.js)
--   closed_at/close_type: ปิดเมื่อผ้าออกจากสถานะ REWASH — WASHED = ผ่านการรับผ้าหลังซัก/ชั่งน้ำหนัก
--   (หรือเปลี่ยนสถานะเป็น WASH เอง), BYPASSED = ออกจาก REWASH ทางอื่นโดยไม่ผ่านการซัก (เปลี่ยนสถานะเอง,
--   สแกนเข้าสต๊อคตรง ๆ) ใช้เป็นตัวชี้วัด "ส่งซักใหม่แล้วไม่ได้ซักจริง"
--
-- REWASH ต่อท้าย ENUM (ไม่แทรกกลาง) — MySQL เพิ่มค่าท้าย ENUM แบบ in-place ไม่ต้อง copy ตาราง fabric_items
--
-- ถ้า DB ยังไม่ได้รัน 023 (ENUM ยังมี DRY/WEIGHT_COUNT/FOLDING_QC) ให้รัน 023 ก่อน หรือเพิ่ม 'REWASH' ต่อท้าย
-- ENUM ปัจจุบันแทน (คงค่าเดิมไว้ทั้งหมด) — MODIFY ด้านล่างระบุชุดสถานะหลัง 023
--
-- รันกับ database เดิม: mysql -u <user> -p <db> < 038_rewash_status.sql

ALTER TABLE fabric_items
  MODIFY COLUMN status ENUM(
    'WASH','CENTRAL_STOCK','WARD_CABINET','IN_USE_WARD',
    'HOLD','DECOMMISSIONED','PENDING_DECOMMISSION','REWASH'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS rewash_records (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id        BIGINT UNSIGNED NOT NULL,
  fabric_item_id     BIGINT UNSIGNED NOT NULL,
  fabric_category_id BIGINT UNSIGNED NOT NULL,
  prev_status        VARCHAR(30) NOT NULL,
  prev_location_type VARCHAR(50) NULL,
  cabinet_id         BIGINT UNSIGNED NULL,
  department_id      BIGINT UNSIGNED NULL,
  reason_code        VARCHAR(100) NULL,
  user_id            BIGINT UNSIGNED NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at          DATETIME NULL,
  close_type         VARCHAR(20) NULL,
  wash_batch_id      BIGINT UNSIGNED NULL,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (fabric_item_id) REFERENCES fabric_items(id),
  FOREIGN KEY (fabric_category_id) REFERENCES fabric_categories(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_rr_hospital_created (hospital_id, created_at),
  INDEX idx_rr_item_open (hospital_id, fabric_item_id, closed_at)
);
