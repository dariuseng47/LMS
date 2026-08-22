import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import OrcaScanner, { OrcaEvent } from 'react-native-rfid-orca50';

// เครื่อง Rodinbell Orca 50 เป็น Android handheld ที่มี UHF module ในตัวเครื่องเลย (ไม่ใช่ BLE sled
// แยก) — ดู modules/react-native-rfid-orca50/README.md เรื่อง armeabi-v7a-only native libs และ
// วิธี "single read" ที่ SDK ไม่มีให้ตรงๆ (ต้อง startRead() แล้วหยุดที่ tag แรกเอง)
const SINGLE_READ_TIMEOUT_MS = 10000;

export function useOrcaReader({ enabled }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error
  const [errorMessage, setErrorMessage] = useState('');
  const bulkListenerRef = useRef(null);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') {
      return undefined;
    }

    let cancelled = false;
    setStatus('connecting');
    OrcaScanner.connect()
      .then((ok) => {
        if (cancelled) return;
        setStatus(ok ? 'connected' : 'error');
        if (!ok) setErrorMessage('เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(err?.message || 'เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ');
      });

    return () => {
      cancelled = true;
      if (bulkListenerRef.current) {
        bulkListenerRef.current();
        bulkListenerRef.current = null;
      }
      OrcaScanner.disconnect();
      setStatus('idle');
    };
  }, [enabled]);

  const singleRead = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (status !== 'connected') {
          reject(new Error('เครื่องอ่าน RFID ยังไม่พร้อม'));
          return;
        }

        let settled = false;
        const onTag = (epc) => {
          if (settled) return;
          settled = true;
          OrcaScanner.removeon(OrcaEvent.Tag, onTag);
          OrcaScanner.stopRead();
          resolve(epc);
        };

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          OrcaScanner.removeon(OrcaEvent.Tag, onTag);
          OrcaScanner.stopRead();
          reject(new Error('ไม่พบ RFID Tag ในระยะเวลาที่กำหนด'));
        }, SINGLE_READ_TIMEOUT_MS);

        OrcaScanner.on(OrcaEvent.Tag, (epc) => {
          clearTimeout(timer);
          onTag(epc);
        });
        OrcaScanner.cleanTagBuffer();
        OrcaScanner.startRead();
      }),
    [status]
  );

  const startBulkRead = useCallback(
    (onTag) => {
      if (status !== 'connected') return;
      OrcaScanner.cleanTagBuffer();
      OrcaScanner.on(OrcaEvent.Tag, onTag);
      bulkListenerRef.current = () => OrcaScanner.removeon(OrcaEvent.Tag, onTag);
      OrcaScanner.startRead();
    },
    [status]
  );

  const stopBulkRead = useCallback(() => {
    OrcaScanner.stopRead();
    if (bulkListenerRef.current) {
      bulkListenerRef.current();
      bulkListenerRef.current = null;
    }
  }, []);

  return { status, errorMessage, singleRead, startBulkRead, stopBulkRead };
}
