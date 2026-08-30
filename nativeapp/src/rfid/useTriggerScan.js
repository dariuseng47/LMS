import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';

import { getSelectedDeviceId, NONE_DEVICE_ID } from './deviceSettings';
import { useOrcaReader } from './useOrcaReader';

// รอสแกนแบบ "เหนี่ยวปุ่มไกที่ตัวเครื่อง" ให้เหมือนกันทุกหน้า — แอปไม่สั่งอ่านเอง อาศัย hardware
// trigger ของ Orca 50 (setTrigger(true) ตอน connect) เป็นตัวเริ่ม/หยุด inventory ที่ firmware
// เรียก onEpc(epc) ทุกครั้งที่ได้แท็กระหว่างเหนี่ยวไก และคืน triggerActive ไว้ให้จอโชว์ว่ากำลังกดปุ่ม
//
// onEpc อ้างผ่าน ref เสมอ → ส่ง inline closure ที่ปิดทับ state ล่าสุดเข้ามาได้โดยไม่ต้อง useCallback
const RELEASE_MS = 700;

export function useTriggerScan({ onEpc, enabled = true } = {}) {
  const isFocused = useIsFocused();
  const [rfidDeviceId, setRfidDeviceId] = useState(NONE_DEVICE_ID);
  const [triggerActive, setTriggerActive] = useState(false);
  const releaseTimer = useRef(null);
  const onEpcRef = useRef(onEpc);
  onEpcRef.current = onEpc;

  const hasRfidDevice = rfidDeviceId !== NONE_DEVICE_ID;
  const { status, errorMessage, listenTags, cleanBuffer } = useOrcaReader({
    enabled: hasRfidDevice && enabled,
  });

  useEffect(() => {
    getSelectedDeviceId().then(setRfidDeviceId);
  }, []);

  const listening = hasRfidDevice && enabled && isFocused && status === 'connected';
  useEffect(() => {
    if (!listening) return undefined;
    const onTag = (epc) => {
      // มีแท็กเข้ามา = กำลังเหนี่ยวไกอยู่ ต่ออายุตัวจับเวลา "ปล่อยไก" ทุกครั้งที่ได้แท็ก
      setTriggerActive(true);
      clearTimeout(releaseTimer.current);
      releaseTimer.current = setTimeout(() => {
        setTriggerActive(false);
        cleanBuffer(); // ปล่อยไกแล้วล้าง buffer ให้เหนี่ยวซ้ำแท็กเดิมได้อีก
      }, RELEASE_MS);
      onEpcRef.current?.(epc);
    };
    const unlisten = listenTags(onTag);
    return () => {
      clearTimeout(releaseTimer.current);
      setTriggerActive(false);
      if (unlisten) unlisten();
    };
  }, [listening, listenTags, cleanBuffer]);

  return {
    hasRfidDevice,
    rfidStatus: status,
    rfidErrorMessage: errorMessage,
    triggerActive,
  };
}
