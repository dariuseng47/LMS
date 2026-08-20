# Testing & CI/CD

## Testing Strategy

### Backend (`server/`)
- **Unit test** (Jest/Vitest): business logic ล้วนๆ ที่แยก pure function ได้ — bundle-size check, wash-cycle threshold, par-level % calculation, RSSI threshold comparison, conflict-detection logic
- **Integration test** (Jest + Supertest + MySQL จริงใน Docker container สำหรับ test): ยิง request ผ่าน endpoint จริงเทียบผลใน DB — โดยเฉพาะ suite "tenant isolation" ที่บังคับตาม [multi-tenant-isolation.md](multi-tenant-isolation.md) (สร้าง 2 tenant, พยายามข้าม tenant ต้องโดนบล็อกเสมอ)
- **Socket.io contract test**: emit event ต้องมี shape ตรงตาม [api-spec.md](api-spec.md) และต้อง join ได้เฉพาะ room ของ tenant ตัวเอง
- Coverage เป้าหมาย: ≥ 70% รวม, **100% สำหรับ auth middleware และ scoped-query wrapper** (จุดที่พังแล้วกระทบความปลอดภัยข้าม tenant โดยตรง)

### Frontend Dashboard (`dashboard/`)
- Component test (React Testing Library) สำหรับ flow สำคัญ: login, ward replenishment two-pass scan, conflict approval queue
- E2E (Playwright) เฉพาะ golden path หลัก (login → ดู dashboard → approve conflict) ไม่ต้อง cover ทุกหน้า

### Mobile (`nativeapp/`)
- Unit test offline-queue logic (WatermelonDB write/sync) แยกจาก UI เพราะ hardware-dependent flow (camera, GPS, RFID) ทดสอบอัตโนมัติยาก
- Manual QA checklist ก่อน release แต่ละครั้ง สำหรับ flow ที่พึ่ง hardware จริง

## CI/CD Pipeline (แนะนำ GitHub Actions)

```
PR opened/updated:
  1. eslint (fail fast ถ้า raw query หลุด scopedQuery — ดู multi-tenant-isolation.md)
  2. unit tests (server + dashboard)
  3. integration tests (spin up MySQL container ชั่วคราว, รัน migration, รัน tenant-isolation suite)
  4. build check (dashboard, server)
  5. npm audit / dependency scan (informational ก่อน, ยกระดับเป็น blocking เมื่อ baseline นิ่งแล้ว)
  → ต้องผ่านทั้งหมดก่อน merge ได้

merge to main:
  1. rerun full test suite
  2. build Docker image (server), build production bundle (dashboard)
  3. deploy → staging อัตโนมัติ

release (manual trigger / tag):
  1. manual approval gate
  2. deploy → production
  3. run DB migration ผ่าน migration tool ที่ versioned ในโค้ด (เช่น Umzug + mysql2) ก่อน deploy โค้ดใหม่เสมอ
```

## Migration Safety

- Schema เปลี่ยนแปลงทุกครั้งต้องผ่าน migration file ที่ versioned ในโค้ด ห้ามแก้ schema ตรงบน production DB
- CI รัน migration ทุกตัวกับ throwaway MySQL container เพื่อ validate ว่า migration รันผ่านจริงก่อน merge (กัน migration พังตอน deploy จริง)
