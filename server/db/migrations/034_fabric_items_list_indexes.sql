-- หน้าคลังผ้า (dashboard /dashboard/fabric) เปลี่ยนเป็นโหลดทีละหน้า (GET /fabric-items?limit=&offset=)
--   เรียง created_at DESC + กรองช่วงวันที่ลงทะเบียน -> index (hospital_id, created_at) ให้ LIMIT ไม่ต้อง filesort ทั้งโรงพยาบาล
--   หน้า "ประวัติผ้าที่จำหน่ายออก" กรอง status แล้วเรียง/กรอง updated_at -> index (hospital_id, status, updated_at)
--
-- รันกับ database เดิม: mysql -u <user> -p <db> < 034_fabric_items_list_indexes.sql

ALTER TABLE fabric_items
  ADD INDEX idx_fi_hospital_created (hospital_id, created_at),
  ADD INDEX idx_fi_hospital_status_updated (hospital_id, status, updated_at);
