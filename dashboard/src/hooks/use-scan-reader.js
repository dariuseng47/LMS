import { useMemo, useState, useEffect, useCallback } from 'react';

import { useGetDevices } from 'src/actions/devices';

import { getStorage, setStorage, removeStorage } from './use-local-storage';

// ----------------------------------------------------------------------

/**
 * เครื่องอ่าน RFID ของหน้าสแกน — เลือกในแท็บ "เครื่องอ่าน" (scan-reader-tab.jsx) ไม่ใช่บนหน้าสแกน
 *
 * points = จุดสแกนที่ใช้หา "ค่าเริ่มต้น" ตามลำดับ (ตั้งในหน้า "อุปกรณ์ & สัญญาณ RFID") ตัวแรก = จุดของหน้านี้
 * fallbackFirst = ไม่มีเครื่องเริ่มต้นเลยก็ใช้เครื่องแรก (ปกติใช้ให้เองเฉพาะเมื่อมีเครื่องเดียว)
 * deviceType = ประเภทเดียว | deviceTypes = หลายประเภท (ต้องเป็นค่าคงที่ระดับ module) เช่น หน้าลงทะเบียนผ้า
 *   เลือกได้ทั้งประตูชั่งน้ำหนักและจุดตรวจสอบ
 *
 * เครื่องที่ผู้ใช้เลือกเองจำไว้ในเบราว์เซอร์นี้ (แยกตามโรงพยาบาล+จุดสแกน) — ตัวเลือกไม่ได้โชว์บนหน้าสแกนแล้ว
 * ถ้าโหลดหน้าใหม่แล้วเด้งกลับค่าเริ่มต้นเงียบ ๆ จะสแกนผิดเครื่องโดยไม่รู้ตัว
 * เลือกกลับเป็นเครื่องเริ่มต้น = เลิกจำ (ตามค่าเริ่มต้นต่อไปแม้ admin เปลี่ยนทีหลัง)
 * เครื่องที่จำไว้ถูกลบไปแล้ว = กลับไปใช้ค่าเริ่มต้นเอง
 */
export function useScanReader({
  hospitalId,
  deviceType,
  deviceTypes,
  points,
  fallbackFirst = false,
}) {
  const {
    devices: loadedDevices,
    devicesLoading,
    devicesError,
    refreshDevices,
  } = useGetDevices(hospitalId, deviceType);

  const devices = useMemo(
    () =>
      deviceTypes
        ? loadedDevices.filter((d) => deviceTypes.includes(d.device_type))
        : loadedDevices,
    [loadedDevices, deviceTypes]
  );

  const storageKey = hospitalId ? `scan-reader:${hospitalId}:${points[0]}` : null;
  const [pickedId, setPickedId] = useState(null);

  useEffect(() => {
    setPickedId(storageKey ? getStorage(storageKey) : null);
  }, [storageKey]);

  const defaultId = useMemo(() => {
    const preset = points
      .map((point) => devices.find((d) => (d.default_scan_points ?? []).includes(point)))
      .find(Boolean);
    if (preset) return preset.id;
    return devices.length === 1 || fallbackFirst ? (devices[0]?.id ?? '') : '';
  }, [devices, points, fallbackFirst]);

  const deviceId = devices.some((d) => d.id === pickedId) ? pickedId : defaultId;

  const selectDevice = useCallback(
    (id) => {
      if (!storageKey) return;
      if (id === defaultId) {
        removeStorage(storageKey);
        setPickedId(null);
      } else {
        setStorage(storageKey, id);
        setPickedId(id);
      }
    },
    [storageKey, defaultId]
  );

  return {
    devices,
    devicesLoading,
    devicesError,
    refreshDevices,
    deviceId,
    defaultId,
    selectDevice,
  };
}
