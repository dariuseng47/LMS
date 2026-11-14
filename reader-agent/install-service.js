// ติดตั้งเป็น Windows Service — รันเองทุกครั้งที่เปิด/รีสตาร์ทเครื่อง (ไม่ต้องล็อกอิน) และรีสตาร์ทเองเมื่อล่ม
// ต้องรันแบบ "Run as administrator": คลิกขวา install-service.bat (หรือ npm run install-service)
//
// กันล่ม 2 ชั้น:
//   ชั้น 1 (node-windows wrapper): agent.js ล่ม -> เปิดใหม่ใน 3 วิ ไม่จำกัดครั้ง
//   ชั้น 2 (Windows Service Recovery): ถ้าตัว service เองหยุดแบบผิดปกติ (wrapper ตาย / ล่มรัวเกิน
//           10 ครั้งใน 60 วิ แล้ว wrapper ยอมแพ้) -> Windows สั่ง start service ใหม่ให้อีกที
// รันซ้ำได้ — ถ้าติดตั้งไว้แล้วจะแค่ตั้งค่า recovery ใหม่ แล้ว start ให้
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import nodeWindows from 'node-windows';

const DIR = path.dirname(fileURLToPath(import.meta.url));

const svc = new nodeWindows.Service({
  name: 'LMS Reader Agent',
  description: 'LMS - bridge RFID readers (SID) in LAN to the cloud server',
  script: path.join(DIR, 'agent.js'),
  workingDirectory: DIR,
  // ชั้น 1: รอ 3 วิทุกครั้ง (grow: 0) — ค่า default ของ node-windows ให้เวลารอโตขึ้นทุกครั้งที่ล่ม
  // และไม่รีเซ็ตกลับ ถ้าล่มบ่อยๆ สะสมนานๆ จะรอเป็นชั่วโมงก่อนเปิดใหม่ | maxRestarts = เพดานต่อ 60 วิ
  // (กันวนล่มรัวๆ — เกินแล้วให้ชั้น 2 รับช่วง) ส่วน maxRetries ไม่ตั้ง = ไม่จำกัดตลอดอายุ service
  wait: 3,
  grow: 0,
  maxRestarts: 10,
});

// ชื่อ service ที่ลงทะเบียนกับ Windows จริง (winsw ใช้ <id> = ชื่อไฟล์ exe) เช่น lmsreaderagent.exe
const SERVICE_NAME = `${svc.id}.exe`;

function sc(...args) {
  try {
    execFileSync('sc.exe', args, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.log(`⚠️  sc ${args.join(' ')} ไม่สำเร็จ: ${String(error.stdout || error.message).trim()}`);
    return false;
  }
}

function configureAutoStartAndRecovery() {
  // เปิดเครื่อง/รีสตาร์ทเครื่อง -> start เองอัตโนมัติ
  sc('config', SERVICE_NAME, 'start=', 'auto');
  // ชั้น 2: service หยุดผิดปกติ -> restart หลัง 5 วิ, 10 วิ, แล้ว 30 วิ (ครั้งต่อๆ ไปใช้ 30 วิ)
  // นับใหม่ทุก 1 วัน (reset= วินาที)
  sc('failure', SERVICE_NAME, 'reset=', '86400', 'actions=', 'restart/5000/restart/10000/restart/30000');
  // ให้ recovery ทำงานด้วยแม้ service จะ "หยุดเอง" พร้อม error code (ไม่ใช่แค่ตอน process ตาย)
  sc('failureflag', SERVICE_NAME, '1');
  console.log('✅ ตั้งค่าให้รันเองตอนเปิดเครื่อง + รีสตาร์ทเองเมื่อ service หยุดผิดปกติแล้ว');
}

svc.on('install', () => {
  console.log('ติดตั้ง service แล้ว');
  configureAutoStartAndRecovery();
  console.log('กำลังเริ่มทำงาน...');
  svc.start();
});
svc.on('alreadyinstalled', () => {
  console.log('service นี้ติดตั้งไว้แล้ว — ตั้งค่า recovery ใหม่แล้ว start ให้');
  configureAutoStartAndRecovery();
  svc.start();
});
svc.on('start', () => {
  console.log('✅ service ทำงานแล้ว — ปิดหน้าต่างนี้ได้');
  console.log(`   ดู log: ${path.join(DIR, 'daemon')}  |  ดูสถานะ: status-service.bat หรือ services.msc`);
});
svc.on('error', (err) => console.log('❌', err));

svc.install();
