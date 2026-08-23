-- เก็บตำแหน่งเดิมก่อนย้าย คู่กับ current_location ที่ fabric_items มีอยู่แล้ว — ใช้ตอนโอนผ้าที่
-- เจอผิดตู้ระหว่างตรวจนับเข้ามาทับ (ดู POST /scans/ward-issue) เพื่อ log ว่าเดิมผ้าอยู่ตู้/แผนกไหน
-- ก่อนถูกโอนเข้ามา (ตาม pattern เดียวกับ current_location_type/current_location_id เดิม)
ALTER TABLE scan_logs
  ADD COLUMN from_location_type VARCHAR(50) NULL AFTER event_type,
  ADD COLUMN from_location_id BIGINT UNSIGNED NULL AFTER from_location_type;
