# RBAC / Permission Matrix

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
- ช่อง `⚙️` = เป็น permission ที่ configure ได้ผ่าน `user_permission_overrides` (ตาม delegation rule ด้านบน) ค่าที่เขียนไว้คือค่า default เริ่มต้นเมื่อสร้างบัญชีใหม่
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
