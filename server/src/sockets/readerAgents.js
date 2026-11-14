import { pool } from '../db/pool.js';
import { hashToken } from '../utils/tokens.js';

// Reader agent = โปรแกรม Node เล็กๆ (โฟลเดอร์ reader-agent/ ที่ root repo) ที่รันบน PC ในวง LAN
// ของโรงพยาบาล ใช้ตอน server อยู่บนคลาวด์ (api.welcleankhoka.com) แล้วต่อ TCP เข้าเครื่องอ่าน RFID
// ที่ IP ภายใน (เช่น 192.168.1.250) ตรงๆ ไม่ได้ — agent เป็นฝ่ายต่อ "ขาออก" มาหา server ผ่าน
// Socket.io namespace /reader-agent ค้างไว้ แล้ว server สั่ง "สแกน" กลับลงไปทางเส้นนั้น
// (ไม่ต้องเปิดพอร์ต/ทำ VPN ที่โรงพยาบาล)
//
// Auth: device token ของอุปกรณ์ในระบบ (ตัวเดียวกับที่ใช้ยิง heartbeat — ออก/รีเซ็ตได้ที่หน้าอุปกรณ์)
// agent 1 ตัวรับงานแทน "ทุกเครื่องอ่าน" ของโรงพยาบาลที่ token นั้นสังกัด (อยู่ LAN เดียวกันอยู่แล้ว)
// ถ้ามีหลาย agent ในโรงพยาบาลเดียว จะเลือกตัวที่ใช้ token ของเครื่องที่สั่งสแกนก่อน ไม่มีค่อยใช้ตัวอื่น
//
// หมายเหตุ: ทะเบียน agent อยู่ใน memory ของ process — ต้องรัน server เป็น process เดียว
// (เงื่อนไขเดียวกับ presence/real-time ของ Socket.io ที่มีอยู่แล้ว)

const agentsByHospital = new Map(); // hospitalId -> Map<socketId, { socket, deviceId }>

function register(hospitalId, socket, deviceId) {
  if (!agentsByHospital.has(hospitalId)) agentsByHospital.set(hospitalId, new Map());
  agentsByHospital.get(hospitalId).set(socket.id, { socket, deviceId });
}

function unregister(hospitalId, socketId) {
  const agents = agentsByHospital.get(hospitalId);
  if (!agents) return;
  agents.delete(socketId);
  if (agents.size === 0) agentsByHospital.delete(hospitalId);
}

function pickAgent(hospitalId, deviceId) {
  const agents = agentsByHospital.get(hospitalId);
  if (!agents || agents.size === 0) return null;
  const list = [...agents.values()];
  return (list.find((a) => a.deviceId === deviceId) ?? list[0]).socket;
}

export function hasReaderAgent(hospitalId) {
  return (agentsByHospital.get(hospitalId)?.size ?? 0) > 0;
}

/**
 * ส่งคำสั่งสแกนให้ agent ของโรงพยาบาลนี้ทำแทน
 * คืน null ถ้าไม่มี agent ออนไลน์ (ให้ caller ต่อ TCP เองตามเดิม), คืน { epcs } ถ้าสำเร็จ,
 * throw Error ถ้า agent ตอบ error / ไม่ตอบภายในเวลา
 */
export async function scanViaAgent(hospitalId, deviceId, params, timeoutMs = 30_000) {
  const socket = pickAgent(hospitalId, deviceId);
  if (!socket) return null;

  let reply;
  try {
    reply = await socket.timeout(timeoutMs).emitWithAck('reader:scan', params);
  } catch {
    throw new Error('reader agent ไม่ตอบกลับภายในเวลาที่กำหนด');
  }
  if (!reply?.ok) {
    throw new Error(reply?.error || 'reader agent สแกนไม่สำเร็จ');
  }
  return { epcs: Array.isArray(reply.epcs) ? reply.epcs : [] };
}

export function initReaderAgentNamespace(io) {
  const nsp = io.of('/reader-agent');

  nsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== 'string') return next(new Error('UNAUTHORIZED'));
      const [rows] = await pool.query(
        `SELECT id, hospital_id FROM devices
         WHERE device_token_hash = ? AND deleted_at IS NULL LIMIT 1`,
        [hashToken(token)]
      );
      if (!rows[0]) return next(new Error('UNAUTHORIZED'));
      socket.agent = { deviceId: rows[0].id, hospitalId: rows[0].hospital_id };
      return next();
    } catch (error) {
      // DB สะดุด ไม่ใช่ token ผิด — แยก error ให้ agent ไม่ไปบอกผู้ใช้ว่า token ผิดทั้งที่ถูก
      console.error('[reader-agent] auth error:', error.message);
      return next(new Error('SERVER_ERROR'));
    }
  });

  nsp.on('connection', (socket) => {
    const { deviceId, hospitalId } = socket.agent;
    const agentName = String(socket.handshake.auth?.name || '').slice(0, 100);
    register(hospitalId, socket, deviceId);
    console.log(
      `[reader-agent] เชื่อมต่อ: hospital=${hospitalId} device=${deviceId}` +
        (agentName ? ` (${agentName})` : '') +
        ` จาก ${socket.handshake.address}`
    );

    // บอก agent ว่า token นี้คือ device ไหน — agent ใช้ยิง heartbeat ให้หน้าอุปกรณ์ขึ้น ONLINE
    socket.emit('agent:hello', { deviceId, hospitalId });

    socket.on('disconnect', (reason) => {
      unregister(hospitalId, socket.id);
      console.log(`[reader-agent] หลุด: hospital=${hospitalId} device=${deviceId} (${reason})`);
    });
  });

  return nsp;
}
