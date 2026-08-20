# 🧺 Multi-Tenant IoT RFID Laundry Management System

## Tech Stack Summary

- **Frontend (Web):** React + MUI React Template + Socket.io Client (Real-time updates) — โฟลเดอร์ [`dashboard`](dashboard)
- **Frontend (Mobile):** React Native (Expo) + WatermelonDB/SQLite (Offline Sync Queue) + Camera + GPS Location — โฟลเดอร์ [`nativeapp`](nativeapp)
- **Backend:** Node.js (Express.js, Pure JS ES Modules) + Socket.io Server + Zod Validation + Helmet/Rate-Limit/JWT — โฟลเดอร์ [`server`](server)
- **Database:** MySQL 8.0 (Multi-Tenant Architecture) + Parameterized Queries
- **Edge Devices:** Raspberry Pi 4 (Weight Scale Integration + Multi-Antenna RFID Readers + Local Debounce)

## เอกสารประกอบ

| ไฟล์ | เนื้อหา |
|---|---|
| [PROMPT_MASTER.md](PROMPT_MASTER.md) | โครงสร้างเมนู/IA ทั้งหมดของระบบ |
| [Advanced_Feature_Details&Rules.md](Advanced_Feature_Details&Rules.md) | Business rule เชิงลึก + Flow การทำงานของระบบ |
| [Principal_Software_Security_Engineer.md](Principal_Software_Security_Engineer.md) | Prompt สำหรับ generate โค้ด security boilerplate |
| [Master_Prompt_for_AI_Code.md](Master_Prompt_for_AI_Code.md) | Prompt สำหรับ generate โค้ด business logic |

## Architecture & Design Docs (`docs/`)

| ไฟล์ | เนื้อหา |
|---|---|
| [docs/data-model.md](docs/data-model.md) | ER Diagram + DDL เริ่มต้นของ MySQL schema |
| [docs/rbac-permissions.md](docs/rbac-permissions.md) | Role matrix (superadmin/admin/operator) + cascading delegation model |
| [docs/multi-tenant-isolation.md](docs/multi-tenant-isolation.md) | กลยุทธ์แยกข้อมูลข้ามโรงพยาบาล (tenant) |
| [docs/api-spec.md](docs/api-spec.md) | REST API + Socket.io event spec |
| [docs/offline-sync-conflict-resolution.md](docs/offline-sync-conflict-resolution.md) | Approval queue สำหรับ conflict ตอน sync ข้อมูลออฟไลน์ |
| [docs/non-functional-requirements.md](docs/non-functional-requirements.md) | Performance, scale, backup/DR, data retention, compliance |
| [docs/device-network-failure-handling.md](docs/device-network-failure-handling.md) | Heartbeat monitoring + edge resilience เมื่ออุปกรณ์/เน็ตหลุด |
| [docs/testing-cicd.md](docs/testing-cicd.md) | แนวทาง testing + CI/CD pipeline |

> **ยังไม่ทำ:** Edge-to-Cloud Protocol (โปรโตคอลเชื่อมต่อ Raspberry Pi กับ backend) — รอออกแบบภายหลังตามที่ตกลงกัน
