import fs from 'node:fs/promises';
import path from 'node:path';

import { Router } from 'express';

import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// ดาวน์โหลดแอป handheld (.apk) ผ่านโดเมน API เช่น https://api.welcleankhoka.com/download
//
// วางไฟล์ .apk ไว้ในโฟลเดอร์ APK_DIR (ค่าเริ่มต้น server/downloads) แล้วระบบเลือก "ไฟล์ล่าสุด" (ตามเวลาแก้ไข)
// ให้อัตโนมัติ — อัปเดตแอปแค่วางไฟล์ใหม่ทับ/เพิ่ม ไม่ต้องแก้โค้ดหรือรีสตาร์ท server
// แนะนำตั้งชื่อไฟล์มีเลขเวอร์ชัน เช่น welclean-lms-1.0.3.apk (ชื่อไฟล์ถูกแสดงในหน้าดาวน์โหลด)
//
// เลข build: `npm run build:apk` ใน nativeapp ตั้งชื่อไฟล์เป็น welclean-lms-<version>-<YYYYMMDDHHmm>.apk
// และฝังเลขเดียวกันไว้ในตัวแอป — /download/info คืนเลขนี้เป็น `build` ให้แอปเทียบกับเลขของตัวเอง
// แล้วเตือน "มีเวอร์ชันใหม่" ในเมนูอัปเดตแอป (ไฟล์ที่ชื่อไม่มีเลข build → build: null แอปจะไม่เตือน)
//
// เปิดแบบ public (ไม่ต้อง login) เพราะต้องเปิดจากเบราว์เซอร์บนเครื่อง handheld ที่ยังไม่ได้ติดตั้งแอป
// ตัว apk ไม่มีความลับฝังอยู่ (มีแค่ URL ของ API) ทุก request ยังต้อง login ในแอปอยู่ดี
//   GET /download              หน้าเว็บมีปุ่มดาวน์โหลด + ชื่อไฟล์/ขนาด/วันที่อัปเดต
//   GET /download/latest.apk   ไฟล์ apk ล่าสุดโดยตรง (ลิงก์ถาวร ส่งต่อ/ทำ QR ได้)
//   GET /download/info         ข้อมูลไฟล์ล่าสุดเป็น JSON
export const APK_DIR = env.APK_DIR ? path.resolve(env.APK_DIR) : path.join(process.cwd(), 'downloads');

async function findLatestApk() {
  let names;
  try {
    names = await fs.readdir(APK_DIR);
  } catch {
    return null; // ยังไม่มีโฟลเดอร์
  }
  const apks = await Promise.all(
    names
      .filter((name) => name.toLowerCase().endsWith('.apk') && !name.startsWith('.'))
      .map(async (name) => {
        const stat = await fs.stat(path.join(APK_DIR, name));
        return stat.isFile() ? { name, size: stat.size, updatedAt: stat.mtime } : null;
      })
  );
  return apks.filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

// เลข build 12 หลัก (YYYYMMDDHHmm) ในชื่อไฟล์ — ดูคอมเมนต์ด้านบน
function parseBuild(fileName) {
  const match = fileName.match(/(?:^|[^\d])(\d{12})(?:[^\d]|$)/);
  return match ? match[1] : null;
}

function formatSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function renderPage(apk) {
  const body = apk
    ? `<p class="name">${escapeHtml(apk.name)}</p>
       <p class="meta">ขนาด ${formatSize(apk.size)} · อัปเดต ${escapeHtml(
         apk.updatedAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
       )}</p>
       <a class="btn" href="/download/latest.apk">ดาวน์โหลดแอป (.apk)</a>
       <ol>
         <li>กดปุ่มดาวน์โหลดด้านบน แล้วเปิดไฟล์เมื่อโหลดเสร็จ</li>
         <li>ถ้าเครื่องถาม ให้อนุญาต "ติดตั้งแอปจากแหล่งที่ไม่รู้จัก" สำหรับเบราว์เซอร์นี้</li>
         <li>กดติดตั้ง (ถ้ามีแอปเดิมอยู่แล้วจะอัปเดตทับ ข้อมูลการตั้งค่ายังอยู่)</li>
       </ol>`
    : '<p class="meta">ยังไม่มีไฟล์แอปให้ดาวน์โหลด กรุณาติดต่อผู้ดูแลระบบ</p>';

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ดาวน์โหลดแอป WelGroup LMS</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #F4F6F8; color: #1C252E; }
  main { max-width: 480px; margin: 0 auto; padding: 32px 16px; }
  .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,.06); }
  h1 { font-size: 22px; margin: 0 0 16px; }
  .name { font-weight: 700; margin: 0 0 4px; word-break: break-all; }
  .meta { color: #637381; margin: 0 0 20px; }
  .btn { display: block; text-align: center; background: #00A76F; color: #fff; text-decoration: none;
         font-weight: 700; font-size: 18px; padding: 16px; border-radius: 12px; }
  ol { color: #454F5B; padding-left: 20px; margin: 20px 0 0; line-height: 1.7; }
</style>
</head>
<body><main><div class="card"><h1>แอป WelGroup LMS (Handheld)</h1>${body}</div></main></body>
</html>`;
}

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const apk = await findLatestApk();
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(renderPage(apk));
  })
);

router.get(
  '/info',
  asyncHandler(async (req, res) => {
    const apk = await findLatestApk();
    if (!apk) return res.status(404).json({ error: 'NOT_FOUND', message: 'ยังไม่มีไฟล์แอปให้ดาวน์โหลด' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      fileName: apk.name,
      build: parseBuild(apk.name),
      size: apk.size,
      updatedAt: apk.updatedAt,
      url: '/download/latest.apk',
    });
  })
);

router.get(
  '/latest.apk',
  asyncHandler(async (req, res) => {
    const apk = await findLatestApk();
    if (!apk) return res.status(404).json({ error: 'NOT_FOUND', message: 'ยังไม่มีไฟล์แอปให้ดาวน์โหลด' });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    return res.download(path.join(APK_DIR, apk.name), apk.name);
  })
);

// ---------------------------------------------------------------------------------------------
// Reader agent (โปรแกรมเชื่อมเครื่องอ่าน RFID ใน LAN โรงพยาบาล กับ server บนคลาวด์ — โฟลเดอร์ reader-agent/)
//   GET /download/reader-agent       หน้าเว็บวิธีติดตั้ง + ปุ่มดาวน์โหลด
//   GET /download/reader-agent.zip   ไฟล์ zip (สร้างด้วย `cd reader-agent && npm run build:zip`)
// public เหมือน apk — ใน zip ไม่มีความลับ (token แต่ละเครื่องกรอกเองที่ PC ปลายทาง)
const AGENT_ZIP = 'lms-reader-agent.zip';

async function findAgentZip() {
  try {
    const stat = await fs.stat(path.join(APK_DIR, AGENT_ZIP));
    return stat.isFile() ? { size: stat.size, updatedAt: stat.mtime } : null;
  } catch {
    return null;
  }
}

function renderAgentPage(zip, origin) {
  const download = zip
    ? `<p class="meta">ขนาด ${formatSize(zip.size)} · อัปเดต ${escapeHtml(
        zip.updatedAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
      )}</p>
       <a class="btn" href="/download/reader-agent.zip">ดาวน์โหลด Reader Agent (.zip)</a>`
    : '<p class="meta">ยังไม่มีไฟล์ให้ดาวน์โหลด กรุณาติดต่อผู้ดูแลระบบ</p>';

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LMS Reader Agent</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #F4F6F8; color: #1C252E; }
  main { max-width: 640px; margin: 0 auto; padding: 32px 16px; }
  .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,.06); margin-bottom: 16px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 17px; margin: 0 0 12px; }
  .lead { color: #454F5B; margin: 0 0 20px; line-height: 1.6; }
  .meta { color: #637381; margin: 0 0 16px; }
  .btn { display: block; text-align: center; background: #00A76F; color: #fff; text-decoration: none;
         font-weight: 700; font-size: 18px; padding: 16px; border-radius: 12px; }
  .btn.alt { background: #fff; color: #1C252E; border: 1px solid #DFE3E8; font-size: 15px; padding: 12px; margin-top: 10px; }
  ol { color: #454F5B; padding-left: 20px; margin: 0; line-height: 1.8; }
  code { background: #F4F6F8; padding: 1px 6px; border-radius: 6px; font-size: 14px; word-break: break-all; }
</style>
</head>
<body><main>
<div class="card">
  <h1>LMS Reader Agent (Windows)</h1>
  <p class="lead">โปรแกรมสำหรับ PC ที่อยู่วง LAN เดียวกับเครื่องอ่าน RFID (เช่น SID 192.168.1.250)
  ทำหน้าที่รับคำสั่งสแกนจาก server <code>${escapeHtml(origin)}</code> แล้วสั่งเครื่องอ่านให้ — ไม่ต้องเปิดพอร์ตหรือทำ VPN</p>
  ${download}
  <a class="btn alt" href="https://nodejs.org/" target="_blank" rel="noopener">ติดตั้ง Node.js LTS ก่อน (nodejs.org)</a>
</div>
<div class="card">
  <h2>วิธีติดตั้ง</h2>
  <ol>
    <li>ติดตั้ง <b>Node.js LTS</b> (เวอร์ชัน 20 ขึ้นไป) จาก nodejs.org กด Next จนจบ</li>
    <li>แตกไฟล์ zip ไว้ที่ถาวร เช่น <code>C:\lms-reader-agent</code></li>
    <li>ดับเบิลคลิก <code>test-reader.bat</code> ใส่ IP/Port ของเครื่องอ่าน ต้องขึ้น "ต่อได้"</li>
    <li>ดับเบิลคลิก <code>start.bat</code> ครั้งแรกจะเปิด Notepad ให้วาง <b>DEVICE_TOKEN</b>
      (ได้จากหน้าเว็บ "อุปกรณ์ &amp; สัญญาณ RFID" ตอนเพิ่มเครื่อง หรือกด "รีเซ็ต token") บันทึกแล้วเปิด <code>start.bat</code> อีกครั้ง</li>
    <li>ต้องขึ้น "เชื่อมต่อ server สำเร็จ" แล้วลองกดสแกนจากหน้าเว็บ</li>
    <li>ให้รันเองตอนเปิด/รีสตาร์ทเครื่อง และรีสตาร์ทเองเมื่อล่ม: ปิดหน้าต่าง start.bat แล้วคลิกขวา
      <code>install-service.bat</code> เลือก <b>Run as administrator</b></li>
    <li>เช็คด้วย <code>status-service.bat</code> ต้องขึ้น <b>RUNNING</b> และ <b>AUTO_START</b>
      (สั่งรีสตาร์ท: <code>restart-service.bat</code> · ถอนออก: <code>uninstall-service.bat</code> — แบบ Run as administrator)</li>
  </ol>
</div>
</main></body>
</html>`;
}

router.get(
  '/reader-agent',
  asyncHandler(async (req, res) => {
    const zip = await findAgentZip();
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(renderAgentPage(zip, `${req.protocol}://${req.get('host')}`));
  })
);

router.get(
  '/reader-agent.zip',
  asyncHandler(async (req, res) => {
    const zip = await findAgentZip();
    if (!zip) return res.status(404).json({ error: 'NOT_FOUND', message: 'ยังไม่มีไฟล์ให้ดาวน์โหลด' });
    res.setHeader('Cache-Control', 'no-store');
    return res.download(path.join(APK_DIR, AGENT_ZIP), AGENT_ZIP);
  })
);

export default router;
