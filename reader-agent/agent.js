// LMS Reader Agent — รันบน PC ในวง LAN เดียวกับเครื่องอ่าน RFID (เช่น SID 192.168.1.250)
// ต่อขาออกไปหา server บนคลาวด์ผ่าน Socket.io แล้วรอคำสั่ง "สแกน" -> ต่อ TCP เข้าเครื่องอ่าน -> ส่ง EPC กลับ
// ฝั่ง server ดู server/src/sockets/readerAgents.js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { io } from 'socket.io-client';

import { queryTags } from './rfidReader.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(DIR, '.env') });

const SERVER_URL = (process.env.SERVER_URL || '').replace(/\/+$/, '');
const DEVICE_TOKEN = (process.env.DEVICE_TOKEN || '').trim();
const AGENT_NAME = process.env.AGENT_NAME || process.env.COMPUTERNAME || 'reader-agent';
const HEARTBEAT_MS = 30_000;

const log = (...args) => console.log(new Date().toLocaleString('th-TH'), ...args);

if (!SERVER_URL || !DEVICE_TOKEN) {
  log('❌ ยังไม่ได้ตั้งค่า SERVER_URL / DEVICE_TOKEN ในไฟล์ .env (ดูตัวอย่างใน .env.example)');
  process.exit(1);
}

// คิวต่อเครื่องอ่าน (ip:port) — เครื่องอ่านส่วนใหญ่รับ TCP ได้ทีละเส้น ถ้ามีคนกดสแกนพร้อมกัน 2 หน้าจอ
// ให้รอคิวกันแทนที่จะต่อซ้อนแล้วพังทั้งคู่
const queues = new Map();
function enqueue(key, task) {
  const prev = queues.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(task);
  queues.set(key, run);
  const cleanup = () => {
    if (queues.get(key) === run) queues.delete(key);
  };
  run.then(cleanup, cleanup); // ห้ามใช้ .finally() ตรงนี้ — สร้าง promise ใหม่ที่ reject ลอยๆ แล้ว process ล่ม
  return run;
}

const lastSettingLog = new Map(); // key -> ข้อความผลตั้งค่าล่าสุดที่ log ไปแล้ว

let deviceId = null;
let heartbeatTimer = null;

async function sendHeartbeat() {
  if (!deviceId) return;
  try {
    const res = await fetch(`${SERVER_URL}/api/v1/devices/${deviceId}/heartbeat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${DEVICE_TOKEN}` },
    });
    if (!res.ok && res.status !== 204) log(`⚠️  heartbeat ตอบกลับ ${res.status}`);
  } catch (error) {
    log(`⚠️  heartbeat ไม่สำเร็จ: ${error.message}`);
  }
}

const socket = io(`${SERVER_URL}/reader-agent`, {
  auth: { token: DEVICE_TOKEN, name: AGENT_NAME },
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 15000,
});

log(`🔌 กำลังเชื่อมต่อ ${SERVER_URL} ...`);

socket.on('connect', () => log('✅ เชื่อมต่อ server สำเร็จ — พร้อมรับคำสั่งสแกน'));

socket.on('agent:hello', (info) => {
  deviceId = info?.deviceId ?? null;
  log(`   token นี้คืออุปกรณ์ #${deviceId} (โรงพยาบาล #${info?.hospitalId})`);
  sendHeartbeat();
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);
});

socket.on('disconnect', (reason) => {
  clearInterval(heartbeatTimer);
  log(`⚠️  หลุดจาก server (${reason}) — กำลังเชื่อมต่อใหม่อัตโนมัติ`);
});

const RETRY_AFTER_REJECT_MS = 30_000;

socket.on('connect_error', (error) => {
  if (error.message === 'UNAUTHORIZED') {
    log('❌ DEVICE_TOKEN ไม่ถูกต้อง (อาจถูกรีเซ็ตไปแล้ว) — ขอ token ใหม่จากหน้า "อุปกรณ์ & สัญญาณ RFID" แล้วแก้ใน .env');
  } else {
    log(`⚠️  เชื่อมต่อ server ไม่ได้: ${error.message} — จะลองใหม่เรื่อยๆ`);
  }
  // server ปฏิเสธใน middleware (token ผิด / server error) -> socket.io-client จะไม่ reconnect เอง
  // และ process จะจบไปเฉยๆ — ต้องลองใหม่เองเป็นระยะ (รันเป็น service ต้องไม่ตาย)
  if (!socket.active) {
    log(`   จะลองเชื่อมต่อใหม่ใน ${RETRY_AFTER_REJECT_MS / 1000} วินาที`);
    setTimeout(() => socket.connect(), RETRY_AFTER_REJECT_MS);
  }
});

socket.on('reader:scan', async (params, ack) => {
  if (typeof ack !== 'function') return;
  const ip = typeof params?.ip === 'string' ? params.ip.trim() : '';
  const port = Number(params?.port);
  if (!ip || !Number.isInteger(port) || port <= 0 || port > 65535) {
    ack({ ok: false, error: 'คำสั่งสแกนไม่มี IP/Port ที่ถูกต้อง' });
    return;
  }

  const key = `${ip}:${port}`;
  const startedAt = Date.now();
  log(`📡 สั่งสแกน ${key}`);
  try {
    const { epcs, rounds, antennas, settings } = await enqueue(key, () =>
      queryTags({
        ip,
        port,
        idleTimeoutMs: params.idleTimeoutMs,
        stableRounds: params.stableRounds,
        maxWaitMs: params.maxWaitMs,
        powerDbm: params.powerDbm ?? undefined,
        scanTime: params.scanTime ?? undefined,
      })
    );
    // คำสั่งตั้งค่าที่ส่งเข้าเครื่องรอบนี้ — บอกชัดๆ ว่าเครื่องรับค่าหรือไม่ (เช่น กำลังส่ง)
    // log เฉพาะตอนผลเปลี่ยน ไม่งั้นโหมดอ่านอัตโนมัติจะขึ้นซ้ำทุกรอบ
    for (const st of settings ?? []) {
      const verdict =
        st.status === 0 ? 'เครื่องรับค่าแล้ว' : st.status === null ? 'เครื่องไม่ตอบ' : `เครื่องปฏิเสธ (status 0x${st.status.toString(16)})`;
      const line = `ตั้ง${st.name}: ${verdict}`;
      if (lastSettingLog.get(key) !== line) log(`   ${line}`);
      lastSettingLog.set(key, line);
    }
    const rssis = epcs.map((t) => t.rssi);
    log(
      `   ได้ ${epcs.length} แท็ก (${Date.now() - startedAt} ms, ${rounds} รอบ` +
        (antennas?.length ? `, เสา ${antennas.join('/')}` : '') +
        (params.scanTime ? `, ${params.scanTime * 100} ms/เสา` : '') +
        (rssis.length ? `, RSSI ${Math.min(...rssis)}-${Math.max(...rssis)}` : '') +
        ')'
    );
    ack({ ok: true, epcs });
  } catch (error) {
    log(`   ❌ ${key}: ${error.message}`);
    ack({ ok: false, error: error.message });
  }
});

const shutdown = () => {
  log('ปิดโปรแกรม');
  socket.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
