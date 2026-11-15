# LMS Server

Backend API — Node.js (Express, Pure JS ES Modules) สำหรับ Multi-Tenant IoT RFID Laundry Management System

## เริ่มต้นใช้งาน

```sh
cd server
npm install
```

### 1. ตั้งค่าฐานข้อมูล

กรอกข้อมูล MySQL ของคุณในไฟล์ `server/.env` (ส่วน `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — ค่าอื่นตั้งไว้ให้พร้อมใช้แล้ว รวมถึง JWT secret ที่สุ่มไว้ให้)

สร้างตารางทั้งหมด:

```sh
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS laundry_db"
mysql -u root -p laundry_db < db/schema.sql
```

(ทางเลือก) สร้าง DB user สิทธิ์ต่ำสุดสำหรับ backend แทนการใช้ root — ดู `db/init_security.sql` แล้วนำ user/password ที่สร้างไปกรอกใน `.env`

### 2. สร้างบัญชี superadmin คนแรก

```sh
npm run create-superadmin
```

### 3. รัน dev server

```sh
npm run dev
```

Server จะรันที่ `http://localhost:4000` (เปลี่ยนได้ที่ `PORT` ใน `.env`) — ทดสอบด้วย `curl http://localhost:4000/health`

## โครงสร้างโปรเจกต์

```
src/
  config/env.js         โหลด + validate ตัวแปรจาก .env ด้วย zod
  db/pool.js             mysql2/promise connection pool
  db/scopedQuery.js       tenant isolation wrapper (docs/multi-tenant-isolation.md)
  middleware/             helmet, cors, rate-limit, auth, validate, error handler
  controllers/            business logic ต่อ endpoint
  routes/                 mount route ตาม docs/api-spec.md
  schemas/                zod schema สำหรับ validateRequest
  sockets/                Socket.io + tenant room join
  utils/                  AppError, asyncHandler, JWT helper
db/
  schema.sql              DDL ตั้งต้นทั้งหมด (รวมจาก docs/data-model.md ฯลฯ)
  init_security.sql       สร้าง DB user สิทธิ์ต่ำสุด
scripts/
  create-superadmin.js    bootstrap บัญชี superadmin คนแรก
```

ปัจจุบันมีเฉพาะ `auth` routes (login/refresh/logout/me) ครบตาม spec — ส่วน endpoint อื่นตาม `docs/api-spec.md` (fabric-items, scans, devices, transfers, sync, alerts) ยังไม่ได้ implement รอทำต่อ

## Production บน Plesk — ตั้งค่าที่เกี่ยวกับความเร็ว/cache

server มี in-memory cache ของ "บริบทสิทธิ์" (สถานะบัญชี, scope โรงพยาบาล, สิทธิ์) ใน `src/utils/authCache.js`
— ล้างทันทีทุกจุดที่แก้ข้อมูลกลุ่มนี้ มี TTL 30–60 วิ เป็นตาข่ายกันพลาด **ไม่ cache ข้อมูลผ้า** (สถานะ/ตำแหน่ง
เปลี่ยนทุกครั้งที่สแกนผ่านจุดต่าง ๆ) ฝั่งแอป handheld cache เฉพาะ "ลงทะเบียนแล้ว/ประเภทผ้า" (5 นาที) และค้นสถานะสดเสมอ

ตั้งที่ Plesk → โดเมน `api.welcleankhoka.com` → **Apache & nginx Settings → Additional nginx directives**:

```nginx
# ให้ Node (Passenger) มี process ค้างไว้อย่างน้อย 1 ตัวเสมอ — ไม่โดนปิดตอนว่างแล้วเปิดใหม่ช้า (cold start)
passenger_min_instances 1;

# บีบอัด JSON (ผล lookup 200 แท็ก ~50KB → ~6KB) ช่วยมากบน Wi-Fi/4G ในโรงพยาบาล
gzip on;
gzip_proxied any;
gzip_min_length 1024;
gzip_types application/json text/plain;
```

ข้อควรระวัง:

- **ห้ามเปิด nginx caching / proxy cache ให้ `/api`** (ใน Plesk ช่อง "Caching" ของ nginx ให้ปิดไว้) — response เป็นข้อมูล
  ต่อผู้ใช้/ต่อโรงพยาบาล และเปลี่ยนทุกครั้งที่สแกน ถ้า cache ที่ชั้นนี้จะได้สถานะผ้าเก่า หรือเห็นข้อมูลข้ามโรงพยาบาล
- **ต้องรันเป็น 1 process** — ทั้ง socket.io (ห้องตามโรงพยาบาล) และ authCache อยู่ใน memory ของ process เดียว
  เช็คด้วย SSH: `passenger-status` ถ้าเห็นแอปนี้มีหลาย process ให้ผู้ดูแลเครื่องตั้ง `passenger_max_instances_per_app 1;`
  ระดับ http (ไฟล์ config ของ nginx ฝั่ง server ไม่ใช่ช่อง Additional directives) — ถ้ายังหลาย process การปิดบัญชี/แก้สิทธิ์
  จะมีผลกับ process อื่นช้าสุด 30–60 วิ และ event real-time บางส่วนจะไม่ถึงบางเครื่อง
- **ระยะ DB**: ทุก query = 1 รอบเครือข่ายไป MySQL ถ้า Node กับ MySQL อยู่คนละเครื่อง/คนละ data center จะช้าตามระยะ
  วัดได้จาก SSH บนเครื่อง Plesk: `mysql -h <DB_HOST> -e "SELECT 1"` หลายครั้ง (ควร < 5ms ถ้าอยู่ network เดียวกัน)
- dashboard (static `out/`) ตั้ง cache header ไว้แล้วใน `dashboard/public/.htaccess` ไม่ต้องตั้งเพิ่ม
