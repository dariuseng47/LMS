// ติดตั้งเป็น Windows Service — เปิดเครื่องแล้วรันเองอัตโนมัติ ไม่ต้องล็อกอิน/เปิดหน้าต่างค้างไว้
// ต้องรันใน Command Prompt แบบ "Run as administrator": npm run install-service
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import nodeWindows from 'node-windows';

const DIR = path.dirname(fileURLToPath(import.meta.url));

const svc = new nodeWindows.Service({
  name: 'LMS Reader Agent',
  description: 'LMS - bridge RFID readers (SID) in LAN to the cloud server',
  script: path.join(DIR, 'agent.js'),
  workingDirectory: DIR,
  // ล่มแล้วให้เปิดใหม่เอง รอ 3 วิทุกครั้ง (grow: 0) — ค่า default ของ node-windows ให้เวลารอโตขึ้นทุกครั้ง
  // ที่ล่มและไม่รีเซ็ตกลับ ถ้าล่มบ่อยๆ สะสมนานๆ จะรอเป็นชั่วโมงก่อนเปิดใหม่ | maxRestarts = เพดานต่อ 60 วิ
  // (กันวนล่มรัวๆ) ส่วน maxRetries ไม่ตั้ง = รีสตาร์ทได้ไม่จำกัดตลอดอายุ service
  wait: 3,
  grow: 0,
  maxRestarts: 10,
});

svc.on('install', () => {
  console.log('ติดตั้ง service แล้ว กำลังเริ่มทำงาน...');
  svc.start();
});
svc.on('alreadyinstalled', () => console.log('service นี้ติดตั้งไว้แล้ว (ถ้าจะติดตั้งใหม่ ให้ uninstall ก่อน)'));
svc.on('start', () => console.log('✅ service ทำงานแล้ว — ดู log ได้ในโฟลเดอร์ daemon\\'));
svc.on('error', (err) => console.log('❌', err));

svc.install();
