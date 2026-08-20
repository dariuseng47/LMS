# API Spec (REST, `/api/v1`)

> รูปแบบ endpoint อิงตามโครงสร้างเมนู [PROMPT_MASTER.md](../PROMPT_MASTER.md) และ business rule ใน [Advanced_Feature_Details&Rules.md](../Advanced_Feature_Details&Rules.md) ทุก endpoint ที่ไม่ใช่ `auth/*` ต้องมี `Authorization: Bearer <access_token>` และผ่าน tenant isolation ตาม [multi-tenant-isolation.md](multi-tenant-isolation.md) เสมอ Role ที่ระบุคือ default ตาม [rbac-permissions.md](rbac-permissions.md) — `⚙️` หมายถึงต้องผ่าน permission check เพิ่มเติมจาก `user_permission_overrides`

## Auth

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| POST | `/auth/login` | public | rate-limit 5 req/15m |
| POST | `/auth/refresh` | public (ต้องมี refresh token ที่ valid) | rotate token |
| POST | `/auth/logout` | authenticated | revoke refresh token |
| GET | `/auth/me` | authenticated | ข้อมูล user + effective permissions |

## Hospitals & Org (HQ Super Admin)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/organizations` | superadmin | รายชื่อกลุ่ม/ภาค |
| GET | `/hospitals` | superadmin | รายชื่อ รพ. ทั้งหมด |
| POST | `/hospitals` | superadmin | เพิ่ม รพ. ใหม่ (สร้าง tenant) |
| PATCH | `/hospitals/:id` | superadmin | แก้ไขข้อมูล/โควตา รพ. |
| GET | `/hospitals/:id/dashboard-summary` | superadmin, admin(own) | ภาพรวมสถิติ |

## Users (Security & Settings)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/users` | superadmin, admin(own tenant) | list ตาม scope |
| POST | `/users` | superadmin (role=ADMIN\|OPERATOR ใดก็ได้), admin (role=OPERATOR เท่านั้น) | สร้างบัญชี |
| PATCH | `/users/:id` | ตาม delegation rule ใน rbac-permissions.md | แก้ไขบัญชี |
| DELETE | `/users/:id` | ตาม delegation rule | soft-delete บัญชี |
| PUT | `/users/:id/permissions` | superadmin→admin, admin→operator เท่านั้น | ตั้งค่า `user_permission_overrides` |

## Fabric & Lot Management

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/fabric-items` | all | list + filter (status, category, EPC) |
| POST | `/fabric-items` | admin, operator⚙️ | ลงทะเบียนผ้ารายชิ้น |
| POST | `/fabric-lots` | admin, operator⚙️ | เพิ่มยกล็อต |
| GET | `/fabric-items/:epc` | all | ดูรายละเอียด + ประวัติสแกน |
| POST | `/fabric-items/:id/hold` | admin, operator⚙️ | พักผ้า (reason + photo) |
| POST | `/fabric-items/:id/decommission` | admin, operator⚙️ | แทงชำรุด |
| GET | `/fabric-items/:id/wash-history` | all | ประวัติรอบซัก |

## Operations & Tracking

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| POST | `/scans/weight-gate` | device token, operator | บันทึก weight_kg + RFID 3 จุด, ตรวจ STEP_SKIPPED |
| POST | `/scans/bundle-check` | device token, operator | ตรวจนับมัด + RSSI |
| POST | `/scans/ward-issue` | operator | สแกนครั้งที่ 1 (อ่านของค้างตู้) |
| POST | `/scans/ward-receive` | operator | สแกนครั้งที่ 2 (ย้ายเข้าตู้) |
| GET | `/tracking/location/:epc` | all | ค้นหาพิกัดล่าสุดจาก EPC |
| GET | `/tracking/process-status` | all | Real-time monitor (initial load; ต่อจากนี้รับผ่าน Socket.io) |

## Device & Signal Management

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/devices` | admin, operator(read) | list อุปกรณ์ + สถานะ online/offline |
| POST | `/devices` | admin | เพิ่มอุปกรณ์ |
| PATCH | `/devices/:id` | admin | แก้ config, RSSI threshold, caretaker |
| POST | `/devices/:id/heartbeat` | device token (ไม่ใช่ user) | Edge agent ping (ดู [device-network-failure-handling.md](device-network-failure-handling.md)) |

## Inter-Hospital Transfer

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| POST | `/transfers` | superadmin, admin(allow-listed) | ย้าย tenant ของ fabric_item |
| GET | `/transfers` | superadmin, admin(own) | ประวัติการโอนย้าย |

## Sync & Conflict Resolution (Mobile Offline)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| POST | `/sync/batch` | operator (mobile) | อัปโหลด scan events ที่ค้างจากออฟไลน์เป็น batch |
| GET | `/sync/conflicts` | admin | รายการ conflict ที่รอ approve |
| POST | `/sync/conflicts/:id/approve` | admin | เลือก record ที่ถูกต้อง (ดู [offline-sync-conflict-resolution.md](offline-sync-conflict-resolution.md)) |

## Alerts & Audit

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/alerts` | all | รายการแจ้งเตือน (par level, stagnant, timeout, weak signal, device offline) |
| GET | `/audit-logs` | superadmin, admin(own, read-only) | ประวัติการใช้งาน append-only |

## Real-time (Socket.io, ไม่ใช่ REST)

| Event | Direction | Payload | ใครฟัง |
|---|---|---|---|
| `scan:created` | server→client | fabric_item + scan_log | dashboard ทุกเครื่องใน tenant เดียวกัน (join room `hospital:<id>`) |
| `alert:triggered` | server→client | alert type + entity | dashboard |
| `sync:conflict_detected` | server→client | conflict record | dashboard (admin) |
| `device:status_changed` | server→client | device_id + status | dashboard |

Socket.io connection ต้อง join room ตาม `hospital_id` จาก JWT เท่านั้น (ห้าม client เลือก room เอง) เพื่อคง tenant isolation ในชั้น real-time ด้วย
