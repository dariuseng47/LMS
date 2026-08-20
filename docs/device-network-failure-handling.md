# Device / Network Failure Handling

## 1. Heartbeat Monitoring (รู้ว่าอุปกรณ์หลุดก่อนที่ user จะมาแจ้ง)

- ทุก edge device (Raspberry Pi ที่คุม RFID reader/weight scale) ส่ง heartbeat ไปที่ `POST /devices/:id/heartbeat` ทุก 30 วินาที
- Backend มี scheduled job เช็คทุก 60 วินาที: ถ้า `devices.last_heartbeat_at` เก่ากว่า 60 วินาที (2x interval) → set `status = 'OFFLINE'`
- เมื่อเปลี่ยนเป็น `OFFLINE`:
  - insert `device_status_log` (device_id, status, changed_at) เพื่อคำนวณ uptime % ย้อนหลังได้
  - emit Socket.io `device:status_changed` → dashboard ขึ้น badge แดง
  - แจ้งเตือน `caretaker_phone`/`caretaker_name` ที่ผูกกับอุปกรณ์นั้น (ตาม Device Caretaker ในเมนู) ผ่านช่องทางแจ้งเตือนที่ตั้งค่าไว้ (LINE Notify / SMS / email)
- กลับมา `ONLINE` ทันทีที่ heartbeat มาอีกครั้ง พร้อม log การกลับมา

## 2. Edge-Local Resilience (Raspberry Pi)

- Edge agent buffer scan event ลง SQLite local ก่อนเสมอ (เหมือน mobile app) แล้วค่อยพยายาม push ไป backend
- ถ้า network ไป backend ขาด: retry แบบ exponential backoff (เช่น 5s → 10s → 30s → 60s สูงสุด), ไม่ block การอ่าน RFID/scale ต่อเนื่อง
- เมื่อ network กลับมา: flush buffer เป็น batch ผ่าน endpoint เดียวกับ mobile sync (`/sync/batch`) — ใช้ conflict-detection logic เดียวกับที่อธิบายใน [offline-sync-conflict-resolution.md](offline-sync-conflict-resolution.md) เพราะโดยหลักการแล้ว edge agent ก็คือ "mobile client อีกแบบหนึ่ง" ที่ offline ได้เหมือนกัน

## 3. Sensor-Level Failure (ไม่ใช่แค่ network)

| ปัญหา | การจัดการ |
|---|---|
| อ่านค่า weight scale ไม่ได้ (serial error/timeout) | ไม่ block pipeline — บันทึก `weight_kg = NULL`, `sensor_error = true`, ยิง alert แยกจาก network alert |
| RFID reader อ่าน tag ไม่ได้เลย (ไม่ใช่แค่ RSSI ต่ำ) | ถือเป็น device fault ไม่ใช่ business exception — แยก log ประเภท `DEVICE_FAULT` ออกจาก `STEP_SKIPPED_WARNING` เพื่อไม่ให้ปนกับ exception ทางธุรกิจ |
| RSSI ต่ำกว่า threshold (ระบุใน Advanced_Feature_Details&Rules.md อยู่แล้ว) | ใช้ alert เดิม (Weak Signal Warning) — ไม่ต้องออกแบบใหม่ |

## 4. Device Health Dashboard Widget

- แสดง list อุปกรณ์ทั้งหมดของ tenant พร้อมสถานะสี: 🟢 online (heartbeat < 60s), 🟡 delayed (60s–5min), 🔴 offline (>5min)
- แสดง `last_heartbeat_at` และปุ่มโทรหา `caretaker_phone` ตรงจาก dashboard (`tel:` link) เพื่อลดเวลาตอบสนองหน้างาน
