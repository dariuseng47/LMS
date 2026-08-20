# Multi-Tenant Isolation Strategy

## Tenant Boundary

`hospital_id` คือ tenant boundary ของระบบทั้งหมด (ดูเหตุผลใน [data-model.md](data-model.md)) MySQL ไม่มี native Row-Level Security แบบ Postgres จึงต้องบังคับ isolation ที่ **application layer เป็นหลัก + safety net หลายชั้น** ดังนี้

## ชั้นที่ 1 — JWT เป็นแหล่งความจริงเดียวของ tenant_id

- `hospital_id` มาจาก JWT claim เท่านั้น **ห้ามรับ `hospital_id`/`tenant_id` จาก request body, query string, หรือ route param ของฝั่ง client โดยเด็ดขาด** (ถ้ามีการส่งมาให้ backend เพิกเฉยหรือ reject)
- `superadmin` มี `hospital_id: null` ในโทเคน = สิทธิ์มองข้าม tenant ได้ แต่ต้องระบุ `hospital_id` explicit ในทุก query (ไม่มี "default = all" แบบเงียบๆ) เพื่อบังคับให้ developer ตั้งใจเขียน cross-tenant query จริงๆ ไม่ใช่ query หลุด filter มาโดยไม่ตั้งใจ

## ชั้นที่ 2 — Scoped Query Wrapper (บังคับที่ data-access layer)

แทนที่จะเรียก `mysql2/promise` ตรงๆ ในทุก controller ให้บังคับผ่าน wrapper กลาง:

```js
// db/scopedQuery.js
export function scopedQuery(pool, tenantId) {
  return {
    async select(table, where = {}) {
      // บังคับ inject hospital_id = tenantId เข้า WHERE ทุกครั้ง
      // throw error ทันทีถ้า table ที่เรียกอยู่ใน TENANT_SCOPED_TABLES แต่ tenantId เป็น undefined
    },
  };
}
```

- Controller **ห้าม** เขียน raw SQL เข้าตารางที่ tenant-scoped โดยตรง ต้องผ่าน `scopedQuery(pool, req.auth.hospitalId)` เสมอ
- Whitelist ตารางที่ tenant-scoped ไว้ใน `TENANT_SCOPED_TABLES` (fabric_items, fabric_lots, devices, scan_logs, cabinets, departments, users, audit_logs, ...) — ถ้า query ตารางกลุ่มนี้โดยไม่มี tenantId ให้ throw ทันที ไม่ silent fail

## ชั้นที่ 3 — CI Lint Rule (safety net ระดับโค้ด)

- เขียน ESLint custom rule หรือ grep-based CI check: หา raw `pool.query(...)` / `pool.execute(...)` ที่เรียกตารางใน `TENANT_SCOPED_TABLES` โดยไม่ผ่าน `scopedQuery` แล้ว fail CI — ป้องกัน dev ลืม/หลีกเลี่ยง wrapper

## ชั้นที่ 4 — Cross-tenant Write ที่ถูกกฎหมาย (Inter-Hospital Transfer)

Inter-Hospital Transfer เป็น cross-tenant write เดียวที่ระบบอนุญาต — ต้อง:
1. เดินผ่าน endpoint เฉพาะ `POST /api/v1/transfers` เท่านั้น (ห้ามมี path อื่นแก้ `hospital_id` ของ `fabric_items` ได้)
2. ต้องมี role `SUPERADMIN` หรือ `ADMIN` ที่อยู่ใน allow-list ของทั้ง `from_hospital_id` และ `to_hospital_id` (ดู [rbac-permissions.md](rbac-permissions.md))
3. เขียน record ลง `transfer_records` แบบ append-only พร้อม `approved_by` และยิง `audit_logs` ทุกครั้ง — ไม่มีทางแก้ `hospital_id` แบบเงียบๆ ได้

## ชั้นที่ 5 — Audit ทุกการเข้าถึงข้าม tenant ของ superadmin

- เมื่อ `superadmin` เรียก endpoint ที่ query ข้าม `hospital_id` มากกว่า 1 tenant (เช่น Super Dashboard, Global Config) ให้บันทึก `audit_logs` แบบ `action = 'CROSS_TENANT_READ'` พร้อม tenant ids ที่เข้าถึง — เพื่อ accountability เนื่องจากข้อมูลเกี่ยวข้องกับโรงพยาบาลที่อาจอิงกับข้อมูลผู้ป่วยทางอ้อม (เช่น แผนก/วอร์ด)

## ชั้นที่ 6 — Test Coverage บังคับ

- Integration test ต้องมี suite เฉพาะ "tenant isolation": สร้าง 2 tenant จำลอง, login เป็น admin ของ tenant A, ยิง request พยายามอ่าน/แก้ข้อมูลของ tenant B ผ่านทุก endpoint ที่มี → ต้อง assert ว่าได้ `403`/`404` เสมอ (ดู [testing-cicd.md](testing-cicd.md)) รันเป็นส่วนหนึ่งของ required check ก่อน merge
