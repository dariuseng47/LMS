-- เมนู "สแกนตรวจสอบผ้า" (เว็บ: ปฏิบัติการ & ติดตามผ้า › สแกนตรวจสอบผ้า)
--   สแกนผ้าผ่านเครื่องอ่าน RFID จุดตรวจสอบเพื่อดูข้อมูล/โปรไฟล์ผ้า ประวัติซัก รอบซัก — อ่านอย่างเดียว
--   ไม่บันทึกอะไรลงระบบ จึงมีแค่สิทธิ์ view (ดู server/src/config/menuCatalog.js)
--
-- รันกับ database เดิม: mysql -u <user> -p <db> < 036_inspect_scan_permission.sql

INSERT INTO permissions (perm_key, category, description) VALUES
  ('web.operations.inspect_scan.view', 'web:operations', 'ดู: สแกนตรวจสอบผ้า')
ON DUPLICATE KEY UPDATE category = VALUES(category), description = VALUES(description);

-- ADMIN + OPERATOR เห็นเมนูเป็นค่าเริ่มต้น (เหมือน "สแกนเข้าสต๊อค")
INSERT IGNORE INTO role_default_permissions (role, perm_key) VALUES
  ('ADMIN',    'web.operations.inspect_scan.view'),
  ('OPERATOR', 'web.operations.inspect_scan.view');
