// ค่าคงที่ใช้ร่วมกันในหน้า Fabric & Lot Management ทั้งหมด — ตรงกับ ENUM status ใน docs/data-model.md

// สถานะผ้ายุบเหลือ lifecycle 4 สถานะ + exception state — ดู server/db/migrations/023_consolidate_fabric_statuses.sql
// + CENTRAL_SUPPLY "จ่ายกลาง" (สต๊อคปลายทางคู่กับสต๊อกกลาง) — ดู migrations/039_central_supply_status.sql
// ลำดับคีย์ = ลำดับที่แสดงในตัวกรอง/สรุปทุกหน้า (FABRIC_STATUSES)
export const STATUS_LABEL = {
  WASH: 'รับผ้าหลังซัก & ชั่งน้ำหนักผ้า',
  CENTRAL_STOCK: 'สต๊อกกลาง',
  CENTRAL_SUPPLY: 'จ่ายกลาง',
  WARD_CABINET: 'ตู้แผนก',
  IN_USE_WARD: 'ใช้งานที่วอร์ด',
  REWASH: 'ส่งซักใหม่',
  HOLD: 'พักใช้งาน',
  DECOMMISSIONED: 'แทงชำรุด',
  PENDING_DECOMMISSION: 'รออนุมัติแทงชำรุด',
};

export const STATUS_COLOR = {
  WASH: 'info',
  CENTRAL_STOCK: 'primary',
  CENTRAL_SUPPLY: 'secondary',
  WARD_CABINET: 'success',
  IN_USE_WARD: 'success',
  REWASH: 'error',
  HOLD: 'warning',
  DECOMMISSIONED: 'error',
  PENDING_DECOMMISSION: 'warning',
};

export const FABRIC_STATUSES = Object.keys(STATUS_LABEL);

// เรียงแถวสรุปต่อสถานะ ({ status, ... }) ตามลำดับ lifecycle — server คืนตามลำดับ ENUM ใน DB ซึ่งสถานะที่เพิ่ม
// ทีหลังอยู่ท้ายสุด (จ่ายกลางจะไปอยู่หลังแทงชำรุด)
export function sortByStatusOrder(rows = []) {
  const orderOf = (status) => {
    const index = FABRIC_STATUSES.indexOf(status);
    return index === -1 ? FABRIC_STATUSES.length : index;
  };
  return [...rows].sort((a, b) => orderOf(a.status) - orderOf(b.status));
}

// สต๊อคปลายทางที่เลือกได้ในหน้า "สแกนเข้าสต๊อค" (= สถานะผ้าหลังยืนยัน) ตัวแรก = ค่าเริ่มต้น
// ต้องตรงกับ STOCK_TYPES ใน server/src/schemas/scans.schema.js
// confirmText = คำบนปุ่มยืนยัน/ข้อความแจ้งผล, scanText = ชื่อเหตุการณ์ในไทม์ไลน์ผ้า,
// blink = ปุ่มยืนยันกระพริบเตือนว่าไม่ได้เข้าสต๊อกกลางตามปกติ
export const STOCK_OPTIONS = [
  {
    value: 'CENTRAL_STOCK',
    icon: 'solar:box-bold-duotone',
    color: 'success',
    confirmText: 'ยืนยันเข้าสต๊อคกลาง',
    scanText: 'สแกนเข้าสต๊อคกลาง',
  },
  {
    value: 'CENTRAL_SUPPLY',
    icon: 'solar:medical-kit-bold-duotone',
    color: 'secondary',
    confirmText: 'ยืนยันไปจ่ายกลาง',
    scanText: 'สแกนไปจ่ายกลาง',
    blink: true,
  },
];

export const stockOptionOf = (stockType) =>
  STOCK_OPTIONS.find((option) => option.value === stockType);

// สถานะต้นทางปกติก่อนสแกนเข้าสต๊อคนั้น — ซักเสร็จ หรือย้ายมาจากอีกสต๊อค (ไม่ถือว่าข้ามขั้นตอน)
// ตรงกับ expectedStatusesFor ใน server/src/controllers/stockScan.controller.js
export const stockScanExpectedStatuses = (stockType) => [
  'WASH',
  ...STOCK_OPTIONS.map((option) => option.value).filter((value) => value !== stockType),
];

// สถานะที่เมนู "เปลี่ยนสถานะผ้า" (POST /scans/status-change) รับเป็น from/to ได้ — ต้องตรงกับ
// STATUS_CHANGE_STATUSES ใน server/src/schemas/scans.schema.js (ไม่รวม HOLD/แทงชำรุด ที่มี flow แยก)
// REWASH = ส่งซักใหม่ — เปลี่ยนเป็นสถานะนี้แล้ว server บันทึกประวัติส่งซักใหม่ (rewash_records) ให้ด้วย
export const MANUAL_STATUS_CHANGE_STATUSES = [
  'WASH',
  'CENTRAL_STOCK',
  'CENTRAL_SUPPLY',
  'WARD_CABINET',
  'IN_USE_WARD',
  'REWASH',
];

// เหตุผล "ส่งซักใหม่" (ไม่บังคับ เลือกบน handheld) — ต้องตรงกับ REWASH_REASON_OPTIONS ใน
// nativeapp/src/constants/fabric.js เก็บใน rewash_records.reason_code (อื่นๆ = OTHER:<ข้อความ>)
export const REWASH_REASON_OPTIONS = [
  { value: 'STAINED', label: 'มีคราบ/สกปรก' },
  { value: 'ODOR', label: 'มีกลิ่น' },
  { value: 'CONTAMINATED', label: 'ปนเปื้อน/ตกพื้น' },
  { value: 'DAMP', label: 'ไม่แห้ง/อับชื้น' },
  { value: 'OTHER', label: 'อื่นๆ' },
];

// reason_code ของส่งซักใหม่ -> ข้อความ (null = ไม่ได้ระบุ)
export function formatRewashReason(reasonCode) {
  if (!reasonCode) return 'ไม่ระบุเหตุผล';
  if (reasonCode.startsWith('OTHER:')) {
    const text = reasonCode.slice('OTHER:'.length).trim();
    return text ? `อื่นๆ — ${text}` : 'อื่นๆ';
  }
  return REWASH_REASON_OPTIONS.find((o) => o.value === reasonCode)?.label ?? reasonCode;
}

// ล๊อคขนาดไฟล์รูปพัก/ชำรุดไม่เกิน 2MB — ต้องตรงกับ MAX_FILE_SIZE_BYTES ฝั่ง
// server/src/middleware/upload.js (backend เป็นด่านบังคับจริง อันนี้แค่กันผู้ใช้เห็น error เร็วขึ้น)
export const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

// เหตุผลพัก/แทงชำรุด — ใช้ชุดเดียวกับแอป handheld (nativeapp/src/constants/fabric.js)
// "อื่นๆ" ให้ผู้ใช้กรอกเหตุผลเอง เก็บลง reason_code (VARCHAR(100)) เป็น `OTHER:<ข้อความ>`
export const REASON_CODE_OPTIONS = [
  { value: 'DAMAGED_TORN', label: 'ผ้าขาด/รอยฉีก' },
  { value: 'STAINED_UNREMOVABLE', label: 'คราบไม่ออก' },
  { value: 'LOST_TAG', label: 'RFID Tag หลุด/เสีย' },
  { value: 'QUALITY_ISSUE', label: 'คุณภาพผ้าเสื่อม' },
  { value: 'OTHER', label: 'อื่นๆ' },
];

export const OTHER_REASON_PREFIX = 'OTHER:';
export const OTHER_REASON_MAX_LENGTH = 100 - OTHER_REASON_PREFIX.length;

// รหัสที่เลือก + ข้อความที่กรอกเอง (เฉพาะ "อื่นๆ") -> ค่าที่ส่งเป็น reasonCode ให้ server
export function buildReasonCode(code, otherText) {
  if (code !== 'OTHER') return code;
  return `${OTHER_REASON_PREFIX}${(otherText || '').trim()}`;
}

// reason_code จาก server -> ข้อความอ่านได้ (ค่าเก่าที่เป็นข้อความอิสระจากมือถือก็แสดงตามที่เก็บไว้)
export function formatReasonCode(reasonCode) {
  if (!reasonCode) return '-';
  if (reasonCode.startsWith(OTHER_REASON_PREFIX)) {
    const text = reasonCode.slice(OTHER_REASON_PREFIX.length).trim();
    return text ? `อื่นๆ — ${text}` : 'อื่นๆ';
  }
  return REASON_CODE_OPTIONS.find((o) => o.value === reasonCode)?.label ?? reasonCode;
}

// ประเภทเหตุการณ์ใน scan_logs (ENUM event_type ใน server/db/schema.sql) -> ชื่อ/ไอคอน/สี สำหรับ timeline
// ในโปรไฟล์ผ้า (คลังผ้าทั้งหมด / สแกนตรวจสอบผ้า)
export const SCAN_EVENT_META = {
  WASH_RECEIVE: {
    label: 'รับผ้าหลังซัก',
    icon: 'solar:washing-machine-bold-duotone',
    color: 'info',
  },
  WEIGHT_COUNT: {
    label: 'ชั่งน้ำหนัก & นับผ้าหลังซัก',
    icon: 'solar:scale-bold-duotone',
    color: 'info',
  },
  BUNDLE_CHECK: {
    label: 'ตรวจนับมัดผ้า',
    icon: 'solar:checklist-minimalistic-bold-duotone',
    color: 'secondary',
  },
  STOCK_SCAN: { label: 'สแกนเข้าสต๊อค', icon: 'solar:box-bold-duotone', color: 'primary' },
  WARD_ISSUE: { label: 'จ่ายผ้าไปตู้แผนก', icon: 'solar:delivery-bold-duotone', color: 'success' },
  WARD_RECEIVE: {
    label: 'รับผ้ากลับเข้าซัก',
    icon: 'solar:inbox-in-bold-duotone',
    color: 'warning',
  },
  CABINET_AUDIT: {
    label: 'ตรวจนับตู้แผนก',
    icon: 'solar:clipboard-list-bold-duotone',
    color: 'secondary',
  },
  TRANSFER: {
    label: 'โอนย้ายผ้า',
    icon: 'solar:transfer-horizontal-bold-duotone',
    color: 'secondary',
  },
  STATUS_CHANGE: { label: 'เปลี่ยนสถานะผ้า', icon: 'solar:pen-2-bold-duotone', color: 'default' },
  HOLD: { label: 'พักใช้งาน', icon: 'solar:pause-circle-bold-duotone', color: 'warning' },
  DECOMMISSION: {
    label: 'แทงชำรุด',
    icon: 'solar:trash-bin-minimalistic-bold-duotone',
    color: 'error',
  },
};

export const scanEventMeta = (eventType) =>
  SCAN_EVENT_META[eventType] ?? {
    label: eventType,
    icon: 'solar:tag-bold-duotone',
    color: 'default',
  };

// ชื่อเหตุการณ์ของ log 1 แถว — สแกนเข้าสต๊อคบอกด้วยว่าเข้าสต๊อคไหน (stock_type มากับ GET /fabric-items/:epc)
export function scanLogLabel(log) {
  const stockOption = log.event_type === 'STOCK_SCAN' ? stockOptionOf(log.stock_type) : null;
  return stockOption?.scanText ?? scanEventMeta(log.event_type).label;
}

// เหตุการณ์ที่นับเป็น "รอบซัก" (+1 wash_count) — ตรงกับ scans.controller.js#washReceiveBatch / #weightGate
export const WASH_EVENT_TYPES = ['WASH_RECEIVE', 'WEIGHT_COUNT'];

// สัดส่วนรอบซักที่ใช้ไปเทียบกับรอบซักสูงสุด (ล็อต override หมวดหมู่) — null = ไม่ได้ตั้งรอบสูงสุดไว้
export function washUsage(washCount, maxWashCycles) {
  const max = Number(maxWashCycles) || 0;
  if (max <= 0) return null;
  const percent = Math.min(100, Math.round(((Number(washCount) || 0) / max) * 100));
  let color = 'success';
  if (percent >= 90) color = 'error';
  else if (percent >= 70) color = 'warning';
  return { percent, color, remaining: Math.max(0, max - (Number(washCount) || 0)) };
}
