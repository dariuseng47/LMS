// ค่าคงที่ใช้ร่วมกันในหน้า Fabric & Lot Management ทั้งหมด — ตรงกับ ENUM status ใน docs/data-model.md

export const STATUS_LABEL = {
  WASH: 'ซัก',
  DRY: 'อบ',
  WEIGHT_COUNT: 'ชั่งน้ำหนัก/นับ',
  FOLDING_QC: 'พับ/QC',
  CENTRAL_STOCK: 'สต๊อกกลาง',
  WARD_CABINET: 'ตู้แผนก',
  IN_USE_WARD: 'ใช้งานที่วอร์ด',
  HOLD: 'พักใช้งาน',
  DECOMMISSIONED: 'แทงชำรุด',
};

export const STATUS_COLOR = {
  WASH: 'info',
  DRY: 'info',
  WEIGHT_COUNT: 'default',
  FOLDING_QC: 'default',
  CENTRAL_STOCK: 'primary',
  WARD_CABINET: 'success',
  IN_USE_WARD: 'success',
  HOLD: 'warning',
  DECOMMISSIONED: 'error',
};

export const FABRIC_STATUSES = Object.keys(STATUS_LABEL);

export const REASON_CODE_OPTIONS = [
  { value: 'DAMAGED_TORN', label: 'ผ้าขาด/รอยฉีก' },
  { value: 'STAINED_UNREMOVABLE', label: 'คราบไม่ออก' },
  { value: 'LOST_TAG', label: 'RFID Tag หลุด/เสีย' },
  { value: 'QUALITY_ISSUE', label: 'คุณภาพผ้าเสื่อม' },
  { value: 'OTHER', label: 'อื่นๆ' },
];
