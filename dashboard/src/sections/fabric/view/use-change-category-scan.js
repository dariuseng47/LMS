import { useState, useEffect, useCallback } from 'react';

import { useAutoScan } from 'src/hooks/use-auto-scan';

import { scanCheckpoint } from 'src/actions/rfidReader';

import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------

// อ่านต่อเนื่องได้นานสุดเท่านี้แล้วหยุดเอง (แบบหน้าสแกนเข้าสต๊อค) กันลืมเปิดเครื่องอ่านทิ้งไว้
const MAX_CONTINUOUS_MS = 10 * 60 * 1000;

// สั่งเครื่องอ่าน: อ่านครั้งเดียว / อ่านต่อเนื่อง (จับเวลา + หยุดเองเมื่อครบเพดาน)
// onEpcs(codes) = รหัสที่อ่านได้ | active = แท็บสแกนเปิดอยู่
export function useChangeCategoryScan({ hospitalId, deviceId, active, onEpcs }) {
  const [scanning, setScanning] = useState(false);
  const [continuousSec, setContinuousSec] = useState(0);

  const scanOnce = useCallback(async () => {
    setScanning(true);
    try {
      const { epcs } = await scanCheckpoint(Number(deviceId), hospitalId);
      if (epcs.length === 0) toast.error('ไม่พบแท็กในระยะสัญญาณ');
      onEpcs(epcs.map((tag) => tag.epc));
    } catch (error) {
      toast.error(
        error?.message || 'สแกนไม่สำเร็จ — ตรวจสอบว่าเครื่องอ่านเปิดอยู่และเชื่อมเครือข่ายได้'
      );
    } finally {
      setScanning(false);
    }
  }, [deviceId, hospitalId, onEpcs]);

  const handleTags = useCallback((tags) => onEpcs(tags.map((tag) => tag.epc)), [onEpcs]);
  const {
    running: continuous,
    start,
    stop: stopContinuous,
  } = useAutoScan({ hospitalId, onTags: handleTags, maxErrors: 3 });

  useEffect(() => {
    if (!continuous) return undefined;
    const startedAt = Date.now();
    setContinuousSec(0);
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setContinuousSec(Math.floor(elapsed / 1000));
      if (elapsed >= MAX_CONTINUOUS_MS) {
        stopContinuous();
        toast.info('หยุดอ่านต่อเนื่องอัตโนมัติ (ครบ 10 นาที)');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [continuous, stopContinuous]);

  // หยุดอ่านเมื่อออกจากแท็บ หรือเปลี่ยนอุปกรณ์/เครื่อง (ลูปจำเครื่องตอนกดเริ่ม ไม่ตามเครื่องที่เลือกใหม่เอง)
  useEffect(() => {
    stopContinuous();
  }, [active, deviceId, stopContinuous]);

  const toggleContinuous = useCallback(() => {
    if (continuous) stopContinuous();
    else start(Number(deviceId));
  }, [continuous, deviceId, start, stopContinuous]);

  return { scanning, scanOnce, continuous, continuousSec, toggleContinuous, stopContinuous };
}
