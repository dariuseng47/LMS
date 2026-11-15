// ค่าคงที่ใช้ร่วมกันในหน้า Fabric & Lot Management ทั้งหมด — ตรงกับ ENUM status ใน docs/data-model.md

// สถานะผ้ายุบเหลือ lifecycle 4 สถานะ + exception state — ดู server/db/migrations/023_consolidate_fabric_statuses.sql
export const STATUS_LABEL = {
  WASH: 'รับผ้าหลังซัก & ชั่งน้ำหนักผ้า',
  CENTRAL_STOCK: 'สต๊อกกลาง',
  WARD_CABINET: 'ตู้แผนก',
  IN_USE_WARD: 'ใช้งานที่วอร์ด',
  HOLD: 'พักใช้งาน',
  DECOMMISSIONED: 'แทงชำรุด',
  PENDING_DECOMMISSION: 'รออนุมัติแทงชำรุด',
};

export const STATUS_COLOR = {
  WASH: 'info',
  CENTRAL_STOCK: 'primary',
  WARD_CABINET: 'success',
  IN_USE_WARD: 'success',
  HOLD: 'warning',
  DECOMMISSIONED: 'error',
  PENDING_DECOMMISSION: 'warning',
};

export const FABRIC_STATUSES = Object.keys(STATUS_LABEL);

// สถานะที่เมนู "เปลี่ยนสถานะผ้า" (POST /scans/status-change) รับเป็น from/to ได้ — ต้องตรงกับ
// STATUS_CHANGE_STATUSES ใน server/src/schemas/scans.schema.js (ไม่รวม HOLD/แทงชำรุด ที่มี flow แยก)
export const MANUAL_STATUS_CHANGE_STATUSES = [
  'WASH',
  'CENTRAL_STOCK',
  'WARD_CABINET',
  'IN_USE_WARD',
];

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
  STOCK_SCAN: { label: 'สแกนเข้าสต๊อคกลาง', icon: 'solar:box-bold-duotone', color: 'primary' },
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
