import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { hasPermission } from '../utils/permissions.js';
import { queryTags } from '../services/rfidReader.js';
import { scanViaAgent } from '../sockets/readerAgents.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// โปรไฟล์ความเร็วการสแกน (ตั้งได้ต่อเครื่องในหน้าอุปกรณ์ — คอลัมน์ devices.scan_profile)
// scanTime     = InventoryScanTime ที่ส่งเข้าเครื่อง (x100ms) = เวลาสูงสุดต่อรอบ — เครื่อง 4 พอร์ตอ่านทีละเสา
//                ต่อรอบ ค่าต่ำ = สลับเสาเร็ว อ่านรัว (ค่าเดิมในเครื่อง 30 = 3 วิ/เสา ทำให้เห็นสลับเสาช้าๆ)
// stableRounds = ไม่เจอ EPC ใหม่กี่ "รอบวนเสา" ติดกันถึงจบ (rfidReader คูณจำนวนเสาที่เห็นแท็กให้เอง)
// idleTimeoutMs = ตัวสำรองสำหรับเครื่องที่ไม่ส่งเฟรมจบรอบ (SID ส่ง — ปกติยิงรอบถัดไปทันทีไม่ต้องรอ)
const SCAN_PROFILES = {
  VERY_FAST: { idleTimeoutMs: 200, stableRounds: 1, scanTime: 3 },
  FAST: { idleTimeoutMs: 400, stableRounds: 1, scanTime: 5 },
  NORMAL: { idleTimeoutMs: 800, stableRounds: 2, scanTime: 10 },
  THOROUGH: { idleTimeoutMs: 1200, stableRounds: 3, scanTime: 20 },
};

// CUSTOM = ผู้ใช้กรอกเวลาเอง (ดู migration 035) ช่องที่เว้นว่างใช้ค่าของโปรไฟล์ "เร็ว"
function scanTimingFor(device) {
  if (device.scan_profile !== 'CUSTOM') return SCAN_PROFILES[device.scan_profile] || SCAN_PROFILES.NORMAL;
  const base = SCAN_PROFILES.FAST;
  return {
    idleTimeoutMs: base.idleTimeoutMs,
    stableRounds: device.scan_stable_rounds ?? base.stableRounds,
    scanTime: device.scan_round_ms ? Math.round(device.scan_round_ms / 100) : base.scanTime,
    ...(device.scan_max_ms ? { maxWaitMs: device.scan_max_ms } : {}),
  };
}

/**
 * POST /api/v1/rfid-reader/scan — admin ของโรงพยาบาล หรือ superadmin (มองข้าม tenant ได้ ต้องระบุ
 * hospitalId มาเองเสมอ ตามแพทเทิร์น resolveTenantId ดู docs/multi-tenant-isolation.md ชั้นที่ 1)
 * สั่งเครื่องอ่าน RFID ที่จุดตรวจสอบให้ inventory 1 รอบแล้วคืนรายการ EPC ที่อ่านได้กลับมาทันที
 * (synchronous — ไม่ผ่าน scan session แบบ handheld เพราะเครื่องนี้ต่อ LAN สั่งงานได้ตรงจาก server เลย
 * ไม่ต้องรอ device ยิง callback กลับมาเอง)
 *
 * หมายเหตุ: การ "สแกน" (endpoint นี้) ผูกกับสิทธิ์เมนู "อุปกรณ์ & สัญญาณ RFID" (web.devices.view)
 * ไม่ผูกกับ role แล้ว — operator ที่ admin เปิดสิทธิ์นี้ให้ก็สั่งเครื่องอ่านได้ (เช่น หน้า รับผ้าหลังซัก
 * / สแกนเข้าสต๊อค) ส่วนขั้นตอนถัดไป (ยืนยันเพิ่มผ้าเข้าระบบผ่าน /fabric-items/bulk) ยังเป็นสิทธิ์
 * admin โรงพยาบาลเท่านั้นตามเดิม
 */
export const scanCheckpoint = asyncHandler(async (req, res) => {
  if (!(await hasPermission(req.auth.userId, req.auth.role, 'web.devices.view'))) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'ไม่มีสิทธิ์สั่งเครื่องอ่าน RFID กรุณาติดต่อผู้ดูแลระบบให้เปิดสิทธิ์ "อุปกรณ์ & สัญญาณ RFID"'
    );
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  // server ต่อ TCP เข้าไปอ่านแท็กเองได้ทั้งเครื่องจุดตรวจสอบ และเครื่องที่ประตูชั่งน้ำหนัก
  // (ทั้งคู่ต่อ LAN + ตั้ง IP/Port ไว้) — ต่างกันแค่บทบาทในระบบ
  const SERVER_PULL_TYPES = ['RFID_CHECKPOINT', 'WEIGHT_GATE'];
  const devices = await scopedQuery(pool, tenantId).select('devices', {
    id: req.body.deviceId,
    deleted_at: null,
  });
  const device = devices[0];
  if (!device || !SERVER_PULL_TYPES.includes(device.device_type)) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบเครื่องอ่าน RFID นี้ (ต้องเป็นจุดตรวจสอบ หรือประตูชั่งน้ำหนัก)');
  }
  if (!device.ip_address || !device.port) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'อุปกรณ์นี้ยังไม่ได้ตั้งค่า IP/Port — แก้ไขได้ที่หน้าอุปกรณ์ & สัญญาณ RFID'
    );
  }

  const scanParams = {
    ip: device.ip_address,
    port: device.port,
    ...scanTimingFor(device),
    // null = ไม่แตะ ใช้ค่ากำลังส่งที่ตั้งไว้ในตัวเครื่องเดิม
    powerDbm: device.scan_power_dbm ?? undefined,
  };

  // มี reader agent (PC ใน LAN โรงพยาบาล) ออนไลน์อยู่ -> ให้ agent ต่อเครื่องอ่านแทน เพราะ server
  // บนคลาวด์ต่อ IP ภายในตรงๆ ไม่ได้ | ไม่มี agent -> server ต่อ TCP เอง (กรณี server อยู่ LAN เดียวกัน)
  let result;
  try {
    // รอ agent นานกว่าเพดานเวลาสแกน (ต่อเครื่อง + อ่าน + ส่งกลับ)
    result = await scanViaAgent(tenantId, device.id, scanParams, (scanParams.maxWaitMs ?? 15_000) + 15_000);
  } catch (error) {
    throw new AppError(502, 'READER_UNREACHABLE', `เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ (ผ่าน reader agent): ${error.message}`);
  }
  if (!result) {
    try {
      result = await queryTags(scanParams);
    } catch (error) {
      throw new AppError(
        502,
        'READER_UNREACHABLE',
        `เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ: ${error.message} — ถ้า server อยู่บนคลาวด์ ต้องเปิดโปรแกรม reader agent บน PC ในวง LAN เดียวกับเครื่องอ่านไว้ด้วย`
      );
    }
  }

  // กรองแท็กสัญญาณอ่อน (อยู่ไกลเกินจุดสแกน) ตามที่ตั้งไว้ต่อเครื่อง — คุมระยะอ่านได้แน่นอน
  // แม้เครื่องอ่านจะไม่รับคำสั่งตั้งกำลังส่ง
  const minRssi = device.scan_min_rssi;
  const epcs = minRssi != null ? result.epcs.filter((tag) => tag.rssi >= minRssi) : result.epcs;

  return res.json({ epcs });
});
