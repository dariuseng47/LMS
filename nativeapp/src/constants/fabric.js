// Ported from dashboard/src/sections/fabric/fabric-constants.js — kept in sync manually
// (no shared package between the two apps) so both platforms read the same status colors.

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

// เหตุผลพัก/แทงชำรุด — ต้องตรงกับ REASON_CODE_OPTIONS ใน dashboard/src/sections/fabric/fabric-constants.js
// เก็บลง hold_decommission_records.reason_code เป็นรหัส (DAMAGED_TORN ...) ยกเว้น "อื่นๆ" ที่ผู้ใช้กรอก
// เหตุผลเอง จะเก็บเป็น `OTHER:<ข้อความ>` (คอลัมน์ VARCHAR(100)) — แสดงผลด้วย formatReasonCode
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

// reason_code จาก server -> ข้อความอ่านได้ (ค่าเก่าที่เป็นข้อความอิสระก็แสดงตามที่เก็บไว้)
export function formatReasonCode(reasonCode) {
  if (!reasonCode) return '-';
  if (reasonCode.startsWith(OTHER_REASON_PREFIX)) {
    const text = reasonCode.slice(OTHER_REASON_PREFIX.length).trim();
    return text ? `อื่นๆ — ${text}` : 'อื่นๆ';
  }
  return REASON_CODE_OPTIONS.find((o) => o.value === reasonCode)?.label ?? reasonCode;
}
