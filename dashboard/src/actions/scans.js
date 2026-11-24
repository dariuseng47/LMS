import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export async function wardIssueScan(payload) {
  const { data } = await axios.post(endpoints.scans.wardIssue, payload);
  return data;
}

export async function wardReceiveScan(payload) {
  const { data } = await axios.post(endpoints.scans.wardReceive, payload);
  return data;
}

// สแกนรับ-ส่งผ้าทั้งชุดจากเครื่องอ่าน RFID (หน้า รับ-ส่งผ้าประจำวอร์ด) — ดู server wardScan.controller.js
// คืน { processed: [{ epcCode, fabricCategoryId, isTransfer }], skipped: [{ epcCode, reason, status }] }
// จ่ายเข้าตู้ไม่ต้องส่ง hospitalId (server หาโรงพยาบาลจากตู้) | รับคืนต้องส่ง (superadmin)
export async function wardIssueBatch(payload) {
  const { data } = await axios.post(endpoints.scans.wardIssueBatch, payload);
  return data;
}

export async function wardReceiveBatch(payload, hospitalId) {
  const { data } = await axios.post(endpoints.scans.wardReceiveBatch, payload, {
    params: hospitalId ? { hospitalId } : {},
  });
  return data;
}

// hospitalId = โรงพยาบาลที่กำลังทำงานอยู่ — ต้องส่งเสมอ: superadmin ไม่มี hospital_id ใน JWT ถ้าไม่ส่ง
// server ตีกลับ 400 "superadmin ต้องระบุ ?hospitalId= เสมอ" (ดู server/src/utils/tenant.js#resolveTenantId)
// (wardIssue/wardReceive ด้านบนไม่ต้อง — server หาโรงพยาบาลจากตู้/ผ้าชิ้นนั้นเอง)
export async function washReceiveBatchScan(payload, hospitalId) {
  const { data } = await axios.post(endpoints.scans.washReceiveBatch, payload, {
    params: hospitalId ? { hospitalId } : {},
  });
  return data;
}

// payload.stockType = สต๊อคปลายทาง (STOCK_OPTIONS) — server คืน stockType ที่บันทึกจริงกลับมาด้วย
export async function stockScan(payload, hospitalId) {
  const { data } = await axios.post(endpoints.scans.stockScan, payload, {
    params: hospitalId ? { hospitalId } : {},
  });
  return data;
}
