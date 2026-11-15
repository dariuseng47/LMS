-- เก็บ "Par ณ ตอนตรวจนับ" ไว้กับแต่ละรอบจ่ายผ้า (ward_issue_rounds) — ใช้ทำสถิติผ้าเกิน/ขาด Par
-- ให้แอดมินวิเคราะห์ปรับ Par ทีหลัง (ดู server/src/controllers/parAnalysis.controller.js)
-- ต้องเก็บไว้กับรอบเพราะ cabinet_par_levels ถูกแทนที่ทั้งชุดทุกครั้งที่แก้ (ไม่มีประวัติ) ถ้าเทียบกับ
-- Par ปัจจุบันอย่างเดียว พอแอดมินปรับ Par แล้วสถิติย้อนหลังจะเพี้ยนทั้งหมด
-- รูปแบบ: {"<fabric_category_id>": <par_level_qty>, ...}  (NULL = รอบเก่าก่อน migration นี้ → ใช้ Par ปัจจุบันแทน)
ALTER TABLE ward_issue_rounds
  ADD COLUMN par_snapshot JSON NULL AFTER user_id;
