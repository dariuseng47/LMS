# Non-Functional Requirements

> เป้าหมายเบื้องต้นสำหรับ MVP — ปรับได้เมื่อมีข้อมูลการใช้งานจริง

## Performance

| ตัวชี้วัด | เป้าหมาย |
|---|---|
| Scan ingestion API (`/scans/*`) latency | p95 < 300ms |
| Scan → Dashboard update (ผ่าน Socket.io) | < 2 วินาที |
| Dashboard initial load (list/summary API) | p95 < 800ms |
| Mobile offline scan write (local SQLite) | < 100ms (ไม่ต้องรอ network) |

## Scale (เผื่ออนาคต ไม่ใช่ day-1)

- รองรับสูงสุด ~50 โรงพยาบาล (tenant) ต่อ 1 organization
- ~500,000 fabric_items ที่ active พร้อมกันทั้งระบบ
- ~200 อุปกรณ์ (reader/kiosk/handheld) online พร้อมกัน
- ~50,000 scan events/วัน ต่อโรงพยาบาลขนาดใหญ่ 1 แห่ง

## Availability

- Backend API เป้าหมาย 99.5% uptime (MVP เดี่ยว region, ยังไม่ต้อง multi-region)
- Mobile app **ต้องทำงานต่อได้แม้ backend ล่ม** (offline-first เป็น design requirement ไม่ใช่ fallback) — เขียน scan ลง local เสมอก่อน ไม่ block UI รอ network
- Edge agent (Raspberry Pi) buffer เหตุการณ์ไว้ local เมื่อ backend unreachable (ดู [device-network-failure-handling.md](device-network-failure-handling.md))

## Backup & Disaster Recovery (MySQL)

- Full backup รายวัน + binlog แบบ incremental เพื่อทำ point-in-time recovery
- Retention: เก็บ backup ย้อนหลังอย่างน้อย 30 วัน
- ทดสอบ restore จริงอย่างน้อยไตรมาสละครั้ง (restore drill) — ไม่ใช่แค่เชื่อว่า backup รันสำเร็จ
- **RPO ≤ 15 นาที**, **RTO ≤ 4 ชั่วโมง** สำหรับ MVP

## Data Retention

- `scan_logs`: เก็บอย่างน้อย 2 ปี (ใช้คำนวณรอบซัก/ประวัติผ้าย้อนหลัง)
- `audit_logs`: เก็บอย่างน้อย 1 ปี หรือ ตามนโยบาย IT ของแต่ละโรงพยาบาล (append-only ห้ามลบก่อนครบกำหนด)
- Photo attachments (hold/decommission): เก็บคู่กับ record ที่อ้างอิงไปตลอดอายุ record นั้น

## Security & Compliance Baseline

- ยึด OWASP ASVS ระดับ L2 เป็นแนวปฏิบัติขั้นต่ำสำหรับ backend
- เนื่องจากข้อมูลเชื่อมโยงกับโรงพยาบาล/แผนก/พิกัด GPS ของเจ้าหน้าที่ (แม้ไม่ใช่ PII ผู้ป่วยโดยตรง) ให้ปฏิบัติตามแนวทาง **PDPA (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล)** สำหรับข้อมูลพนักงาน/ผู้ใช้งานระบบ: แจ้งวัตถุประสงค์การเก็บ GPS/รูปถ่าย, จำกัดการเข้าถึงตาม RBAC, มี retention policy ชัดเจนตามข้างต้น
