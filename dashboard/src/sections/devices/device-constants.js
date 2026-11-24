export const DEVICE_TYPES = [
  'WEIGHT_GATE',
  'FOLDING_TABLE',
  'WARD_KIOSK',
  'HANDHELD',
  'RFID_CHECKPOINT',
];

export const DEVICE_TYPE_LABEL = {
  WEIGHT_GATE: 'ประตูชั่งน้ำหนัก',
  FOLDING_TABLE: 'โต๊ะพับผ้า',
  WARD_KIOSK: 'ตู้ Kiosk ประจำวอร์ด',
  HANDHELD: 'เครื่องสแกนมือถือ (Handheld)',
  RFID_CHECKPOINT: 'เครื่องอ่าน RFID ที่จุดตรวจสอบ',
};

export const DEVICE_TYPE_ICON = {
  WEIGHT_GATE: 'solar:scale-bold-duotone',
  FOLDING_TABLE: 'solar:t-shirt-bold-duotone',
  WARD_KIOSK: 'solar:monitor-bold-duotone',
  HANDHELD: 'solar:smartphone-bold-duotone',
  RFID_CHECKPOINT: 'solar:wi-fi-router-bold-duotone',
};

// ----------------------------------------------------------------------
// จุดสแกนหน้างานที่ตั้ง "เครื่องเริ่มต้น (default)" ได้ — หน้างานที่มี dropdown เลือกเครื่องอ่าน
// จะเลือกอุปกรณ์ที่ตั้งเป็น default ของจุดนั้นให้อัตโนมัติ (ผู้ใช้เปลี่ยนเองได้)
// ค่าเหล่านี้ต้องตรงกับ server/src/schemas/device.schema.js (SCAN_POINTS)
// (server ยังรับ FABRIC_REGISTER_HANDHELD ของเดิม แต่ไม่มีหน้าไหนใช้แล้ว — handheld เลือกเครื่องในแอปเอง)

export const SCAN_POINTS = [
  'WASH_RECEIVE',
  'STOCK_SCAN',
  'INSPECT_SCAN',
  'FABRIC_REGISTER',
];

export const SCAN_POINT_LABEL = {
  WASH_RECEIVE: 'รับผ้าหลังซัก — สแกน + ชั่งน้ำหนัก',
  STOCK_SCAN: 'สแกนเข้าสต๊อค (สต๊อกกลาง/จ่ายกลาง)',
  INSPECT_SCAN: 'สแกนตรวจสอบผ้า',
  FABRIC_REGISTER: 'ลงทะเบียนผ้าใหม่ — เครื่องอ่าน RFID',
};

// จุดสแกน -> ประเภทอุปกรณ์ที่เป็น default ของจุดนั้นได้ (ต้องตรงกับ server/src/controllers/devices.controller.js)
export const SCAN_POINT_DEVICE_TYPES = {
  WASH_RECEIVE: ['WEIGHT_GATE'],
  STOCK_SCAN: ['RFID_CHECKPOINT'],
  INSPECT_SCAN: ['RFID_CHECKPOINT'],
  FABRIC_REGISTER: ['RFID_CHECKPOINT', 'WEIGHT_GATE'],
};

// ----------------------------------------------------------------------
// ชื่ออุปกรณ์ที่แสดงทุกหน้า = ประเภทอุปกรณ์ (ไม่มีเลข #) เช่น "ประตูชั่งน้ำหนัก"
// หลายเครื่องประเภทเดียวกันแยกด้วยบรรทัดรอง (deviceDetail)

export const deviceName = (deviceType) => DEVICE_TYPE_LABEL[deviceType] ?? deviceType;

// บรรทัดรองใต้ชื่อ: IP:Port + ผู้ดูแล (อุปกรณ์ที่ไม่ต่อ LAN เช่น handheld ไม่มี IP)
// ส่ง id มาด้วย = ไม่มีทั้ง IP และผู้ดูแลให้ใช้รหัสอุปกรณ์แทน ไม่งั้นเครื่องประเภทเดียวกันหน้าตาเหมือนกันหมด
export function deviceDetail({ id, ipAddress, port, caretakerName }) {
  const detail = [
    ipAddress ? `${ipAddress}:${port}` : null,
    caretakerName ? `ผู้ดูแล ${caretakerName}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return detail || (id ? `รหัสอุปกรณ์ ${id}` : '');
}
