-- สถานะใหม่ "จ่ายกลาง" (CENTRAL_SUPPLY) — สต๊อคปลายทางอีกแห่งคู่กับ "สต๊อกกลาง" (CENTRAL_STOCK)
-- ผ้าเข้าสถานะนี้จากเมนู "สแกนเข้าสต๊อค" (เลือกสต๊อคใน dropdown) หรือเมนู "เปลี่ยนสถานะผ้า"
-- ทำงานเหมือน CENTRAL_STOCK ทุกอย่าง: จ่ายเข้าตู้แผนกได้ ส่งซักใหม่/พัก/แทงชำรุดได้ ตั้งเวลาค้างสถานะได้
--
-- current_location_type ไม่มีค่าใหม่ — ผ้าที่ไม่ได้อยู่ตู้/เครื่องใช้ 'CENTRAL_STOCK' เหมือนเดิม (WASH/REWASH ก็ใช้ค่านี้)
-- ชื่อตำแหน่งที่แสดงดูจาก status แทน (ดู tracking.controller.js#centralLocationName)
--
-- stock_scan_rounds.stock_type = รอบนั้นสแกนเข้าสต๊อคไหน (รอบเก่าทั้งหมด = CENTRAL_STOCK)
--
-- ค่าใหม่ต่อท้าย ENUM (ไม่แทรกกลาง) — MySQL เพิ่มค่าท้าย ENUM แบบ in-place ไม่ต้อง copy ตาราง fabric_items
-- ต้องรัน 038 ก่อน (ENUM ด้านล่างรวม REWASH แล้ว) และต้องรันไฟล์นี้ "ก่อน" อัปโหลด server เวอร์ชันใหม่
--
-- รันกับ database เดิม: mysql -u <user> -p <db> < 039_central_supply_status.sql

ALTER TABLE fabric_items
  MODIFY COLUMN status ENUM(
    'WASH','CENTRAL_STOCK','WARD_CABINET','IN_USE_WARD',
    'HOLD','DECOMMISSIONED','PENDING_DECOMMISSION','REWASH','CENTRAL_SUPPLY'
  ) NOT NULL;

ALTER TABLE status_timeout_settings
  MODIFY COLUMN status ENUM('WASH','CENTRAL_STOCK','CENTRAL_SUPPLY') NOT NULL;

ALTER TABLE stock_scan_rounds
  ADD COLUMN stock_type VARCHAR(30) NOT NULL DEFAULT 'CENTRAL_STOCK' AFTER device_id;
