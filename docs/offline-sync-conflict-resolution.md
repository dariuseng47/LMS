# Offline Sync Conflict Resolution — Approval Queue

## หลักการ

ไม่ auto-merge/auto-resolve ข้อมูลที่ขัดแย้งกัน — เมื่อ sync แล้วเจอ conflict ให้ **เก็บทั้งสองก้อนไว้รอ**, แจ้งเตือนไปที่ dashboard, และให้ผู้มีสิทธิ์ (admin ขึ้นไป) เป็นคนกด **Approve** เลือกว่าจะใช้ก้อนไหน

## Conflict คืออะไร (นิยามให้ชัดเพื่อ detect ได้จริง)

เกิด conflict เมื่อ batch จาก `/sync/batch` มี scan event ของ `epc_code` เดียวกัน ที่:
- ผลลัพธ์ status ปลายทางต่างกัน (เช่น เครื่อง A บอกว่าเข้า `HOLD` เครื่อง B บอกว่าเข้า `WARD_CABINET`) **หรือ**
- ตำแหน่ง/เวลาต่างกันในช่วงเวลาที่เป็นไปไม่ได้ทางกายภาพ (สแกนที่ตู้แผนก A และตู้แผนก B ห่างกันไม่ถึง 2 นาที) **หรือ**
- ทั้งสอง event นี้ **ยังไม่ถูก apply เข้า `fabric_items.status` จริง** (คือแข่งกันมาถึง server พร้อมกันตอน sync ไม่ใช่กรณีที่มี canonical state อยู่แล้วและอันหนึ่งแค่ "เก่ากว่า" — กรณีนั้นให้ใช้ last-write-wins ตาม `scanned_at` ได้เลยโดยไม่ต้องเข้าคิว approve)

## Data Model

```sql
CREATE TABLE sync_conflicts (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id       BIGINT UNSIGNED NOT NULL,
  fabric_item_id    BIGINT UNSIGNED NOT NULL,
  candidate_a_scan_log_id BIGINT UNSIGNED NOT NULL,
  candidate_b_scan_log_id BIGINT UNSIGNED NOT NULL,
  status            ENUM('PENDING','RESOLVED') NOT NULL DEFAULT 'PENDING',
  resolved_scan_log_id BIGINT UNSIGNED NULL,      -- record ที่ถูกเลือก
  resolved_by       BIGINT UNSIGNED NULL,
  resolved_at       DATETIME NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (fabric_item_id) REFERENCES fabric_items(id),
  FOREIGN KEY (candidate_a_scan_log_id) REFERENCES scan_logs(id),
  FOREIGN KEY (candidate_b_scan_log_id) REFERENCES scan_logs(id),
  FOREIGN KEY (resolved_scan_log_id) REFERENCES scan_logs(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);
```

`scan_logs` ทั้งสองฝั่งถูก insert ตามปกติ (พร้อม `synced_from_offline = true`) แต่ **ยังไม่ apply ผลไปที่ `fabric_items.status`** จนกว่าจะ resolve

## Flow

```
[Mobile A offline scan] ──┐
                           ├──► POST /sync/batch ──► ตรวจพบ conflict ──► INSERT sync_conflicts (PENDING)
[Mobile B offline scan] ──┘                                              │
                                                                          ├──► emit Socket.io: sync:conflict_detected → dashboard (room hospital:<id>)
                                                                          └──► push notification ไปที่ admin (LINE Notify/email ตาม non-functional-requirements.md)

Dashboard แสดง Conflict Queue:
┌─────────────────────────────────────────────┐
│ EPC: TAG-00123                               │
│ ┌─ Candidate A ──────┐  ┌─ Candidate B ─────┐│
│ │ Device: Mobile-07   │  │ Device: Mobile-12 ││
│ │ User: สมชาย         │  │ User: สมหญิง      ││
│ │ Time: 09:12:03      │  │ Time: 09:13:40    ││
│ │ Target: HOLD         │  │ Target: WARD_CAB  ││
│ │ [Approve]            │  │ [Approve]          ││
│ └──────────────────────┘  └────────────────────┘│
└─────────────────────────────────────────────┘

Admin กด Approve ที่ก้อนใดก้อนหนึ่ง
  → POST /sync/conflicts/:id/approve { chosen: 'A' | 'B' }
  → apply candidate ที่เลือกเข้า fabric_items.status จริง (ผ่าน service เดียวกับ scan ingestion ปกติ)
  → candidate ที่ไม่ถูกเลือก: scan_logs เดิม "คงอยู่" เพื่อ audit แต่ทำเครื่องหมาย superseded (ไม่ลบ)
  → sync_conflicts.status = RESOLVED, resolved_by, resolved_at
  → emit Socket.io: sync:conflict_resolved
```

## กติกาเพิ่มเติม

- Batch อื่นที่ไม่ conflict (กรณีส่วนใหญ่) sync อัตโนมัติทันที ไม่ต้องรอ approve — approval queue มีไว้เฉพาะกรณีชนกันจริงเท่านั้น เพื่อไม่ให้กลายเป็นคอขวดของงานประจำวัน
- ถ้า conflict ค้างเกิน X ชั่วโมงไม่มีคน approve → ยกระดับ alert (escalate) เพราะ `fabric_items.status` ของชิ้นนั้นจะค้างไม่ update จนกว่าจะ resolve
- `scan_logs` ที่แพ้ (ไม่ถูกเลือก) ยังคง query ได้เสมอผ่าน `sync_conflicts.candidate_*` เพื่อตรวจสอบย้อนหลังว่าใครสแกนอะไรตอนไหน — สอดคล้องกับหลัก audit-log แบบ append-only
