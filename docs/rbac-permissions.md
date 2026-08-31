# RBAC / Permission Matrix

> **อัปเดต migration 028 (RBAC ยกเครื่อง — สิทธิ์ราย "เมนู" + hospital scopes)**
>
> ส่วนที่เปลี่ยนจากของเดิมด้านล่าง:
>
> 1. **Permission catalogue** — เปลี่ยนจาก 5 คีย์เชิง action เป็น **matrix ราย "เมนู"** ตาม
>    `server/src/config/menuCatalog.js` (source of truth เดียว) รูปแบบคีย์
>    `<channel>.<module>.<action>` โดย `channel ∈ {web, handheld}` (แยกกัน 100%),
>    `action ∈ {view, edit}` เช่น `web.devices.edit`, `handheld.ward.view`
> 2. **แอดมินดูแลได้หลายโรงพยาบาล** — ตาราง `user_hospital_scopes(user_id, hospital_id, can_edit)`
>    แทน `users.hospital_id` เดี่ยว (คอลัมน์ยังอยู่เป็น primary/ fallback) ทุก role รวม superadmin
>    ระบุโรงพยาบาลที่ทำงานอยู่ผ่าน `?hospitalId=` (เว็บ) / header `x-hospital-id` (nativeapp)
>    — ดู `server/src/utils/tenant.js` (`resolveTenantId`, `assertHospitalEditable`,
>    `assertTenantAccess`)
> 3. **handheld master switch** — `users.handheld_enabled` (คอลัมน์) : บัญชี login จากมือถือ
>    (`x-client-type: mobile`) ไม่ได้ถ้า = 0 (superadmin ข้ามเสมอ) — บังคับที่
>    `auth.controller.js#assertHandheldAllowed`
> 4. **แอดมินสร้างพนักงานได้ไหม** — `users.can_manage_subordinates` (คอลัมน์, superadmin ตั้ง)
> 5. **superadmin lock** — `user_permission_overrides.superadmin_locked` : override ที่ superadmin
>    ตั้ง แอดมินของโรงพยาบาลแก้/ลบทับไม่ได้ (superadmin แก้ = ตั้ง lock อัตโนมัติ)
> 6. **การบังคับใช้** — `requirePermission()` / `requireAnyPermission()` ที่ชั้น route
>    (`server/src/routes/*.routes.js`) + nav ทั้งเว็บ (`config-nav-dashboard.jsx`) และ nativeapp
>    (`AuthContext` + `PermissionGate`) gate ตาม effective permission
>
> กติกา delegation เดิม (ผู้มอบต้องมีสิทธิ์นั้น effective=true ก่อน, admin แตะ admin/superadmin
> ไม่ได้, operator เรียก endpoint สิทธิ์ไม่ได้) **ยังคงเดิม** และครอบคีย์เมนูใหม่ทั้งหมดด้วย
> `role_default_permissions` ใหม่: ADMIN = เต็มทุกเมนูในโรงพยาบาลตัวเอง, OPERATOR = งานหน้างาน
> (ดู migration 028 สำหรับรายการ)

## กติกาหลัก (ตามที่กำหนด)

- **superadmin** — ทำได้ทุกอย่างในระบบ ทุก tenant (รพ.) รวมถึง **เพิ่ม/ลบ/แก้ไข** บัญชี `admin` และ `operator` ได้ทั้งหมด
- **admin** — ทำได้เฉพาะสิ่งที่ superadmin เปิดสิทธิ์ให้ (scope เดียวคือ `hospital_id` ของตัวเอง), **เพิ่ม/ลบ/แก้ไข admin คนอื่นไม่ได้**, แต่ **เพิ่ม/ลบ/แก้ไข operator** ในโรงพยาบาลตัวเองได้
- **operator** — ทำได้เฉพาะสิ่งที่ admin เปิดสิทธิ์ให้, **แก้ไข/ลบ admin ไม่ได้**, และไม่มีสิทธิ์จัดการบัญชีผู้ใช้อื่นเลย (เป็น front-line staff ที่ใช้งาน scan/operation เป็นหลัก)

กติกานี้เป็น **cascading delegation**: บทบาทที่สูงกว่าเป็นผู้กำหนด "เพดานสิทธิ์" ให้บทบาทที่ต่ำกว่า และ **ผู้มอบสิทธิ์ไม่สามารถมอบสิทธิ์ที่ตัวเองไม่มีให้ผู้อื่นได้** (no privilege escalation ผ่านการ delegate)

## Data Model รองรับ Delegation

```sql
CREATE TABLE permissions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  perm_key      VARCHAR(100) NOT NULL UNIQUE,   -- เช่น 'fabric.lot.create', 'device.config.update'
  category      VARCHAR(100) NOT NULL,
  description   VARCHAR(255)
);

CREATE TABLE role_default_permissions (        -- สิทธิ์เริ่มต้นตาม role (baseline)
  role          ENUM('ADMIN','OPERATOR') NOT NULL,
  perm_key      VARCHAR(100) NOT NULL,
  PRIMARY KEY (role, perm_key)
);

CREATE TABLE user_permission_overrides (       -- สิทธิ์ที่ "ผู้ดูแลระดับบน" ปรับให้ user รายคน
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,       -- ผู้ถูกปรับสิทธิ์ (admin หรือ operator)
  perm_key      VARCHAR(100) NOT NULL,
  effect        ENUM('GRANT','DENY') NOT NULL,
  granted_by    BIGINT UNSIGNED NOT NULL,       -- ต้องเป็นบทบาทสูงกว่า user_id หนึ่งขั้น
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (granted_by) REFERENCES users(id),
  UNIQUE KEY uq_user_perm (user_id, perm_key)
);
```

**Effective permission ของ user คำนวณจาก:**
```
effective(user, perm_key) =
  if role == SUPERADMIN: true (ทุก perm)
  else if user_permission_overrides มี record: ใช้ effect นั้น (GRANT/DENY ชนะ default)
  else: ใช้ role_default_permissions ของ role นั้น
```

**กฎ enforcement ตอน grant (บังคับที่ backend service ชั้น auth ไม่ใช่แค่ validate ที่ UI):**
1. `superadmin` แก้ `user_permission_overrides` ให้ user role `ADMIN` ได้ทุก `perm_key` ที่มีอยู่จริง
2. `admin` แก้ `user_permission_overrides` ให้ user role `OPERATOR` ได้ **เฉพาะ `perm_key` ที่ตัวเอง (admin) มีสิทธิ์ effective = true อยู่แล้ว** — ป้องกันไม่ให้ admin มอบสิทธิ์ที่ตัวเองไม่มี
3. ห้าม `admin` แก้ record ของ user role `ADMIN`/`SUPERADMIN` เด็ดขาด (reject ที่ middleware ก่อนถึง service layer)
4. ห้าม `operator` เรียก endpoint จัดการสิทธิ์ใดๆ ทั้งสิ้น

## Permission Matrix ตามเมนูระบบ (อ้างอิง PROMPT_MASTER.md)

| โมดูล | Action | superadmin | admin (default) | operator (default) |
|---|---|:---:|:---:|:---:|
| **1. HQ Super Admin** (Super Dashboard, Hospital Mgmt, Inter-Hospital Transfer, Global Config) | ทั้งหมด | ✅ | ❌ (มองไม่เห็นเมนูนี้เลย) | ❌ |
| **2. Hospital Dashboard** | View (เฉพาะ tenant ตัวเอง) | ✅ (ทุก tenant) | ✅ | ✅ (view only) |
| **2b. แดชบอร์ดโปรไฟล์โรงพยาบาล** (`/dashboard/hospital-profile` — แยกจาก HQ โดยตั้งใจ ไม่ใช่หน้าเดียวกับข้อ 1 แม้เนื้อหาคล้ายกัน) | View (เฉพาะ tenant ตัวเอง) | ✅ (ทุก tenant ผ่านตัวเลือกโรงพยาบาล) | ⚙️ ต้อง superadmin เปิดสิทธิ์ (default: เปิด) | ⚙️ ต้อง admin เปิดสิทธิ์ (default: ปิด) |
| **3. Fabric & Lot Management** — Register/Import Lot | Create | ✅ | ✅ | ⚙️ ต้อง admin เปิดสิทธิ์ (default: ปิด) |
| — Fabric Inventory | Read | ✅ | ✅ | ✅ |
| — Hold & Decommission | Create/Update | ✅ | ✅ | ⚙️ ต้อง admin เปิดสิทธิ์ (default: เปิด เพราะเกิดหน้างานบ่อย) |
| — Decommissioned Logs | Read | ✅ | ✅ | ✅ (view only) |
| **4. Operations & Tracking** — Process Status Monitor | Read | ✅ | ✅ | ✅ |
| — Ward Dispatch & Receive (สแกนจริง) | Create | ✅ | ✅ | ✅ (นี่คืองานหลักของ operator) |
| — Location Search | Read | ✅ | ✅ | ✅ |
| **5. Device & Signal Management** — Reader/Cabinet Config, RSSI Tuning | Create/Update | ✅ | ✅ | ❌ default (แก้ config อุปกรณ์เสี่ยงกระทบระบบ) |
| — Device Caretaker info | Read/Update | ✅ | ✅ | ⚙️ ต้อง admin เปิดสิทธิ์ (แจ้งเบอร์คนซ่อม) |
| **6. Security & Settings** — User Mgmt: จัดการ admin | Create/Update/Delete | ✅ | ❌ (ตายตัว, override ไม่ได้) | ❌ |
| — User Mgmt: จัดการ operator | Create/Update/Delete | ✅ | ✅ | ❌ (ตายตัว) |
| — Status Timeout Settings | Update | ✅ | ✅ | ❌ default |
| — Security Audit Logs | Read | ✅ (ทุก tenant) | ✅ (เฉพาะ tenant ตัวเอง, read-only) | ❌ |
| — Inter-Hospital Transfer approve | Approve | ✅ | ⚙️ เฉพาะ admin ที่ superadmin ระบุชื่อไว้ (cross-tenant action ต้องมี allow-list) | ❌ |

**หมายเหตุ:**
- ช่อง `⚙️` = เป็น permission ที่ configure ได้ผ่าน `user_permission_overrides` (ตาม delegation rule ด้านบน) ค่าที่เขียนไว้คือค่า default เริ่มต้นเมื่อสร้างบัญชีใหม่ — permission key ของแถว 2b คือ `dashboard.hospital_profile.view` (ดู `server/src/utils/permissions.js`)
- ช่อง `❌` แบบตายตัว (จัดการ admin โดย admin, จัดการ operator โดย operator, มองเมนู HQ โดยไม่ใช่ superadmin) คือ **hard-coded rule ในโค้ด ไม่ผ่าน permission table** และห้าม override เด็ดขาด เพราะเป็น security boundary ของระบบ ไม่ใช่ business preference

## JWT Claims ที่ต้องมี

```json
{
  "sub": "user_id",
  "role": "ADMIN",
  "hospital_id": 12,
  "perm_version": 7
}
```

`perm_version` = เลข version ที่ increment ทุกครั้งที่มีการแก้ `user_permission_overrides` ของ user นั้น ใช้เทียบกับค่าที่ cache ไว้ฝั่ง client เพื่อรู้ว่าต้อง refresh permission set ใหม่ (กัน stale permission หลังโดนลดสิทธิ์กะทันหัน)
