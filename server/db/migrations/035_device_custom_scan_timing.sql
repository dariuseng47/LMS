-- ความเร็วการสแกนแบบ "กำหนดเอง" (CUSTOM) — กรอกเวลาเองได้ในหน้า "อุปกรณ์ & สัญญาณ RFID"
--   scan_round_ms      = เวลาอ่านสูงสุดต่อรอบ inventory (ms) — เครื่อง 4 พอร์ตอ่านทีละเสาต่อรอบ ค่ายิ่งต่ำ
--                        ยิ่งสลับเสาเร็ว ("อ่านรัว") ส่งเข้าเครื่องเป็น InventoryScanTime หน่วย 100ms (300–25500)
--   scan_stable_rounds = ไม่เจอ EPC ใหม่ติดกันกี่ "รอบวนเสา" ถึงจบการสแกน (1–10)
--   scan_max_ms        = เพดานเวลาสแกนต่อครั้ง (ms) ครบแล้วจบทันทีแม้ยังเจอแท็กใหม่ (1000–60000)
-- ใช้เฉพาะเมื่อ scan_profile = 'CUSTOM' (ค่า NULL = ใช้ค่าเริ่มต้นของระบบ)
--
-- scan_min_rssi = กรองแท็กสัญญาณอ่อน (อยู่ไกล) ทิ้งตอนสแกน — ค่า RSSI ดิบจากเครื่อง (0-255 ยิ่งมาก
--   = ยิ่งแรง/ใกล้) ใช้ได้ทุกโปรไฟล์ NULL = ไม่กรอง | คนละอย่างกับ rssi_threshold_dbm (ใช้แค่แจ้งเตือน)
ALTER TABLE devices
  MODIFY COLUMN scan_profile ENUM('VERY_FAST','FAST','NORMAL','THOROUGH','CUSTOM') NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN scan_round_ms SMALLINT UNSIGNED NULL AFTER scan_power_dbm,
  ADD COLUMN scan_stable_rounds TINYINT UNSIGNED NULL AFTER scan_round_ms,
  ADD COLUMN scan_max_ms SMALLINT UNSIGNED NULL AFTER scan_stable_rounds,
  ADD COLUMN scan_min_rssi TINYINT UNSIGNED NULL AFTER scan_max_ms;
