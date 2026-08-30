import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { queryTags } from '../services/rfidReader.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * POST /api/v1/rfid-reader/scan — admin ของโรงพยาบาล หรือ superadmin (มองข้าม tenant ได้ ต้องระบุ
 * hospitalId มาเองเสมอ ตามแพทเทิร์น resolveTenantId ดู docs/multi-tenant-isolation.md ชั้นที่ 1)
 * สั่งเครื่องอ่าน RFID ที่จุดตรวจสอบให้ inventory 1 รอบแล้วคืนรายการ EPC ที่อ่านได้กลับมาทันที
 * (synchronous — ไม่ผ่าน scan session แบบ handheld เพราะเครื่องนี้ต่อ LAN สั่งงานได้ตรงจาก server เลย
 * ไม่ต้องรอ device ยิง callback กลับมาเอง)
 *
 * หมายเหตุ: การ "สแกน" (endpoint นี้) เปิดให้ superadmin ใช้ได้ แต่ขั้นตอนถัดไป (ยืนยันเพิ่มผ้าเข้าระบบ
 * ผ่าน /fabric-items/bulk) ยังเป็นสิทธิ์ admin โรงพยาบาลเท่านั้นตามเดิม — superadmin สแกนดูได้
 * (เช่น ทดสอบว่าเครื่องอ่านเชื่อมต่อได้ไหม) แต่กด "เพิ่มเข้าระบบ" ไม่ได้
 */
export const scanCheckpoint = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่สแกนผ่านจุดตรวจสอบได้');
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  const devices = await scopedQuery(pool, tenantId).select('devices', {
    id: req.body.deviceId,
    device_type: 'RFID_CHECKPOINT',
  });
  const device = devices[0];
  if (!device) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบเครื่องอ่าน RFID นี้');
  }
  if (!device.ip_address || !device.port) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'อุปกรณ์นี้ยังไม่ได้ตั้งค่า IP/Port — แก้ไขได้ที่หน้าอุปกรณ์ & สัญญาณ RFID'
    );
  }

  let result;
  try {
    result = await queryTags({ ip: device.ip_address, port: device.port });
  } catch (error) {
    throw new AppError(502, 'READER_UNREACHABLE', `เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ: ${error.message}`);
  }

  return res.json({ epcs: result.epcs });
});
