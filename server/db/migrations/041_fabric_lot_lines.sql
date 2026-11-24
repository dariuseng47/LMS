-- 1 ล็อต มีได้หลายประเภทผ้า — รายการประเภท + จำนวนสั่งซื้อของแต่ละประเภทในล็อต (แท็บ "ตั้งค่าล็อต")
-- เดิม 1 ล็อต = 1 ประเภท (fabric_lots.fabric_category_id) ล็อตที่ไม่ได้ตั้งประเภทจึงใช้กับ handheld ไม่ได้
--
-- ประเภทที่ลงทะเบียนเข้าล็อตจริงแต่ไม่อยู่ในตารางนี้ "ไม่ต้อง" สร้างแถว — server รวมจากผ้าที่ผูกล็อตอยู่ให้เอง
-- (ดู services/fabricLots.js#loadLotLines) ประเภทในล็อตจึงตรงกับผ้าจริงเสมอ แม้มีการเปลี่ยนประเภทผ้าทีหลัง
--
-- fabric_lots เดิมยังอยู่ครบ: quantity = ยอดรวมทุกประเภท, fabric_category_id = ประเภทเดียวของล็อต (หลายประเภท = NULL)
-- คงไว้ให้ server เวอร์ชันเก่าใช้งานต่อได้ระหว่างรอ deploy ไม่แก้ตาราง fabric_items
--
-- รันกับ database เดิม: mysql -u <user> -p <db> < 041_fabric_lot_lines.sql
-- ต้องรันไฟล์นี้ (และ 040) "ก่อน" อัปโหลด server เวอร์ชันใหม่ — รันซ้ำได้

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
