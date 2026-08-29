import * as SecureStore from 'expo-secure-store';

// Registry of supported handheld RFID readers — เครื่องแรกคือ Rodinbell Orca 50 (ตัวเครื่องมี UHF
// module ในตัว ไม่ใช่ Bluetooth sled แยก) เผื่อรุ่นต่อไปมาเพิ่มในนี้ทีหลังได้
export const RFID_DEVICES = [
  { id: 'RODINBELL_ORCA_50', label: 'Rodinbell Orca 50' },
];

const NONE_DEVICE_ID = 'NONE';
const STORAGE_KEY = 'welgroup_rfid_device';
const POWER_STORAGE_KEY = 'welgroup_rfid_power';

// กำลังส่งเสาอากาศ (dBm) ของ UHF module ใน Orca 50 — ยิ่งสูงยิ่งอ่านได้ไกล/ไวขึ้น แต่กินไฟและ
// ร้อนกว่า ค่า default ตั้งสูงสุดไว้เลยเพราะหน้างานบ่นว่าสัญญาณอ่อน ปรับลงได้ในหน้า "ตั้งค่าเครื่อง"
export const READER_POWER = { min: 5, max: 30, default: 30 };

function clampPower(level) {
  const n = Math.round(Number(level));
  if (!Number.isFinite(n)) return READER_POWER.default;
  return Math.min(READER_POWER.max, Math.max(READER_POWER.min, n));
}

export async function getSelectedDeviceId() {
  const value = await SecureStore.getItemAsync(STORAGE_KEY);
  return value || NONE_DEVICE_ID;
}

export async function setSelectedDeviceId(deviceId) {
  if (!deviceId || deviceId === NONE_DEVICE_ID) {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, deviceId);
}

export async function getReaderPower() {
  const value = await SecureStore.getItemAsync(POWER_STORAGE_KEY);
  return value ? clampPower(value) : READER_POWER.default;
}

export async function setReaderPower(level) {
  const clamped = clampPower(level);
  await SecureStore.setItemAsync(POWER_STORAGE_KEY, String(clamped));
  return clamped;
}

export { NONE_DEVICE_ID };
