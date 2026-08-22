import * as SecureStore from 'expo-secure-store';

// Registry of supported handheld RFID readers — เครื่องแรกคือ Rodinbell Orca 50 (ตัวเครื่องมี UHF
// module ในตัว ไม่ใช่ Bluetooth sled แยก) เผื่อรุ่นต่อไปมาเพิ่มในนี้ทีหลังได้
export const RFID_DEVICES = [
  { id: 'RODINBELL_ORCA_50', label: 'Rodinbell Orca 50' },
];

const NONE_DEVICE_ID = 'NONE';
const STORAGE_KEY = 'welgroup_rfid_device';

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

export { NONE_DEVICE_ID };
