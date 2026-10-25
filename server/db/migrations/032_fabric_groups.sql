-- เพิ่มชั้น "หมวดหมู่ผ้า" (fabric_groups) เหนือ "ประเภทผ้า"
--   หมวดหมู่ผ้า (fabric_groups)      เช่น ผ้าเสตอไลส์ / ผ้าสามัญ
--   ประเภทผ้า   (fabric_categories)  เช่น ชุดผ่าตัด / ผ้าปูเตียง / ผ้าปลอกหมอน — สังกัดหมวดหมู่ผ้า 1 หมวด
-- ตาราง/คอลัมน์ fabric_categories + fabric_category_id (ใน fabric_items, fabric_lots, cabinet_par_levels)
-- คือ "ประเภทผ้า" ตามเดิมทุกอย่าง ไม่ได้เปลี่ยนชื่อ — ผ้าแต่ละชิ้นยังผูกกับประเภทผ้าเหมือนเดิม
-- และได้หมวดหมู่ผ้าผ่านประเภทผ้านั้น
CREATE TABLE fabric_groups (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id BIGINT UNSIGNED NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  UNIQUE KEY uq_fabric_groups_hospital_name (hospital_id, name)
);

-- NULL ได้เฉพาะประเภทผ้าเก่าที่ยังไม่ได้จัดเข้าหมวดหมู่ — ประเภทผ้าที่สร้างใหม่ผ่าน API ต้องระบุเสมอ
ALTER TABLE fabric_categories
  ADD COLUMN group_id BIGINT UNSIGNED NULL AFTER hospital_id,
  ADD CONSTRAINT fk_fabric_categories_group FOREIGN KEY (group_id) REFERENCES fabric_groups(id);

-- seed 2 หมวดหมู่เริ่มต้นให้ทุกโรงพยาบาล
INSERT INTO fabric_groups (hospital_id, name)
SELECT h.id, g.name
FROM hospitals h
CROSS JOIN (SELECT 'ผ้าเสตอไลส์' AS name UNION ALL SELECT 'ผ้าสามัญ') g;

-- จัดประเภทผ้าเดิมเข้าหมวดหมู่ตามชื่อ: ชุดผ่าตัด -> ผ้าเสตอไลส์, ผ้าปูเตียง/ปลอกหมอน -> ผ้าสามัญ
-- ที่ไม่ตรงชื่อปล่อยเป็น NULL ให้แอดมินเลือกหมวดหมู่เองในหน้าลงทะเบียนผ้า
UPDATE fabric_categories c
JOIN fabric_groups g ON g.hospital_id = c.hospital_id AND g.name = 'ผ้าเสตอไลส์'
SET c.group_id = g.id
WHERE c.name LIKE 'ชุดผ่าตัด%';

UPDATE fabric_categories c
JOIN fabric_groups g ON g.hospital_id = c.hospital_id AND g.name = 'ผ้าสามัญ'
SET c.group_id = g.id
WHERE c.name LIKE 'ผ้าปูเตียง%' OR c.name LIKE 'ผ้าปลอกหมอน%';
