# 🧺 Master System Architecture & Security Blueprint

> **System:** Multi-Tenant IoT RFID Laundry Management System  
> **Tech Stack:** React (Web), React Native (Expo), Node.js Express (Pure JS ES Modules), MySQL, Raspberry Pi 4 (Edge)  
> **Security Standard:** OWASP Top 10 & Defense-in-Depth Architecture

---

## 1. System Menu Structure (โครงสร้างเมนูทั้งหมด)

```text
[ MAIN SYSTEM MENU STRUCTURE ]
│
├── 🏢 1. HQ Super Admin (ภาพรวมประเทศ/ระดับกลุ่ม)
│   ├── 📊 Super Dashboard (ทรัพย์สิน & สถิติจังหวัด/ภาค)
│   ├── 🏥 Hospital Management (จัดการรายชื่อ รพ. & โควตา)
│   ├── 🔄 Inter-Hospital Transfer (ศูนย์โอนย้ายผ้าข้าม รพ.)
│   └── ⚙️ Global System Config (ตั้งค่ามาตรฐานกลาง)
│
├── 📊 2. Hospital Dashboard (แดชบอร์ดประจำ รพ.)
│   ├── 📈 Operational Overview (สถานะหมุนเวียน Real-time)
│   ├── ⚠️ Alert & Exceptions (แจ้งเตือนผ้าตกค้าง/ชำรุด/หาย)
│   └── 🧺 Wash & Asset Analytics (วิเคราะห์รอบซัก/อายุใช้งาน)
│
├── 🏷️ 3. Fabric & Lot Management (จัดการผ้าและล็อต)
│   ├── ➕ Register Fabric / Lot (เพิ่มรายชิ้น & บันทึกยกล็อต)
│   ├── 📋 Fabric Inventory (คลังผ้าทั้งหมด & สถานะปัจจุบัน)
│   ├── ⏸️ Hold & Damaged List (รายการผ้าพักใช้งาน & แทงชำรุด)
│   └── 🗑️ Decommissioned Logs (ประวัติผ้าจำหน่ายออกจากระบบ)
│
├── 📍 4. Operations & Tracking (การปฏิบัติงาน & ติดตาม)
│   ├── 🔄 Process Status Monitor (ติดตามผ้าผ่านจุดสแกน 1-3)
│   ├── 🚚 Ward Dispatch & Receive (รับ-ส่งผ้าตามวอร์ด)
│   └── 🔍 Location Search (ค้นหาพิกัดผ้าจาก EPC)
│
├── 📡 5. Device & Signal Management (จัดการอุปกรณ์ RFID)
│   ├── 📟 Reader & Cabinet Config (แอดตู้/คีออส/Handheld)
│   ├── 📶 RSSI Signal Tuning (ตั้งค่าความแรงสัญญาณขั้นต่ำ)
│   └── 👤 Device Caretaker (รายชื่อผู้ดูแล & เบอร์โทรประจำเครื่อง)
│
└── 🔒 6. Security & System Settings (ความปลอดภัย & ตั้งค่า)
    ├── 👥 User & Role Management (จัดการผู้ใช้งาน & สิทธิ์)
    ├── ⏱️ Status Timeout Settings (ตั้งค่าเวลาค้างแต่ละสถานะ)
    └── 📜 Security Audit Logs (ประวัติการใช้งานแบบคุมแก้ไขไม่ได้)
```
